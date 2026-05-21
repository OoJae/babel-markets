n# Babel Markets, setup guide

A fresh clone should be running locally in under 30 minutes. Time yourself; if it takes longer, that is a bug in this doc and you should file it.

## Prereqs

- Node 20+ (`.nvmrc` pins to 20)
- npm 10+
- A modern browser with WebAuthn support for passkey enrollment (Chrome, Safari, Firefox latest)
- Supabase CLI: `brew install supabase/tap/supabase`
- A funded EVM wallet on Polygon Amoy with a tiny bit of MATIC for Irys uploads (later)

## 1. Clone and install

```
cp .env.example .env.local
npm install
```

## 2. Accounts and keys (Joseph's Day-0 list)

Do these in parallel. Several have approval latency.

### 2.1 Canteen + Arc

- Join the Canteen Discord: <https://discord.gg/TGnyfKh23V>
- Join the Arc builder Discord: <https://discord.com/invite/buildonarc>, mention Canteen + Agora during onboarding
- ARC-cli already installed and synced at `~/.arc-canteen/context/` (verified 2026-05-21)

### 2.2 Circle Developer Console

1. Sign up at <https://console.circle.com>
2. Settings -> API Keys -> "Create API Key"
3. Copy `CIRCLE_API_KEY` -> `.env.local`
4. Settings -> Entity Secret -> generate, paste into `CIRCLE_ENTITY_SECRET`
5. Modular Wallets -> Domain registration -> add `localhost` and your Vercel domain (later)
6. Modular Wallets -> Client URL is already in `.env.example` as `https://modular-sdk.circle.com/v1/rpc/w3s/buidl`
7. Modular Wallets -> Client Key -> copy into `NEXT_PUBLIC_CIRCLE_CLIENT_KEY`

### 2.3 Arc testnet faucet

1. Visit the Arc developer docs and find the faucet link: <https://docs.arc.network>
2. Claim Arc testnet USDC to your dev EOA
3. Confirm `viem` can read a block: `curl -X POST https://rpc.testnet.arc.network -H 'content-type: application/json' --data '{"jsonrpc":"2.0","method":"eth_chainId","id":1}'` should return `"0x4cef52"`

### 2.4 Polymarket builder profile

1. Visit <https://builders.polymarket.com/>
2. Connect your Polygon wallet, fill the builder profile
3. **Day 1 email to** `builder@polymarket.com` with a one-paragraph Babel pitch and a verified-tier request. Sample text:

```
Subject: Verified Tier Request: Babel Markets (non-English news -> binary markets)

Hi Polymarket team,

I'm building Babel Markets for the Agora Agents Hackathon (Canteen x Circle x Arc).
The product translates non-English news articles, synthesizes well-formed binary
questions with explicit resolution rules, and posts them to Polymarket V2 with my
builder code attached. Target audiences: Nigerian, South African, Kenyan, and
LATAM crypto communities for whom English-only prediction markets are not legible.

I am requesting verified-tier access so I can post markets directly rather than
only routing trades on existing markets. Repo and live deploy at the links below
once the scaffold is up.

Thanks,
Joseph (Oluwademilade Olamiye)
GitHub: OoJae
```

4. Once approved, copy `POLYMARKET_BUILDER_CODE` into `.env.local`

### 2.5 Supabase

1. Sign up at <https://app.supabase.com>, create a new project "babel-markets"
2. Settings -> API:
   - URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - anon key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key -> `SUPABASE_SERVICE_ROLE_KEY`
3. Database -> Extensions -> enable `vector` (required for pgvector)
4. From the project root run the local Supabase CLI link + push:

```
supabase login
supabase link --project-ref <your-ref>
supabase db push
```

Confirm 7 Babel tables exist in the Supabase Studio: `profiles`, `wallets`, `submissions`, `questions`, `traces`, `fills`, `attributions`, `payouts`.

### 2.6 Upstash Redis

1. Sign up at <https://console.upstash.com>
2. Create a Redis database (Regional, closest to your Vercel region)
3. REST API -> copy URL and Token into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 2.7 Langfuse

1. Sign up at <https://cloud.langfuse.com>
2. Create a project "babel-markets"
3. Settings -> API Keys -> copy public and secret keys
4. `.env.local`: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST=https://cloud.langfuse.com`

### 2.8 Anthropic

1. Sign up at <https://console.anthropic.com> (separate from your Claude Code account)
2. Settings -> API Keys -> create a key dedicated to Babel deployment
3. `ANTHROPIC_API_KEY` -> `.env.local`

### 2.9 Irys (IPFS pinning)

1. Generate a fresh EVM wallet: `openssl rand -hex 32` -> use as `IRYS_PRIVATE_KEY`
2. Fund that wallet on Polygon mainnet (or use Irys testnet) with a tiny amount of MATIC, $1 is enough for the demo
3. See <https://docs.irys.xyz> for the current funded-balance check

### 2.10 Polygon testnet RPC

1. Sign up at <https://www.alchemy.com> (or QuickNode, or use the public Amoy RPC)
2. Create an app on Polygon Amoy testnet -> copy RPC URL into `POLYGON_RPC_URL`

### 2.11 Agent EOA

The agent runs server-side under a single shared EOA that pays Gateway Nanopayments and initiates CCTP sweeps. **It is NOT the same as your Polymarket signer** and it is NOT a Modular Wallet (Gateway requires EOA, not EIP-1271).

1. Generate: `openssl rand -hex 32` -> `AGENT_EOA_PRIVATE_KEY`
2. Fund with testnet USDC on Polygon Amoy (faucet via Circle Console)
3. Fund with a tiny amount of MATIC for the initial Gateway deposit gas

## 3. Local dev loop

```
npm run dev
```

Then open <http://localhost:3000>. You should see the landing page with the paste box. Paste a sample (the Yoruba example is one click) and confirm the placeholder pipeline returns a stub question.

## 4. Eval harness

```
npm run eval
```

Phase 1 ships 12 multilingual fixtures and the placeholder pipeline, so scores will be low (around 0.5). Phase 2 will swap in the real agent, and the gate flips to require >= 0.70 average.

Add more fixtures under `eval/fixtures/<num>-<lang>-<slug>.md` before Phase 2. See `eval/README.md`.

## 5. Type and lint

```
npm run typecheck
```

Should pass cleanly. If it doesn't, that is a real bug.

## 6. Deploy to Vercel (when ready)

1. `vercel link` from the repo root
2. Add every variable from `.env.local` to Vercel project settings (Production, Preview, Development)
3. `vercel deploy --prod`
4. Test the deployed health endpoint: `curl https://your-domain/api/health`

## 7. Recovery notes

- **Lost Circle Entity Secret**: rotate from the Console; you will need to redeploy every wallet that used the old secret.
- **Supabase migration drift**: `supabase db diff -f local_drift` then commit the diff as a new timestamped migration.
- **Langfuse trace not landing**: check `LANGFUSE_HOST` is `https://cloud.langfuse.com` (no trailing slash) and that the public/secret keys are not swapped.
- **Passkey enrollment fails**: confirm the domain is registered in Circle Console under Modular Wallets -> Domain registration. Localhost requires a separate entry.

## 8. What I still owe Joseph

Open items to track outside this file:

- Polymarket V2 SDK package name and exact builder-code field. Confirm against `docs.polymarket.com/v2-migration` in Phase 3.
- USYC Teller subscribe / redeem method signatures. Not in synced ARC-cli context. Confirm against `developers.circle.com/tokenized/usyc/subscribe-and-redeem` in Phase 5.
- AttributionEscrow deploy script for Arc testnet. Phase 5.
