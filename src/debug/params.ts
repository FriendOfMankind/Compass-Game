// Scenario URL parsing: ?seed=&lat=&lon=&time=&heading=&step=&debug=1
//   plus &wind=<deg the wind blows FROM> &at=deck|helm|mast &speed=<m/s>
//   &date=YYYY-MM-DD (game start date; default mid-April, see progress.md) &lines=1 (constellation lines)
//   debug views: &look=<head yaw deg, relative to bow> &pitch=<head pitch deg> &cam=chase (external camera)
// `time` is HOME TIME: the clock at the patch's 0° meridian. Local solar time shifts with longitude.
// Pure: no DOM access. Pass in location.search.

export interface Scenario {
  seed: number;
  latDeg: number;
  lonDeg: number;
  /** Hour of the game day, 0–24. */
  hour: number;
  headingDeg: number;
  step: number | null;
  debug: boolean;
  windFromDeg: number;
  at: Station;
  speedMs: number;
  lookDeg: number;
  pitchDeg: number;
  chaseCam: boolean;
  date: { year: number; month: number; day: number };
  lines: boolean;
}

export type Station = 'deck' | 'helm' | 'mast';

// World bounds (DESIGN §6). Longitude is relative to the patch, centred on 0.
export const LAT_MIN_DEG = -25;
export const LAT_MAX_DEG = 25;
export const LON_MIN_DEG = -20;
export const LON_MAX_DEG = 20;

const NAMED_HOURS: Record<string, number> = {
  dawn: 6,
  day: 12,
  noon: 12,
  dusk: 18.5,
  night: 23,
  midnight: 0,
};

export const DEFAULT_SCENARIO: Omit<Scenario, 'seed'> = {
  latDeg: 10,
  lonDeg: 0,
  hour: 12,
  headingDeg: 0,
  step: null,
  debug: false,
  windFromDeg: 60, // NE trades
  at: 'deck',
  speedMs: 0,
  lookDeg: 0,
  pitchDeg: 0,
  chaseCam: false,
  date: { year: 2026, month: 4, day: 15 },
  lines: false,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function parseHour(raw: string | null): number | null {
  if (raw === null) return null;
  const key = raw.trim().toLowerCase();
  if (key in NAMED_HOURS) return NAMED_HOURS[key];
  const hm = /^(\d{1,2}):(\d{2})$/.exec(key);
  if (hm) return clamp(Number(hm[1]) + Number(hm[2]) / 60, 0, 24) % 24;
  const n = num(key);
  return n === null ? null : ((n % 24) + 24) % 24;
}

/**
 * @param search  e.g. location.search ("?lat=12&time=night")
 * @param fallbackSeed  used when no seed is given (caller supplies entropy;
 *                      everything downstream of the seed is deterministic)
 */
export function parseScenario(search: string, fallbackSeed: number): Scenario {
  const p = new URLSearchParams(search);
  const seed = num(p.get('seed'));
  const step = num(p.get('step'));
  const debugRaw = p.get('debug');
  return {
    seed: seed === null ? fallbackSeed : Math.trunc(seed),
    latDeg: clamp(num(p.get('lat')) ?? DEFAULT_SCENARIO.latDeg, LAT_MIN_DEG, LAT_MAX_DEG),
    lonDeg: clamp(num(p.get('lon')) ?? DEFAULT_SCENARIO.lonDeg, LON_MIN_DEG, LON_MAX_DEG),
    hour: parseHour(p.get('time')) ?? DEFAULT_SCENARIO.hour,
    headingDeg: normalizeDeg(num(p.get('heading')) ?? DEFAULT_SCENARIO.headingDeg),
    step: step === null ? null : Math.max(0, Math.trunc(step)),
    debug: flag(debugRaw),
    windFromDeg: normalizeDeg(num(p.get('wind')) ?? DEFAULT_SCENARIO.windFromDeg),
    at: parseStation(p.get('at')),
    speedMs: clamp(num(p.get('speed')) ?? DEFAULT_SCENARIO.speedMs, 0, 30),
    lookDeg: num(p.get('look')) ?? 0,
    pitchDeg: clamp(num(p.get('pitch')) ?? 0, -85, 85),
    chaseCam: p.get('cam') === 'chase',
    date: parseDate(p.get('date')) ?? DEFAULT_SCENARIO.date,
    lines: flag(p.get('lines')),
  };
}

function parseStation(raw: string | null): Station {
  return raw === 'helm' || raw === 'mast' ? raw : 'deck';
}

function flag(raw: string | null): boolean {
  return raw !== null && raw !== '0' && raw !== 'false';
}

export function parseDate(raw: string | null): Scenario['date'] | null {
  const m = raw ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw.trim()) : null;
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}
