// Gateway Nanopayments. Phase 4 deliverable.
//
// CRITICAL: the buyer wallet MUST be an EOA. Gateway uses ecrecover (not EIP-1271),
// so Modular Wallets cannot be the buyer. The agent EOA in AGENT_EOA_PRIVATE_KEY pays
// for its own inference; users do not pay per-question. Source:
// .arc-canteen/context/docs/circlefin-skills/use-modular-wallets.md
// .arc-canteen/context/docs/developers.circle.com/gateway/nanopayments/concepts/x402.md
//
// Pattern (per Circle quickstarts):
// - Seller (our inference endpoint): create middleware with createGatewayMiddleware
// - Buyer (the agent loop): present a PAYMENT-SIGNATURE header signed via EIP-3009
// - Facilitator (Circle): batches settlement onchain

export interface NanopaymentResult {
  paid: boolean;
  amountUsdc: string;
  paymentResponseHeader?: string;
  errorMessage?: string;
}

export async function payForInference(_amountUsdc: string): Promise<NanopaymentResult> {
  // Phase 4 implementation. Stub returns a deterministic "free" response so Phase 1
  // pipelines work without onchain side effects.
  return { paid: true, amountUsdc: "0.000000" };
}

export const GATEWAY_FACILITATOR_URLS = {
  testnet: "https://gateway-api-testnet.circle.com",
  mainnet: "https://gateway-api.circle.com",
} as const;
