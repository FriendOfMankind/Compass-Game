import * as THREE from 'three';

// M0: static, flat ocean plane that follows the camera so it never runs out.
// Gerstner waves + the matching CPU wave function arrive in M1.

const SIZE = 6000;

export class Ocean {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly dayColor = new THREE.Color('#1b6f8f');
  private readonly nightColor = new THREE.Color('#0b2236');

  constructor() {
    this.material = new THREE.MeshLambertMaterial({ color: this.dayColor.clone() });
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
  }

  update(daylight: number, camera: THREE.Camera): void {
    this.material.color.copy(this.nightColor).lerp(this.dayColor, daylight);
    this.mesh.position.set(camera.position.x, 0, camera.position.z);
  }
}
