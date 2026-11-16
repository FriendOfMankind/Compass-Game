// Walking on deck, in boat-local coordinates. Pure.
// Local axes: +X starboard, −Z forward (bow), +Z aft (stern). Deck is a tapered hull outline.

export const DECK_HALF_LENGTH = 5.6;
export const DECK_HALF_BEAM = 1.9;
const WALK_SPEED = 2.6;
const RAIL_MARGIN = 0.35;
const INTERACT_RADIUS = 1.3;

export type StationId = 'helm' | 'mast';
export interface Station { id: StationId; x: number; z: number; label: string; }

export const STATIONS: readonly Station[] = [
  { id: 'helm', x: 0, z: 4.3, label: 'take the helm' },
  { id: 'mast', x: 0, z: -1.2, label: 'work the sail' },
];

/** Where the player stands when using a station. */
export const STATION_STAND: Record<StationId, { x: number; z: number }> = {
  helm: { x: 0, z: 5.2 },
  mast: { x: 0.7, z: -0.4 },
};

/** Half-width of the walkable deck at local z (bow narrows to a point). */
export function deckHalfWidth(z: number): number {
  const t = (z + DECK_HALF_LENGTH) / (2 * DECK_HALF_LENGTH); // 0 at bow, 1 at stern
  const shape = Math.sqrt(Math.min(1, Math.max(0, t) / 0.55)) * (t > 0.85 ? 1 - (t - 0.85) * 0.8 : 1);
  return Math.max(0, DECK_HALF_BEAM * shape - RAIL_MARGIN);
}

export function clampToDeck(x: number, z: number): { x: number; z: number } {
  const zc = Math.min(DECK_HALF_LENGTH - RAIL_MARGIN, Math.max(-DECK_HALF_LENGTH + 1.2, z));
  const hw = deckHalfWidth(zc);
  return { x: Math.min(hw, Math.max(-hw, x)), z: zc };
}

/**
 * Move relative to where the player looks. lookYawRad is yaw relative to the bow
 * (0 = facing forward, + = turned to starboard). fwd/right in −1..1.
 */
export function walk(pos: { x: number; z: number }, fwd: number, right: number, lookYawRad: number, dt: number) {
  const len = Math.hypot(fwd, right);
  if (len === 0) return pos;
  const f = fwd / Math.max(1, len), r = right / Math.max(1, len);
  const s = Math.sin(lookYawRad), c = Math.cos(lookYawRad);
  // forward in local = (sin y, −cos y); right = (cos y, sin y)
  const dx = (f * s + r * c) * WALK_SPEED * dt;
  const dz = (-f * c + r * s) * WALK_SPEED * dt;
  return clampToDeck(pos.x + dx, pos.z + dz);
}

export function nearestStation(pos: { x: number; z: number }): Station | null {
  let best: Station | null = null, bestD = INTERACT_RADIUS;
  for (const s of STATIONS) {
    const d = Math.hypot(s.x - pos.x, s.z - pos.z);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}
