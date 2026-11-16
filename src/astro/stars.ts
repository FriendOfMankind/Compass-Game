// Star catalogue access + B–V colour. Pure (data is plain JSON).
import data from '../data/stars.json';
import { equatorialVector } from './transform';

export interface Star { raDeg: number; decDeg: number; mag: number; bv: number; hip: number | null; con: string | null; name: string | null; }

type Row = [number, number, number, number, number | null, string | null, string | null, string | null];

export const STARS: readonly Star[] = (data.stars as Row[]).map(([raDeg, decDeg, mag, bv, hip, con, name]) => ({ raDeg, decDeg, mag, bv, hip, con, name }));

const byHip = new Map<number, Star>();
const byName = new Map<string, Star>();
for (const s of STARS) {
  if (s.hip !== null) byHip.set(s.hip, s);
  if (s.name) byName.set(s.name.toLowerCase(), s);
}

export const starByHip = (hip: number) => byHip.get(hip);
export function starByName(name: string): Star {
  const s = byName.get(name.toLowerCase());
  if (!s) throw new Error(`unknown star ${name}`);
  return s;
}

/**
 * Pole-finding with the Southern Cross: extend Gacrux → Acrux by `lengths` cross-lengths.
 * Returns the RA/Dec of the point reached (great-circle extension).
 */
export function cruxPolePoint(lengths = 4.5): { raDeg: number; decDeg: number } {
  const g = equatorialVector(starByName('Gacrux').raDeg, starByName('Gacrux').decDeg);
  const a = equatorialVector(starByName('Acrux').raDeg, starByName('Acrux').decDeg);
  const ang = Math.acos(g[0] * a[0] + g[1] * a[1] + g[2] * a[2]);
  // Slerp past Acrux: point at angle (1 + lengths)·ang from Gacrux along the great circle.
  const t = 1 + lengths, sinA = Math.sin(ang);
  const w0 = Math.sin((1 - t) * ang) / sinA, w1 = Math.sin(t * ang) / sinA;
  const p = [0, 1, 2].map((i) => w0 * g[i] + w1 * a[i]);
  const dec = Math.asin(Math.max(-1, Math.min(1, p[2]))) * (180 / Math.PI);
  const ra = Math.atan2(p[1], p[0]) * (180 / Math.PI);
  return { raDeg: (ra + 360) % 360, decDeg: dec };
}

/** B–V colour index → linear-ish RGB 0..1 (Ballesteros 2012 temperature + blackbody fit). */
export function bvToRgb(bv: number): [number, number, number] {
  const b = Math.max(-0.4, Math.min(2.0, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62)); // Kelvin
  // Tanner Helland blackbody approximation, normalised.
  const k = t / 100;
  const r = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592);
  const g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492);
  const bl = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  const c = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return [c(r), c(g), c(bl)];
}
