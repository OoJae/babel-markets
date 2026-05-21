import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: wallets } = await supabase
    .from("wallets")
    .select("wallet_address, blockchain, currency, created_at")
    .eq("profile_id", user.id);

  const { data: attributions } = await supabase
    .from("attributions")
    .select("question_id, accrued_usdc, paid_usdc, last_payout_at")
    .eq("creator_profile_id", user.id);

  const totalAccrued = (attributions ?? []).reduce(
    (s, a) => s + Number(a.accrued_usdc ?? 0),
    0,
  );

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Creator dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Accrued USDC
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              ${totalAccrued.toFixed(4)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Markets created
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              {attributions?.length ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Float in USYC
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-muted-foreground">
              testnet stub
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your wallet</CardTitle>
          </CardHeader>
          <CardContent>
            {wallets && wallets.length > 0 ? (
              <div className="space-y-2 text-sm font-mono">
                {wallets.map((w) => (
                  <div key={w.wallet_address}>
                    {w.wallet_address} ({w.blockchain}, {w.currency})
                  </div>
                ))}
              </div>
            ) : (
              <a href="/dashboard/setup-wallet" className="underline">
                Set up passkey wallet
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
