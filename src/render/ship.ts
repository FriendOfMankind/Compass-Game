import * as THREE from 'three';
import { DECK_HALF_LENGTH, hullHalfWidth } from '../sim/deck';

// Low-poly sloop, generated in code. Boat-local axes: +X starboard, −Z bow, +Y up.
// Hull outline is derived from sim/deck.ts so the walkable area matches the mesh.

export const DECK_Y = 1.1;
const BULWARK_Y = 1.5;
const KEEL_Y = -0.9;
const MAST_Z = -1.2;
const MAST_HEIGHT = 11;
const BOOM_Y = DECK_Y + 2.15;
const BOOM_LENGTH = 5.2;

const flat = (color: string, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, side });

function hullGeometry(): THREE.BufferGeometry {
  const zs: number[] = [];
  // Denser sections near the bow, where the width changes fastest.
  for (let i = 0; i <= 18; i++) zs.push(-DECK_HALF_LENGTH + (i / 18) ** 1.6 * 2 * DECK_HALF_LENGTH);
  // Section profile from port bulwark → keel → starboard bulwark.
  const section = (z: number) => {
    const w = Math.max(0.02, hullHalfWidth(z));
    const keel = KEEL_Y * Math.min(1, 0.25 + (z + DECK_HALF_LENGTH) / 2.5);
    return [
      [-w, BULWARK_Y], [-w * 0.95, 0.35], [-w * 0.5, keel * 0.7], [0, keel],
      [w * 0.5, keel * 0.7], [w * 0.95, 0.35], [w, BULWARK_Y],
    ];
  };
  const verts: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => verts.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < zs.length - 1; i++) {
    const s0 = section(zs[i]), s1 = section(zs[i + 1]);
    for (let j = 0; j < s0.length - 1; j++) {
      quad([s0[j][0], s0[j][1], zs[i]], [s1[j][0], s1[j][1], zs[i + 1]],
           [s1[j + 1][0], s1[j + 1][1], zs[i + 1]], [s0[j + 1][0], s0[j + 1][1], zs[i]]);
    }
  }
  // Transom.
  const st = section(zs[zs.length - 1]), zt = zs[zs.length - 1];
  for (let j = 1; j < st.length - 1; j++) verts.push(st[0][0], st[0][1], zt, st[j][0], st[j][1], zt, st[j + 1][0], st[j + 1][1], zt);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

function deckGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const z = -DECK_HALF_LENGTH + (i / n) ** 1.6 * 2 * DECK_HALF_LENGTH;
    const p = [Math.max(0, hullHalfWidth(z) - 0.02), -z]; // shape is in XY; we map Y → −Z below
    if (i === 0) shape.moveTo(p[0], p[1]); else shape.lineTo(p[0], p[1]);
  }
  for (let i = n; i >= 0; i--) {
    const z = -DECK_HALF_LENGTH + (i / n) ** 1.6 * 2 * DECK_HALF_LENGTH;
    shape.lineTo(-Math.max(0, hullHalfWidth(z) - 0.02), -z);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, DECK_Y, 0);
  return g;
}

export class Ship {
  readonly root = new THREE.Group();     // positioned/rotated by the sim
  private readonly boomPivot = new THREE.Group();
  private readonly sail: THREE.Mesh;
  private readonly sailPos: THREE.BufferAttribute;
  private readonly wheel = new THREE.Group();
  private readonly pennant = new THREE.Mesh();

