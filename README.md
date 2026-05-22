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

## Status

Phases 1 through 5 have shipped:

- **Phase 1**: Repo scaffold, Supabase schema with `pgvector`, Modular Wallets passkey enrollment lifted from `arc-p2p-payments`, geo-gate middleware, Irys IPFS pinning.
- **Phase 2**: Real multi-step agent loop on mimo-v2.5-pro through an Anthropic-compatible gateway, Voyage AI embeddings, 5-axis self-critique rubric, eval harness against multilingual fixtures.
- **Phase 3**: Polymarket V2 CLOB v2 client with builder code attached to signed EIP-712 orders, Gamma metadata matcher, IPFS provenance per question.
- **Phase 4**: Gateway Nanopayments wired through the seller relay at `/api/babel-nanopay`. Each agent step settles a real testnet Nanopayment on Arc; the paste box shows per-step USDC receipts with the settlement tx hash.
- **Phase 5**: Live CCTP v2 sweep Polygon Amoy to Arc testnet, AttributionEscrow contract deployable to Arc, USYC float as a documented testnet stub, EURC routing wired through the question schema, market view, and post-market preview.

What lands next:

- **Phase 6**: market view design polish, creator dashboard payout history, Modular Wallet `claim()` wired to AttributionEscrow, video demo polish.

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
