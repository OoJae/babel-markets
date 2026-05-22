// Polymarket Gamma metadata reader. Gamma is a separate read-only HTTP API on
// https://gamma-api.polymarket.com that exposes market metadata (question text,
// outcomes, prices, end dates, condition id, token ids). Used by the
// question-to-market matcher and the market view page.

import type { GammaMarket } from "@/lib/polymarket/types";

const GAMMA_BASE = process.env.POLYMARKET_GAMMA_HOST || "https://gamma-api.polymarket.com";

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // Fall through and return [raw] below.
    }
    return [raw];
  }
  return [];
}

function parseNumberList(raw: unknown): number[] {
  const strs = parseStringList(raw);
  return strs.map((s) => Number(s)).filter((n) => Number.isFinite(n));
}

function asOptionalNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function normalize(raw: any): GammaMarket {
  const slug = String(raw.slug ?? raw.market_slug ?? "");
  return {
    id: String(raw.id ?? raw.market_id ?? ""),
    conditionId: String(raw.conditionId ?? raw.condition_id ?? ""),
    question: String(raw.question ?? raw.title ?? ""),
    description: raw.description ?? undefined,
    slug,
    category: raw.category ?? undefined,
    endDate: raw.endDate ?? raw.end_date_iso ?? undefined,
    closed: Boolean(raw.closed),
    active: Boolean(raw.active),
    outcomes: parseStringList(raw.outcomes),
    outcomePrices: parseNumberList(raw.outcomePrices ?? raw.outcome_prices),
    clobTokenIds: parseStringList(raw.clobTokenIds ?? raw.clob_token_ids),
    url: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com/",
    volume: asOptionalNumber(raw.volume ?? raw.volumeNum ?? raw.volume_num),
    liquidity: asOptionalNumber(raw.liquidity ?? raw.liquidityNum ?? raw.liquidity_num),
    bestBid: asOptionalNumber(raw.bestBid ?? raw.best_bid),
    bestAsk: asOptionalNumber(raw.bestAsk ?? raw.best_ask),
    lastTradePrice: asOptionalNumber(raw.lastTradePrice ?? raw.last_trade_price),
  };
}

export async function getMarket(idOrConditionId: string): Promise<GammaMarket | null> {
  const url = `${GAMMA_BASE}/markets/${encodeURIComponent(idOrConditionId)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gamma getMarket failed: ${res.status}`);
  const data = await res.json();
  return normalize(data);
}

export interface SearchOptions {
  limit?: number;
  active?: boolean;
  closed?: boolean;
}

export async function searchMarkets(
  query: string,
  opts: SearchOptions = {},
): Promise<GammaMarket[]> {
  // Gamma supports server-side search via the `q` and `tag_slug` query params.
  // We default to active + open markets so we never match a closed market.
  const params = new URLSearchParams();
  if (query) params.set("q", query.slice(0, 120));
  params.set("limit", String(opts.limit ?? 20));
  params.set("active", String(opts.active ?? true));
  params.set("closed", String(opts.closed ?? false));
  const url = `${GAMMA_BASE}/markets?${params.toString()}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Gamma searchMarkets failed: ${res.status}`);
  const data = (await res.json()) as unknown;
  const rows = Array.isArray(data) ? data : ((data as any)?.data ?? []);
  return rows.map(normalize).filter((m: GammaMarket) => m.id || m.conditionId);
}
