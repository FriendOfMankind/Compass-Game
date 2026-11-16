// Boat state + update. Pure. Custom arcade model (DESIGN §8), no physics engine.
import { polar, sailState, trueWindAngle, windSide } from './sailing';

export const MAX_SPEED_MS = 13;          // beam reach, perfect trim, wind strength 1
const MAX_YAW_RATE_DEG = 16;             // at speed, full rudder
const RUDDER_RATE = 2.2;                 // rudder units per second
const ACCEL_TAU_S = 4;
const DECEL_TAU_S = 7;
const MAX_HEEL_DEG = 14;

export interface Boat {
  x: number;              // world metres, +X east
  z: number;              // world metres, −Z north
  headingDeg: number;     // compass
  speedMs: number;
  yawRateDeg: number;     // deg/s
  rudder: number;         // −1 (port) .. +1 (starboard)
  trimDeg: number;        // boom angle off centreline, 0..90
  heelDeg: number;        // + = heeled to starboard
}

export interface Wind { fromDeg: number; strength: number; } // strength 1 = steady trade wind

export interface BoatInput {
  steer: number;   // −1..1 desired rudder (0 = centre it)
  trim: number;    // −1 ease .. +1 sheet in (deg/s scaled)
}

export interface BoatTelemetry { twaDeg: number; efficiency: number; luffing: boolean; targetSpeedMs: number; }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (cur: number, target: number, maxStep: number) =>
  cur + clamp(target - cur, -maxStep, maxStep);

export function createBoat(x: number, z: number, headingDeg: number, trimDeg = 45): Boat {
  return { x, z, headingDeg, speedMs: 0, yawRateDeg: 0, rudder: 0, trimDeg, heelDeg: 0 };
}

export function telemetry(b: Boat, wind: Wind): BoatTelemetry {
  const twaDeg = trueWindAngle(b.headingDeg, wind.fromDeg);
  const s = sailState(twaDeg, b.trimDeg);
  return { twaDeg, ...s, targetSpeedMs: MAX_SPEED_MS * wind.strength * polar(twaDeg) * s.efficiency };
}

export function stepBoat(b: Boat, input: BoatInput, wind: Wind, dt: number): Boat {
  const rudder = approach(b.rudder, clamp(input.steer, -1, 1), RUDDER_RATE * dt);
  const trimDeg = clamp(b.trimDeg - input.trim * 35 * dt, 0, 90);

  const tel = telemetry({ ...b, trimDeg }, wind);
  const tau = tel.targetSpeedMs > b.speedMs ? ACCEL_TAU_S : DECEL_TAU_S;
  const speedMs = b.speedMs + (tel.targetSpeedMs - b.speedMs) * (1 - Math.exp(-dt / tau));

  // Steerage: some turning even when slow, full authority from ~5 m/s.
  const authority = 0.25 + 0.75 * clamp(speedMs / 5, 0, 1);
  const targetYaw = rudder * MAX_YAW_RATE_DEG * authority;
  const yawRateDeg = b.yawRateDeg + (targetYaw - b.yawRateDeg) * (1 - Math.exp(-dt / 0.6));
  const headingDeg = (((b.headingDeg + yawRateDeg * dt) % 360) + 360) % 360;

  const hRad = (headingDeg * Math.PI) / 180;
  const x = b.x + Math.sin(hRad) * speedMs * dt;
  const z = b.z - Math.cos(hRad) * speedMs * dt;

  // Heel away from the wind, proportional to side force.
  const side = Math.sin((tel.twaDeg * Math.PI) / 180);
  const heelTarget = -windSide(headingDeg, wind.fromDeg) * MAX_HEEL_DEG * wind.strength * tel.efficiency * side
    * (tel.twaDeg < 38 ? 0 : 1);
  const heelDeg = b.heelDeg + (heelTarget - b.heelDeg) * (1 - Math.exp(-dt / 1.5));

  return { x, z, headingDeg, speedMs, yawRateDeg, rudder, trimDeg, heelDeg };
}
