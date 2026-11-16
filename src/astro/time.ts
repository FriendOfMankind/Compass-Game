// Julian dates and sidereal time. Pure.
// Simplifications (fine at game precision, DESIGN §3): no ΔT, no nutation, GMST without T² terms.

const DEG = Math.PI / 180;
export const J2000 = 2451545.0;

/** Julian Date for a UTC calendar date + fractional hours. */
export function julianDate(year: number, month: number, day: number, hours = 0): number {
  return Date.UTC(year, month - 1, day) / 86400000 + 2440587.5 + hours / 24;
}

/** Greenwich mean sidereal time in degrees, 0..360. */
export function gmstDeg(jd: number): number {
  const g = 280.46061837 + 360.98564736629 * (jd - J2000);
  return ((g % 360) + 360) % 360;
}

/** Local sidereal time: LST = GMST + east longitude. Degrees 0..360. */
export function lstDeg(jd: number, lonDeg: number): number {
  return (((gmstDeg(jd) + lonDeg) % 360) + 360) % 360;
}

/** Low-precision sun (Astronomical Almanac), ~0.01° — plenty for day/night and noon sights. */
export function sunEquatorial(jd: number): { raDeg: number; decDeg: number } {
  const n = jd - J2000;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) / DEG;
  return { raDeg: ((ra % 360) + 360) % 360, decDeg: dec };
}
