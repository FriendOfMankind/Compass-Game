import { describe, expect, it } from 'vitest';
import {
  compassDeviationDeg, compassReadingDeg, handCount, kamalVerdict, logReadingKn, quadrantReadingDeg, toKnots,
} from '../src/nav/instruments';
import { addLatLine, createDr, logSpeed, markPosition, setFix, stepDr } from '../src/nav/dr';
import { mulberry32 } from '../src/util/rng';

describe('instruments', () => {
  it('compass deviation is fixed per seed and within ±2°', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = compassDeviationDeg(seed);
      expect(Math.abs(d)).toBeLessThanOrEqual(2);
      expect(compassDeviationDeg(seed)).toBe(d);
    }
  });

  it('steady compass reads true + deviation; swing only while turning', () => {
    expect(compassReadingDeg(90, 1.5, 0, 3.3)).toBeCloseTo(91.5, 9);
    expect(compassReadingDeg(359, 2, 0, 0)).toBeCloseTo(1, 9);
    const turning = [0, 1, 2, 3].map((t) => compassReadingDeg(90, 0, 15, t));
    expect(Math.max(...turning) - Math.min(...turning)).toBeGreaterThan(0.5);
  });

  it('log line is within ±10% and spreads across the range', () => {
    const rnd = mulberry32(7);
    const r = Array.from({ length: 200 }, () => logReadingKn(10, rnd()));
    const truth = toKnots(10);
    expect(Math.max(...r)).toBeLessThanOrEqual(truth * 1.1 + 1e-9);
    expect(Math.min(...r)).toBeGreaterThanOrEqual(truth * 0.9 - 1e-9);
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(truth * 0.15);
  });

  it('quadrant: exact in a flat calm, wobbles with the boat, reads in 0.5° steps', () => {
    expect(quadrantReadingDeg(20.2, 0, 0, 5)).toBe(20);
    const reads = Array.from({ length: 40 }, (_, i) => quadrantReadingDeg(20, 3, 2, i * 0.37));
    expect(new Set(reads).size).toBeGreaterThan(1);
    for (const r of reads) {
      expect(Math.abs(r - 20)).toBeLessThanOrEqual(1.75);
      expect((r * 2) % 1).toBe(0);
    }
  });

  it('kamal verdicts', () => {
    expect(kamalVerdict(15.4, 15)).toBe('on');
    expect(kamalVerdict(17, 15)).toBe('above');
    expect(kamalVerdict(12, 15)).toBe('below');
  });

  it('hand count: fists of 10°, fingers of 2°', () => {
    expect(handCount(20)).toEqual({ fists: 2, fingers: 0 });
    expect(handCount(14)).toEqual({ fists: 1, fingers: 2 });
    expect(handCount(-3)).toEqual({ fists: 0, fingers: 0 });
  });
});

describe('dead reckoning', () => {
  it("doesn't move until the log has been read", () => {
    const s = stepDr(createDr({ latDeg: 10, lonDeg: 0 }), 0, 60);
    expect(s.pos).toEqual({ latDeg: 10, lonDeg: 0 });
  });

  it('north at a logged speed moves north by speed × time', () => {
    let s = logSpeed(createDr({ latDeg: 10, lonDeg: 0 }), toKnots(12)); // 12 m/s
    for (let i = 0; i < 50; i++) s = stepDr(s, 0, 1); // 50 s × 12 m/s = 600 m = 1°
    expect(s.pos.latDeg).toBeCloseTo(11, 6);
    expect(s.pos.lonDeg).toBeCloseTo(0, 6);
    expect(s.track.length).toBeGreaterThan(10);
  });

  it('east moves +lon; errors accumulate from a biased compass', () => {
    let truth = logSpeed(createDr({ latDeg: 0, lonDeg: 0 }), toKnots(12));
    let biased = truth;
    for (let i = 0; i < 100; i++) { truth = stepDr(truth, 90, 1); biased = stepDr(biased, 92, 1); }
    expect(truth.pos.lonDeg).toBeCloseTo(2, 6);
    expect(Math.abs(biased.pos.latDeg - truth.pos.latDeg)).toBeGreaterThan(0.05); // 2° bias over 2° run
  });

  it('marks, fixes and latitude lines', () => {
    let s = createDr({ latDeg: 5, lonDeg: 1 });
    s = markPosition(s);
    s = addLatLine(s, 12.5);
    s = setFix(s, { latDeg: 6, lonDeg: 2 });
    expect(s.marks).toEqual([{ latDeg: 5, lonDeg: 1 }]);
    expect(s.latLines).toEqual([12.5]);
    expect(s.pos).toEqual({ latDeg: 6, lonDeg: 2 });
  });
});

describe('chart latitude input', async () => {
  const { parseLatitude } = await import('../src/ui/chart');
  it('parses N/S and signs', () => {
    expect(parseLatitude('14')).toBe(14);
    expect(parseLatitude('14N')).toBe(14);
    expect(parseLatitude('6 s')).toBe(-6);
    expect(parseLatitude('-6.5')).toBe(-6.5);
    expect(parseLatitude('north')).toBeNull();
    expect(parseLatitude('95')).toBeNull();
  });
});
