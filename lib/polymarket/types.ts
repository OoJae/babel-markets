// Babel-side Polymarket types. These are a thin, stable subset of what the V2 SDK
// returns; the SDK's own types are intentionally not re-exported because we don't
// want the rest of the app to depend on the v1/v2 union shapes.

export type Side = "BUY" | "SELL";

export interface PostOrderParams {
  tokenID: string;
  price: number;
  size: number;
  side: Side;
  // Optional override; defaults to env POLYMARKET_BUILDER_CODE.
  builderCode?: string;
}

export interface SignedOrderPreview {
  // The signed order payload the SDK produced, kept opaque to avoid leaking SDK
  // internals into the rest of the app. Returned in preview mode instead of being
  // submitted to the CLOB.
  signedOrder: unknown;
  builderCode: string;
  tokenID: string;
  price: number;
  size: number;
  side: Side;
}

export interface PostOrderResult {
  submitted: boolean;
  preview?: SignedOrderPreview;
  // When submitted=true, this is the SDK's success payload (orderId etc).
  receipt?: unknown;
}

export interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  description?: string;
  slug?: string;
  category?: string;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  // Outcomes are stored as JSON strings in the Gamma API response; we parse.
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
  // Direct trading URL on polymarket.com.
  url: string;
  // Optional live numbers from Gamma. Not all markets carry them; absent fields
  // mean "Gamma did not return a value" not "value is zero".
  volume?: number;
  liquidity?: number;
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
}

export interface MarketMatch {
  market: GammaMarket;
  similarity: number;
}
