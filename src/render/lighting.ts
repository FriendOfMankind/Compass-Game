import * as THREE from 'three';
import { LANTERN_LOCAL } from './shipProps';

// Scene lighting: sky/sea fill, a sun that follows the REAL sun direction (from astro/)
// and casts shadows on the ship only, and a warm deck lantern that fades in at night.
// Shadow frustum is small and follows the boat, so it stays sharp and cheap.

const SHADOW_HALF_M = 9;      // covers the deck + sail
const SUN_DIST_M = 40;

export class Lighting {
  private readonly hemi = new THREE.HemisphereLight(0xd8ecff, 0x2a4a5a, 1);
  private readonly sun = new THREE.DirectionalLight(0xfff0d8, 1);
  private readonly lantern = new THREE.PointLight(0xffb35c, 0, 9, 1.6);
  private readonly sunColDay = new THREE.Color(0xfff2dc);
  private readonly sunColLow = new THREE.Color(0xffa060);

  constructor(scene: THREE.Scene, shipRoot: THREE.Object3D, renderer: THREE.WebGLRenderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Neutral keeps the palette honest (ACES shifts the Kenney colours toward orange).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;

    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = s.camera.bottom = -SHADOW_HALF_M;
    s.camera.right = s.camera.top = SHADOW_HALF_M;
    s.camera.near = 1; s.camera.far = SUN_DIST_M * 2;
    s.bias = -0.0005; s.normalBias = 0.03;
    this.sun.castShadow = true;
    scene.add(this.hemi, this.sun, this.sun.target);

    // Lantern light rides the ship (boat-local), just aft of the lantern mesh so the mast doesn't shadow the deck.
    this.lantern.position.copy(LANTERN_LOCAL).add(new THREE.Vector3(0, 0, 0.15));
    shipRoot.add(this.lantern);
  }

  /** daylight 0..1, sunDir: unit vector toward the sun (world), shipPos: where shadows are needed. */
  update(daylight: number, sunAltDeg: number, sunDir: THREE.Vector3, shipPos: THREE.Vector3): void {
    this.hemi.intensity = 0.25 + 1.0 * daylight;
    // Low sun → warmer light; below the horizon the sun light is off entirely.
    const above = THREE.MathUtils.smoothstep(sunAltDeg, -1, 3);
    this.sun.intensity = 2.2 * daylight * above;
    this.sun.color.copy(this.sunColLow).lerp(this.sunColDay, THREE.MathUtils.smoothstep(sunAltDeg, 2, 25));
    this.sun.position.copy(shipPos).addScaledVector(sunDir, SUN_DIST_M);
    this.sun.target.position.copy(shipPos);

    const night = 1 - THREE.MathUtils.smoothstep(daylight, 0.05, 0.5);
    this.lantern.intensity = 2.5 * night;
  }
}
