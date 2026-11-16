import { describe, expect, it } from 'vitest';
import { createClock, dayNumber, formatHour, hourOfDay, tickClock, TIME_SCALE } from '../src/sim/clock';

describe('clock', () => {
  it('a full game day takes 20 real minutes', () => {
    expect(TIME_SCALE).toBe(72);
    const c = tickClock(createClock(0), 20 * 60);
    expect(dayNumber(c)).toBe(1);
    expect(hourOfDay(c)).toBeCloseTo(0, 9);
  });

  it('one real minute advances 1.2 game hours', () => {
    expect(hourOfDay(tickClock(createClock(12), 60))).toBeCloseTo(13.2, 9);
  });

  it('warp multiplies time', () => {
    expect(hourOfDay(tickClock(createClock(0, 10), 50))).toBeCloseTo(10, 9);
  });

  it('formats hours', () => {
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(13.5)).toBe('13:30');
    expect(formatHour(23.999)).toBe('23:59');
  });
});
