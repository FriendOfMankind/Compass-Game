import * as THREE from 'three';

// First-person look. Convention: +Y up, −Z = north, +X = east.
// Heading 0° = north, 90° = east (compass convention).

export const EYE_HEIGHT_M = 2.5;
const MAX_PITCH_RAD = THREE.MathUtils.degToRad(89);
const MOUSE_SENS_RAD = 0.0022;

export class FirstPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yawRad = 0;   // radians, compass heading
  private pitchRad = 0; // radians, + is up

  constructor(aspect: number, headingDeg: number) {
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 5000);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_HEIGHT_M, 0);
    this.yawRad = THREE.MathUtils.degToRad(headingDeg);
    this.apply();
  }

  get headingDeg(): number {
    return ((THREE.MathUtils.radToDeg(this.yawRad) % 360) + 360) % 360;
  }

  get pitchDeg(): number {
    return THREE.MathUtils.radToDeg(this.pitchRad);
  }

  look(dxPx: number, dyPx: number): void {
    this.yawRad += dxPx * MOUSE_SENS_RAD;
    this.pitchRad = THREE.MathUtils.clamp(this.pitchRad - dyPx * MOUSE_SENS_RAD, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    this.apply();
  }

  private apply(): void {
    // Three.js yaw is counter-clockwise from −Z; compass heading is clockwise.
    this.camera.rotation.set(this.pitchRad, -this.yawRad, 0);
  }

  attachPointerLock(element: HTMLElement): void {
    element.addEventListener('click', () => element.requestPointerLock());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === element) this.look(e.movementX, e.movementY);
    });
  }
}
