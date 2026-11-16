// Nautical almanac + chronometer longitude (DESIGN §2.4: "comparing local star time to home port
// time gives longitude directly"). Pure.
// A star crosses your meridian (due south or north, at its highest) when local sidereal time = its RA.
// The almanac lists when that happens at HOME (0° meridian) in home time. Watch it cross where you
// are, read the chronometer (home time): every 4 minutes earlier than the almanac = 1° east.
import { gmstDeg } from './time';
import { starByName } from './stars';

export const SIDEREAL_DEG_PER_DAY = 360.98564736629;

/** Bright, well-known stars that cross the tropical sky high enough to time. */
export const ALMANAC_STARS = ['Aldebaran', 'Betelgeuse', 'Sirius', 'Procyon', 'Pollux', 'Regulus', 'Spica', 'Arcturus', 'Antares', 'Vega', 'Altair'] as const;

/** JD of the first upper meridian passage at longitude lonDeg (east +) at or after jdFrom. */
export function nextTransitJd(raDeg: number, jdFrom: number, lonDeg = 0): number {
  const d = ((((raDeg - lonDeg - gmstDeg(jdFrom)) % 360) + 360) % 360);
  return jdFrom + d / SIDEREAL_DEG_PER_DAY;
}

/** Longitude (east +) from the almanac's home passage and the passage you observed (both as JD). */
export function longitudeFromTransit(almanacJd: number, observedJd: number): number {
  const deg = (almanacJd - observedJd) * SIDEREAL_DEG_PER_DAY;
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export interface AlmanacEntry { name: string; homeJd: number; }

/** Tonight's home-meridian passages, in time order, for the 14 hours from jdFrom. */
export function almanac(jdFrom: number): AlmanacEntry[] {
  return ALMANAC_STARS.map((name) => ({ name, homeJd: nextTransitJd(starByName(name).raDeg, jdFrom) }))
    .filter((e) => e.homeJd - jdFrom < 14 / 24)
    .sort((a, b) => a.homeJd - b.homeJd);
}
