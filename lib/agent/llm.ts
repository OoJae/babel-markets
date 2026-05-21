// Babel Markets LLM client.
//
// Single chokepoint for all model calls. Configured to hit an Anthropic-compatible
// endpoint, which for now is the MiMo gateway pointed to by ANTHROPIC_BASE_URL. The
// model id `mimo-v2.5-pro` is set per Joseph's instruction.
//
// Every call returns the structured output plus token usage + USDC cost so the
// pipeline can write it to the `traces` table and stream it to the paste box.
//
// IMPORTANT: provider and model are constructed lazily on first use, so that
// standalone scripts (the probe, the eval harness) can load .env.local AFTER
// importing this module. Module-level env reads would otherwise see empty strings.

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText, type LanguageModel } from "ai";
import { type ZodType } from "zod";

// The AI SDK Anthropic provider appends `/messages` to baseURL. Anthropic's own
// API expects `/v1/messages`, so if the env value doesn't already end in `/v1`
// we add it. Lets Joseph paste either form into .env.local without breaking.
function normalizeBaseURL(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

let cachedModel: LanguageModel | null = null;
let cachedModelId: string | null = null;

function ensureModel(): LanguageModel {
  if (cachedModel) return cachedModel;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const baseURL = normalizeBaseURL(process.env.ANTHROPIC_BASE_URL);
  const modelId = process.env.AGENT_MODEL || "mimo-v2.5-pro";
  const provider = createAnthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    // MiMo (and Anthropic native) auth via x-api-key. The AI SDK defaults to this
    // header on the official Anthropic URL but seems to drop it when baseURL is
    // overridden, so we set it explicitly.
    headers: { "x-api-key": apiKey },
  });
  cachedModel = provider(modelId);
  cachedModelId = modelId;
  return cachedModel;
}

function pricingPerM() {
  return {
    input: Number(process.env.AGENT_MODEL_INPUT_PRICE_PER_M || "3"),
    output: Number(process.env.AGENT_MODEL_OUTPUT_PRICE_PER_M || "15"),
  };
}

export interface ModelCallResult<T> {
  object: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
  costUsdc: number;
  latencyMs: number;
}

function computeCostUsdc(args: {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): number {
  // MiMo's gateway auto-applies prompt caching across calls; cache_read tokens are
  // billed at ~10 percent of input cost (Anthropic standard). We assume the same
  // discount here. If MiMo bills cache reads at full rate, swap the divisor.
  const p = pricingPerM();
  const cached = args.cachedInputTokens ?? 0;
  const freshInput = args.inputTokens; // SDK reports input_tokens as the non-cached portion
  const inputCost = (freshInput / 1_000_000) * p.input;
  const cacheCost = (cached / 1_000_000) * p.input * 0.1;
  const outputCost = (args.outputTokens / 1_000_000) * p.output;
  return inputCost + cacheCost + outputCost;
}

export async function callStructured<T>(args: {
  schema: ZodType<T>;
  system: string;
  prompt: string;
  // When true, the system prompt is sent with anthropic cache_control marker.
  cacheSystemPrompt?: boolean;
  temperature?: number;
}): Promise<ModelCallResult<T>> {
  const start = Date.now();
  const providerOptions = args.cacheSystemPrompt
    ? { anthropic: { cacheControl: { type: "ephemeral" as const } } }
    : undefined;

  const result = await generateObject({
    model: ensureModel(),
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    temperature: args.temperature ?? 0.2,
    // MiMo emits "thinking" content blocks before the final answer. The synthesize
    // and critique steps can be long, so we give a healthy budget. Thinking tokens
    // are billed as output but do not count toward schema validation.
    maxOutputTokens: 8192,
    // Repair pass for the rare case where MiMo returns slightly malformed JSON.
    // Adds one extra short call only when the first attempt fails validation.
    experimental_repairText: async ({ text, error }) => {
      try {
        const repaired = await generateText({
          model: ensureModel(),
          system:
            "You receive a malformed JSON object plus the validation error. Return ONLY a corrected JSON object that satisfies the schema. No commentary, no code fences.",
          prompt: `Validation error:\n${String(error)}\n\nMalformed output:\n${text}`,
          maxOutputTokens: 4096,
        });
        return repaired.text;
      } catch {
        return null;
      }
    },
    ...(providerOptions ? { providerOptions } : {}),
  });

  const latencyMs = Date.now() - start;
  // AI SDK 6 reports cache token counts via inputTokenDetails when the provider
  // surfaces them. We also peek at providerMetadata.anthropic for the raw fields.
  const usageRaw: any = (result as any).usage ?? {};
  const detail: any = usageRaw.inputTokenDetails ?? {};
  const meta: any = (result as any).providerMetadata?.anthropic ?? {};
  const usage = {
    inputTokens: Number(detail.noCacheTokens ?? usageRaw.inputTokens ?? 0),
    outputTokens: Number(usageRaw.outputTokens ?? 0),
    cachedInputTokens: Number(
      detail.cacheReadTokens ?? meta.cacheReadInputTokens ?? 0,
    ),
  };

  return {
    object: result.object as T,
    usage,
    costUsdc: computeCostUsdc(usage),
    latencyMs,
  };
}

export async function callRawText(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<{
  text: string;
  usage: ModelCallResult<unknown>["usage"];
  costUsdc: number;
}> {
  const result = await generateText({
    model: ensureModel(),
    system: args.system,
    prompt: args.prompt,
    // MiMo emits thinking blocks; default needs headroom.
    maxOutputTokens: args.maxOutputTokens ?? 1024,
  });
  const usageRaw: any = (result as any).usage ?? {};
  const detail: any = usageRaw.inputTokenDetails ?? {};
  const usage = {
    inputTokens: Number(detail.noCacheTokens ?? usageRaw.inputTokens ?? 0),
    outputTokens: Number(usageRaw.outputTokens ?? 0),
    cachedInputTokens: Number(detail.cacheReadTokens ?? 0),
  };
  return {
    text: result.text,
    usage,
    costUsdc: computeCostUsdc(usage),
  };
}

export function getModelName(): string {
  if (!cachedModelId) ensureModel();
  return cachedModelId ?? "unknown";
}

// Backwards-compatible aliases used by older imports.
export const MODEL_NAME = "mimo-v2.5-pro";
export const PRICING = pricingPerM();
