// Cloud layer (DESIGN §6 weather, M6): a dome of drifting value-noise clouds between the stars
// and the ship. Coverage 0 = clear; ~0.6 = most of the sky hidden, with gaps to sight through.
// Clouds are dark at night (they hide stars rather than glow), white by day, warm at twilight.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;

const fragmentShader = /* glsl */ `
  uniform float uCover;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    if (vDir.y < 0.0 || uCover <= 0.001) discard;
    // Project onto a flat cloud deck overhead: clouds bunch up toward the horizon like real ones.
    vec2 uv = vDir.xz / (vDir.y + 0.12) * 1.6 + vec2(uTime * 0.02, uTime * 0.007);
    float n = fbm(uv);
    float a = smoothstep(1.0 - uCover - 0.08, 1.0 - uCover + 0.12, n);
    a *= smoothstep(0.0, 0.08, vDir.y); // fade into the horizon haze
    gl_FragColor = vec4(uColor * (0.85 + 0.3 * n), a * 0.97);
    #include <colorspace_fragment>
  }`;

const NIGHT = new THREE.Color('#0b1020'), DUSK = new THREE.Color('#8a5a4a'), DAY = new THREE.Color('#eef2f6');

export class Clouds {
  readonly mesh: THREE.Mesh;
  private readonly u = { uCover: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color() } };

  constructor() {
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.mesh.scale.setScalar(900);
    this.mesh.renderOrder = -0.5; // after sky (−2) and stars (−1), before the world
    this.mesh.frustumCulled = false;
  }

  set cover(c: number) { this.u.uCover.value = Math.max(0, Math.min(0.85, c)); }
  get cover(): number { return this.u.uCover.value; }

  /** gameS drives the drift (clouds race under time warp, which is honest). */
  update(camPos: THREE.Vector3, gameS: number, daylight: number, sunAltDeg: number): void {
    this.mesh.position.copy(camPos);
    this.u.uTime.value = (gameS / 72) % 100000; // ~real seconds at 1×
    const dusk = Math.max(0, 1 - Math.abs(sunAltDeg + 1) / 8);
    this.u.uColor.value.copy(NIGHT).lerp(DAY, daylight).lerp(DUSK, dusk * 0.5);
  }
}
