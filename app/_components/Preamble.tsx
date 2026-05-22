// Section 02: preamble copy with drifting language fragments and an emphasized
// "Whoever first translates the world earns the builder fee" pull-quote.

import { DriftParallax } from "./DriftParallax";

export function Preamble() {
  return (
    <section
      className="preamble"
      id="preamble"
      data-screen-label="02 Preamble"
      data-theme="light"
    >
      <DriftParallax>
        <span className="drift" style={{ top: "14%", left: "4%" }} data-speed="0.12">
          «&nbsp;ἀγορά&nbsp;»
        </span>
        <span className="drift" style={{ top: "30%", right: "6%" }} data-speed="-0.18">
          «&nbsp;市场&nbsp;»
        </span>
        <span className="drift" style={{ top: "56%", left: "10%" }} data-speed="0.22">
          «&nbsp;السوق&nbsp;»
        </span>
        <span className="drift" style={{ top: "76%", right: "12%" }} data-speed="-0.14">
          «&nbsp;ọjà&nbsp;»
        </span>
        <span className="drift" style={{ top: "88%", left: "32%" }} data-speed="0.08">
          «&nbsp;mercado&nbsp;»
        </span>
        <span className="drift" style={{ top: "8%", right: "30%" }} data-speed="-0.10">
          «&nbsp;ярмарка&nbsp;»
        </span>
      </DriftParallax>

      <div className="section-label" data-reveal>
        <span className="num">02</span>
        <span>PREAMBLE</span>
        <span className="dash" />
        <span>WHY BABEL</span>
      </div>

      <div className="preamble-grid">
        <h2 className="preamble-head" data-reveal>
          The agora is where a civilization{" "}
          <em>does its thinking out loud.</em>
          <br />
          But it only ever speaks <span className="strike">English.</span>
        </h2>
        <div className="preamble-body" data-reveal data-reveal-delay="2">
          <p>
            Polymarket runs on US news, in US English, settled by US dollars.
            Eighty-seven percent of humanity reads the news in something else.
          </p>
          <p>
            Babel is the agent that reads non-English news, reformulates it as a
            well-formed binary market with an explicit resolution rule, and posts
            it to Polymarket V2 with your builder code attached.
          </p>
          <div className="pull">
            Whoever first translates the world earns the builder fee on every bet
            that follows. Translation is the moat. Builder codes are the bond.
          </div>
          <p>
            Five Circle primitives. One Arc settlement layer. A reasoning trace
            pinned to IPFS for every market on the planet. This is the agora the
            original Athenians were imagining.
          </p>
        </div>
      </div>
    </section>
  );
}
