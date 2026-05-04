import {
  critiqueDraft as runCritiqueModel,
} from "@/lib/agents/critic";
import { plan as runPlanModel } from "@/lib/agents/planner";
import { writerAgent } from "@/lib/agents/writer";
import { persistDraft } from "@/lib/db/drafts";
import { retrieveExemplars } from "@/lib/exemplars";
import type { GenerationDraftJson } from "@/types/generation-draft-json";
import type { Critique } from "@/types/critique";
import type { Plan } from "@/types/plan";
import { parsePipelineJson } from "@/lib/pipeline-json";
import { anthropicModelId } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import {
  ORCHESTRATOR_INSTRUCTIONS,
  ORCHESTRATOR_REFINEMENT_INSTRUCTIONS,
} from "@/lib/prompts";
import { runDeterministicChecks } from "@/lib/rubric";
import type { DraftGenerationAgentOptions } from "@/types/draft-generation-agent-options";
import type { GenerationInput } from "@/types/generation-input";
import type { RubricResult } from "@/types/rubric-result";
import { anthropic } from "@ai-sdk/anthropic";
import type { Channel, Draft, ExemplarKind, Offer } from "@prisma/client";
import {
  isTextUIPart,
  readUIMessageStream,
  tool,
  ToolLoopAgent,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";

const MAX_REVISION_ATTEMPT = 3;

type GenerationState = {
  plan: Plan | null;
  exemplars: {
    positive: string[];
    negative: string[];
  } | null;
  draftBody: string;
  rubric: RubricResult | null;
  critique: Critique | null;
  revisionCount: number;
  writeDraftCompletedCount: number;
  rubricAtWriteCount: number;
  critiqueAtWriteCount: number;
};

function draftToJson(d: Draft): GenerationDraftJson {
  return {
    id: d.id,
    kind: d.kind,
    channel: d.channel,
    offer: d.offer,
    topic: d.topic,
    content: d.content,
    pipelineJson: d.pipelineJson,
    generationLog: [],
    status: d.status,
    scheduledFor: d.scheduledFor?.toISOString() ?? null,
    dmThreadId: d.dmThreadId,
    createdAt: d.createdAt.toISOString(),
  };
}

function buildWriterPrompt(
  planJson: Plan,
  input: GenerationInput,
  revisionGuidance: string | null,
  baseDraft: string | null,
) {
  const offerLine =
    input.offer === "NONE"
      ? "No direct product CTA required unless the plan says otherwise."
      : `Offer focus: ${input.offer}. Align CTA with this offer.`;

  const editor = input.editorFollowUp?.trim() ?? "";
  const editorHeader =
    editor.length > 0
      ? `EDITOR INSTRUCTION (mandatory — satisfy exactly; overrides structured plan on shape, length, paragraphs, and tone when they conflict):\n${editor}\n\n`
      : "";

  const trimmedBase = baseDraft?.trim() ?? "";
  const baseSection =
    trimmedBase.length > 0
      ? `\n\nCurrent draft to revise (edit this text in place; keep what still fits unless EDITOR INSTRUCTION or Topic require a full rewrite):\n---\n${trimmedBase}\n---\n`
      : "";

  const rev = revisionGuidance
    ? `\n\nRevision notes (must satisfy):\n${revisionGuidance}`
    : "";

  return `${editorHeader}Channel: ${input.channel}
Kind: ${input.kind}
${offerLine}

Topic / context (hard constraints — format, length, one vs many paragraphs, tone limits; when these conflict with the structured plan, prefer Topic / context, EDITOR INSTRUCTION, and revision notes):
${input.topic}
${baseSection}Structured plan (follow when it does not conflict with EDITOR INSTRUCTION or Topic / context above):
${JSON.stringify(planJson, null, 2)}
${rev}`;
}

export function buildDraftGenerationUserPrompt(input: GenerationInput) {
  return [
    `Generate and persist one draft.`,
    `- kind: ${input.kind}`,
    `- channel: ${input.channel}`,
    `- offer: ${input.offer}`,
    `- topic:`,
    input.topic,
    input.draftId ? `- attach to draft id ${input.draftId}` : `- new draft`,
  ].join("\n");
}

export async function validateDraftEligibleForGeneration(
  input: GenerationInput,
): Promise<void> {
  if (!input.draftId) return;
  const row = await prisma.draft.findUnique({ where: { id: input.draftId } });
  if (!row) throw new Error("Draft not found");
  if (row.content !== "") throw new Error("Draft already has content");
}

export function createDraftGenerationAgent(
  input: GenerationInput,
  sink: {
    persisted: Draft | null;
  },
  options?: DraftGenerationAgentOptions | null,
) {
  const o = options ?? null;
  const fromPreload = o?.preloaded;
  const ctx: GenerationState = fromPreload
    ? {
        plan: fromPreload.plan,
        exemplars: fromPreload.exemplars,
        draftBody: fromPreload.initialDraftBody?.trim() ?? "",
        rubric: null,
        critique: null,
        revisionCount: 0,
        writeDraftCompletedCount: 0,
        rubricAtWriteCount: 0,
        critiqueAtWriteCount: 0,
      }
    : {
        plan: null,
        exemplars: null,
        draftBody: "",
        rubric: null,
        critique: null,
        revisionCount: 0,
        writeDraftCompletedCount: 0,
        rubricAtWriteCount: 0,
        critiqueAtWriteCount: 0,
      };

  const genInput = input;

  const generationTools = {
    planDraft: tool({
      description:
        "Build the structured plan (angle, hook, CTA, length) once before writing.",
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.plan) return ctx.plan;
        const p = await runPlanModel({
          topic: genInput.topic,
          channel: genInput.channel,
          offer: genInput.offer,
          kind: genInput.kind,
        });
        ctx.plan = p;
        return p;
      },
      toModelOutput: ({ output: p }) => ({
        type: "text" as const,
        value: [
          `Angle: ${p.angle}`,
          `Hook style: ${p.hookStyle}`,
          `Audience: ${p.audienceCue}`,
          `Words target: ~${String(p.targetLengthWords)}`,
        ].join("; "),
      }),
    }),

    retrieveExamples: tool({
      description:
        "Load positive and negative voice exemplars for the plan. Call exactly once after planning.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.plan) {
          throw new Error("retrieveExamples requires planDraft first.");
        }
        if (ctx.exemplars) {
          return {
            positive: ctx.exemplars.positive.length,
            negative: ctx.exemplars.negative.length,
          };
        }
        const snapshot = await retrieveExemplars({
          query: `${ctx.plan.angle} ${ctx.plan.hookStyle}`,
          kind: genInput.kind,
          channel: genInput.channel,
          k: 4,
        });
        ctx.exemplars = {
          positive: snapshot.positive.map((row) => row.content),
          negative: snapshot.negative.map((row) => row.content),
        };
        return {
          positive: ctx.exemplars.positive.length,
          negative: ctx.exemplars.negative.length,
        };
      },
      toModelOutput: ({ output }) => ({
        type: "text" as const,
        value: `Stored ${String(output.positive)} positive exemplar rows and ${String(output.negative)} negative rows for critic / writer.`,
      }),
    }),

    writeDraft: tool({
      description: `Writes the caption via Writer sub-agent. revisionAttempt 0 first; after critic verdict revise, use 1, then 2, then 3 if needed (max ${String(MAX_REVISION_ATTEMPT)} revision rounds).`,
      inputSchema: z.object({
        revisionAttempt: z
          .number()
          .int()
          .min(0)
          .max(MAX_REVISION_ATTEMPT),
        revisionGuidance: z.string().nullable(),
      }),
      execute: async function* ({ revisionAttempt, revisionGuidance }, { abortSignal }) {
        if (!ctx.plan) throw new Error("writeDraft requires planDraft first.");
        if (!ctx.exemplars) {
          throw new Error("writeDraft requires retrieveExamples first.");
        }
        if (revisionAttempt !== ctx.writeDraftCompletedCount) {
          throw new Error(
            `writeDraft revisionAttempt must be ${String(ctx.writeDraftCompletedCount)} for the next call in sequence.`,
          );
        }
        const baseDraft = ctx.draftBody.trim() || null;
        const toolGuidance = (revisionGuidance ?? "").trim();
        const prompt = buildWriterPrompt(
          ctx.plan,
          genInput,
          toolGuidance || null,
          baseDraft,
        );
        const streamResult = await writerAgent.stream({
          prompt,
          abortSignal,
        });
        for await (const message of readUIMessageStream<UIMessage>({
          stream: streamResult.toUIMessageStream<UIMessage>(),
        })) {
          yield message;
        }
        ctx.draftBody = ((await streamResult.text) ?? "").trim();
        ctx.revisionCount = revisionAttempt;
        ctx.writeDraftCompletedCount += 1;
        ctx.rubricAtWriteCount = 0;
        ctx.critiqueAtWriteCount = 0;
      },
      toModelOutput({ output }) {
        let excerpt = "(draft streamed to UI)";
        if (output?.parts) {
          for (let i = output.parts.length - 1; i >= 0; i--) {
            const p = output.parts[i];
            if (isTextUIPart(p)) {
              const t = p.text.trim();
              if (t.length > 0) {
                excerpt = t.slice(0, 400) + (t.length > 400 ? "…" : "");
                break;
              }
            }
          }
        }
        return { type: "text" as const, value: excerpt };
      },
    }),

    runRubric: tool({
      description: "Runs deterministic Maya rubric checks on the latest draft text.",
      inputSchema: z.object({}),
      execute: async () => {
        const body = ctx.draftBody.trim();
        if (!body) throw new Error("runRubric needs draftBody from writeDraft.");
        ctx.rubric = runDeterministicChecks(
          body,
          genInput.channel,
          genInput.offer,
        );
        ctx.rubricAtWriteCount = ctx.writeDraftCompletedCount;
        return ctx.rubric;
      },
      toModelOutput: ({ output: r }) => ({
        type: "text" as const,
        value: `Aggregate ${typeof r.score === "number" ? r.score.toFixed(2) : String(r.score)}; ${String(r.checks.filter((c) => c.pass).length)}/${String(r.checks.length)} checks pass.`,
      }),
    }),

    critiqueDraft: tool({
      description:
        "Runs Sonnet critic over plan, exemplars, and latest draft. Call after runRubric.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.plan || !ctx.exemplars) {
          throw new Error("critiqueDraft needs plan and exemplars.");
        }
        const body = ctx.draftBody.trim();
        if (!body) throw new Error("critiqueDraft needs draftBody from writeDraft.");
        const c = await runCritiqueModel(body, ctx.plan, ctx.exemplars);
        ctx.critique = c;
        ctx.critiqueAtWriteCount = ctx.writeDraftCompletedCount;
        return c;
      },
      toModelOutput: ({ output: c }) => {
        const scores = `voice ${String(c.voiceMatch)}/10 hook ${String(c.hookStrength)}/10 authenticity ${String(c.authenticity)}/10 cta ${String(c.ctaFit)}/10`;
        if (c.verdict === "revise") {
          const g = (c.revisionGuidance ?? "").trim();
          const nextAttempt = ctx.writeDraftCompletedCount;
          const canRevise =
            nextAttempt <= MAX_REVISION_ATTEMPT && nextAttempt > 0;
          if (canRevise) {
            return {
              type: "text" as const,
              value: `VERDICT revise — do NOT call finalizeDraft yet. Required next: writeDraft with revisionAttempt ${String(nextAttempt)} and revisionGuidance from the critic (${g ? g.slice(0, 500) + (g.length > 500 ? "…" : "") : "use dimension reasons"}), then runRubric, then critiqueDraft again. If verdict is still revise after revisionAttempt ${String(MAX_REVISION_ATTEMPT)}, call finalizeDraft. Scores: ${scores}`,
            };
          }
          return {
            type: "text" as const,
            value: `VERDICT revise but no revision rounds left (${String(MAX_REVISION_ATTEMPT)} max) — call finalizeDraft with this draft. Scores: ${scores}`,
          };
        }
        return {
          type: "text" as const,
          value: `VERDICT ship — you may call finalizeDraft after this rubric+critique round. ${scores}`,
        };
      },
    }),

    finalizeDraft: tool({
      description: `Persists the draft with pipeline JSON. Call exactly once last. If the latest critique verdict is revise, you must run writeDraft (next revisionAttempt in sequence), runRubric, and critiqueDraft first unless revisionAttempt ${String(MAX_REVISION_ATTEMPT)} has already completed for this draft. Rubric and critique must be from the latest written draft.`,
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.plan || !ctx.rubric || !ctx.critique) {
          throw new Error(
            "finalizeDraft requires plan, rubric, and critique results.",
          );
        }
        if (ctx.writeDraftCompletedCount < 1) {
          throw new Error("finalizeDraft requires a completed writeDraft first.");
        }
        if (ctx.rubricAtWriteCount !== ctx.writeDraftCompletedCount) {
          throw new Error(
            "runRubric on the latest draft text before finalizeDraft.",
          );
        }
        if (ctx.critiqueAtWriteCount !== ctx.writeDraftCompletedCount) {
          throw new Error(
            "run critiqueDraft on the latest draft text before finalizeDraft.",
          );
        }
        const minWritesBeforeFinalizeWhenRevise = 1 + MAX_REVISION_ATTEMPT;
        if (
          ctx.critique.verdict === "revise" &&
          ctx.writeDraftCompletedCount < minWritesBeforeFinalizeWhenRevise
        ) {
          throw new Error(
            `Critic verdict is revise: call writeDraft with revisionAttempt ${String(ctx.writeDraftCompletedCount)}, then runRubric and critiqueDraft before finalizeDraft.`,
          );
        }
        const body = ctx.draftBody.trim();
        if (!body) throw new Error("finalizeDraft needs non-empty draft body.");
        const persisted = await persistDraft({
          kind: genInput.kind,
          channel: genInput.channel,
          offer: genInput.offer,
          topic: genInput.topic,
          dmThreadId: genInput.dmThreadId,
          draftId: genInput.draftId,
          content: body,
          plan: ctx.plan,
          rubric: ctx.rubric,
          critique: ctx.critique,
          revisionCount: ctx.revisionCount,
        });
        sink.persisted = persisted;
        return { draft: draftToJson(persisted) };
      },
      toModelOutput: ({ output }) => ({
        type: "text" as const,
        value: `Saved draft ${output.draft.id}`,
      }),
    }),
  };

  return new ToolLoopAgent({
    id: "draft-generation",
    model: anthropic(anthropicModelId()),
    instructions: o?.instructions ?? ORCHESTRATOR_INSTRUCTIONS,
    stopWhen: ({ steps }) => steps.length >= 40,
    tools: generationTools,
  });
}

