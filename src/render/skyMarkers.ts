import * as THREE from 'three';
import { starByName } from '../astro/stars';
import { equatorialVector } from '../astro/transform';

// Chart-overlay markers (shown with the constellation lines, key C):
//  - Polaris ring + label, dashed guide from the Dipper pointers (Merak → Dubhe → Polaris)
//  - South celestial pole ring + label (there is NO south star: we mark the empty spot),
//    dashed guide along the Southern Cross long axis (Gacrux → Acrux → ×4.5 → pole)
// Built in the fixed equatorial frame; add to StarField.group so it rotates with the sky.

const R = 897; // just inside the stars

type V3 = [number, number, number];

/** Points along the great circle from a through b, out to `beyond` × |ab| past b. */
function guideArc(a: V3, b: V3, beyond: number, steps = 64): number[] {
  const ang = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const sinA = Math.sin(ang);
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (1 + beyond);
    const w0 = Math.sin((1 - t) * ang) / sinA, w1 = Math.sin(t * ang) / sinA;
    out.push((w0 * a[0] + w1 * b[0]) * R, (w0 * a[1] + w1 * b[1]) * R, (w0 * a[2] + w1 * b[2]) * R);
  }
  return out;
}

function dashedLine(points: number[], color: number): THREE.Line {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const line = new THREE.Line(g, new THREE.LineDashedMaterial({
    color, dashSize: 8, gapSize: 6, transparent: true, opacity: 0.8, depthWrite: false, fog: false,
  }));
  line.computeLineDistances();
  line.frustumCulled = false;
  return line;
}

function labelSprite(text: string, sub: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(256, 128, 22, 0, Math.PI * 2); ctx.stroke(); // ring around the target
  ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
  ctx.font = 'bold 44px Georgia, serif'; ctx.fillText(text, 256, 78);
  ctx.font = '30px Georgia, serif'; ctx.fillText(sub, 256, 200);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(330, 165, 1); // ring ≈ 2.5° across at R; text readable at 70° FOV
  return s;
}

const at = (v: V3) => new THREE.Vector3(v[0] * R, v[1] * R, v[2] * R);
const vec = (name: string): V3 => { const s = starByName(name); return equatorialVector(s.raDeg, s.decDeg); };

export function buildSkyMarkers(): THREE.Group {
  const g = new THREE.Group();

  const north = labelSprite('Polaris', 'north · height = your latitude', '#ffd37a');
  north.position.copy(at(vec('Polaris')));
  g.add(north, dashedLine(guideArc(vec('Merak'), vec('Dubhe'), 5.2), 0xffd37a));

  const south = labelSprite('South Pole', 'no star here · height = latitude S', '#9fe0ff');
  south.position.copy(at([0, 0, -1]));
  g.add(south, dashedLine(guideArc(vec('Gacrux'), vec('Acrux'), 4.5), 0x9fe0ff));

  g.visible = false;
  return g;
}
