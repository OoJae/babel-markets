// Step 3: assess newsworthiness and binary tradability.
// Reject path short-circuits the rest of the pipeline so we do not burn tokens on
// synthesis for an article that cannot be tradable in the first place.

import { callStructured } from "@/lib/agent/llm";
import { TradabilitySchema } from "@/lib/agent/schema";
import { STEPS } from "@/lib/agent/prompts";

const SYSTEM = `${STEPS.assessTradability}

A tradable article describes a future event with a binary outcome that can be
verified by an authoritative public source. Reject the following kinds of articles:

- Opinion pieces, columns, editorials, "explainers" without a future event.
- Lifestyle, recipes, sports recaps, obituaries, listicles.
- Already-resolved events (announcements about something that happened in the past).
- Multi-outcome events that cannot be reduced to a single YES/NO. (You can sometimes
  decompose a 4-way election into a YES/NO on the favorite winning; only do this
  when one specific candidate is clearly the focus of the article.)
- Vague time horizons ("eventually", "soon", "in the coming years") with no date.

When is_tradable=false, set reason to a one-sentence explanation that names the
specific category of unsuitability.`;

export async function assessStep(args: {
  translatedText: string;
  sourceLang: string;
}) {
  const result = await callStructured({
    schema: TradabilitySchema,
    system: SYSTEM,
    prompt: `Source language: ${args.sourceLang}\n\nEnglish translation:\n${args.translatedText}`,
    temperature: 0.0,
    cacheSystemPrompt: true,
  });
  return result;
}