export async function streamDraftGeneration(
  writer: UIMessageStreamWriter<UIMessage>,
  input: GenerationInput,
): Promise<Draft> {
  await validateDraftEligibleForGeneration(input);
  const outcome = { persisted: null as Draft | null };
  const agent = createDraftGenerationAgent(input, outcome);
  const streamResult = await agent.stream({
    prompt: buildDraftGenerationUserPrompt(input),
  });
  writer.merge(streamResult.toUIMessageStream());
  await streamResult.consumeStream();
  if (!outcome.persisted) {
    throw new Error("finalizeDraft did not persist the draft.");
  }
  return outcome.persisted;
}

export async function streamDraftRefinement(
  writer: UIMessageStreamWriter<UIMessage>,
  input: GenerationInput,
): Promise<Draft> {
  if (!input.draftId) throw new Error("draftId required");
  const note = input.editorFollowUp?.trim();
  if (!note) throw new Error("editorFollowUp required");
  const row = await prisma.draft.findUnique({
    where: { id: input.draftId },
  });
  if (!row) throw new Error("Draft not found");
  if (row.status !== "PENDING") throw new Error("Draft is not pending");
  if (!row.content.trim()) throw new Error("Draft has no content to refine");
  let pipeline;
  try {
    pipeline = parsePipelineJson(row.pipelineJson);
  } catch {
    throw new Error("Draft pipeline is invalid");
  }
  const snapshot = await retrieveExemplars({
    query: `${pipeline.plan.angle} ${pipeline.plan.hookStyle}`,
    kind: input.kind,
    channel: input.channel,
    k: 4,
  });
  const exemplars = {
    positive: snapshot.positive.map((r) => r.content),
    negative: snapshot.negative.map((r) => r.content),
  };
  const outcome = { persisted: null as Draft | null };
  const agent = createDraftGenerationAgent(input, outcome, {
    preloaded: {
      plan: pipeline.plan,
      exemplars,
      initialDraftBody: row.content.trim(),
    },
    instructions: ORCHESTRATOR_REFINEMENT_INSTRUCTIONS,
  });
  const streamResult = await agent.stream({
    prompt: [
      "Refine this draft per the editor request below.",
      "",
      "Editor request:",
      note,
    ].join("\n"),
  });
  writer.merge(streamResult.toUIMessageStream());
  await streamResult.consumeStream();
  if (!outcome.persisted) {
    throw new Error("finalizeDraft did not persist the draft.");
  }
  return outcome.persisted;
}
