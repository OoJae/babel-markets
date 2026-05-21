// LLM judge used by the eval harness. It's the same scorer as the in-pipeline
// critique step, but exposed as a standalone callable so scripts/run-eval.ts can
// score independently of whether the pipeline self-critiqued.

import { critiqueStep } from "@/lib/agent/steps/critique";
import { averageQuality, type SynthesizedQuestion } from "@/lib/agent/schema";

export interface JudgeResult {
  resolvability: number;
  source_quality: number;
  timeliness: number;
  faithfulness: number;
  translation_fidelity: number;
  notes?: string;
  average: number;
}

export async function judgeQuestion(args: {
  sourceText: string;
  translatedText: string;
  question: SynthesizedQuestion;
}): Promise<JudgeResult> {
  const result = await critiqueStep(args);
  const score = result.object;
  return {
    ...score,
    average: averageQuality(score),
  };
}
