import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SweepPanel } from "@/components/sweep-panel";
import { UsycPanel } from "@/components/usyc-panel";
import { ClaimButton } from "@/components/claim-button";
import {
  PayoutHistory,
  type CreditRow,
  type PayoutRow,
  type HistoryRow,
} from "@/components/payout-history";
import {
  RecentQuestions,
  type RecentQuestion,
} from "@/components/recent-questions";
import { getUserUsycFloat } from "@/lib/circle/usyc";
import {
  readAccruedBalance,
  isEscrowDeployed,
  getPublicEscrowAddress,
} from "@/lib/chain/escrow";
import type { Address } from "viem";

function shortAddress(addr?: string | null): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    { data: walletsRaw },
    { data: attributionsRaw },
    { data: profileRaw },
    { data: payoutsRaw },
    { data: creditsRaw },
    { data: questionsRaw },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("wallet_address, blockchain, currency, created_at")
      .eq("profile_id", user.id),
    supabase
      .from("attributions")
      .select("question_id, accrued_usdc, paid_usdc, currency, last_payout_at")
      .eq("creator_profile_id", user.id),
    supabase.from("profiles").select("name, email").eq("id", user.id).maybeSingle(),
    supabase
      .from("payouts")
      .select("id, amount_usdc, arc_tx, currency, status, created_at, settled_at")
      .eq("creator_profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("escrow_credits")
      .select("id, amount_usdc, arc_tx, created_at, question_id, questions(question_text)")
      .eq("creator_profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("questions")
      .select(
        "id, question_text, status, source_lang, currency, category, created_at",
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const wallets = walletsRaw ?? [];
  const attributions = attributionsRaw ?? [];
  const profile = profileRaw as { name?: string; email?: string } | null;

  const totalAccrued = attributions.reduce(
    (s, a) => s + Number((a as { accrued_usdc?: number | string }).accrued_usdc ?? 0),
    0,
  );
  const totalPaid = (payoutsRaw ?? []).reduce(
    (s, p) =>
      (p as { status?: string }).status === "settled"
        ? s + Number((p as { amount_usdc?: number | string }).amount_usdc ?? 0)
        : s,
    0,
  );

  const arcWallet = wallets.find(
    (w) => (w as { blockchain?: string }).blockchain === "ARC",
  )?.wallet_address as Address | undefined;

  const onchainAccrued =
    isEscrowDeployed() && arcWallet ? await readAccruedBalance(arcWallet) : null;
  const escrowAddress = getPublicEscrowAddress();
  const username =
    profile?.name ?? profile?.email ?? user.email ?? `babel-${user.id.slice(0, 8)}`;

  const usycFloat = await getUserUsycFloat(user.id);

  const credits: CreditRow[] = (creditsRaw ?? []).map((c) => {
    const row = c as {
      id: string;
      amount_usdc: number | string;
      arc_tx: string;
      created_at: string;
      questions: { question_text?: string } | null;
    };
    return {
      kind: "credit",
      id: row.id,
      question_text: row.questions?.question_text ?? null,
      amount_usdc: Number(row.amount_usdc ?? 0),
      arc_tx: row.arc_tx,
      created_at: row.created_at,
    };
  });
  const payouts: PayoutRow[] = (payoutsRaw ?? []).map((p) => {
    const row = p as {
      id: string;
      amount_usdc: number | string;
      arc_tx: string | null;
      currency: string;
      status: string;
      created_at: string;
      settled_at: string | null;
    };
    return {
      kind: "claim",
      id: row.id,
      amount_usdc: Number(row.amount_usdc ?? 0),
      arc_tx: row.arc_tx,
      currency: row.currency,
      status: row.status,
      created_at: row.created_at,
      settled_at: row.settled_at,
    };
  });
  const history: HistoryRow[] = [...credits, ...payouts].sort((a, b) => {
    const at = a.kind === "claim" ? a.settled_at ?? a.created_at : a.created_at;
    const bt = b.kind === "claim" ? b.settled_at ?? b.created_at : b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  const accruedByQuestion = new Map<string, number>();
  for (const a of attributions) {
    const row = a as { question_id?: string; accrued_usdc?: number | string };
    if (row.question_id) {
      accruedByQuestion.set(row.question_id, Number(row.accrued_usdc ?? 0));
    }
  }
  const recentQuestions: RecentQuestion[] = (questionsRaw ?? []).map((q) => {
    const row = q as {
      id: string;
      question_text: string;
      status: string;
      source_lang: string | null;
      currency: string;
      category: string;
      created_at: string;
    };
    return {
      id: row.id,
      question_text: row.question_text,
      status: row.status,
      source_lang: row.source_lang,
      currency: row.currency,
      category: row.category,
      created_at: row.created_at,
      accrued_usdc: accruedByQuestion.get(row.id) ?? 0,
    };
  });

  const hasAnyData = attributions.length > 0 || history.length > 0 || recentQuestions.length > 0;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Creator dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {username}.
            </p>
          </div>
          {arcWallet ? (
            <Link
              href={`https://testnet.arcscan.app/address/${arcWallet}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-muted-foreground hover:underline"
              title={arcWallet}
            >
              Wallet {shortAddress(arcWallet)} on Arc testnet
            </Link>
          ) : (
            <Link href="/dashboard/setup-wallet" className="text-sm underline">
              Set up passkey wallet
            </Link>
          )}
        </div>

        {!hasAnyData && (
          <Card>
            <CardContent className="space-y-3 py-6">
              <p className="text-base">
                No markets yet. Paste your first non-English article on the home
                page and the question lands here with a deep link to its market
                view.
              </p>
              <Link href="/" className="inline-block underline">
                Go to the paste box
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-base text-muted-foreground">
                  Builder fees
                </CardTitle>
                <div className="flex flex-wrap items-baseline gap-3 text-xs text-muted-foreground">
                  <span>Lifetime paid: ${totalPaid.toFixed(4)}</span>
                  {onchainAccrued !== null && (
                    <span>
                      Onchain accrued: ${Number(onchainAccrued).toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SweepPanel accrued={totalAccrued} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium">Claim to your wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Passkey-signed userOp via Circle bundler with paymaster
                    sponsorship. You pay zero gas.
                  </p>
                </div>
                <ClaimButton
                  escrowAddress={escrowAddress}
                  accruedUsdc={onchainAccrued ?? "0"}
                  username={username}
                  walletAddress={arcWallet ?? null}
                />
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Markets created
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {recentQuestions.length}
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
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Payout history</CardTitle>
            </CardHeader>
            <CardContent>
              <PayoutHistory rows={history} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Your recent markets</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentQuestions rows={recentQuestions} />
            </CardContent>
          </Card>
        </div>

        {escrowAddress && (
          <p className="text-xs text-muted-foreground">
            AttributionEscrow{" "}
            <a
              href={`https://testnet.arcscan.app/address/${escrowAddress}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline"
            >
              {shortAddress(escrowAddress)}
            </a>{" "}
            on Arc testnet.
          </p>
        )}
        {!escrowAddress && (
          <Badge variant="warning">
            AttributionEscrow not deployed yet. Run scripts/deploy-escrow.ts.
          </Badge>
        )}
      </div>
    </main>
  );
}
