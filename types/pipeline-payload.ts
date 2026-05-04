import type { Critique } from "@/types/critique";
import type { Plan } from "@/types/plan";
import type { RubricResult } from "@/types/rubric-result";

export type PipelinePayload = {
  plan: Plan;
  rubric: RubricResult;
  critique: Critique;
  revisionCount: number;
};
