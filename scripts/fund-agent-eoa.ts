// One-time helper: deposit testnet USDC into the Circle Gateway Wallet for the
// agent EOA on Arc testnet.
//
// Prerequisites:
//   1. AGENT_EOA_PRIVATE_KEY in .env.local
//   2. Some testnet USDC in the agent EOA's wallet (claim from https://faucet.circle.com)
//   3. A small amount of Arc testnet gas in the same wallet for the deposit tx
//
// Usage: `npx tsx scripts/fund-agent-eoa.ts [amount]`
//   amount defaults to "1" USDC if not provided.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

async function main() {
  // Force-enable so the singleton initializes even if BABEL_NANOPAYMENTS_ENABLED=0 in .env.
  process.env.BABEL_NANOPAYMENTS_ENABLED = "1";

  const amount = process.argv[2] || "1";
  console.log(`Funding agent EOA Gateway Wallet on Arc testnet with ${amount} USDC...`);

  const { depositInitialBalance, getAgentAddress, getUnifiedBalance } = await import(
    "../lib/circle/nanopay"
  );

  const address = getAgentAddress();
  if (!address) {
    console.error("AGENT_EOA_PRIVATE_KEY missing or invalid.");
    process.exit(1);
  }
  console.log(`Agent EOA address: ${address}`);

  const balancesBefore = await getUnifiedBalance();
  console.log("Balances before:", balancesBefore);

  try {
    const receipt = await depositInitialBalance(amount);
    console.log("Deposit receipt:", JSON.stringify(receipt, null, 2));
  } catch (e) {
    console.error("Deposit failed:", e instanceof Error ? e.message : e);
    console.error(
      "Common causes: insufficient USDC balance on the wallet, no gas for the deposit tx, or the agent EOA has not yet been funded from faucet.circle.com.",
    );
    process.exit(1);
  }

  const balancesAfter = await getUnifiedBalance();
  console.log("Balances after:", balancesAfter);
  console.log("Done. Set BABEL_NANOPAYMENTS_ENABLED=1 and start the agent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
