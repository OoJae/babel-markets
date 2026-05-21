// Agent pipeline. Phase 1 ships a deterministic placeholder so the eval harness has
// a real shape to call. Phase 2 replaces the placeholder with the Claude Sonnet 4.6
// multi-step loop (detect, translate, assess, synthesize, critique, dedup, decide).

import { franc } from "franc";
import { startAgentTrace } from "./langfuse";
import { heuristicScore } from "./eval";
import { type SynthesizedQuestion } from "./schema";

export interface PipelineInput {
  sourceText: string;
  sourceUrl?: string;
  submissionId?: string;
  userId?: string;
}

export interface PipelineResult {
  question: SynthesizedQuestion;
  quality: ReturnType<typeof heuristicScore>;
  qualityAverage: number;
  shouldPost: boolean;
  rationale: string;
}

// Phase 1 stub: detects language with franc and returns a hardcoded skeleton question.
// Phase 2 will replace the body with real Claude calls per the 7 STEPS in prompts.ts.
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const trace = startAgentTrace({
    name: "babel.pipeline",
    submissionId: input.submissionId,
    userId: input.userId,
  });

  const detectSpan = trace.span({ name: "detect-language" });
  const sourceLang = franc(input.sourceText) || "und";
  detectSpan.end({ output: { sourceLang } });

  const synthSpan = trace.span({ name: "synthesize-stub" });

  // Pull a couple of capitalized tokens as fake "entities" so the harness can verify
  // the faithfulness path before the real LLM is wired in.
  const entityCandidates =
    input.sourceText.match(/\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)*/g) ?? [];
  const entities = Array.from(new Set(entityCandidates)).slice(0, 5);

  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const question: SynthesizedQuestion = {
    question: "PHASE 1 STUB. Replace in Phase 2.",
    resolution_rule:
      "Resolves YES if the placeholder pipeline is replaced with the real agent.",
    resolution_source: "https://github.com/OoJae/babel-markets",
    expiry,
    category: "other",
    currency: "USDC",
    suggested_probability: 0.5,
    source_lang: sourceLang,
    entities,
    reject: false,
  };
  synthSpan.end({ output: question });

  const quality = heuristicScore({
    sourceText: input.sourceText,
    sourceLang,
    question,
  });
  const qualityAverage =
    (quality.resolvability +
      quality.source_quality +
      quality.timeliness +
      quality.faithfulness +
      quality.translation_fidelity) /
    5;

  trace.update({ metadata: { qualityAverage } });

  return {
    question,
    quality,
    qualityAverage,
    shouldPost: qualityAverage >= 0.7,
    rationale:
      qualityAverage >= 0.7
        ? "Stub pipeline produced a placeholder; replace before going live."
        : "Quality below threshold; awaiting Phase 2 agent.",
  };
}
