import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SweepPanel } from "@/components/sweep-panel";
import { UsycPanel } from "@/components/usyc-panel";
import { getUserUsycFloat } from "@/lib/circle/usyc";
import { readAccruedBalance, isEscrowDeployed } from "@/lib/chain/escrow";
import type { Address } from "viem";

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
    .select("question_id, accrued_usdc, paid_usdc, currency, last_payout_at")
    .eq("creator_profile_id", user.id);

  const totalAccrued = (attributions ?? []).reduce(
    (s, a) => s + Number(a.accrued_usdc ?? 0),
    0,
  );

  const arcWallet = (wallets ?? []).find((w) => w.blockchain === "ARC")?.wallet_address as
    | Address
    | undefined;

  const onchainAccrued =
    isEscrowDeployed() && arcWallet ? await readAccruedBalance(arcWallet) : null;

  const usycFloat = await getUserUsycFloat(user.id);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Creator dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Builder fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SweepPanel accrued={totalAccrued} />
              {onchainAccrued !== null && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Onchain accrued on Arc: ${Number(onchainAccrued).toFixed(4)}
                </p>
              )}
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
            <CardContent>
              <UsycPanel initial={usycFloat} />
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
