// The island the tutorial teaches latitude sailing on (steps 7–8). Pure.
// Needs Polaris comfortably up (lat ≥ 5°N) and clear sea to the south-west for the start:
// sail north to its latitude, then east along it.
import type { Island, World } from './worldgen';
import { proximity } from './hazards';
import { M_PER_DEG } from '../nav/dr';

const OFFSETS = [[-1.6, -1.4], [-1.2, -1.4], [-1.6, -1.0], [-2.0, -1.8], [-1.0, -1.0], [-1.4, -2.2], [-2.4, -1.2], [-0.8, -1.8], [-2.6, -2.6]] as const; // [dLat, dLon]
const CLEAR_M = 800;

function clearStarts(world: World, isl: Island): { latDeg: number; lonDeg: number }[] {
  return OFFSETS.map(([a, b]) => ({ latDeg: isl.latDeg + a, lonDeg: isl.lonDeg + b }))
    .filter((p) => proximity(world, p.lonDeg * M_PER_DEG, -p.latDeg * M_PER_DEG).shoreDistM > CLEAR_M);
}

/** Where step 7 starts: south-west of the island, clear of land. */
export function tutorialStart(world: World, isl: Island): { latDeg: number; lonDeg: number } {
  return clearStarts(world, isl)[0] ?? { latDeg: isl.latDeg + OFFSETS[0][0], lonDeg: isl.lonDeg + OFFSETS[0][1] };
}

export function tutorialIsland(world: World): Island {
  const north = world.islands.filter((i) => i.latDeg >= 5).sort((a, b) => a.latDeg - b.latDeg);
  const clear = north.filter((i) => clearStarts(world, i).length > 0);
  // Prefer a reef-free island so the first landfall isn't a shipwreck.
  return clear.find((i) => i.reefM === 0) ?? clear[0] ?? north[0] ?? [...world.islands].sort((a, b) => b.latDeg - a.latDeg)[0];
}
