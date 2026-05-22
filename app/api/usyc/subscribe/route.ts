// USYC subscribe / redeem. Routes through lib/circle/usyc.ts which branches
// between Circle's sandbox REST API (when USYC_API_KEY is set) and the local
// deterministic stub (when it is not).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { subscribeToUsyc, redeemUsyc, getUserUsycFloat } from "@/lib/circle/usyc";
import { isUsycLive } from "@/lib/circle/usyc-client";

export const runtime = "nodejs";

const InputSchema = z.object({
  amountUsdc: z.string().regex(/^\d+(\.\d+)?$/),
  action: z.enum(["subscribe", "redeem"]).default("subscribe"),
});

async function getArcWalletAddress(userId: string): Promise<string | null> {
  const service = getSupabaseServiceClient();
  const { data } = await service
    .from("wallets")
    .select("wallet_address")
    .eq("profile_id", userId)
    .eq("blockchain", "ARC")
    .limit(1)
    .maybeSingle();
  const addr = (data as { wallet_address?: string } | null)?.wallet_address;
  return addr ?? null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
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

  const walletAddress = await getArcWalletAddress(user.id);
  if (isUsycLive() && !walletAddress) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Set up your passkey wallet before subscribing to USYC. The sandbox API needs your Arc wallet address.",
      },
      { status: 409 },
    );
  }

  try {
    const args = {
      amountUsdc: parsed.data.amountUsdc,
      profileId: user.id,
      walletAddress: walletAddress ?? undefined,
    };
    const receipt =
      parsed.data.action === "subscribe"
        ? await subscribeToUsyc(args)
        : await redeemUsyc(args);
    const float = await getUserUsycFloat(user.id, walletAddress);
    return NextResponse.json({
      ok: true,
      receipt,
      float,
      live: isUsycLive(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "usyc action failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }
  const walletAddress = await getArcWalletAddress(user.id);
  const float = await getUserUsycFloat(user.id, walletAddress);
  return NextResponse.json({ ok: true, float, live: isUsycLive() });
}
