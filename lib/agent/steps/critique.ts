// Step 5: self-critique against the 5-axis Babel rubric.
// This is the LLM judge. It reads the source article, the translation, and the
// synthesized question, then scores each axis 0 to 1. Average < 0.70 triggers
// one revision pass.

import { gatedCallStructured } from "@/lib/agent/gated-call";
import { QualityScoreSchema, type SynthesizedQuestion } from "@/lib/agent/schema";

const SYSTEM = `You are a strict editor scoring a Babel Markets prediction question.

Score each axis from 0 (terrible) to 1 (perfect). Do not award partial credit
unless the work is genuinely partial.

Rubric:

1. resolvability: Is the YES vs NO condition unambiguous and checkable on a specific
   date by a specific arbiter? Penalize subjective verbs ("notable", "significant",
   "successful"), missing dates, multi-outcome formulations.
2. source_quality: Is resolution_source an authoritative, durable URL (government,
   regulator, central bank, exchange, official sports body)? News outlets cap at 0.6
   no matter how reputable. Social media is 0.
3. timeliness: Is expiry between 7 and 180 days from today, with the article
   describing a near-term event? Already-passed expiry is 0. >180 days is 0.5 cap.
4. faithfulness: Does the question reflect the source article without hallucination?
   Every entity, number, and date in the question and resolution_rule must be
   traceable to the source. If anything is invented, drop to <= 0.3.
5. translation_fidelity: Compare entities and numbers across source and translation.
   Preserved verbatim = 1.0. Minor capitalization differences = 0.85. Localized,
   transliterated, or paraphrased entities = 0.5 or below. Missing entities = 0.

Add a one-sentence note for any axis that scored below 0.7 so the synthesizer can
revise. Notes go in the optional notes field.`;

export async function critiqueStep(args: {
  sourceText: string;
  translatedText: string;
  question: SynthesizedQuestion;
}) {
  const result = await gatedCallStructured({
    step: "critique",
    schema: QualityScoreSchema,
    system: SYSTEM,
    prompt: [
      "SOURCE ARTICLE:",
      args.sourceText,
      "",
      "ENGLISH TRANSLATION:",
      args.translatedText,
      "",
      "SYNTHESIZED QUESTION:",
      JSON.stringify(args.question, null, 2),
    ].join("\n"),
    temperature: 0.1,
    cacheSystemPrompt: true,
  });
  return result;
}
