// USYC Teller, subscribe/redeem. Phase 5 deliverable.
//
// COMPLIANCE GUARDRAIL: USYC is non-US-only and wallets must be KYC allow-listed.
// Babel demonstrates the integration on testnet only and does NOT park real user funds.
// The README must say this. The dashboard must say this.
//
// USYC docs are NOT in the synced ARC-cli context. Live-doc fetch required:
// https://developers.circle.com/tokenized/usyc/subscribe-and-redeem

export interface USYCSubscribeParams {
  amountUsdc: string;
  destinationWallet: string;
}

export interface USYCSubscribeReceipt {
  txHash: string;
  usycReceived: string;
  pricePerShare: string;
}

export async function subscribeToUsyc(_params: USYCSubscribeParams): Promise<USYCSubscribeReceipt> {
  throw new Error(
    "USYC subscribe not implemented. Phase 5 task. Confirm Teller signatures at " +
      "https://developers.circle.com/tokenized/usyc/subscribe-and-redeem before implementing. " +
      "Testnet only. Do not use real user funds.",
  );
}

export async function redeemUsyc(_amountShares: string): Promise<USYCSubscribeReceipt> {
  throw new Error(
    "USYC redeem not implemented. Phase 5 task. See subscribe note for compliance constraints.",
  );
}
