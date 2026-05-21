// Minimal x402 payment relay for Babel Markets.
//
// This route exists to give the agent's GatewayClient.pay() something
// concrete to talk to. It does NOT gate inference; that happens separately
// in lib/agent/llm.ts. The payment is the demo signal: every step makes the
// agent EOA sign + settle a Nanopayment to a designated recipient, and the
// receipt streams to the paste box.
//
// Protocol:
//   1. POST without X-PAYMENT: respond 402 with the x402 accepts body that
//      tells the buyer how to construct the payment (network, USDC asset,
//      amount, payTo, GatewayWallet verifyingContract).
//   2. POST with X-PAYMENT (base64 of a JSON PaymentPayload): verify+settle
//      via Circle's BatchFacilitatorClient, then return 200 with the
//      settlement details and a base64-encoded X-PAYMENT-RESPONSE header.

import { NextRequest } from "next/server";
import {
  BatchFacilitatorClient,
} from "@circle-fin/x402-batching/server";
import { GATEWAY_FACILITATOR_URLS } from "@/lib/circle/nanopay";
import { ARC_CONTRACTS } from "@/lib/chain/arc";

export const runtime = "nodejs";
export const maxDuration = 30;

// Arc testnet Gateway Wallet (verifyingContract). Confirmed via the SDK's
// CHAIN_CONFIGS for the arcTestnet entry. The SDK also exposes this on
// GatewayClient.chainConfig.gatewayWallet at runtime; we hardcode the
// well-known value here so the seller doesn't need the buyer key.
const ARC_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

// Arc testnet domain id from CAIP-2: eip155:5042002.
const ARC_TESTNET_CAIP = "eip155:5042002";

function getSellerAddress(): string {
  const seller = process.env.NANOPAYMENT_SELLER_ADDRESS;
  if (seller && seller.startsWith("0x") && seller.length === 42) return seller;
  return "0x0000000000000000000000000000000000000000";
}

function getPriceAtomicUsdc(): string {
  // USDC has 6 decimals.
  const price = Number(process.env.NANOPAYMENT_PRICE_USDC || "0.001");
  return BigInt(Math.round(price * 1_000_000)).toString();
}

function paymentRequirements() {
  return {
    scheme: "exact" as const,
    network: ARC_TESTNET_CAIP,
    asset: ARC_CONTRACTS.USDC,
    amount: getPriceAtomicUsdc(),
    payTo: getSellerAddress(),
    maxTimeoutSeconds: 60 * 60 * 24 * 7,
    description: "Babel Markets agent inference Nanopayment",
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC_GATEWAY_WALLET,
    },
  };
}

function fourOhTwo(): Response {
  const body = {
    x402Version: 1,
    error: "X-PAYMENT header required",
    accepts: [paymentRequirements()],
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { "content-type": "application/json" },
  });
}

function decodePaymentHeader(header: string): any {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const facilitatorUrl =
    process.env.NANOPAYMENT_FACILITATOR_URL || GATEWAY_FACILITATOR_URLS.testnet;
  const paymentHeader =
    req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");

  if (!paymentHeader) {
    return fourOhTwo();
  }

  const payload = decodePaymentHeader(paymentHeader);
  if (!payload) {
    return new Response(
      JSON.stringify({ x402Version: 1, error: "Malformed X-PAYMENT header" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const requirements = paymentRequirements();
  const facilitator = new BatchFacilitatorClient({ url: facilitatorUrl });

  try {
    const settle = await facilitator.settle(payload as any, requirements as any);
    const responsePayload = {
      success: (settle as any).success ?? true,
      transaction: (settle as any).transaction ?? null,
      payer: (settle as any).payer ?? null,
      network: requirements.network,
      amount: requirements.amount,
    };
    const responseHeader = Buffer.from(JSON.stringify(responsePayload)).toString(
      "base64",
    );
    return new Response(
      JSON.stringify({
        ok: true,
        data: { step: "nanopayment", settled: true },
        settlement: responsePayload,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-payment-response": responseHeader,
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    return new Response(
      JSON.stringify({
        x402Version: 1,
        error: msg.slice(0, 200),
        accepts: [requirements],
      }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }
}
