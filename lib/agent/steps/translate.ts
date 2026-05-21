// Step 2: translate to English while preserving entities, numbers, and dates verbatim.

import { callStructured } from "@/lib/agent/llm";
import { TranslationSchema } from "@/lib/agent/schema";
import { STEPS } from "@/lib/agent/prompts";

const SYSTEM = `${STEPS.translate}

Output a faithful English translation. Hard constraints:

- Named entities (people, organizations, places) must appear verbatim from the source,
  not localized or transliterated. Example: "Bola Tinubu" stays "Bola Tinubu", not "Bola
  Tinabu". "Naijiria" stays as the source spelling unless it is a clear typo.
- Numbers must be exact. "N617" stays "N617", not "617 Naira". Keep currency symbols.
- Dates must be unchanged. "31 Julai 2026" stays as "31 July 2026" in English form but
  with the same calendar date.
- List the preserved entities, numbers, and dates as separate arrays so the downstream
  faithfulness check can verify nothing was hallucinated.
- If the source is already English, set translated_text = cleaned source verbatim.`;

export async function translateStep(args: {
  sourceText: string;
  sourceLang: string;
}) {
  const result = await callStructured({
    schema: TranslationSchema,
    system: SYSTEM,
    prompt: `Source language: ${args.sourceLang}\n\nArticle:\n${args.sourceText}`,
    temperature: 0.0,
    cacheSystemPrompt: true,
  });
  return result;
}
