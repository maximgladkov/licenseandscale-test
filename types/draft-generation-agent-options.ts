import type { Plan } from "@/types/plan";

export type DraftGenerationAgentOptions = {
  preloaded?: {
    plan: Plan;
    exemplars: { positive: string[]; negative: string[] };
    initialDraftBody?: string;
  };
  instructions?: string;
};
