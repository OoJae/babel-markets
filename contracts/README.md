# Smart contracts

This directory holds the Solidity sources Babel deploys to Arc testnet.

## AttributionEscrow.sol

Phase 5 deliverable. Holds swept USDC, records each creator's accrued balance, and releases payouts on a weekly cadence. Takes a 20 percent platform fee.

### Deploy

Phase 5 wires up Foundry or Hardhat. The current Sol file is a working draft; before deploy:

1. Confirm Arc testnet USDC address matches `ARC_CONTRACTS.USDC` in `lib/chain/arc.ts`.
2. Wire to Circle's Smart Contract Platform via `@circle-fin/smart-contract-platform` for templated deploy + monitoring.
3. Use Arc's Paymaster v0.8 so creators never need a gas token to claim.

### Verify

After deploy, write the deployed address to `ATTRIBUTION_ESCROW_ADDRESS` in `.env.local` and Vercel.
