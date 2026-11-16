// Raised-instrument overlays, drawn on a 2D canvas over the 3D view.
// Everything is placed by projecting real sky directions (az/alt) to the screen, so a
// fist really is 10° tall wherever you look, and the kamal board really sits on the horizon.

import { handCount } from '../nav/instruments';

export type InstrumentId = 'hand' | 'kamal' | 'quadrant' | 'chronometer';
export const INSTRUMENT_NAMES: Record<InstrumentId, string> = { hand: 'Hand', kamal: 'Kamal', quadrant: 'Quadrant', chronometer: 'Chronometer' };

/** Projects a sky direction to screen pixels; null if behind the camera. */
export type Projector = (azDeg: number, altDeg: number) => { x: number; y: number } | null;

export interface OverlayInput {
  instrument: InstrumentId;
  lookAzDeg: number;
  lookAltDeg: number;
  project: Projector;
  kamalKnotDeg: number;
  kamalKnotLabel: string;
  quadrantReadingDeg: number;
  quadrantSwingDeg: number;
  homeHour: number; // chronometer: home time, 0..24
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
    else if (o.instrument === 'chronometer') this.chronometer(o);
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
    this.caption('Fist ≈ 10°, finger ≈ 2°. Count up from the horizon to the star.');
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
    c.fillText(`knot: ${o.kamalKnotLabel}`, x + w + 8, tr.y + 5);
    this.caption('Kamal: star above the top edge = you\'re north of this knot. Scroll: change knot.');
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
    this.caption('Quadrant: star on the sight line. Read between the plumb\'s swings.');
  }

  /** Pocket chronometer (home time) + your meridian drawn on the sky, due north and due south. */
  private chronometer(o: OverlayInput): void {
    const c = this.ctx;
    c.setLineDash([6, 6]); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255, 215, 140, 0.7)';
    for (const az of [0, 180]) {
      c.beginPath();
      let started = false;
      for (let alt = 0; alt <= 88; alt += 2) {
        const p = o.project(az, alt);
        if (!p) { started = false; continue; }
        if (started) c.lineTo(p.x, p.y); else { c.moveTo(p.x, p.y); started = true; }
      }
      c.stroke();
      const lbl = o.project(az, 3);
      if (lbl) { c.fillStyle = 'rgba(255, 215, 140, 0.9)'; c.font = 'italic 13px Georgia, serif'; c.fillText(az ? 'meridian (S)' : 'meridian (N)', lbl.x + 6, lbl.y); }
    }
    c.setLineDash([]);
    // The watch, bottom right: brass case, paper dial, hands, digits for the impatient.
    const R = 70, cx = window.innerWidth - 110, cy = window.innerHeight - 190;
    c.fillStyle = '#b07a26'; c.beginPath(); c.arc(cx, cy, R + 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f6e8c6'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a2414'; c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, len = i % 5 ? 4 : 9;
      c.beginPath(); c.moveTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R); c.lineTo(cx + Math.sin(a) * (R - len), cy - Math.cos(a) * (R - len)); c.stroke();
    }
    const h = o.homeHour % 12, m = (o.homeHour * 60) % 60;
    const hand = (frac: number, len: number, w: number) => {
      const a = frac * Math.PI * 2;
      c.lineWidth = w; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); c.stroke();
    };
    hand(h / 12, R * 0.5, 4); hand(m / 60, R * 0.82, 2.5);
    const hh = Math.floor(o.homeHour), mm = Math.floor(m);
    c.fillStyle = '#3a2414'; c.font = 'bold 15px Georgia, serif'; c.textAlign = 'center';
    c.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, cx, cy + R * 0.45);
    c.font = 'italic 11px Georgia, serif'; c.fillText('home time', cx, cy - R * 0.35);
    c.textAlign = 'start';
    this.caption('Chronometer: home time when a star crosses your meridian. See the chart\'s almanac.');
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
