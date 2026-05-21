// Babel-quality rubric scorer. Used both by the agent's self-critique step (Phase 2)
// and by the standalone eval harness in scripts/run-eval.ts (Phase 1).
//
// The harness assembles 30 to 50 fixed source articles, runs the pipeline on each,
// and gates Phase 2 exit on average score >= 0.70.

import { type SynthesizedQuestion, type QualityScore } from "./schema";

export interface RubricInput {
  sourceText: string;
  sourceLang: string;
  question: SynthesizedQuestion;
}

// Naive heuristic scorer. Phase 2 replaces this with a Claude-based self-critique
// that reads the source article and judges each axis. For Phase 1 we want the
// pipes flowing, not the model itself.
export function heuristicScore(input: RubricInput): QualityScore {
  const { question, sourceText } = input;
  const notes: string[] = [];

  // resolvability: penalize ambiguous verbs.
  const ambiguousVerbs = /\b(notable|significant|major|popular|important)\b/i;
  const resolvability = ambiguousVerbs.test(question.question) ? 0.4 : 0.85;
  if (resolvability < 0.7) notes.push("ambiguous verb");

  // source_quality: must be a real URL.
  let source_quality = 0.0;
  try {
    const u = new URL(question.resolution_source);
    source_quality = u.protocol === "https:" ? 0.9 : 0.6;
  } catch {
    source_quality = 0.0;
    notes.push("invalid resolution_source URL");
  }

  // timeliness: expiry must be within 180 days from now.
  let timeliness = 0.0;
  const expiry = new Date(question.expiry);
  if (!isNaN(expiry.getTime())) {
    const days = (expiry.getTime() - Date.now()) / 86_400_000;
    if (days > 0 && days <= 180) timeliness = 1.0 - days / 200;
    else if (days > 180) timeliness = 0.5;
    else timeliness = 0.0;
  } else {
    notes.push("unparseable expiry");
  }

  // faithfulness: every preserved entity should appear in the source text.
  const entityHits = question.entities.filter((e) =>
    sourceText.toLowerCase().includes(e.toLowerCase()),
  ).length;
  const faithfulness = question.entities.length
    ? entityHits / question.entities.length
    : 0.5;

  // translation_fidelity: heuristic placeholder. Replaced by LLM judge in Phase 2.
  const translation_fidelity = 0.75;

  return {
    resolvability,
    source_quality,
    timeliness,
    faithfulness,
    translation_fidelity,
    notes: notes.length ? notes.join("; ") : undefined,
  };
}
