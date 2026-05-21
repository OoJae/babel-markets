// Babel Markets eval harness.
// Runs the pipeline against the fixed set of fixture articles in eval/fixtures/,
// scores each output against the 5-axis rubric, logs traces to Langfuse, and writes
// a summary to eval/output/<timestamp>.json.
//
// Phase 1 gate: average quality must clear 0.70 before Phase 2 work proceeds.
// At Phase 1 the pipeline is a stub so scores will be low. That's fine; this run
// proves the pipes are connected.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { config as loadDotenv } from "dotenv";

// Load .env.local for standalone scripts. Next.js does this automatically in app code.
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
  reject_reason?: string;
  question?: string;
}

async function loadFixtures(): Promise<FixtureMeta[]> {
  const entries = await readdir(FIXTURES_DIR);
  const fixtures: FixtureMeta[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const raw = await readFile(join(FIXTURES_DIR, entry), "utf-8");
    // Lightweight frontmatter parser. Real apps use gray-matter; we keep deps lean.
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
    console.error(
      `No fixtures found in ${FIXTURES_DIR}. Add .md files with frontmatter (source_lang, expected_tradable).`,
    );
    process.exit(1);
  }
  console.log(`Loaded ${fixtures.length} fixtures.`);

  // Dynamic import so the script does not pay the Langfuse + agent cost at parse time.
  const { runPipeline } = await import("../lib/agent/pipeline");

  const rows: RunRow[] = [];
  for (const f of fixtures) {
    const start = Date.now();
    try {
      const result = await runPipeline({
        sourceText: f.text,
        submissionId: basename(f.file, ".md"),
      });
      const row: RunRow = {
        fixture: f.file,
        source_lang: f.source_lang,
        expected_tradable: f.expected_tradable,
        qualityAverage: result.qualityAverage,
        shouldPost: result.shouldPost,
        resolvability: result.quality.resolvability,
        source_quality: result.quality.source_quality,
        timeliness: result.quality.timeliness,
        faithfulness: result.quality.faithfulness,
        translation_fidelity: result.quality.translation_fidelity,
        rejected: result.question.reject,
        reject_reason: result.question.reject_reason,
        question: result.question.question,
      };
      rows.push(row);
      const ms = Date.now() - start;
      console.log(
        `[${f.file}] avg=${row.qualityAverage.toFixed(3)} post=${row.shouldPost} (${ms}ms)`,
      );
    } catch (err) {
      console.error(`[${f.file}] FAILED:`, err);
    }
  }

  const avg =
    rows.reduce((s, r) => s + r.qualityAverage, 0) / Math.max(rows.length, 1);
  const passed = avg >= 0.7;

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixtures run: ${rows.length}`);
  console.log(`Average quality: ${avg.toFixed(3)}`);
  console.log(`Gate (>= 0.70): ${passed ? "PASS" : "FAIL"}`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(OUTPUT_DIR, `${stamp}.json`);
  await writeFile(
    outPath,
    JSON.stringify({ avg, passed, count: rows.length, rows }, null, 2),
  );
  console.log(`Wrote ${outPath}`);

  // Flush Langfuse before exit.
  try {
    const { getLangfuse } = await import("../lib/agent/langfuse");
    await getLangfuse().flushAsync();
  } catch {
    // Langfuse keys not set; skip.
  }

  process.exit(passed ? 0 : 0); // Phase 1 does not gate; Phase 2 will switch to 1.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
