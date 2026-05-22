// USYC Teller integration.
//
// COMPLIANCE GUARDRAIL: USYC is non-US-only and wallets must be KYC allow-listed.
// Babel demonstrates the integration on testnet only and does NOT park real user
// funds. The README, dashboard tile, and compliance banner all repeat this.
//
// Two execution paths, gated by USYC_API_KEY in env:
//   - sandbox live: call Circle's USYC sandbox REST API via usyc-client.ts.
//     Activated when USYC_API_KEY is set (Joseph receives this from the
//     Circle Hackathon Access Form).
//   - stub: deterministic mock receipts so the dashboard tile + history
//     table render meaningful numbers even before sandbox credentials
//     arrive. Same persistence path; the only difference is that txHash is
//     a fake hex string and the price-per-share is hardcoded.

import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { randomBytes } from "node:crypto";
import {
  isUsycLive,
  usycBalanceLive,
  usycRedeemLive,
  usycSubscribeLive,
} from "@/lib/circle/usyc-client";

export interface USYCSubscribeParams {
  amountUsdc: string;
  profileId?: string;
  walletAddress?: string;
}

export interface USYCReceipt {
  txHash: string;
  amountUsdc: string;
  amountUsyc: string;
  pricePerShare: string;
  action: "subscribe" | "redeem";
}

// Stable demo numbers for the stub path: 0.20% spread vs USDC, 4.8% APY narrative.
const STUB_PRICE_PER_SHARE = "1.002000";
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

  let receipt: USYCReceipt;
  if (isUsycLive()) {
    if (!params.walletAddress) {
      throw new Error(
        "USYC sandbox mode requires a wallet address. Set up your passkey wallet first.",
      );
    }
    const live = await usycSubscribeLive({
      amountUsdc: amount.toFixed(6),
      walletAddress: params.walletAddress,
    });
    receipt = {
      txHash: live.txHash || fakeTxHash(),
      amountUsdc: amount.toFixed(6),
      amountUsyc: Number(live.sharesIssued || 0).toFixed(6),
      pricePerShare: live.pricePerShare || STUB_PRICE_PER_SHARE,
      action: "subscribe",
    };
  } else {
    const amountUsyc = (amount * USYC_PER_USDC).toFixed(6);
    receipt = {
      txHash: fakeTxHash(),
      amountUsdc: amount.toFixed(6),
      amountUsyc,
      pricePerShare: STUB_PRICE_PER_SHARE,
      action: "subscribe",
    };
  }
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

  let receipt: USYCReceipt;
  if (isUsycLive()) {
    if (!params.walletAddress) {
      throw new Error(
        "USYC sandbox mode requires a wallet address. Set up your passkey wallet first.",
      );
    }
    const live = await usycRedeemLive({
      amountUsdc: amount.toFixed(6),
      walletAddress: params.walletAddress,
    });
    receipt = {
      txHash: live.txHash || fakeTxHash(),
      amountUsdc: amount.toFixed(6),
      amountUsyc: Number(live.sharesIssued || 0).toFixed(6),
      pricePerShare: live.pricePerShare || STUB_PRICE_PER_SHARE,
      action: "redeem",
    };
  } else {
    const amountUsyc = (amount * USYC_PER_USDC).toFixed(6);
    receipt = {
      txHash: fakeTxHash(),
      amountUsdc: amount.toFixed(6),
      amountUsyc,
      pricePerShare: STUB_PRICE_PER_SHARE,
      action: "redeem",
    };
  }
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

export async function getUserUsycFloat(
  profileId: string,
  walletAddress?: string | null,
): Promise<UsycFloat> {
  // Walk the local event log first; this is the authoritative subscribe /
  // redeem history Babel keeps regardless of which path executed.
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

  let pricePerShare = Number(STUB_PRICE_PER_SHARE);

  // In sandbox-live mode, reconcile shares + price-per-share against Circle's
  // canonical balance endpoint when a wallet address is known. The event log
  // remains the source of truth for usdcIn (subscribe minus redeem); shares
  // come from the API; netFloatUsdc uses the API price.
  if (isUsycLive() && walletAddress) {
    try {
      const live = await usycBalanceLive(walletAddress);
      const apiShares = Number(live.shares ?? 0);
      const apiPps = Number(live.pricePerShare ?? STUB_PRICE_PER_SHARE);
      if (Number.isFinite(apiShares)) usycHeld = apiShares;
      if (Number.isFinite(apiPps) && apiPps > 0) pricePerShare = apiPps;
    } catch (e) {
      console.warn(
        "[usyc] balance fetch failed, falling back to event log:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  return {
    totalUsdcSubscribed: usdcIn,
    totalUsycHeld: usycHeld,
    netFloatUsdc: usycHeld * pricePerShare,
  };
}
