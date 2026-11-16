import { describe, expect, it } from 'vitest';
import { buy, canBuy, completeRound, newProgress, parseProgress, PRICES, roundReward } from '../src/sim/progression';

describe('progression', () => {
  it('starts with hand + kamal and no gold', () => {
    const p = newProgress(5);
    expect(p).toMatchObject({ seed: 5, round: 1, gold: 0, owned: ['hand', 'kamal'] });
  });
  it('rewards distance, charges for scrapes, never below 10', () => {
    expect(roundReward(3, 2, 0).total).toBe(30 + 24 + 10);
    expect(roundReward(3, 2, 2).total).toBe(64 - 20);
    expect(roundReward(1.5, 1.5, 20).total).toBe(10);
  });
  it('quadrant after a few rounds, chronometer after ~10: a 30–60 min loop at 3–5 min per round', () => {
    const typical = roundReward(3.25, 2.75, 0).total; // middle of the round distance ranges
    expect(Math.ceil(PRICES.quadrant / typical)).toBeGreaterThanOrEqual(2);
    const roundsToBoth = Math.ceil((PRICES.quadrant + PRICES.chronometer) / typical);
    expect(roundsToBoth).toBeGreaterThanOrEqual(6);
    expect(roundsToBoth).toBeLessThanOrEqual(12);
  });
  it('buying: needs gold, only once', () => {
    let p = completeRound(newProgress(1), roundReward(5, 4, 0), ['Crab Isle']);
    expect(canBuy(p, 'quadrant')).toBe(false);
    p = { ...p, gold: 130 };
    const q = buy(p, 'quadrant')!;
    expect(q.gold).toBe(10);
    expect(q.owned).toContain('quadrant');
    expect(buy(q, 'quadrant')).toBeNull();
    expect(buy(q, 'chronometer')).toBeNull();
  });
  it('completeRound advances the round and merges discoveries', () => {
    const p = completeRound(completeRound(newProgress(1), roundReward(2, 2, 0), ['A']), roundReward(2, 2, 0), ['A', 'B']);
    expect(p.round).toBe(3);
    expect(p.known).toEqual(['A', 'B']);
  });
  it('save round-trips; garbage is rejected', () => {
    const p = completeRound(newProgress(77), roundReward(2, 2, 1), ['X']);
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
    for (const bad of [null, '', '{', '{"seed":1}', '{"seed":1,"round":0,"gold":0,"owned":[],"known":[]}', '{"seed":1,"round":1,"gold":-5,"owned":[],"known":[]}', '[]']) {
      expect(parseProgress(bad)).toBeNull();
    }
  });
});
