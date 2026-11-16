// Chart rendering: parchment, ink graticule, latitude lines, DR track, marks, compass rose,
// and the ruler while it's being dragged. Pure drawing on a 2D context, no state.
import type { DrState } from '../nav/dr';
import { mulberry32 } from '../util/rng';

const INK = '#3a2414', INK_SOFT = 'rgba(70, 45, 22, 0.32)', RUST = '#a3261b', BLUE = '#1d3f7a';

export const fmtLat = (d: number, p = 0) => `${Math.abs(d).toFixed(p)}°${d >= 0 ? 'N' : 'S'}`;
export const fmtLon = (d: number, p = 0) => `${Math.abs(d).toFixed(p)}°${d >= 0 ? 'E' : 'W'}`;

let paper: HTMLCanvasElement | null = null;
/** Parchment texture: blotches + fibres, built once (seeded, so identical every time). */
function paperTexture(): HTMLCanvasElement {
  if (paper) return paper;
  paper = document.createElement('canvas');
  paper.width = paper.height = 512;
  const c = paper.getContext('2d')!, rnd = mulberry32(42);
  c.fillStyle = '#efdcb2'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 70;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rnd() < 0.5 ? '150,100,50' : '255,248,225'},${0.05 + rnd() * 0.07})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(110,70,30,${rnd() * 0.07})`; c.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1); }
  return paper;
}

function compassRose(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.save(); c.translate(x, y); c.globalAlpha = 0.75;
  c.strokeStyle = INK; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.82, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0, len = long ? r : r * 0.6, w = long ? r * 0.16 : r * 0.1;
    c.save(); c.rotate((i * Math.PI) / 4);
    c.fillStyle = i === 0 ? RUST : INK;
    c.beginPath(); c.moveTo(0, -len); c.lineTo(w, 0); c.lineTo(0, 0); c.fill();
    c.fillStyle = '#f6e8c6';
    c.beginPath(); c.moveTo(0, -len); c.lineTo(-w, 0); c.lineTo(0, 0); c.fill(); c.stroke();
    c.restore();
  }
  c.fillStyle = RUST; c.font = 'bold 16px Georgia, serif'; c.textAlign = 'center';
  c.fillText('N', 0, -r - 6);
  c.restore();
}

export interface ChartIsland { name: string; latDeg: number; lonDeg: number }
export interface ChartView { W: number; H: number; spanDeg: number; ruleLat: number | null; known: ChartIsland[]; orders: string | null }

export function drawChart(c: CanvasRenderingContext2D, dr: DrState, v: ChartView): void {
  const { W, H, spanDeg } = v;
  const ppd = H / spanDeg; // pixels per degree (flat chart, DESIGN §6)
  const cx = dr.pos.lonDeg, cy = dr.pos.latDeg;
  const X = (lon: number) => W / 2 + (lon - cx) * ppd, Y = (lat: number) => H / 2 - (lat - cy) * ppd;

  c.drawImage(paperTexture(), 0, 0, W, H); // stretched, not tiled: tiling shows seams
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(110,65,25,0.35)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);

  // Graticule.
  const step = spanDeg > 20 ? 5 : 1;
  c.font = 'italic 13px Georgia, serif'; c.textAlign = 'left';
  for (let lat = Math.ceil((cy - spanDeg) / step) * step; lat <= cy + spanDeg; lat += step) {
    const eq = lat === 0;
    c.strokeStyle = eq ? RUST : INK_SOFT; c.lineWidth = eq ? 2 : 1;
    c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(W, Y(lat)); c.stroke();
    c.fillStyle = eq ? RUST : 'rgba(58,36,20,0.7)';
    if (Y(lat) < H - 40) c.fillText(eq ? 'The Line (Equator)' : fmtLat(lat), W - 120, Y(lat) - 4);
  }
  const halfW = W / 2 / ppd;
  c.fillStyle = 'rgba(58,36,20,0.7)';
  for (let lon = Math.ceil((cx - halfW) / step) * step; lon <= cx + halfW; lon += step) {
    c.strokeStyle = INK_SOFT; c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(lon), 0); c.lineTo(X(lon), H); c.stroke();
    c.fillText(fmtLon(lon), X(lon) + 4, 18);
  }

  // Latitude lines the player ruled.
  c.setLineDash([10, 6]); c.strokeStyle = RUST; c.lineWidth = 1.6; c.fillStyle = RUST; c.font = 'italic 14px Georgia, serif';
  for (const lat of dr.latLines) {
    c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(W, Y(lat)); c.stroke();
    c.fillText(`sight ${fmtLat(lat, 1)}`, 80, Y(lat) - 5);
  }
  c.setLineDash([]);

  // DR track, marks, current DR.
  c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath();
  dr.track.forEach((p, i) => (i ? c.lineTo(X(p.lonDeg), Y(p.latDeg)) : c.moveTo(X(p.lonDeg), Y(p.latDeg))));
  c.lineTo(X(cx), Y(cy)); c.stroke();
  c.strokeStyle = BLUE; c.lineWidth = 2;
  for (const m of dr.marks) {
    const x = X(m.lonDeg), y = Y(m.latDeg);
    c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y + 6); c.moveTo(x + 6, y - 6); c.lineTo(x - 6, y + 6); c.stroke();
  }
  c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = 1.5;
  c.beginPath(); c.arc(W / 2, H / 2, 4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(W / 2, H / 2, 9, 0, Math.PI * 2); c.stroke();
  c.font = 'italic 15px Georgia, serif'; c.textAlign = 'left';
  c.fillText(dr.speedKn === null ? 'Reckoned position (no speed logged: throw the log)' : `Reckoned ${fmtLat(cy, 1)} ${fmtLon(cx, 1)} · ${dr.speedKn.toFixed(1)} kn`, W / 2 + 14, H / 2 - 10);

  // Islands you've seen up close, inked in by hand.
  c.font = 'italic 14px Georgia, serif'; c.textAlign = 'left';
  for (const k of v.known) {
    const x = X(k.lonDeg), y = Y(k.latDeg);
    c.fillStyle = 'rgba(150, 120, 60, 0.55)'; c.strokeStyle = INK; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, y, 7, 5, 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = INK; c.fillText(k.name, x + 10, y + 4);
  }
  if (v.orders) {
    c.font = 'italic 15px Georgia, serif'; c.textAlign = 'center';
    const tw = c.measureText(v.orders).width + 28;
    c.fillStyle = 'rgba(251, 240, 214, 0.9)'; c.strokeStyle = RUST; c.lineWidth = 1;
    c.fillRect(W / 2 - tw / 2, 30, tw, 28); c.strokeRect(W / 2 - tw / 2 + 0.5, 30.5, tw - 1, 27);
    c.fillStyle = INK; c.fillText(`Orders: ${v.orders}`, W / 2, 49);
    c.textAlign = 'left';
  }

  compassRose(c, 90, H - 100, 52); // bottom-left: clear of the latitude labels on the right

  if (v.ruleLat !== null) drawRuler(c, W, Y(v.ruleLat), v.ruleLat);
}

/** A brass-edged wooden ruler lying across the chart, its edge on the latitude. */
function drawRuler(c: CanvasRenderingContext2D, W: number, y: number, lat: number): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
  c.fillStyle = 'rgba(176, 110, 60, 0.92)'; c.fillRect(0, y, W, 30);
  c.shadowColor = 'transparent';
  c.fillStyle = '#e0a640'; c.fillRect(0, y, W, 3);
  c.strokeStyle = 'rgba(40,20,5,0.7)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += 12) { c.beginPath(); c.moveTo(x, y + 3); c.lineTo(x, y + (x % 60 === 0 ? 14 : 8)); c.stroke(); }
  c.strokeStyle = RUST; c.setLineDash([10, 6]); c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#fbf0d6'; c.strokeStyle = RUST; c.font = 'bold 16px Georgia, serif'; c.textAlign = 'center';
  const label = fmtLat(lat, 1), lw = c.measureText(label).width + 16;
  c.fillRect(W / 2 - lw / 2, y - 30, lw, 24); c.strokeRect(W / 2 - lw / 2, y - 30, lw, 24);
  c.fillStyle = RUST; c.fillText(label, W / 2, y - 12);
  c.restore();
}
