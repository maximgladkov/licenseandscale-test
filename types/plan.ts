import { PlanSchema } from "@/lib/agents/plan-schema";
import { z } from "zod";

export type Plan = z.infer<typeof PlanSchema>;
