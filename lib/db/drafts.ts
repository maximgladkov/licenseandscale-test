import type { Plan } from "@/types/plan";
import type { Critique } from "@/types/critique";
import { prisma } from "@/lib/prisma";
import type { RubricResult } from "@/types/rubric-result";
import type { PipelinePayload } from "@/types/pipeline-payload";
import type { Channel, Draft, ExemplarKind, Offer } from "@prisma/client";

export async function persistDraft(args: {
  kind: ExemplarKind;
  channel: Channel;
  offer: Offer;
  topic: string;
  content: string;
  dmThreadId?: string | null;
  plan: Plan;
  rubric: RubricResult;
  critique: Critique;
  revisionCount: number;
  draftId?: string | null;
}): Promise<Draft> {
  const pipeline: PipelinePayload = {
    plan: args.plan,
    rubric: args.rubric,
    critique: args.critique,
    revisionCount: args.revisionCount,
  };
  const pipelineJson = JSON.stringify(pipeline);
  if (args.draftId) {
    const existing = await prisma.draft.findUnique({
      where: { id: args.draftId },
    });
    if (!existing) {
      throw new Error("Draft not found");
    }
    if (existing.content !== "" && existing.status === "PENDING") {
      return prisma.draft.update({
        where: { id: args.draftId },
        data: {
          kind: args.kind,
          channel: args.channel,
          offer: args.offer,
          topic: args.topic,
          content: args.content,
          pipelineJson,
          dmThreadId: args.dmThreadId ?? null,
        },
      });
    }
    if (existing.content !== "") {
      throw new Error("Draft already has content");
    }
    return prisma.draft.update({
      where: { id: args.draftId },
      data: {
        kind: args.kind,
        channel: args.channel,
        offer: args.offer,
        topic: args.topic,
        content: args.content,
        pipelineJson,
        dmThreadId: args.dmThreadId ?? null,
      },
    });
  }
  return prisma.draft.create({
    data: {
      kind: args.kind,
      channel: args.channel,
      offer: args.offer,
      topic: args.topic,
      content: args.content,
      dmThreadId: args.dmThreadId ?? null,
      pipelineJson,
      status: "PENDING",
    },
  });
}
