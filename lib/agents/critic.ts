import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { CritiqueSchema } from "@/lib/agents/critic-schema";
import { anthropicModelId } from "@/lib/models";
import { CRITIC_INSTRUCTIONS } from "@/lib/prompts";
import type { Plan } from "@/types/plan";

export function buildCriticPrompt(
  draft: string,
  plan: Plan,
  exemplars: { positive: string[]; negative: string[] },
) {
  const pos = exemplars.positive.map((t, i) => `${i + 1}. ${t}`).join("\n---\n");
  const neg = exemplars.negative.map((t, i) => `${i + 1}. ${t}`).join("\n---\n");
  return `Plan (JSON):\n${JSON.stringify(plan, null, 2)}

Positive exemplars:\n${pos}

Negative exemplars:\n${neg}

Draft:\n${draft}`;
}

export async function critiqueDraft(
  draft: string,
  plan: Plan,
  exemplars: { positive: string[]; negative: string[] },
) {
  const { object } = await generateObject({
    model: anthropic(anthropicModelId()),
    schema: CritiqueSchema,
    system: CRITIC_INSTRUCTIONS,
    prompt: buildCriticPrompt(draft, plan, exemplars),
  });
  return object;
}
