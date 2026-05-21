# Phase 1 status

Captured 2026-05-21 at end of scaffold session.

## What works (in code)

- Repo layout matches playbook section 2.5
- `package.json` pinned against versions resolved by the working `arc-p2p-payments` lockfile
- Next.js 16 boots with App Router, Tailwind 4, Geist font
- Supabase migration creates 7 Babel tables + `pgvector` extension + RLS policies + auth.users trigger
- Supabase server + browser + service-role clients
- Modular Wallets passkey enrollment flow lifted from arc-p2p-payments and rewired to the Babel schema
- Agent pipeline scaffold with:
  - Zod-structured output schemas for all 7 steps
  - System prompt + per-step prompts
  - 5-axis rubric scorer (heuristic, Phase 2 replaces with LLM judge)
  - Placeholder `runPipeline` that returns a deterministic stub question and traces to Langfuse
- Eval harness with 12 multilingual fixtures (Yoruba, Swahili, Spanish, French, Portuguese, Arabic, Hausa, Igbo, Mandarin, English) and the run-eval.ts driver
- Stub modules with informative `throw new Error` for: Polymarket CLOB v2, Gamma, Nanopayments, CCTP, USYC, EURC routing, AttributionEscrow off-chain wrapper
- `AttributionEscrow.sol` working draft (creditFees, claim, payoutBatch, 20% platform fee)
- US-persons geo-gate middleware + compliance banner + cookie-based self-attestation
- Landing page with paste box, sample Yoruba article, streaming-ready UI shell
- Sign-in, sign-up (with not-US attest checkbox), dashboard, set-up-wallet pages
- `api/ingest` route stores submission and runs the pipeline
- IPFS pinning via Irys (`lib/proof/irys.ts`)
- Health endpoint at `/api/health`

## What needs Joseph (Day-0 setup, see SETUP.md)

- All accounts: Circle Console, Supabase, Upstash, Langfuse, Anthropic, Irys, Polygon RPC, Polymarket builder profile
- Polymarket verified-tier email (template in SETUP.md)
- Arc testnet faucet claim
- Vercel project create + env var population
- `supabase db push` to materialize the migration in his project
- `npm install`, `npm run dev`, paste a sample article, confirm UI works
- `npm run eval` to confirm Langfuse traces land

## What is deliberately stubbed for now

- Real Claude Sonnet 4.6 agent loop -> Phase 2
- Polymarket V2 client and builder code mechanics -> Phase 3 (confirm signatures from live docs first)
- Gateway Nanopayments wired to inference -> Phase 4
- CCTP sweep, AttributionEscrow deploy, USYC subscribe/redeem, EURC routing -> Phase 5
- Market view page with provenance link, weekly payout cron -> Phase 6

## Open decisions / deferred from plan

- **Drizzle skipped.** Plan named Drizzle as preferred. Decision: stick with `supabase-js` typed queries and raw SQL migrations because (a) both Circle samples use this pattern, (b) RLS works naturally with supabase-js, (c) one less moving part. Revisit if query complexity around pgvector dedup warrants typed joins.
- **Wagmi skipped.** Modular Wallets uses viem directly for passkey-signed user ops; no client-side React hooks needed for Phase 1. Add wagmi if the trader UI grows complex in Phase 6.
- **zod 3.x pinned.** zod 4 is latest but the sample tested against 3.x; AI SDK 6 should support both. Upgrade if Phase 2 prompt-cache flow needs zod 4 features.

## Risks watching

- Next.js 16 with Circle Modular Wallets is the resolved combo in the sample lockfile, but the sample originally said `"next": "latest"` so the 16.1.6 resolution may have happened post-sync. If we see passkey errors, fall back to next 15.5.x.
- pgvector index is HNSW with cosine ops. Phase 2 needs to confirm embedding dimension (1024 for voyage-3 vs 1536 for OpenAI text-embedding-3-small). Schema currently sized at 1536; revisit when picking the embedding model.
- Arc testnet RPC has no SLA. Pre-record the demo video against a known-good window. Build a viem fallback to a second RPC if the primary fails.

## Next session, suggested order

1. Joseph runs SETUP.md, lands all keys in `.env.local`, runs `supabase db push`, confirms `npm run dev` boots and `npm run eval` writes traces.
2. We start Phase 2 only after that, replacing `runPipeline` with the real Claude Sonnet 4.6 multi-step loop and iterating against the rubric until average >= 0.70.
