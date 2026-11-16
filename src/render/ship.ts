import * as THREE from 'three';
import { buildHull, DECK_Y } from './shipHull';
import { Rig } from './shipRig';
import { Props } from './shipProps';

// The player's sloop: hull + deck (shipHull), mast/sail/rigging (shipRig), deck furniture (shipProps).
// Boat-local axes: +X starboard, −Z bow, +Y up. `root` is positioned/rotated by the sim.

export { DECK_Y };

export class Ship {
  readonly root = new THREE.Group();
  private readonly rig = new Rig();
  private readonly props = new Props();
  private compassDeg = 0;

  constructor() {
    this.root.rotation.order = 'YXZ';
    const hull = buildHull();
    hull.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.rig.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.root.add(hull, this.rig.group, this.props.group);
  }

  /** The binnacle card shows the compass READING (deviation included), not the truth. */
  setCompass(readingDeg: number): void { this.compassDeg = readingDeg; }

  /**
   * trimDeg: boom angle off centreline. windSide: +1 wind over starboard (boom goes to port).
   * windRelDeg: direction the wind blows TOWARD, relative to the bow, clockwise.
   */
  update(t: number, trimDeg: number, windSide: number, luffing: boolean, efficiency: number, rudder: number, windRelDeg: number): void {
    this.rig.update(t, trimDeg, windSide, luffing, efficiency, windRelDeg);
    this.props.update(rudder, this.compassDeg);
  }
}
