// Island terrain height (DESIGN §6: noise + radial falloff). Pure, so the render mesh,
// tests and any future "can I land here" check agree. Heights in metres above sea level;
// negative = underwater. dx, dz are metres from the island centre (+x east, −z north).
import { mulberry32 } from '../util/rng';
import type { Island } from './worldgen';

/** Wobbly coastline: radius multiplier by bearing, 0.85..1.15. */
function coastFactor(phases: number[], angleRad: number): number {
  return 1 + 0.08 * Math.sin(3 * angleRad + phases[0]) + 0.05 * Math.sin(5 * angleRad + phases[1]) + 0.02 * Math.sin(9 * angleRad + phases[2]);
}

const phaseCache = new Map<number, number[]>();
function phases(seed: number): number[] {
  let p = phaseCache.get(seed);
  if (!p) { const r = mulberry32(seed); p = Array.from({ length: 6 }, () => r() * Math.PI * 2); phaseCache.set(seed, p); }
  return p;
}

export function islandHeight(isl: Island, dx: number, dz: number): number {
  const ph = phases(isl.shapeSeed);
  const r = Math.hypot(dx, dz), a = Math.atan2(dx, -dz);
  const R = isl.radiusM * coastFactor(ph, a);
  const u = r / R; // 0 centre, 1 shoreline
  const beach = 1.2; // metres of sand above the waterline at the shore
  let h: number;
  if (isl.kind === 'peak') {
    h = isl.heightM * Math.max(0, 1 - u) ** 1.7;
  } else if (isl.kind === 'atoll') {
    h = isl.heightM * Math.min(1, Math.max(0, (1 - u) * 3));
  } else {
    // Twin hills along a seeded axis, the second lower.
    const ax = Math.sin(ph[3]), az = Math.cos(ph[3]), off = isl.radiusM * 0.38;
    const g = (cx: number, cz: number, s: number) => Math.exp(-((dx - cx) ** 2 + (dz - cz) ** 2) / (2 * s * s));
    h = isl.heightM * Math.max(g(ax * off, az * off, isl.radiusM * 0.3), 0.7 * g(-ax * off, -az * off, isl.radiusM * 0.28));
    h = Math.max(h, isl.heightM * 0.08 * Math.min(1, (1 - u) * 4));
  }
  // Shore: drop below water past the coastline.
  return u < 1 ? h + beach * Math.min(1, (1 - u) * 6) : -2 - (u - 1) * 30;
}
