// USYC Teller integration, testnet structural stub.
//
// COMPLIANCE GUARDRAIL: USYC is non-US-only and wallets must be KYC allow-listed.
// Babel demonstrates the integration on testnet only and does NOT park real user
// funds. The README, dashboard tile, and compliance banner all repeat this.
//
// We intentionally do NOT call the real Teller (https://developers.circle.com/
// tokenized/usyc/subscribe-and-redeem) here. This module returns deterministic
// mock receipts and writes a row to the `usyc_events` table so the dashboard
// can render a non-zero float and history.

import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { randomBytes } from "node:crypto";

export interface USYCSubscribeParams {
  amountUsdc: string;
  profileId?: string;
}

export interface USYCReceipt {
  txHash: string;
  amountUsdc: string;
  amountUsyc: string;
  pricePerShare: string;
  action: "subscribe" | "redeem";
}

// Stable demo numbers: 0.20% spread vs USDC, 4.8% APY narrative.
const PRICE_PER_SHARE = "1.002000";
const APY = "4.8%";
const USYC_PER_USDC = 1 / 1.002;

export function getUsycApyLabel(): string {
  return APY;
}

function fakeTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export async function subscribeToUsyc(
  params: USYCSubscribeParams,
): Promise<USYCReceipt> {
  const amount = Number(params.amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amountUsdc must be a positive number");
  }
  const amountUsyc = (amount * USYC_PER_USDC).toFixed(6);
  const receipt: USYCReceipt = {
    txHash: fakeTxHash(),
    amountUsdc: amount.toFixed(6),
    amountUsyc,
    pricePerShare: PRICE_PER_SHARE,
    action: "subscribe",
  };
  await persist(receipt, params.profileId);
  return receipt;
}

export async function redeemUsyc(
  params: USYCSubscribeParams,
): Promise<USYCReceipt> {
  const amount = Number(params.amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amountUsdc must be a positive number");
  }
  const amountUsyc = (amount * USYC_PER_USDC).toFixed(6);
  const receipt: USYCReceipt = {
    txHash: fakeTxHash(),
    amountUsdc: amount.toFixed(6),
    amountUsyc,
    pricePerShare: PRICE_PER_SHARE,
    action: "redeem",
  };
  await persist(receipt, params.profileId);
  return receipt;
}

async function persist(receipt: USYCReceipt, profileId?: string) {
  try {
    const service = getSupabaseServiceClient();
    await service.from("usyc_events").insert({
      profile_id: profileId ?? null,
      action: receipt.action,
      amount_usdc: Number(receipt.amountUsdc),
      amount_usyc: Number(receipt.amountUsyc),
      price_per_share: Number(receipt.pricePerShare),
      tx_hash: receipt.txHash,
    });
  } catch (e) {
    console.warn("[usyc] persist failed:", e instanceof Error ? e.message : e);
  }
}

export interface UsycFloat {
  totalUsdcSubscribed: number;
  totalUsycHeld: number;
  netFloatUsdc: number;
}

export async function getUserUsycFloat(profileId: string): Promise<UsycFloat> {
  const service = getSupabaseServiceClient();
  const { data } = await service
    .from("usyc_events")
    .select("action, amount_usdc, amount_usyc")
    .eq("profile_id", profileId);
  const rows = (data ?? []) as Array<{
    action: string;
    amount_usdc: number | string | null;
    amount_usyc: number | string | null;
  }>;
  let usdcIn = 0;
  let usycHeld = 0;
  for (const r of rows) {
    const u = Number(r.amount_usdc ?? 0);
    const s = Number(r.amount_usyc ?? 0);
    if (r.action === "subscribe") {
      usdcIn += u;
      usycHeld += s;
    } else {
      usdcIn -= u;
      usycHeld -= s;
    }
  }
  return {
    totalUsdcSubscribed: usdcIn,
    totalUsycHeld: usycHeld,
    netFloatUsdc: usycHeld * Number(PRICE_PER_SHARE),
  };
}
