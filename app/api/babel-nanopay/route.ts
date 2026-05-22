// Minimal x402 payment relay for Babel Markets.
//
// This route exists to give the agent's GatewayClient.pay() something
// concrete to talk to. It does NOT gate inference; that happens separately
// in lib/agent/llm.ts. The payment is the demo signal: every step makes the
// agent EOA sign + settle a Nanopayment to a designated recipient, and the
// receipt streams to the paste box.
//
// Protocol (matches the buyer SDK's expectations exactly):
//   1. POST without `payment-signature` header: respond 402 with a
//      `PAYMENT-REQUIRED` header carrying base64(JSON.stringify({
//          x402Version: 2,
//          resource: { url, description, mimeType: "application/json" },
//          accepts: [paymentRequirements]
//      })). The body is `{}`. The buyer SDK reads the header, not the body.
//   2. POST with `payment-signature` header (base64 of a JSON PaymentPayload):
//      verify + settle via Circle's BatchFacilitatorClient, then return 200
//      with the settlement details and a base64-encoded `PAYMENT-RESPONSE`
//      header.

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

// Arc testnet CAIP-2 network id: eip155:5042002.
const ARC_TESTNET_CAIP = "eip155:5042002";

// Constants from the SDK's CIRCLE_BATCHING_NAME / CIRCLE_BATCHING_VERSION /
// GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS. Mirrored here so the seller does not
// have to import client-only symbols.
const CIRCLE_BATCHING_NAME = "GatewayWalletBatched";
const CIRCLE_BATCHING_VERSION = "1";
// 7 days plus a 100s buffer, matching GATEWAY_MIN_AUTH_VALIDITY_SECONDS + buffer.
const GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS = 7 * 24 * 60 * 60 + 100;

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
    maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
    description: "Babel Markets agent inference Nanopayment",
    extra: {
      name: CIRCLE_BATCHING_NAME,
      version: CIRCLE_BATCHING_VERSION,
      verifyingContract: ARC_GATEWAY_WALLET,
    },
  };
}

function fourOhTwo(req: NextRequest): Response {
  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: req.nextUrl.pathname,
      description: "Babel Markets agent inference Nanopayment",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements()],
  };
  const header = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return new Response(JSON.stringify({}), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "PAYMENT-REQUIRED": header,
    },
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

  // SDK sends the signed payment payload in the `payment-signature` header
  // (the Circle middleware reads it case-insensitively from req.headers).
  const paymentHeader =
    req.headers.get("payment-signature") ??
    req.headers.get("Payment-Signature") ??
    req.headers.get("x-payment");

  if (!paymentHeader) {
    return fourOhTwo(req);
  }

  const payload = decodePaymentHeader(paymentHeader);
  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Malformed payment-signature header" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const requirements = paymentRequirements();
  const facilitator = new BatchFacilitatorClient({ url: facilitatorUrl });

  try {
    const settle = await facilitator.settle(payload as any, requirements as any);
    const settleAny = settle as any;
    const responsePayload = {
      success: settleAny.success ?? true,
      transaction: settleAny.transaction ?? null,
      payer: settleAny.payer ?? null,
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
          "PAYMENT-RESPONSE": responseHeader,
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    console.warn("[babel-nanopay] settle failed:", msg.slice(0, 200));
    // Return a fresh 402 so the buyer SDK can retry with a new signature if
    // the previous one expired or was already used.
    return fourOhTwo(req);
  }
}
