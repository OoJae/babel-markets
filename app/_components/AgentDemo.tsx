"use client";

// Live Agent Demo. User picks a sample non-English article, watches the 7
// pipeline steps stream, sees the final synthesized question with its
// resolution rule, expiry, currency, and prior probability.
//
// Two modes, switched by NEXT_PUBLIC_USE_LIVE_AGENT (default "1"):
//   - live:  POST /api/agent/stream with sample.source, parse SSE events,
//            render real outputs.
//   - mock:  simulated 7-step run with timers; uses the canned SAMPLES result.
// On any stream error in live mode, falls back to the mock path so the demo
// always finishes.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Sample {
  lang: string;
  code: string;
  flag: string;
  source: string;
  translation: string;
  question: string;
  rule: string;
  source_url: string;
  expiry: string;
  category: string;
  currency: "USDC" | "EURC";
  p: number;
}

const SAMPLES: Sample[] = [
  {
    lang: "Yoruba",
    code: "yo-NG",
    flag: "NG",
    source:
      "Ijoba Naijiria sọ pe oun yoo yọ owo iranlọwọ epo petirolu kuro ṣaaju ọjọ 31 oṣu keje 2026. Aare Tinubu ti fọwọsi eto naa pẹlu igbimọ minisita.",
    translation:
      "The Nigerian government has stated that it will remove the petrol subsidy before 31 July 2026. President Tinubu has approved the plan with the cabinet.",
    question:
      "Will the Nigerian government remove the petrol subsidy before 31 July 2026?",
    rule: "YES if a Federal Gazette publishes formal removal on/before 2026-07-31. NO otherwise.",
    source_url: "gazette.gov.ng",
    expiry: "2026-07-31",
    category: "politics",
    currency: "USDC",
    p: 0.62,
  },
  {
    lang: "Mandarin",
    code: "zh-CN",
    flag: "CN",
    source:
      "中国人民银行宣布将于2026年6月15日前对存款准备金率进行下调，幅度预计为25个基点。市场普遍预期此举将提振流动性。",
    translation:
      "The People's Bank of China announced it will cut the reserve requirement ratio by an estimated 25 basis points before June 15, 2026. Markets broadly expect it to boost liquidity.",
    question:
      "Will the PBoC cut its reserve requirement ratio by ≥25 bps before 15 June 2026?",
    rule: "YES if PBoC official press release confirms a cumulative cut of 25 bps or more on/before 2026-06-15.",
    source_url: "pbc.gov.cn",
    expiry: "2026-06-15",
    category: "macro",
    currency: "USDC",
    p: 0.71,
  },
  {
    lang: "Português (BR)",
    code: "pt-BR",
    flag: "BR",
    source:
      "O Banco Central do Brasil sinalizou que a taxa Selic poderá ser cortada em sua próxima reunião de junho, com o IPCA convergindo para a meta de 3%.",
    translation:
      "The Central Bank of Brazil signaled the Selic rate may be cut at its next June meeting, with IPCA converging to the 3% target.",
    question: "Will the Brazilian Central Bank cut Selic at its June 2026 meeting?",
    rule: "YES if the Copom communiqué dated June 2026 reports a cut to the Selic target rate.",
    source_url: "bcb.gov.br",
    expiry: "2026-06-30",
    category: "macro",
    currency: "USDC",
    p: 0.58,
  },
  {
    lang: "Français",
    code: "fr-FR",
    flag: "FR",
    source:
      "La Banque centrale européenne devrait maintenir ses taux directeurs lors de sa réunion du 5 juin 2026, selon une enquête Reuters auprès de 60 économistes.",
    translation:
      "The European Central Bank is expected to hold its key rates at its June 5, 2026 meeting, according to a Reuters survey of 60 economists.",
    question: "Will the ECB hold its main refinancing rate at the 5 June 2026 meeting?",
    rule: "YES if ECB monetary policy decision dated 2026-06-05 reports no change to the MRO rate.",
    source_url: "ecb.europa.eu",
    expiry: "2026-06-05",
    category: "macro",
    currency: "EURC",
    p: 0.66,
  },
];

interface Step {
  k: string;
  label: string;
  note: string;
}

const STEPS: Step[] = [
  { k: "detect", label: "Detect language", note: "franc + CLD3 over cleaned input" },
  { k: "translate", label: "Translate", note: "preserve entities . dates . numerals" },
  { k: "assess", label: "Assess tradability", note: "binary . future . verifiable" },
  { k: "synthesize", label: "Synthesize question", note: "with explicit resolution rule" },
  { k: "critique", label: "Self-critique", note: "score against quality rubric" },
  { k: "dedup", label: "Dedup vs corpus", note: "pgvector cosine within threshold" },
  { k: "decide", label: "Decide: post", note: "sign EIP-712 . attach builder code" },
];

interface ResultMeta {
  question: string;
  source_url: string;
  expiry: string;
  currency: string;
  p: number;
}

function liveAgentEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_LIVE_AGENT;
  if (flag === undefined) return true;
  return flag === "1";
}

// Map pipeline step names to AgentDemo row keys. Revisions and the optional
// map_to_market step share buckets with their base step so the row state
// machine stays seven slots wide.
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

