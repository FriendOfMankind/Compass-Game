import { describe, expect, it } from 'vitest';
import { gmstDeg, julianDate, lstDeg, sunEquatorial, J2000 } from '../src/astro/time';
import {
  applyMatrix3, equatorialToHorizontal, equatorialToWorldMatrix, equatorialVector, horizontalToVector, separationDeg,
} from '../src/astro/transform';
import { bvToRgb, cruxPolePoint, starByHip, starByName, STARS } from '../src/astro/stars';
import { CONSTELLATIONS } from '../src/data/constellations';
import { mulberry32 } from '../src/util/rng';

const polaris = starByName('Polaris');
const LSTS = [0, 45, 90, 135, 180, 225, 270, 315];

describe('time', () => {
  it('J2000.0 is JD 2451545 and GMST 280.46°', () => {
    expect(julianDate(2000, 1, 1, 12)).toBeCloseTo(J2000, 9);
    expect(gmstDeg(J2000)).toBeCloseTo(280.46061837, 6);
  });

  it('a sidereal day is ~3m56s shorter than a solar day', () => {
    const d = gmstDeg(J2000 + 1) - gmstDeg(J2000);
    expect(d).toBeCloseTo(0.98564736629, 6); // sky gains ~0.986° per solar day
  });

  it('LST adds east longitude', () => {
    const jd = julianDate(2026, 4, 15, 22);
    expect((lstDeg(jd, 20) - lstDeg(jd, 0) + 360) % 360).toBeCloseTo(20, 9);
  });

  it('sun: equinox dec ≈ 0, June solstice dec ≈ +23.4', () => {
    expect(Math.abs(sunEquatorial(julianDate(2026, 3, 20, 15)).decDeg)).toBeLessThan(0.5);
    expect(sunEquatorial(julianDate(2026, 6, 21, 8)).decDeg).toBeCloseTo(23.44, 0);
  });
});

describe('DESIGN §4 required tests', () => {
  it.each([30, 15, 5, 0])('Polaris altitude ≈ latitude (±1°) at lat %i, any LST', (lat) => {
    for (const lst of LSTS) {
      const { altDeg } = equatorialToHorizontal(polaris.raDeg, polaris.decDeg, lat, lst);
      expect(Math.abs(altDeg - lat)).toBeLessThanOrEqual(1);
    }
  });

  it('Polaris is below the horizon at lat −10', () => {
    for (const lst of LSTS) expect(equatorialToHorizontal(polaris.raDeg, polaris.decDeg, -10, lst).altDeg).toBeLessThan(0);
  });

  it('Crux construction (Gacrux→Acrux × 4.5) lands within ~3° of the south celestial pole', () => {
    const p = cruxPolePoint(4.5);
    expect(Math.abs(p.decDeg - -90)).toBeLessThan(3);
  });

  it('a star with dec = lat passes through the zenith at H = 0', () => {
    for (const lat of [-20, -7, 0, 12, 25]) {
      expect(equatorialToHorizontal(100, lat, lat, 100).altDeg).toBeCloseTo(90, 4); // asin loses precision near 90°
    }
  });

  it('group-rotation matrix agrees with equatorialToHorizontal to < 0.1° (20 random stars)', () => {
    const rnd = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const ra = rnd() * 360, dec = Math.asin(rnd() * 2 - 1) * (180 / Math.PI);
      const lat = rnd() * 50 - 25, lst = rnd() * 360;
      const { altDeg, azDeg } = equatorialToHorizontal(ra, dec, lat, lst);
      const expected = horizontalToVector(altDeg, azDeg);
      const got = applyMatrix3(equatorialToWorldMatrix(lat, lst), equatorialVector(ra, dec));
      const dot = expected.reduce((s, e, j) => s + e * got[j], 0);
      expect(Math.acos(Math.min(1, dot)) * (180 / Math.PI)).toBeLessThan(0.1);
    }
  });
});

describe('catalogue', () => {
  it('has ~1,600 stars, brightest first, Sun excluded', () => {
    expect(STARS.length).toBeGreaterThan(1500);
    expect(STARS[0].name).toBe('Sirius');
    expect(STARS.every((s) => s.mag <= 5)).toBe(true);
  });

  it('every constellation line endpoint exists in the catalogue', () => {
    for (const c of CONSTELLATIONS) for (const [a, b] of c.lines) {
      expect(starByHip(a), `${c.id} ${a}`).toBeDefined();
      expect(starByHip(b), `${c.id} ${b}`).toBeDefined();
    }
  });

  it('Dipper pointers: Merak→Dubhe × ~5 reaches Polaris (within 3°)', () => {
    const m = starByName('Merak'), d = starByName('Dubhe');
    const sep = separationDeg(m.raDeg, m.decDeg, d.raDeg, d.decDeg);
    const toPolaris = separationDeg(d.raDeg, d.decDeg, polaris.raDeg, polaris.decDeg);
    expect(toPolaris / sep).toBeGreaterThan(4.5);
    expect(toPolaris / sep).toBeLessThan(5.5);
  });

  it('B–V colours: blue stars are blue, red giants are red', () => {
    const [r1, , b1] = bvToRgb(-0.2);
    const [r2, , b2] = bvToRgb(1.6);
    expect(b1).toBeGreaterThan(r1);
    expect(r2).toBeGreaterThan(b2);
  });
});

describe('game date window (mid-April)', () => {
  // Decision: the game date is constrained so a taught pole-finder is usable at night at
  // every latitude in the world patch. North of the equator: the Dipper pointers.
  // South: the Southern Cross. Checked across a ±15-day window around Apr 15.
  const usable = (name: string, lat: number, lst: number) => {
    const s = starByName(name);
    return equatorialToHorizontal(s.raDeg, s.decDeg, lat, lst).altDeg > 8;
  };

  it.each([-25, -15, -5, 0, 5, 15, 25])('lat %i: a pole-finder is up during darkness', (lat) => {
    for (const dayOffset of [-15, 0, 15]) {
      let found = false;
      for (let h = 0; h < 24; h += 0.25) {
        const jd = julianDate(2026, 4, 15 + dayOffset, h);
        const sun = sunEquatorial(jd);
        const lst = lstDeg(jd, 0);
        if (equatorialToHorizontal(sun.raDeg, sun.decDeg, lat, lst).altDeg > -12) continue; // not dark
        const dipper = lat >= 0 && usable('Dubhe', lat, lst) && usable('Merak', lat, lst);
        const cross = lat <= 10 && usable('Acrux', lat, lst) && usable('Gacrux', lat, lst);
        if (dipper || cross) { found = true; break; }
      }
      expect(found, `lat ${lat} day ${dayOffset}`).toBe(true);
    }
  });
});
