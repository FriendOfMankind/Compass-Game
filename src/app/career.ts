// Your career across rounds: gold, instruments, charted islands, saved after every change.
import { buy, completeRound, newProgress, roundReward, type Item, type Progress } from '../sim/progression';
import { loadProgress, saveProgress } from './save';
import type { Round } from '../world/rounds';
import type { Harbour } from '../ui/harbour';

export class Career {
  progress: Progress;

  /** resume: continue the saved career if it's for this seed; otherwise start fresh at `round`. */
  constructor(seed: number, round: number, resume: boolean) {
    const saved = loadProgress();
    this.progress = resume && saved && saved.seed === seed ? saved : { ...newProgress(seed), round };
  }

  get instruments(): string[] { return this.progress.owned; }

  /** Pay out, save, open the harbour. onChange: instruments may have changed (purchases). */
  won(r: Round, scrapes: number, charted: string[], harbour: Harbour, onChange: () => void, next: () => void): void {
    const reward = roundReward(r.target.latDeg - r.startLatDeg, r.target.lonDeg - r.startLonDeg, scrapes);
    this.progress = completeRound(this.progress, reward, charted);
    saveProgress(this.progress);
    harbour.open(`${r.target.name}: round ${r.n} done`, reward, this.progress, (item: Item) => {
      this.progress = buy(this.progress, item) ?? this.progress;
      saveProgress(this.progress);
      onChange();
      return this.progress;
    }, next);
  }
}
