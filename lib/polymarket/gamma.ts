// Polymarket Gamma metadata API wrapper. Phase 3 deliverable.
// Reads market state, prices, resolution status. Used by the fills poller and the
// market view page.

export interface GammaMarket {
  id: string;
  question: string;
  outcomes: Array<{ name: string; tokenId: string; price: number }>;
  resolutionDate: string | null;
  resolved: boolean;
}

export async function fetchGammaMarket(_marketId: string): Promise<GammaMarket> {
  throw new Error("Gamma client not implemented. Phase 3 task.");
}
