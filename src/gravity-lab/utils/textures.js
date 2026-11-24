import * as THREE from "three";

/**
 * Procedural textures. Everything is generated on a canvas so the experience
 * has no external image dependencies and works offline inside NodeBox.
 */

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function createGridTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#080d13");
  gradient.addColorStop(0.5, "#060a10");
  gradient.addColorStop(1, "#04070b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Fine sub-grid.
  ctx.strokeStyle = "rgba(76, 142, 186, 0.075)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }

  // Main grid.
  ctx.strokeStyle = "rgba(81, 190, 225, 0.2)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= size; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }

  // Intersection nodes.
  ctx.fillStyle = "rgba(120, 232, 255, 0.38)";
  for (let x = 0; x <= size; x += 128) {
    for (let y = 0; y <= size; y += 128) {
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlatformTexture() {
  const size = 1024;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;

  const base = ctx.createRadialGradient(c, c, 20, c, c, c);
  base.addColorStop(0, "#111a24");
  base.addColorStop(0.62, "#0b121a");
  base.addColorStop(1, "#070b10");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Concentric guide rings.
  const rings = [
    [size * 0.475, "rgba(95, 200, 235, 0.32)", 3],
    [size * 0.4, "rgba(95, 200, 235, 0.16)", 1.5],
    [size * 0.305, "rgba(95, 200, 235, 0.28)", 2],
    [size * 0.18, "rgba(120, 232, 255, 0.38)", 3],
    [size * 0.105, "rgba(120, 232, 255, 0.16)", 1.5],
  ];
  for (const [radius, color, width] of rings) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial ticks and panel seams.
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const inner = size * 0.425;
    const outer = i % 4 === 0 ? size * 0.462 : size * 0.448;
    ctx.beginPath();
    ctx.strokeStyle = i % 4 === 0 ? "rgba(126, 235, 255, 0.52)" : "rgba(83, 165, 200, 0.22)";
    ctx.lineWidth = i % 4 === 0 ? 2.5 : 1.4;
    ctx.moveTo(c + Math.cos(angle) * inner, c + Math.sin(angle) * inner);
    ctx.lineTo(c + Math.cos(angle) * outer, c + Math.sin(angle) * outer);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.PI / 12;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(90, 175, 210, 0.13)";
    ctx.lineWidth = 2;
    ctx.moveTo(c + Math.cos(angle) * size * 0.19, c + Math.sin(angle) * size * 0.19);
    ctx.lineTo(c + Math.cos(angle) * size * 0.42, c + Math.sin(angle) * size * 0.42);
    ctx.stroke();
  }

  // Small technical markings.
  ctx.fillStyle = "rgba(138, 238, 255, 0.55)";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = c + Math.cos(angle) * size * 0.345;
    const y = c + Math.sin(angle) * size * 0.345;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillRect(-14, -2, 28, 4);
    ctx.restore();
  }

  // Center hatch surround.
  ctx.beginPath();
  ctx.strokeStyle = "rgba(117, 230, 255, 0.55)";
  ctx.lineWidth = 4;
  ctx.arc(c, c, size * 0.092, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(130, 232, 255, 0.42)";
  ctx.font = "600 22px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GRAVITY LAB · G-07", c, c + size * 0.27);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRadialGlowTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(170,240,255,0.8)");
  gradient.addColorStop(0.45, "rgba(60,180,255,0.24)");
  gradient.addColorStop(1, "rgba(0,80,160,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRingTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(140, 244, 255, 0.95)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, size * 0.44, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(70, 190, 255, 0.28)";
  ctx.lineWidth = 4;
  ctx.stroke();
  // Tick marks around the selection ring.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(190, 252, 255, 0.9)";
    ctx.lineWidth = 9;
    ctx.moveTo(c + Math.cos(angle) * size * 0.3, c + Math.sin(angle) * size * 0.3);
    ctx.lineTo(c + Math.cos(angle) * size * 0.48, c + Math.sin(angle) * size * 0.48);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSparkTexture() {
  const size = 64;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(160,240,255,0.85)");
  gradient.addColorStop(1, "rgba(40,160,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
