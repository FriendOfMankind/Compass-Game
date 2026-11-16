import { describe, expect, it } from 'vitest';
import { parseHour, parseScenario, DEFAULT_SCENARIO } from '../src/debug/params';

describe('parseScenario', () => {
  it('uses defaults and the fallback seed when empty', () => {
    const s = parseScenario('', 777);
    expect(s).toEqual({ ...DEFAULT_SCENARIO, seed: 777 });
  });

  it('parses the full design example', () => {
    const s = parseScenario('?seed=42&lat=12&lon=-3&time=night&heading=90&step=5', 1);
    expect(s).toMatchObject({ seed: 42, latDeg: 12, lonDeg: -3, hour: 23, headingDeg: 90, step: 5, debug: false });
  });

  it('clamps lat/lon to the world patch and wraps heading', () => {
    const s = parseScenario('?lat=80&lon=-99&heading=-90', 1);
    expect(s.latDeg).toBe(25);
    expect(s.lonDeg).toBe(-20);
    expect(s.headingDeg).toBe(270);
  });

  it('ignores garbage values', () => {
    const s = parseScenario('?lat=banana&seed=&heading=NaN', 5);
    expect(s.latDeg).toBe(DEFAULT_SCENARIO.latDeg);
    expect(s.seed).toBe(5);
    expect(s.headingDeg).toBe(0);
  });

  it('debug flag: present means on, 0/false means off', () => {
    expect(parseScenario('?debug=1', 1).debug).toBe(true);
    expect(parseScenario('?debug', 1).debug).toBe(true);
    expect(parseScenario('?debug=0', 1).debug).toBe(false);
    expect(parseScenario('?debug=false', 1).debug).toBe(false);
  });
});

describe('parseHour', () => {
  it('handles names, hh:mm and numbers', () => {
    expect(parseHour('dawn')).toBe(6);
    expect(parseHour('NIGHT')).toBe(23);
    expect(parseHour('21:30')).toBe(21.5);
    expect(parseHour('26')).toBe(2);
    expect(parseHour('-1')).toBe(23);
    expect(parseHour('nope')).toBeNull();
  });
});

describe('M1 params', () => {
  it('parses wind, station and speed', () => {
    const s = parseScenario('?wind=-30&at=helm&speed=9', 1);
    expect(s.windFromDeg).toBe(330);
    expect(s.at).toBe('helm');
    expect(s.speedMs).toBe(9);
  });
  it('defaults: world wind field (no pinned wind), on deck, stopped; unknown station → deck', () => {
    const s = parseScenario('?at=crowsnest', 1);
    expect(s).toMatchObject({ windFromDeg: null, at: 'deck', speedMs: 0 });
  });
});

describe('M2 params', () => {
  it('date, pitch, lines', () => {
    const s = parseScenario('?date=2026-03-01&pitch=30&lines=1', 1);
    expect(s.date).toEqual({ year: 2026, month: 3, day: 1 });
    expect(s.pitchDeg).toBe(30);
    expect(s.lines).toBe(true);
  });
  it('bad date falls back to mid-April default', () => {
    expect(parseScenario('?date=2026-13-40', 1).date).toEqual({ year: 2026, month: 4, day: 15 });
    expect(parseScenario('?date=yesterday', 1).date).toEqual({ year: 2026, month: 4, day: 15 });
  });
});
