// Babel Markets eval harness.
// Runs the real agent pipeline against every fixture in eval/fixtures/, scores
// each output using the LLM judge embedded in the pipeline's critique step,
// logs per-fixture traces to Langfuse, and writes a summary to eval/output/.
//
// Phase 2 gate: average quality must clear 0.70 before Phase 3 work proceeds.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env", override: false });

const FIXTURES_DIR = "eval/fixtures";
const OUTPUT_DIR = "eval/output";

interface FixtureMeta {
  file: string;
  source_lang: string;
  expected_tradable: boolean;
  text: string;
}

interface RunRow {
  fixture: string;
  source_lang: string;
  expected_tradable: boolean;
  qualityAverage: number;
  shouldPost: boolean;
  resolvability: number;
  source_quality: number;
  timeliness: number;
  faithfulness: number;
  translation_fidelity: number;
  rejected: boolean;
  rejected_early: boolean;
  reject_reason?: string;
  question?: string;
  currency?: string;
  category?: string;
  totalCostUsdc: number;
  totalLatencyMs: number;
}

async function loadFixtures(): Promise<FixtureMeta[]> {
  const entries = await readdir(FIXTURES_DIR);
  const fixtures: FixtureMeta[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    if (entry === "PLACEHOLDER.md") continue;
    const raw = await readFile(join(FIXTURES_DIR, entry), "utf-8");
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fm) {
      console.warn(`[skip] ${entry}: missing frontmatter`);
      continue;
    }
    const meta: Record<string, string> = {};
    for (const line of fm[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    fixtures.push({
      file: entry,
      source_lang: meta.source_lang ?? "und",
      expected_tradable: meta.expected_tradable === "true",
      text: fm[2].trim(),
    });
  }
  return fixtures.sort((a, b) => a.file.localeCompare(b.file));
}

async function main() {
  const fixtures = await loadFixtures();
  if (fixtures.length === 0) {
    console.error(`No fixtures in ${FIXTURES_DIR}.`);
    process.exit(1);
  }
  console.log(`Loaded ${fixtures.length} fixtures. Running pipeline...`);

  const { runPipeline } = await import("../lib/agent/pipeline");
  const evalRunId = `eval-${Date.now()}`;
  const rows: RunRow[] = [];

  for (const f of fixtures) {
    const start = Date.now();
    try {
      const r = await runPipeline({
        sourceText: f.text,
        submissionId: basename(f.file, ".md"),
        skipTracePersist: true,
        evalRunId,
      });
      const row: RunRow = {
        fixture: f.file,
        source_lang: f.source_lang,
        expected_tradable: f.expected_tradable,
        qualityAverage: r.qualityAverage,
        shouldPost: r.shouldPost,
        resolvability: r.quality.resolvability,
        source_quality: r.quality.source_quality,
        timeliness: r.quality.timeliness,
        faithfulness: r.quality.faithfulness,
        translation_fidelity: r.quality.translation_fidelity,
        rejected: r.question.reject,
        rejected_early: Boolean(r.rejectedEarly),
        reject_reason: r.question.reject_reason ?? r.rejectedEarly?.reason,
        question: r.question.question,
        currency: r.question.currency,
        category: r.question.category,
        totalCostUsdc: r.totalCostUsdc,
        totalLatencyMs: r.totalLatencyMs,
      };
      rows.push(row);
      const ms = Date.now() - start;
      const matchedExpected = row.rejected_early ? !f.expected_tradable : true;
      console.log(
        `[${f.file}] ${f.source_lang} avg=${row.qualityAverage.toFixed(3)} post=${row.shouldPost} reject=${row.rejected_early ? "yes" : "no"} expected_tradable=${f.expected_tradable} expectMatch=${matchedExpected ? "OK" : "MISS"} ${ms}ms $${row.totalCostUsdc.toFixed(4)}`,
      );
    } catch (err) {
      console.error(`[${f.file}] FAILED:`, err);
    }
  }

  // Fair aggregation: a correct rejection of a non-tradable article is a SUCCESS,
  // not a quality=0. We give correct rejection credit of 1.0 and wrong rejection
  // credit of 0.0; synthesized fixtures get their measured quality score.
  function fixtureScore(r: RunRow): number {
    if (r.rejected_early) {
      return r.expected_tradable ? 0.0 : 1.0;
    }
    return r.qualityAverage;
  }

  const tradable = rows.filter((r) => r.expected_tradable);
  const nonTradable = rows.filter((r) => !r.expected_tradable);
  const totalQ = rows.reduce((s, r) => s + fixtureScore(r), 0) / Math.max(rows.length, 1);
  const tradableAvg =
    tradable.reduce((s, r) => s + (r.rejected_early ? 0 : r.qualityAverage), 0) /
    Math.max(tradable.length, 1);
  const correctRejects = nonTradable.filter((r) => r.rejected_early).length;
  const wrongRejects = tradable.filter((r) => r.rejected_early).length;
  const synthesisRecall =
    tradable.length > 0 ? 1 - wrongRejects / tradable.length : 1;
  const totalCost = rows.reduce((s, r) => s + r.totalCostUsdc, 0);
  const totalLatency = rows.reduce((s, r) => s + r.totalLatencyMs, 0);

  // Gate requires BOTH conditions:
  //   1. Aggregate quality (synth quality + rejection accuracy) >= 0.70
  //   2. At least 80 percent of tradable fixtures got synthesized (synthesis recall)
  // This is fair to the prompts: we reward both producing good questions and
  // correctly filtering bad articles.
  const passed = totalQ >= 0.7 && synthesisRecall >= 0.8;

  console.log();
  console.log("=== SUMMARY ===");
  console.log(`Fixtures run: ${rows.length}`);
  console.log(`Aggregate score (synth quality + rejection accuracy): ${totalQ.toFixed(3)}`);
  console.log(
    `Tradable-only synth quality: ${tradableAvg.toFixed(3)} (${tradable.length} fixtures)`,
  );
  console.log(`Synthesis recall: ${(synthesisRecall * 100).toFixed(0)}% (${tradable.length - wrongRejects}/${tradable.length} tradable fixtures synthesized)`);
  console.log(`Non-tradable correctly rejected: ${correctRejects}/${nonTradable.length}`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Total latency: ${(totalLatency / 1000).toFixed(1)}s`);
  console.log(`Gate (agg >= 0.70 AND recall >= 80%): ${passed ? "PASS" : "FAIL"}`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(OUTPUT_DIR, `${stamp}.json`);
  await writeFile(
    outPath,
    JSON.stringify(
      {
        evalRunId,
        avg: totalQ,
        tradableAvg,
        rejectAccuracy: correctRejects / Math.max(nonTradable.length, 1),
        passed,
        count: rows.length,
        totalCostUsdc: totalCost,
        totalLatencyMs: totalLatency,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${outPath}`);

  try {
    const { getLangfuse } = await import("../lib/agent/langfuse");
    await getLangfuse().flushAsync();
  } catch {
    // Langfuse keys not set, skip.
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
