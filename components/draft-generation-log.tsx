"use client";

import { MarkdownBody } from "@/components/markdown-body";
import {
  JsonTreeView,
  reasoningTextToTreeValue,
  ToolCallDisclosure,
} from "@/components/tool-call-json-view";
import { messageHasRenderableLogContent } from "@/lib/generation-chat";
import type { GenerationLogDisplayItem } from "@/types/generation-log-display-item";
import type { PipelineDatum } from "@/types/pipeline-datum";
import type { UIMessagePart } from "@/types/ui-message-part";
import { Alert } from "@heroui/react";
import type { UIMessage } from "ai";
import { isStaticToolUIPart, isTextUIPart } from "ai";
import type { ReactNode } from "react";

type DraftGenerationLogProps = {
  messages: UIMessage[];
  awaitingFinalize?: boolean;
};

function flattenUserPromptParts(parts: UIMessagePart[]): string {
  const lines: string[] = [];
  for (const part of parts) {
    if (isTextUIPart(part) && part.text.trim())
      lines.push(part.text.trim());
  }
  return lines.join("\n\n");
}

function UserMessageContent({ msg }: { msg: UIMessage }) {
  const body = flattenUserPromptParts(msg.parts ?? []).trim();
  if (!body.length) return null;
  return (
    <Alert status="accent" className="my-4">
      <Alert.Content>
        <Alert.Title>Request</Alert.Title>
        <MarkdownBody markdown={body} />
      </Alert.Content>
    </Alert>
  );
}

function phaseBusyLabel(phase: string) {
  switch (phase) {
    case "plan":
      return "Thinking...";
    case "retrieval":
      return "Retrieving data...";
    case "writer":
      return "Drafting...";
    case "rubric":
      return "Running checks...";
    case "critic":
      return "Reviewing...";
    default:
      return `Running (${phase})...`;
  }
}

function phaseDoneLabel(phase: string) {
  switch (phase) {
    case "plan":
      return "Thought";
    case "retrieval":
      return "Retrieved data";
    case "writer":
      return "Drafted";
    case "rubric":
      return "Checks complete";
    case "critic":
      return "Review complete";
    default:
      return phase;
  }
}

function pipelineSubtitle(
  phase: string,
  detail: unknown | undefined,
): string | null {
  if (detail == null) return null;
  if (
    phase === "retrieval" &&
    typeof detail === "object" &&
    detail !== null &&
    "positive" in detail &&
    "negative" in detail
  ) {
    const p = detail as { positive?: number; negative?: number };
    const pos = typeof p.positive === "number" ? p.positive : 0;
    const neg = typeof p.negative === "number" ? p.negative : 0;
    return `${pos} exemplars (${neg} negatives)`;
  }
  return null;
}

function isAssistantSubagentOutput(v: unknown): v is UIMessage {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as UIMessage).role === "assistant" &&
    Array.isArray((v as UIMessage).parts)
  );
}

function partStreamsLive(p: UIMessagePart): boolean {
  if (isStaticToolUIPart(p)) {
    if (p.state === "output-available" && p.preliminary === true) {
      return true;
    }
    if (
      p.type === "tool-writeDraft" &&
      p.state === "output-available" &&
      isAssistantSubagentOutput(p.output)
    ) {
      return nestedPartsStreamLive((p.output as UIMessage).parts ?? []);
    }
  }
  if (p.type === "dynamic-tool") {
    const d = p as {
      state?: string;
      preliminary?: boolean;
    };
    return d.state === "output-available" && d.preliminary === true;
  }
  return false;
}

function nestedPartsStreamLive(parts: UIMessagePart[]): boolean {
  for (const p of parts) {
    if (partStreamsLive(p)) return true;
  }
  return false;
}

function messageShowsLiveWork(parts: UIMessagePart[]): boolean {
  for (let i = 0; i < parts.length; i++) {
    if (partStreamsLive(parts[i])) return true;
  }
  return false;
}

