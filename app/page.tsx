import Link from "next/link";
import { PasteBox } from "@/components/paste-box";
import { ComplianceBanner } from "@/components/compliance-banner";

export default function LandingPage() {
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

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">How it works. </strong>
              The agent runs as a multi-step loop: detect language, translate while
              preserving entities and dates, assess tradability, synthesize a question,
              self-critique against a 5-axis rubric, dedup via pgvector, and decide
              whether to post. Every step is traced to Langfuse; the full reasoning is
              pinned to IPFS so anyone can audit provenance.
            </p>
            <p>
              <strong className="text-foreground">Phase 1 status. </strong>
              The scaffold is live and the agent loop is a deterministic placeholder.
              The real Claude Sonnet 4.6 pipeline lands in Phase 2.
            </p>
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
