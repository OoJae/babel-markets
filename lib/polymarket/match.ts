// Question-to-market matcher.
//
// Given a synthesized question, search Gamma for the most similar live market by
// semantic similarity. Reuses the Xenova multilingual-e5-small embedder from
// lib/agent/embed.ts so we don't pull in a second embedding provider.
//
// Returns the best match if cosine similarity clears CONFIDENCE_THRESHOLD;
// otherwise returns null so the pipeline saves the synthesized question as a
// draft. The threshold is intentionally generous (0.55) because Gamma question
// wording rarely matches our synthesized phrasing word-for-word.

import { embed, EmbeddingUnavailable } from "@/lib/agent/embed";
import { searchMarkets } from "@/lib/polymarket/gamma";
import type { GammaMarket, MarketMatch } from "@/lib/polymarket/types";

const CONFIDENCE_THRESHOLD = 0.55;

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface MatchOptions {
  threshold?: number;
  candidates?: number;
  // Optional category hint to narrow the Gamma search query.
  category?: string;
}

export async function matchQuestionToMarket(
  questionText: string,
  opts: MatchOptions = {},
): Promise<MarketMatch | null> {
  const candidates = await searchMarkets(questionText, {
    limit: opts.candidates ?? 20,
    active: true,
    closed: false,
  });
  if (candidates.length === 0) return null;

  let qVec: number[];
  try {
    qVec = await embed(questionText);
  } catch (e) {
    if (e instanceof EmbeddingUnavailable) return null;
    throw e;
  }

  // Score each candidate by embedding its question text and taking cosine
  // similarity against the synthesized question's embedding. Sequential because
  // the embedder is single-instance; the candidate set is small.
  let best: MarketMatch | null = null;
  for (const c of candidates) {
    let cVec: number[];
    try {
      cVec = await embed(c.question);
    } catch (e) {
      if (e instanceof EmbeddingUnavailable) return null;
      throw e;
    }
    const sim = cosineSim(qVec, cVec);
    if (!best || sim > best.similarity) {
      best = { market: c, similarity: sim };
    }
  }

  if (!best) return null;
  const threshold = opts.threshold ?? CONFIDENCE_THRESHOLD;
  return best.similarity >= threshold ? best : null;
}

// Stable helper for the market view page when we already know the id.
export type { GammaMarket };
