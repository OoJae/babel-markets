// Section 07: Aristotle quote on the dark ink background, with a giant
// background "B" mark.

export function Manifesto() {
  return (
    <section className="manifesto" data-screen-label="07 Manifesto" data-theme="dark">
      <span className="manifesto-bg-letter">B</span>
      <blockquote className="manifesto-quote" data-reveal>
        &quot;All things that are exchanged{" "}
        <em
          style={{
            fontFamily: "var(--f-serif)",
            color: "var(--pompeii)",
          }}
        >
          must be somehow comparable.
        </em>
        &quot;
      </blockquote>
      <div className="manifesto-attrib" data-reveal data-reveal-delay="1">
        ARISTOTLE . NICOMACHEAN ETHICS . BOOK V . ON PRICE DISCOVERY
      </div>
    </section>
  );
}
