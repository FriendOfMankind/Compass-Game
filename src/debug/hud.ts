// Debug HUD (?debug=1). Plain DOM, one <div>, updated a few times per second.

export interface HudData {
  latDeg: number;
  lonDeg: number;
  headingDeg: number;
  speedMs: number;
  windText: string;
  lstText: string;
  lookAzDeg: number;  // where the player's eyes point, compass degrees
  lookAltDeg: number; // degrees above the horizon
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
    // Centre crosshair: the "look" line reads exactly where this points.
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      position: 'fixed', left: '50%', top: '50%', width: '10px', height: '10px', margin: '-6px 0 0 -6px',
      border: '1px solid rgba(255, 120, 90, 0.85)', borderRadius: '50%', pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(dot);
  }

  update(nowMs: number, d: HudData): void {
    if (nowMs - this.lastUpdateMs < 200) return;
    this.lastUpdateMs = nowMs;
    const ns = d.latDeg >= 0 ? 'N' : 'S';
    const ew = d.lonDeg >= 0 ? 'E' : 'W';
    this.el.textContent = [
      `pos   ${Math.abs(d.latDeg).toFixed(3)}°${ns}  ${Math.abs(d.lonDeg).toFixed(3)}°${ew}`,
      `hdg   ${d.headingDeg.toFixed(1).padStart(5, '0')}°   spd ${d.speedMs.toFixed(1)} m/s`,
      `look  ${compassName(d.lookAzDeg)} ${d.lookAzDeg.toFixed(0).padStart(3, '0')}°   ${d.lookAltDeg >= 0 ? '+' : ''}${d.lookAltDeg.toFixed(1)}° up`,
      `wind  ${d.windText}`,
      `time  ${d.timeText}   LST ${d.lstText}`,
      `fps   ${d.fps.toFixed(0)}   seed ${d.seed}   step ${d.step ?? '—'}`,
    ].join('\n');
  }
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function compassName(azDeg: number): string {
  return POINTS[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8].padEnd(2, ' ');
}
