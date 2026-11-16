// "Make way" time warp: ramps up while the helmsman holds a steady course in open
// water, drops out instantly on any input. Pure.

export const MAX_WARP = 8;
const IDLE_BEFORE_WARP_S = 3;
const RAMP_PER_S = 0.9; // log-ramp: warp multiplies by e^0.9 ≈ 2.5 per second

export interface WarpState { idleS: number; warp: number; }

export const initialWarp = (): WarpState => ({ idleS: 0, warp: 1 });

export interface WarpConditions {
  atHelm: boolean;
  inputActive: boolean; // any steering/trim/movement key this frame
  speedMs: number;
  blocked: boolean;     // near land/reef/event (always false until M4)
}

/** realDt is wall-clock seconds; returns the new state. */
export function stepWarp(s: WarpState, c: WarpConditions, realDt: number): WarpState {
  if (!c.atHelm || c.inputActive || c.blocked || c.speedMs < 2) return { idleS: 0, warp: 1 };
  const idleS = s.idleS + realDt;
  if (idleS < IDLE_BEFORE_WARP_S) return { idleS, warp: 1 };
  return { idleS, warp: Math.min(MAX_WARP, s.warp * Math.exp(RAMP_PER_S * realDt)) };
}
