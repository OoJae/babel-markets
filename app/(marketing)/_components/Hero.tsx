// Section 01: BABEL hero with the 3D bust slotted behind the middle B.

import { HeroBust } from "./HeroBust";

export function Hero() {
  return (
    <section className="hero" id="agora" data-screen-label="01 Hero" data-theme="light">
      <div className="hero-meta tl">
        <span className="lab">BABEL MARKETS . EST. 2026</span>
        <strong>Polymarket in every tongue.</strong>
      </div>

      <div className="hero-meta tr">
        <span className="lab">Settles on</span>
        <strong>ARC . USDC . EURC</strong>
      </div>

      <div className="hero-stage">
        <div className="hero-title">
          <span className="row r1" aria-label="BABEL">
            <span className="char" data-char="B">B</span>
            <span className="char" data-char="A">A</span>
            <span className="char back" data-char="B">B</span>
            <span className="char" data-char="E">E</span>
            <span className="char" data-char="L">L</span>
          </span>
        </div>

        <HeroBust />

        <div className="hero-echo" aria-hidden="true">
          <span className="he1">ΑΓΟΡΑ</span>
          <span className="he2">мир</span>
          <span className="he3">市</span>
          <span className="he4">سوق</span>
        </div>
      </div>

      <div className="hero-meta bl">
        <span className="lab">Where the world&apos;s news</span>
        <br />
        <span className="lab">becomes a tradable market.</span>
      </div>

      <div className="hero-meta br">
        <span className="lab">Scroll to enter</span>
        <strong>↓ THE AGORA</strong>
      </div>
    </section>
  );
}
