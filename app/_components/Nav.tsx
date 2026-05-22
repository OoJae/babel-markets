"use client";

// Sticky nav. Holds the multi-timezone clock loop + the section-aware
// light/dark theme swap. The scroll progress dots live in ScrollProgress and
// share state via useScrollSection so the two pieces stay in lockstep.

import { useEffect, useState } from "react";
import { useScrollSection } from "../_hooks/useScrollSection";
import { useSmoothAnchors } from "../_hooks/useSmoothAnchors";

const CITIES = [
  { tz: "Africa/Lagos", abbr: "LAGOS" },
  { tz: "America/New_York", abbr: "NYC" },
  { tz: "Europe/London", abbr: "EU" },
];

interface NavProps {
  // Prefix prepended to every nav-center anchor. Empty on the landing (anchors
  // are in-page #ids). Set to "/" when used on /app so the anchors jump back
  // to the landing section instead of nowhere.
  linkBase?: string;
}

export function Nav({ linkBase = "" }: NavProps = {}) {
  const { theme } = useScrollSection();
  useSmoothAnchors();
  const [clock, setClock] = useState<string>("--:-- . LAGOS");
  const [cityIdx, setCityIdx] = useState(0);

  useEffect(() => {
    function tick(idx: number) {
      const c = CITIES[idx];
      const t = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: c.tz,
      });
      setClock(`${t} . ${c.abbr}`);
    }
    tick(cityIdx);
    const min = setInterval(() => tick(cityIdx), 1000);
    return () => clearInterval(min);
  }, [cityIdx]);

  useEffect(() => {
    const rotate = setInterval(() => {
      setCityIdx((i) => (i + 1) % CITIES.length);
    }, 4000);
    return () => clearInterval(rotate);
  }, []);

  return (
    <nav className={`nav${theme === "dark" ? " dark" : ""}`} id="nav">
      <div className="nav-left">
        <span className="b-mark nav-mark" style={{ fontSize: 18 }}>
          <span className="glyph">
            <i />
            <u />
          </span>
          BABEL
        </span>
        <span className="nav-meta">
          <span className="pulse" /> v0.1.0 . Mainnet soon
          <br />
          <span>{clock}</span>
        </span>
      </div>
      <div className="nav-center">
        <a href={`${linkBase}#agora`}>Agora</a>
        <a href={`${linkBase}#agent`}>Agent</a>
        <a href={`${linkBase}#tower`}>Tower</a>
        <a href={`${linkBase}#stack`}>Stack</a>
        <a href={`${linkBase}#earnings`}>Earnings</a>
      </div>
      <div className="nav-right">
        <a href="/dashboard" className="nav-cta nav-cta-secondary">
          Dashboard ↗
        </a>
        <a href="/app" className="nav-cta">
          Open Babel ↗
        </a>
      </div>
    </nav>
  );
}
