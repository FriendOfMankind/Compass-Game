// Raised-instrument overlays, drawn on a 2D canvas over the 3D view.
// Everything is placed by projecting real sky directions (az/alt) to the screen, so a
// fist really is 10° tall wherever you look, and the kamal board really sits on the horizon.

import { handCount } from '../nav/instruments';

export type InstrumentId = 'hand' | 'kamal' | 'quadrant';
export const INSTRUMENT_NAMES: Record<InstrumentId, string> = { hand: 'Hand', kamal: 'Kamal', quadrant: 'Quadrant' };

/** Projects a sky direction to screen pixels; null if behind the camera. */
export type Projector = (azDeg: number, altDeg: number) => { x: number; y: number } | null;

export interface OverlayInput {
  instrument: InstrumentId;
  lookAzDeg: number;
  lookAltDeg: number;
  project: Projector;
  kamalKnotDeg: number;
  quadrantReadingDeg: number;
  quadrantSwingDeg: number;
}

export class InstrumentOverlay {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;

  constructor() {
    Object.assign(this.canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none' } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);
  }

  clear(): void {
    this.fit();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(o: OverlayInput): void {
    this.clear();
    if (o.instrument === 'hand') this.hand(o);
    else if (o.instrument === 'kamal') this.kamal(o);
    else this.quadrant(o);
  }

  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private hand(o: OverlayInput): void {
    const c = this.ctx;
    // Stack of three fists from the horizon at the look azimuth, slightly left of centre so
    // the star at the crosshair stays visible next to the knuckles.
    const az = o.lookAzDeg - 4;
    for (let f = 0; f < 3; f++) {
      const bl = o.project(az - 3.5, f * 10), tr = o.project(az + 3.5, (f + 1) * 10);
      if (!bl || !tr) continue;
      const x = Math.min(bl.x, tr.x), y = tr.y, w = Math.abs(tr.x - bl.x), h = bl.y - tr.y;
      c.fillStyle = 'rgba(196, 140, 98, 0.55)';
      c.strokeStyle = 'rgba(90, 50, 30, 0.9)';
      c.lineWidth = 2;
      c.beginPath(); c.roundRect(x, y + 1, w, h - 2, 8); c.fill(); c.stroke();
      c.lineWidth = 1; // finger creases every 2°
      for (let k = 1; k < 5; k++) {
        const p = o.project(az + 3.5, f * 10 + k * 2);
        if (p) { c.beginPath(); c.moveTo(x + w * 0.35, p.y); c.lineTo(x + w, p.y); c.stroke(); }
      }
      c.fillStyle = 'rgba(255, 245, 225, 0.9)';
      c.font = '13px Georgia, serif';
      c.fillText(`${(f + 1) * 10}°`, x + w + 6, y + 12);
    }
    this.caption('Hand at arm\'s length: fist ≈ 10°, finger ≈ 2°. Bottom fist sits on the horizon.');
    const n = handCount(o.lookAltDeg);
    void n; // the count is the player's job; no auto-solve (DESIGN §5)
  }

  private kamal(o: OverlayInput): void {
    const c = this.ctx;
    const bl = o.project(o.lookAzDeg - 4, 0), tr = o.project(o.lookAzDeg + 4, o.kamalKnotDeg);
    if (!bl || !tr) return;
    const x = Math.min(bl.x, tr.x), w = Math.abs(tr.x - bl.x);
    c.fillStyle = 'rgba(150, 105, 60, 0.6)';
    c.strokeStyle = 'rgba(60, 35, 15, 0.95)';
    c.lineWidth = 2;
    c.fillRect(x, tr.y, w, bl.y - tr.y);
    c.strokeRect(x, tr.y, w, bl.y - tr.y);
    // String from the board to your teeth (bottom centre of the screen).
    c.strokeStyle = 'rgba(230, 220, 190, 0.8)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + w / 2, (tr.y + bl.y) / 2); c.lineTo(window.innerWidth / 2, window.innerHeight + 10); c.stroke();
    c.fillStyle = 'rgba(255, 240, 210, 0.95)'; c.font = '14px Georgia, serif';
    c.fillText(`knot ${o.kamalKnotDeg}°`, x + w + 8, tr.y + 5);
    this.caption('Kamal: bottom edge on the horizon. Star above the top edge = you\'re further from the pole than this knot. Scroll to change knot.');
  }

  private quadrant(o: OverlayInput): void {
    const c = this.ctx, cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    c.strokeStyle = 'rgba(255, 230, 180, 0.9)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - 40, cy); c.lineTo(cx - 8, cy); c.moveTo(cx + 8, cy); c.lineTo(cx + 40, cy); c.stroke();
    // Quarter-circle scale with a swinging plumb line (bottom right).
    const R = 120, ox = window.innerWidth - 60, oy = window.innerHeight - 200;
    c.fillStyle = 'rgba(120, 85, 45, 0.75)';
    c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, R, Math.PI / 2, Math.PI); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40, 25, 10, 0.9)'; c.stroke();
    for (let d = 0; d <= 90; d += 5) {
      const a = Math.PI / 2 + (d / 90) * (Math.PI / 2), len = d % 10 === 0 ? 14 : 7;
      c.beginPath();
      c.moveTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R);
      c.lineTo(ox + Math.cos(a) * (R - len), oy + Math.sin(a) * (R - len));
      c.stroke();
    }
    const plumb = Math.PI / 2 + ((o.quadrantReadingDeg + o.quadrantSwingDeg) / 90) * (Math.PI / 2);
    c.strokeStyle = 'rgba(240, 235, 220, 0.95)';
    c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(plumb) * (R + 6), oy + Math.sin(plumb) * (R + 6)); c.stroke();
    c.fillStyle = 'rgba(255, 245, 225, 0.95)'; c.font = 'bold 22px Georgia, serif';
    c.fillText(`${o.quadrantReadingDeg.toFixed(1)}°`, ox - R - 10, oy - 12);
    this.caption('Quadrant: put the star on the sight line. The plumb bob swings with the boat; read between swings.');
  }

  private caption(text: string): void {
    const c = this.ctx;
    c.font = '14px Georgia, serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillText(text, window.innerWidth / 2 + 1, 97); // below the compass tape
    c.fillStyle = 'rgba(255, 245, 225, 0.95)';
    c.fillText(text, window.innerWidth / 2, 96);
    c.textAlign = 'start';
  }
}
