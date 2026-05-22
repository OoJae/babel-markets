// Deploy contracts/build/AttributionEscrow.json to Arc testnet from the agent
// EOA (AGENT_EOA_PRIVATE_KEY). Run compile-escrow.ts first.
//
// Usage: `npx tsx scripts/deploy-escrow.ts`

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_CONTRACTS } from "../lib/chain/arc";

const ARTIFACT = join(process.cwd(), "contracts", "build", "AttributionEscrow.json");

async function main() {
  if (!existsSync(ARTIFACT)) {
    console.error(`Artifact not found: ${ARTIFACT}. Run scripts/compile-escrow.ts first.`);
    process.exit(1);
  }
  const key = process.env.AGENT_EOA_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    console.error("AGENT_EOA_PRIVATE_KEY missing or invalid in .env.local.");
    process.exit(1);
  }

  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf-8")) as {
    abi: Abi;
    bytecode: Hex;
  };

  const account = privateKeyToAccount(key as Hex);
  const rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

  console.log(`Deployer: ${account.address}`);
  console.log(`USDC constructor arg: ${ARC_CONTRACTS.USDC}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer native balance (wei): ${balance.toString()}`);
  if (balance === 0n) {
    console.warn(
      "Deployer balance is 0. Arc uses USDC as native gas; fund the EOA before retrying.",
    );
  }

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [ARC_CONTRACTS.USDC as Hex],
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    console.error("Receipt has no contractAddress. Deploy may have reverted.");
    console.error(receipt);
    process.exit(1);
  }
  console.log(`\nAttributionEscrow deployed at: ${receipt.contractAddress}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`ArcScan: https://testnet.arcscan.app/address/${receipt.contractAddress}`);
  console.log(`\nAdd this to .env.local and Vercel:`);
  console.log(`ATTRIBUTION_ESCROW_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
