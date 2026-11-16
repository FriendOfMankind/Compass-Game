import * as THREE from 'three';
import { DECK_HALF_LENGTH, hullHalfWidth } from '../sim/deck';
import { PAL } from './palette';
import { DECK_Y, BULWARK_Y } from './shipHull';
import { sailCloth } from './textures';

// Mast, bowsprit, boom + mainsail, pennant and standing rigging.
// The sail is a triangle fan around a centre vertex we push out (billow) or shake (luff).

export const MAST_Z = -1.2;
const MAST_HEIGHT = 11;
const BOOM_Y = DECK_Y + 2.15;
const BOOM_LENGTH = 5.2;
const ROPE_R = 0.014;

const flat = (color: string, side: THREE.Side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color, flatShading: true, side });

/** A straight rope (thin cylinder) between two boat-local points. */
function rope(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, len, 4), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

export class Rig {
  readonly group = new THREE.Group();
  private readonly boomPivot = new THREE.Group();
  private readonly sail: THREE.Mesh;
  private readonly sailPos: THREE.BufferAttribute;
  private readonly pennant = new THREE.Mesh();

  constructor() {
    const spar = flat(PAL.woodDark);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, MAST_HEIGHT, 8), spar);
    mast.position.set(0, DECK_Y + MAST_HEIGHT / 2, MAST_Z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8), flat(PAL.iron));
    cap.position.set(0, DECK_Y + MAST_HEIGHT - 0.6, MAST_Z);

    const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), spar);
    // Axis points forward and slightly up, its aft end tucked into the stem.
    const sprit = 0.26;
    bowsprit.rotation.x = -(Math.PI / 2 - sprit);
    bowsprit.position.set(0, BULWARK_Y - 0.15 + Math.sin(sprit) * 0.9, -DECK_HALF_LENGTH + 0.2 - Math.cos(sprit) * 0.9);
    const spritTip = new THREE.Vector3(0, BULWARK_Y - 0.15 + Math.sin(sprit) * 2, -DECK_HALF_LENGTH + 0.2 - Math.cos(sprit) * 2);

    // Boom + mainsail rotate together around the mast.
    this.boomPivot.position.set(0, 0, MAST_Z);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, BOOM_LENGTH, 6), spar);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, BOOM_Y, BOOM_LENGTH / 2);
    const tack = [0, BOOM_Y + 0.05, 0.1], head = [0, DECK_Y + MAST_HEIGHT - 0.3, 0.1], clew = [0, BOOM_Y + 0.05, BOOM_LENGTH];
    const mid = [0, (tack[1] + head[1] + clew[1]) / 3, (tack[2] + head[2] + clew[2]) / 3];
    const sg = new THREE.BufferGeometry();
    const tri = [tack, head, mid, head, clew, mid, clew, tack, mid];
    sg.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
    // UV: u along the boom, v up the luff, so cloth seams run roughly horizontal.
    const vH = head[1] - tack[1];
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(tri.flatMap((p) => [p[2] / BOOM_LENGTH, (p[1] - tack[1]) / vH]), 2));
    sg.computeVertexNormals();
    this.sail = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ map: sailCloth(), flatShading: true, side: THREE.DoubleSide }));
    this.sailPos = sg.attributes.position as THREE.BufferAttribute;
    this.boomPivot.add(boom, this.sail);

    // Pennant at the masthead: a small red triangle that streams downwind.
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.18, 0, 0, -0.18, 0, 0, 0, 1.4], 3));
    pg.computeVertexNormals();
    this.pennant.geometry = pg;
    this.pennant.material = flat(PAL.red, THREE.DoubleSide);
    this.pennant.position.set(0, DECK_Y + MAST_HEIGHT + 0.1, MAST_Z);

    // Standing rigging: shrouds to each rail just abaft the mast, forestay to the sprit, backstay to the transom.
    const ropeMat = flat(PAL.rope);
    const hounds = new THREE.Vector3(0, DECK_Y + MAST_HEIGHT - 0.6, MAST_Z);
    const chainZ = MAST_Z + 0.5, w = hullHalfWidth(chainZ);
    const ropes = [
      rope(hounds, new THREE.Vector3(w, BULWARK_Y, chainZ), ropeMat),
      rope(hounds, new THREE.Vector3(-w, BULWARK_Y, chainZ), ropeMat),
      rope(hounds, new THREE.Vector3(w, BULWARK_Y, chainZ + 0.6), ropeMat),
      rope(hounds, new THREE.Vector3(-w, BULWARK_Y, chainZ + 0.6), ropeMat),
      rope(hounds, spritTip, ropeMat),
    ];
    // Ratlines would be nice; skipped (lots of tiny meshes for little gain at this distance).

    this.group.add(mast, cap, bowsprit, this.boomPivot, this.pennant, ...ropes);
  }

  /**
   * trimDeg: boom angle off centreline. windSide: +1 wind over starboard (boom goes to port).
   * windRelDeg: direction the wind blows TOWARD, relative to the bow, clockwise.
   */
  update(t: number, trimDeg: number, windSide: number, luffing: boolean, efficiency: number, windRelDeg: number): void {
    // Boom swings to leeward. Boom points aft (+Z); rotating +Y swings the aft end toward +X.
    const target = THREE.MathUtils.degToRad(trimDeg) * -windSide;
    this.boomPivot.rotation.y += (target - this.boomPivot.rotation.y) * 0.08;

    // Billow to leeward when drawing, flap when luffing. Local +X here is the boom's starboard side.
    const billow = luffing ? Math.sin(t * 23) * 0.45 + Math.sin(t * 37) * 0.2 : 0.9 * efficiency * -windSide;
    for (const i of [2, 5, 8]) this.sailPos.setX(i, billow);
    this.sailPos.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();

    // Pennant: geometry streams toward +Z, so rotate so +Z points along the wind-to direction.
    const rel = THREE.MathUtils.degToRad(windRelDeg);
    this.pennant.rotation.y = Math.PI - rel + Math.sin(t * 9) * 0.08;
  }
}
