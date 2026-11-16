import { describe, expect, it } from 'vitest';
import { generateWorld, validateWorld, DOLDRUMS_DEG } from '../src/world/worldgen';
import { WindField, NE_TRADE_FROM_DEG, SE_TRADE_FROM_DEG, DOLDRUMS_STRENGTH } from '../src/world/wind';
import { islandHeight } from '../src/world/terrain';
import { proximity, inPass, ARRIVE_M } from '../src/world/hazards';
import { M_PER_DEG } from '../src/nav/dr';

const angDiff = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

describe('worldgen', () => {
  it('5+ seeds all produce valid worlds (DESIGN M4 acceptance)', () => {
    for (const seed of [1, 2, 3, 42, 1337, 99999, 123456789, 7, 8, 9]) {
      expect(validateWorld(generateWorld(seed)), `seed ${seed}`).toEqual([]);
    }
  });
  it('100 seeds: none throw, all valid', () => {
    for (let seed = 1000; seed < 1100; seed++) expect(validateWorld(generateWorld(seed))).toEqual([]);
  });
  it('is deterministic per seed and differs between seeds', () => {
    expect(generateWorld(42)).toEqual(generateWorld(42));
    expect(generateWorld(42).islands[0]).not.toEqual(generateWorld(43).islands[0]);
  });
  it('names are unique within a world', () => {
    const w = generateWorld(5);
    expect(new Set(w.islands.map((i) => i.name)).size).toBe(w.islands.length);
  });
  it('has a doldrums island and southern islands', () => {
    const w = generateWorld(11);
    expect(w.islands.some((i) => Math.abs(i.latDeg) < DOLDRUMS_DEG)).toBe(true);
    expect(w.islands.filter((i) => i.latDeg < 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe('wind field', () => {
  const f = new WindField(42);
  it('NE trades in the north, SE trades in the south (±15°)', () => {
    for (let t = 0; t < 86400 * 3; t += 3600) {
      const n = f.at(15, 3, t), s = f.at(-15, -3, t);
      expect(angDiff(n.fromDeg, NE_TRADE_FROM_DEG)).toBeLessThan(15);
      expect(angDiff(s.fromDeg, SE_TRADE_FROM_DEG)).toBeLessThan(15);
      expect(n.strength).toBeGreaterThan(0.85);
      expect(s.strength).toBeGreaterThan(0.85);
    }
  });
  it('doldrums wind is weak and wanders', () => {
    const dirs = new Set<number>();
    for (let t = 0; t < 86400 * 2; t += 1800) {
      const w = f.at(0, 0, t);
      expect(w.strength).toBeLessThan(DOLDRUMS_STRENGTH * 1.15);
      dirs.add(Math.round(w.fromDeg / 45));
    }
    expect(dirs.size).toBeGreaterThanOrEqual(4); // comes from all over the compass
  });
  it('changes smoothly (no jumps between 1 s samples)', () => {
    for (let t = 0; t < 20000; t += 7) {
      const a = f.at(8, 0, t), b = f.at(8, 0, t + 1);
      expect(angDiff(a.fromDeg, b.fromDeg)).toBeLessThan(1);
    }
  });
  it('is deterministic per seed', () => {
    expect(new WindField(1).at(10, 2, 5000)).toEqual(new WindField(1).at(10, 2, 5000));
  });
});

describe('terrain + hazards', () => {
  const w = generateWorld(42);
  it('islands are land at the centre and sea well beyond the shore', () => {
    for (const isl of w.islands) {
      expect(islandHeight(isl, 0, 0)).toBeGreaterThan(1);
      expect(islandHeight(isl, isl.radiusM * 1.3, 0)).toBeLessThan(0);
      expect(islandHeight(isl, 0, -isl.radiusM * 1.3)).toBeLessThan(0);
    }
  });
  it('open sea: nothing nearby', () => {
    const isl = w.islands[0];
    const p = proximity(w, isl.lonDeg * M_PER_DEG + 5000, -isl.latDeg * M_PER_DEG);
    expect(p.arrived || p.onReef || p.aground).toBe(false);
  });
  it('approaching an island: arrived near the shore, aground on it', () => {
    const isl = w.islands[0], cx = isl.lonDeg * M_PER_DEG, cz = -isl.latDeg * M_PER_DEG;
    const gap = isl.reefGapDeg * Math.PI / 180; // come in through the reef pass
    const at = (d: number) => proximity(w, cx + Math.sin(gap) * d, cz - Math.cos(gap) * d);
    expect(at(isl.radiusM + ARRIVE_M + 50).arrived).toBe(false);
    expect(at(isl.radiusM + ARRIVE_M - 20).arrived).toBe(true);
    expect(at(isl.radiusM + ARRIVE_M - 20).onReef).toBe(false);
    expect(at(isl.radiusM * 0.5).aground).toBe(true);
  });
  it('reefs hurt outside the pass only', () => {
    const isl = w.islands.find((i) => i.reefM > 0)!;
    const cx = isl.lonDeg * M_PER_DEG, cz = -isl.latDeg * M_PER_DEG, r = isl.radiusM + isl.reefM;
    const bearingHit = (isl.reefGapDeg + 180) * Math.PI / 180, bearingPass = isl.reefGapDeg * Math.PI / 180;
    expect(proximity(w, cx + Math.sin(bearingHit) * r, cz - Math.cos(bearingHit) * r).onReef).toBe(true);
    expect(proximity(w, cx + Math.sin(bearingPass) * r, cz - Math.cos(bearingPass) * r).onReef).toBe(false);
    expect(inPass(350, 10)).toBe(true);
    expect(inPass(90, 10)).toBe(false);
  });
});
