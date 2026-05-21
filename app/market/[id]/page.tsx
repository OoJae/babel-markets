// Single market view page. Pulls the questions row + matched Gamma market and
// renders the question, resolution rule, source link, IPFS provenance CID, and
// a deep link to trade on Polymarket. We do not host an order book ourselves;
// Polymarket's web app remains the canonical trading venue.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { getMarket } from "@/lib/polymarket/gamma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBanner } from "@/components/compliance-banner";

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
  created_at: string;
}

function ipfsGatewayUrl(cid: string): string {
  // Irys returns Arweave-style tx ids that also resolve through the Arweave
  // gateway; for CID-style values we use the public IPFS gateway. The link
  // works for both shapes for the demo.
  return `https://gateway.irys.xyz/${cid}`;
}

export default async function MarketPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getSupabaseServiceClient();

  const { data: question, error } = await supabase
    .from("questions")
    .select(
      "id,question_text,resolution_rule,resolution_source,expiry,category,currency,suggested_probability,source_lang,quality_score,status,polymarket_market_id,ipfs_cid,created_at",
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
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant={q.status === "ready" ? "success" : "warning"}>
              {q.status}
            </Badge>
            <Badge variant="outline">{q.currency}</Badge>
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
                Trade on Polymarket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {polymarket ? (
                <>
                  <div className="text-sm">
                    Matched Polymarket question:{" "}
                    <span className="font-medium">{polymarket.question}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Outcomes: {polymarket.outcomes.join(", ")}
                  </div>
                  <Button asChild>
                    <a href={polymarket.url} target="_blank" rel="noreferrer">
                      Trade on Polymarket
                    </a>
                  </Button>
                </>
              ) : q.polymarket_market_id ? (
                <p className="text-sm text-muted-foreground">
                  Market id {q.polymarket_market_id} is set on this question but the
                  live Gamma metadata could not be fetched. Try refreshing.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active Polymarket market matched this synthesized question. The
                  question is saved as a draft and can be promoted to a new market
                  once Polymarket builder-API access is approved.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Provenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {q.ipfs_cid ? (
                <p>
                  Full reasoning trace pinned to IPFS:{" "}
                  <a
                    className="underline"
                    href={ipfsGatewayUrl(q.ipfs_cid)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {q.ipfs_cid}
                  </a>
                </p>
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
      </section>
    </main>
  );
}
