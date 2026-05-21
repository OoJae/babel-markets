// Gateway Nanopayments client.
//
// Replaces the Phase 1 stub with a real Circle Gateway GatewayClient. The
// buyer is the agent EOA (private key in AGENT_EOA_PRIVATE_KEY); the seller is
// the same EOA's address by default (we own both sides of the demo for now).
//
// CRITICAL: Gateway uses ecrecover, NOT EIP-1271, so the buyer MUST be an EOA.
// Modular Wallets cannot pay Nanopayments. This is the architectural reason
// for the Phase 1 wallet split (users get Modular, agent gets EOA).
//
// Three modes:
//   1. Disabled: BABEL_NANOPAYMENTS_ENABLED != "1". pay() returns a "free"
//      receipt. Useful for local dev and the eval harness so we don't burn
//      testnet credits on every paste.
//   2. Live: enabled + agent EOA funded. Each call signs an EIP-3009
//      authorization, Circle's facilitator batches and settles onchain
//      (Arc testnet). pay() returns a real receipt with batch id and
//      settlement tx hash.
//   3. Disabled-by-error: enabled but the client fails to init (bad key,
//      facilitator down). Logs a warning and returns the "free" receipt so
//      the pipeline keeps working.

import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { Hex } from "viem";

export interface NanopaymentReceipt {
  paid: boolean;
  amountUsdc: string;
  network?: string;
  txHash?: string | null;
  paymentResponseHeader?: string | null;
  note?: string;
}

const FACILITATOR_URL_TESTNET = "https://gateway-api-testnet.circle.com";
const FACILITATOR_URL_MAINNET = "https://gateway-api.circle.com";

export const GATEWAY_FACILITATOR_URLS = {
  testnet: FACILITATOR_URL_TESTNET,
  mainnet: FACILITATOR_URL_MAINNET,
} as const;

let cachedClient: GatewayClient | null = null;
let cachedClientFailed = false;

function nanopaymentsEnabled(): boolean {
  return process.env.BABEL_NANOPAYMENTS_ENABLED === "1";
}

function getPricePerCallUsdc(): string {
  return process.env.NANOPAYMENT_PRICE_USDC || "0.001";
}

function ensureClient(): GatewayClient | null {
  if (cachedClient) return cachedClient;
  if (cachedClientFailed) return null;
  const key = process.env.AGENT_EOA_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    console.warn(
      "[nanopay] AGENT_EOA_PRIVATE_KEY missing or invalid; Nanopayments disabled",
    );
    cachedClientFailed = true;
    return null;
  }
  try {
    cachedClient = new GatewayClient({
      chain: "arcTestnet",
      privateKey: key as Hex,
    });
    return cachedClient;
  } catch (e) {
    console.warn(
      "[nanopay] GatewayClient init failed:",
      e instanceof Error ? e.message : e,
    );
    cachedClientFailed = true;
    return null;
  }
}

export function getAgentAddress(): string | null {
  const client = ensureClient();
  return client ? client.address : null;
}

export interface PayInferenceArgs {
  url: string;
  method?: "POST" | "GET";
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PayInferenceResult<T = unknown> {
  ok: boolean;
  data?: T;
  receipt: NanopaymentReceipt;
  error?: string;
}

/**
 * Calls the gated inference endpoint with automatic x402 payment handling.
 * Returns the response data plus a Nanopayment receipt.
 *
 * When Nanopayments are disabled or the client fails to init, falls through
 * to a plain fetch() with no payment; the receipt reflects this with paid=false.
 */
export async function payAndCall<T = unknown>(
  args: PayInferenceArgs,
): Promise<PayInferenceResult<T>> {
  const price = getPricePerCallUsdc();

  if (!nanopaymentsEnabled()) {
    return plainFetch<T>(args, "Nanopayments disabled");
  }
  const client = ensureClient();
  if (!client) {
    return plainFetch<T>(args, "Nanopayments client unavailable");
  }

  try {
    const result = await client.pay<T>(args.url, {
      method: args.method ?? "POST",
      body: args.body,
      headers: args.headers,
    });
    const r = result as unknown as {
      data?: T;
      amount?: string;
      network?: string;
      transaction?: string;
      paymentResponse?: string;
    };
    return {
      ok: true,
      data: r.data,
      receipt: {
        paid: true,
        amountUsdc: r.amount ?? price,
        network: r.network ?? "arcTestnet",
        txHash: r.transaction ?? null,
        paymentResponseHeader: r.paymentResponse ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[nanopay] pay failed, falling back to direct call:",
      msg.slice(0, 200),
    );
    // Fail open: if the payment flow errors, run the call without a payment
    // so the pipeline keeps producing a synthesized question. The receipt
    // surfaces the error in the note so the UI can show it.
    const fallback = await plainFetch<T>(args, `pay failed: ${msg.slice(0, 80)}`);
    return fallback;
  }
}

async function plainFetch<T>(
  args: PayInferenceArgs,
  note: string,
): Promise<PayInferenceResult<T>> {
  try {
    const res = await fetch(args.url, {
      method: args.method ?? "POST",
      headers: {
        "content-type": "application/json",
        ...(args.headers ?? {}),
      },
      body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      return {
        ok: false,
        error: `Inference call failed (${res.status}): ${text}`,
        receipt: { paid: false, amountUsdc: "0", note },
      };
    }
    const data = (await res.json()) as T;
    return {
      ok: true,
      data,
      receipt: { paid: false, amountUsdc: "0", note },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Plain fetch failed",
      receipt: { paid: false, amountUsdc: "0", note },
    };
  }
}

// One-time funding helper exposed for scripts/fund-agent-eoa.ts.
export async function depositInitialBalance(amountUsdc: string) {
  const client = ensureClient();
  if (!client) throw new Error("AGENT_EOA_PRIVATE_KEY missing");
  return client.deposit(amountUsdc);
}

export async function getUnifiedBalance(): Promise<{
  walletUsdc: string;
  gatewayUsdc: string;
} | null> {
  const client = ensureClient();
  if (!client) return null;
  try {
    const balances = await client.getBalances();
    // The SDK shape is `{ wallet: { formatted }, gateway: { formattedTotal, ... } }`.
    return {
      walletUsdc: String(balances.wallet?.formatted ?? "0"),
      gatewayUsdc: String(balances.gateway?.formattedTotal ?? "0"),
    };
  } catch (e) {
    console.warn(
      "[nanopay] getBalances failed:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export function isNanopaymentsEnabled(): boolean {
  return nanopaymentsEnabled() && ensureClient() !== null;
}