function shouldShowStandalonePart(part: UIMessagePart): boolean {
  if (part.type === "step-start") return false;
  if (part.type === "data-pipeline") return false;
  if (part.type === "data-draft") return true;
  if (isTextUIPart(part)) return true;
  if (part.type === "reasoning") return true;
  if (isStaticToolUIPart(part)) return true;
  if (part.type === "dynamic-tool") return true;
  return false;
}

function buildDisplayItems(parts: UIMessagePart[]): GenerationLogDisplayItem[] {
  const items: GenerationLogDisplayItem[] = [];
  let pipeSerial = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === "data-pipeline") {
      const d = part.data as PipelineDatum;
      if (d.status === "start") {
        items.push({
          kind: "pipeline",
          phase: d.phase,
          running: true,
          key: `pipe-${pipeSerial++}`,
        });
      } else {
        for (let j = items.length - 1; j >= 0; j--) {
          const it = items[j];
          if (
            it.kind === "pipeline" &&
            it.phase === d.phase &&
            it.running
          ) {
            it.running = false;
            it.detail = d.detail;
            break;
          }
        }
      }
      continue;
    }

    if (shouldShowStandalonePart(part)) {
      items.push({ kind: "other", part, key: `o-${i}` });
    }
  }

  return items;
}

function Spinner() {
  return (
    <span
      className="inline-block size-[0.875rem] shrink-0 rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--color-foreground)_30%,transparent)] border-l-[color-mix(in_oklab,var(--color-foreground)_85%,transparent)] animate-spin"
      aria-hidden
    />
  );
}

function CursorPipelineRow({
  phase,
  running,
  detail,
}: {
  phase: string;
  running: boolean;
  detail?: unknown;
}) {
  const label = running ? phaseBusyLabel(phase) : phaseDoneLabel(phase);
  const subtitle = pipelineSubtitle(phase, detail);
  return (
    <div className="flex flex-col gap-0.5 py-1 font-sans text-[13px] leading-snug text-foreground/90">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex w-4 shrink-0 justify-center">
          {running ? <Spinner /> : null}
        </span>
        <span className="min-w-0">{label}</span>
      </div>
      {subtitle ? (
        <div className="pl-6 text-xs text-slate-600 dark:text-slate-400">{subtitle}</div>
      ) : null}
      {!running && detail != null && !subtitle ? (
        <div className="pl-6">
          <JsonTreeView value={detail} />
        </div>
      ) : null}
    </div>
  );
}

function NestedAssistantParts({
  ui,
  prefix,
}: {
  ui: UIMessage;
  prefix: string;
}) {
  const parts = ui.parts ?? [];
  return (
    <div className="flex flex-col border-l border-slate-200 pl-3 dark:border-white/10">
      {parts.map((nested, idx) => (
        <AssistantPartBody
          key={`${prefix}-n-${idx}`}
          part={nested}
          nestingKey={`${prefix}-n-${idx}`}
        />
      ))}
    </div>
  );
}

