// Babel Markets brand landing. Composed from section components under
// _components/. Behaviour (multi-timezone clock, light/dark nav theme,
// scroll-reveals, drift parallax, ticker, Tower + Hero bust 3D) lives in the
// individual components. The Observer wrapper mounts a single
// IntersectionObserver so every [data-reveal] / [data-reveal-x] inside the
// page picks up the .visible class on entry.

import { AgentDemo } from "./_components/AgentDemo";
import { CTA } from "./_components/CTA";
import { Flow } from "./_components/Flow";
import { Footer } from "./_components/Footer";
import { Hero } from "./_components/Hero";
import { Manifesto } from "./_components/Manifesto";
import { Nav } from "./_components/Nav";
import { Observer } from "./_components/Observer";
import { Preamble } from "./_components/Preamble";
import { ScrollProgress } from "./_components/ScrollProgress";
import { Stack } from "./_components/Stack";
import { Ticker } from "./_components/Ticker";
import { Tower } from "./_components/Tower";

export default function BrandLanding() {
  return (
    <Observer>
      <Nav />
      <ScrollProgress />

      <Hero />
      <Ticker />
      <Preamble />

      <section
        className="agent"
        id="agent"
        data-screen-label="03 Agent"
        data-theme="dark"
      >
        <div className="section-label" data-reveal>
          <span className="num">03</span>
          <span>THE AGENT</span>
          <span className="dash" />
          <span>SEVEN DISCRETE STEPS, ONE SUB-CENT INFERENCE</span>
        </div>

        <div className="agent-head">
          <h2 className="agent-h1" data-reveal>
            Paste
            <br />
            a tongue,
            <em>mint a market.</em>
          </h2>
          <p className="agent-blurb" data-reveal data-reveal-delay="2">
            A real multi-step agent loop. Detect, translate, judge, synthesize,
            critique, dedup, post. Each step Zod-typed and traced to Langfuse.
            Inference paid by the agent itself, in USDC, via Gateway Nanopayments.
          </p>
        </div>

        <div data-reveal data-reveal-delay="3">
          <AgentDemo />
        </div>
      </section>

      <Tower />
      <Stack />
      <Flow />
      <Manifesto />

      <section className="cta" id="cta" data-screen-label="08 CTA" data-theme="light">
        <CTA />
        <Footer />
      </section>
    </Observer>
  );
}
