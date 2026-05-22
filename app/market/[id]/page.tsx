// Single market view page. Pulls the questions row + matched Gamma market and
// renders the question, resolution rule, status timeline, source link, live
// metrics, quality bars, IPFS provenance trace, and the deep link to trade on
// Polymarket. Polymarket's web app remains the canonical trading venue.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getMarket } from "@/lib/polymarket/gamma";
import { displayLabelFor, explorerTokenUrl } from "@/lib/circle/fx";
import { type Currency } from "@/lib/agent/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBanner } from "@/components/compliance-banner";
import { TraceExpander } from "@/components/trace-expander";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface QuestionRow {
  id: string;
  question_text: string;
  resolution_rule: string;
  resolution_source: string;
  expiry: string;
  category: string;
  currency: string;
  suggested_probability: number | null;
  source_lang: string | null;
  quality_score: number | null;
  status: string;
  polymarket_market_id: string | null;
  ipfs_cid: string | null;
  profile_id: string | null;
  created_at: string;
  posted_at: string | null;
  resolved_at: string | null;
}

interface CritiqueScore {
  resolvability: number;
  source_quality: number;
  timeliness: number;
  faithfulness: number;
  translation_fidelity: number;
}

type Stage = "synthesized" | "matched" | "live" | "resolved";

interface TimelineStep {
  key: Stage;
  label: string;
  state: "done" | "active" | "future";
}

function buildTimeline(q: QuestionRow): TimelineStep[] {
  const synthesized: TimelineStep = {
    key: "synthesized",
    label: "Synthesized",
    state: "done",
  };
  const matched: TimelineStep = {
    key: "matched",
    label: "Matched to Polymarket",
    state: q.polymarket_market_id ? "done" : "future",
  };
  const live: TimelineStep = {
    key: "live",
    label: "Live for trading",
    state: q.status === "live" || q.posted_at ? "done" : "future",
  };
  const resolved: TimelineStep = {
    key: "resolved",
    label: "Resolved",
    state: q.resolved_at ? "done" : "future",
  };
  // Mark the next non-done step as active.
  const steps = [synthesized, matched, live, resolved];
  const firstFuture = steps.findIndex((s) => s.state === "future");
  if (firstFuture > 0) steps[firstFuture].state = "active";
  return steps;
}

function StageDot({ state }: { state: TimelineStep["state"] }) {
  const base = "h-3 w-3 rounded-full";
  if (state === "done") return <span className={`${base} bg-green-600`} />;
  if (state === "active")
    return <span className={`${base} animate-pulse bg-yellow-500`} />;
  return <span className={`${base} bg-muted`} />;
}

function ipfsGatewayUrl(cid: string): string {
  return `https://gateway.irys.xyz/${cid}`;
}

