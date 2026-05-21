-- The MiMo gateway has no /v1/embeddings endpoint (confirmed by probe on 2026-05-21).
-- Babel falls back to @xenova/transformers running multilingual-e5-small, which
-- produces 384-dim vectors. Phase 1's column was 1536; resize before any rows land.

DROP INDEX IF EXISTS idx_questions_embedding;
ALTER TABLE questions DROP COLUMN embedding;
ALTER TABLE questions ADD COLUMN embedding extensions.vector(384);
CREATE INDEX idx_questions_embedding ON questions
    USING hnsw (embedding extensions.vector_cosine_ops);
