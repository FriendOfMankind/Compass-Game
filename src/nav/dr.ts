// Dead reckoning. Pure. Integrates what the navigator BELIEVES (compass reading, last log
// reading), not the truth, so errors accumulate (DESIGN §2.4). Units: degrees lat/lon.
// Flat equirectangular world (DESIGN §6): 1° = 600 m both ways, no cos(lat).

import { fromKnots } from './instruments';

export const M_PER_DEG = 600;

export interface LatLon { latDeg: number; lonDeg: number; }

export interface DrState {
  pos: LatLon;            // current DR estimate
  track: LatLon[];        // breadcrumb of DR positions (for the chart)
  marks: LatLon[];        // positions the player marked
  latLines: number[];     // latitude lines the player drew
  speedKn: number | null; // last log reading; null = never measured (DR can't advance)
  trackAccumS: number;
}

export function createDr(fix: LatLon): DrState {
  return { pos: { ...fix }, track: [{ ...fix }], marks: [], latLines: [], speedKn: null, trackAccumS: 0 };
}

/** Advance by sim seconds using compass heading and the logged speed. */
export function stepDr(s: DrState, compassDeg: number, simDt: number): DrState {
  if (s.speedKn === null || simDt <= 0) return s;
  const d = (fromKnots(s.speedKn) * simDt) / M_PER_DEG;
  const h = (compassDeg * Math.PI) / 180;
  const pos = { latDeg: s.pos.latDeg + Math.cos(h) * d, lonDeg: s.pos.lonDeg + Math.sin(h) * d };
  let { track, trackAccumS } = s;
  trackAccumS += simDt;
  if (trackAccumS >= 2) { track = [...track, pos]; trackAccumS = 0; }
  return { ...s, pos, track, trackAccumS };
}

export const logSpeed = (s: DrState, speedKn: number): DrState => ({ ...s, speedKn });
export const markPosition = (s: DrState): DrState => ({ ...s, marks: [...s.marks, { ...s.pos }] });
/** The player takes a fix (e.g. from a latitude sight): DR restarts from here. */
export const setFix = (s: DrState, fix: LatLon): DrState => ({ ...s, pos: { ...fix }, track: [...s.track, { ...fix }] });
export const addLatLine = (s: DrState, latDeg: number): DrState => ({ ...s, latLines: [...s.latLines, latDeg] });
