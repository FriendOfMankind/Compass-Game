import * as THREE from 'three';
import { mulberry32 } from '../util/rng';
import { PAL } from './palette';

// Small procedural canvas textures (no image assets). Deterministic: fixed seeds.
// All are designed to tile; UVs are in metres × the scale given in each comment.

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Deck planks running fore–aft. 1 texture unit = 1.6 m. Planks are 0.16 m wide. */
export function deckPlanks(): THREE.CanvasTexture {
  const rnd = mulberry32(7);
  return canvasTex(256, 256, (c) => {
    const n = 10, pw = 256 / n;
    for (let i = 0; i < n; i++) {
      // Each plank column has 2 butt joints at random heights.
      const joints = [rnd() * 256, rnd() * 256];
      let y0 = 0;
      for (const y1 of [...joints.sort((a, b) => a - b), 256]) {
        c.fillStyle = shade(PAL.deck, 0.9 + rnd() * 0.16);
        c.fillRect(i * pw, y0, pw, y1 - y0);
        c.fillStyle = PAL.deckSeam;
        c.fillRect(i * pw, y1 - 1, pw, 2);
        y0 = y1;
      }
      c.fillStyle = PAL.deckSeam;
      c.fillRect(i * pw, 0, 1.5, 256);
    }
  });
}

/** Hull strakes (horizontal planks). u = metres along the hull / 4, v = metres up / 2. */
export function hullStrakes(): THREE.CanvasTexture {
  const rnd = mulberry32(11);
  return canvasTex(256, 128, (c) => {
    const n = 8, sh = 128 / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = shade(PAL.wood, 0.88 + rnd() * 0.18);
      c.fillRect(0, i * sh, 256, sh);
      c.fillStyle = shade(PAL.woodDark, 0.9);
      c.fillRect(0, i * sh, 256, 1.5);
    }
  });
}

/** Sail cloth: horizontal panel seams. u, v in 0..1 over the sail. */
export function sailCloth(): THREE.CanvasTexture {
  return canvasTex(128, 256, (c) => {
    c.fillStyle = PAL.sail; c.fillRect(0, 0, 128, 256);
    c.fillStyle = PAL.sailSeam;
    for (let y = 18; y < 256; y += 26) c.fillRect(0, y, 128, 2);
  }, false);
}

/** Compass card for the binnacle: N up, 32 points, red north. */
export function compassCard(): THREE.CanvasTexture {
  return canvasTex(256, 256, (c) => {
    const r = 124;
    c.translate(128, 128);
    c.fillStyle = PAL.paper; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = PAL.ink; c.lineWidth = 2; c.stroke();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2, major = i % 8 === 0, mid = i % 4 === 0;
      const len = major ? 0.62 : mid ? 0.42 : 0.18;
      const w = major ? 0.13 : mid ? 0.09 : 0.03;
      c.save(); c.rotate(a);
      c.fillStyle = i === 0 ? PAL.red : i % 2 ? '#7a5a3a' : PAL.ink;
      c.beginPath(); c.moveTo(0, -r * 0.92); c.lineTo(r * w, -r * (0.92 - len)); c.lineTo(-r * w, -r * (0.92 - len)); c.fill();
      c.restore();
    }
    c.fillStyle = PAL.ink; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    (['N', 'E', 'S', 'W'] as const).forEach((l, i) => {
      const a = (i / 4) * Math.PI * 2;
      c.fillStyle = l === 'N' ? PAL.red : PAL.ink;
      c.fillText(l, Math.sin(a) * r * 0.72, -Math.cos(a) * r * 0.72);
    });
  }, false);
}

/** A sheet of chart paper for the table (decorative). */
export function chartPaper(): THREE.CanvasTexture {
  const rnd = mulberry32(3);
  return canvasTex(128, 180, (c) => {
    c.fillStyle = PAL.paper; c.fillRect(0, 0, 128, 180);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(120,80,40,${rnd() * 0.08})`; c.fillRect(rnd() * 128, rnd() * 180, 3, 3); }
    c.strokeStyle = 'rgba(58,36,20,0.45)'; c.lineWidth = 1;
    for (let x = 16; x < 128; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 180); c.stroke(); }
    for (let y = 18; y < 180; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke(); }
    c.strokeStyle = PAL.ink; c.setLineDash([4, 3]); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(30, 150); c.lineTo(52, 110); c.lineTo(70, 92); c.lineTo(96, 40); c.stroke();
  }, false);
}
