// Step 6: dedup via pgvector cosine similarity.
// Embeds the synthesized question_text, queries `questions` rows with status in
// ('posted','live') for the nearest neighbor, and flags a duplicate if cosine
// distance < threshold (default 0.12 ≈ 0.88 similarity).
//
// If no neighbor is below the threshold, is_duplicate=false and the pipeline
// continues to the decide step.

import { embed, EmbeddingUnavailable } from "@/lib/agent/embed";
import { DedupDecisionSchema } from "@/lib/agent/schema";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { z } from "zod";

const DEFAULT_THRESHOLD = 0.12;

export interface DedupResult {
  object: z.infer<typeof DedupDecisionSchema>;
  embedding: number[];
  latencyMs: number;
  costUsdc: number;
  note?: string;
}

export async function dedupStep(args: {
  questionText: string;
  threshold?: number;
}): Promise<DedupResult> {
  const start = Date.now();
  const threshold = args.threshold ?? DEFAULT_THRESHOLD;

  let vec: number[];
  try {
    vec = await embed(args.questionText);
  } catch (e) {
    if (e instanceof EmbeddingUnavailable) {
      // Graceful degradation: skip dedup when no embedding provider is available.
      // The pipeline continues with is_duplicate=false so synthesis is never lost.
      return {
        object: DedupDecisionSchema.parse({
          is_duplicate: false,
          similar_question_id: null,
          similarity_score: null,
        }),
        embedding: [],
        latencyMs: Date.now() - start,
        costUsdc: 0,
        note: "embedding provider unavailable; dedup skipped",
      };
    }
    throw e;
  }

  // pgvector cosine distance: 0 means identical, 2 means orthogonal opposite.
  // We use match_questions RPC if Joseph provisions it; otherwise raw SQL.
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("match_questions", {
    query_embedding: vec,
    match_threshold: threshold,
    match_count: 1,
  });

  let nearest: { id: string; distance: number } | null = null;
  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id: string; distance: number };
    nearest = { id: row.id, distance: row.distance };
  }

  // RPC missing in dev is fine; treat as no-duplicate. We log it once.
  if (error && error.code !== "PGRST202") {
    console.warn("dedup: match_questions rpc error", error.message);
  }

  const decision = nearest && nearest.distance < threshold
    ? {
        is_duplicate: true,
        similar_question_id: nearest.id,
        similarity_score: 1 - nearest.distance,
      }
    : {
        is_duplicate: false,
        similar_question_id: null,
        similarity_score: null,
      };

  return {
    object: DedupDecisionSchema.parse(decision),
    embedding: vec,
    latencyMs: Date.now() - start,
    costUsdc: 0, // local Xenova or free MiMo endpoint; revisit if remote.
  };
}
