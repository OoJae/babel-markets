// Section 04: Tower of Babel. Marketing copy + the 3D scene side by side.

import { TowerCanvas } from "./TowerCanvas";

export function Tower() {
  return (
    <section
      className="tower"
      id="tower"
      data-screen-label="04 Tower"
      data-theme="light"
    >
      <div className="section-label" data-reveal>
        <span className="num">04</span>
        <span>THE TOWER</span>
        <span className="dash" />
        <span>FORTY-SEVEN TONGUES, ONE LEDGER</span>
      </div>

      <div className="tower-grid">
        <div className="tower-copy">
          <h2 data-reveal>
            Forty-seven <em>tongues,</em> one ledger.
          </h2>
          <p data-reveal data-reveal-delay="2">
            The mythic tower was meant to reach heaven. Ours is meant to reach
            every news source on earth. Each course of stone is a language pack;
            each face is a market vertical.
          </p>
          <p data-reveal data-reveal-delay="3">
            Drag the tower. It spins. Every face you can read is a market
            Polymarket cannot list, because Polymarket cannot read it.
          </p>

          <div className="tower-stat-grid" data-reveal data-reveal-delay="4">
            <div>
              <div className="k">Languages live</div>
              <div className="v">
                12<span className="small">at launch</span>
              </div>
            </div>
            <div>
              <div className="k">Roadmap</div>
              <div className="v">
                47<span className="small">by Q4 &apos;26</span>
              </div>
            </div>
            <div>
              <div className="k">Coverage</div>
              <div className="v">
                94%<span className="small">of news readers</span>
              </div>
            </div>
            <div>
              <div className="k">Eval pass</div>
              <div className="v">
                78%<span className="small">target 70+</span>
              </div>
            </div>
          </div>
        </div>

        <TowerCanvas />
      </div>
    </section>
  );
}
