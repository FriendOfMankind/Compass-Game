// Career state across rounds (DESIGN §5, M6): gold, owned instruments, islands you've charted.
// Pure: rewards, purchases, (de)serialisation with validation. Storage lives in app/save.ts.

export type Item = 'quadrant' | 'chronometer';
export const PRICES: Record<Item, number> = { quadrant: 120, chronometer: 300 };
export const STARTING_INSTRUMENTS = ['hand', 'kamal'] as const;

export interface Progress {
  seed: number;
  round: number;          // next round to play
  gold: number;
  owned: string[];        // instrument ids
  known: string[];        // island names already on your chart
}

export function newProgress(seed: number): Progress {
  return { seed, round: 1, gold: 0, owned: [...STARTING_INSTRUMENTS], known: [] };
}

export interface Reward { base: number; distance: number; scrapes: number; total: number; }

/** Pay for the trip: longer passages pay more, hull scrapes cost repairs. Never below 10. */
export function roundReward(dLatDeg: number, dLonDeg: number, hullScrapes: number): Reward {
  const base = 30;
  const distance = Math.round(8 * Math.abs(dLatDeg) + 5 * Math.abs(dLonDeg));
  const scrapes = -10 * hullScrapes;
  return { base, distance, scrapes, total: Math.max(10, base + distance + scrapes) };
}

export function completeRound(p: Progress, reward: Reward, discovered: string[]): Progress {
  return { ...p, round: p.round + 1, gold: p.gold + reward.total, known: [...new Set([...p.known, ...discovered])] };
}

export const owns = (p: Progress, item: string) => p.owned.includes(item);
export const canBuy = (p: Progress, item: Item) => !owns(p, item) && p.gold >= PRICES[item];

export function buy(p: Progress, item: Item): Progress | null {
  if (!canBuy(p, item)) return null;
  return { ...p, gold: p.gold - PRICES[item], owned: [...p.owned, item] };
}

/** Parse saved JSON; anything malformed → null (start fresh rather than crash). */
export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Progress>;
    const ints = [o.seed, o.round, o.gold].every((v) => typeof v === 'number' && Number.isFinite(v));
    const lists = Array.isArray(o.owned) && Array.isArray(o.known) && [...o.owned, ...o.known].every((v) => typeof v === 'string');
    if (!ints || !lists || o.round! < 1 || o.gold! < 0) return null;
    return { seed: Math.trunc(o.seed!), round: Math.trunc(o.round!), gold: Math.trunc(o.gold!), owned: o.owned!, known: o.known! };
  } catch {
    return null;
  }
}
