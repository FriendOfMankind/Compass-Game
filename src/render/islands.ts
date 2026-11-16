// Island meshes: low-poly terrain from world/terrain.ts (vertex-coloured sand → grass → rock),
// Kenney palms/rocks scattered on land, reef rocks around the ring (with a visible gap = the pass),
// and a dock + huts + flag on port islands. Everything hazes out with distance (render/haze.ts).
import * as THREE from 'three';
import type { Island, World } from '../world/worldgen';
import { islandHeight } from '../world/terrain';
import { inPass } from '../world/hazards';
import { M_PER_DEG } from '../nav/dr';
import { mulberry32 } from '../util/rng';
import { loadKit } from './models';
import { applyHaze, hazeAll } from './haze';

const RINGS = 22, SEGS = 48;
const SHOW_WITHIN_M = 1500; // don't draw islands you couldn't see anyway
const SAND = new THREE.Color('#f1c48f'), GRASS = new THREE.Color('#5cb87f'), DARK_GRASS = new THREE.Color('#3f9a66'), ROCK = new THREE.Color('#868ba1');

function terrainMesh(isl: Island): THREE.Mesh {
  const maxR = isl.radiusM * 1.25;
  const pos: number[] = [], col: number[] = [];
  const pt = (ring: number, seg: number) => {
    const r = maxR * (ring / RINGS) ** 1.3, a = (seg / SEGS) * Math.PI * 2;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    return [x, islandHeight(isl, x, z), z];
  };
  const colour = (p: number[]) => {
    const h = p[1], k = h / Math.max(1, isl.heightM);
    if (h < 2.2) return SAND;
    if (isl.kind === 'peak' && k > 0.55) return ROCK;
    return k > 0.3 ? DARK_GRASS : GRASS;
  };
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      for (const tri of [[a, b, c], [a, c, d]]) {
        // Flat shading: one colour per face, from its highest vertex.
        const top = tri.reduce((m, v) => (v[1] > m[1] ? v : m));
        const cc = colour(top);
        for (const v of tri) { pos.push(...v); col.push(cc.r, cc.g, cc.b); }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  applyHaze(m);
  return new THREE.Mesh(g, m);
}

/** Drop a kit model onto the terrain at local (x, z); never casts shadows (too far from the ship's shadow box). */
function scatter(parent: THREE.Object3D, isl: Island, name: string, x: number, z: number, scale: number, rotY: number, sink = 0): void {
  loadKit(name).then((m) => {
    m.position.set(x, Math.max(0, islandHeight(isl, x, z)) - sink, z);
    m.scale.setScalar(scale);
    m.rotation.y = rotY;
    m.traverse((o) => { o.castShadow = false; });
    hazeAll(m);
    parent.add(m);
  }).catch(() => { /* missing model: island still works */ });
}

function decorate(g: THREE.Group, isl: Island): void {
  const rnd = mulberry32(isl.shapeSeed ^ 0x9a1);
  const palms = ['palm-detailed-straight', 'palm-detailed-bend', 'palm-straight', 'palm-bend'];
  const nPalms = Math.round(isl.radiusM / (isl.kind === 'atoll' ? 6 : 10));
  for (let i = 0, placed = 0; i < nPalms * 6 && placed < nPalms; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * isl.radiusM;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r, h = islandHeight(isl, x, z);
    if (h < 1.3 || h > isl.heightM * 0.5) continue; // palms like the lowland
    scatter(g, isl, palms[Math.floor(rnd() * palms.length)], x, z, 2.2 + rnd() * 1.2, rnd() * 6.28, 0.2);
    placed++;
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, r = isl.radiusM * (0.9 + rnd() * 0.15);
    scatter(g, isl, ['rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c'][i % 3], Math.sin(a) * r, -Math.cos(a) * r, 1.1 + rnd() * 0.9, rnd() * 6.28, 0.6);
  }
  if (isl.reefM > 0) {
    const ringR = isl.radiusM + isl.reefM;
    // Kit rocks are ~5 m across: shrink and squash them into a low, broken line of coral heads.
    for (let deg = 0; deg < 360; deg += 360 / Math.max(36, (ringR * 2 * Math.PI) / 11)) {
      if (inPass(deg, isl.reefGapDeg)) continue;
      const a = (deg * Math.PI) / 180, r = ringR + (rnd() - 0.5) * 10;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      // Draw every random number now: models load asynchronously, in any order.
      const name = ['rocks-sand-a', 'rocks-sand-b', 'rocks-c'][Math.floor(rnd() * 3)], sc = 0.7 + rnd() * 0.6, ry = rnd() * 6.28;
      loadKit(name).then((m) => {
        m.position.set(x, -0.9, z); m.scale.set(sc * 1.3, sc * 0.55, sc * 1.3); m.rotation.y = ry;
        m.traverse((o) => { o.castShadow = false; }); hazeAll(m); g.add(m);
      }).catch(() => {});
    }
  }
  if (isl.port) {
    // Dock on the side facing the pass (or south), huts above it, a flag on the high point.
    const a = ((isl.reefM > 0 ? isl.reefGapDeg : 180) * Math.PI) / 180;
    const dockR = isl.radiusM * 1.02;
    scatter(g, isl, 'structure-platform-dock', Math.sin(a) * dockR, -Math.cos(a) * dockR, 4, -a, 0.8);
    for (const [off, name] of [[-0.25, 'structure'], [0.2, 'structure-roof']] as const) {
      const r = isl.radiusM * 0.7;
      scatter(g, isl, name, Math.sin(a + off) * r, -Math.cos(a + off) * r, 3.5, -a, 0.3);
    }
    scatter(g, isl, 'flag-pirate-high', 0, 0, 5, 0, 0.5);
  }
}

export class Islands {
  readonly group = new THREE.Group();
  private readonly entries: { isl: Island; g: THREE.Group }[] = [];

  constructor(world: World) {
    for (const isl of world.islands) {
      const g = new THREE.Group();
      g.position.set(isl.lonDeg * M_PER_DEG, 0, -isl.latDeg * M_PER_DEG);
      g.add(terrainMesh(isl));
      g.visible = false;
      this.group.add(g);
      this.entries.push({ isl, g });
    }
    this.decorated = new Set();
  }
  private readonly decorated: Set<number>;

  /** Show only nearby islands; decorate (load kit models) the first time one comes into range. */
  update(camWorld: THREE.Vector3): void {
    for (const { isl, g } of this.entries) {
      const d = Math.hypot(camWorld.x - g.position.x, camWorld.z - g.position.z) - isl.radiusM;
      g.visible = d < SHOW_WITHIN_M;
      if (g.visible && !this.decorated.has(isl.id)) { this.decorated.add(isl.id); decorate(g, isl); }
    }
  }
}
