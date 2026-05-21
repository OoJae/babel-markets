// Embeddings. Two providers, selected at first use:
//
//  1. Remote: the MiMo gateway's /v1/embeddings endpoint, if present.
//  2. Fallback: @xenova/transformers running multilingual-e5-small (384-dim, ~85MB
//     quantized) on Vercel's Node runtime. The first call downloads model weights
//     from the Hugging Face CDN; subsequent calls on a warm function take <100ms.
//
// The chosen provider is cached in Redis under `babel:embed:provider` so we don't
// re-probe on every request. Boot the agent in a fresh process and the first
// inference will probe; thereafter it reuses the answer until the cache expires.
//
// The output dimension is exposed as `EMBED_DIM` and is used to size the pgvector
// column. If the dimension differs from the Phase 1 schema's 1536, write a follow-up
// migration before any rows are inserted.

import { getRedis } from "@/lib/db/redis";

type Provider = "mimo" | "xenova";

interface ProviderState {
  provider: Provider;
  model: string;
  dim: number;
}

let stateCache: ProviderState | null = null;

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

// Xenova singleton. The pipeline factory is heavy; we cache the loaded model.
let xenovaPipe: any | null = null;
async function getXenovaPipe() {
  if (xenovaPipe) return xenovaPipe;
  // Dynamic import keeps the ONNX runtime out of the edge bundle.
  const { pipeline } = await import("@xenova/transformers");
  // multilingual-e5-small is 384-dim, quantized to ~85MB. Strong multilingual baseline.
  xenovaPipe = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
    quantized: true,
  });
  return xenovaPipe;
}

async function probeState(): Promise<ProviderState> {
  const mimo = await probeMimoEmbeddings();
  if (mimo) return mimo;
  // Confirm Xenova actually loads before we commit to it.
  const pipe = await getXenovaPipe();
  const out = await pipe("probe", { pooling: "mean", normalize: true });
  const dim = Array.isArray(out.data) ? out.data.length : (out.data as Float32Array).length;
  return { provider: "xenova", model: "Xenova/multilingual-e5-small", dim };
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
  try {
    const redis = getRedis();
    await redis.set("babel:embed:provider", probed, { ex: 60 * 60 * 24 });
  } catch {
    // Ignore.
  }
  return probed;
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

async function embedViaXenova(input: string): Promise<number[]> {
  const pipe = await getXenovaPipe();
  const out = await pipe(input, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

export async function embed(input: string): Promise<number[]> {
  const state = await getState();
  if (state.provider === "mimo") return embedViaMimo(input, state);
  return embedViaXenova(input);
}

export async function getEmbedState(): Promise<ProviderState> {
  return getState();
}

// Synchronous accessor for the dimension after at least one embed() call.
// Falls back to assuming 384 (Xenova multilingual-e5-small) if not yet probed.
export function getEmbedDim(): number {
  return stateCache?.dim ?? 384;
}
