// Instrument readings. Pure. Each instrument returns what the PLAYER sees, errors included.
// Real error sources: compass deviation (iron aboard), log-line timing, quadrant swinging
// with the boat. Hand and kamal error is human: they're drawn exact and judged by eye.

import { mulberry32 } from '../util/rng';

/** Displayed "knots" for a boat speed. Cosmetic: DR runs on internal units (see progress.md). */
export const KNOTS_PER_MS = 0.6;
export const toKnots = (ms: number) => ms * KNOTS_PER_MS;
export const fromKnots = (kn: number) => kn / KNOTS_PER_MS;

/** Fixed compass deviation for this ship, −2..+2° (DESIGN §5: ±2°). */
export function compassDeviationDeg(seed: number): number {
  return (mulberry32(seed ^ 0xc0ffee)() * 2 - 1) * 2;
}

/** What the compass card shows: true heading + fixed deviation + a little card swing. */
export function compassReadingDeg(trueHeadingDeg: number, deviationDeg: number, yawRateDeg: number, t: number): number {
  const swing = Math.sin(t * 1.7) * Math.min(3, Math.abs(yawRateDeg) * 0.15);
  return (((trueHeadingDeg + deviationDeg + swing) % 360) + 360) % 360;
}

/** Log line: true speed ±10% (sandglass timing + line stretch). rnd in [0,1). */
export function logReadingKn(trueSpeedMs: number, rnd: number): number {
  return toKnots(trueSpeedMs) * (1 + (rnd * 2 - 1) * 0.1);
}

/**
 * Quadrant: the altitude the sight line points at, plus plumb-bob swing driven by the
 * boat's motion. Reads to the nearest 0.5°. hullPitchDeg/hullRollDeg from the wave pose.
 */
export function quadrantReadingDeg(sightAltDeg: number, hullPitchDeg: number, hullRollDeg: number, t: number): number {
  const swing = Math.sin(t * 2.3) * 0.35 * hullPitchDeg + Math.sin(t * 1.1 + 1) * 0.15 * hullRollDeg;
  return Math.round((sightAltDeg + swing) * 2) / 2;
}

/** Kamal knots (latitudes). DESIGN: one per known port latitude — ports arrive in M4. */
export const DEFAULT_KAMAL_KNOTS_DEG = [5, 10, 15, 20, 25] as const;

export type KamalVerdict = 'above' | 'on' | 'below';
/** Star vs. the board's top edge for the chosen knot (≈ ±1° judgement window). */
export function kamalVerdict(starAltDeg: number, knotDeg: number): KamalVerdict {
  const d = starAltDeg - knotDeg;
  return Math.abs(d) <= 0.75 ? 'on' : d > 0 ? 'above' : 'below';
}

/** Hand at arm's length: fist ≈ 10°, finger ≈ 2°. Returns a spoken count for an altitude. */
export function handCount(altDeg: number): { fists: number; fingers: number } {
  const a = Math.max(0, altDeg);
  const fists = Math.floor(a / 10);
  return { fists, fingers: Math.round((a - fists * 10) / 2) };
}
