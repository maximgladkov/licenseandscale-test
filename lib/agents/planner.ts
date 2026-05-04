import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { Channel, Offer, ExemplarKind } from "@prisma/client";
import { PlanSchema } from "@/lib/agents/plan-schema";
import { anthropicModelId } from "@/lib/models";
import { PLANNER_INSTRUCTIONS } from "@/lib/prompts";

export async function plan(input: {
  topic: string;
  channel: Channel;
  offer: Offer;
  kind: ExemplarKind;
}) {
  const { object } = await generateObject({
    model: anthropic(anthropicModelId()),
    schema: PlanSchema,
    system: PLANNER_INSTRUCTIONS,
    prompt: `Channel: ${input.channel}\nKind: ${input.kind}\nOffer to push: ${input.offer}\nTopic/context: ${input.topic}`,
  });
  return object;
}
