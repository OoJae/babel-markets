"use client";

// Mounts the Three.js bust scene into a canvas. The actual scene lives in
// app/(marketing)/_three/hero-bust.ts.

import { useEffect, useRef } from "react";
import { initHeroBust } from "../_three/hero-bust";

export function HeroBust() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const cleanup = initHeroBust(canvasRef.current, wrapRef.current);
    return cleanup;
  }, []);

  return (
    <div ref={wrapRef} className="hero-sculpture" aria-label="Classical bust, 3D marble form">
      <canvas ref={canvasRef} id="hero-bust-canvas" />
      <div className="hero-sculpture-frame">
        <span className="hsf-corner tl" />
        <span className="hsf-corner tr" />
        <span className="hsf-corner bl" />
        <span className="hsf-corner br" />
        <span className="hsf-label bot">LATHE GEOMETRY . PROC. MARBLE . STAND-IN FORM</span>
      </div>
    </div>
  );
}
