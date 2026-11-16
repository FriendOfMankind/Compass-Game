import * as THREE from 'three';
import { WAVES } from '../sim/waves';

// Gerstner water. Wave parameters come from sim/waves.ts (same data the CPU buoyancy uses).
// Grid is denser near the centre (follows the camera, snapped to avoid swimming);
// wave amplitude fades with distance so coarse far cells don't alias.

const HALF_EXTENT = 3000;
const SEGMENTS = 300;
const SNAP_M = 4;

function buildGrid(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(2, 2, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const remap = (u: number) => HALF_EXTENT * (0.08 * u + 0.92 * u * Math.abs(u) ** 2);
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, remap(pos.getX(i)), 0, remap(pos.getZ(i)));
  geo.computeBoundingSphere();
  return geo;
}

const N = WAVES.length;

const vertexShader = /* glsl */ `
  uniform vec4 uWaveA[${N}]; // dirX, dirZ, k, amp
  uniform vec4 uWaveB[${N}]; // q, omega, phase, -
  uniform float uTime;
  uniform vec3 uCamPos;
  varying vec3 vWorld;
  varying float vCrest;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec2 p0 = wp.xz;
    float fade = 1.0 - smoothstep(250.0, 1400.0, distance(p0, uCamPos.xz));
    vec3 d = vec3(0.0);
    for (int i = 0; i < ${N}; i++) {
      vec4 a = uWaveA[i]; vec4 b = uWaveB[i];
      float th = a.z * dot(a.xy, p0) - b.y * uTime + b.z;
      float c = cos(th);
      d.x += b.x * a.w * a.x * c;
      d.z += b.x * a.w * a.y * c;
      d.y += a.w * sin(th);
    }
    d *= fade;
    wp.xyz += d;
    vWorld = wp.xyz;
    vCrest = d.y;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uDaylight;
  uniform vec3 uCamPos;
  varying vec3 vWorld;
  varying float vCrest;
  #include <fog_pars_fragment>
  void main() {
    // Flat shading from screen-space derivatives: low-poly look for free.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;
    vec3 v = normalize(uCamPos - vWorld);
    float diffuse = max(dot(n, uSunDir), 0.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 base = mix(uDeep, uShallow, clamp(vCrest * 0.6 + 0.45, 0.0, 1.0));
    vec3 col = base * (0.35 + 0.65 * diffuse * uDaylight + 0.15);
    col = mix(col, uSky, clamp(fresnel * 0.7, 0.0, 0.7));
    vec3 h = normalize(uSunDir + v);
    col += vec3(1.0, 0.95, 0.8) * pow(max(dot(n, h), 0.0), 90.0) * 0.6 * uDaylight;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly u: Record<string, THREE.IUniform>;
  private readonly dayDeep = new THREE.Color('#093a57');
  private readonly dayShallow = new THREE.Color('#1d859e');
  private readonly nightDeep = new THREE.Color('#06121f');
  private readonly nightShallow = new THREE.Color('#0f2a40');

  constructor() {
    this.u = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uWaveA: { value: WAVES.map((w) => new THREE.Vector4(w.dirX, w.dirZ, w.k, w.amp)) },
        uWaveB: { value: WAVES.map((w) => new THREE.Vector4(w.q, w.omega, w.phase, 0)) },
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uDeep: { value: new THREE.Color() },
        uShallow: { value: new THREE.Color() },
        uSky: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.5).normalize() },
        uDaylight: { value: 1 },
      },
    ]);
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader, fragmentShader, fog: true });
    this.mesh = new THREE.Mesh(buildGrid(), mat);
    this.mesh.frustumCulled = false;
  }

  update(waveTime: number, camPos: THREE.Vector3, horizon: THREE.Color, daylight: number, sunDir: THREE.Vector3): void {
    this.u.uTime.value = waveTime;
    (this.u.uCamPos.value as THREE.Vector3).copy(camPos);
    (this.u.uDeep.value as THREE.Color).copy(this.nightDeep).lerp(this.dayDeep, daylight);
    (this.u.uShallow.value as THREE.Color).copy(this.nightShallow).lerp(this.dayShallow, daylight);
    (this.u.uSky.value as THREE.Color).copy(horizon);
    (this.u.uSunDir.value as THREE.Vector3).copy(sunDir);
    this.u.uDaylight.value = daylight;
    this.mesh.position.set(Math.round(camPos.x / SNAP_M) * SNAP_M, 0, Math.round(camPos.z / SNAP_M) * SNAP_M);
  }
}
