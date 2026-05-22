// Claim accrued USDC from AttributionEscrow. Returns the calldata payload the
// dashboard wallet should sign; the user signs from their Modular Wallet
// because `claim()` pays the caller, not the owner.
//
// When ATTRIBUTION_ESCROW_ADDRESS is not yet set, returns a 409 so the UI can
// show a "deploy escrow first" message instead of crashing.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  isEscrowDeployed,
  claimPayoutCalldata,
  readAccruedBalance,
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
      },
      { status: 409 },
    );
  }

  const service = getSupabaseServiceClient();
  const { data: wallet } = await service
    .from("wallets")
    .select("wallet_address")
    .eq("profile_id", user.id)
    .eq("blockchain", "ARC")
    .limit(1)
    .maybeSingle();
  const walletAddress = (wallet as { wallet_address?: string } | null)?.wallet_address as
    | Address
    | undefined;
  const accrued = walletAddress ? await readAccruedBalance(walletAddress) : "0";

  return NextResponse.json({
    ok: true,
    accrued,
    wallet: walletAddress ?? null,
    calldata: claimPayoutCalldata(),
  });
}