function AssistantPartBody({
  part,
  nestingKey,
}: {
  part: UIMessagePart;
  nestingKey: string;
}) {
  if (part.type === "data-draft") {
    const id = (part.data as { draft?: { id: string } }).draft?.id;
    return (
      <div className="py-1 pl-10 font-sans text-[13px] text-emerald-600 dark:text-emerald-400">
        Draft saved{id ? ` · ${id}` : ""}
      </div>
    );
  }
  if (isTextUIPart(part)) {
    if (!part.text.trim()) return null;
    return (
      <MarkdownBody markdown={part.text} />
    );
  }
  if (part.type === "reasoning") {
    return (
      <div className="flex flex-col gap-1 py-1 pl-10">
        <div className="font-sans text-[12px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Thought
        </div>
        <JsonTreeView value={reasoningTextToTreeValue(part.text)} />
      </div>
    );
  }
  if (part.type === "step-start") {
    return null;
  }
  if (isStaticToolUIPart(part)) {
    const name = part.type.replace(/^tool-/, "");
    const errorText =
      part.state === "output-error" ? part.errorText : undefined;
    const streaming =
      part.state === "output-available" &&
      part.preliminary === true;
    let outputSlot: ReactNode | undefined;
    let passthroughOutput: unknown = part.output;

    if (
      part.type === "tool-writeDraft" &&
      part.state === "output-available" &&
      isAssistantSubagentOutput(part.output)
    ) {
      passthroughOutput = undefined;
      outputSlot = (
        <NestedAssistantParts
          ui={part.output as UIMessage}
          prefix={nestingKey}
        />
      );
    }

    return (
      <ToolCallDisclosure
        toolLabel={name}
        input={part.input}
        state={part.state}
        output={passthroughOutput}
        errorText={errorText}
        outputSlot={outputSlot}
        triggerSuffix={streaming ? <Spinner /> : null}
      />
    );
  }
  if (part.type === "dynamic-tool") {
    const err =
      part.state === "output-error"
        ? (part as { errorText?: string }).errorText
        : undefined;
    const dg = part as { preliminary?: boolean; toolName?: string };
    const streaming =
      part.state === "output-available" && dg.preliminary === true;
    return (
      <div className="py-1 pl-10">
        <ToolCallDisclosure
          toolLabel={`Called tool · ${dg.toolName ?? "unknown"}`}
          titleClassName="font-sans text-[13px] text-foreground/90"
          input={part.input}
          state={part.state}
          output={part.output}
          errorText={err}
          triggerSuffix={streaming ? <Spinner /> : null}
        />
      </div>
    );
  }
  return null;
}

function AssistantPartPreview({
  part,
  partKey,
}: {
  part: UIMessagePart;
  partKey: string;
}) {
  return <AssistantPartBody part={part} nestingKey={partKey} />;
}

export function DraftGenerationLog({
  messages,
  awaitingFinalize = false,
}: DraftGenerationLogProps) {
  const ordered = messages;

  let anyPipelineRunning = false;
  let logHasRenderableBlocks = false;
  let anyToolStreaming = false;

  for (const m of ordered) {
    if (messageHasRenderableLogContent(m)) {
      logHasRenderableBlocks = true;
    }
    if (m.role !== "assistant") continue;
    const pts = m.parts ?? [];
    const items = buildDisplayItems(pts);
    if (messageShowsLiveWork(pts)) anyToolStreaming = true;
    for (const it of items) {
      if (it.kind === "pipeline" && it.running) anyPipelineRunning = true;
    }
  }

  const showFinishing =
    awaitingFinalize &&
    logHasRenderableBlocks &&
    !anyPipelineRunning &&
    !anyToolStreaming;

  const showBootstrap = awaitingFinalize && !logHasRenderableBlocks;

  if (messages.length === 0 && !showFinishing && !showBootstrap) return null;

  return (
    <div className="flex flex-col">
      {ordered.map((m) => {
        if (m.role === "user") {
          return (
            <div key={m.id}>
              <UserMessageContent msg={m} />
            </div>
          );
        }
        if (m.role !== "assistant") return null;
        const parts = m.parts ?? [];
        const items = buildDisplayItems(parts);
        return (
          <div key={m.id} className="flex flex-col border-b border-transparent last:border-b-0">
            {items.map((it) =>
              it.kind === "pipeline" ? (
                <CursorPipelineRow
                  key={it.key}
                  phase={it.phase}
                  running={it.running}
                  detail={it.detail}
                />
              ) : (
                <AssistantPartPreview key={it.key} part={it.part} partKey={it.key} />
              ),
            )}
          </div>
        );
      })}
      {showBootstrap ? (
        <div className="flex items-start gap-2 py-1 font-sans text-[13px] leading-snug text-foreground/90">
          <span className="mt-0.5 flex w-4 shrink-0 justify-center">
            <Spinner />
          </span>
          <span className="min-w-0">Thinking...</span>
        </div>
      ) : null}
      {showFinishing ? (
        <div className="flex items-start gap-2 py-1 font-sans text-[13px] leading-snug text-foreground/90">
          <span className="mt-0.5 flex w-4 shrink-0 justify-center">
            <Spinner />
          </span>
          <span className="min-w-0">Working on it...</span>
        </div>
      ) : null}
    </div>
  );
}
