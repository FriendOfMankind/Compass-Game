// Chart table (DESIGN §8): a paper chart of what you BELIEVE. Shows the DR track, your
// marks and latitude lines you rule. Never shows the true position (no GPS, DESIGN §7).
// Drag across the chart to lay the ruler on a latitude; release to rule the line.
import { rulerLatitude, type DrState } from '../nav/dr';
import { drawChart, type ChartIsland } from './chartDraw';

export interface ChartActions {
  mark(): void;
  addLatLine(latDeg: number): void;
  undoLatLine(): void;
  close(): void;
}

const MIN_SPAN_DEG = 2, MAX_SPAN_DEG = 50;

export class Chart {
  private readonly root = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private spanDeg = 8; // vertical span shown
  private dr: DrState | null = null;
  private actions: ChartActions | null = null;
  private ruleLat: number | null = null; // ruler being dragged
  known: ChartIsland[] = [];
  orders: string | null = null;
  /** Almanac lines (with a chronometer), or null. */
  almanac: string[] | null = null;

  constructor() {
    this.root.id = 'chart';
    const tools = document.createElement('div');
    tools.className = 'tools';
    const tool = (label: string, title: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'chart-tool'; b.innerHTML = label; b.title = title;
      b.onclick = (e) => { e.stopPropagation(); fn(); this.render(); };
      return b;
    };
    tools.append(
      tool('✕ Mark position', 'Mark the reckoned position on the chart', () => this.actions?.mark()),
      tool('↶ Erase last line', 'Rub out the last latitude line', () => this.actions?.undoLatLine()),
      tool('Close <kbd>E</kbd>', 'Back to the deck', () => this.actions?.close()),
    );
    const help = document.createElement('div');
    help.className = 'help';
    help.innerHTML = 'Drag across the chart to lay the ruler on a latitude · release to rule it · scroll to zoom';

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spanDeg = Math.min(MAX_SPAN_DEG, Math.max(MIN_SPAN_DEG, this.spanDeg * (e.deltaY > 0 ? 1.2 : 1 / 1.2)));
      this.render();
    }, { passive: false });
    this.canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.ruleLat = this.latAt(e); this.render(); } });
    this.canvas.addEventListener('mousemove', (e) => { if (this.ruleLat !== null) { this.ruleLat = this.latAt(e); this.render(); } });
    window.addEventListener('mouseup', (e) => {
      if (this.ruleLat === null || e.button !== 0) return;
      const lat = this.ruleLat;
      this.ruleLat = null;
      this.actions?.addLatLine(lat);
      this.render();
    });
    // Right-click cancels a ruler in progress.
    this.canvas.addEventListener('contextmenu', () => { this.ruleLat = null; this.render(); });
    window.addEventListener('resize', () => this.render());

    this.root.append(this.canvas, tools, help);
    document.body.appendChild(this.root);
  }

  get isOpen(): boolean { return this.root.style.display === 'block'; }
  get ruling(): boolean { return this.ruleLat !== null; }

  open(dr: DrState, actions: ChartActions): void {
    this.dr = dr; this.actions = actions;
    this.root.style.display = 'block';
    this.render();
  }

  update(dr: DrState): void { this.dr = dr; if (this.isOpen) this.render(); }
  close(): void { this.ruleLat = null; this.root.style.display = 'none'; }
  cancelRuler(): void { this.ruleLat = null; this.render(); }

  private latAt(e: MouseEvent): number {
    const r = this.canvas.getBoundingClientRect();
    return rulerLatitude(e.clientY - r.top, r.height, this.dr?.pos.latDeg ?? 0, this.spanDeg);
  }

  private render(): void {
    const dr = this.dr; if (!dr || !this.isOpen) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (this.canvas.width !== Math.round(r.width * dpr)) { this.canvas.width = Math.round(r.width * dpr); }
    if (this.canvas.height !== Math.round(r.height * dpr)) { this.canvas.height = Math.round(r.height * dpr); }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart(this.ctx, dr, { W: r.width, H: r.height, spanDeg: this.spanDeg, ruleLat: this.ruleLat, known: this.known, orders: this.orders, almanac: this.almanac });
  }
}
