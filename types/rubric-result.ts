import type { RubricCheck } from "@/types/rubric-check";

export type RubricResult = {
  checks: RubricCheck[];
  score: number;
};
