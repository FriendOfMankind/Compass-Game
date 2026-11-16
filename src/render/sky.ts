import * as THREE from 'three';

// Sky gradient dome. Colours follow the REAL sun altitude (from astro/), so dusk at
// 20°N and 20°S differ correctly and longitude shifts local time.

interface Palette { zenith: THREE.Color; horizon: THREE.Color; }

const NIGHT: Palette = { zenith: new THREE.Color('#010208'), horizon: new THREE.Color('#070d1c') };
const TWILIGHT: Palette = { zenith: new THREE.Color('#1c2a5a'), horizon: new THREE.Color('#f08a4b') };
const DAY: Palette = { zenith: new THREE.Color('#2a7fd4'), horizon: new THREE.Color('#bfe6f5') };

/** 0 = full night (sun below −12°, nautical twilight over), 1 = full day (sun above +6°). */
export function daylightFromSunAlt(sunAltDeg: number): number {
  return THREE.MathUtils.smoothstep(sunAltDeg, -12, 6);
}

/** How visible stars are: 0 in daylight, 1 once the sun is below −10° (DESIGN: stars are a night tool). */
export function starVisibility(sunAltDeg: number): number {
  return 1 - THREE.MathUtils.smoothstep(sunAltDeg, -10, -2);
}

function paletteFor(sunAltDeg: number): Palette {
  const d = daylightFromSunAlt(sunAltDeg);
  const t = Math.max(0, 1 - Math.abs(sunAltDeg + 2) / 8); // twilight glow peaks with the sun just under the horizon
  const zenith = NIGHT.zenith.clone().lerp(DAY.zenith, d).lerp(TWILIGHT.zenith, t * 0.45);
  const horizon = NIGHT.horizon.clone().lerp(DAY.horizon, d).lerp(TWILIGHT.horizon, t * 0.7);
  return { zenith, horizon };
}

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: { uZenith: { value: THREE.Color }; uHorizon: { value: THREE.Color } };

  constructor() {
    this.uniforms = { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // pin to far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    this.mesh.scale.setScalar(1000);
    this.mesh.renderOrder = -2;
    this.mesh.frustumCulled = false;
  }

  /** Returns the horizon colour so fog/water can match it. */
  update(sunAltDeg: number, camWorldPos: THREE.Vector3): THREE.Color {
    const p = paletteFor(sunAltDeg);
    this.uniforms.uZenith.value.copy(p.zenith);
    this.uniforms.uHorizon.value.copy(p.horizon);
    this.mesh.position.copy(camWorldPos);
    return p.horizon;
  }
}
