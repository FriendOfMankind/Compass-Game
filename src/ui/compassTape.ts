// Compass card shown at the helm (the binnacle, as a strip; the 3D binnacle shows the same reading).
// Parchment + brass, styled like the rest of the UI. Shows the COMPASS reading,
// deviation included, never the true heading.

const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

export class CompassTape {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;

  constructor() {
    this.canvas.width = 420; this.canvas.height = 54;
    Object.assign(this.canvas.style, {
      position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
      borderRadius: '4px', display: 'none', boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);
  }

  set visible(v: boolean) { this.canvas.style.display = v ? 'block' : 'none'; }

  draw(readingDeg: number): void {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, pxPerDeg = 3.2;
    c.clearRect(0, 0, W, H);
    // Parchment card in a brass frame.
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f6e6c2'); g.addColorStop(1, '#e2c58f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const fade = c.createLinearGradient(0, 0, W, 0); // edges darken like a curved card
    fade.addColorStop(0, 'rgba(90,55,25,0.45)'); fade.addColorStop(0.18, 'rgba(90,55,25,0)');
    fade.addColorStop(0.82, 'rgba(90,55,25,0)'); fade.addColorStop(1, 'rgba(90,55,25,0.45)');
    c.fillStyle = fade; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#b07a26'; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4);
    c.strokeStyle = '#f0c766'; c.lineWidth = 1; c.strokeRect(4.5, 4.5, W - 9, H - 9);

    c.strokeStyle = '#3a2414'; c.fillStyle = '#3a2414'; c.textAlign = 'center';
    const first = Math.floor((readingDeg - W / 2 / pxPerDeg) / 5) * 5;
    for (let d = first; d <= readingDeg + W / 2 / pxPerDeg; d += 5) {
      const x = W / 2 + (d - readingDeg) * pxPerDeg, n = ((d % 360) + 360) % 360;
      const major = n % 45 === 0;
      c.lineWidth = major ? 2 : 1;
      c.beginPath(); c.moveTo(x, H - 7); c.lineTo(x, H - (major ? 22 : n % 10 === 0 ? 15 : 11)); c.stroke();
      const clear = Math.abs(x - W / 2) > 28; // the reading cartouche sits in the middle
      if (major && clear) { c.font = 'bold 16px Georgia, serif'; c.fillStyle = n === 0 ? '#a3261b' : '#3a2414'; c.fillText(LABELS[n], x, 22); c.fillStyle = '#3a2414'; }
      else if (n % 30 === 0 && clear) { c.font = '11px Georgia, serif'; c.fillText(String(n), x, 20); }
    }
    // Lubber line: the boat's heading.
    c.fillStyle = '#a3261b';
    c.beginPath(); c.moveTo(W / 2 - 7, 4); c.lineTo(W / 2 + 7, 4); c.lineTo(W / 2, 13); c.fill();
    c.fillRect(W / 2 - 1, 30, 2, H - 37);
    // Reading cartouche under the lubber mark.
    c.fillStyle = '#fbf0d6'; c.strokeStyle = '#a3261b'; c.lineWidth = 1;
    c.fillRect(W / 2 - 22, 13, 44, 17); c.strokeRect(W / 2 - 21.5, 13.5, 43, 16);
    c.fillStyle = '#3a2414'; c.font = 'bold 13px Georgia, serif';
    c.fillText(`${Math.round(((readingDeg % 360) + 360) % 360).toString().padStart(3, '0')}°`, W / 2, 26);
  }
}
