"use client";

// Claim accrued USDC from AttributionEscrow via the user's passkey-backed
// Modular Smart Account. Each click re-prompts the passkey (Login mode), then
// fires a paymaster-sponsored userOp so the user pays zero gas.
//
// Bundler + fee policy come from lib/circle/bundler.ts (shared with future
// Modular-Wallet flows). The contract address comes from the server via the
// /api/escrow/claim GET; we only render the button when an address is present.

import { useState } from "react";
import { toast } from "sonner";
import { toWebAuthnAccount } from "viem/account-abstraction";
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toPasskeyTransport,
  toWebAuthnCredential,
} from "@circle-fin/modular-wallets-core";
import { createBabelBundlerClient, getArcPublicClientForBundler } from "@/lib/circle/bundler";
import type { Address, Hex } from "viem";

interface Props {
  escrowAddress: Address | null;
  accruedUsdc: string;
  username: string;
  walletAddress: Address | null;
}

export function ClaimButton({
  escrowAddress,
  accruedUsdc,
  username,
  walletAddress,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const numericAccrued = Number(accruedUsdc);
  const hasBalance = Number.isFinite(numericAccrued) && numericAccrued > 0;
  const escrowReady = Boolean(escrowAddress);
  const disabled = busy || !escrowReady || !hasBalance || !walletAddress;
  const disabledReason = !escrowReady
    ? "Deploy AttributionEscrow first"
    : !walletAddress
      ? "Set up your passkey wallet"
      : !hasBalance
        ? "Nothing to claim yet"
        : null;

  async function onClaim() {
    if (!escrowAddress || !walletAddress) return;
    const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL;
    const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY;
    if (!clientUrl || !clientKey) {
      toast.error("Circle Modular Wallets env not configured.");
      return;
    }
    setBusy(true);
    setTxHash(null);
    try {
      const passkeyTransport = toPasskeyTransport(clientUrl, clientKey);
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
        username,
      });

      const publicClient = getArcPublicClientForBundler();
      const owner = toWebAuthnAccount({ credential });
      const account = await toCircleSmartAccount({
        client: publicClient,
        owner,
      });

      if (account.address.toLowerCase() !== walletAddress.toLowerCase()) {
        toast.error(
          "Passkey credential does not match this wallet. Sign in with the original passkey.",
        );
        setBusy(false);
        return;
      }

      const bundler = createBabelBundlerClient(account);

      const { encodeFunctionData } = await import("viem");
      const ESCROW_CLAIM_ABI = [
        {
          type: "function",
          name: "claim",
          stateMutability: "nonpayable",
          inputs: [],
          outputs: [],
        },
      ] as const;

      const userOpHash = await bundler.sendUserOperation({
        calls: [
          {
            to: escrowAddress,
            data: encodeFunctionData({
              abi: ESCROW_CLAIM_ABI,
              functionName: "claim",
              args: [],
            }),
          },
        ],
        paymaster: true,
      });

      const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
      const onchainHash = receipt.receipt.transactionHash as Hex;
      setTxHash(onchainHash);

      // Record the payout server-side so the history table renders it.
      await fetch("/api/escrow/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountUsdc: accruedUsdc,
          arcTx: onchainHash,
        }),
      });

      toast.success(`Claimed $${Number(accruedUsdc).toFixed(4)} USDC`, {
        description: onchainHash.slice(0, 18) + "...",
        action: {
          label: "ArcScan",
          onClick: () =>
            window.open(`https://testnet.arcscan.app/tx/${onchainHash}`, "_blank"),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Claim failed";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button
        type="button"
        className="brand-pill"
        onClick={onClaim}
        disabled={disabled}
      >
        {busy ? "Claiming..." : `Claim $${Number(accruedUsdc || "0").toFixed(4)}`} <span>→</span>
      </button>
      {disabledReason && !busy && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          {disabledReason}
        </p>
      )}
      {txHash && !busy && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 11,
            letterSpacing: "0.04em",
            opacity: 0.85,
          }}
        >
          Claimed:{" "}
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--pompeii)", textDecoration: "underline" }}
          >
            {txHash.slice(0, 10)}...
          </a>
        </p>
      )}
    </div>
  );
}
