"use client";

// Babel Markets, hero paste box.
// This is the first 10 seconds of the demo video. Paste a non-English news article,
// watch the agent's stream of steps land on screen, see the synthesized question appear.
// Phase 1 ships the synchronous end-to-end placeholder; Phase 2 swaps in the streaming
// agent and the per-question Nanopayment cost readout.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface IngestResponse {
  ok: boolean;
  question?: {
    question: string;
    resolution_rule: string;
    resolution_source: string;
    expiry: string;
    category: string;
    currency: string;
    suggested_probability: number;
    source_lang: string;
  };
  qualityAverage?: number;
  shouldPost?: boolean;
  rationale?: string;
  error?: string;
}

const SAMPLE_TEXT = `Ijoba apapo ti Naijiria so wipe oun yoo gbero lori ipinnu lati yo idiyele owo epo petirolu sile ki o to di ojo kerinla osu Keje 2026.`;

export function PasteBox() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text }),
      });
      const data = (await res.json()) as IngestResponse;
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            Paste a non-English news article
          </CardTitle>
          <p className="text-muted-foreground">
            The agent translates, judges tradability, synthesizes a binary question with
            a resolution rule, and pins the reasoning trace to IPFS.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an article in Yoruba, Swahili, Spanish, Arabic, French, Portuguese, Mandarin, or any other supported language."
            className="min-h-[180px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={loading || !text.trim()}>
              {loading ? "Synthesizing..." : "Synthesize question"}
            </Button>
            <Button variant="outline" onClick={() => setText(SAMPLE_TEXT)}>
              Try a sample (Yoruba)
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && result.ok && result.question && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">Synthesized question</CardTitle>
              <div className="flex gap-2">
                <Badge variant={result.shouldPost ? "success" : "warning"}>
                  {result.shouldPost ? "post" : "hold"}
                </Badge>
                <Badge variant="outline">
                  quality {(result.qualityAverage ?? 0).toFixed(2)}
                </Badge>
                <Badge variant="outline">{result.question.currency}</Badge>
                <Badge variant="outline">{result.question.source_lang}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-medium">{result.question.question}</p>
            <div className="text-sm">
              <span className="font-semibold">Resolution rule: </span>
              {result.question.resolution_rule}
            </div>
            <div className="text-sm">
              <span className="font-semibold">Source: </span>
              <a
                className="underline"
                href={result.question.resolution_source}
                target="_blank"
                rel="noreferrer"
              >
                {result.question.resolution_source}
              </a>
            </div>
            <div className="text-sm text-muted-foreground">
              Expires {new Date(result.question.expiry).toLocaleDateString()} ,{" "}
              category {result.question.category} , initial prior{" "}
              {(result.question.suggested_probability * 100).toFixed(0)}%
            </div>
            <p className="text-sm italic text-muted-foreground">{result.rationale}</p>
          </CardContent>
        </Card>
      )}

      {result && !result.ok && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {result.error ?? "Synthesis failed."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
