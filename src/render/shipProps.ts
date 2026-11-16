import * as THREE from 'three';
import { PAL } from './palette';
import { DECK_Y } from './shipHull';
import { MAST_Z } from './shipRig';
import { chartPaper, compassCard } from './textures';
import { placeKit } from './models';

// Deck furniture: helm + wheel, brass binnacle (a real compass card that reads the
// COMPASS heading, deviation included), chart table, mast lantern, kit barrels/crates.

export const LANTERN_LOCAL = new THREE.Vector3(0, DECK_Y + 1.75, MAST_Z + 0.2);
const BINNACLE = { x: 0.62, z: 3.95, h: 1.0 };

/** Lantern glass: render/lighting.ts dims it by day (a MeshBasic box would glow at noon). */
export const LANTERN_GLASS = new THREE.MeshBasicMaterial({ color: PAL.lantern });

const flat = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });

export class Props {
  readonly group = new THREE.Group();
  readonly wheel = new THREE.Group();
  private readonly card = new THREE.Group();

  constructor() {
    const wood = flat(PAL.wood), dark = flat(PAL.woodDark), brass = new THREE.MeshLambertMaterial({ color: PAL.brass, emissive: PAL.brassDark, emissiveIntensity: 0.35, flatShading: true });

    // Helm: pedestal + 8-spoke wheel with handles, facing aft.
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.22), dark);
    pedestal.position.set(0, DECK_Y + 0.475, 4.3);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 5, 16), wood);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), brass);
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(rim, hub);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 5), wood);
      spoke.position.set(Math.sin(a) * 0.28, Math.cos(a) * 0.28, 0);
      spoke.rotation.z = -a;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.14, 5), dark);
      handle.position.set(Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0);
      handle.rotation.z = -a;
      this.wheel.add(spoke, handle);
    }
    this.wheel.position.set(0, DECK_Y + 1.0, 4.45);

    // Binnacle: wooden post, brass bowl, card under glass, red lubber line toward the bow.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, BINNACLE.h - 0.12, 8), dark);
    post.position.set(BINNACLE.x, DECK_Y + (BINNACLE.h - 0.12) / 2, BINNACLE.z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.14, 12), brass);
    bowl.position.set(BINNACLE.x, DECK_Y + BINNACLE.h - 0.05, BINNACLE.z);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.145, 32), new THREE.MeshBasicMaterial({ map: compassCard() }));
    face.rotation.x = -Math.PI / 2;
    this.card.add(face);
    this.card.position.set(BINNACLE.x, DECK_Y + BINNACLE.h + 0.025, BINNACLE.z);
    const lubber = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.03), flat(PAL.red));
    lubber.position.set(BINNACLE.x, DECK_Y + BINNACLE.h + 0.03, BINNACLE.z - 0.16);
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, shininess: 120, depthWrite: false }),
    );
    glass.position.set(BINNACLE.x, DECK_Y + BINNACLE.h + 0.02, BINNACLE.z);
    glass.scale.y = 0.5;

    // Chart table: top + four legs, a chart on it, rail around the edge.
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 1.0), wood);
    top.position.set(-1.05, DECK_Y + 0.85, 2.2);
    const legs = [[-0.3, -0.44], [0.3, -0.44], [-0.3, 0.44], [0.3, 0.44]].map(([dx, dz]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), dark);
      l.position.set(-1.05 + dx, DECK_Y + 0.41, 2.2 + dz);
      return l;
    });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshLambertMaterial({ map: chartPaper() }));
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(-1.05, DECK_Y + 0.885, 2.2);

    // Lantern hung on the aft face of the mast (the light itself lives in render/lighting.ts).
    const lamp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), flat(PAL.iron));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.17), LANTERN_GLASS);
    const lid = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 4), flat(PAL.iron));
    lid.position.y = 0.17; lid.rotation.y = Math.PI / 4;
    lamp.add(frame, glow, lid);
    lamp.position.copy(LANTERN_LOCAL);

    this.group.add(pedestal, this.wheel, post, bowl, this.card, lubber, glass, top, ...legs, paper, lamp);
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== glass) { o.castShadow = true; o.receiveShadow = true; } });

    // Cargo from the Kenney kit, kept clear of the stations and the walkway.
    placeKit(this.group, 'barrel', -0.82, DECK_Y, -2.7, 0.55, 0.4);
    placeKit(this.group, 'barrel', -0.62, DECK_Y, -3.35, 0.5, 1.3);
    placeKit(this.group, 'crate', 0.8, DECK_Y, -2.85, 0.55, 0.25);
  }

  /** compassDeg: the compass READING. The card stays pointed at (magnetic) north. */
  update(rudder: number, compassDeg: number): void {
    this.wheel.rotation.z = -rudder * 2.5;
    this.card.rotation.y = THREE.MathUtils.degToRad(compassDeg);
  }
}
