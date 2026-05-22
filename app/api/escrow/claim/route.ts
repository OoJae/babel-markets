// Claim accrued USDC from AttributionEscrow.
//
// GET  returns the creator's accrued balance, wallet address, username, and the
//      contract calldata so the client can fire a passkey-signed userOp.
// POST records the resulting payout (called from the dashboard after a
//      successful userOp settle).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  isEscrowDeployed,
  claimPayoutCalldata,
  readAccruedBalance,
  getPublicEscrowAddress,
} from "@/lib/chain/escrow";
import type { Address } from "viem";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  if (!isEscrowDeployed()) {
    return NextResponse.json(
      {
        ok: false,
        error: "ATTRIBUTION_ESCROW_ADDRESS not configured. Deploy via scripts/deploy-escrow.ts.",
        escrowAddress: null,
      },
      { status: 409 },
    );
  }

  const service = getSupabaseServiceClient();
  const [{ data: wallet }, { data: profile }] = await Promise.all([
    service
      .from("wallets")
      .select("wallet_address")
      .eq("profile_id", user.id)
      .eq("blockchain", "ARC")
      .limit(1)
      .maybeSingle(),
    service
      .from("profiles")
      .select("name, email")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const walletAddress = (wallet as { wallet_address?: string } | null)?.wallet_address as
    | Address
    | undefined;
  const accrued = walletAddress ? await readAccruedBalance(walletAddress) : "0";
  const username =
    (profile as { name?: string; email?: string } | null)?.name ??
    (profile as { name?: string; email?: string } | null)?.email ??
    user.email ??
    "babel-creator";

  return NextResponse.json({
    ok: true,
    accrued,
    username,
    wallet: walletAddress ?? null,
    escrowAddress: getPublicEscrowAddress(),
    calldata: claimPayoutCalldata(),
  });
}

const PostInputSchema = z.object({
  amountUsdc: z.string().regex(/^\d+(\.\d+)?$/),
  arcTx: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PostInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("payouts")
    .insert({
      creator_profile_id: user.id,
      amount_usdc: Number(parsed.data.amountUsdc),
      currency: "USDC",
      arc_tx: parsed.data.arcTx,
      status: "settled",
      settled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, payoutId: (data as { id?: string } | null)?.id });
}
