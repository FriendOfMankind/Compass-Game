import { describe, expect, it } from 'vitest';
import { STEPS, stepIndex, lookDistanceDeg, type TutorialCtx } from '../src/tutorial/steps';
import { starByName } from '../src/astro/stars';
import { equatorialToHorizontal } from '../src/astro/transform';
import { julianDate, lstDeg } from '../src/astro/time';
import parrot from '../src/content/parrot.json';

const base: TutorialCtx = {
  mode: 'helm', compassDeg: 0, speedKn: 0, efficiency: 0, luffing: true, lookAzDeg: 0, lookAltDeg: 0,
  latDeg: 12, lstDeg: 0, instrument: 'hand', raised: false,
  islandLatDeg: 14, logged: false, marks: 0, atIsland: false,
};
const goal = (n: number, i = 0) => STEPS[stepIndex(n)].goals[i];
function lookAt(name: string, lat: number, hour: number): TutorialCtx {
  const lst = lstDeg(julianDate(2026, 4, 15, hour), 0);
  const s = starByName(name);
  const h = equatorialToHorizontal(s.raDeg, s.decDeg, lat, lst);
  return { ...base, latDeg: lat, lstDeg: lst, lookAzDeg: h.azDeg, lookAltDeg: h.altDeg };
}

describe('tutorial steps', () => {
  it('has all 10 steps in order, each jumpable', () => {
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('step 7: kamal on Polaris, then the island latitude, then east', () => {
    const c = lookAt('Polaris', 12.4, 21.6);
    expect(goal(7, 0).check({ ...c, raised: true, instrument: 'kamal' })).toBe(true);
    expect(goal(7, 0).check({ ...c, raised: true, instrument: 'hand' })).toBe(false);
    expect(goal(7, 1).check({ ...base, latDeg: 13.95, islandLatDeg: 14 })).toBe(true);
    expect(goal(7, 1).check({ ...base, latDeg: 13.5, islandLatDeg: 14 })).toBe(false);
    expect(goal(7, 2).check({ ...base, compassDeg: 95 })).toBe(true);
    expect(goal(7, 2).check({ ...base, compassDeg: 0 })).toBe(false);
  });

  it('step 7: Polaris is up at the step time and latitude band of tutorial islands', () => {
    for (const lat of [3.4, 8, 15, 21]) expect(lookAt('Polaris', lat, 21.6).lookAltDeg).toBeGreaterThan(2);
  });

  it('step 7: wind from 160 lets you sail north (run) and east (reach)', async () => {
    const { trueWindAngle } = await import('../src/sim/sailing');
    const w = STEPS[stepIndex(7)].setup!.windFromDeg!;
    expect(trueWindAngle(0, w)).toBeGreaterThan(45);
    expect(trueWindAngle(90, w)).toBeGreaterThan(45);
  });

  it('step 8: log, chart mark, arrival', () => {
    expect(goal(8, 0).check({ ...base, logged: true })).toBe(true);
    expect(goal(8, 1).check({ ...base, marks: 1 })).toBe(true);
    expect(goal(8, 2).check({ ...base, atIsland: true })).toBe(true);
    expect(goal(8, 2).check(base)).toBe(false);
  });

  it('tutorial island: ≥ 5°N with a clear start, on 200 seeds', async () => {
    const { generateWorld } = await import('../src/world/worldgen');
    const { tutorialIsland, tutorialStart } = await import('../src/world/tutorialIsland');
    const { proximity } = await import('../src/world/hazards');
    for (let seed = 0; seed < 200; seed++) {
      const w = generateWorld(seed), isl = tutorialIsland(w), st = tutorialStart(w, isl);
      expect(isl.latDeg).toBeGreaterThanOrEqual(5);
        expect(proximity(w, st.lonDeg * 600, -st.latDeg * 600).shoreDistM, `seed ${seed}`).toBeGreaterThan(800);
    }
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
    // Continuing keeps your heading; every step that ends on a course ends on 090 (steps 2–8).
    let wind = 0;
    for (const s of STEPS) {
      wind = s.setup?.windFromDeg ?? wind;
      const headings = [90, ...(s.setup?.headingDeg !== undefined ? [s.setup.headingDeg] : [])];
      for (const h of headings) expect(trueWindAngle(h, wind), `step ${s.n}, heading ${h}, wind ${wind}`).toBeGreaterThanOrEqual(45);
    }
  });
});
