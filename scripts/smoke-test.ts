// Smoke test the agent pipeline on a single fixture.
// Skips DB persist so we don't need supabase locally.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { readFile } from "node:fs/promises";

const fixture = process.argv[2] ?? "eval/fixtures/003-es-bce-tipos.md";

async function main() {
  const raw = await readFile(fixture, "utf-8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fm) throw new Error("missing frontmatter");
  const body = fm[2].trim();

  console.log(`Running pipeline on ${fixture}`);
  console.log(`Source preview: ${body.slice(0, 120).replace(/\s+/g, " ")}...`);
  console.log();

  const { runPipeline } = await import("../lib/agent/pipeline");
  const result = await runPipeline({
    sourceText: body,
    submissionId: "smoke-" + Date.now(),
    skipTracePersist: true,
    onStep: (e) => {
      console.log(
        `[${e.step}] ${e.latencyMs}ms cost=$${e.costUsdc.toFixed(6)} cache=${e.cachedInputTokens ?? 0} in=${e.tokensIn ?? "?"} out=${e.tokensOut ?? "?"}`,
      );
    },
  });

  console.log();
  console.log("=== RESULT ===");
  console.log("question:", result.question.question);
  console.log("resolution_rule:", result.question.resolution_rule);
  console.log("resolution_source:", result.question.resolution_source);
  console.log("expiry:", result.question.expiry);
  console.log("currency:", result.question.currency);
  console.log("category:", result.question.category);
  console.log("source_lang:", result.question.source_lang);
  console.log("reject:", result.question.reject);
  console.log("rationale:", result.rationale);
  console.log();
  console.log("=== QUALITY ===");
  console.log(JSON.stringify(result.quality, null, 2));
  console.log(`avg: ${result.qualityAverage.toFixed(3)}`);
  console.log(`shouldPost: ${result.shouldPost}`);
  console.log();
  console.log("=== COST ===");
  console.log(`Total: $${result.totalCostUsdc.toFixed(6)}`);
  console.log(`Total latency: ${result.totalLatencyMs}ms`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
