// Polymarket CLOB v2 client wrapper. Phase 3 deliverable; this is the Phase 1 stub.
//
// CRITICAL ACCURACY RULE: do not invent signatures. Before implementing, fetch
// docs.polymarket.com/v2-migration and confirm the exact builder-code mechanic and
// SDK package name. The synced ARC-cli context contains no Polymarket docs, so this
// MUST be a live-doc fetch when Phase 3 starts.
//
// Revenue model: builder code lives in the signed EIP-712 order struct. Every order
// our app submits carries our builder identity and earns a fee share on the resulting
// fill. No token, no custody.

export interface PostOrderParams {
  tokenID: string;
  price: number;
  side: "BUY" | "SELL";
  size: number;
}

export interface PostedOrder {
  orderId: string;
  marketId: string;
  builderCode: string;
}

export async function postOrder(_params: PostOrderParams): Promise<PostedOrder> {
  // Phase 3 implementation. For now, throw a clear error so any premature call surfaces.
  throw new Error(
    "Polymarket integration not implemented. Phase 3 task. Confirm V2 SDK signatures from docs.polymarket.com/v2-migration first.",
  );
}

// Read a market's metadata from Gamma. Phase 3.
export async function getMarket(_marketId: string) {
  throw new Error("Polymarket Gamma client not implemented. Phase 3 task.");
}
