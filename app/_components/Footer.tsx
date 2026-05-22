// Footer + colophon. Lives inside the same <section className="cta"> block as
// the closing CTA in app/(marketing)/page.tsx.

export function Footer() {
  return (
    <>
      <div className="foot" data-reveal data-reveal-delay="1">
        <div className="foot-col">
          <div className="foot-mark">
            BABEL
            <br />
            <em>markets, in every tongue.</em>
          </div>
          <p
            style={{
              marginTop: 20,
              maxWidth: 320,
              opacity: 0.7,
              lineHeight: 1.6,
            }}
          >
            Built for the Agora Agents Hackathon, Canteen x Circle x Arc. Solo
            build, Lagos / NYC. Submission 25 May 2026.
          </p>
        </div>
        <div className="foot-col">
          <h4>Product</h4>
          <a href="#agent">Live agent</a>
          <a href="#tower">Language tower</a>
          <a href="#earnings">Creator earnings</a>
          <a href="/dashboard">Creator dashboard</a>
        </div>
        <div className="foot-col">
          <h4>Stack</h4>
          <a href="https://docs.polymarket.com" target="_blank" rel="noreferrer">
            Polymarket V2
          </a>
          <a href="https://developers.circle.com" target="_blank" rel="noreferrer">
            Circle developer
          </a>
          <a href="https://docs.arc.network" target="_blank" rel="noreferrer">
            Arc network
          </a>
          <a href="https://github.com/the-canteen-dev" target="_blank" rel="noreferrer">
            Canteen ARC CLI
          </a>
        </div>
        <div className="foot-col">
          <h4>Community</h4>
          <a href="https://twitter.com/OoJae" target="_blank" rel="noreferrer">
            Twitter / X
          </a>
          <a href="#">Canteen Discord</a>
          <a href="#">Arc builder Discord</a>
          <a href="#">MEXC blog</a>
        </div>
      </div>

      <div className="colophon">
        <span>© 2026 BABEL MARKETS . DESIGNED IN LAGOS . SETTLED ON ARC</span>
        <span>v0.1.0 . MAINNET SOON . NON-US ONLY</span>
      </div>
    </>
  );
}
