import * as THREE from 'three';

// First-person camera that rides the ship (parented to Ship.root).
// Yaw is relative to the bow (0 = looking forward, + = turned to starboard).

export const EYE_HEIGHT_M = 1.7;
const MAX_PITCH_RAD = THREE.MathUtils.degToRad(85);
const MOUSE_SENS_RAD = 0.0022;
/** Fraction of hull roll the head cancels out (people keep their eyes level-ish). */
const ROLL_COMPENSATION = 0.5;

export class FirstPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Parent this to the ship. Carries eye position + roll compensation in BOAT axes,
   *  so the compensation is correct whichever way the head is turned. */
  readonly rig = new THREE.Group();
  yawRad = 0;
  pitchRad = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 6000);
    this.camera.rotation.order = 'YXZ';
    this.rig.add(this.camera);
  }

  look(dxPx: number, dyPx: number): void {
    this.yawRad += dxPx * MOUSE_SENS_RAD;
    this.pitchRad = THREE.MathUtils.clamp(this.pitchRad - dyPx * MOUSE_SENS_RAD, -MAX_PITCH_RAD, MAX_PITCH_RAD);
  }

  /** Place the eye in boat-local coordinates. hullRollRad: the ship root's rotation.z. */
  place(localX: number, deckY: number, localZ: number, hullRollRad: number): void {
    this.rig.position.set(localX, deckY + EYE_HEIGHT_M, localZ);
    this.rig.rotation.set(0, 0, -hullRollRad * ROLL_COMPENSATION);
    this.camera.rotation.set(this.pitchRad, -this.yawRad, 0);
  }

  attachPointerLock(element: HTMLElement): void {
    element.addEventListener('click', () => element.requestPointerLock());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === element) this.look(e.movementX, e.movementY);
    });
  }
}
