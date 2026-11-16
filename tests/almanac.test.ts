import { describe, expect, it } from 'vitest';
import { almanac, longitudeFromTransit, nextTransitJd, ALMANAC_STARS } from '../src/astro/almanac';
import { julianDate, lstDeg } from '../src/astro/time';
import { equatorialToHorizontal } from '../src/astro/transform';
import { starByName } from '../src/astro/stars';

const jd0 = julianDate(2026, 4, 15, 18); // game evening, home time

describe('almanac + chronometer', () => {
  it('every almanac star exists', () => { for (const n of ALMANAC_STARS) expect(starByName(n)).toBeTruthy(); });

  it('at the computed passage the star is due south (or north) at its highest', () => {
    for (const lon of [-15, 0, 7.5, 18]) {
      const s = starByName('Regulus');
      const jd = nextTransitJd(s.raDeg, jd0, lon);
      expect(Math.abs(((lstDeg(jd, lon) - s.raDeg + 540) % 360) - 180)).toBeLessThan(1e-6);
      const h = equatorialToHorizontal(s.raDeg, s.decDeg, 5, lstDeg(jd, lon));
      // Regulus (dec +12°) seen from 5°N passes just NORTH of the zenith: azimuth 0. From further north it'd be 180.
      expect(Math.min(h.azDeg, 360 - h.azDeg)).toBeLessThan(0.5);
      expect(h.altDeg).toBeGreaterThan(80);
    }
  });

  it('recovers longitude from home vs observed passage', () => {
    for (const name of ['Spica', 'Arcturus', 'Sirius']) for (const lon of [-17.3, -4, 0.5, 9, 19.9]) {
      const ra = starByName(name).raDeg;
      const home = nextTransitJd(ra, jd0, 0);
      // The local passage nearest the home one (within ±12 h).
      let obs = nextTransitJd(ra, home - 0.5, lon);
      if (obs - home > 0.5) obs -= 1 / 1.0027379;
      expect(longitudeFromTransit(home, obs)).toBeCloseTo(lon, 6);
    }
  });

  it('4 minutes of time = 1° of longitude (the rule the parrot teaches)', () => {
    expect(longitudeFromTransit(jd0 + 4 / 1440, jd0)).toBeCloseTo(1.0027, 3);
  });

  it("tonight's almanac is sorted and within 14 hours", () => {
    const a = almanac(jd0);
    expect(a.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < a.length; i++) expect(a[i].homeJd).toBeGreaterThan(a[i - 1].homeJd);
    expect(a.every((e) => e.homeJd >= jd0 && e.homeJd - jd0 < 14 / 24)).toBe(true);
  });
});
