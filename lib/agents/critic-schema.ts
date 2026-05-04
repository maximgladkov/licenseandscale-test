import { z } from "zod";

export const CritiqueSchema = z.object({
  voiceMatch: z.number().int().min(1).max(10),
  hookStrength: z.number().int().min(1).max(10),
  authenticity: z.number().int().min(1).max(10),
  ctaFit: z.number().int().min(1).max(10),
  reasons: z.object({
    voiceMatch: z.string(),
    hookStrength: z.string(),
    authenticity: z.string(),
    ctaFit: z.string(),
  }),
  verdict: z.enum(["ship", "revise"]),
  revisionGuidance: z.string().nullable(),
});
