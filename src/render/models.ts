import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Kenney Pirate Kit loader (CC0, public/models/kenney-pirate). Each model file is
// fetched once; callers get their own clone. Meshes cast + receive shadows.

const BASE = `${import.meta.env.BASE_URL}models/kenney-pirate/`;
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

export function loadKit(name: string): Promise<THREE.Object3D> {
  let p = cache.get(name);
  if (!p) {
    p = loader.loadAsync(`${BASE}${name}.glb`).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
      });
      return g.scene;
    });
    cache.set(name, p);
  }
  return p.then((s) => s.clone());
}

/** Load a kit model and add it to parent at a boat-local position once it arrives. */
export function placeKit(parent: THREE.Object3D, name: string, x: number, y: number, z: number, scale = 1, rotY = 0): void {
  loadKit(name).then((m) => {
    m.position.set(x, y, z);
    m.scale.setScalar(scale);
    m.rotation.y = rotY;
    parent.add(m);
  }).catch((e) => console.warn(`kit model ${name} failed to load`, e));
}
