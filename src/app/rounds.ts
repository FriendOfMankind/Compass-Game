// Runs rounds: place the boat, set the clock, give the orders, watch for arrival.
// Reaching the target wins; the host then shows the harbour (pay + shop) and calls next().
import { pickRound, ordersText, fmtLat1, type Round } from '../world/rounds';
import type { Island, World } from '../world/worldgen';
import type { Dialogue } from '../ui/dialogue';
import type { Toast } from '../ui/toast';

const HARBOUR_AFTER_S = 3; // let the arrival sink in before the pay sheet

export interface RoundHost {
  placeBoat(latDeg: number, lonDeg: number, headingDeg: number): void;
  /** Jump the clock forward to that hour; returns the new game seconds. */
  setHour(hour: number): number;
  setOrders(text: string | null): void;
  /** Called when the player has seen an island up close (it goes on the chart). */
  discover(isl: Island): void;
  /** Round won: show the harbour; call next() when the player sets sail. */
  won(r: Round, next: () => void): void;
}

export class RoundRunner {
  round: Round;
  private wonAtS: number | null = null;
  private harbourShown = false;
  private startGameS = 0;

  constructor(private readonly world: World, private readonly seed: number, n: number,
              private readonly host: RoundHost, private readonly dialogue: Dialogue, private readonly toast: Toast) {
    this.round = pickRound(world, seed, n);
  }

  /** Call once everything exists (the toast/dialogue need a time). */
  start(nowS: number): void {
    const r = this.round;
    this.wonAtS = null;
    this.harbourShown = false;
    this.host.placeBoat(r.startLatDeg, r.startLonDeg, r.startHeadingDeg);
    this.startGameS = this.host.setHour(r.hour);
    this.host.setOrders(ordersText(r));
    this.toast.show(`Round ${r.n}: orders`, `${ordersText(r)} ${r.target.blurb}`, nowS, 12);
    this.dialogue.say('round.start', nowS);
  }

  /** Arrival at any island (from WorldSim). */
  onArrive(isl: Island, nowS: number, gameS: number): void {
    this.host.discover(isl);
    if (this.wonAtS !== null) return;
    if (isl.id !== this.round.target.id) {
      this.toast.show(isl.name, `Not the one in your orders. ${isl.blurb}`, nowS);
      this.dialogue.say('island.wrong', nowS, 20);
      return;
    }
    this.wonAtS = nowS;
    const hours = (gameS - this.startGameS) / 3600;
    this.toast.show(`${isl.name}. Made it.`, `Round ${this.round.n} done in ${hours.toFixed(1)} hours at sea.`, nowS, HARBOUR_AFTER_S + 1);
    this.dialogue.say('round.win', nowS);
  }

  update(nowS: number): void {
    if (this.wonAtS === null || this.harbourShown || nowS - this.wonAtS < HARBOUR_AFTER_S) return;
    this.harbourShown = true;
    this.host.won(this.round, () => {
      this.round = pickRound(this.world, this.seed, this.round.n + 1);
      this.start(performance.now() / 1000);
    });
  }

  get targetLatLabel(): string { return fmtLat1(this.round.target.latDeg); }
}
