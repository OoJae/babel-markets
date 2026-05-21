// Step 1: detect source language and clean the text.
// franc gives a cheap heuristic ISO-639-3 code; the LLM final answer wins.

import { franc } from "franc";
import { callStructured } from "@/lib/agent/llm";
import { LanguageDetectionSchema } from "@/lib/agent/schema";
import { STEPS } from "@/lib/agent/prompts";

const SYSTEM = `${STEPS.detectLanguage}

Return ISO 639-1 tags (e.g. "yo", "sw", "es", "ar", "fr", "pt", "zh", "ig", "ha", "en").
The cleaned_text field should strip navigation, ads, bylines, social-share blurbs,
and "READ MORE" tails, but preserve the article body verbatim, including capitalization
and punctuation. Set confidence in [0,1].`;

export async function detectStep(sourceText: string) {
  const francGuess = franc(sourceText) || "und";
  const result = await callStructured({
    schema: LanguageDetectionSchema,
    system: SYSTEM,
    prompt: `franc guessed: "${francGuess}". Source article:\n\n${sourceText}`,
    temperature: 0.0,
    cacheSystemPrompt: true,
  });
  return result;
}
