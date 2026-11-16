import { describe, expect, it } from 'vitest';
import { STEPS, stepIndex, lookDistanceDeg, type TutorialCtx } from '../src/tutorial/steps';
import { starByName } from '../src/astro/stars';
import { equatorialToHorizontal } from '../src/astro/transform';
import { julianDate, lstDeg } from '../src/astro/time';
import parrot from '../src/content/parrot.json';

const base: TutorialCtx = {
  mode: 'helm', compassDeg: 0, speedKn: 0, efficiency: 0, luffing: true, lookAzDeg: 0, lookAltDeg: 0,
  latDeg: 12, lstDeg: 0, instrument: 'hand', raised: false,
};
const goal = (n: number, i = 0) => STEPS[stepIndex(n)].goals[i];
function lookAt(name: string, lat: number, hour: number): TutorialCtx {
  const lst = lstDeg(julianDate(2026, 4, 15, hour), 0);
  const s = starByName(name);
  const h = equatorialToHorizontal(s.raDeg, s.decDeg, lat, lst);
  return { ...base, latDeg: lat, lstDeg: lst, lookAzDeg: h.azDeg, lookAltDeg: h.altDeg };
}

describe('tutorial steps', () => {
  it('has steps 1–6 and 9, each jumpable', () => {
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 9]);
  });

  it('every parrot key referenced by a step exists', () => {
    const keys = new Set(Object.keys(parrot));
    for (const s of STEPS) for (const g of s.goals) {
      for (const k of [g.intro, g.hint, g.done, g.question?.key, g.question?.wrong].flat()) if (k) expect(keys.has(k), k).toBe(true);
    }
  });

  it('step 2: 090 passes (with wrap), 270 fails', () => {
    expect(goal(2).check({ ...base, compassDeg: 92 })).toBe(true);
    expect(goal(2).check({ ...base, compassDeg: 270 })).toBe(false);
  });

  it('step 3: needs drawing sail and speed', () => {
    expect(goal(3).check({ ...base, luffing: false, efficiency: 0.95, speedKn: 7 })).toBe(true);
    expect(goal(3).check({ ...base, luffing: true, efficiency: 0.95, speedKn: 7 })).toBe(false);
  });

  it('steps 4–5: the Dipper and Polaris are actually up at the step setup time, and looking at them passes', () => {
    const s4 = STEPS[stepIndex(4)].setup!, s5 = STEPS[stepIndex(5)].setup!;
    expect(goal(4).check(lookAt('Megrez', s4.latDeg!, s4.hour!))).toBe(true);
    expect(goal(5).check(lookAt('Polaris', s5.latDeg!, s5.hour!))).toBe(true);
    const away = lookAt('Polaris', 12, 21.2);
    expect(goal(5).check({ ...away, lookAzDeg: away.lookAzDeg + 10 })).toBe(false);
  });

  it('step 6: requires the raised hand; quiz marks the true latitude correct', () => {
    const c = lookAt('Polaris', 12, 21.4);
    expect(goal(6).check(c)).toBe(false);
    expect(goal(6).check({ ...c, raised: true })).toBe(true);
    const q = goal(6).question!.options(c);
    expect(q.labels[q.correct]).toContain('12°N');
    expect(new Set(q.labels).size).toBe(q.labels.length);
  });

  it('step 9: Crux is up at lat −12, and the south-pole goal passes at alt = |lat| due south', () => {
    const s9 = STEPS[stepIndex(9)].setup!;
    const acrux = lookAt('Acrux', s9.latDeg!, s9.hour!);
    expect(acrux.lookAltDeg).toBeGreaterThan(10);
    expect(goal(9, 0).check(acrux)).toBe(true);
    const pole = { ...base, latDeg: -12, lookAzDeg: 180, lookAltDeg: 12 };
    expect(goal(9, 1).check(pole)).toBe(true);
    expect(goal(9, 1).check({ ...pole, lookAltDeg: 20 })).toBe(false);
  });

  it('lookDistanceDeg', () => {
    expect(lookDistanceDeg({ ...base, lookAzDeg: 0, lookAltDeg: 10 }, 10, 0)).toBeCloseTo(0, 4); // acos precision near 0
    expect(lookDistanceDeg({ ...base, lookAzDeg: 0, lookAltDeg: 0 }, 0, 90)).toBeCloseTo(90, 6);
  });
});

describe('tutorial wind', () => {
  it('no step setup (jump or continue) starts you in irons', async () => {
    const { trueWindAngle } = await import('../src/sim/sailing');
    const headings = new Set<number>([90]); // heading carried over when continuing
    for (const s of STEPS) {
      const w = s.setup?.windFromDeg ?? 0;
      expect(w, `step ${s.n} wind`).toBe(0);
      if (s.setup?.headingDeg !== undefined) headings.add(s.setup.headingDeg);
    }
    for (const h of headings) expect(trueWindAngle(h, 0), `heading ${h}`).toBeGreaterThanOrEqual(45);
  });
});
