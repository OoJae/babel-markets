// Babel Markets agent pipeline.
//
// Orchestrates the 7 discrete steps (detect, translate, assess, synthesize,
// critique, dedup, decide). Each step emits a Langfuse span and a `traces` row.
// Single-pass revision: if critique average < 0.70, re-synthesize once with the
// critique notes appended, then re-critique. If still low, mark rejected.

import { startAgentTrace } from "@/lib/agent/langfuse";
import { getModelName } from "@/lib/agent/llm";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { detectStep } from "@/lib/agent/steps/detect";
import { translateStep } from "@/lib/agent/steps/translate";
import { assessStep } from "@/lib/agent/steps/assess";
import { synthesizeStep } from "@/lib/agent/steps/synthesize";
import { critiqueStep } from "@/lib/agent/steps/critique";
import { dedupStep } from "@/lib/agent/steps/dedup";
import { decideStep } from "@/lib/agent/steps/decide";
import { matchQuestionToMarket } from "@/lib/polymarket/match";
import type { GammaMarket } from "@/lib/polymarket/types";
import {
  averageQuality,
  type QualityScore,
  type SynthesizedQuestion,
} from "@/lib/agent/schema";

const QUALITY_THRESHOLD = 0.7;

export interface PipelineInput {
  sourceText: string;
  sourceUrl?: string;
  submissionId?: string;
  userId?: string;
  // When true, skip the traces table writes (used by the eval harness so we don't
  // pollute the DB with throwaway runs).
  skipTracePersist?: boolean;
  // Tag every Langfuse trace with this id so eval runs are filterable.
  evalRunId?: string;
}

export interface StepEvent {
  step: string;
  output: unknown;
  latencyMs: number;
  costUsdc: number;
  cachedInputTokens?: number;
  tokensIn?: number;
  tokensOut?: number;
  // Nanopayment receipt for this step when Nanopayments are enabled.
  // When disabled or unavailable, omitted.
  nanopayment?: {
    paid: boolean;
    amountUsdc: string;
    network?: string;
    txHash?: string | null;
    note?: string;
  };
}

export interface PipelineResult {
  question: SynthesizedQuestion;
  quality: QualityScore;
  matchedMarket?: GammaMarket;
  matchedSimilarity?: number;
  qualityAverage: number;
  shouldPost: boolean;
  rationale: string;
  totalCostUsdc: number;
  totalLatencyMs: number;
  rejectedEarly?: { reason: string };
  steps: StepEvent[];
}

interface RunOptions extends PipelineInput {
  onStep?: (event: StepEvent) => void | Promise<void>;
}

