// Embeddings. Three providers, selected at first use:
//
//  1. Remote: MiMo gateway's /v1/embeddings endpoint, if present (not, in practice).
//  2. Remote: Voyage AI voyage-3-large with output_dimension=384 to fit the
//     pgvector(384) column. Multilingual, strong on African languages.
//  3. Localhost fallback: @xenova/transformers running multilingual-e5-small
//     (384-dim, ~85MB quantized). Wrapped in try/catch because Vercel's
//     serverless runtime does not ship libonnxruntime.so.
//
// If all three providers fail, embed() throws EmbeddingUnavailable. Callers
// (dedup step, market matcher) catch and return safe defaults so the pipeline
// keeps running on Vercel even without a remote embedding key.
//
// The chosen provider is cached in Redis at `babel:embed:provider` so we don't
// re-probe on every request.

import { getRedis } from "@/lib/db/redis";

export class EmbeddingUnavailable extends Error {
  constructor(message = "No embedding provider available") {
    super(message);
    this.name = "EmbeddingUnavailable";
  }
}

type Provider = "mimo" | "voyage" | "xenova" | "none";

interface ProviderState {
  provider: Provider;
  model: string;
  dim: number;
}

let stateCache: ProviderState | null = null;

// ============================================================================
// MiMo (no-op in practice; gateway has no /v1/embeddings)
// ============================================================================

async function probeMimoEmbeddings(): Promise<ProviderState | null> {
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
        body: JSON.stringify({ model, input: "probe" }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const vec = data.data?.[0]?.embedding;
      if (Array.isArray(vec) && vec.length > 0) {
        return { provider: "mimo", model, dim: vec.length };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function embedViaMimo(input: string, state: ProviderState): Promise<number[]> {
  const baseURL =
    process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "") || "https://api.anthropic.com";
  const res = await fetch(`${baseURL}/v1/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    },
    body: JSON.stringify({ model: state.model, input }),
  });
  if (!res.ok) {
    throw new Error(`MiMo embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const vec = data.data?.[0]?.embedding;
  if (!vec) throw new Error("MiMo embeddings returned empty vector");
  return vec;
}

// ============================================================================
// Voyage AI (https://api.voyageai.com/v1/embeddings)
// ============================================================================

const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIM = 384;

async function probeVoyage(): Promise<ProviderState | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;
  try {
    const vec = await embedViaVoyage("probe", "document");
    if (vec.length > 0) {
      return { provider: "voyage", model: VOYAGE_MODEL, dim: vec.length };
    }
  } catch (e) {
    console.warn(
      "[embed] Voyage probe failed:",
      e instanceof Error ? e.message : e,
    );
  }
  return null;
}

async function embedViaVoyage(
  input: string,
  inputType: "document" | "query" = "document",
): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new EmbeddingUnavailable("VOYAGE_API_KEY missing");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: [input],
      model: VOYAGE_MODEL,
      output_dimension: VOYAGE_DIM,
      input_type: inputType,
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const vec = data.data?.[0]?.embedding;
  if (!vec || vec.length === 0) {
    throw new Error("Voyage embeddings returned empty vector");
  }
  return vec;
}

// ============================================================================
// Xenova (localhost fallback only; Vercel lacks libonnxruntime.so)
// ============================================================================

let xenovaPipe: any | null = null;
let xenovaBroken = false;

async function getXenovaPipe() {
  if (xenovaPipe) return xenovaPipe;
  if (xenovaBroken) {
    throw new EmbeddingUnavailable("Xenova previously failed to load");
  }
  try {
    const { pipeline } = await import("@xenova/transformers");
    xenovaPipe = await pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-small",
      { quantized: true },
    );
    return xenovaPipe;
  } catch (e) {
    xenovaBroken = true;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[embed] Xenova load failed (likely no libonnxruntime.so on this runtime):",
      msg.slice(0, 200),
    );
    throw new EmbeddingUnavailable(`Xenova load failed: ${msg}`);
  }
}

async function probeXenova(): Promise<ProviderState | null> {
  try {
    const pipe = await getXenovaPipe();
    const out = await pipe("probe", { pooling: "mean", normalize: true });
    const dim = Array.isArray(out.data)
      ? out.data.length
      : (out.data as Float32Array).length;
    return { provider: "xenova", model: "Xenova/multilingual-e5-small", dim };
  } catch {
    return null;
  }
}

async function embedViaXenova(input: string): Promise<number[]> {
  const pipe = await getXenovaPipe();
  const out = await pipe(input, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

// ============================================================================
// Orchestration
// ============================================================================

async function probeState(): Promise<ProviderState> {
  const mimo = await probeMimoEmbeddings();
  if (mimo) return mimo;
  const voyage = await probeVoyage();
  if (voyage) return voyage;
  const xenova = await probeXenova();
  if (xenova) return xenova;
  return { provider: "none", model: "(none)", dim: 384 };
}

async function getState(): Promise<ProviderState> {
  if (stateCache) return stateCache;
  try {
    const redis = getRedis();
    const cached = await redis.get<ProviderState>("babel:embed:provider");
    if (cached) {
      stateCache = cached;
      return cached;
    }
  } catch {
    // Redis missing locally is fine.
  }
  const probed = await probeState();
  stateCache = probed;
  // Cache for an hour rather than a day so a flaky probe self-heals quickly.
  // The "none" sentinel re-probes after an hour so a freshly-added VOYAGE_API_KEY
  // takes effect without needing to flush Redis.
  try {
    const redis = getRedis();
    await redis.set("babel:embed:provider", probed, { ex: 60 * 60 });
  } catch {
    // Ignore.
  }
  return probed;
}

export async function embed(input: string): Promise<number[]> {
  const state = await getState();
  if (state.provider === "mimo") return embedViaMimo(input, state);
  if (state.provider === "voyage") return embedViaVoyage(input, "document");
  if (state.provider === "xenova") return embedViaXenova(input);
  throw new EmbeddingUnavailable(
    "No embedding provider available; set VOYAGE_API_KEY or run Xenova-capable runtime",
  );
}

export async function getEmbedState(): Promise<ProviderState> {
  return getState();
}

// Synchronous accessor for the dimension after at least one embed() call.
// Defaults to 384 (matches our pgvector column) when not yet probed.
export function getEmbedDim(): number {
  return stateCache?.dim ?? 384;
}
