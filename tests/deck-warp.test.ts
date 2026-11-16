import { describe, expect, it } from 'vitest';
import { clampToDeck, deckHalfWidth, nearestStation, walk, STATION_STAND } from '../src/sim/deck';
import { initialWarp, MAX_WARP, stepWarp, type WarpConditions } from '../src/sim/warp';

describe('deck', () => {
  it('bow is narrower than midships', () => {
    expect(deckHalfWidth(-4.5)).toBeLessThan(deckHalfWidth(1));
  });

  it('cannot walk off the deck', () => {
    let p = { x: 0, z: 0 };
    for (let i = 0; i < 600; i++) p = walk(p, 0, 1, 0, 1 / 60); // strafe starboard 10 s
    expect(p.x).toBeLessThanOrEqual(deckHalfWidth(p.z) + 1e-9);
    expect(clampToDeck(0, -99).z).toBeGreaterThan(-6);
  });

  it('walking "forward" while facing the bow goes toward −Z', () => {
    const p = walk({ x: 0, z: 2 }, 1, 0, 0, 0.5);
    expect(p.z).toBeLessThan(2);
    expect(p.x).toBeCloseTo(0, 9);
  });

  it('station stand spots are near their stations', () => {
    expect(nearestStation(STATION_STAND.helm)?.id).toBe('helm');
    expect(nearestStation(STATION_STAND.mast)?.id).toBe('mast');
    expect(nearestStation({ x: 0, z: 1.5 })).toBeNull();
  });
});

describe('warp', () => {
  const steady: WarpConditions = { atHelm: true, inputActive: false, speedMs: 10, blocked: false };
  const run = (c: WarpConditions, s: number, st = initialWarp()) => {
    for (let t = 0; t < s; t += 1 / 60) st = stepWarp(st, c, 1 / 60);
    return st;
  };

  it('waits, then ramps to max', () => {
    expect(run(steady, 2.5).warp).toBe(1);
    expect(run(steady, 12).warp).toBe(MAX_WARP);
  });

  it('drops instantly on input, away from helm, or when slow', () => {
    const fast = run(steady, 12);
    expect(stepWarp(fast, { ...steady, inputActive: true }, 1 / 60).warp).toBe(1);
    expect(stepWarp(fast, { ...steady, atHelm: false }, 1 / 60).warp).toBe(1);
    expect(stepWarp(fast, { ...steady, speedMs: 1 }, 1 / 60).warp).toBe(1);
  });
});

describe('hull outline', () => {
  it('comes to a point at the bow and is widest amidships', async () => {
    const { hullHalfWidth, DECK_HALF_LENGTH, DECK_HALF_BEAM } = await import('../src/sim/deck');
    expect(hullHalfWidth(-DECK_HALF_LENGTH)).toBe(0);
    expect(hullHalfWidth(1.2)).toBeCloseTo(DECK_HALF_BEAM, 5); // max beam just aft of midships
    expect(hullHalfWidth(-4)).toBeLessThan(hullHalfWidth(0));
    expect(hullHalfWidth(DECK_HALF_LENGTH + 1)).toBe(0);
  });
});
