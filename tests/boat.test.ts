import { describe, expect, it } from 'vitest';
import { createBoat, MAX_SPEED_MS, stepBoat, telemetry, type Boat, type BoatInput, type Wind } from '../src/sim/boat';
import { optimalTrim, trueWindAngle } from '../src/sim/sailing';

const WIND: Wind = { fromDeg: 60, strength: 1 };
const idle: BoatInput = { steer: 0, trim: 0 };

function run(b: Boat, input: BoatInput, seconds: number, wind = WIND): Boat {
  for (let t = 0; t < seconds; t += 1 / 60) b = stepBoat(b, input, wind, 1 / 60);
  return b;
}

function trimmedBoat(headingDeg: number): Boat {
  return createBoat(0, 0, headingDeg, optimalTrim(trueWindAngle(headingDeg, WIND.fromDeg)));
}

describe('boat', () => {
  it('beam reach with good trim reaches near max speed in ~20 s', () => {
    const b = run(trimmedBoat(150), idle, 20); // wind from 60 → twa 90
    expect(b.speedMs).toBeGreaterThan(MAX_SPEED_MS * 0.9);
  });

  it('pointing into the wind goes nowhere', () => {
    const b = run(trimmedBoat(60), idle, 20);
    expect(b.speedMs).toBeLessThan(0.01);
  });

  it('moves in the heading direction (east = +X, north = −Z)', () => {
    const east = run(createBoat(0, 0, 90, optimalTrim(30)), idle, 10, { fromDeg: 0, strength: 1 });
    expect(east.x).toBeGreaterThan(20);
    expect(Math.abs(east.z)).toBeLessThan(1);
    const north = run(createBoat(0, 0, 0, optimalTrim(90)), idle, 10, { fromDeg: 90, strength: 1 });
    expect(north.z).toBeLessThan(-20);
  });

  it('starboard rudder turns clockwise', () => {
    let b = run(trimmedBoat(150), idle, 15);
    const h0 = b.headingDeg;
    b = run(b, { steer: 1, trim: 0 }, 2);
    expect(b.headingDeg).toBeGreaterThan(h0 + 10);
  });

  it('heels away from the wind', () => {
    // Wind over starboard (from 60, heading 150 → wind on port? check sign via windSide)
    const b = run(trimmedBoat(330), idle, 15); // heading 330, wind from 60 → over starboard → heel to port (−)
    expect(b.heelDeg).toBeLessThan(-5);
  });

  it('easing the sail too far slows the boat and luffs', () => {
    let b = run(trimmedBoat(150), idle, 20);
    b = run(b, { steer: 0, trim: -1 }, 2); // ease ~70°
    expect(telemetry(b, WIND).luffing).toBe(true);
    b = run(b, idle, 10);
    expect(b.speedMs).toBeLessThan(MAX_SPEED_MS * 0.5);
  });
});
