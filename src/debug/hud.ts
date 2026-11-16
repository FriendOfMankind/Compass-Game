// Debug HUD (?debug=1). Plain DOM, one <div>, updated a few times per second.

export interface HudData {
  latDeg: number;
  lonDeg: number;
  headingDeg: number;
  speedKn: number;
  windText: string;
  lstText: string;
  timeText: string;
  fps: number;
  seed: number;
  step: number | null;
}

export class DebugHud {
  private readonly el: HTMLDivElement;
  private lastUpdateMs = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'debug-hud';
    document.body.appendChild(this.el);
  }

  update(nowMs: number, d: HudData): void {
    if (nowMs - this.lastUpdateMs < 200) return;
    this.lastUpdateMs = nowMs;
    const ns = d.latDeg >= 0 ? 'N' : 'S';
    const ew = d.lonDeg >= 0 ? 'E' : 'W';
    this.el.textContent = [
      `pos   ${Math.abs(d.latDeg).toFixed(3)}°${ns}  ${Math.abs(d.lonDeg).toFixed(3)}°${ew}`,
      `hdg   ${d.headingDeg.toFixed(1).padStart(5, '0')}°   spd ${d.speedKn.toFixed(1)} kn`,
      `wind  ${d.windText}`,
      `time  ${d.timeText}   LST ${d.lstText}`,
      `fps   ${d.fps.toFixed(0)}   seed ${d.seed}   step ${d.step ?? '—'}`,
    ].join('\n');
  }
}