export async function runPipeline(opts: RunOptions): Promise<PipelineResult> {
  const trace = startAgentTrace({
    name: "babel.pipeline",
    submissionId: opts.submissionId,
    userId: opts.userId,
    metadata: opts.evalRunId ? { evalRunId: opts.evalRunId } : undefined,
  });

  const supabase = opts.skipTracePersist ? null : getSupabaseServiceClient();
  const model = getModelName();
  const steps: StepEvent[] = [];
  let totalCost = 0;
  const overallStart = Date.now();

  async function record(args: {
    step: string;
    output: unknown;
    latencyMs: number;
    costUsdc: number;
    cachedInputTokens?: number;
    tokensIn?: number;
    tokensOut?: number;
    input?: unknown;
    score?: number | null;
    nanopayment?: StepEvent["nanopayment"];
  }) {
    const event: StepEvent = {
      step: args.step,
      output: args.output,
      latencyMs: args.latencyMs,
      costUsdc: args.costUsdc,
      cachedInputTokens: args.cachedInputTokens,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      nanopayment: args.nanopayment,
    };
    steps.push(event);
    totalCost += args.costUsdc;
    trace
      .span({ name: args.step })
      .end({
        input: args.input,
        output: args.output,
        metadata: {
          latencyMs: args.latencyMs,
          costUsdc: args.costUsdc,
          cachedInputTokens: args.cachedInputTokens,
        },
      });
    if (opts.onStep) await opts.onStep(event);
    if (supabase && opts.submissionId) {
      await supabase
        .from("traces")
        .insert({
          submission_id: opts.submissionId,
          step: args.step,
          model,
          input: args.input ?? null,
          output: args.output ?? null,
          score: args.score ?? null,
          latency_ms: args.latencyMs,
          cost_usdc: args.costUsdc,
        });
    }
  }

  // 1. detect
  const detect = await detectStep(opts.sourceText);
  await record({
    step: "detect",
    output: detect.object,
    latencyMs: detect.latencyMs,
    costUsdc: detect.costUsdc,
    cachedInputTokens: detect.usage.cachedInputTokens,
    tokensIn: detect.usage.inputTokens,
    tokensOut: detect.usage.outputTokens,
    nanopayment: detect.nanopayment,
    input: { sourceTextPreview: opts.sourceText.slice(0, 240) },
  });

  // 2. translate
  const translate = await translateStep({
    sourceText: detect.object.cleaned_text,
    sourceLang: detect.object.source_lang,
  });
  await record({
    step: "translate",
    output: translate.object,
    latencyMs: translate.latencyMs,
    costUsdc: translate.costUsdc,
    cachedInputTokens: translate.usage.cachedInputTokens,
    tokensIn: translate.usage.inputTokens,
    tokensOut: translate.usage.outputTokens,
    nanopayment: translate.nanopayment,
    input: { sourceLang: detect.object.source_lang },
  });

  // 3. assess
  const assess = await assessStep({
    translatedText: translate.object.translated_text,
    sourceLang: detect.object.source_lang,
  });
  await record({
    step: "assess",
    output: assess.object,
    latencyMs: assess.latencyMs,
    costUsdc: assess.costUsdc,
    cachedInputTokens: assess.usage.cachedInputTokens,
    tokensIn: assess.usage.inputTokens,
    tokensOut: assess.usage.outputTokens,
    nanopayment: assess.nanopayment,
  });

  if (!assess.object.is_tradable) {
    const rejection: PipelineResult = {
      question: {
        question: "(rejected: not tradable)",
        resolution_rule: assess.object.reason,
        resolution_source: "https://babel-markets.example/rejected",
        expiry: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        category: "other",
        currency: "USDC",
        suggested_probability: 0,
        source_lang: detect.object.source_lang,
        entities: [],
        reject: true,
        reject_reason: assess.object.reason,
      },
      quality: {
        resolvability: 0,
        source_quality: 0,
        timeliness: 0,
        faithfulness: 0,
        translation_fidelity: translate.object.preserved_entities.length ? 0.8 : 0.5,
      },
      qualityAverage: 0,
      shouldPost: false,
      rationale: `Hold: ${assess.object.reason}`,
      totalCostUsdc: totalCost,
      totalLatencyMs: Date.now() - overallStart,
      rejectedEarly: { reason: assess.object.reason },
      steps,
    };
    return rejection;
  }

  // 4. synthesize
  let synth = await synthesizeStep({
    sourceText: opts.sourceText,
    translatedText: translate.object.translated_text,
    sourceLang: detect.object.source_lang,
    preservedEntities: translate.object.preserved_entities,
    preservedDates: translate.object.preserved_dates,
  });
  await record({
    step: "synthesize",
    output: synth.object,
    latencyMs: synth.latencyMs,
    costUsdc: synth.costUsdc,
    cachedInputTokens: synth.usage.cachedInputTokens,
    tokensIn: synth.usage.inputTokens,
    tokensOut: synth.usage.outputTokens,
    nanopayment: synth.nanopayment,
  });

  // 5. critique
  let crit = await critiqueStep({
    sourceText: opts.sourceText,
    translatedText: translate.object.translated_text,
    question: synth.object,
  });
  let qualityAvg = averageQuality(crit.object);
  await record({
    step: "critique",
    output: crit.object,
    latencyMs: crit.latencyMs,
    costUsdc: crit.costUsdc,
    cachedInputTokens: crit.usage.cachedInputTokens,
    tokensIn: crit.usage.inputTokens,
    tokensOut: crit.usage.outputTokens,
    nanopayment: crit.nanopayment,
    score: qualityAvg,
  });

  // Optional single revision pass.
  if (qualityAvg < QUALITY_THRESHOLD && !synth.object.reject) {
    const feedback = crit.object.notes ?? "Raise weak axes above 0.7.";
    synth = await synthesizeStep({
      sourceText: opts.sourceText,
      translatedText: translate.object.translated_text,
      sourceLang: detect.object.source_lang,
      preservedEntities: translate.object.preserved_entities,
      preservedDates: translate.object.preserved_dates,
      revisionFeedback: feedback,
    });
    await record({
      step: "synthesize:revise",
      output: synth.object,
      latencyMs: synth.latencyMs,
      costUsdc: synth.costUsdc,
      cachedInputTokens: synth.usage.cachedInputTokens,
      tokensIn: synth.usage.inputTokens,
      tokensOut: synth.usage.outputTokens,
      nanopayment: synth.nanopayment,
    });
    crit = await critiqueStep({
      sourceText: opts.sourceText,
      translatedText: translate.object.translated_text,
      question: synth.object,
    });
    qualityAvg = averageQuality(crit.object);
    await record({
      step: "critique:revise",
      output: crit.object,
      latencyMs: crit.latencyMs,
      costUsdc: crit.costUsdc,
      cachedInputTokens: crit.usage.cachedInputTokens,
      tokensIn: crit.usage.inputTokens,
      tokensOut: crit.usage.outputTokens,
      nanopayment: crit.nanopayment,
      score: qualityAvg,
    });
  }

  // 6. dedup
  const dedup = await dedupStep({ questionText: synth.object.question });
  await record({
    step: "dedup",
    output: dedup.object,
    latencyMs: dedup.latencyMs,
    costUsdc: dedup.costUsdc,
  });

  // 7. decide
  const decide = await decideStep({
    question: synth.object,
    quality: crit.object,
    qualityAverage: qualityAvg,
    isDuplicate: dedup.object.is_duplicate,
    similarQuestionId: dedup.object.similar_question_id,
  });
  await record({
    step: "decide",
    output: decide.object,
    latencyMs: decide.latencyMs,
    costUsdc: decide.costUsdc,
    cachedInputTokens: decide.usage.cachedInputTokens,
    tokensIn: decide.usage.inputTokens,
    tokensOut: decide.usage.outputTokens,
    nanopayment: decide.nanopayment,
  });

  // 8. map_to_market: only when decide says "post" and there's no duplicate.
  // Non-blocking by design; Gamma flakiness should not fail the synthesis.
  let matchedMarket: GammaMarket | undefined;
  let matchedSimilarity: number | undefined;
  if (decide.object.decision === "post" && !dedup.object.is_duplicate) {
    const mapStart = Date.now();
    try {
      const match = await matchQuestionToMarket(synth.object.question);
      const output = match
        ? {
            matched: true,
            market_id: match.market.id,
            condition_id: match.market.conditionId,
            question: match.market.question,
            url: match.market.url,
            similarity: match.similarity,
          }
        : { matched: false, similarity: 0 };
      await record({
        step: "map_to_market",
        output,
        latencyMs: Date.now() - mapStart,
        costUsdc: 0,
      });
      if (match) {
        matchedMarket = match.market;
        matchedSimilarity = match.similarity;
      }
    } catch (err) {
      await record({
        step: "map_to_market",
        output: {
          matched: false,
          error: err instanceof Error ? err.message : "unknown error",
        },
        latencyMs: Date.now() - mapStart,
        costUsdc: 0,
      });
    }
  }

  return {
    question: synth.object,
    quality: crit.object,
    qualityAverage: qualityAvg,
    shouldPost: decide.object.decision === "post" && !dedup.object.is_duplicate,
    rationale: decide.object.rationale,
    matchedMarket,
    matchedSimilarity,
    totalCostUsdc: totalCost,
    totalLatencyMs: Date.now() - overallStart,
    steps,
  };
}
