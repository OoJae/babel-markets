**BABEL MARKETS**

**Polymarket in Every Language**

The Complete Build Guide and Winning Playbook

Agora Agents Hackathon \| Canteen x Circle x Arc

Target: 1st Place (\$10,000 Grand Prize)

**Prepared for: Joseph (Oluwademilade Olamiye)**

Build environment: Claude Code

Submission deadline: May 25, 2026

Contents

Part 1: The Winning Playbook

Why Babel Markets, in one paragraph

Babel Markets is a live web app where a person pastes a non-English news article, an AI agent reformulates it into a well-formed binary prediction question with an explicit resolution rule, the question is posted to Polymarket through the V2 order book with your builder code attached, and whoever originated that question earns a share of the USDC builder fee every time someone trades it. The float of pending payouts parks in USYC for yield, agent inference is paid for with Gateway Nanopayments, builder-fee earnings are bridged to Arc with CCTP, EU events are priced in EURC while US events use USDC, and every question\'s reasoning trace is pinned to IPFS for permanence. It is the only idea on our shortlist that turns your three distribution channels (MEXC blog, crypto Twitter, and African crypto communities) into a structural moat that the other entrants do not have.

How the four judging axes are won

| **Axis (weight)**            | **How Babel wins it**                                                                                                                                                                                                                                                        |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Agentic Sophistication (30%) | A real multi-step agent loop: detect language, translate, judge newsworthiness, synthesize a resolvable question, self-critique against a rubric, decide whether to post, then monetize. This is meaningful agency, not AI-flavored automation.                              |
| Traction (30%)               | Translation is the one product that maps directly to your audience. A Naira-denominated or Yoruba-language market is something Nigerian crypto communities have never had access to. MEXC blog plus crypto Twitter plus African Telegram clusters become a force multiplier. |
| Circle tool usage (20%)      | Five primitives used non-trivially: Modular Wallets (passkey onboarding), Gateway Nanopayments (pay the agent), CCTP (route fees to Arc), USYC (park float), and EURC (FX-aware EU markets). Judges from Circle will grep package.json and find them.                        |
| Innovation (20%)             | Builds directly on the hosts\' own published research angle (Translation as a source of alpha). Echoing the brief signals you read it carefully, which async judges reward.                                                                                                  |

The three traps to avoid

1.  **Do not build a Hyperliquid perp agent.** Judges have seen a dozen of these at ETHGlobal and you cannot win on latency as a solo dev on Vercel.

2.  **Do not lean on reasoning-trace NFTs.** Intellectually pretty, but it generates zero traction in 14 days, and traction is 30 percent of the score.

3.  **Do not attempt cross-chain arbitrage.** You will lose to MEV bots and HFT shops. Translation plus distribution is your moat, not speed.

What the judges actually care about

The panel has backgrounds from Circle/Arc, Coinbase, Stellar, and Protocol Labs. They will read your repo like code review, not a pitch deck. Each organization has a public prior you can hit directly:

- **Circle/Arc:** multi-currency settlement, Nanopayments used for real, USYC for yield, and a story for why this only works on Arc because of sub-second finality and roughly one cent USDC fees.

- **Coinbase:** autonomous agents that pay for their own resources (LLM inference, APIs) in stablecoins. Jesse Pollak has called agents the next big wave for crypto payments and described agents wanting money as software.

- **Stellar:** low-fee micropayments, MCP-server integration, and agent budget controls (spending caps). Your per-question translator payout cap is exactly that pattern.

- **Protocol Labs:** content-addressed storage. Pin every question\'s reasoning trace to IPFS and they will notice.

The traction bar to clear

For a solo dev in a 14-day window, judges will respect roughly: 15 to 30 onboarded users who are not you, somewhere between \$1k and \$10k in real notional volume routed through the app, a measurable week-2 return signal, and one mildly viral Twitter moment (50-plus retweets) showing the product working with real money. Beat that and the Traction axis is yours.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>The single most important pre-build action</strong></p>
<p>Read the Canteen essay on unbundling the prediction market stack three times before you write code. The judges wrote it. The winning submission will echo its vocabulary (the layered stack, builder codes as an identity primitive, operator-mediated venues) directly in the README. Treat it as the answer key.</p></td>
</tr>
</tbody>
</table>

Part 2: The Babel Markets Build Guide

2.1 What you are building, precisely

Babel Markets has one core loop and several supporting systems. The core loop takes untranslated news as input and produces a live, tradable prediction market as output, while attributing fee revenue back to the person who supplied the news. Everything else exists to make that loop trustworthy, monetizable, and demo-able.

