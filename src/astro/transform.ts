// Equatorial ↔ horizontal. Pure, no Three.js.
// World axes match the renderer: +X east, +Y up (zenith), −Z north.
// J2000 positions; precession/nutation/proper motion/refraction/dip ignored (DESIGN §3).

const DEG = Math.PI / 180;

export interface Horizontal { altDeg: number; azDeg: number; } // az: 0 = N, 90 = E

export function equatorialToHorizontal(raDeg: number, decDeg: number, latDeg: number, lstDeg: number): Horizontal {
  const hRad = (lstDeg - raDeg) * DEG;
  const decRad = decDeg * DEG, latRad = latDeg * DEG;
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const azRad = Math.atan2(
    -Math.sin(hRad) * Math.cos(decRad),
    Math.cos(latRad) * Math.sin(decRad) - Math.sin(latRad) * Math.cos(decRad) * Math.cos(hRad),
  );
  return { altDeg: altRad / DEG, azDeg: ((azRad / DEG) % 360 + 360) % 360 };
}

/** Unit vector (x east, y up, z = −north) for an alt/az. */
export function horizontalToVector(altDeg: number, azDeg: number): [number, number, number] {
  const a = altDeg * DEG, z = azDeg * DEG;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)];
}

/** Fixed equatorial frame used to place stars once: x → RA 0, y → RA 90°, z → north celestial pole. */
export function equatorialVector(raDeg: number, decDeg: number): [number, number, number] {
  const r = raDeg * DEG, d = decDeg * DEG;
  return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
}

/**
 * 3×3 rotation (column-major, 9 numbers) taking equatorialVector() into world/horizontal
 * vectors for an observer at latDeg with local sidereal time lstDeg. The renderer rotates the
 * whole star sphere with this instead of transforming 1,600 stars per frame (DESIGN §4).
 *   d = q.x·(cosL·M − sinL·E) + q.y·(sinL·M + cosL·E) + q.z·P
 * with P = celestial pole, M = equator on the meridian, E = east point.
 */
export function equatorialToWorldMatrix(latDeg: number, lstDeg: number): number[] {
  const phi = latDeg * DEG, L = lstDeg * DEG;
  const P = [0, Math.sin(phi), -Math.cos(phi)];          // up by lat, toward north
  const M = [0, Math.cos(phi), Math.sin(phi)];           // toward south, tilted up by colat
  const E = [1, 0, 0];
  const c = Math.cos(L), s = Math.sin(L);
  const col0 = [0, 1, 2].map((i) => c * M[i] - s * E[i]);
  const col1 = [0, 1, 2].map((i) => s * M[i] + c * E[i]);
  return [...col0, ...col1, ...P];
}

export function applyMatrix3(m: number[], v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

/** Angular separation of two equatorial positions, degrees. */
export function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = equatorialVector(ra1, dec1), b = equatorialVector(ra2, dec2);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot))) / DEG;
}
