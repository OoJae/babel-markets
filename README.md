# Babel Markets

> Polymarket in every language.

A trader in Lagos reads a Yoruba-language story about the petrol subsidy. They paste it into Babel. Within seconds an agent has translated it, judged tradability, synthesized a binary YES/NO question with a resolution rule, and posted it to Polymarket with the trader's builder code attached. Every subsequent trade pays a slice of the USDC fee back to that creator. Float parks in USYC for yield, agent inference is paid in Gateway Nanopayments, fees route from Polygon to Arc via CCTP, EU events price in EURC, and every reasoning trace is pinned to IPFS.

Babel takes the prediction-market stack that Canteen has been unbundling, layers a translation primitive on top, and turns multilingual news distribution into a structural moat for builders who serve non-English markets.

## How it works

```
+----------------+   +----------------------+   +-----------------+   +------------------+
| Ingestion      |-->| Agent core           |-->| Market layer    |-->| Settlement       |
| paste/RSS      |   | detect, translate,   |   | Polymarket V2   |   | Modular Wallet,  |
| franc lang ID  |   | assess, synthesize,  |   | builder code in |   | Gateway Nanopay, |
|                |   | critique, dedup,     |   | EIP-712 order   |   | CCTP, USYC,      |
|                |   | decide              |   | fills poller    |   | EURC, Arc        |
+----------------+   +----------------------+   +-----------------+   +------------------+
                              |                                              |
                              v                                              v
                       +------------+                                +------------------+
                       | Langfuse + |                                | AttributionEscrow|
                       | IPFS proof |                                | + Paymaster      |
                       +------------+                                +------------------+
```

This mirrors the layered prediction-market stack the Canteen essay describes: ingestion as the cold input, an agent as the operator-mediated synthesis venue, and a market layer with builder codes as the identity primitive that ties creators to revenue. Babel is one solo-developer reading of how a non-English-first operator gets built on top of that stack.

## Phase 1 status

What ships in Phase 1 (this commit):

- Repo scaffold (Next.js 15+ App Router, TypeScript, Tailwind 4, Supabase, viem)
- Supabase schema with the 7 Babel tables and `pgvector` for question dedup
- Lifted Modular Wallets passkey enrollment from `circlefin/arc-p2p-payments`
- Agent pipeline scaffold with Zod-structured output, prompts, and 5-axis rubric
- Eval harness against 12 multilingual fixtures (Joseph to expand to 30+)
- Stub modules for Polymarket V2, Gateway Nanopayments, CCTP, USYC, EURC, AttributionEscrow
- US-persons geo-gate middleware and compliance banner
- IPFS pinning via Irys (server-side)
- Health endpoint at `/api/health`

What lands later:

- **Phase 2**: real Claude Sonnet 4.6 agent loop with prompt caching, replace `runPipeline` stub
- **Phase 3**: Polymarket V2 CLOB client with builder code, fills poller, IPFS provenance per market
- **Phase 4**: Gateway Nanopayments wired to inference endpoint; on-screen sub-cent fee readout
- **Phase 5**: CCTP sweep Polygon to Arc, AttributionEscrow deploy on Arc, USYC float (testnet stub), EURC routing
- **Phase 6**: market view page with provenance link, dashboard with weekly payout history, video demo polish

## Architecture vocabulary

Babel uses the Canteen "unbundling the prediction market stack" essay as its design grammar:

- **Builder codes as identity**. Every order Babel posts carries a builder code in the EIP-712 struct. That makes "who synthesized this question" a first-class onchain primitive, not a database lookup.
- **Operator-mediated venue**. The agent is the operator: it filters tradable from untradable, assigns a resolution source, and decides whether to expose the question to traders.
- **Layered stack**. Ingestion, operator, market, settlement, proof. Each layer is independently swappable. Translation lives at the operator layer, not the market layer, which is why it composes with Polymarket rather than competing with it.

## Tech stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 App Router | SSR + route handlers cover frontend and agent endpoints in one repo |
| Agent | Vercel AI SDK 6 + Claude Sonnet 4.6 | Multilingual translation, prompt caching keeps Nanopayments sub-cent |
| DB | Postgres + pgvector (Supabase) | Relational integrity for attributions, semantic dedup of questions |
| Cache | Upstash Redis | Rate limits, fill cursors, idempotency |
| Chain | viem | Typed clients for Arc + Polygon |
| Observability | Langfuse | One trace per agent step, charts quality over time |
| Markets | Polymarket CLOB v2 + Gamma | Builder code in signed orders |
| Wallets | Circle Modular Wallets (passkey) | One-tap onboarding, no seed phrase |
| Payments | Gateway Nanopayments (x402) | Sub-cent agent inference billing |
| Cross-chain | CCTP v2 | Native USDC burn/mint Polygon to Arc |
| Yield | USYC | Float between payouts (testnet stub) |
| Proof | Irys IPFS | Reasoning trace permanence |

## Getting started

Copy `.env.example` to `.env.local`, fill in the keys (Supabase, Upstash, Langfuse, Anthropic-compatible gateway, Irys, Circle Console, Polygon RPC), then:

```
npm install
supabase db push
npm run dev
```

Open `localhost:3000`, paste a non-English article, and watch the 7 agent steps stream live with per-step USDC cost. Run `npm run eval` to score 12 multilingual fixtures and write Langfuse traces.

## Compliance

Babel is testnet-only for the hackathon period. Polymarket prohibits trading by US persons; we geo-gate at the edge and require self-attestation at sign-up. USYC is non-US-only and KYC-allow-listed; Babel demonstrates the integration on testnet as a structural design and does not park real user funds.

## License

Apache 2.0. Built for the Agora Agents Hackathon (Canteen x Circle x Arc).
