"use client";

// /app paste box, brand-styled. The user types a non-English article into the
// left .agent-input column; on Run, we POST /api/agent/stream and stream the
// pipeline's seven steps into the right .agent-pipe column. The final
// synthesized question renders inside the .ap-result panel with rule, source,
// expiry, currency, prior, matched Polymarket market (if any), total cost, and
// a deep link to the per-market view.
//
// Reuses every brand selector from app/(marketing)/brand.css (.agent-stage,
// .agent-input, .agent-pipe, .ap-step, .ap-result, .ap-meta-grid, plus the
// new .ai-textarea / .ai-samples / .ap-meta-stack / .ap-error additions for
// the /app surface).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface StepEvent {
  step: string;
  output: unknown;
  latencyMs?: number;
  costUsdc?: number;
  nanopayment?: {
    paid: boolean;
    amountUsdc: string;
    txHash?: string | null;
  };
}

interface DoneQuestion {
  question: string;
  resolution_rule: string;
  resolution_source: string;
  expiry: string;
  category: string;
  currency: string;
  suggested_probability: number;
  source_lang: string;
  reject: boolean;
  reject_reason?: string;
}

interface DoneEvent {
  question: DoneQuestion;
  qualityAverage: number;
  shouldPost: boolean;
  rationale: string;
  questionId?: string | null;
  matchedMarket?: {
    id: string;
    question: string;
    url: string;
  } | null;
  matchedSimilarity?: number | null;
  totalCostUsdc: number;
  totalLatencyMs: number;
}

interface Sample {
  label: string;
  text: string;
  code: string;
}

const SAMPLES: Sample[] = [
  {
    label: "Yoruba",
    code: "yo-NG",
    text: `Ijoba apapo ti Naijiria so wipe oun yoo gbero lori ipinnu lati yo idiyele owo epo petirolu sile ki o to di ojo kerinla osu Keje 2026. Aare Bola Tinubu so fun awon onise iroyin ni ile Aso Rock pe ipinnu yi yoo da lori bi inawo ijoba se ri.`,
  },
  {
    label: "Mandarin",
    code: "zh-CN",
    text: `中国人民银行宣布将于2026年6月15日前对存款准备金率进行下调，幅度预计为25个基点。市场普遍预期此举将提振流动性。`,
  },
  {
    label: "Português",
    code: "pt-BR",
    text: `O Banco Central do Brasil sinalizou que a taxa Selic poderá ser cortada em sua próxima reunião de junho, com o IPCA convergindo para a meta de 3%.`,
  },
  {
    label: "Français",
    code: "fr-FR",
    text: `La Banque centrale européenne devrait maintenir ses taux directeurs lors de sa réunion du 5 juin 2026, selon une enquête Reuters auprès de 60 économistes.`,
  },
];

// Same seven UI buckets as the landing AgentDemo. Pipeline emits step names
// like "synthesize:revise" and "map_to_market"; both map back to their primary
// bucket so the row state machine stays seven slots wide.
const STEP_BUCKETS = [
  { k: "detect", label: "Detect language", note: "franc + CLD3 over cleaned input" },
  { k: "translate", label: "Translate", note: "preserve entities . dates . numerals" },
  { k: "assess", label: "Assess tradability", note: "binary . future . verifiable" },
  { k: "synthesize", label: "Synthesize question", note: "with explicit resolution rule" },
  { k: "critique", label: "Self-critique", note: "score against quality rubric" },
  { k: "dedup", label: "Dedup vs corpus", note: "pgvector cosine within threshold" },
  { k: "decide", label: "Decide: post", note: "sign EIP-712 . attach builder code" },
] as const;

function bucketForStep(stepName: string): string | null {
  if (stepName.startsWith("detect")) return "detect";
  if (stepName.startsWith("translate")) return "translate";
  if (stepName.startsWith("assess")) return "assess";
  if (stepName.startsWith("synthesize")) return "synthesize";
  if (stepName.startsWith("critique")) return "critique";
  if (stepName.startsWith("dedup")) return "dedup";
  if (stepName === "decide" || stepName === "map_to_market") return "decide";
  return null;
}

