// Preview-only post-market endpoint.
//
// Accepts { questionId, side, price, size } and returns the signed Polymarket V2
// order payload (with builder code attached) WITHOUT submitting unless
// POLYMARKET_LIVE_POSTING=1 in the env. This lets the UI render exactly what
// would be submitted, and lets judges inspect the EIP-712 signed struct
// without us holding real USDC on Polygon mainnet.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { postOrder, getBuilderCode, isLiveMode } from "@/lib/polymarket/client";
import { getMarket } from "@/lib/polymarket/gamma";
import { tokenAddressFor, displayLabelFor } from "@/lib/circle/fx";
import { type Currency } from "@/lib/agent/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const InputSchema = z.object({
  questionId: z.string().uuid(),
  side: z.enum(["BUY", "SELL"]),
  // Token outcome to trade. Optional: defaults to the first outcome of the matched market.
  tokenID: z.string().optional(),
  price: z.number().positive().max(1),
  size: z.number().positive(),
});

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

  const service = getSupabaseServiceClient();
  const { data: question, error } = await service
    .from("questions")
    .select("id,polymarket_market_id,currency")
    .eq("id", parsed.data.questionId)
    .single();
  if (error || !question) {
    return NextResponse.json({ ok: false, error: "Question not found" }, { status: 404 });
  }
  if (!(question as any).polymarket_market_id) {
    return NextResponse.json(
      { ok: false, error: "Question has no matched Polymarket market yet" },
      { status: 409 },
    );
  }

  // Resolve a token id (the specific YES or NO leg) from the matched market.
  let tokenID = parsed.data.tokenID;
  if (!tokenID) {
    const market = await getMarket((question as any).polymarket_market_id);
    if (!market || market.clobTokenIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Cannot resolve outcome token from Gamma" },
        { status: 502 },
      );
    }
    tokenID = parsed.data.side === "BUY" ? market.clobTokenIds[0] : market.clobTokenIds[1] ?? market.clobTokenIds[0];
  }

  try {
    const result = await postOrder({
      tokenID,
      price: parsed.data.price,
      size: parsed.data.size,
      side: parsed.data.side,
    });
    const currency = ((question as { currency?: string }).currency ?? "USDC") as Currency;
    return NextResponse.json({
      ok: true,
      submitted: result.submitted,
      builderCode: getBuilderCode() || null,
      liveMode: isLiveMode(),
      preview: result.preview ?? null,
      receipt: result.receipt ?? null,
      // Babel-side settlement preview. Polymarket V2 itself settles in USDC; we
      // surface what Babel would route to if a market is EUR-denominated so the
      // demo shows the FX-aware routing wired end to end.
      settlement: {
        currency: displayLabelFor(currency),
        token: tokenAddressFor(currency),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "post-market failed" },
      { status: 500 },
    );
  }
}
