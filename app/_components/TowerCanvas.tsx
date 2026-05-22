"use client";

// Mounts the Three.js Tower scene. Geometry, materials, and animation live in
// app/(marketing)/_three/tower.ts.

import { useEffect, useRef } from "react";
import { initTower } from "../_three/tower";

export function TowerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    return initTower(canvasRef.current, wrapRef.current);
  }, []);

  return (
    <div ref={wrapRef} className="tower-canvas-wrap">
      <canvas ref={canvasRef} id="tower-canvas" />
      <div className="tower-canvas-frame">
        <span className="tcf-corner tl" />
        <span className="tcf-corner tr" />
        <span className="tcf-corner bl" />
        <span className="tcf-corner br" />
        <span className="tcf-coord t">LAT 41.0082 . ATHENS</span>
        <span className="tcf-coord b">DRAG TO ROTATE . SCROLL FOR SPIN</span>
      </div>
    </div>
  );
}
