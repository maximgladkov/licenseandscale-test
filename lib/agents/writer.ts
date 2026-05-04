import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { Channel, ExemplarKind } from "@prisma/client";
import { retrieveExemplars } from "@/lib/exemplars";
import { anthropicModelId } from "@/lib/models";
import { WRITER_INSTRUCTIONS } from "@/lib/prompts";

const channelEnum = z.enum([
  "IG_CAPTION",
  "REEL_SCRIPT",
  "CAROUSEL",
  "YOUTUBE_INTRO",
  "STORY_QA",
  "DM",
]);

export const writerAgent = new ToolLoopAgent({
  model: anthropic(anthropicModelId()),
  instructions: WRITER_INSTRUCTIONS,
  stopWhen: stepCountIs(4),
  tools: {
    getExemplars: tool({
      description:
        "Fetch positive (good) and negative (bad) Maya-voice examples for a given angle. " +
        "Returns top-K positive and top-K negative ranked by semantic similarity to the query. " +
        "Use this BEFORE writing to ground yourself in voice.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Semantic query — usually the planned angle + hook style"),
        kind: z.enum(["CONTENT_POST", "DM_REPLY"]),
        channel: channelEnum.optional(),
        k: z.number().int().min(2).max(6).default(4),
      }),
      execute: async ({ query, kind, channel, k }) =>
        retrieveExemplars({
          query,
          kind: kind as ExemplarKind,
          channel: channel as Channel | undefined,
          k: k ?? 4,
        }),
    }),
  },
});
