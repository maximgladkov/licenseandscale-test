import { CritiqueSchema } from "@/lib/agents/critic-schema";
import { z } from "zod";

export type Critique = z.infer<typeof CritiqueSchema>;
