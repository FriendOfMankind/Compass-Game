// Runs the tutorial: one goal at a time, hold timers, timed hints, quiz questions,
// sky highlights, and step setup (time/position/wind) for story jumps and ?step= URLs.
import { STEPS, stepIndex, type StepSetup, type TutorialCtx } from './steps';
import { NO_OVERLAY, type SkyOverlay } from '../render/celestial';
import type { Dialogue } from '../ui/dialogue';
import type { Choice } from '../ui/choice';

export interface TutorialHost {
  /** jump = true when entering via URL (apply everything, incl. heading/station). */
  applySetup(setup: StepSetup, jump: boolean): void;
  setOverlay(o: SkyOverlay): void;
  setInstruments(ids: string[]): void;
}

export class TutorialRunner {
  private stepI: number;
  private goalI = 0;
  private goalStartS = -1;
  private heldS = 0;
  private hinted = false;
  private asking = false;
  private finished = false;
  private readonly goalEl = document.createElement('div');

  constructor(startN: number, private readonly host: TutorialHost, private readonly dialogue: Dialogue, private readonly choice: Choice) {
    const i = stepIndex(startN);
    this.stepI = i >= 0 ? i : 0;
    Object.assign(this.goalEl.style, {
      position: 'fixed', top: '74px', right: '16px', maxWidth: '320px', padding: '8px 12px',
      background: 'rgba(20, 14, 8, 0.7)', color: '#fff3d6', borderLeft: '3px solid #e0a64a',
      font: '14px/1.4 Georgia, serif', pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.goalEl);
    this.enterStep(true);
  }

  get active(): boolean { return !this.finished; }
  get stepN(): number { return STEPS[this.stepI].n; }

  private get goal() { return STEPS[this.stepI].goals[this.goalI]; }

  private enterStep(jump: boolean): void {
    const step = STEPS[this.stepI];
    if (step.setup) this.host.applySetup(step.setup, jump);
    this.host.setInstruments(step.setup?.instruments ?? ['hand']);
    this.goalI = 0;
    this.enterGoal();
  }

  private enterGoal(): void {
    this.goalStartS = -1; // stamped on first update
    this.heldS = 0;
    this.hinted = false;
    this.host.setOverlay({ ...NO_OVERLAY, ...this.goal.overlay });
    const step = STEPS[this.stepI];
    this.goalEl.innerHTML = `<div style="font-size:11px;letter-spacing:.08em;color:#e0a64a">STEP ${step.n} · ${step.title.toUpperCase()}</div>${this.goal.text}`;
  }

  update(c: TutorialCtx, nowS: number, dt: number): void {
    if (this.finished || this.asking) return;
    const g = this.goal;
    if (this.goalStartS < 0) {
      this.goalStartS = nowS;
      for (const k of [g.intro ?? []].flat()) this.dialogue.say(k, nowS);
    }
    if (!this.hinted && g.hint && nowS - this.goalStartS > (g.hintAfterS ?? 30)) {
      this.hinted = true;
      this.dialogue.say(g.hint, nowS);
      if (g.hintOverlay) this.host.setOverlay({ ...NO_OVERLAY, ...g.overlay, ...g.hintOverlay });
    }
    this.heldS = g.check(c) ? this.heldS + dt : 0;
    if (this.heldS < (g.holdS ?? 0) || (g.holdS === undefined && this.heldS === 0)) return;

    if (g.question) {
      this.asking = true;
      this.dialogue.say(g.question.key, nowS);
      const { labels, correct } = g.question.options(c);
      this.choice.ask(g.question.text, labels, (i) => {
        this.asking = false;
        if (i === correct) this.complete(nowS);
        else { this.dialogue.say(g.question!.wrong, nowS); this.heldS = 0; }
      });
      return;
    }
    this.complete(nowS);
  }

  private complete(nowS: number): void {
    const g = this.goal;
    if (g.done) this.dialogue.say(g.done, nowS);
    if (this.goalI + 1 < STEPS[this.stepI].goals.length) { this.goalI++; this.enterGoal(); return; }
    if (this.stepI + 1 < STEPS.length) { this.stepI++; this.enterStep(false); return; }
    this.finished = true;
    this.dialogue.say('tutorial.end', nowS);
    this.host.setInstruments(['hand', 'kamal', 'quadrant']);
    this.host.setOverlay(NO_OVERLAY);
    this.goalEl.innerHTML = '<div style="font-size:11px;letter-spacing:.08em;color:#e0a64a">TUTORIAL COMPLETE</div>Free sailing. Kamal (2) and quadrant (3) unlocked. C shows the star chart.';
  }
}
