import * as THREE from 'three';
import { DECK_HALF_LENGTH, hullHalfWidth } from '../sim/deck';
import { PAL } from './palette';
import { deckPlanks, hullStrakes } from './textures';

// Hull, planked deck and cap rail. Boat-local axes: +X starboard, −Z bow, +Y up.
// The outline comes from sim/deck.ts so the walkable area matches the mesh.

export const DECK_Y = 1.1;
export const BULWARK_Y = 1.5;
const KEEL_Y = -0.9;
const RAIL_W = 0.12;

/** Sample stations along the hull, denser near the bow where the width changes fastest. */
const stations = (n: number) => Array.from({ length: n + 1 }, (_, i) => -DECK_HALF_LENGTH + (i / n) ** 1.6 * 2 * DECK_HALF_LENGTH);

function hullGeometry(): THREE.BufferGeometry {
  const zs = stations(18);
  // Section profile from port bulwark → keel → starboard bulwark.
  const section = (z: number) => {
    const w = Math.max(0.02, hullHalfWidth(z));
    const keel = KEEL_Y * Math.min(1, 0.25 + (z + DECK_HALF_LENGTH) / 2.5);
    return [
      [-w, BULWARK_Y], [-w * 0.95, 0.35], [-w * 0.5, keel * 0.7], [0, keel],
      [w * 0.5, keel * 0.7], [w * 0.95, 0.35], [w, BULWARK_Y],
    ];
  };
  const pos: number[] = [], uv: number[] = [];
  // UV: u = along the hull (4 m per tile), v = height (2 m per tile) → strakes stay horizontal.
  const push = (x: number, y: number, z: number) => { pos.push(x, y, z); uv.push(z / 4, y / 2); };
  for (let i = 0; i < zs.length - 1; i++) {
    const s0 = section(zs[i]), s1 = section(zs[i + 1]);
    for (let j = 0; j < s0.length - 1; j++) {
      const a = [s0[j][0], s0[j][1], zs[i]], b = [s1[j][0], s1[j][1], zs[i + 1]];
      const c = [s1[j + 1][0], s1[j + 1][1], zs[i + 1]], d = [s0[j + 1][0], s0[j + 1][1], zs[i]];
      for (const v of [a, b, c, a, c, d]) push(v[0], v[1], v[2]);
    }
  }
  // Transom.
  const st = section(zs[zs.length - 1]), zt = zs[zs.length - 1];
  for (let j = 1; j < st.length - 1; j++) for (const v of [st[0], st[j], st[j + 1]]) push(v[0], v[1], zt);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function deckGeometry(): THREE.BufferGeometry {
  const zs = stations(24);
  const shape = new THREE.Shape();
  // Shape is in XY with Y = −z; mapped back to −Z by the rotation below.
  zs.forEach((z, i) => { const x = Math.max(0, hullHalfWidth(z) - 0.02); if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z); });
  [...zs].reverse().forEach((z) => shape.lineTo(-Math.max(0, hullHalfWidth(z) - 0.02), -z));
  const g = new THREE.ShapeGeometry(shape);
  // ShapeGeometry UVs are the shape coords in metres; planks run along v (fore–aft).
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6 + 0.5, uv.getY(i) / 1.6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, DECK_Y, 0);
  return g;
}

/** Flat cap rail along the top of the bulwark, both sides, meeting at the stem. */
function railGeometry(): THREE.BufferGeometry {
  const zs = stations(24);
  const pos: number[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1];
      const o0 = hullHalfWidth(z0) + 0.02, o1 = hullHalfWidth(z1) + 0.02;
      const i0 = Math.max(0, o0 - RAIL_W), i1 = Math.max(0, o1 - RAIL_W);
      const y = BULWARK_Y + 0.05;
      const q = [[side * i0, y, z0], [side * o0, y, z0], [side * o1, y, z1], [side * i1, y, z1]];
      // Top face, wound to face up on either side.
      const order = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const k of order) pos.push(...q[k]);
      // Inner + outer edges (0.07 m deep) so the rail reads as a thick timber.
      for (const [a, b] of [[0, 3], [1, 2]] as const) {
        const A = q[a], B = q[b];
        pos.push(A[0], A[1], A[2], B[0], B[1], B[2], B[0], B[1] - 0.07, B[2], A[0], A[1], A[2], B[0], B[1] - 0.07, B[2], A[0], A[1] - 0.07, A[2]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildHull(): THREE.Group {
  const g = new THREE.Group();
  const strakes = hullStrakes();
  const hull = new THREE.Mesh(hullGeometry(), new THREE.MeshLambertMaterial({ map: strakes, flatShading: true, side: THREE.DoubleSide }));
  const deck = new THREE.Mesh(deckGeometry(), new THREE.MeshLambertMaterial({ map: deckPlanks() }));
  const rail = new THREE.Mesh(railGeometry(), new THREE.MeshLambertMaterial({ color: PAL.woodDark, flatShading: true, side: THREE.DoubleSide }));
  g.add(hull, deck, rail);
  return g;
}
