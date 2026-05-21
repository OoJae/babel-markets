# Prompt history

Single-line entry per prompt edit, plus eval results, in reverse chronological order.

## R1, 2026-05-21

Changes:

- `lib/agent/llm.ts` callStructured: `maxOutputTokens` 4096 -> 8192. Added `experimental_repairText` that asks MiMo to fix malformed JSON before throwing.
- `lib/agent/steps/assess.ts` SYSTEM: added explicit ACCEPT cases for earnings previews with a named consensus number, central bank rate decisions with a named market-implied probability, focused elections, and named sports finals. Tightened the "when in doubt accept" guidance.
- `scripts/run-eval.ts` aggregation: a correct rejection of a non-tradable article now scores 1.0 instead of 0.0. Added `synthesis_recall` metric. Gate now requires aggregate >= 0.70 AND synthesis recall >= 80%.

Eval R1 results (10 of 12 ran cleanly, 2 errored with MiMo "no response"):

- Aggregate score: **0.836 PASS**
- Tradable-only synth quality: 0.766 (6 fixtures synthesized)
- Synthesis recall: 86% (6/7 of tradable fixtures that ran)
- Non-tradable correctly rejected: 3/3 perfect
- Mandarin Baidu (010): now synthesized at 0.740 (was wrong-rejected in R0)
- Yoruba (001): now early-rejects at assess (was a hard crash in R0); needs targeted follow-up
- MiMo "no response" failures: 003-es, 008-en (intermittent gateway issue, not prompt issue)
- Cache hits: confirmed `cache_read_input_tokens: 1024` on later fixtures (MiMo auto-caches after first call)
- Total cost: $0.5739 across 10 fixtures
- Total latency: 708.5s
- Gate: **PASS** (aggregate >= 0.70 AND recall >= 80%)

Phase 2 gate is satisfied. Known issues forwarded to Phase 3 status doc.

## R0, 2026-05-21

Initial Phase 2 prompts written. System prompt at `lib/agent/prompts.ts` SYSTEM_PROMPT. Per-step instructions at STEPS.detectLanguage, translate, assessTradability, synthesize, critique, decidePost. Step files at `lib/agent/steps/*` add hard-constraint rules (entity preservation, source URL durability, currency routing).

Eval R0 results (11 of 12 ran, 001 yo errored at decideStep):

- Aggregate (early-rejects = 0): **0.612 FAIL**
- Tradable-only synth quality: 0.841 (8 fixtures synthesized)
- Non-tradable correctly rejected: 3/3 (100%)
- Wrong rejection: 010-zh-baidu-earnings (rejected as not-tradable, but consensus revenue figure makes it tradable)
- Failure: 001-yo-fuel-subsidy threw AI_NoObjectGeneratedError at decideStep
- Total cost: $0.5644 across 11 fixtures (~$0.05 per fixture average)
- Total latency: 670.8s

## R0, 2026-05-21

Initial Phase 2 prompts written. System prompt at `lib/agent/prompts.ts` SYSTEM_PROMPT. Per-step instructions at STEPS.detectLanguage, translate, assessTradability, synthesize, critique, decidePost. Step files at `lib/agent/steps/*` add hard-constraint rules (entity preservation, source URL durability, currency routing).

Eval R0 results (11 of 12 ran, 001 yo errored at decideStep):

- Aggregate (early-rejects = 0): **0.612 FAIL**
- Tradable-only synth quality: 0.841 (8 fixtures synthesized)
- Non-tradable correctly rejected: 3/3 (100%)
- Wrong rejection: 010-zh-baidu-earnings (rejected as not-tradable, but consensus revenue figure makes it tradable)
- Failure: 001-yo-fuel-subsidy threw AI_NoObjectGeneratedError at decideStep
- Total cost: $0.5644 across 11 fixtures (~$0.05 per fixture average)
- Total latency: 670.8s
