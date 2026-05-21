# Scripts

- `run-eval.ts` - Runs the agent pipeline against `eval/fixtures/*.md`, scores each output against the 5-axis Babel rubric, logs per-fixture traces to Langfuse, and writes a JSON summary to `eval/output/<timestamp>.json`. Invoke with `npm run eval`.

Phase 3+ will add:

- `poll-fills.ts` - Polls Polymarket fills against our markets on a cron, computes builder fees, writes `fills` and `attributions` rows.
- `payout.ts` - Weekly cron target: sums attributions, sweeps Polygon to Arc via CCTP, redeems USYC float, pays out to creators via AttributionEscrow.
- `seed.ts` - Loads a small set of demo questions for screenshot purposes.
- `deploy-escrow.ts` - Deploys `AttributionEscrow.sol` to Arc testnet via Circle Smart Contract Platform.
