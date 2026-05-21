// One-shot probes that tell the rest of the agent what the MiMo gateway can do.
//
// We probe at boot the first time the agent runs in a new process, cache the answer
// in Redis (key `babel:probe:*`) for 24 hours, and stamp the answer onto a span so
// it's visible in Langfuse. Run with `npx tsx lib/agent/llm-probe.ts` to probe by hand.

import { z } from "zod";
import { callRawText, callStructured, MODEL_NAME } from "@/lib/agent/llm";
import { getRedis } from "@/lib/db/redis";

const PROBE_TTL_SECONDS = 60 * 60 * 24;

interface ProbeReport {
  modelId: string;
  baseURL: string;
  reachable: boolean;
  structuredOutput: boolean;
  cacheControl: boolean;
  embeddings: { available: boolean; dim?: number; modelTried?: string };
  notes: string[];
  probedAt: string;
}

async function reachable(): Promise<boolean> {
  try {
    const result = await callRawText({
      system: "respond with a single word",
      prompt: "ok",
      maxOutputTokens: 1024,
    });
    return typeof result.text === "string";
  } catch (e) {
    console.error("reachable() error:", e instanceof Error ? e.message : e);
    return false;
  }
}

const TinySchema = z.object({
  language: z.string(),
  is_english: z.boolean(),
});

async function structuredWorks(): Promise<boolean> {
  try {
    const out = await callStructured({
      schema: TinySchema,
      system: "you are a language detector",
      prompt: 'Detect the language of: "hello world"',
    });
    return out.object.is_english === true && typeof out.object.language === "string";
  } catch {
    return false;
  }
}

async function cacheControlWorks(): Promise<boolean> {
  try {
    const out = await callStructured({
      schema: TinySchema,
      system: "you are a language detector".repeat(120), // need >=1024 tokens for cache_control to fire
      prompt: 'Detect the language of: "hola mundo"',
      cacheSystemPrompt: true,
    });
    return (out.usage.cachedInputTokens ?? 0) > 0;
  } catch {
    return false;
  }
}

async function embeddingsWorks(): Promise<{
  available: boolean;
  dim?: number;
  modelTried?: string;
}> {
  const baseURL =
    process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "") || "https://api.anthropic.com";
  const candidates = [
    process.env.AGENT_EMBED_MODEL,
    "mimo-embed-v1",
    "text-embedding-3-small",
    "text-embedding-ada-002",
  ].filter(Boolean) as string[];

  for (const model of candidates) {
    try {
      const res = await fetch(`${baseURL}/v1/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        },
        body: JSON.stringify({ model, input: "Babel Markets probe" }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const vec = data.data?.[0]?.embedding;
      if (Array.isArray(vec) && vec.length > 0) {
        return { available: true, dim: vec.length, modelTried: model };
      }
    } catch {
      continue;
    }
  }
  return { available: false };
}

export async function probeAll(): Promise<ProbeReport> {
  const notes: string[] = [];

  const isReachable = await reachable();
  if (!isReachable) {
    notes.push("gateway unreachable, check ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL");
  }

  const structured = isReachable ? await structuredWorks() : false;
  if (isReachable && !structured) {
    notes.push("structured output via generateObject failed; may need json-mode fallback");
  }

  const cache = isReachable && structured ? await cacheControlWorks() : false;
  if (isReachable && structured && !cache) {
    notes.push("cache_control not honored; per-question cost is raw input cost");
  }

  const embed = await embeddingsWorks();
  if (!embed.available) {
    notes.push("no embeddings endpoint found; falling back to local Xenova model");
  }

  return {
    modelId: MODEL_NAME,
    baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    reachable: isReachable,
    structuredOutput: structured,
    cacheControl: cache,
    embeddings: embed,
    notes,
    probedAt: new Date().toISOString(),
  };
}

export async function getCachedProbe(): Promise<ProbeReport | null> {
  try {
    const redis = getRedis();
    const cached = await redis.get<ProbeReport>("babel:probe:report");
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function probeAndCache(force = false): Promise<ProbeReport> {
  if (!force) {
    const existing = await getCachedProbe();
    if (existing) return existing;
  }
  const report = await probeAll();
  try {
    const redis = getRedis();
    await redis.set("babel:probe:report", report, { ex: PROBE_TTL_SECONDS });
  } catch {
    // Redis missing locally is fine; we re-probe next process.
  }
  return report;
}

// CLI: `npx tsx lib/agent/llm-probe.ts`
const isCliEntry =
  typeof require !== "undefined" && require.main === module
    ? true
    : typeof process !== "undefined" &&
      process.argv?.[1]?.endsWith("llm-probe.ts");

if (isCliEntry) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
    config({ path: ".env", override: false });
    const report = await probeAndCache(true);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.reachable ? 0 : 1);
  })();
}
