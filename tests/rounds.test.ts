import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/world/worldgen';
import { pickRound, ordersText } from '../src/world/rounds';
import { proximity } from '../src/world/hazards';
import { M_PER_DEG } from '../src/nav/dr';

describe('rounds', () => {
  for (const seed of [1, 2, 3, 42, 1337]) {
    it(`seed ${seed}: 20 rounds start at sea, at night, a sensible distance from the target`, () => {
      const w = generateWorld(seed);
      for (let n = 1; n <= 20; n++) {
        const r = pickRound(w, seed, n);
        const dLat = Math.abs(r.target.latDeg - r.startLatDeg), dLon = r.target.lonDeg - r.startLonDeg;
        expect(dLat).toBeGreaterThanOrEqual(1.5);
        expect(dLat).toBeLessThanOrEqual(5);
        expect(Math.abs(dLon)).toBeGreaterThanOrEqual(1.5);
        expect(r.direction).toBe(dLon > 0 ? 'east' : 'west');
        expect(r.hour >= 19.5 || r.hour <= 2.5).toBe(true);
        expect(proximity(w, r.startLonDeg * M_PER_DEG, -r.startLatDeg * M_PER_DEG).shoreDistM).toBeGreaterThan(1500);
      }
    });
  }
  it('is deterministic and varies by round', () => {
    const w = generateWorld(9);
    expect(pickRound(w, 9, 3)).toEqual(pickRound(w, 9, 3));
    expect(pickRound(w, 9, 3).startLatDeg).not.toBe(pickRound(w, 9, 4).startLatDeg);
  });
  it('orders give exact latitude, vague direction', () => {
    const w = generateWorld(9), r = pickRound(w, 9, 1);
    expect(ordersText(r)).toMatch(new RegExp(`${r.target.name}, \\d+\\.\\d°[NS], somewhere to the (east|west)\\.`));
  });
});
