// Seeded archipelago generation (DESIGN §6). Pure: same seed → same world.
// Constraints: 8–14 islands in 2–4 archipelagos, every island ≥ 1.5° of latitude from
// every other (so latitude sailing can tell them apart), ≥ 2 south of the equator,
// ≥ 1 deep in the doldrums (|lat| < 3°), one port per archipelago.
import { mulberry32 } from '../util/rng';
import content from '../content/islands.json';

export type IslandKind = 'peak' | 'atoll' | 'twin';

export interface Island {
  id: number;
  name: string;
  kind: IslandKind;
  latDeg: number;
  lonDeg: number;
  radiusM: number;      // shoreline radius
  heightM: number;      // highest point
  reefM: number;        // 0 = no reef; otherwise reef ring distance outside the shore
  reefGapDeg: number;   // bearing (from the island centre) of the pass through the reef
  shapeSeed: number;    // terrain noise seed
  port: boolean;
  archipelago: number;
  blurb: string;
}

export interface World { seed: number; islands: Island[]; }

export const WORLD_LAT = [-23, 23] as const;   // inside the ±25° patch, leaving sea room
export const WORLD_LON = [-18, 18] as const;
export const MIN_LAT_SEP_DEG = 1.5;
export const DOLDRUMS_DEG = 3;

const C = content as { patterns: string[]; adj: string[]; noun: string[]; feature: string[]; thing: string[]; blurb: Record<IslandKind, string[]> };

function pick<T>(rnd: () => number, arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]; }

function islandName(rnd: () => number, used: Set<string>, port: boolean): string {
  // Only ports may be called "Port …"; nobody should sail for a town that isn't there.
  const patterns = C.patterns.filter((p) => p.startsWith('Port') === port);
  for (let i = 0; i < 50; i++) {
    const n = pick(rnd, patterns.length ? patterns : C.patterns)
      .replace('{adj}', pick(rnd, C.adj)).replace('{noun}', pick(rnd, C.noun))
      .replace('{feature}', pick(rnd, C.feature)).replace('{thing}', pick(rnd, C.thing));
    if (!used.has(n)) { used.add(n); return n; }
  }
  return `Nameless Rock ${used.size}`;
}

function islandShape(rnd: () => number, kind: IslandKind): { radiusM: number; heightM: number; reefM: number; reefGapDeg: number; shapeSeed: number } {
  return { ...shapeDims(rnd, kind), reefGapDeg: rnd() * 360, shapeSeed: Math.floor(rnd() * 1e9) };
}

function shapeDims(rnd: () => number, kind: IslandKind): { radiusM: number; heightM: number; reefM: number } {
  if (kind === 'atoll') return { radiusM: 70 + rnd() * 60, heightM: 3 + rnd() * 2, reefM: 60 + rnd() * 50 };
  if (kind === 'peak') return { radiusM: 90 + rnd() * 70, heightM: 45 + rnd() * 35, reefM: rnd() < 0.3 ? 40 + rnd() * 30 : 0 };
  return { radiusM: 110 + rnd() * 60, heightM: 22 + rnd() * 14, reefM: rnd() < 0.3 ? 40 + rnd() * 30 : 0 };
}

/** One attempt; returns null if a constraint can't be met with this draw. */
function attempt(rnd: () => number): Omit<Island, 'name' | 'blurb' | 'id'>[] | null {
  const nArch = 2 + Math.floor(rnd() * 3);                 // 2..4
  const nIslands = 8 + Math.floor(rnd() * 7);              // 8..14
  const centres = Array.from({ length: nArch }, () => ({
    lat: WORLD_LAT[0] + 3 + rnd() * (WORLD_LAT[1] - WORLD_LAT[0] - 6),
    lon: WORLD_LON[0] + 3 + rnd() * (WORLD_LON[1] - WORLD_LON[0] - 6),
  }));
  // The equator story: one archipelago north (Polaris country), one south (Southern Cross),
  // so the player must learn both. The doldrums island comes from the spread (or a retry).
  centres[0].lat = 5 + rnd() * 13;
  centres[1].lat = -5 - rnd() * 13;

  const out: Omit<Island, 'name' | 'blurb' | 'id'>[] = [];
  for (let i = 0; i < nIslands; i++) {
    const a = i < nArch ? i : Math.floor(rnd() * nArch);
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const lat = centres[a].lat + (rnd() - 0.5) * 9;
      const lon = centres[a].lon + (rnd() - 0.5) * 7;
      if (lat < WORLD_LAT[0] || lat > WORLD_LAT[1] || lon < WORLD_LON[0] || lon > WORLD_LON[1]) continue;
      if (out.some((o) => Math.abs(o.latDeg - lat) < MIN_LAT_SEP_DEG)) continue;
      const kind: IslandKind = pick(rnd, ['peak', 'atoll', 'twin'] as const);
      out.push({ kind, latDeg: lat, lonDeg: lon, ...islandShape(rnd, kind), port: false, archipelago: a });
      placed = true;
    }
    if (!placed) return null;
  }
  for (let a = 0; a < nArch; a++) {
    const members = out.filter((o) => o.archipelago === a);
    if (members.length === 0) return null;
    members[0].port = true;
    if (members[0].kind === 'atoll') members[0].kind = 'twin'; // ports need a hill to build a town on
  }
  if (out.filter((o) => o.latDeg < 0).length < 2 || out.filter((o) => o.latDeg > 0).length < 2) return null;
  if (!out.some((o) => Math.abs(o.latDeg) < DOLDRUMS_DEG)) return null;
  return out;
}

export function generateWorld(seed: number): World {
  const rnd = mulberry32(seed ^ 0x5eed);
  for (let i = 0; i < 200; i++) {
    const raw = attempt(rnd);
    if (!raw) continue;
    const used = new Set<string>();
    raw.sort((a, b) => b.latDeg - a.latDeg); // north → south, stable ids
    const islands = raw.map((r, id) => ({ ...r, id, name: islandName(rnd, used, r.port), blurb: pick(rnd, C.blurb[r.kind]) }));
    return { seed, islands };
  }
  throw new Error(`worldgen: no valid world for seed ${seed}`);
}

/** Problems with a world (empty = valid). Used by tests; keeps the rules in one place. */
export function validateWorld(w: World): string[] {
  const p: string[] = [];
  const n = w.islands.length, arch = new Set(w.islands.map((i) => i.archipelago)).size;
  if (n < 8 || n > 14) p.push(`island count ${n}`);
  if (arch < 2 || arch > 4) p.push(`archipelago count ${arch}`);
  for (const a of w.islands) for (const b of w.islands) {
    if (a.id < b.id && Math.abs(a.latDeg - b.latDeg) < MIN_LAT_SEP_DEG) p.push(`${a.name}/${b.name} too close in latitude`);
  }
  if (w.islands.filter((i) => i.latDeg < 0).length < 2) p.push('fewer than 2 southern islands');
  if (w.islands.filter((i) => i.latDeg > 0).length < 2) p.push('fewer than 2 northern islands');
  if (w.islands.some((i) => i.name.startsWith('Port ') && !i.port)) p.push('a non-port called Port');
  if (!w.islands.some((i) => Math.abs(i.latDeg) < DOLDRUMS_DEG)) p.push('no doldrums island');
  if (new Set(w.islands.filter((i) => i.port).map((i) => i.archipelago)).size !== arch) p.push('archipelago without a port');
  if (w.islands.some((i) => i.latDeg < WORLD_LAT[0] || i.latDeg > WORLD_LAT[1] || i.lonDeg < WORLD_LON[0] || i.lonDeg > WORLD_LON[1])) p.push('island out of bounds');
  return p;
}
