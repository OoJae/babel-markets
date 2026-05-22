// Single market view. Same data flow as Phase 6: pulls the questions row +
// matched Gamma market + latest critique trace + isCreator check. Brand
// markup throughout. Nothing in the data layer changes.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getMarket } from "@/lib/polymarket/gamma";
import { displayLabelFor, explorerTokenUrl } from "@/lib/circle/fx";
import { type Currency } from "@/lib/agent/schema";
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
  const synthesized: TimelineStep = { key: "synthesized", label: "Synthesized", state: "done" };
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
  const steps = [synthesized, matched, live, resolved];
  const firstFuture = steps.findIndex((s) => s.state === "future");
  if (firstFuture > 0) steps[firstFuture].state = "active";
  return steps;
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
    <div className="market-bar">
      <div className="row">
        <span>{label}</span>
        <span className="v">{value.toFixed(2)}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
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
    // Critique missing just hides the per-axis bars.
  }

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
    // Auth optional here.
  }

  const timeline = buildTimeline(q);
  const currency = ((q.currency as Currency) ?? "USDC") as Currency;
  const liveMetrics = [
    { label: "Volume", value: formatLargeNumber(polymarket?.volume) },
    { label: "Liquidity", value: formatLargeNumber(polymarket?.liquidity) },
    {
      label: "Best bid",
      value: polymarket?.bestBid !== undefined ? polymarket.bestBid.toFixed(3) : null,
    },
    {
      label: "Best ask",
      value: polymarket?.bestAsk !== undefined ? polymarket.bestAsk.toFixed(3) : null,
    },
  ];

  return (
    <>
      <ComplianceBanner />
      <nav className="market-mini-nav">
        <Link href="/" className="mark">
          babel/markets
        </Link>
        <div className="links">
          <Link href="/app">Open Babel ↗</Link>
          <Link href="/dashboard">Dashboard ↗</Link>
        </div>
      </nav>
      <main className="market-page">
        <div className="market-shell">
          <div className="market-chiprow">
            <span className={`brand-chip ${q.status === "ready" ? "ready" : "warn"}`}>
              {q.status}
            </span>
            <a
              href={explorerTokenUrl(currency)}
              target="_blank"
              rel="noreferrer"
              title={`${displayLabelFor(currency)} on Arc testnet`}
              style={{ textDecoration: "none" }}
            >
              <span className="brand-chip">Pays in {displayLabelFor(currency)}</span>
            </a>
            <span className="brand-chip">{q.category}</span>
            {q.source_lang && <span className="brand-chip">{q.source_lang}</span>}
            {q.quality_score !== null && (
              <span className="brand-chip">
                quality {Number(q.quality_score).toFixed(2)}
              </span>
            )}
          </div>

          <h1 className="market-h1">{q.question_text}</h1>

          <div className="market-grid">
            <div>
              <div className="market-card">
                <div className="lbl">Status</div>
                <div className="market-status-bar">
                  {timeline.map((step, idx) => (
                    <span key={step.key} style={{ display: "inline-flex", alignItems: "center" }}>
                      <span className={`market-status-step ${step.state}`}>
                        <span className="dot" />
                        <span>{step.label}</span>
                      </span>
                      {idx < timeline.length - 1 && <span className="market-status-sep" />}
                    </span>
                  ))}
                </div>
              </div>

              <div className="market-card">
                <div className="lbl">Resolution rule</div>
                <p className="market-rule">{q.resolution_rule}</p>
                <div className="market-source">
                  <strong>Source: </strong>
                  <a href={q.resolution_source} target="_blank" rel="noreferrer">
                    {q.resolution_source}
                  </a>
                </div>
                <div className="market-expiry">
                  Expires {new Date(q.expiry).toLocaleString()}
                </div>
              </div>

              <div className="market-card">
                <div className="lbl">Provenance</div>
                {q.ipfs_cid ? (
                  <TraceExpander cid={q.ipfs_cid} />
                ) : (
                  <p
                    style={{
                      fontFamily: "var(--f-mono)",
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    Reasoning trace is being pinned to IPFS. Refresh in a moment to
                    see the CID.
                  </p>
                )}
                <p
                  style={{
                    fontFamily: "var(--f-mono)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginTop: 16,
                  }}
                >
                  Question synthesized {new Date(q.created_at).toLocaleString()}.
                </p>
              </div>
            </div>

            <div>
              <div className="market-card">
                <div className="lbl">Trade on Polymarket</div>
                {polymarket ? (
                  <>
                    <p style={{ fontFamily: "var(--f-serif)", fontSize: 16, lineHeight: 1.5 }}>
                      {polymarket.question}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--f-mono)",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        opacity: 0.6,
                        marginTop: 8,
                      }}
                    >
                      Outcomes: {polymarket.outcomes.join(", ")}
                    </p>
                    <a
                      href={polymarket.url}
                      target="_blank"
                      rel="noreferrer"
                      className="brand-pill"
                      style={{ marginTop: 16 }}
                    >
                      Trade on Polymarket <span>↗</span>
                    </a>
                  </>
                ) : q.polymarket_market_id ? (
                  <p style={{ fontFamily: "var(--f-mono)", fontSize: 12, opacity: 0.7 }}>
                    Market id {q.polymarket_market_id} is set but Gamma metadata could
                    not be fetched. Try refreshing.
                  </p>
                ) : (
                  <p style={{ fontFamily: "var(--f-mono)", fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                    No active Polymarket market matched yet. The question is saved
                    as a draft and can be promoted once Polymarket builder-API
                    access is approved.
                  </p>
                )}
              </div>

              {polymarket && liveMetrics.some((m) => m.value !== null) && (
                <div className="market-card">
                  <div className="lbl">Live numbers</div>
                  <div className="market-numbers">
                    {liveMetrics.map((m) => (
                      <div key={m.label}>
                        <div className="k">{m.label}</div>
                        <div className="v">{m.value ?? "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="market-card">
                <div className="lbl">Quality</div>
                {critique ? (
                  <div>
                    <QualityBar label="Resolvability" value={critique.resolvability} />
                    <QualityBar label="Source quality" value={critique.source_quality} />
                    <QualityBar label="Timeliness" value={critique.timeliness} />
                    <QualityBar label="Faithfulness" value={critique.faithfulness} />
                    <QualityBar label="Translation" value={critique.translation_fidelity} />
                  </div>
                ) : (
                  <p style={{ fontFamily: "var(--f-mono)", fontSize: 12, opacity: 0.7 }}>
                    Average{" "}
                    {q.quality_score !== null
                      ? Number(q.quality_score).toFixed(2)
                      : "-"}
                    . Per-axis breakdown lands once the critique trace finishes.
                  </p>
                )}
              </div>

              <div className="market-card market-builder">
                <div className="lbl">Builder</div>
                {isCreator ? (
                  <>
                    <p>Synthesized by you.</p>
                    <Link href="/dashboard">Open creator dashboard ↗</Link>
                  </>
                ) : q.profile_id ? (
                  <p style={{ opacity: 0.75 }}>
                    Synthesized by a Babel creator. Builder profile pages land in a
                    future phase.
                  </p>
                ) : (
                  <p style={{ opacity: 0.75 }}>Anonymous submission.</p>
                )}
                {q.ipfs_cid && (
                  <p style={{ marginTop: 10 }}>
                    <a href={ipfsGatewayUrl(q.ipfs_cid)} target="_blank" rel="noreferrer">
                      View raw trace on IPFS ↗
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
