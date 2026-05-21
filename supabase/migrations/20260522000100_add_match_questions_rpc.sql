-- RPC for the dedup step. Returns the nearest neighbor question by cosine distance
-- on the embedding column, filtered to questions that are posted or live.

CREATE OR REPLACE FUNCTION match_questions(
    query_embedding extensions.vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE(id uuid, question_text varchar, distance float)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
    SELECT q.id, q.question_text, (q.embedding <=> query_embedding) AS distance
    FROM questions q
    WHERE q.embedding IS NOT NULL
      AND q.status IN ('posted', 'live')
    ORDER BY q.embedding <=> query_embedding ASC
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_questions(extensions.vector(384), float, int)
    TO authenticated, service_role;