export function AgentDemo() {
  const [sampleIdx, setSampleIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [typed, setTyped] = useState("");
  const [cost, setCost] = useState(0);
  const [result, setResult] = useState<ResultMeta | null>(null);
  const sample = SAMPLES[sampleIdx];
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Type out the source text whenever the sample changes.
  useEffect(() => {
    setTyped("");
    setRunning(false);
    setActiveStep(-1);
    setDoneSteps([]);
    setShowResult(false);
    setCost(0);
    setResult(null);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    abortRef.current?.abort();
    abortRef.current = null;
    const src = sample.source;
    let i = 0;
    const tick = () => {
      if (i <= src.length) {
        setTyped(src.slice(0, i));
        i += 1;
        timersRef.current.push(setTimeout(tick, 18 + Math.random() * 22));
      }
    };
    tick();
    return () => {
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, [sampleIdx, sample.source]);

  function mockRun() {
    const STEP_MS = 520;
    STEPS.forEach((_, i) => {
      timersRef.current.push(
        setTimeout(() => {
          setActiveStep(i + 1);
          setDoneSteps((d) => [...d, i]);
          setCost((c) => Number((c + 0.00012 + Math.random() * 0.0002).toFixed(6)));
        }, STEP_MS * (i + 1)),
      );
    });
    timersRef.current.push(
      setTimeout(() => {
        setActiveStep(-1);
        setShowResult(true);
        setResult({
          question: sample.question,
          source_url: sample.source_url,
          expiry: sample.expiry,
          currency: sample.currency,
          p: sample.p,
        });
        setRunning(false);
      }, STEP_MS * (STEPS.length + 1)),
    );
  }

  async function liveRun() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceText: sample.source }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream returned ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const seen = new Set<string>();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
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
            const bucket = bucketForStep(payload.step ?? "");
            if (bucket && !seen.has(bucket)) {
              seen.add(bucket);
              const idx = STEPS.findIndex((s) => s.k === bucket);
              if (idx >= 0) {
                setActiveStep(idx + 1);
                setDoneSteps((d) => (d.includes(idx) ? d : [...d, idx]));
              }
            }
            if (typeof payload.costUsdc === "number") {
              setCost((c) => Number((c + payload.costUsdc).toFixed(6)));
            }
            if (typeof payload.nanopayment?.amountUsdc === "string") {
              const amount = Number(payload.nanopayment.amountUsdc);
              if (Number.isFinite(amount)) {
                setCost((c) => Number((c + amount).toFixed(6)));
              }
            }
          } else if (eventName === "done") {
            const q = payload.question ?? {};
            setActiveStep(-1);
            setShowResult(true);
            setResult({
              question: String(q.question ?? sample.question),
              source_url: String(q.resolution_source ?? sample.source_url),
              expiry: String(q.expiry ?? sample.expiry),
              currency: String(q.currency ?? sample.currency),
              p:
                typeof q.suggested_probability === "number"
                  ? q.suggested_probability
                  : sample.p,
            });
            setRunning(false);
          } else if (eventName === "error") {
            throw new Error(payload.error ?? "stream error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const reason = err instanceof Error ? err.message : "stream failed";
      toast.error(`Live agent unavailable, running canned demo: ${reason}`);
      // Reset state and run the mock path so the user still sees the result.
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setActiveStep(0);
      setDoneSteps([]);
      setShowResult(false);
      setCost(0);
      mockRun();
    } finally {
      abortRef.current = null;
    }
  }

  function run() {
    if (running) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(true);
    setActiveStep(0);
    setDoneSteps([]);
    setShowResult(false);
    setCost(0);
    setResult(null);
    if (liveAgentEnabled()) {
      void liveRun();
    } else {
      mockRun();
    }
  }

  const renderedQuestion = result?.question ?? sample.question;
  const questionParts = renderedQuestion.split("?");

  return (
    <div className="agent-stage">
      <div className="agent-input">
        <div className="ai-head">
          <span>Source . Pasted news article</span>
          <span className="ai-lang-pill">
            <span className="d" /> {sample.lang} . {sample.code}
          </span>
        </div>
        <div className="ai-source">
          {typed}
          {typed.length < sample.source.length && <span className="cursor" />}
        </div>
        <div className="ai-foot">
          <select
            value={sampleIdx}
            onChange={(e) => setSampleIdx(Number(e.target.value))}
            disabled={running}
          >
            {SAMPLES.map((s, i) => (
              <option key={i} value={i}>
                {`${s.flag} . ${s.lang}`}
              </option>
            ))}
          </select>
          <button className="ai-btn" onClick={run} disabled={running}>
            {running ? "Translating..." : "Run agent"} <span className="arr">→</span>
          </button>
        </div>
      </div>

      <div className="agent-pipe">
        <div className="ap-head">
          <span>Agent loop . 7 steps . Langfuse</span>
          <span className="ap-cost">${cost.toFixed(6)} USDC</span>
        </div>
        <div className="ap-steps">
          {STEPS.map((s, i) => {
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

        <div className={`ap-result${showResult ? " show" : ""}`}>
          <div className="ap-q-lab">→ Synthesized binary question</div>
          <div className="ap-q">
            {showResult && (
              <>
                {questionParts[0]}
                <span className="accent">?</span>
              </>
            )}
          </div>
          <div className="ap-meta-grid">
            <div>
              <div className="k">Resolution</div>
              <div className="v">{result?.source_url ?? sample.source_url}</div>
            </div>
            <div>
              <div className="k">Expiry</div>
              <div className="v">{result?.expiry ?? sample.expiry}</div>
            </div>
            <div>
              <div className="k">Currency</div>
              <div className="v">{result?.currency ?? sample.currency}</div>
            </div>
            <div>
              <div className="k">P (open)</div>
              <div className="v">{Math.round((result?.p ?? sample.p) * 100)}¢</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