function formatLargeNumber(n?: number): string | null {
  if (n === undefined || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function QualityBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function MarketPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getSupabaseServiceClient();

  const { data: question, error } = await supabase
    .from("questions")
    .select(
      "id,question_text,resolution_rule,resolution_source,expiry,category,currency,suggested_probability,source_lang,quality_score,status,polymarket_market_id,ipfs_cid,profile_id,created_at,posted_at,resolved_at",
    )
    .eq("id", id)
    .single();

  if (error || !question) notFound();
  const q = question as QuestionRow;

  let polymarket = null as Awaited<ReturnType<typeof getMarket>>;
  if (q.polymarket_market_id) {
    try {
      polymarket = await getMarket(q.polymarket_market_id);
    } catch {
      polymarket = null;
    }
  }

  // Pull the latest critique trace so we can render per-axis quality bars when
  // available. The pipeline writes one row per step, keyed by submission_id.
  let critique: CritiqueScore | null = null;
  try {
    const { data: traceRow } = await supabase
      .from("traces")
      .select("output")
      .eq("question_id", q.id)
      .in("step", ["critique", "critique:revise"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const output = (traceRow as { output?: Record<string, unknown> } | null)?.output;
    if (output && typeof output === "object") {
      const o = output as Record<string, number | undefined>;
      if (
        typeof o.resolvability === "number" &&
        typeof o.source_quality === "number" &&
        typeof o.timeliness === "number" &&
        typeof o.faithfulness === "number" &&
        typeof o.translation_fidelity === "number"
      ) {
        critique = {
          resolvability: o.resolvability,
          source_quality: o.source_quality,
          timeliness: o.timeliness,
          faithfulness: o.faithfulness,
          translation_fidelity: o.translation_fidelity,
        };
      }
    }
  } catch {
    // Best effort; absent critique just hides the bar chart.
  }

  // Identify the signed-in viewer so we can tag "Synthesized by you" if they
  // own the question. Anonymous viewers (no auth cookie) skip this.
  let isCreator = false;
  try {
    const userClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (user && q.profile_id && user.id === q.profile_id) {
      isCreator = true;
    }
  } catch {
    // Auth is optional on this page.
  }

  const timeline = buildTimeline(q);
  const currency = ((q.currency as Currency) ?? "USDC") as Currency;
  const liveMetrics = [
    { label: "Volume", value: formatLargeNumber(polymarket?.volume) },
    { label: "Liquidity", value: formatLargeNumber(polymarket?.liquidity) },
    {
      label: "Best bid",
      value:
        polymarket?.bestBid !== undefined ? polymarket.bestBid.toFixed(3) : null,
    },
    {
      label: "Best ask",
      value:
        polymarket?.bestAsk !== undefined ? polymarket.bestAsk.toFixed(3) : null,
    },
  ];

  return (
    <main className="min-h-screen">
      <ComplianceBanner />
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-mono text-lg font-bold">
            babel/markets
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-4 py-10">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="flex flex-wrap gap-2">
              <Badge variant={q.status === "ready" ? "success" : "warning"}>
                {q.status}
              </Badge>
              <a
                href={explorerTokenUrl(currency)}
                target="_blank"
                rel="noreferrer"
                title={`${displayLabelFor(currency)} on Arc testnet`}
              >
                <Badge variant="outline">
                  Pays in {displayLabelFor(currency)}
                </Badge>
              </a>
              <Badge variant="outline">{q.category}</Badge>
              {q.source_lang && <Badge variant="outline">{q.source_lang}</Badge>}
              {q.quality_score !== null && (
                <Badge variant="outline">
                  quality {Number(q.quality_score).toFixed(2)}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              {q.question_text}
            </h1>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-wrap items-center gap-4">
                  {timeline.map((step, idx) => (
                    <li key={step.key} className="flex items-center gap-2">
                      <StageDot state={step.state} />
                      <span
                        className={
                          step.state === "future"
                            ? "text-sm text-muted-foreground"
                            : "text-sm"
                        }
                      >
                        {step.label}
                      </span>
                      {idx < timeline.length - 1 && (
                        <span className="text-muted-foreground">/</span>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Resolution rule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{q.resolution_rule}</p>
                <div className="mt-4 text-sm">
                  <span className="font-semibold">Source: </span>
                  <a
                    className="underline"
                    href={q.resolution_source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {q.resolution_source}
                  </a>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Expires {new Date(q.expiry).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Provenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {q.ipfs_cid ? (
                  <TraceExpander cid={q.ipfs_cid} />
                ) : (
                  <p className="text-muted-foreground">
                    Reasoning trace is being pinned to IPFS. Refresh in a moment to
                    see the CID.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Question synthesized {new Date(q.created_at).toLocaleString()}.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Trade on Polymarket
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {polymarket ? (
                  <>
                    <p className="text-sm font-medium">{polymarket.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Outcomes: {polymarket.outcomes.join(", ")}
                    </p>
                    <Button asChild className="w-full">
                      <a href={polymarket.url} target="_blank" rel="noreferrer">
                        Trade on Polymarket
                      </a>
                    </Button>
                  </>
                ) : q.polymarket_market_id ? (
                  <p className="text-sm text-muted-foreground">
                    Market id {q.polymarket_market_id} is set on this question but
                    Gamma metadata could not be fetched. Try refreshing.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active Polymarket market matched yet. The question is saved
                    as a draft and can be promoted once Polymarket builder-API
                    access is approved.
                  </p>
                )}
              </CardContent>
            </Card>

            {polymarket && liveMetrics.some((m) => m.value !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">
                    Live numbers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {liveMetrics.map((m) => (
                      <div key={m.label}>
                        <dt className="text-xs text-muted-foreground">{m.label}</dt>
                        <dd className="font-mono">{m.value ?? "-"}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Quality
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {critique ? (
                  <div className="space-y-2">
                    <QualityBar label="Resolvability" value={critique.resolvability} />
                    <QualityBar label="Source quality" value={critique.source_quality} />
                    <QualityBar label="Timeliness" value={critique.timeliness} />
                    <QualityBar label="Faithfulness" value={critique.faithfulness} />
                    <QualityBar
                      label="Translation"
                      value={critique.translation_fidelity}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Average {q.quality_score !== null ? Number(q.quality_score).toFixed(2) : "-"}.
                    Per-axis breakdown lands once the critique trace finishes.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {isCreator ? (
                  <>
                    <p>Synthesized by you.</p>
                    <Link href="/dashboard" className="text-xs underline">
                      Open creator dashboard
                    </Link>
                  </>
                ) : q.profile_id ? (
                  <p className="text-muted-foreground">
                    Synthesized by a Babel creator. Builder profile pages land in
                    a future phase.
                  </p>
                ) : (
                  <p className="text-muted-foreground">Anonymous submission.</p>
                )}
                {q.ipfs_cid && (
                  <p className="text-xs text-muted-foreground">
                    <a
                      className="underline"
                      href={ipfsGatewayUrl(q.ipfs_cid)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View raw trace on IPFS
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
