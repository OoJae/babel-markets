// Persists a passkey credential + Circle Modular Smart Account address to Supabase.
// Lifted from arc-p2p-payments and rewired to the Babel `profiles` + `wallets` schema.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function POST(req: NextRequest) {
  try {
    const { credential, circleAddress } = await req.json();
    if (!credential) {
      return NextResponse.json({ error: "Credential is required" }, { status: 400 });
    }
    if (!circleAddress || !/^0x[0-9a-fA-F]{40}$/.test(circleAddress)) {
      return NextResponse.json(
        { error: "Invalid circleAddress" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentialString =
      typeof credential === "string" ? credential : JSON.stringify(credential);
    const walletAddress = circleAddress.toLowerCase();

    // Upsert the Arc wallet for this profile.
    const { data: existing } = await supabase
      .from("wallets")
      .select("id")
      .eq("profile_id", user.id)
      .eq("blockchain", "ARC")
      .limit(1);

    if (existing && existing.length > 0) {
      const { error: updateError } = await supabase
        .from("wallets")
        .update({
          wallet_address: walletAddress,
          passkey_credential: credentialString,
          circle_wallet_id: walletAddress,
        })
        .eq("id", existing[0].id);
      if (updateError) {
        console.error("update wallet error", updateError);
        return NextResponse.json(
          { error: "Could not update wallet" },
          { status: 500 },
        );
      }
    } else {
      const { error: insertError } = await supabase.from("wallets").insert({
        profile_id: user.id,
        wallet_address: walletAddress,
        wallet_type: "modular",
        blockchain: "ARC",
        account_type: "SCA",
        currency: "USDC",
        passkey_credential: credentialString,
        circle_wallet_id: walletAddress,
      });
      if (insertError) {
        console.error("insert wallet error", insertError);
        return NextResponse.json(
          { error: "Could not create wallet" },
          { status: 500 },
        );
      }
    }

    // Mark the user as having a wallet set up.
    await supabase.auth.updateUser({
      data: { wallet_setup_complete: true, wallet_address: walletAddress },
    });

    const response = NextResponse.json(
      { ok: true, walletAddress, redirectUrl: "/dashboard" },
      { status: 201 },
    );
    response.cookies.set("wallet_setup_complete", "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60,
    });
    return response;
  } catch (err) {
    console.error("setup-wallets error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to set up wallet: ${message}` },
      { status: 500 },
    );
  }
}
