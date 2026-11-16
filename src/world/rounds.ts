// Rounds (progress.md core-loop decision): each round drops you at sea at night with orders
// to reach one island. Orders give its exact latitude and only a vague direction (DESIGN §7):
// latitude sailing is the way to find it. Pure and deterministic per (seed, round number).
import { mulberry32 } from '../util/rng';
import type { Island, World } from './worldgen';
import { WORLD_LAT, WORLD_LON } from './worldgen';
import { proximity } from './hazards';
import { M_PER_DEG } from '../nav/dr';

export interface Round {
  n: number;
  target: Island;
  startLatDeg: number;
  startLonDeg: number;
  startHeadingDeg: number;
  hour: number;               // home time; always after dark so the stars are up
  direction: 'east' | 'west'; // the only hint about longitude
}

const DLAT = [1.5, 5] as const;  // keeps trips to a few minutes of play
const DLON = [1.5, 4] as const;
const CLEAR_OF_LAND_M = 1500;

export function pickRound(world: World, seed: number, n: number): Round {
  const rnd = mulberry32((seed ^ 0x40d) + n * 7919);
  const islands = world.islands;
  for (let tries = 0; tries < 500; tries++) {
    const target = islands[Math.floor(rnd() * islands.length)];
    const dLat = (DLAT[0] + rnd() * (DLAT[1] - DLAT[0])) * (rnd() < 0.5 ? -1 : 1);
    const dLon = (DLON[0] + rnd() * (DLON[1] - DLON[0])) * (rnd() < 0.5 ? -1 : 1);
    const lat = target.latDeg - dLat, lon = target.lonDeg - dLon;
    if (lat < WORLD_LAT[0] || lat > WORLD_LAT[1] || lon < WORLD_LON[0] || lon > WORLD_LON[1]) continue;
    if (proximity(world, lon * M_PER_DEG, -lat * M_PER_DEG).shoreDistM < CLEAR_OF_LAND_M) continue;
    return {
      n, target, startLatDeg: lat, startLonDeg: lon,
      startHeadingDeg: Math.floor(rnd() * 8) * 45,
      hour: (19.5 + rnd() * 7) % 24,
      direction: dLon > 0 ? 'east' : 'west',
    };
  }
  throw new Error(`rounds: no start found for round ${n}`);
}

export const fmtLat1 = (d: number) => `${Math.abs(d).toFixed(1)}°${d >= 0 ? 'N' : 'S'}`;

/** The orders as the player reads them. */
export function ordersText(r: Round): string {
  return `Reach ${r.target.name}, ${fmtLat1(r.target.latDeg)}, somewhere to the ${r.direction}.`;
}
