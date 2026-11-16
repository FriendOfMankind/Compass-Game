// Navigation layer: instruments (raise with right-click, 1/2/3 to switch), compass tape at the
// helm, log line (L), dead reckoning, and the chart table. Wires pure nav/ logic to the UI.
import {
  compassDeviationDeg, compassReadingDeg, DEFAULT_KAMAL_KNOTS_DEG, logReadingKn, quadrantReadingDeg,
} from '../nav/instruments';
import { addLatLine, createDr, logSpeed, markPosition, setFix, stepDr, type DrState, type LatLon } from '../nav/dr';
import { InstrumentOverlay, INSTRUMENT_NAMES, type InstrumentId, type Projector } from '../ui/instrumentOverlay';
import { CompassTape } from '../ui/compassTape';
import { Chart } from '../ui/chart';
import type { Input } from '../ui/input';
import type { Dialogue } from '../ui/dialogue';
import { mulberry32 } from '../util/rng';

const LOG_GLASS_S = 4; // real seconds the sandglass runs
const KEYS: Record<string, InstrumentId> = { Digit1: 'hand', Digit2: 'kamal', Digit3: 'quadrant' };

export interface NavFrame {
  mode: string;
  trueHeadingDeg: number;
  yawRateDeg: number;
  speedMs: number;
  simDt: number;
  nowS: number;            // real seconds since start
  lookAzDeg: number;
  lookAltDeg: number;
  hullPitchDeg: number;
  hullRollDeg: number;
  project: Projector;
}

export class Navigation {
  dr: DrState;
  instrument: InstrumentId = 'hand';
  available = new Set<InstrumentId>(['hand', 'kamal', 'quadrant']);
  raised = false;
  compassDeg = 0;
  quadrantDeg = 0;
  private knotIdx = 2;
  private logDoneAtS: number | null = null;
  private readonly deviationDeg: number;
  private readonly rnd: () => number;
  private readonly overlay = new InstrumentOverlay();
  private readonly tape = new CompassTape();
  readonly chart = new Chart();
  private chartSeen = false;
  /** The E that opened the chart must be released before E can close it (same-frame bug). */
  private chartCloseArmed = false;

  constructor(seed: number, startFix: LatLon, private readonly dialogue: Dialogue, onChartClose: () => void) {
    this.dr = createDr(startFix);
    this.deviationDeg = compassDeviationDeg(seed);
    this.rnd = mulberry32(seed ^ 0x106);
    this.onChartClose = onChartClose;
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => { if (e.button === 2) this.raised = true; });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.raised = false; });
    window.addEventListener('blur', () => { this.raised = false; }); // never leave an arm stuck up
    // A mouseup can get lost (focus change, a dialog freeing the mouse): trust the live button state.
    document.addEventListener('mousemove', (e) => { if (this.raised && (e.buttons & 2) === 0) this.raised = false; });
    window.addEventListener('wheel', (e) => {
      if (!this.raised || this.instrument !== 'kamal') return;
      const n = DEFAULT_KAMAL_KNOTS_DEG.length;
      this.knotIdx = (this.knotIdx + (e.deltaY > 0 ? -1 : 1) + n) % n;
    });
  }
  private readonly onChartClose: () => void;

  get kamalKnotDeg(): number { return DEFAULT_KAMAL_KNOTS_DEG[this.knotIdx]; }

  /** Restart DR from a known position (port departure, tutorial teleport). */
  resetFix(fix: LatLon): void { this.dr = setFix({ ...createDr(fix), speedKn: this.dr.speedKn }, fix); }

  openChart(): void {
    this.chartCloseArmed = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.chart.open(this.dr, {
      mark: () => { this.dr = markPosition(this.dr); this.chart.update(this.dr); },
      addLatLine: (lat) => { this.dr = addLatLine(this.dr, lat); this.chart.update(this.dr); },
      close: () => { this.chart.close(); this.onChartClose(); },
    });
    if (!this.chartSeen) { this.chartSeen = true; this.dialogue.say('chart.first', 0); }
  }

  handleInput(input: Input, f: NavFrame): void {
    for (const [code, id] of Object.entries(KEYS)) if (input.pressed(code) && this.available.has(id)) this.instrument = id;
    if (input.pressed('KeyL') && this.logDoneAtS === null && f.mode !== 'chart') {
      this.logDoneAtS = f.nowS + LOG_GLASS_S;
      this.dialogue.say('log.thrown', f.nowS, 5);
    }
    if (this.chart.isOpen) {
      if (!this.chartCloseArmed) this.chartCloseArmed = !input.down('KeyE');
      else if (input.pressed('Escape') || input.pressed('KeyE')) { this.chart.close(); this.onChartClose(); }
    }
  }

  /** Returns extra prompt text for this frame. */
  update(f: NavFrame): string {
    this.compassDeg = compassReadingDeg(f.trueHeadingDeg, this.deviationDeg, f.yawRateDeg, f.nowS);
    this.dr = stepDr(this.dr, this.compassDeg, f.simDt);
    if (this.chart.isOpen) this.chart.update(this.dr);

    let extra = '';
    if (this.logDoneAtS !== null) {
      const left = this.logDoneAtS - f.nowS;
      if (left <= 0) {
        this.dr = logSpeed(this.dr, logReadingKn(f.speedMs, this.rnd()));
        this.logDoneAtS = null;
        this.dialogue.say('log.result', f.nowS, 5);
      } else extra = `log line out… sandglass ${Math.ceil(left)}`;
    }
    if (this.dr.speedKn !== null && !extra) extra = `log: ${this.dr.speedKn.toFixed(1)} kn`;

    this.tape.visible = f.mode === 'helm';
    if (f.mode === 'helm') this.tape.draw(this.compassDeg);

    const canRaise = f.mode !== 'chart' && this.available.has(this.instrument);
    if (this.raised && canRaise) {
      this.quadrantDeg = quadrantReadingDeg(f.lookAltDeg, f.hullPitchDeg, f.hullRollDeg, f.nowS);
      this.overlay.draw({
        instrument: this.instrument, lookAzDeg: f.lookAzDeg, lookAltDeg: f.lookAltDeg, project: f.project,
        kamalKnotDeg: this.kamalKnotDeg, quadrantReadingDeg: this.quadrantDeg,
        quadrantSwingDeg: Math.sin(f.nowS * 2.3) * 0.35 * f.hullPitchDeg,
      });
    } else this.overlay.clear();

    const inst = Object.entries(KEYS).filter(([, id]) => this.available.has(id))
      .map(([code, id]) => `${code.slice(-1)} ${INSTRUMENT_NAMES[id]}${id === this.instrument ? '*' : ''}`).join('  ');
    const parts = [extra, inst && `right-click raise: ${inst}`, 'L log'].filter(Boolean);
    return parts.join('    ·    ');
  }
}
