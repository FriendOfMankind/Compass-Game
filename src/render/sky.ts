import * as THREE from 'three';

// M0 placeholder sky: vertical gradient dome whose colours follow time of day.
// No sun or stars yet (M2). Daylight is a crude function of hour, not real solar altitude.

interface Palette { zenith: THREE.Color; horizon: THREE.Color; }

const NIGHT: Palette = { zenith: new THREE.Color('#02040d'), horizon: new THREE.Color('#0c1730') };
const TWILIGHT: Palette = { zenith: new THREE.Color('#1c2a5a'), horizon: new THREE.Color('#f08a4b') };
const DAY: Palette = { zenith: new THREE.Color('#2a7fd4'), horizon: new THREE.Color('#bfe6f5') };

/** 0 = full night, 1 = full day. Sunrise ~6h, sunset ~18h, ~1h of twilight each side. */
export function daylight(hour: number): number {
  const sunHeight = Math.sin(((hour - 6) / 12) * Math.PI); // +1 at noon, −1 at midnight
  return THREE.MathUtils.smoothstep(sunHeight, -0.2, 0.25);
}

function paletteFor(hour: number): Palette {
  const d = daylight(hour);
  // Twilight weight peaks near d = 0.5 (dawn/dusk).
  const t = 1 - Math.abs(d - 0.5) * 2;
  const base = { zenith: NIGHT.zenith.clone().lerp(DAY.zenith, d), horizon: NIGHT.horizon.clone().lerp(DAY.horizon, d) };
  return {
    zenith: base.zenith.lerp(TWILIGHT.zenith, t * 0.5),
    horizon: base.horizon.lerp(TWILIGHT.horizon, t * 0.75),
  };
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
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Updates colours; returns the horizon colour so fog/ocean can match it. */
  update(hour: number, camWorldPos: THREE.Vector3): THREE.Color {
    const p = paletteFor(hour);
    this.uniforms.uZenith.value.copy(p.zenith);
    this.uniforms.uHorizon.value.copy(p.horizon);
    this.mesh.position.copy(camWorldPos);
    return p.horizon;
  }
}

/** Crude placeholder sun: rises due east at 6h, sets due west at 18h, slightly south. Real sun in M2. */
export function sunDirection(hour: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = ((hour - 6) / 12) * Math.PI;
  return out.set(Math.cos(a), Math.max(Math.sin(a), 0.05), 0.35).normalize();
}
