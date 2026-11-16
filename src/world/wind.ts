// Trade-wind field (DESIGN §2.6, §6). Pure and deterministic per seed.
// North of ~5°N: NE trades. South of ~5°S: SE trades. Between: the doldrums,
// weak wind that wanders. Gentle slow noise everywhere so it never feels scripted.
import { mulberry32 } from '../util/rng';

export interface WindSample { fromDeg: number; strength: number; }

export const NE_TRADE_FROM_DEG = 60;
export const SE_TRADE_FROM_DEG = 120;
export const DOLDRUMS_STRENGTH = 0.3;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Sum of a few incommensurate sines: smooth, bounded to about ±1, cheap. */
function wobble(phases: number[], t: number): number {
  return (Math.sin(t * 0.0011 + phases[0]) * 0.5 + Math.sin(t * 0.0029 + phases[1]) * 0.3 + Math.sin(t * 0.0071 + phases[2]) * 0.2);
}

export class WindField {
  private readonly ph: number[];

  constructor(seed: number) {
    const rnd = mulberry32(seed ^ 0x3a1d);
    this.ph = Array.from({ length: 12 }, () => rnd() * Math.PI * 2);
  }

  /** gameS: game seconds (so wind changes with game time, warp included). */
  at(latDeg: number, lonDeg: number, gameS: number): WindSample {
    const north = smooth(2, 7, latDeg), south = smooth(2, 7, -latDeg);
    const dol = Math.max(0, 1 - north - south);
    // gameS runs 72× real time. Scale so trade-wind wobble takes ~5 real minutes and the
    // doldrums swing round over a few minutes: fickle, not a blender.
    const t = gameS * 0.25 + lonDeg * 900; // drift varies slowly east–west too
    const ne = NE_TRADE_FROM_DEG + 10 * wobble(this.ph.slice(0, 3), t);
    const se = SE_TRADE_FROM_DEG + 10 * wobble(this.ph.slice(3, 6), t);
    const dd = 180 * wobble(this.ph.slice(6, 9), t * 1.6) + 90; // doldrums: anything goes
    const rad = (d: number) => (d * Math.PI) / 180;
    const x = north * Math.sin(rad(ne)) + south * Math.sin(rad(se)) + dol * Math.sin(rad(dd));
    const y = north * Math.cos(rad(ne)) + south * Math.cos(rad(se)) + dol * Math.cos(rad(dd));
    const fromDeg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
    const gust = 1 + 0.1 * wobble(this.ph.slice(9, 12), t * 3);
    const strength = ((north + south) * 1 + dol * DOLDRUMS_STRENGTH) * gust;
    return { fromDeg, strength };
  }
}
