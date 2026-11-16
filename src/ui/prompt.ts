// Bottom-centre HUD: a status line (sail state, log, warp) + control hint chips.
// Hints teach themselves away: each fades once you've used it a few times.
// Station prompts ("E take the helm") are sticky. H shows every hint again.
import type { Input } from './input';

export interface Hint {
  id: string;
  keys: string[];          // key-cap labels, e.g. ['A', 'D']
  label: string;
  codes?: string[];        // key codes that count as "used"
  sticky?: boolean;        // never fades (interaction affordances)
}

const LEARN_USES = 3;

export class Prompt {
  private readonly status = document.createElement('div');
  private readonly hints = document.createElement('div');
  private readonly uses = new Map<string, number>();
  private showAll = false;
  private lastStatus = '';
  private lastHints = '';

  constructor() {
    const root = document.createElement('div');
    root.id = 'hud-bottom';
    this.status.id = 'hud-status';
    this.hints.id = 'hud-hints';
    root.append(this.status, this.hints);
    document.body.appendChild(root);
    // Centre reticle: "look at X" checks and instrument sights measure from here.
    const dot = document.createElement('div');
    dot.id = 'reticle';
    document.body.appendChild(dot);
  }

  /** Count a use of a hint that isn't a key press (e.g. right-click). */
  use(id: string): void { this.uses.set(id, (this.uses.get(id) ?? 0) + 1); }

  set(statusHtml: string, hints: Hint[], input: Input): void {
    if (input.pressed('KeyH')) this.showAll = !this.showAll;
    for (const h of hints) if (h.codes?.some((c) => input.pressed(c))) this.use(h.id);

    if (statusHtml !== this.lastStatus) { this.lastStatus = statusHtml; this.status.innerHTML = statusHtml; }

    const shown = hints.filter((h) => h.sticky || this.showAll || (this.uses.get(h.id) ?? 0) < LEARN_USES);
    const hidden = hints.length - shown.length;
    const key = shown.map((h) => h.id + h.label).join('|') + `|${hidden}|${this.showAll}`;
    if (key === this.lastHints) return;
    this.lastHints = key;
    this.hints.innerHTML = '';
    for (const h of shown) this.hints.appendChild(chip(h.keys, h.label));
    if (hidden > 0 || this.showAll) this.hints.appendChild(chip(['H'], this.showAll ? 'hide controls' : 'controls', true));
  }
}

function chip(keys: string[], label: string, minor = false): HTMLElement {
  const el = document.createElement('span');
  el.className = minor ? 'hint minor' : 'hint';
  for (const k of keys) { const kb = document.createElement('kbd'); kb.textContent = k; el.appendChild(kb); }
  el.append(` ${label}`);
  return el;
}
