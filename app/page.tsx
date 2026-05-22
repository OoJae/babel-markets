import Link from "next/link";
import { PasteBox } from "@/components/paste-box";
import { ComplianceBanner } from "@/components/compliance-banner";
import { getAgentAddress } from "@/lib/circle/nanopay";
import { getPublicEscrowAddress } from "@/lib/chain/escrow";

function shortAddress(addr?: string | null): string | null {
  if (!addr) return null;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function LandingPage() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ??
    "local";
  const agentAddress = getAgentAddress();
  const escrowAddress = getPublicEscrowAddress();
  const nanopaymentsEnabled = process.env.BABEL_NANOPAYMENTS_ENABLED === "1";
  const cctpEnabled = process.env.BABEL_CCTP_ENABLED === "1";

  return (
    <main className="min-h-screen">
      <ComplianceBanner />
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold">babel/markets</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Polymarket in every language
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/sign-in" className="hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Polymarket in every language.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Paste a non-English news article. An agent translates it, judges
              tradability, synthesizes a binary question with a resolution rule, and
              posts it to Polymarket with your builder code attached. You earn a share
              of the USDC fee every time someone trades it.
            </p>
            <p className="max-w-2xl text-sm font-medium">
              Tested on Arc testnet. 0.001 USDC per agent step. Real Circle Gateway
              settlements on every paste.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5">
                Circle Modular Wallets
              </span>
              <span className="rounded-full border px-2 py-0.5">
                Gateway Nanopayments
              </span>
              <span className="rounded-full border px-2 py-0.5">CCTP</span>
              <span className="rounded-full border px-2 py-0.5">USYC float</span>
              <span className="rounded-full border px-2 py-0.5">EURC FX-aware</span>
              <span className="rounded-full border px-2 py-0.5">IPFS provenance</span>
              <span className="rounded-full border px-2 py-0.5">Arc testnet</span>
            </div>
          </div>

          <PasteBox />

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">How it works. </strong>
              The agent runs as a multi-step loop: detect language, translate while
              preserving entities and dates, assess tradability, synthesize a question,
              self-critique against a 5-axis rubric, dedup via pgvector, and decide
              whether to post. Every step is traced to Langfuse; the full reasoning is
              pinned to IPFS so anyone can audit provenance.
            </p>
            <p>
              <strong className="text-foreground">Live status. </strong>
              The agent loop runs on mimo-v2.5-pro through an Anthropic-compatible
              gateway and Voyage AI for embeddings. Each step is gated behind a Circle
              Gateway Nanopayment paid by the agent EOA on Arc testnet, so the per-step
              USDC receipts on this page are real testnet settlements. Synthesized
              questions are matched to live Polymarket markets, and the full reasoning
              trace is pinned to IPFS for provenance.
            </p>

            <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-xs sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Build </span>
                <span className="font-mono text-foreground">{commit}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Nanopayments{" "}
                </span>
                <span
                  className={
                    nanopaymentsEnabled ? "text-green-600" : "text-muted-foreground"
                  }
                >
                  {nanopaymentsEnabled ? "live" : "off"}
                </span>
                {" / "}
                <span className="text-muted-foreground">CCTP </span>
                <span
                  className={
                    cctpEnabled ? "text-green-600" : "text-muted-foreground"
                  }
                >
                  {cctpEnabled ? "live" : "mock"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Agent EOA </span>
                {agentAddress ? (
                  <a
                    className="font-mono underline"
                    href={`https://testnet.arcscan.app/address/${agentAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(agentAddress)}
                  </a>
                ) : (
                  <span className="font-mono">unconfigured</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">AttributionEscrow </span>
                {escrowAddress ? (
                  <a
                    className="font-mono underline"
                    href={`https://testnet.arcscan.app/address/${escrowAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(escrowAddress)}
                  </a>
                ) : (
                  <span className="font-mono">not deployed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted-foreground">
          Built for the Agora Agents Hackathon (Canteen x Circle x Arc). Testnet only.
          Not for US persons. See compliance banner.
        </div>
      </footer>
    </main>
  );
}
