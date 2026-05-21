// Step 7: post-or-hold decision with a one-line rationale.
// The rationale gets appended to the market description so traders can read
// the agent's reasoning before they bet.

import { gatedCallStructured } from "@/lib/agent/gated-call";
import {
  PostDecisionSchema,
  type SynthesizedQuestion,
  type QualityScore,
} from "@/lib/agent/schema";

const SYSTEM = `You decide whether a synthesized prediction question should be posted
to Polymarket now, or held back.

Post if: quality score average >= 0.70, no duplicate exists, the article describes a
clear near-term event, and the resolution source is authoritative.

Hold if: average quality < 0.70, a similar market already exists, the event is too
far away to attract traders, or you suspect the resolution source could disappear.

Time horizon guidance: a question is "near-term" when its expiry is within 180 days
of TODAY's date (which will be supplied in the user message). Do not hold a question
just because it is months away if it is still within that window.

Write a one-sentence rationale (under 280 characters) that will become part of the
market description. Keep it neutral; no marketing language.`;

export async function decideStep(args: {
  question: SynthesizedQuestion;
  quality: QualityScore;
  qualityAverage: number;
  isDuplicate: boolean;
  similarQuestionId?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await gatedCallStructured({
    step: "decide",
    schema: PostDecisionSchema,
    system: SYSTEM,
    prompt: [
      `Today is ${today}.`,
      "",
      JSON.stringify(
        {
          question: args.question,
          quality: args.quality,
          qualityAverage: Number(args.qualityAverage.toFixed(3)),
          isDuplicate: args.isDuplicate,
          similarQuestionId: args.similarQuestionId ?? null,
        },
        null,
        2,
      ),
    ].join("\n"),
    temperature: 0.1,
    cacheSystemPrompt: true,
  });
  return result;
}
