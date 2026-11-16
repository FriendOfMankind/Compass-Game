// Keyboard state. Use .down() for held keys, .pressed() for one-shot (consumed per frame).

export class Input {
  private readonly held = new Set<string>();
  private readonly hits = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.hits.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  down(code: string): boolean { return this.held.has(code); }
  pressed(code: string): boolean { return this.hits.has(code); }
  axis(neg: string, pos: string): number { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  anyDown(codes: readonly string[]): boolean { return codes.some((c) => this.held.has(c)); }
  endFrame(): void { this.hits.clear(); }
}
