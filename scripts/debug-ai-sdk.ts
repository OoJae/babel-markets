// One-off diagnostic to confirm the AI SDK Anthropic provider talks to the MiMo gateway.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

function normalizeBaseURL(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}
const baseURL = normalizeBaseURL(process.env.ANTHROPIC_BASE_URL);
const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const modelId = process.env.AGENT_MODEL || "mimo-v2.5-pro";

console.log("baseURL:", baseURL);
console.log("apiKey length:", apiKey.length);
console.log("model:", modelId);

const anthropic = createAnthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
  // Force x-api-key header in case the SDK defaults to Bearer.
  headers: { "x-api-key": apiKey },
});

async function main() {
  try {
    const result = await generateText({
      model: anthropic(modelId),
      system: "respond with one word",
      prompt: "say ok",
      maxOutputTokens: 512,
    });
    console.log("text:", JSON.stringify(result.text));
    console.log("usage:", result.usage);

    // Now test structured output
    const { generateObject } = await import("ai");
    const { z } = await import("zod");
    const Schema = z.object({
      language: z.string(),
      is_english: z.boolean(),
    });
    const obj = await generateObject({
      model: anthropic(modelId),
      schema: Schema,
      system: "you detect the language of a snippet",
      prompt: 'Detect: "hola mundo"',
      maxOutputTokens: 512,
    });
    console.log("structured object:", obj.object);
    console.log("structured usage:", obj.usage);
  } catch (err: any) {
    console.error("ERROR:", err?.message ?? err);
    if (err?.cause) console.error("cause:", err.cause);
    if (err?.url) console.error("url:", err.url);
    if (err?.responseBody) console.error("response:", err.responseBody);
  }
}

main();
