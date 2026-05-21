// AttributionEscrow contract calls. Phase 5 deliverable.
// The contract source is at contracts/AttributionEscrow.sol; this is the typed
// off-chain wrapper.

import { getArcPublicClient } from "@/lib/chain/arc";

export interface CreditFeesParams {
  questionId: string;
  amountUsdc: string;
  creatorAddress: string;
}

export async function creditFees(_params: CreditFeesParams) {
  throw new Error("creditFees not implemented. Phase 5. Awaiting deployed contract address.");
}

export async function claimPayout(_creatorAddress: string) {
  throw new Error("claimPayout not implemented. Phase 5.");
}

// Read accrued balance for a creator. Useful for the dashboard.
export async function readAccruedBalance(_creatorAddress: string): Promise<string> {
  const _client = getArcPublicClient();
  throw new Error("readAccruedBalance not implemented. Phase 5.");
}
