// Three.js Tower of Babel scene.
// Stacked translucent stone blocks, each face inscribed with a language name.
// Slow continuous rotation + cursor parallax + scroll-driven speed boost.
//
// Ported from brand-source/tower.js to a TypeScript module that takes a
// canvas + wrap element and returns a cleanup function. Geometry, materials,
// lighting, language tables, and animation logic preserved verbatim.

import * as THREE from "three";

interface FaceTextureOpts {
  small?: boolean;
  tag?: string;
}

export function initTower(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
): () => void {
  const scene = new THREE.Scene();
  scene.background = null;

  let w = wrap.clientWidth;
  let h = wrap.clientHeight;
  const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
  camera.position.set(0, 1.4, 10);
  camera.lookAt(0, 1.4, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  // Soft lighting (parchment + Pompeii rim)
  const amb = new THREE.AmbientLight(0xece4d0, 0.55);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb23a2a, 0.7);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xddd2b8, 0.4);
  fill.position.set(-3, -2, 5);
  scene.add(fill);

  // Languages per level, each block has 4 faces -> 4 langs
  const LEVELS: { langs: string[] }[] = [
    { langs: ["ENGLISH", "ESPAÑOL", "FRANÇAIS", "DEUTSCH"] },
    { langs: ["中文", "日本語", "한국어", "TIẾNG VIỆT"] },
    { langs: ["العربية", "עברית", "فارسی", "اردو"] },
    { langs: ["हिन्दी", "বাংলা", "தமிழ்", "తెలుగు"] },
    { langs: ["YORÙBÁ", "IGBO", "HAUSA", "SWAHILI"] },
    { langs: ["РУССКИЙ", "УКРАЇНСЬКА", "POLSKI", "ČESKY"] },
    { langs: ["PORTUGUÊS", "ITALIANO", "NEDERLANDS", "MAGYAR"] },
    { langs: ["ภาษาไทย", "TIẾNG VIỆT", "BAHASA", "FILIPINO"] },
    { langs: ["TÜRKÇE", "ΕΛΛΗΝΙΚΆ", "ROMÂNĂ", "БЪЛГАРСКИ"] },
    { langs: ["AMHARIC", "ZULU", "SOMALI", "WOLOF"] },
  ];

  const createdTextures: THREE.CanvasTexture[] = [];

  function faceTexture(text: string, opts: FaceTextureOpts = {}) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, "#f1eada");
    grad.addColorStop(0.5, "#ece4d0");
    grad.addColorStop(1, "#dccfb1");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = "rgba(60, 50, 30, 0.08)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
      ctx.bezierCurveTo(
        Math.random() * 1024,
        Math.random() * 1024,
        Math.random() * 1024,
        Math.random() * 1024,
        Math.random() * 1024,
        Math.random() * 1024,
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(60, 50, 30, 0.06)";
    for (let i = 0; i < 800; i++) {
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
    }

    ctx.strokeStyle = "rgba(20,18,12,0.55)";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 1024 - 56, 1024 - 56);

    ctx.fillStyle = "#b23a2a";
    const corners: Array<[number, number]> = [
      [60, 60],
      [964, 60],
      [60, 964],
      [964, 964],
    ];
    corners.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#0e0e0c";
    const fontSize = opts.small ? 110 : 150;
    ctx.font = `900 ${fontSize}px "Anton", "Archivo Black", Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let measured = ctx.measureText(text).width;
    let fs = fontSize;
    while (measured > 880 && fs > 50) {
      fs -= 8;
      ctx.font = `900 ${fs}px "Anton", "Archivo Black", Impact, sans-serif`;
      measured = ctx.measureText(text).width;
    }
    ctx.fillText(text, 512, 512);

    ctx.fillStyle = "rgba(20,18,12,0.55)";
    ctx.font = `500 28px "JetBrains Mono", monospace`;
    ctx.fillText("· BABEL MARKETS ·", 512, 880);
    ctx.fillText(opts.tag || "MARKET TONGUE", 512, 144);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    createdTextures.push(tex);
    return tex;
  }

  const tower = new THREE.Group();
  const N = LEVELS.length;
  let cumY = 0;
  const createdMaterials: THREE.MeshStandardMaterial[] = [];
  const createdGeometries: THREE.BoxGeometry[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const size = 3.4 * (1 - t * 0.55);
    const heightBlock = 0.62;
    const langs = LEVELS[i].langs;
    const materials = [
      new THREE.MeshStandardMaterial({
        map: faceTexture(langs[0], { tag: `LEVEL ${i + 1}` }),
        roughness: 0.72,
        metalness: 0.05,
      }),
      new THREE.MeshStandardMaterial({
        map: faceTexture(langs[2], { tag: `LEVEL ${i + 1}` }),
        roughness: 0.72,
        metalness: 0.05,
      }),
      new THREE.MeshStandardMaterial({
        map: faceTexture("·", { small: true, tag: "" }),
        roughness: 0.8,
      }),
      new THREE.MeshStandardMaterial({
        map: faceTexture("·", { small: true, tag: "" }),
        roughness: 0.8,
      }),
      new THREE.MeshStandardMaterial({
        map: faceTexture(langs[1], { tag: `LEVEL ${i + 1}` }),
        roughness: 0.72,
        metalness: 0.05,
      }),
      new THREE.MeshStandardMaterial({
        map: faceTexture(langs[3], { tag: `LEVEL ${i + 1}` }),
        roughness: 0.72,
        metalness: 0.05,
      }),
    ];
    materials.forEach((m) => createdMaterials.push(m));
    const geo = new THREE.BoxGeometry(size, heightBlock, size);
    createdGeometries.push(geo);
    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.y = cumY + heightBlock / 2;
    mesh.rotation.y = ((i % 2) * (Math.PI / 12) * ((i % 4) - 2)) / 2;
    tower.add(mesh);
    cumY += heightBlock + 0.015;
  }
  tower.position.y = -cumY / 2 + 1.2;
  scene.add(tower);

  const floorGeo = new THREE.CircleGeometry(5.5, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xddd2b8,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -cumY / 2 + 1.2;
  scene.add(floor);

  // Pointer parallax
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  function onPointerMove(e: PointerEvent) {
    const rect = wrap.getBoundingClientRect();
    targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  }
  function onPointerLeave() {
    targetMouseX = 0;
    targetMouseY = 0;
  }
  wrap.addEventListener("pointermove", onPointerMove);
  wrap.addEventListener("pointerleave", onPointerLeave);

  // Scroll-driven rotation boost
  let scrollBoost = 0;
  let lastScroll = window.scrollY;
  function onScroll() {
    const delta = window.scrollY - lastScroll;
    scrollBoost += delta * 0.0008;
    lastScroll = window.scrollY;
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

    mouseX += (targetMouseX - mouseX) * 0.06;
    mouseY += (targetMouseY - mouseY) * 0.06;

    scrollBoost *= 0.92;
    tower.rotation.y += dt * 0.18 + scrollBoost;

    tower.children.forEach((m, i) => {
      m.rotation.y += dt * 0.04 * (i % 2 === 0 ? 1 : -1);
    });

    camera.position.x = mouseX * 0.6;
    camera.position.y = 1.4 - mouseY * 0.3;
    camera.lookAt(0, 1.2, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return () => {
    cancelAnimationFrame(raf);
    wrap.removeEventListener("pointermove", onPointerMove);
    wrap.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", resize);
    createdGeometries.forEach((g) => g.dispose());
    createdMaterials.forEach((m) => m.dispose());
    createdTextures.forEach((t) => t.dispose());
    floorGeo.dispose();
    floorMat.dispose();
    renderer.dispose();
  };
}
