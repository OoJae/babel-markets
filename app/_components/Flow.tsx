// Section 06: economics + flow. Five flow cards, sample receipts ledger, and
// the float-in-USYC yield card.

interface FlowStep {
  n: string;
  title: string;
  body: string;
  tag: string;
}

const FLOW: FlowStep[] = [
  {
    n: "⟶ 01",
    title: "Paste",
    body: "A trader in Lagos pastes a Yoruba article about a subsidy decision. Source language auto-detected.",
    tag: "Ingestion",
  },
  {
    n: "⟶ 02",
    title: "Synthesize",
    body: "The agent loops through seven steps, paying ~$0.0009 USDC for its own inference via Nanopayments.",
    tag: "Agent core",
  },
  {
    n: "⟶ 03",
    title: "Post",
    body: "The question hits Polymarket V2 with the translator's builder code embedded in the signed order.",
    tag: "CLOB v2",
  },
  {
    n: "⟶ 04",
    title: "Sweep",
    body: "Accrued fees move from Polygon to Arc via CCTP. The float subscribes into USYC until payout.",
    tag: "CCTP . USYC",
  },
  {
    n: "⟶ 05",
    title: "Paid",
    body: "Sub-second AttributionEscrow payout on Arc. The translator's passkey wallet credits in USDC or EURC.",
    tag: "Arc . Paymaster",
  },
];

interface ReceiptRow {
  flag: string;
  who: string;
  topic: string;
  amount: string;
  ccy: string;
}

const RECEIPTS: ReceiptRow[] = [
  { flag: "YO", who: "@ade_o", topic: "Petrol subsidy removal", amount: "412.08", ccy: "USDC" },
  { flag: "ZH", who: "@lin_w", topic: "PBoC RRR cut", amount: "298.40", ccy: "USDC" },
  { flag: "FR", who: "@camille", topic: "ECB hold June", amount: "187.66", ccy: "EURC" },
  { flag: "PT", who: "@joao_br", topic: "Selic cut June", amount: "144.02", ccy: "USDC" },
  { flag: "SW", who: "@amani_ke", topic: "KE election results", amount: "91.20", ccy: "USDC" },
];

export function Flow() {
  return (
    <section className="econ" id="earnings" data-screen-label="06 Earnings" data-theme="light">
      <div className="section-label" data-reveal>
        <span className="num">06</span>
        <span>THE FLOW</span>
        <span className="dash" />
        <span>FROM PASTED ARTICLE TO PAID TRANSLATOR</span>
      </div>

      <div className="econ-head">
        <h2 data-reveal>
          The translator <em>takes the fee.</em>
        </h2>
        <p data-reveal data-reveal-delay="2">
          Builder codes route a slice of every USDC fill back to the wallet that
          first translated the question. Babel keeps 20 percent; the remaining
          float parks in USYC until weekly payout.
        </p>
      </div>

      <div className="econ-flow" data-reveal>
        {FLOW.map((step, i) => (
          <div
            key={step.title}
            className="ef-step"
            data-reveal=""
            data-reveal-delay={String(Math.min(i, 5))}
          >
            <div className="ef-num">{step.n}</div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="ef-tag">{step.tag}</div>
          </div>
        ))}
      </div>

      <div className="receipts">
        <div className="receipt-card" data-reveal data-reveal-delay="1">
          <div className="rc-lab">Week 24 . creator ledger . sample</div>
          {RECEIPTS.map((r, i) => (
            <div
              key={r.who}
              className="rc-row"
              data-reveal=""
              data-reveal-delay={String(Math.min(i, 5))}
            >
              <span className="who">
                <span className="flag">{r.flag}</span> {r.who} . &quot;{r.topic}&quot;
              </span>
              <span className="amt">
                {r.amount}
                <span className="ccy">{r.ccy}</span>
              </span>
            </div>
          ))}
          <div className="rc-total">
            <span className="lab">total this week, 22 creators</span>
            <span className="amt">
              $3,847<span className="ccy">USDC + EURC</span>
            </span>
          </div>
        </div>

        <div className="yield-card" data-reveal data-reveal-delay="2">
          <span className="yc-lab">Float parked in USYC, week 24</span>
          <span className="yc-big">$24.9k</span>
          <span className="yc-foot">
            Pending payouts earn yield until the Saturday sweep. Demonstrated on Arc
            testnet . non-US wallets only . see README.
          </span>
        </div>
      </div>
    </section>
  );
}