  constructor() {
    this.root.rotation.order = 'YXZ';
    const hull = new THREE.Mesh(hullGeometry(), flat('#7a4a2a', THREE.DoubleSide));
    const deck = new THREE.Mesh(deckGeometry(), flat('#c99c63'));

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, MAST_HEIGHT, 7), flat('#5c3a1e'));
    mast.position.set(0, DECK_Y + MAST_HEIGHT / 2, MAST_Z);

    const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), flat('#5c3a1e'));
    // Axis points forward and slightly up, its aft end tucked into the stem.
    const sprit = 0.26;
    bowsprit.rotation.x = -(Math.PI / 2 - sprit);
    bowsprit.position.set(0, BULWARK_Y - 0.15 + Math.sin(sprit) * 0.9, -DECK_HALF_LENGTH + 0.2 - Math.cos(sprit) * 0.9);

    // Boom + mainsail rotate together around the mast.
    this.boomPivot.position.set(0, 0, MAST_Z);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, BOOM_LENGTH, 6), flat('#5c3a1e'));
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, BOOM_Y, BOOM_LENGTH / 2);
    // Sail: triangle fan around a centre vertex we can push out (billow) or shake (luff).
    const tack = [0, BOOM_Y + 0.05, 0.1], head = [0, DECK_Y + MAST_HEIGHT - 0.3, 0.1], clew = [0, BOOM_Y + 0.05, BOOM_LENGTH];
    const mid = [0, (tack[1] + head[1] + clew[1]) / 3, (tack[2] + head[2] + clew[2]) / 3];
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([
      ...tack, ...head, ...mid, ...head, ...clew, ...mid, ...clew, ...tack, ...mid,
    ], 3));
    sg.computeVertexNormals();
    this.sail = new THREE.Mesh(sg, flat('#efe3c6', THREE.DoubleSide));
    this.sailPos = sg.attributes.position as THREE.BufferAttribute;
    this.boomPivot.add(boom, this.sail);

    // Helm: pedestal + wheel facing aft.
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), flat('#5c3a1e'));
    pedestal.position.set(0, DECK_Y + 0.45, 4.3);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 5, 14), flat('#8b5a2b'));
    this.wheel.add(rim);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 0.04), flat('#8b5a2b'));
      spoke.rotation.z = (i * Math.PI) / 4;
      this.wheel.add(spoke);
    }
    this.wheel.position.set(0, DECK_Y + 1.0, 4.45);

    // Pennant at the masthead: a small red triangle that streams downwind.
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.18, 0, 0, -0.18, 0, 0, 0, 1.4], 3));
    pg.computeVertexNormals();
    this.pennant.geometry = pg;
    this.pennant.material = flat('#d8402f', THREE.DoubleSide);
    this.pennant.position.set(0, DECK_Y + MAST_HEIGHT + 0.1, MAST_Z);

    // Chart table to port, abaft the mast.
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 1.0), flat('#6e4524'));
    table.position.set(-1.05, DECK_Y + 0.425, 2.2);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), flat('#e9dcb8'));
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(-1.05, DECK_Y + 0.855, 2.2);
    this.root.add(table, paper);

    this.root.add(hull, deck, mast, bowsprit, this.boomPivot, pedestal, this.wheel, this.pennant);
  }

  /**
   * trimDeg: boom angle off centreline. windSide: +1 wind over starboard (boom goes to port).
   * windRelDeg: direction the wind blows TOWARD, relative to the bow, clockwise.
   */
  update(t: number, trimDeg: number, windSide: number, luffing: boolean, efficiency: number, rudder: number, windRelDeg: number): void {
    // Boom swings to leeward. Boom points aft (+Z); rotating +Y swings the aft end toward +X.
    const target = THREE.MathUtils.degToRad(trimDeg) * -windSide;
    this.boomPivot.rotation.y += (target - this.boomPivot.rotation.y) * 0.08;

    // Billow to leeward when drawing, flap when luffing. Local +X here is the boom's starboard side.
    const billow = luffing ? Math.sin(t * 23) * 0.45 + Math.sin(t * 37) * 0.2 : 0.9 * efficiency * -windSide;
    for (const i of [2, 5, 8]) this.sailPos.setX(i, billow);
    this.sailPos.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();

    this.wheel.rotation.z = -rudder * 2.5;
    // Pennant: geometry streams toward +Z, so rotate so +Z points along the wind-to direction.
    const rel = THREE.MathUtils.degToRad(windRelDeg);
    this.pennant.rotation.y = Math.PI - rel + Math.sin(t * 9) * 0.08;
  }
}
