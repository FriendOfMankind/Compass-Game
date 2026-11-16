// Island haze: islands fade into the horizon colour over a SHORT range, independent of
// the scene fog that the sea and sky use. This is the visibility tunable from progress.md
// ("visibility must be tighter than instrument precision"): if you can see an island from
// a degree away, nobody needs a kamal.
import * as THREE from 'three';

export const ISLAND_VISIBLE_M = 650;  // fully hidden beyond this
export const ISLAND_CLEAR_M = 180;    // fully clear inside this

const uniforms = {
  uHaze: { value: new THREE.Color() },
  uHazeNear: { value: ISLAND_CLEAR_M },
  uHazeFar: { value: ISLAND_VISIBLE_M },
};

const patched = new WeakSet<THREE.Material>();

/** Patch a Lambert/Standard material in place (once). Materials shared by clones are patched once. */
export function applyHaze(m: THREE.Material): void {
  if (patched.has(m)) return;
  patched.add(m);
  (m as THREE.MeshLambertMaterial).fog = false;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uHaze; uniform float uHazeNear; uniform float uHazeFar;\nvoid main() {')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(uHazeNear, uHazeFar, length(vViewPosition)));`);
  };
  m.customProgramCacheKey = () => 'island-haze';
  m.needsUpdate = true;
}

export function hazeAll(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) applyHaze(m);
  });
}

export function setHazeColor(c: THREE.Color): void { uniforms.uHaze.value.copy(c); }
