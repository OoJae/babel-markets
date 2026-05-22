// One-time: compile contracts/AttributionEscrow.sol via the solc CLI and write
// contracts/build/AttributionEscrow.json so deploy-escrow.ts (and the runtime
// viem ABI loader) can read it.
//
// Prerequisites: solc 0.8.24+ on PATH (`brew install solidity` on macOS).
//
// Usage: `npx tsx scripts/compile-escrow.ts`

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const SRC = join(process.cwd(), "contracts", "AttributionEscrow.sol");
const OUT_DIR = join(process.cwd(), "contracts", "build");
const OUT = join(OUT_DIR, "AttributionEscrow.json");

function main() {
  if (!existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }
  try {
    execFileSync("solc", ["--version"], { stdio: "ignore" });
  } catch {
    console.error(
      "solc not found on PATH. Install with `brew install solidity` or see contracts/README.md.",
    );
    process.exit(1);
  }

  const source = readFileSync(SRC, "utf-8");

  // Use the standard-JSON input. That's the only solc mode that returns ABI and
  // bytecode together as machine-readable JSON, and it works with any solc 0.8.x.
  const input = {
    language: "Solidity",
    sources: {
      "AttributionEscrow.sol": { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const stdin = JSON.stringify(input);
  const stdoutBuf = execFileSync("solc", ["--standard-json"], { input: stdin });
  const parsed = JSON.parse(stdoutBuf.toString("utf-8"));

  if (parsed.errors) {
    const fatal = parsed.errors.filter((e: { severity: string }) => e.severity === "error");
    if (fatal.length > 0) {
      console.error("solc errors:\n" + fatal.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n"));
      process.exit(1);
    }
    for (const w of parsed.errors) {
      console.warn(w.formattedMessage);
    }
  }

  const contract = parsed.contracts?.["AttributionEscrow.sol"]?.AttributionEscrow;
  if (!contract) {
    console.error("AttributionEscrow not found in solc output");
    process.exit(1);
  }

  const abi = contract.abi;
  const bytecode = `0x${contract.evm.bytecode.object}`;

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }
  writeFileSync(
    OUT,
    JSON.stringify({ abi, bytecode, compiledAt: new Date().toISOString() }, null, 2),
  );

  const sizeKb = (bytecode.length / 2 / 1024).toFixed(2);
  console.log(`Wrote ${OUT} (bytecode ${sizeKb} KiB, ${abi.length} ABI entries)`);
  void dirname;
}

main();
