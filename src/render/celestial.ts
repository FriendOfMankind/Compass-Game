import * as THREE from 'three';
import { lstDeg, sunEquatorial } from '../astro/time';
import { equatorialToHorizontal, equatorialToWorldMatrix, horizontalToVector } from '../astro/transform';
import { Sky, daylightFromSunAlt, starVisibility } from './sky';
import { StarField } from './stars';

// Everything above the horizon: gradient sky, sun, stars, constellation lines.
// One call per frame with the Julian date and the observer's lat/lon.

export interface CelestialState {
  horizon: THREE.Color;
  daylight: number;
  sunDir: THREE.Vector3;
  sunAltDeg: number;
  lstDeg: number;
}

export class Celestial {
  private readonly sky = new Sky();
  readonly stars: StarField;
  private readonly sun: THREE.Mesh;
  private readonly sunDir = new THREE.Vector3();

  constructor(scene: THREE.Scene, pixelRatio: number) {
    this.stars = new StarField(pixelRatio);
    this.sun = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false, depthWrite: false }),
    );
    this.sun.renderOrder = -1;
    scene.add(this.sky.mesh, this.stars.group, this.sun);
  }

  get linesVisible(): boolean { return this.stars.lines.visible; }
  set linesVisible(v: boolean) { this.stars.lines.visible = v; }

  update(jd: number, latDeg: number, lonDeg: number, camWorldPos: THREE.Vector3): CelestialState {
    const lst = lstDeg(jd, lonDeg);
    const sunEq = sunEquatorial(jd);
    const sunHz = equatorialToHorizontal(sunEq.raDeg, sunEq.decDeg, latDeg, lst);
    this.sunDir.set(...horizontalToVector(sunHz.altDeg, sunHz.azDeg));

    const horizon = this.sky.update(sunHz.altDeg, camWorldPos);
    this.stars.update(equatorialToWorldMatrix(latDeg, lst), camWorldPos, starVisibility(sunHz.altDeg));

    this.sun.visible = sunHz.altDeg > -1;
    this.sun.position.copy(camWorldPos).addScaledVector(this.sunDir, 950);
    this.sun.lookAt(camWorldPos);

    return { horizon, daylight: daylightFromSunAlt(sunHz.altDeg), sunDir: this.sunDir, sunAltDeg: sunHz.altDeg, lstDeg: lst };
  }
}
