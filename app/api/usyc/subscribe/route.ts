// Testnet-only USYC subscribe stub. See lib/circle/usyc.ts for the compliance
// note; no real Teller call is made.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { subscribeToUsyc, redeemUsyc, getUserUsycFloat } from "@/lib/circle/usyc";

export const runtime = "nodejs";

const InputSchema = z.object({
  amountUsdc: z.string().regex(/^\d+(\.\d+)?$/),
  action: z.enum(["subscribe", "redeem"]).default("subscribe"),
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

  try {
    const receipt =
      parsed.data.action === "subscribe"
        ? await subscribeToUsyc({ amountUsdc: parsed.data.amountUsdc, profileId: user.id })
        : await redeemUsyc({ amountUsdc: parsed.data.amountUsdc, profileId: user.id });
    const float = await getUserUsycFloat(user.id);
    return NextResponse.json({ ok: true, receipt, float, testnetStub: true });
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
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const float = await getUserUsycFloat(user.id);
  return NextResponse.json({ ok: true, float, testnetStub: true });
}