interface DetectedLang {
  lang: string;
  code: string;
}

function readDetectedLang(payload: StepEvent): DetectedLang | null {
  const out = payload.output as Record<string, unknown> | null | undefined;
  if (!out) return null;
  const rawLang = out.detected_language ?? out.source_lang ?? out.lang;
  const rawCode = out.code ?? out.source_lang ?? rawLang;
  if (typeof rawLang !== "string") return null;
  return {
    lang: rawLang,
    code: typeof rawCode === "string" ? rawCode : rawLang,
  };
}

export function BrandPasteBox() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [cost, setCost] = useState(0);
  const [detected, setDetected] = useState<DetectedLang | null>(null);
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function reset() {
    setActiveStep(-1);
    setDoneSteps([]);
    setCost(0);
    setDone(null);
    setError(null);
  }

  function pickSample(s: Sample) {
    setText(s.text);
    setDetected({ lang: s.label, code: s.code });
    reset();
  }

  async function run() {
    if (running) return;
    if (text.trim().length < 20) {
      toast.error("Paste at least 20 characters of source text before running.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    reset();
    setRunning(true);
    setActiveStep(0);

    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceText: text }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let serverReason = "";
        try {
          const data = (await res.clone().json()) as { error?: string };
          if (data?.error) serverReason = data.error;
        } catch {
          serverReason = (await res.text()).slice(0, 200);
        }
        throw new Error(
          serverReason ? `${res.status}: ${serverReason}` : `stream returned ${res.status}`,
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const seen = new Set<string>();

      while (true) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          let eventName = "message";
          let dataLine = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine);

          if (eventName === "step") {
            const ev = payload as StepEvent;
            if (typeof ev.costUsdc === "number") {
              setCost((c) => Number((c + ev.costUsdc!).toFixed(6)));
            }
            const langGuess = readDetectedLang(ev);
            if (langGuess) setDetected(langGuess);
            const bucket = bucketForStep(ev.step ?? "");
            if (bucket && !seen.has(bucket)) {
              seen.add(bucket);
              const idx = STEP_BUCKETS.findIndex((s) => s.k === bucket);
              if (idx >= 0) {
                setDoneSteps((d) => (d.includes(idx) ? d : [...d, idx]));
                setActiveStep(Math.min(idx + 1, STEP_BUCKETS.length - 1));
              }
            }
          } else if (eventName === "done") {
            const d = payload as DoneEvent;
            setDone(d);
            setActiveStep(-1);
            setRunning(false);
            if (d.question?.reject) {
              toast.warning("Question held back: not tradable.");
            } else if (d.shouldPost) {
              toast.success("Question synthesized.", {
                description: d.matchedMarket
                  ? "Matched a live Polymarket market."
                  : "Saved as draft.",
              });
            } else {
              toast("Question synthesized, holding for review.");
            }
          } else if (eventName === "error") {
            throw new Error(payload.error ?? "stream error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const reason = err instanceof Error ? err.message : "stream failed";
      setError(reason);
      toast.error(reason);
      setRunning(false);
      setActiveStep(-1);
    } finally {
      abortRef.current = null;
    }
  }

  const totalCost = done ? done.totalCostUsdc : cost;

  return (
    <div className="agent-stage">
      <div className="agent-input">
        <div className="ai-head">
          <span>Source . Pasted news article</span>
          <span className="ai-lang-pill">
            <span className="d" />{" "}
            {detected ? `${detected.lang} . ${detected.code}` : "language . auto"}
          </span>
        </div>
        <textarea
          className="ai-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (done || error) reset();
          }}
          placeholder="Paste a non-English news article here. The agent reads it, translates while preserving entities, judges tradability, and posts a binary question to Polymarket with your builder code attached."
          disabled={running}
          spellCheck={false}
        />
        <div className="ai-foot">
          <div className="ai-samples">
            <span style={{ opacity: 0.5, alignSelf: "center" }}>Try a sample:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.code}
                type="button"
                className="ai-sample"
                onClick={() => pickSample(s)}
                disabled={running}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ai-btn"
            onClick={run}
            disabled={running || text.trim().length < 20}
          >
            {running ? "Running..." : "Run agent"} <span className="arr">→</span>
          </button>
        </div>
      </div>

      <div className="agent-pipe">
        <div className="ap-head">
          <span>Agent loop . 7 steps . Langfuse</span>
          <span className="ap-cost">${totalCost.toFixed(6)} USDC</span>
        </div>
        <div className="ap-steps">
          {STEP_BUCKETS.map((s, i) => {
            const isActive = activeStep === i;
            const isDone = doneSteps.includes(i);
            const classes = ["ap-step"];
            if (isActive) classes.push("active");
            if (isDone) classes.push("done");
            return (
              <div key={s.k} className={classes.join(" ")}>
                <div className="n">0{i + 1}</div>
                <div className="lbl">
                  <b>{s.label}</b>
                  <span>{s.note}</span>
                </div>
                <div className="stat">{isDone ? "ok" : isActive ? "run" : "idle"}</div>
              </div>
            );
          })}
        </div>

        {done && !done.question.reject && (
          <div className="ap-result show">
            <div className="ap-q-lab">→ Synthesized binary question</div>
            <div className="ap-q">
              {done.question.question.replace(/\?+\s*$/, "")}
              <span className="accent">?</span>
            </div>
            <div className="ap-meta-grid">
              <div>
                <div className="k">Resolution</div>
                <div className="v">{done.question.resolution_source}</div>
              </div>
              <div>
                <div className="k">Expiry</div>
                <div className="v">{done.question.expiry.slice(0, 10)}</div>
              </div>
              <div>
                <div className="k">Currency</div>
                <div className="v">{done.question.currency}</div>
              </div>
              <div>
                <div className="k">P (open)</div>
                <div className="v">
                  {Math.round(done.question.suggested_probability * 100)}¢
                </div>
              </div>
            </div>
            <div className="ap-meta-stack">
              <div className="row">
                <span className="k">Rule</span>
                <span className="v">{done.question.resolution_rule}</span>
              </div>
              <div className="row">
                <span className="k">Quality</span>
                <span className="v">
                  {done.qualityAverage.toFixed(2)} avg . {done.shouldPost ? "post" : "hold"}
                </span>
              </div>
              {done.matchedMarket && (
                <div className="row">
                  <span className="k">Polymarket</span>
                  <span className="v">
                    <a href={done.matchedMarket.url} target="_blank" rel="noreferrer">
                      {done.matchedMarket.question}
                    </a>
                    {typeof done.matchedSimilarity === "number" && (
                      <>
                        {" "}
                        <span style={{ opacity: 0.6 }}>
                          ({Math.round(done.matchedSimilarity * 100)}% match)
                        </span>
                      </>
                    )}
                  </span>
                </div>
              )}
              {done.questionId && (
                <div className="row">
                  <span className="k">Market</span>
                  <span className="v">
                    <a href={`/market/${done.questionId}`}>
                      /market/{done.questionId.slice(0, 8)}
                    </a>
                  </span>
                </div>
              )}
              <div className="row">
                <span className="k">Rationale</span>
                <span className="v" style={{ fontStyle: "italic", opacity: 0.85 }}>
                  {done.rationale}
                </span>
              </div>
            </div>
          </div>
        )}

        {done && done.question.reject && (
          <div className="ap-error">
            Held back: not tradable. {done.question.reject_reason ?? done.rationale}
          </div>
        )}

        {error && !done && <div className="ap-error">{error}</div>}
      </div>
    </div>
  );
}
