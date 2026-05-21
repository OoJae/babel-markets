// Step 4: synthesize the binary YES/NO question.
// This is the highest-stakes step. The question must be resolvable, sourced,
// timely, faithful, and currency-correct.

import { callStructured } from "@/lib/agent/llm";
import { QuestionSchema } from "@/lib/agent/schema";
import { STEPS, SYSTEM_PROMPT } from "@/lib/agent/prompts";

const SYSTEM = `${SYSTEM_PROMPT}

${STEPS.synthesize}

Output rules:

- question: a single sentence ending in a question mark, phrased so that YES and NO
  are unambiguous. Example: "Will the Nigerian government remove the petrol subsidy
  before 31 July 2026?" NOT "Is the Nigerian government likely to remove the subsidy?"
- resolution_rule: a precise paragraph stating exactly when this resolves YES and when
  it resolves NO. Include the date, the specific action or measurement, and the
  authoritative arbiter. Example: "Resolves YES if the Nigerian National Petroleum
  Corporation (NNPC) announces the removal of the petrol subsidy in an official press
  release before 23:59 WAT on 31 July 2026, or if such removal is confirmed by a
  Federal Government Gazette entry by the same deadline. Otherwise NO."
- resolution_source: a single durable URL pointing to an authoritative arbiter site.
  Government or regulator URLs first (gov.ng, federalreserve.gov, ecb.europa.eu).
  Then exchanges, official sports bodies, central banks. Never news outlets as the
  primary source; you can include a news URL only if the article describes a future
  press release whose URL is stable.
- expiry: ISO 8601 datetime, 7 to 180 days from today (today is roughly the current
  date in the user's environment; if unsure use 90 days from now).
- category: pick the single most fitting tag from the enum.
- currency: USDC unless the event is primarily European in audience and stakes, in
  which case EURC. African, LATAM, APAC, US events all stay USDC.
- suggested_probability: your honest prior, between 0 and 1.
- source_lang: copy from upstream.
- entities: every proper noun in the question_text and resolution_rule must also
  appear in this array. The downstream faithfulness check uses it.
- reject + reject_reason: only set if the article truly cannot meet the bar despite
  the earlier assess step letting it through. This is a backstop, not the primary
  reject path.`;

export async function synthesizeStep(args: {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  preservedEntities: string[];
  preservedDates: string[];
  audienceHint?: string;
  revisionFeedback?: string;
}) {
  const promptParts = [
    `Source language: ${args.sourceLang}`,
    `Entities to preserve verbatim: ${args.preservedEntities.join(", ")}`,
    `Dates to preserve verbatim: ${args.preservedDates.join(", ")}`,
    args.audienceHint ? `Audience hint: ${args.audienceHint}` : null,
    "",
    "English translation of the article:",
    args.translatedText,
  ].filter(Boolean);

  if (args.revisionFeedback) {
    promptParts.push(
      "",
      "Critique from the prior attempt; revise to address each point:",
      args.revisionFeedback,
    );
  }

  const result = await callStructured({
    schema: QuestionSchema,
    system: SYSTEM,
    prompt: promptParts.join("\n"),
    temperature: 0.2,
    cacheSystemPrompt: true,
  });
  return result;
}
