// Step 2: translate to English while preserving entities, numbers, and dates verbatim.

import { gatedCallStructured } from "@/lib/agent/gated-call";
import { TranslationSchema } from "@/lib/agent/schema";
import { STEPS } from "@/lib/agent/prompts";

const SYSTEM = `${STEPS.translate}

Output a faithful English translation. Hard constraints:

- Named entities (people, organizations, places) must appear verbatim from the source,
  not localized or transliterated. Example: "Bola Tinubu" stays "Bola Tinubu", not "Bola
  Tinabu". "Naijiria" stays as the source spelling unless it is a clear typo.
- Numbers must be exact. "N617" stays "N617", not "617 Naira". Keep currency symbols.
- Dates must be PRESERVED VERBATIM in preserved_dates AND rendered in translated_text in
  English form using the SAME calendar date. Examples: "31 Julai 2026" -> translated_text
  says "31 July 2026"; preserved_dates contains both. "ojo kerinla osu Keje 2026" (the
  14th day of July 2026) -> translated_text says "14 July 2026"; preserved_dates
  contains the original Yoruba phrase. Future deadlines, calendar weeks, fiscal
  quarters all preserved. This matters most for African-language sources (Yoruba, Hausa,
  Igbo, Swahili) where the downstream assess step needs the date to be recoverable.
  Never drop a date.
- List the preserved entities, numbers, and dates as separate arrays so the downstream
  faithfulness check can verify nothing was hallucinated.
- If the source is already English, set translated_text = cleaned source verbatim.`;

export async function translateStep(args: {
  sourceText: string;
  sourceLang: string;
}) {
  const result = await gatedCallStructured({
    step: "translate",
    schema: TranslationSchema,
    system: SYSTEM,
    prompt: `Source language: ${args.sourceLang}\n\nArticle:\n${args.sourceText}`,
    temperature: 0.0,
    cacheSystemPrompt: true,
  });
  return result;
}
