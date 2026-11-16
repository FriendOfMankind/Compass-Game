import { describe, expect, it } from 'vitest';
import { NO_GO_DEG, optimalTrim, polar, sailState, trueWindAngle, windSide, wrap180 } from '../src/sim/sailing';

describe('sailing', () => {
  it('wrap180 / true wind angle', () => {
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-180)).toBe(180);
    expect(trueWindAngle(0, 60)).toBe(60);
    expect(trueWindAngle(350, 10)).toBe(20);
    expect(trueWindAngle(240, 60)).toBe(180);
  });

  it('wind side', () => {
    expect(windSide(0, 60)).toBe(1);   // NE wind, heading N → over starboard
    expect(windSide(0, 300)).toBe(-1);
  });

  it('no-go zone gives zero drive and luffs', () => {
    expect(polar(20)).toBe(0);
    expect(sailState(20, 10)).toEqual({ efficiency: 0, luffing: true });
  });

  it('beam reach is fastest; close-hauled and dead run are slower', () => {
    const beam = Math.max(polar(90), polar(100));
    expect(beam).toBeGreaterThan(0.95);
    expect(polar(NO_GO_DEG + 5)).toBeLessThan(beam * 0.6);
    expect(polar(180)).toBeLessThan(beam * 0.8);
    expect(polar(180)).toBeGreaterThan(0.5);
  });

  it('perfect trim = full efficiency; easing too far luffs; over-sheeting stalls without luffing', () => {
    const opt = optimalTrim(90);
    expect(sailState(90, opt)).toEqual({ efficiency: 1, luffing: false });
    expect(sailState(90, opt + 15).luffing).toBe(true);
    const tight = sailState(90, opt - 30);
    expect(tight.luffing).toBe(false);
    expect(tight.efficiency).toBeLessThan(0.7);
    expect(tight.efficiency).toBeGreaterThanOrEqual(0.15);
  });

  it('optimal trim eases out as you bear away', () => {
    expect(optimalTrim(45)).toBeLessThan(optimalTrim(90));
    expect(optimalTrim(90)).toBeLessThan(optimalTrim(170));
  });
});
