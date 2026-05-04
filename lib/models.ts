export function anthropicModelId() {
  return process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
}

export function openaiEmbeddingModelId() {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}
