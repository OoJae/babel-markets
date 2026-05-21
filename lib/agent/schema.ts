// Zod schemas that pin the structured output of every agent step.
// Each step in the pipeline returns one of these; that determinism is the whole
// reason the agent loop is observable and not a single-prompt black box.

import { z } from "zod";

export const CategoryEnum = z.enum([
  "politics",
  "macro",
  "sports",
  "crypto",
  "tech",
  "culture",
  "other",
]);
export type Category = z.infer<typeof CategoryEnum>;

export const CurrencyEnum = z.enum(["USDC", "EURC"]);
export type Currency = z.infer<typeof CurrencyEnum>;

// Step 1: language detection + cleanup.
export const LanguageDetectionSchema = z.object({
  source_lang: z.string().describe("ISO 639-1 or BCP-47 tag"),
  cleaned_text: z.string(),
  confidence: z.number().min(0).max(1),
});

// Step 2: translation, entity-preserving.
export const TranslationSchema = z.object({
  translated_text: z.string(),
  preserved_entities: z.array(z.string()),
  preserved_numbers: z.array(z.string()),
  preserved_dates: z.array(z.string()),
});

// Step 3: tradability assessment.
export const TradabilitySchema = z.object({
  is_tradable: z.boolean(),
  reason: z.string(),
  has_future_outcome: z.boolean(),
  has_authoritative_source: z.boolean(),
});

// Step 4: synthesized question.
export const QuestionSchema = z.object({
  question: z.string().max(200).describe("YES/NO formulation, no ambiguity"),
  resolution_rule: z.string().describe("Exact YES vs NO conditions"),
  resolution_source: z.string().url().describe("Authoritative URL"),
  expiry: z.string().describe("ISO 8601 datetime"),
  category: CategoryEnum,
  currency: CurrencyEnum,
  suggested_probability: z.number().min(0).max(1),
  source_lang: z.string(),
  entities: z.array(z.string()),
  reject: z.boolean(),
  reject_reason: z.string().optional(),
});
export type SynthesizedQuestion = z.infer<typeof QuestionSchema>;

// Step 5: self-critique score (also used by the eval harness).
export const QualityScoreSchema = z.object({
  resolvability: z.number().min(0).max(1),
  source_quality: z.number().min(0).max(1),
  timeliness: z.number().min(0).max(1),
  faithfulness: z.number().min(0).max(1),
  translation_fidelity: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type QualityScore = z.infer<typeof QualityScoreSchema>;

export function averageQuality(score: QualityScore): number {
  return (
    (score.resolvability +
      score.source_quality +
      score.timeliness +
      score.faithfulness +
      score.translation_fidelity) /
    5
  );
}

// Step 6: dedup decision.
export const DedupDecisionSchema = z.object({
  is_duplicate: z.boolean(),
  similar_question_id: z.string().nullable(),
  similarity_score: z.number().min(0).max(1).nullable(),
});

// Step 7: final post-or-hold decision with rationale.
export const PostDecisionSchema = z.object({
  decision: z.enum(["post", "hold"]),
  rationale: z.string().max(280),
});
