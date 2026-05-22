# Smart contracts

This directory holds the Solidity sources Babel deploys to Arc testnet.

## AttributionEscrow.sol

Phase 5 deliverable. Holds swept USDC, records each creator's accrued balance, and releases payouts on a weekly cadence. Takes a 20 percent platform fee.

### Compile

Requires `solc` 0.8.24 or higher on PATH.

```bash
brew install solidity      # macOS
npx tsx scripts/compile-escrow.ts
```

This writes `contracts/build/AttributionEscrow.json` containing the ABI and bytecode. The build directory is gitignored; recompile when the source changes.

### Deploy

Requires `AGENT_EOA_PRIVATE_KEY` in `.env.local`, funded with native gas on Arc testnet (USDC is the gas token on Arc).

```bash
npx tsx scripts/deploy-escrow.ts
```

Prints the deployed address and a copy-pasteable `ATTRIBUTION_ESCROW_ADDRESS=0x...` line. Add that to `.env.local` and your Vercel environment.

### Verify

Open the address on [testnet.arcscan.app](https://testnet.arcscan.app) and confirm the contract is present. The agent pipeline calls `registerQuestion` on every new ready question and the fills cron calls `creditFees` on every observed builder-fee fill (live mode only).

### Notes

- Constructor arg is the USDC token address on Arc (`0x3600000000000000000000000000000000000000`). It is read from `lib/chain/arc.ts` so this stays a single source of truth.
- The platform fee (20%) and the weekly payout cadence are hardcoded in the contract; changing either requires a redeploy plus an `ATTRIBUTION_ESCROW_ADDRESS` rotation.
- Arc's Paymaster v0.8 lets users `claim()` without holding native gas. Phase 6 wires the dashboard "Claim USDC" button into the user's Modular Wallet signer.
