// Compass card shown at the helm (the binnacle, as a strip). Shows the COMPASS reading,
// deviation included, never the true heading.

const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

export class CompassTape {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;

  constructor() {
    this.canvas.width = 420; this.canvas.height = 54;
    Object.assign(this.canvas.style, {
      position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
      borderRadius: '6px', display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);
  }

  set visible(v: boolean) { this.canvas.style.display = v ? 'block' : 'none'; }

  draw(readingDeg: number): void {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, pxPerDeg = 3.2;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(30, 22, 12, 0.72)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#f3e6c8'; c.fillStyle = '#f3e6c8'; c.textAlign = 'center';
    const first = Math.floor((readingDeg - W / 2 / pxPerDeg) / 5) * 5;
    for (let d = first; d <= readingDeg + W / 2 / pxPerDeg; d += 5) {
      const x = W / 2 + (d - readingDeg) * pxPerDeg, n = ((d % 360) + 360) % 360;
      const major = n % 45 === 0;
      c.lineWidth = major ? 2 : 1;
      c.beginPath(); c.moveTo(x, H - 4); c.lineTo(x, H - (major ? 20 : n % 10 === 0 ? 13 : 8)); c.stroke();
      if (major) { c.font = 'bold 15px Georgia, serif'; c.fillText(LABELS[n], x, 18); }
      else if (n % 30 === 0) { c.font = '11px Georgia, serif'; c.fillText(String(n), x, 16); }
    }
    c.fillStyle = '#ff6a4d';
    c.beginPath(); c.moveTo(W / 2 - 7, 0); c.lineTo(W / 2 + 7, 0); c.lineTo(W / 2, 10); c.fill();
    c.fillStyle = '#fff'; c.font = '12px ui-monospace, monospace';
    c.fillText(`${Math.round(readingDeg).toString().padStart(3, '0')}°`, W / 2, H - 24);
  }
}
