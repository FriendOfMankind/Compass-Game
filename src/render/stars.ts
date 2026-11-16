import * as THREE from 'three';
import { STARS, bvToRgb, starByHip } from '../astro/stars';
import { equatorialVector } from '../astro/transform';
import { CONSTELLATIONS } from '../data/constellations';
import { buildSkyMarkers } from './skyMarkers';

// Star sphere: stars are placed ONCE in the fixed equatorial frame, then the whole group is
// rotated by astro/transform.equatorialToWorldMatrix (tested against equatorialToHorizontal).

const RADIUS = 900; // inside the sky dome (1000), well past the boat

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uVisibility;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 dir = normalize(world.xyz - cameraPosition);
    // Horizon extinction: stars fade in the bottom few degrees, and vanish below.
    float ext = smoothstep(-0.005, 0.12, dir.y);
    vColor = aColor;
    vAlpha = uVisibility * ext;
    gl_PointSize = aSize * uPixelRatio * (0.6 + 0.4 * ext);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float core = 1.0 - smoothstep(0.0, 1.0, r);
    float glow = core * core;
    gl_FragColor = vec4(vColor * (glow * 1.8 + core * 0.4), (glow + core * 0.3) * vAlpha);
  }`;

export class StarField {
  readonly group = new THREE.Group();
  readonly lines: THREE.LineSegments;
  readonly markers = buildSkyMarkers();
  private readonly material: THREE.ShaderMaterial;
  private readonly lineMaterial: THREE.LineBasicMaterial;
  private readonly m4 = new THREE.Matrix4();

  constructor(pixelRatio: number) {
    const pos = new Float32Array(STARS.length * 3);
    const col = new Float32Array(STARS.length * 3);
    const size = new Float32Array(STARS.length);
    STARS.forEach((s, i) => {
      const v = equatorialVector(s.raDeg, s.decDeg);
      pos.set([v[0] * RADIUS, v[1] * RADIUS, v[2] * RADIUS], i * 3);
      // Desaturate toward white: real star colours are subtle to the eye.
      const [r, g, b] = bvToRgb(s.bv);
      const bright = Math.pow(10, -0.4 * (s.mag - 1.5)); // relative flux
      const lum = Math.min(1.6, 0.3 + 0.9 * Math.sqrt(bright));
      col.set([(0.55 + 0.45 * r) * lum, (0.55 + 0.45 * g) * lum, (0.55 + 0.45 * b) * lum], i * 3);
      // Steep size curve: navigation stars (mag < 2.5) must pop out of the background clutter.
      size[i] = THREE.MathUtils.clamp(12 - 2.0 * s.mag, 2.4, 15);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio }, uVisibility: { value: 1 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, this.material);
    points.frustumCulled = false;

    const linePos: number[] = [];
    for (const c of CONSTELLATIONS) for (const [a, b] of c.lines) {
      for (const hip of [a, b]) {
        const s = starByHip(hip)!;
        const v = equatorialVector(s.raDeg, s.decDeg);
        linePos.push(v[0] * RADIUS * 0.999, v[1] * RADIUS * 0.999, v[2] * RADIUS * 0.999);
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.35, depthWrite: false });
    this.lines = new THREE.LineSegments(lg, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.lines.visible = false;

    this.group.add(points, this.lines, this.markers);
    this.group.matrixAutoUpdate = false;
    this.group.renderOrder = -1;
    points.renderOrder = -1;
  }

  /** m3: column-major 3×3 from equatorialToWorldMatrix. */
  update(m3: number[], camWorldPos: THREE.Vector3, visibility: number): void {
    this.m4.set(
      m3[0], m3[3], m3[6], camWorldPos.x,
      m3[1], m3[4], m3[7], camWorldPos.y,
      m3[2], m3[5], m3[8], camWorldPos.z,
      0, 0, 0, 1,
    );
    this.group.matrix.copy(this.m4);
    this.group.matrixWorldNeedsUpdate = true;
    this.material.uniforms.uVisibility.value = visibility;
    this.lineMaterial.opacity = 0.35 * visibility;
    this.group.visible = visibility > 0.001;
  }
}
