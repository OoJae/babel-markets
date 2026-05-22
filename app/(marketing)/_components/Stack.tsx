// Section 05: The stack. Eight rows of Circle + Arc primitives.

interface StackEntry {
  num: string;
  name: string;
  desc: string;
  role: string;
}

const STACK: StackEntry[] = [
  {
    num: "▷ 01",
    name: "Modular Wallets",
    desc: "Passkey onboarding for non-crypto-native users. Face ID, fingerprint, zero seed phrase. The single biggest lever on traction.",
    role: "Circle . Onboarding",
  },
  {
    num: "▷ 02",
    name: "Nanopayments",
    desc: "Sub-cent USDC micropayments for agent inference. The agent literally pays for its own cognition, batched on-chain. x402 v2 compatible.",
    role: "Circle . x402 v2",
  },
  {
    num: "▷ 03",
    name: "Polymarket V2",
    desc: "Builder code embedded in every signed EIP-712 order. No custody, no token, just on-chain attribution of every fill back to the translator.",
    role: "CLOB v2 . Gamma",
  },
  {
    num: "▷ 04",
    name: "CCTP",
    desc: "Native burn-and-mint sweep of accumulated builder fees from Polygon to Arc. No wrapped USDC, no bridge risk, weekly batch.",
    role: "Circle . Cross-chain",
  },
  {
    num: "▷ 05",
    name: "USYC",
    desc: "Pending creator payouts park in a tokenized money-market fund between sweeps. Yield on float, demonstrated on testnet for compliance.",
    role: "Circle . Yield",
  },
  {
    num: "▷ 06",
    name: "EURC",
    desc: "EU events priced and settled in euro stablecoin. The agent decides the currency from the article's geography. FX-aware by default.",
    role: "Circle . FX",
  },
  {
    num: "▷ 07",
    name: "Arc + Paymaster",
    desc: "Sub-second finality, around $0.01 USDC fees. Weekly micro-payouts to dozens of creators stay economical. Users never touch a gas token.",
    role: "Arc . Settlement",
  },
  {
    num: "▷ 08",
    name: "IPFS . Irys",
    desc: "Every reasoning trace is hashed and pinned. Anyone can audit how the agent arrived at the question from the source article. Forever.",
    role: "Protocol Labs . Proof",
  },
];

export function Stack() {
  return (
    <section className="stack" id="stack" data-screen-label="05 Stack" data-theme="dark">
      <div className="section-label" data-reveal>
        <span className="num">05</span>
        <span>THE STACK</span>
        <span className="dash" />
        <span>FIVE CIRCLE PRIMITIVES, ONE ARC SETTLEMENT</span>
      </div>

      <h2 className="stack-head" data-reveal>
        What the agora is <em>made of.</em>
      </h2>

      <div className="stack-rows">
        {STACK.map((row, i) => (
          <div
            key={row.name}
            className="stack-row"
            data-reveal-x=""
            data-reveal-delay={String(Math.min(i, 5))}
          >
            <span className="num">{row.num}</span>
            <span className="name">{row.name}</span>
            <span className="desc">{row.desc}</span>
            <span className="role">
              {row.role} <span className="arrow">↗</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
