// Hero Bust: Three.js lathe-revolved abstract classical form.
// Sphere head + tapered chest + plinth, revolved from a 2D profile.
// Marble PBR-style material, three-point lighting with Pompeii rim.
// Slow auto-rotation + cursor parallax + dust drift.
//
// Ported from brand-source/hero-bust.js to a TypeScript module that takes a
// canvas + wrap element and returns a cleanup function. All geometry,
// materials, lighting, and animation logic preserved verbatim.

import * as THREE from "three";

export function initHeroBust(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
): () => void {
  const scene = new THREE.Scene();
  let w = wrap.clientWidth;
  let h = wrap.clientHeight;
  const camera = new THREE.PerspectiveCamera(24, w / h, 0.1, 100);
  camera.position.set(0, 1.4, 18);
  camera.lookAt(0, 1.2, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Procedural marble texture rendered into a 2D canvas, then uploaded as a
  // CanvasTexture. Keeps the file zero-asset.
  function marbleTexture(size = 1024) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, "#f6efde");
    grad.addColorStop(0.45, "#ece4d0");
    grad.addColorStop(1, "#d8cdb1");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 28; i++) {
      const r = 80 + Math.random() * 280;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, `rgba(255, 250, 235, ${0.12 + Math.random() * 0.12})`);
      g2.addColorStop(1, "rgba(255, 250, 235, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.strokeStyle = "rgba(60, 48, 28, 0.16)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 280;
        y += (Math.random() - 0.5) * 280;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(40, 30, 20, 0.08)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 160;
        y += (Math.random() - 0.5) * 160;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(40, 30, 18, 0.06)";
    for (let i = 0; i < 1200; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 2D profile points (x = radius, y = height). Revolved 360 degrees.
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.85, 0.0),
    new THREE.Vector2(1.85, 0.55),
    new THREE.Vector2(1.55, 0.62),
    new THREE.Vector2(1.3, 0.72),
    new THREE.Vector2(1.4, 0.92),
    new THREE.Vector2(1.85, 1.4),
    new THREE.Vector2(2.05, 1.95),
    new THREE.Vector2(2.0, 2.45),
    new THREE.Vector2(1.78, 2.8),
    new THREE.Vector2(1.35, 3.05),
    new THREE.Vector2(0.95, 3.2),
    new THREE.Vector2(0.65, 3.32),
    new THREE.Vector2(0.46, 3.55),
    new THREE.Vector2(0.42, 3.85),
    new THREE.Vector2(0.46, 4.05),
    new THREE.Vector2(0.72, 4.2),
    new THREE.Vector2(0.92, 4.4),
    new THREE.Vector2(1.08, 4.7),
    new THREE.Vector2(1.14, 5.05),
    new THREE.Vector2(1.1, 5.4),
    new THREE.Vector2(0.98, 5.7),
    new THREE.Vector2(0.75, 5.92),
    new THREE.Vector2(0.42, 6.05),
    new THREE.Vector2(0.0, 6.1),
  ];

  const lathe = new THREE.LatheGeometry(profile, 80);
  lathe.computeVertexNormals();

  const marble = marbleTexture(1024);
  const marbleBump = marbleTexture(512);

  const bustMat = new THREE.MeshStandardMaterial({
    map: marble,
    bumpMap: marbleBump,
    bumpScale: 0.04,
    roughness: 0.55,
    metalness: 0.04,
    color: 0xf2ead7,
  });
  const bust = new THREE.Mesh(lathe, bustMat);
  bust.position.y = -2.4;
  scene.add(bust);

  const togaGeo = new THREE.TorusGeometry(1.95, 0.07, 16, 80);
  const togaMat = new THREE.MeshStandardMaterial({
    color: 0xc9b88e,
    roughness: 0.65,
    metalness: 0.08,
    map: marbleBump,
  });
  const toga = new THREE.Mesh(togaGeo, togaMat);
  toga.rotation.x = Math.PI / 2;
  toga.position.y = -2.4 + 2.1;
  scene.add(toga);

  const laurelGeo = new THREE.TorusGeometry(0.92, 0.06, 14, 64);
  const laurelMat = new THREE.MeshStandardMaterial({
    color: 0xb89968,
    roughness: 0.4,
    metalness: 0.3,
  });
  const laurel = new THREE.Mesh(laurelGeo, laurelMat);
  laurel.rotation.x = Math.PI / 2;
  laurel.rotation.z = 0.08;
  laurel.position.y = -2.4 + 5.18;
  scene.add(laurel);

  const plinthGeo = new THREE.BoxGeometry(4.2, 0.55, 4.2);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xddd2b8,
    roughness: 0.9,
    metalness: 0.0,
    bumpMap: marbleBump,
    bumpScale: 0.08,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = -2.4 - 0.275;
  scene.add(plinth);

  // Three-point lighting + Pompeii rim
  const ambient = new THREE.AmbientLight(0xfff4dc, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff6e3, 1.3);
  key.position.set(5, 8, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdac8a1, 0.55);
  fill.position.set(-5, 3, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xb23a2a, 1.1);
  rim.position.set(-6, 5, -4);
  scene.add(rim);

  const bottom = new THREE.DirectionalLight(0x8c2a1d, 0.25);
  bottom.position.set(0, -4, 3);
  scene.add(bottom);

  // Floating dust particles
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 60;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 12;
    dustPos[i * 3 + 1] = Math.random() * 8 - 2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xb23a2a,
    size: 0.04,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // Interaction
  let targetMX = 0;
  let targetMY = 0;
  let mx = 0;
  let my = 0;
  function onPointerMove(e: PointerEvent) {
    targetMX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMY = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  window.addEventListener("pointermove", onPointerMove);

  let scrollY = window.scrollY;
  function onScroll() {
    scrollY = window.scrollY;
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  function resize() {
    w = wrap.clientWidth;
    h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  let raf = 0;
  let t0 = performance.now();
  function loop() {
    const now = performance.now();
    const dt = (now - t0) / 1000;
    t0 = now;

    mx += (targetMX - mx) * 0.05;
    my += (targetMY - my) * 0.05;

    bust.rotation.y += dt * 0.12 + mx * 0.005;
    toga.rotation.z += dt * 0.04;
    laurel.rotation.z = 0.08 + mx * 0.12;
    plinth.rotation.y = bust.rotation.y;

    camera.position.x = mx * 0.7;
    camera.position.y = 1.4 - my * 0.4 - scrollY * 0.001;
    camera.lookAt(0, 1.2 - scrollY * 0.0008, 0);

    const arr = dustGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3 + 1] += dt * 0.15;
      if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -2;
      arr[i * 3] += Math.sin(now * 0.0006 + i) * 0.002;
    }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", resize);
    lathe.dispose();
    togaGeo.dispose();
    laurelGeo.dispose();
    plinthGeo.dispose();
    dustGeo.dispose();
    bustMat.dispose();
    togaMat.dispose();
    laurelMat.dispose();
    plinthMat.dispose();
    dustMat.dispose();
    marble.dispose();
    marbleBump.dispose();
    renderer.dispose();
  };
}
