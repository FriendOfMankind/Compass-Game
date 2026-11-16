// Point of sail + sail trim. Pure. Arcade, not a VPP.
// Angles in degrees at the API. "twa" = true wind angle off the bow, 0..180 (0 = head to wind).

export const NO_GO_DEG = 38;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Signed angle in (−180, 180]. */
export function wrap180(deg: number): number {
  const d = ((deg % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** windFromDeg: compass direction the wind blows FROM. Returns 0..180. */
export function trueWindAngle(headingDeg: number, windFromDeg: number): number {
  return Math.abs(wrap180(windFromDeg - headingDeg));
}

/** +1 if wind comes over starboard, −1 over port. */
export function windSide(headingDeg: number, windFromDeg: number): 1 | -1 {
  return wrap180(windFromDeg - headingDeg) >= 0 ? 1 : -1;
}

/** Fraction of max boat speed for a perfectly trimmed sail. Peak on a beam reach. */
export function polar(twaDeg: number): number {
  if (twaDeg < NO_GO_DEG) return 0;
  const up = smooth(NO_GO_DEG, 95, twaDeg) * 0.75 + 0.25 * smooth(NO_GO_DEG, 55, twaDeg);
  const downFalloff = 1 - 0.3 * smooth(110, 180, twaDeg); // dead run = 70%
  return clamp(up, 0, 1) * downFalloff;
}

/** Ideal boom angle off the centreline (0 = sheeted hard in, 90 = fully eased). */
export function optimalTrim(twaDeg: number): number {
  return clamp(twaDeg / 2 - 5, 8, 88);
}

export interface SailState {
  efficiency: number; // 0..1
  luffing: boolean;   // flapping: sail eased too far, or pointing into the no-go zone
}

/** trimDeg: player's boom angle 0..90. */
export function sailState(twaDeg: number, trimDeg: number): SailState {
  if (twaDeg < NO_GO_DEG) return { efficiency: 0, luffing: true };
  const diff = trimDeg - optimalTrim(twaDeg);
  if (diff > 0) {
    // Eased too far: the luff collapses fast.
    return { efficiency: clamp(1 - (diff / 22) ** 2, 0, 1), luffing: diff > 7 };
  }
  // Over-sheeted: stalls, slower, but doesn't flap. Never fully zero.
  return { efficiency: clamp(1 - (diff / 45) ** 2, 0.15, 1), luffing: false };
}
