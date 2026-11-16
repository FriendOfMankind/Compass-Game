// Parrot dialogue: subtitle bubble + queue + per-key cooldown (DESIGN §9).
// Lines come from src/content/parrot.json; never hardcode dialogue.
import lines from '../content/parrot.json';
import { mulberry32 } from '../util/rng';

const DATA = lines as Record<string, string[]>;
const SPEAKER = 'Admiral Biscuit';

export class Dialogue {
  private readonly el = document.createElement('div');
  private readonly queue: string[] = [];
  private showingUntil = 0;
  private readonly lastUsed = new Map<string, number>(); // key → time said
  private readonly lastVariant = new Map<string, number>();
  private readonly rnd: () => number;
  /** Called whenever a new line appears (the squawk). */
  onLine: (() => void) | null = null;

  constructor(seed: number) {
    this.rnd = mulberry32(seed ^ 0xb15c);
    this.el.id = 'parrot';
    this.el.className = 'parch';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  /** Queue a line by key. cooldownS: skip if this key was said within that many seconds. */
  say(key: string, nowS: number, cooldownS = 0): void {
    const variants = DATA[key];
    if (!variants?.length) { console.warn(`parrot.json: missing key ${key}`); return; }
    const last = this.lastUsed.get(key);
    if (cooldownS > 0 && last !== undefined && nowS - last < cooldownS) return;
    this.lastUsed.set(key, nowS);
    let i = Math.floor(this.rnd() * variants.length);
    if (variants.length > 1 && i === this.lastVariant.get(key)) i = (i + 1) % variants.length;
    this.lastVariant.set(key, i);
    this.queue.push(variants[i]);
  }

  get busy(): boolean { return this.queue.length > 0 || performance.now() < this.showingUntil; }

  update(): void {
    const now = performance.now();
    if (now < this.showingUntil) return;
    const next = this.queue.shift();
    if (!next) { this.el.style.display = 'none'; return; }
    this.el.innerHTML = '';
    const who = document.createElement('div');
    who.className = 'parch-label';
    who.textContent = SPEAKER;
    const text = document.createElement('div');
    text.textContent = next;
    this.el.append(who, text);
    this.el.style.display = 'block';
    this.onLine?.();
    this.showingUntil = now + 2200 + next.length * 55;
  }
}
