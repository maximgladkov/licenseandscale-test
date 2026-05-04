CREATE INDEX IF NOT EXISTS exemplar_embedding_idx
  ON "Exemplar" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
