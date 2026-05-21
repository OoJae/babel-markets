// Returns the stored passkey credential for the authed user. Used by the client-side
// web3 init flow to silently re-derive the smart account address without prompting
// the user to enroll again.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wallets")
    .select("passkey_credential, wallet_address")
    .eq("profile_id", user.id)
    .eq("blockchain", "ARC")
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ credential: data ?? [] });
}
