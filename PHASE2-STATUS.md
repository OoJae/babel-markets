# Phase 2 status

Captured 2026-05-21 at gate-pass.

## Gate result

R1 eval, 12-fixture set:

- Aggregate score: **0.836 PASS** (gate >= 0.70)
- Tradable synthesis quality: 0.766
- Synthesis recall: 86% (gate >= 80%)
- Rejection accuracy: 3/3 perfect
- Cost: $0.5739 across 10 fixtures that completed (~5.7 cents per fixture)
- Latency: 708s total (~71s per fixture)

## What ships in Phase 2

- Real multi-step agent loop: detect, translate, assess, synthesize, critique, dedup, decide. Each step has Zod-structured output, a Langfuse span, and a row in the `traces` table.
- Single-pass revision: if the critique scores below 0.70, the synthesizer gets the critique notes and tries once more.
- LLM judge in the critique step replaces the Phase 1 heuristic.
- Streaming endpoint at `/api/agent/stream` (Server-Sent Events) so the paste box renders each step live with its USDC cost.
- Embedding provider with MiMo probe (no embeddings endpoint found) plus Xenova multilingual-e5-small (384-dim) fallback.
- `match_questions` RPC migration for pgvector cosine dedup.
- Eval harness with fair aggregation (correct rejection = 1.0, wrong rejection = 0.0) and the dual gate (aggregate AND recall).
- PROMPT-HISTORY.md changelog.

## What works on the live MiMo gateway

- Anthropic-style `/v1/messages` endpoint via the AI SDK Anthropic provider.
- `mimo-v2.5-pro` returns valid JSON for our schemas once `maxOutputTokens` >= 4096.
- Auto-caching across calls: `cache_read_input_tokens: 1024` observed once the same system prompt repeats. Babel benefits without setting `cache_control` markers ourselves.
- Structured output (generateObject) works reliably for short Zod schemas; the longer ones occasionally need the repair pass.

## Known issues forwarded to Phase 3

1. **MiMo intermittent "no response"**: 2 fixtures (003-es, 008-en) errored with `AI_NoObjectGeneratedError: the model did not return a response`. These previously scored 0.97 and 1.0 in R0, so the issue is gateway flakiness, not prompt quality. Suggested fix: wrap callStructured with one automatic retry on the no-response error.

2. **Yoruba (001) early-rejected at assess**: the article is genuinely tradable (Nigerian fuel subsidy decision before 31 July 2026). R0 made it through assess and crashed at decide; R1 fixed the crash but the model now rejects it at assess. Likely cause: the Yoruba translation lost some specificity. Suggested fix: tighten the translate-step prompt for low-resource African languages so entities and dates are preserved more robustly.

3. **Cost still around 6 cents per question**: not sub-cent. The Nanopayments demo-line works at "sub-dime" but not "sub-cent" without aggressive system-prompt caching. We get auto-cache hits on repeated runs but not on first runs. Phase 4 will measure whether explicit cache markers shave cost further.

4. **Latency around 60 to 100 seconds per question**: too long for a video demo's "wow" moment. Largest contributors: MiMo's thinking content blocks (10 to 25 seconds per step), 7 sequential LLM calls per question. Suggested fix in Phase 3 or 6: run independent steps in parallel where possible (e.g. dedup embedding can run alongside critique).

## What does NOT ship in Phase 2 (deferred to later phases)

- Polymarket V2 client and builder code wiring. Phase 3.
- IPFS pinning per market (depends on a market id from Polymarket). Phase 3.
- Real Gateway Nanopayments billing the agent EOA for inference. Phase 4.
- CCTP sweep, AttributionEscrow deploy, USYC subscribe / redeem, EURC routing. Phase 5.

## Verification I ran before claiming gate-pass

- `npm run typecheck`: clean.
- `npm run eval`: aggregate 0.836, recall 86%, exit code 0.
- `npx tsx scripts/smoke-test.ts eval/fixtures/003-es-bce-tipos.md`: scored 1.000 on a single fixture.
- Anthropic SDK against MiMo gateway: confirmed via `scripts/debug-ai-sdk.ts` returning structured output with cache_read_input_tokens > 0 on repeated calls.

## What I need from Joseph next

1. Review the streamed UI on `npm run dev`: paste a Spanish article, watch all 7 steps land with USDC cost per step.
2. Run `supabase db push` so the embedding-dim migration (`20260522000000_adjust_embedding_dim.sql`) and the `match_questions` RPC (`20260522000100_add_match_questions_rpc.sql`) land in the live DB.
3. Confirm whether to ship Phase 2 as-is or do an R2 round to recover the Yoruba miss + add the MiMo retry. My recommendation: ship as-is; Yoruba and retry land naturally in Phase 3 alongside Polymarket wiring.
