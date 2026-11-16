// Where the boat is relative to land: on a reef, aground on the beach, close enough to
// count as "arrived", or near enough that time warp should drop out. Pure.
import type { Island, World } from './worldgen';
import { M_PER_DEG } from '../nav/dr';
import { islandHeight } from './terrain';

export const ARRIVE_M = 120;     // within this of the shore = you've reached the island
export const WARP_BLOCK_M = 700; // no fast-forwarding into land
export const REEF_HALF_WIDTH_M = 12;
export const REEF_PASS_HALF_DEG = 25; // the gap in the reef you can sail through

export interface Proximity {
  island: Island | null; // nearest island
  shoreDistM: number;    // distance to its shoreline (negative = on land)
  onReef: boolean;
  aground: boolean;
  arrived: boolean;
}

/** x, z in world metres (x = lon·600, z = −lat·600). */
export function proximity(world: World, x: number, z: number): Proximity {
  let best: Island | null = null, bestD = Infinity, bestBearing = 0, bdx = 0, bdz = 0;
  for (const isl of world.islands) {
    const dx = x - isl.lonDeg * M_PER_DEG, dz = z + isl.latDeg * M_PER_DEG;
    const d = Math.hypot(dx, dz) - isl.radiusM;
    if (d < bestD) { bestD = d; best = isl; bdx = dx; bdz = dz; bestBearing = (Math.atan2(dx, -dz) * 180) / Math.PI; }
  }
  if (!best) return { island: null, shoreDistM: Infinity, onReef: false, aground: false, arrived: false };
  return {
    island: best,
    shoreDistM: bestD,
    onReef: best.reefM > 0 && Math.abs(bestD - best.reefM) < REEF_HALF_WIDTH_M && !inPass(bestBearing, best.reefGapDeg),
    aground: islandHeight(best, bdx, bdz) > -1, // keel touches: the wobbly coast, not the circle
    arrived: bestD < ARRIVE_M,
  };
}

/** Is this bearing (from the island centre, degrees) inside the reef's pass? */
export function inPass(bearingDeg: number, gapDeg: number): boolean {
  const d = Math.abs((((bearingDeg - gapDeg) % 360) + 540) % 360 - 180);
  return d < REEF_PASS_HALF_DEG;
}
