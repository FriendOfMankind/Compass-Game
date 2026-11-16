// M4 acceptance: latitude sailing to another island works end to end on the real wind field,
// boat model and hazards. The autopilot uses TRUE position (this tests the world, not the player):
// sail north/south to the target's latitude, then run east/west along it until you arrive.
import { describe, expect, it } from 'vitest';
import { generateWorld, type Island } from '../src/world/worldgen';
import { WindField } from '../src/world/wind';
import { proximity } from '../src/world/hazards';
import { createBoat, stepBoat, type Boat } from '../src/sim/boat';
import { optimalTrim, trueWindAngle } from '../src/sim/sailing';
import { M_PER_DEG } from '../src/nav/dr';
import { TIME_SCALE } from '../src/sim/clock';
import { MAX_WARP } from '../src/sim/warp';

const DT = 0.5;
const NO_GO = 50;

/** Closest sailable heading to `want`, tacking every 20 game-minutes when it's upwind. */
function sailable(want: number, windFrom: number, t: number): number {
  if (trueWindAngle(want, windFrom) >= NO_GO) return want;
  const tack = Math.floor(t / 1200) % 2 ? 1 : -1;
  return (windFrom + tack * NO_GO + 360) % 360;
}

/** maxHours: real (boat-sim) hours. */
function voyage(seed: number, from: Island, to: Island, maxHours: number): { arrived: boolean; hours: number } {
  const world = generateWorld(seed), wind = new WindField(seed);
  // Leave from just outside the start island's reef, on the side facing the target's latitude.
  const side = to.latDeg > from.latDeg ? -1 : 1;
  let b: Boat = createBoat(from.lonDeg * M_PER_DEG, -from.latDeg * M_PER_DEG + side * (from.radiusM + from.reefM + 150), 0);
  for (let t = 0; t < maxHours * 3600; t += DT) {
    const lat = -b.z / M_PER_DEG, lon = b.x / M_PER_DEG;
    const w = wind.at(lat, lon, t * TIME_SCALE); // t is boat-sim (real) seconds; wind runs on game time
    const onLat = Math.abs(lat - to.latDeg) < 0.04;
    const want = !onLat ? (to.latDeg > lat ? 0 : 180) : (to.lonDeg > lon ? 90 : 270);
    // On the latitude, small corrections keep us on it (a navigator would re-check Polaris).
    const corr = onLat ? Math.max(-15, Math.min(15, (to.latDeg - lat) * 400)) * (want === 90 ? -1 : 1) : 0;
    const h = sailable((want + corr + 360) % 360, w.fromDeg, t);
    b = stepBoat({ ...b, headingDeg: h, trimDeg: optimalTrim(trueWindAngle(h, w.fromDeg)) }, { steer: 0, trim: 0 }, w, DT);
    const p = proximity(world, b.x, b.z);
    if (p.arrived && p.island?.id === to.id) return { arrived: true, hours: t / 3600 };
  }
  return { arrived: false, hours: maxHours };
}

describe('latitude sailing, end to end', () => {
  for (const seed of [1, 2, 3, 42, 1337]) {
    it(`seed ${seed}: port → island in another archipelago`, () => {
      const w = generateWorld(seed);
      const from = w.islands.find((i) => i.port)!;
      // Farthest island in a different archipelago: the hardest honest trip.
      const to = w.islands.filter((i) => i.archipelago !== from.archipelago)
        .sort((a, b) => Math.abs(b.latDeg - from.latDeg) - Math.abs(a.latDeg - from.latDeg))[0];
      const r = voyage(seed, from, to, 6);
      expect(r.arrived, `${from.name} → ${to.name} (${from.latDeg.toFixed(1)}→${to.latDeg.toFixed(1)}°)`).toBe(true);
      console.log(`seed ${seed}: ${from.name} → ${to.name}: ${(r.hours * 60).toFixed(0)} real min at 1×, ~${(r.hours * 60 / MAX_WARP).toFixed(1)} at full warp`);
    });
  }
});
