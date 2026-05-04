import { z } from "zod";

export const PlanSchema = z.object({
  angle: z.string(),
  hookStyle: z.enum([
    "contrarian",
    "personal_story",
    "tactical",
    "callout",
    "stat_drop",
  ]),
  ctaKeyword: z
    .string()
    .nullable()
    .describe("e.g. SALES, CLOSE, INNER CIRCLE — null if no direct CTA"),
  targetLengthWords: z.number().int().min(20).max(400),
  audienceCue: z.string(),
});
