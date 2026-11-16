// Game clock. One game day = 20 real minutes (DESIGN §6).
// Pure: advance with real-time deltas, read hour of day.

export const REAL_SECONDS_PER_GAME_DAY = 20 * 60;
export const GAME_SECONDS_PER_DAY = 24 * 3600;
/** Game seconds that pass per real second at 1× speed (= 72). */
export const TIME_SCALE = GAME_SECONDS_PER_DAY / REAL_SECONDS_PER_GAME_DAY;

export interface Clock {
  /** Game seconds since day 0, 00:00. */
  gameSeconds: number;
  /** Extra multiplier for fast-forward (1 = normal). */
  warp: number;
}

export function createClock(startHour: number, warp = 1): Clock {
  return { gameSeconds: startHour * 3600, warp };
}

export function tickClock(clock: Clock, realDtSeconds: number): Clock {
  return { ...clock, gameSeconds: clock.gameSeconds + realDtSeconds * TIME_SCALE * clock.warp };
}

export function hourOfDay(clock: Clock): number {
  const s = ((clock.gameSeconds % GAME_SECONDS_PER_DAY) + GAME_SECONDS_PER_DAY) % GAME_SECONDS_PER_DAY;
  return s / 3600;
}

export function dayNumber(clock: Clock): number {
  return Math.floor(clock.gameSeconds / GAME_SECONDS_PER_DAY);
}

export function formatHour(hour: number): string {
  const totalMin = Math.floor(hour * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
