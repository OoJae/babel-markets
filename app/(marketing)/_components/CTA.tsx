// Section 08 head: the closing CTA. Footer + colophon live in Footer.tsx.

export function CTA() {
  return (
    <>
      <h2 className="cta-head" data-reveal>
        Translate <em>the agora.</em>
      </h2>

      <div className="cta-actions" data-reveal data-reveal-delay="1">
        <a href="#agent" className="cta-primary">
          Open Babel <span>↗</span>
        </a>
        <a href="/app" className="cta-secondary">
          Read the playbook
        </a>
        <a href="https://github.com/OoJae/babel-markets" target="_blank" rel="noreferrer" className="cta-secondary">
          View on GitHub
        </a>
      </div>
    </>
  );
}
