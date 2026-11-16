// Glue between the game loop's state and the tutorial / round runners. main.ts owns the state
// and hands it over as accessors (GameRef); these hosts only translate "what the step/round
// wants" into changes to that state.
import type { Boat, Wind } from '../sim/boat';
import type { Clock } from '../sim/clock';
import { dayNumber, hourOfDay } from '../sim/clock';
import { optimalTrim, trueWindAngle } from '../sim/sailing';
import { STATION_STAND } from '../sim/deck';
import type { Station } from '../debug/params';
import type { Navigation } from './navigation';
import type { WorldSim } from './worldSim';
import type { TutorialHost } from '../tutorial/runner';
import type { RoundHost, RoundRunner } from './rounds';
import type { StepSetup } from '../tutorial/steps';
import type { SkyOverlay } from '../render/celestial';
import type { InstrumentId } from '../ui/instrumentOverlay';
import type { OrdersCard } from '../ui/ordersCard';
import type { Island } from '../world/worldgen';
import { tutorialStart } from '../world/tutorialIsland';
import { M_PER_DEG } from '../nav/dr';

export interface GameRef {
  boat: Boat;
  clock: Clock;
  mode: Station;
  player: { x: number; z: number };
  readonly wind: Wind;
  readonly nav: Navigation;
  readonly worldSim: WorldSim;
  setOverlay(o: SkyOverlay): void;
}

const DECK_SPAWN = { x: 0.6, z: 1.0 }; // clear of all stations
export const fmtLatShort = (d: number) => `${Math.abs(d).toFixed(1)}°${d >= 0 ? 'N' : 'S'}`;

function moveTo(g: GameRef, latDeg: number, lonDeg: number): void {
  g.boat = g.worldSim.clearSpawn({ ...g.boat, x: lonDeg * M_PER_DEG, z: -latDeg * M_PER_DEG });
  g.nav.resetFix({ latDeg: -g.boat.z / M_PER_DEG, lonDeg: g.boat.x / M_PER_DEG });
}

function atStation(g: GameRef, at: Station): void {
  g.mode = at;
  g.player = at === 'deck' ? { ...DECK_SPAWN } : { ...STATION_STAND[at as Exclude<Station, 'deck'>] };
}

function knotFor(isl: Island, note = ''): { deg: number; label: string } {
  return { deg: +isl.latDeg.toFixed(1), label: `${fmtLatShort(isl.latDeg)} ${isl.name}${note}` };
}

/** Kamal knots: northern ports (+ an extra island, e.g. the orders' target). South: no Polaris, no knot. */
export function kamalKnots(g: GameRef, extra: Island | null, note: string) {
  return [
    ...g.worldSim.world.islands.filter((i) => i.port && i.latDeg > 0.5 && i.id !== extra?.id).map((i) => knotFor(i)),
    ...(extra && extra.latDeg > 0.5 ? [knotFor(extra, note)] : []),
  ];
}

export function tutorialHost(g: GameRef, isl: Island, onFinish: () => void): TutorialHost {
  return {
    applySetup: (s: StepSetup, jump: boolean) => {
      if (s.atTutorialStart) { const p = tutorialStart(g.worldSim.world, isl); moveTo(g, p.latDeg, p.lonDeg); }
      else if (s.latDeg !== undefined) moveTo(g, s.latDeg, g.boat.x / M_PER_DEG);
      if (s.hour !== undefined && (jump || s.hour - hourOfDay(g.clock) > 1)) {
        g.clock = { ...g.clock, gameSeconds: dayNumber(g.clock) * 86400 + s.hour * 3600 };
      }
      if (s.windFromDeg !== undefined) g.wind.fromDeg = s.windFromDeg;
      if (s.trimDeg !== undefined) g.boat = { ...g.boat, trimDeg: s.trimDeg };
      if (jump && s.headingDeg !== undefined) {
        g.boat = { ...g.boat, headingDeg: s.headingDeg, trimDeg: s.trimDeg ?? optimalTrim(trueWindAngle(s.headingDeg, g.wind.fromDeg)) };
      }
      if (jump && s.at) atStation(g, s.at);
    },
    setOverlay: (o) => g.setOverlay(o),
    setInstruments: (ids) => {
      g.nav.available = new Set(ids as InstrumentId[]);
      if (!g.nav.available.has(g.nav.instrument)) g.nav.instrument = (ids[0] as InstrumentId) ?? 'hand';
    },
    fill: (text) => text.replaceAll('{island}', isl.name).replaceAll('{islandLat}', fmtLatShort(isl.latDeg)),
    revealIsland: () => discover(g, isl),
    finished: onFinish,
  };
}

function discover(g: GameRef, isl: Island): void {
  if (!g.nav.chart.known.some((k) => k.name === isl.name)) g.nav.chart.known.push({ name: isl.name, latDeg: isl.latDeg, lonDeg: isl.lonDeg });
}

export function roundHost(g: GameRef, card: OrdersCard, rounds: () => RoundRunner | null, won: RoundHost['won']): RoundHost {
  return {
    placeBoat: (latDeg, lonDeg, h0) => {
      Object.assign(g.wind, g.worldSim.windAt(latDeg, lonDeg, g.clock.gameSeconds)); // trim for the wind actually there
      const headingDeg = trueWindAngle(h0, g.wind.fromDeg) < 50 ? (h0 + 90) % 360 : h0; // never start in irons
      g.boat = { ...g.boat, headingDeg, speedMs: 4, trimDeg: optimalTrim(trueWindAngle(headingDeg, g.wind.fromDeg)) };
      moveTo(g, latDeg, lonDeg);
      atStation(g, 'helm');
      g.worldSim.hullScrapes = 0; // repaired in harbour between rounds
    },
    setHour: (h) => { // always forward: the next time it's h o'clock
      const t = dayNumber(g.clock) * 86400 + h * 3600;
      g.clock = { ...g.clock, gameSeconds: t > g.clock.gameSeconds ? t : t + 86400 };
      return g.clock.gameSeconds;
    },
    setOrders: (text) => {
      const r = rounds();
      g.nav.chart.orders = text;
      card.set(`Round ${r?.round.n ?? ''} · orders`, text);
      g.nav.setKamalKnots(kamalKnots(g, r?.round.target ?? null, ' (orders)'));
    },
    discover: (isl) => discover(g, isl),
    won,
  };
}

/** Put islands from a saved career back on the chart. */
export function restoreChart(g: GameRef, names: string[]): void {
  for (const isl of g.worldSim.world.islands) if (names.includes(isl.name)) discover(g, isl);
}
