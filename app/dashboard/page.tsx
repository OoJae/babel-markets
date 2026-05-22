// Creator dashboard, brand-styled. Same server-component data flow as Phase 6:
// reads wallets / attributions / payouts / escrow_credits / questions from
// Supabase + accrued from AttributionEscrow + USYC float from the stub.
// Only the markup is rewritten in brand selectors.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { Nav } from "@/app/_components/Nav";
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

  const hasAnyData =
    attributions.length > 0 || history.length > 0 || recentQuestions.length > 0;

  return (
    <>
      <Nav linkBase="/" />
      <main className="dash-page">
        <div className="dash-shell">
          <div className="dash-head">
            <div>
              <h1>Creator dashboard</h1>
              <span className="welcome">Welcome back, {username}.</span>
            </div>
            {arcWallet ? (
              <Link
                href={`https://testnet.arcscan.app/address/${arcWallet}`}
                target="_blank"
                rel="noreferrer"
                className="wallet-meta"
                title={arcWallet}
              >
                Wallet {shortAddress(arcWallet)} on Arc testnet
              </Link>
            ) : (
              <Link href="/dashboard/setup-wallet" className="wallet-meta">
                Set up passkey wallet ↗
              </Link>
            )}
          </div>

          {!hasAnyData && (
            <div className="dash-empty">
              <h2>
                No markets yet. <em>Paste your first article.</em>
              </h2>
              <p>
                Head to the paste flow, drop in a non-English article, and the
                synthesized question lands here with a deep link to its market
                view.
              </p>
              <Link href="/app" className="brand-pill">
                Open the paste flow <span>↗</span>
              </Link>
            </div>
          )}

          <div className="dash-grid">
            <div className="dash-card col-8">
              <div className="dash-card-head">
                <span className="dash-card-title">Builder fees</span>
                <span className="dash-card-meta">
                  <span>Lifetime paid: ${totalPaid.toFixed(4)}</span>
                  {onchainAccrued !== null && (
                    <span>Onchain accrued: ${Number(onchainAccrued).toFixed(4)}</span>
                  )}
                </span>
              </div>
              <SweepPanel accrued={totalAccrued} />
              <hr
                style={{
                  border: 0,
                  borderTop: "1px solid rgba(14, 14, 12, 0.15)",
                  margin: "12px 0 4px",
                }}
              />
              <div className="dash-claim-row">
                <div className="copy">
                  <p>Claim to your wallet</p>
                  <p>
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
            </div>

            <div
              className="col-4"
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div className="dash-card">
                <div className="dash-card-head">
                  <span className="dash-card-title">Markets created</span>
                </div>
                <div className="dash-stat">{recentQuestions.length}</div>
                <div className="dash-stat-sub">all-time synthesized</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-head">
                  <span className="dash-card-title">Float in USYC</span>
                </div>
                <UsycPanel initial={usycFloat} />
              </div>
            </div>
          </div>

          <div style={{ height: 24 }} />

          <div className="dash-grid">
            <div className="dash-card col-7">
              <div className="dash-card-head">
                <span className="dash-section-title">Payout history</span>
              </div>
              <PayoutHistory rows={history} />
            </div>
            <div className="dash-card col-5">
              <div className="dash-card-head">
                <span className="dash-section-title">Your recent markets</span>
              </div>
              <RecentQuestions rows={recentQuestions} />
            </div>
          </div>

          {escrowAddress ? (
            <p className="dash-foot-note">
              AttributionEscrow{" "}
              <a
                href={`https://testnet.arcscan.app/address/${escrowAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(escrowAddress)}
              </a>{" "}
              on Arc testnet.
            </p>
          ) : (
            <p className="dash-foot-note">
              <span className="dash-warn">
                AttributionEscrow not deployed yet. Run scripts/deploy-escrow.ts.
              </span>
            </p>
          )}
        </div>
      </main>
    </>
  );
}
