// Chart table (DESIGN §8): a paper chart of what you BELIEVE. Shows the DR track, your
// marks and latitude lines you draw. Never shows the true position (no GPS, DESIGN §7).
import type { DrState } from '../nav/dr';

export interface ChartActions {
  mark(): void;
  addLatLine(latDeg: number): void;
  close(): void;
}

const fmtLat = (d: number) => `${Math.abs(d).toFixed(0)}°${d >= 0 ? 'N' : 'S'}`;
const fmtLon = (d: number) => `${Math.abs(d).toFixed(0)}°${d >= 0 ? 'E' : 'W'}`;

/** Parse "14", "14N", "6S", "-6", "6.5 s" → signed degrees. */
export function parseLatitude(raw: string): number | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*([nNsS])?\s*$/.exec(raw);
  if (!m) return null;
  let v = Number(m[1]);
  if (m[2] && m[2].toLowerCase() === 's') v = -Math.abs(v);
  return Math.abs(v) <= 90 ? v : null;
}

export class Chart {
  private readonly root = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private spanDeg = 8; // vertical span shown
  private dr: DrState | null = null;
  private actions: ChartActions | null = null;

  constructor() {
    Object.assign(this.root.style, {
      position: 'fixed', inset: '5% 8%', display: 'none', flexDirection: 'column', gap: '8px',
      background: '#e9dcb8', border: '10px solid #5a3a1c', borderRadius: '6px', padding: '10px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.7)', font: '15px Georgia, serif', color: '#2a1d10',
    } satisfies Partial<CSSStyleDeclaration>);
    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' });
    const btn = (label: string, fn: () => void) => {
      const b = document.createElement('button'); b.textContent = label; b.onclick = fn;
      Object.assign(b.style, { font: 'inherit', padding: '4px 10px', background: '#f6ecd2', border: '1px solid #5a3a1c', borderRadius: '4px', cursor: 'pointer' });
      return b;
    };
    const latInput = document.createElement('input');
    latInput.placeholder = 'e.g. 14N or 6S';
    Object.assign(latInput.style, { font: 'inherit', width: '120px', padding: '3px 6px' });
    const addLat = () => {
      const v = parseLatitude(latInput.value);
      if (v === null) { latInput.style.background = '#f3b6a6'; return; }
      latInput.style.background = ''; latInput.value = '';
      this.actions?.addLatLine(v); this.render();
    };
    latInput.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') addLat(); };
    const help = document.createElement('span');
    help.textContent = 'Scroll to zoom · E or Esc to close';
    help.style.marginLeft = 'auto';
    bar.append(
      btn('Mark DR position', () => { this.actions?.mark(); this.render(); }),
      document.createTextNode('Latitude line:'), latInput, btn('Draw', addLat),
      btn('Close', () => this.actions?.close()), help,
    );
    Object.assign(this.canvas.style, { flex: '1', width: '100%', minHeight: '0', background: '#efe4c4' });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spanDeg = Math.min(50, Math.max(2, this.spanDeg * (e.deltaY > 0 ? 1.2 : 1 / 1.2)));
      this.render();
    }, { passive: false });
    this.root.append(bar, this.canvas);
    document.body.appendChild(this.root);
  }

  get isOpen(): boolean { return this.root.style.display !== 'none'; }

  open(dr: DrState, actions: ChartActions): void {
    this.dr = dr; this.actions = actions;
    this.root.style.display = 'flex';
    this.render();
  }

  update(dr: DrState): void { this.dr = dr; if (this.isOpen) this.render(); }
  close(): void { this.root.style.display = 'none'; }

  private render(): void {
    const dr = this.dr; if (!dr) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
    const c = this.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height, ppd = H / this.spanDeg; // pixels per degree (flat chart, DESIGN §6)
    const cx = dr.pos.lonDeg, cy = dr.pos.latDeg;
    const X = (lon: number) => W / 2 + (lon - cx) * ppd, Y = (lat: number) => H / 2 - (lat - cy) * ppd;
    c.fillStyle = '#efe4c4'; c.fillRect(0, 0, W, H);

    const step = this.spanDeg > 20 ? 5 : 1;
    c.font = '12px Georgia, serif'; c.fillStyle = '#6b5235';
    for (let lat = Math.ceil((cy - this.spanDeg) / step) * step; lat <= cy + this.spanDeg; lat += step) {
      c.strokeStyle = lat === 0 ? '#8a3b1f' : 'rgba(107, 82, 53, 0.35)'; c.lineWidth = lat === 0 ? 2 : 1;
      c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(W, Y(lat)); c.stroke();
      if (Y(lat) < H - 18) c.fillText(lat === 0 ? 'Equator' : fmtLat(lat), 6, Y(lat) - 3);
    }
    const halfW = W / 2 / ppd;
    for (let lon = Math.ceil((cx - halfW) / step) * step; lon <= cx + halfW; lon += step) {
      c.strokeStyle = 'rgba(107, 82, 53, 0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(X(lon), 0); c.lineTo(X(lon), H); c.stroke();
      c.fillText(fmtLon(lon), X(lon) + 3, H - 6);
    }
    c.setLineDash([8, 5]); c.strokeStyle = '#a3261b'; c.lineWidth = 1.5;
    for (const lat of dr.latLines) {
      c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(W, Y(lat)); c.stroke();
      c.fillStyle = '#a3261b'; c.fillText(`sight ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`, W - 110, Y(lat) - 4);
    }
    c.setLineDash([]);
    c.strokeStyle = '#2a1d10'; c.lineWidth = 1.5; c.beginPath();
    dr.track.forEach((p, i) => (i ? c.lineTo(X(p.lonDeg), Y(p.latDeg)) : c.moveTo(X(p.lonDeg), Y(p.latDeg))));
    c.lineTo(X(dr.pos.lonDeg), Y(dr.pos.latDeg)); c.stroke();
    c.strokeStyle = '#1d3f7a'; c.lineWidth = 2;
    for (const m of dr.marks) {
      const x = X(m.lonDeg), y = Y(m.latDeg);
      c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.stroke();
    }
    c.fillStyle = '#2a1d10'; c.beginPath(); c.arc(W / 2, H / 2, 5, 0, Math.PI * 2); c.fill();
    c.font = 'italic 13px Georgia, serif';
    c.fillText(dr.speedKn === null ? 'DR: no speed logged yet (throw the log, L)' : `DR ${fmtLatPrecise(cy)} ${fmtLonPrecise(cx)} · log ${dr.speedKn.toFixed(1)} kn`, W / 2 + 10, H / 2 - 8);
  }
}

const fmtLatPrecise = (d: number) => `${Math.abs(d).toFixed(1)}°${d >= 0 ? 'N' : 'S'}`;
const fmtLonPrecise = (d: number) => `${Math.abs(d).toFixed(1)}°${d >= 0 ? 'E' : 'W'}`;