Stated as a user story: a trader in Lagos reads a Yoruba-language article about a fuel subsidy decision, pastes it into Babel, and within seconds sees a clean question (\"Will the Nigerian government remove the petrol subsidy before 31 July 2026?\") with a clear resolution source. They post it with one tap. Anyone who then trades that market pays a small builder fee, and a slice of that fee accrues to the Lagos trader, settled in USDC and parked in yield until weekly payout.

2.2 System architecture

Think of the system as five layers. Data flows top to bottom for creation and bottom to top for monetization.

| **Layer**             | **Responsibility**                                                                   | **Key tech**                                                          |
|-----------------------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| Ingestion             | Accept pasted text or pull from RSS/news feeds; detect source language               | Next.js route handlers, franc/CLD language detection                  |
| Agent core            | Translate, assess newsworthiness, synthesize question, self-critique, decide to post | Vercel AI SDK 6, Claude Sonnet 4.6 with prompt caching, Langfuse      |
| Market layer          | Post the question to Polymarket V2 with builder code; track fills                    | Polymarket CLOB v2 client, Gamma metadata API                         |
| Settlement layer      | Wallets, fee routing, float yield, payouts, dual currency                            | Circle Modular Wallets, Gateway Nanopayments, CCTP, USYC, EURC on Arc |
| Persistence and proof | Store questions, traces, attributions; pin proofs                                    | Postgres + pgvector, Upstash Redis, IPFS/Irys                         |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Verify APIs against live docs, do not trust memory</strong></p>
<p>The Circle and Polymarket SDKs move fast. Method names, package versions, and contract addresses in this guide are directionally correct as of mid-May 2026 but must be confirmed against the live docs your ARC-cli context sync pulls in. The master prompt in Appendix A instructs Claude Code to do exactly this before writing integration code. Treat any signature in this document as a sketch, not gospel.</p></td>
</tr>
</tbody>
</table>

2.3 Tech stack and why each piece is here

| **Concern**         | **Choice**                            | **Reason**                                                                                     |
|---------------------|---------------------------------------|------------------------------------------------------------------------------------------------|
| Framework           | Next.js 15 (App Router)               | You already use it; SSR plus route handlers cover frontend and agent endpoints in one repo     |
| Agent orchestration | Vercel AI SDK 6                       | Native tool-calling, streaming, structured output via Zod; matches your Sonar stack            |
| Model               | Claude Sonnet 4.6 with prompt caching | Strong multilingual translation and reasoning; caching cuts cost on the repeated system prompt |
| DB                  | Postgres + pgvector                   | Relational integrity for attributions plus semantic dedup of near-identical questions          |
| Cache/queue         | Upstash Redis                         | Rate limits, fill-polling cursors, idempotency keys                                            |
| Chain access        | viem                                  | Typed Arc and Polygon RPC calls, contract reads/writes                                         |
| Observability       | Langfuse                              | Trace every agent decision; you will want this for the demo and the eval harness               |
| Markets             | Polymarket CLOB v2 + Gamma            | Builder code lives in the signed order; Gamma supplies market metadata                         |
| Wallets             | Circle Modular Wallets (passkey)      | One-tap onboarding; no seed phrase friction for non-crypto-native African users                |
| Payments            | Gateway Nanopayments (x402)           | Sub-cent agent inference payments; the headline 2026 primitive                                 |
| Cross-chain         | CCTP                                  | Native USDC burn-and-mint to move builder fees from Polygon to Arc                             |
| Yield               | USYC                                  | Park float between weekly payouts; high-signal for a finance judge panel                       |
| Proof               | IPFS via Irys                         | Content-addressed permanence for reasoning traces (Protocol Labs hook)                         |

2.4 Day 0 setup: accounts, keys, and access

Do all of this before writing feature code. None of it is optional, and several items have approval latency, so start them in parallel on the first day.

4.  Join both Discords. Canteen: discord.gg/TGnyfKh23V. Arc builder Discord: discord.com/invite/buildonarc, and mention Canteen plus Agora in the onboarding flow.

5.  Install the Canteen ARC CLI and sync context into Claude Code: uv tool install git+https://github.com/the-canteen-dev/ARC-cli

6.  Create a Circle Developer account, generate an API key, and register your Entity Secret. This unlocks Developer-Controlled Wallets and Modular Wallets.

7.  Get on the Arc testnet: claim from the faucet, add the RPC to viem, confirm you can read a block.

8.  Register a Polymarket builder profile (Settings, Builder tab). Email builder@polymarket.com with a one-paragraph Babel pitch to request the verified tier; this has lead time, so send it Day 1.

9.  Provision Postgres with the pgvector extension (Supabase or Neon both work), and an Upstash Redis instance.

10. Create an Irys (Arweave-backed) account or use an IPFS pinning service (web3.storage) for the proof layer.

11. Set up a Langfuse project and capture the public/secret keys.

12. Get an Anthropic API key for Claude Sonnet 4.6 (separate from Claude Code itself, since the deployed app calls the model server-side).

2.5 Repository structure

A single Next.js monorepo keeps the build tractable. Fork the wallet skeleton from circlefin/arc-multichain-wallet for the Circle wiring, then layer the agent and market code on top. Suggested layout:

babel-markets/

app/

page.tsx \# landing + paste box (hero)

market/\[id\]/page.tsx \# single market view

dashboard/page.tsx \# creator earnings dashboard

api/

ingest/route.ts \# accept text, kick off agent

agent/route.ts \# the agent loop (streamed)

post-market/route.ts \# sign + submit Polymarket order

fills/route.ts \# poll fills, attribute fees

payout/route.ts \# weekly payout cron target

wallet/route.ts \# Modular Wallet create/login

lib/

agent/

pipeline.ts \# orchestrates the steps

prompts.ts \# system + step prompts

schema.ts \# Zod schemas for structured output

eval.ts \# question-quality rubric scorer

polymarket/

client.ts \# CLOB v2 wrapper, builder code

gamma.ts \# market metadata + resolution

circle/

wallets.ts \# Modular + DCW helpers

nanopay.ts \# Gateway Nanopayments (x402)

cctp.ts \# burn on Polygon, mint on Arc

usyc.ts \# subscribe/redeem float

fx.ts \# USDC vs EURC routing

chain/

arc.ts \# viem clients, contract ABIs

escrow.ts \# attribution + payout contract calls

proof/irys.ts \# pin reasoning traces

db/ \# drizzle/prisma schema + queries

redis.ts \# Upstash client

contracts/

AttributionEscrow.sol \# holds fees, splits to creators

scripts/

seed.ts poll-fills.ts run-eval.ts

langfuse.config.ts

.env.local

2.6 Database schema

Keep the schema small and attribution-centric. The vector column on questions enables dedup so the agent does not flood Polymarket with near-identical markets, which would get you moderated and erode trust.

| **Table**    | **Key columns**                                                                                                                                             | **Purpose**                                       |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| users        | id, wallet_address, passkey_id, locale, created_at                                                                                                          | Creators and traders onboarded via Modular Wallet |
| submissions  | id, user_id, source_text, source_lang, status, created_at                                                                                                   | Raw pasted news before processing                 |
| questions    | id, submission_id, question_text, resolution_rule, resolution_source, expiry, category, currency, embedding(vector), polymarket_market_id, ipfs_cid, status | Synthesized, posted markets                       |
| traces       | id, question_id, step, model, input, output, score, latency_ms                                                                                              | Per-step agent reasoning for Langfuse + IPFS      |
| fills        | id, polymarket_market_id, taker, size_usdc, builder_fee_usdc, tx_hash, observed_at                                                                          | Trades that earned builder fees                   |
| attributions | id, question_id, creator_user_id, accrued_usdc, paid_usdc, last_payout_at                                                                                   | Running fee balance owed to each creator          |
| payouts      | id, creator_user_id, amount_usdc, cctp_tx, arc_tx, usyc_redeemed, created_at                                                                                | Settled weekly payouts                            |

2.7 Module 1: The translation and question-synthesis agent

This is the heart of the product and where most of the Agentic Sophistication score lives. Do not build it as a single prompt. Build it as a loop of discrete, observable steps, each with structured output, so a judge watching Langfuse sees genuine multi-step reasoning.

The steps

13. Detect language and clean the text (strip boilerplate, ads, navigation).

14. Translate to English while preserving named entities, dates, and figures verbatim.

15. Assess newsworthiness and tradability: is there a future, verifiable, binary outcome here? If not, reject with a reason.

16. Synthesize a candidate question with an explicit resolution rule, an authoritative resolution source, an expiry date, a category, and a suggested initial probability.

17. Self-critique against the quality rubric (Module 2). If the score is below threshold, revise once, then re-score.

18. Dedup: embed the question and check pgvector for an existing market above a similarity cutoff. If a near-duplicate exists, link to it instead of creating a new one.

19. Decide to post or hold, and emit a one-line rationale that becomes part of the market description.

Structured output contract

Force every step into a Zod schema so the loop is deterministic and the failure modes are visible. The question step should return an object shaped roughly like this:

const QuestionSchema = z.object({

question: z.string().max(200),

resolution_rule: z.string(), // exact YES/NO conditions

resolution_source: z.string().url(),

expiry: z.string(), // ISO date

category: z.enum(\[\'politics\',\'macro\',\'sports\',\'crypto\',\'tech\',\'other\'\]),

currency: z.enum(\[\'USDC\',\'EURC\'\]),

suggested_probability: z.number().min(0).max(1),

source_lang: z.string(),

entities: z.array(z.string()), // preserved named entities

reject: z.boolean(),

reject_reason: z.string().optional(),

});

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Prompt-caching tip</strong></p>
<p>The system prompt that defines what a well-formed market looks like will be long and stable. Mark it as a cached prefix so you only pay full input cost once per session. This matters because the Nanopayments demo only impresses if the per-question cost is genuinely sub-cent.</p></td>
</tr>
</tbody>
</table>

2.8 Module 2: The question-quality eval harness

Build this on Day 2, not Day 10. A poorly formed question (ambiguous resolution, no clear source of truth) gets rejected by Polymarket moderation and destroys user trust. The eval harness is also a strong repo signal: it shows the judges you take agent reliability seriously, which is exactly the evals competence the field rewards.

Assemble a fixed set of 30 to 50 source articles across your target languages with known-good and known-bad expected outcomes. Score each synthesized question on a rubric:

- Resolvability: is the YES/NO condition unambiguous and checkable?

- Source quality: is the resolution source authoritative and durable?

- Timeliness: does the question have a sensible, near-term expiry?

- Faithfulness: does the question reflect the source article without hallucinated facts?

- Translation fidelity: are entities, dates, and numbers preserved exactly?

Gate your build on this: if average quality is below 70 percent by Day 5, that is your pivot trigger (see Section 2.18). Wire the harness into a script (scripts/run-eval.ts) and log results to Langfuse so you can show a quality-over-time chart in the submission.

2.9 Module 3: Polymarket V2 integration and builder codes

The monetization mechanic is the builder code. In Polymarket V2 the builder attribution lives inside the signed EIP-712 order struct, so every order your app submits carries your builder identity and earns a fee share on the resulting fill. This is the entire revenue model and it requires no token and no custody.

What to implement

- A CLOB v2 client wrapper that attaches your builder code to every signed order.

- Market creation or market-mapping: depending on V2 permissions, you either create the market or map your synthesized question to an existing one and route trades through your builder code.

- A Gamma metadata reader to pull market state, prices, and resolution status.

- A fills poller (scripts/poll-fills.ts on a cron) that reads trades against your markets, computes the builder fee earned, and writes rows into the fills table.

Sketch of the order wrapper

// lib/polymarket/client.ts (verify exact API against live v2 docs)

import { ClobClient } from \'@polymarket/clob-client-v2\';

const clob = new ClobClient({ host, chainId: 137, signer });

export async function postOrder(params) {

const order = await clob.createOrder({

tokenID: params.tokenID,

price: params.price,

side: params.side,

size: params.size,

builderCode: process.env.POLYMARKET_BUILDER_CODE, // attribution

});

return clob.postOrder(order);

}

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Compliance guardrail</strong></p>
<p>Polymarket prohibits US persons from trading via its UI, API, or agents built by persons in restricted jurisdictions. Babel must not onboard US users for trading. Put a clear geo-gate and terms notice in the onboarding flow, and say so in your README. Ignoring this is a real legal risk, not a formality.</p></td>
</tr>
</tbody>
</table>

2.10 Module 4: Circle Modular Wallets and onboarding

Friction kills traction. Modular Wallets with passkey authentication let a brand-new user create a smart-contract wallet with Face ID or a fingerprint, no seed phrase, no extension. This is the single biggest lever on your onboarded-user count, which is half the Traction score. Fork the passkey flow from circlefin/arc-p2p-payments.

- On first visit, offer a one-tap Create Account that provisions a Modular Wallet via passkey.

- Store the wallet address and passkey id against the user row; no custody of keys on your side.

- Use the modular SDK RPC endpoint to register the credential and to sign subsequent transactions.

- Returning users authenticate with the same passkey, recovering their wallet instantly.

2.11 Module 5: Gateway Nanopayments for agent inference

This is your headline Circle integration and the cleanest way to demonstrate the agentic-economy thesis the judges care about. Every time the agent translates and synthesizes a question, it pays for its own LLM inference with a Nanopayment denominated in USDC, as small as a fraction of a cent, batched so the on-chain cost is negligible. Nanopayments are x402 v2 compatible, so frame this as the agent paying an x402-gated inference endpoint.

- Wrap your model-call endpoint behind an x402 paywall (seller side).

- The agent (buyer side) presents a Nanopayment to access it, drawing from a Gateway unified USDC balance.

- Show the running per-question cost in the UI and the demo. The wow line is a fee of \$0.000001 visible on screen.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Why this scores</strong></p>
<p>Coinbase and Stellar judges both have public theses about agents paying for resources autonomously. An agent that funds its own cognition with stablecoin micropayments is the literal embodiment of money as software. Make sure this shows up in the video.</p></td>
</tr>
</tbody>
</table>

2.12 Module 6: CCTP fee routing from Polygon to Arc

Polymarket settles on Polygon, so builder fees accrue there. CCTP (Cross-Chain Transfer Protocol) moves USDC natively by burning on the source chain and minting on the destination, with no wrapped-asset risk. Use it to sweep accumulated builder fees from Polygon to Arc on demand or on a schedule, where the rest of your settlement logic lives.

- Implement a sweep function: when fees on Polygon exceed a threshold, initiate a CCTP burn.

- Attest and complete the mint on Arc, then credit the attribution balances.

- Batch sweeps weekly to align with the payout cycle and keep gas trivial.

2.13 Module 7: USYC float parking

Between the moment a fee is earned and the moment it is paid out weekly to creators, the USDC sits idle. Subscribing that float into USYC, a tokenized money market fund, earns yield and is a high-signal integration for a finance-heavy judge panel. The Teller contract exposes buy and sell methods to subscribe and redeem.

- On sweep completion, subscribe the platform-held float (your 20 percent fee plus pre-payout balances) into USYC.

- Before each weekly payout, redeem the amount owed back into USDC.

- Track usyc_redeemed per payout so your accounting is auditable in the dashboard.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Eligibility caveat</strong></p>
<p>USYC shares are only available to non-US persons and wallets must be allow-listed after KYC/AML. For the hackathon, demonstrate the integration on testnet and frame it as the yield mechanism; do not park real user funds in USYC until compliance is properly handled. State this in the README.</p></td>
</tr>
</tbody>
</table>

2.14 Module 8: EURC dual-currency (FX-aware markets)

RFB 3 explicitly calls out FX-aware strategies that price events in the buyer\'s home currency. Babel earns the Innovation and Circle-usage points by routing European events into EURC-denominated markets while US events stay in USDC. The agent already emits a currency field in its question schema; honor it end to end.

- In the synthesis step, the agent picks USDC or EURC based on the event\'s geography and the likely audience.

- The market layer denominates and settles accordingly.

- The dashboard shows creator earnings split by currency. This is a small amount of code for a disproportionate amount of judge signal.

2.15 Module 9: IPFS proof layer

Pin each question\'s full reasoning trace (the per-step inputs and outputs from Module 1) to IPFS via Irys, and store the returned CID on the questions row. This gives every market a permanent, verifiable provenance record: anyone can audit how the agent arrived at the question from the source article. It is cheap, fast, and it is the specific hook that makes a Protocol Labs judge lean in.

2.16 Module 10: The attribution and payout escrow on Arc

You do not need smart contracts to capture builder fees (the builder code does that), but you do need trustworthy accounting and payout to creators. A minimal AttributionEscrow contract on Arc holds swept USDC, records each creator\'s accrued balance, and releases payouts on a weekly cadence, taking your 20 percent platform fee. Keep it simple; the complexity is in the off-chain accounting, not the contract.

- creditFees(questionId, amount): called after a CCTP sweep, increments the creator\'s balance.

- claim() or batched payout(): releases accrued USDC to the creator\'s wallet, settling in under a second on Arc.

- Use Paymaster so creators never need a gas token; fees are paid in USDC.

Because Arc gives sub-second deterministic finality and roughly one-cent USDC fees, the weekly micro-payouts to dozens of small creators are economical, which is precisely the on-Arc-only story to tell in the README.

2.17 Frontend pages and the hero flow

Three pages carry the whole product. Keep the design clean and fast; you forked the Circle scaffold so the wallet plumbing is already there.

| **Page**            | **What it does**                                                                                                       | **Why it matters**                                                                                    |
|---------------------|------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Landing + paste box | A single prominent textarea: paste non-English news, watch the agent work in real time, see the question appear        | This is the hero shot of your video. The streaming agent steps are the wow moment.                    |
| Market view         | Shows the synthesized question, resolution rule, source link, live price, the IPFS provenance link, and a trade button | Where trades (and builder fees) happen; the provenance link is the trust and the Protocol Labs hook   |
| Creator dashboard   | Running USDC/EURC earnings, float-in-USYC indicator, payout history with Arc tx links                                  | Turns abstract builder fees into a visible, motivating number that makes creators come back in week 2 |

2.18 The 14-day execution plan

You are reading this mid-event. The plan below assumes roughly six days to ship a live product and six days to drive traction, with polish and submission at the end. Adjust the calendar dates to your actual start.

Days 1 to 2: Foundation

- Complete every item in Day 0 setup (Section 2.4). Send the Polymarket verified-tier email immediately.

- Run ARC-cli context sync so Claude Code has Arc and Circle docs as context.

- Fork arc-multichain-wallet and arc-p2p-payments; strip to the wallet plus USDC skeleton; deploy a hello-world to Vercel so the pipeline works end to end.

- Build the eval harness scaffold and assemble the 30 to 50 source articles.

Days 3 to 5: Core agent and markets

- Build the agent pipeline (Module 1) with structured output and Langfuse tracing.

- Run the eval harness; iterate prompts until average quality clears 70 percent.

- Build the Polymarket v2 client with builder code (Module 3) and post your first real test market.

- Wire IPFS pinning (Module 9).

Days 6 to 7: Settlement and onboarding

- Modular Wallet passkey onboarding (Module 4).

- Gateway Nanopayments for inference (Module 5) with the on-screen cost readout.

- CCTP sweep (Module 6), AttributionEscrow on Arc (Module 10), USYC float (Module 7), EURC routing (Module 8).

- Deploy the full product to a public Vercel link by end of Day 7.

Days 8 to 11: Traction

- Publish the MEXC blog post in three languages (you write, Claude translates, a native speaker spot-checks).

- Post the crypto Twitter thread: live link, a screenshot of the agent posting a real non-English market, and the GIF of the sub-cent Nanopayment fee. Tag Canteen, Circle, and the judges.

- Drop localized examples in 5 Nigerian, 3 South African, and 3 Kenyan crypto Telegram groups.

- Submit to Show HN, r/PredictionMarkets, and r/algotrading with the translation framing.

- Cold-DM 20 prediction-market voices on X with the live link.

Days 12 to 13: Polish and round two

- Record the 3-minute video: open with the live product and a real trade in the first 10 seconds, never with installation.

- Write the README: GIF first, then what-this-does in three sentences, then an architecture diagram, then a Dune-style or block-explorer chart showing real volume.

- Write up your Circle developer feedback in detail (the \$500 feedback prize is low-effort and real).

- Run a second traction push; if volume is under \$500, post a capped match promo in the African communities (match first bets up to \$20, total exposure capped near \$400).

Day 14: Submit

- Submit early. Include the live link, the public repo, the video, an honest user count, and a traction screenshot from the Arc block explorer or a Dune chart.

2.19 Risk mitigations and pivot triggers

| **Risk**                              | **Trigger**                     | **Action**                                                                                                                       |
|---------------------------------------|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| Translation quality too low           | Eval average under 70% by Day 5 | Narrow to two languages you can verify, or pivot to AgentFee (builder-code-as-a-service), which has zero translation risk        |
| No external users                     | Zero non-Joseph users by Day 7  | Fall back to RugMarket (meme-driven rugpull markets), which spreads without translation                                          |
| Volume too thin                       | Under \$500 notional by Day 10  | Capped match promo in African communities; lean harder on MEXC distribution                                                      |
| Arc testnet instability               | RPC or contract flakiness       | Demo on testnet explicitly; state it in the video so judges do not penalize; keep settlement logic chain-agnostic where possible |
| Polymarket moderation rejects markets | Markets bounced for ambiguity   | Tighten resolution-rule prompt; require an authoritative source URL before posting                                               |
| Olas Polystrat comparison             | Judges note prior art           | Differentiate explicitly on non-English markets; never try to out-trade Polystrat on US politics or sports                       |

2.20 Submission checklist

- Public GitHub repo, README opens with a GIF and a 3-sentence description, clean architecture diagram, real-volume chart.

- 3-minute video, live product in the first 10 seconds, a real non-English market being created and traded.

- Live deployed Vercel link a judge can use hands-on.

- Honest traction numbers: onboarded users, markets created, notional volume, week-2 returns.

- package.json visibly contains the Circle SDKs and the Polymarket v2 client (the 20% Circle-usage grep test).

- A written Circle developer-feedback note (separate \$500 prize).

- README vocabulary echoes the Canteen prediction-market-stack essay.

Appendix A: The Master Claude Code Prompt

Paste the block below as your first message to Claude Code in a fresh, empty project directory, after you have run the ARC-cli context sync. It establishes the mission, the constraints (including your no-em-dash rule), the architecture, and a phased plan, then tells Claude Code to confirm the plan before writing code. It is deliberately long because a strong upfront brief is what lets you delegate the whole build.

You are my senior engineering partner building a hackathon-winning product called Babel Markets for the Agora Agents Hackathon (Canteen x Circle x Arc). We are targeting the \$10,000 first prize. I am a solo developer and you are doing the heavy lifting. Read this entire brief, then produce a confirmed plan before writing any code.

STYLE RULE (non-negotiable): never use em dashes anywhere, in code, comments, prose, UI copy, commit messages, or docs. Use hyphens or rephrase. This applies to everything you generate.

PRODUCT IN ONE SENTENCE:

Babel Markets lets a user paste a non-English news article; an AI agent translates it and reformulates it into a well-formed binary prediction question with an explicit resolution rule; the question is posted to Polymarket V2 with my builder code attached; whoever originated the question earns a share of the USDC builder fee on every fill; the float parks in USYC for yield; agent inference is paid with Gateway Nanopayments; builder fees are routed to Arc with CCTP; EU events price in EURC and US events in USDC; and every question\'s reasoning trace is pinned to IPFS.

WHY THIS WINS (keep these in mind for every tradeoff):

\- Agentic Sophistication is 30% of the score: build the agent as a visible multi-step loop, not one prompt.

\- Traction is 30%: minimize onboarding friction (passkey wallets), make creator earnings visible to drive return visits.

\- Circle tool usage is 20%: use Modular Wallets, Gateway Nanopayments, CCTP, USYC, and EURC, all non-trivially. Judges will grep package.json.

\- Innovation is 20%: this builds on the hosts\' published \'translation as alpha\' research angle.

TECH STACK (use exactly this unless you find a hard blocker):

Next.js 15 App Router, TypeScript, Vercel AI SDK 6, Claude Sonnet 4.6 with prompt caching, Postgres with pgvector, Upstash Redis, viem, Langfuse, Polymarket CLOB v2 client plus Gamma API, Circle Modular Wallets (passkey), Circle Gateway Nanopayments (x402 v2), CCTP, USYC Teller, EURC, IPFS via Irys. Fork circlefin/arc-multichain-wallet and circlefin/arc-p2p-payments for the Circle wallet plumbing. Deploy to Vercel.

CRITICAL ACCURACY RULE:

The Circle and Polymarket SDKs change often. Before writing any integration code for Circle (Modular Wallets, Nanopayments, CCTP, USYC) or Polymarket (CLOB v2, builder codes), read the live docs that the ARC-cli context sync loaded, plus the official docs at developers.circle.com, docs.arc.network, and docs.polymarket.com. Do not invent method names, package versions, or contract addresses from memory. If you are unsure of an exact signature, fetch and confirm it first, and tell me what you confirmed.

ARCHITECTURE (five layers):

1\. Ingestion: accept pasted text or RSS, detect source language.

2\. Agent core: translate, assess tradability, synthesize question, self-critique against a rubric, dedup via pgvector, decide to post.

3\. Market layer: post to Polymarket V2 with my builder code, poll fills, compute builder fees.

4\. Settlement layer: Modular Wallets, Nanopayments for inference, CCTP sweep Polygon to Arc, USYC float, EURC routing, AttributionEscrow on Arc with Paymaster.

5\. Persistence and proof: Postgres plus pgvector, Upstash Redis, IPFS pinning of reasoning traces.

THE AGENT LOOP (this is the core of the score, build it as discrete observable steps, each with Zod-structured output, each traced to Langfuse): detect language and clean text; translate preserving entities, dates, numbers; assess newsworthiness and binary tradability (reject with reason if not tradable); synthesize a question with resolution_rule, resolution_source URL, expiry, category, currency (USDC or EURC), suggested_probability; self-critique against a quality rubric and revise once if below threshold; embed and dedup against existing markets; decide post or hold with a one-line rationale.

QUALITY EVAL HARNESS (build this in phase 1, not last): a script that runs 30 to 50 fixed source articles through the pipeline and scores each question on resolvability, source quality, timeliness, faithfulness, and translation fidelity, logging to Langfuse. Gate progress on average quality clearing 70%.

COMPLIANCE GUARDRAILS (implement, do not skip): geo-gate US persons out of trading (Polymarket restriction); treat USYC as non-US-only and demonstrate on testnet only, do not park real user funds; surface a clear terms and risk notice in onboarding.

REPO LAYOUT: use the structure I will accept in your plan (app/, lib/agent, lib/polymarket, lib/circle, lib/chain, lib/proof, lib/db, contracts/, scripts/). Single Next.js monorepo.

PHASED PLAN I WANT YOU TO EXECUTE (confirm before starting):

Phase 1: scaffold the repo, fork and strip the Circle wallet skeleton, set up DB schema, Redis, Langfuse, env template, deploy a hello-world to Vercel, and build the eval harness scaffold.

Phase 2: the agent pipeline with structured output and tracing; iterate against the eval harness until quality clears 70%.

Phase 3: Polymarket V2 client with builder code, market posting, fills poller, IPFS pinning.

Phase 4: Modular Wallet passkey onboarding; Gateway Nanopayments for inference with an on-screen per-question cost readout.

Phase 5: CCTP sweep, AttributionEscrow on Arc with Paymaster, USYC float, EURC routing.

Phase 6: the three frontend pages (landing with streaming agent steps as the hero, market view with provenance link, creator earnings dashboard); polish for the demo.

WORKING STYLE:

\- After each phase, stop, show me what works, and wait for my go-ahead.

\- Keep a running TODO and a SETUP.md of every account, key, and env var I need.

\- Write a .env.example as you go; never hardcode secrets.

\- Prefer small, testable commits with clear messages (no em dashes).

\- When a Circle or Polymarket API is ambiguous, fetch the live doc and quote the exact signature you used.

\- Optimize the landing page for a 3-minute demo video: the streaming agent steps and the sub-cent Nanopayment fee must be visually obvious.

FIRST RESPONSE I WANT FROM YOU:

Do not write code yet. Confirm you understand the brief, list any assumptions, surface the top 5 technical risks with mitigations, propose the exact dependency list with versions you will verify, and give me the Phase 1 task breakdown. Then ask me for the go-ahead.

Appendix B: Environment variable reference

A starting .env.example. Confirm exact names against each SDK\'s live docs as you wire them up.

\# Model

ANTHROPIC_API_KEY=

\# Observability

LANGFUSE_PUBLIC_KEY=

LANGFUSE_SECRET_KEY=

LANGFUSE_HOST=

\# Database + cache

DATABASE_URL=

UPSTASH_REDIS_REST_URL=

UPSTASH_REDIS_REST_TOKEN=

\# Circle

CIRCLE_API_KEY=

CIRCLE_ENTITY_SECRET=

CIRCLE_MODULAR_WALLET_RPC=

\# Chains

ARC_RPC_URL=

POLYGON_RPC_URL=

DEPLOYER_PRIVATE_KEY=

ATTRIBUTION_ESCROW_ADDRESS=

\# Polymarket

POLYMARKET_API_HOST=

POLYMARKET_BUILDER_CODE=

POLYMARKET_SIGNER_KEY=

\# Proof

IRYS_PRIVATE_KEY=

Appendix C: Key links and references

Bookmark these. The first one is the answer key.

- Canteen Agora hackathon page: <https://agora.thecanteenapp.com/>

- Canteen ARC CLI: <https://github.com/the-canteen-dev/ARC-cli>

- Arc developer docs: <https://docs.arc.network>

- Circle developer docs: <https://developers.circle.com>

- Circle USYC subscribe/redeem: <https://developers.circle.com/tokenized/usyc/subscribe-and-redeem>

- Circle Nanopayments docs: <https://developers.circle.com/gateway/nanopayments>

- Polymarket builders program: <https://builders.polymarket.com/>

- Polymarket V2 migration docs: <https://docs.polymarket.com/v2-migration>

- Polymarket Agents framework (reference): <https://github.com/Polymarket/agents>

- Circle arc-multichain-wallet (fork): <https://github.com/circlefin/arc-multichain-wallet>

- Circle arc-p2p-payments (fork): <https://github.com/circlefin/arc-p2p-payments>

- TauricResearch TradingAgents (reference): <https://github.com/TauricResearch/TradingAgents>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Final word</strong></p>
<p>Babel Markets wins because it is the rare hackathon project where the technology and the distribution point in the same direction. The agent loop earns the sophistication points, the Circle primitives earn the integration points, the translation angle earns the innovation points, and your African and MEXC reach earns the traction points that almost no other entrant can match. Ship the loop first, get real users second, and let the README speak the judges' own language.</p></td>
</tr>
</tbody>
</table>
