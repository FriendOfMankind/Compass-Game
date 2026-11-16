// A parchment card at the top of the screen for a few seconds (island arrival, etc.).
export class Toast {
  private readonly el = document.createElement('div');
  private hideAt = 0;

  constructor() {
    this.el.className = 'parch';
    Object.assign(this.el.style, {
      position: 'fixed', top: '84px', left: '50%', transform: 'translateX(-50%)', maxWidth: '460px',
      padding: '10px 18px 12px', textAlign: 'center', display: 'none', pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
  }

  show(title: string, body: string, nowS: number, seconds = 7): void {
    this.el.innerHTML = '';
    const t = document.createElement('div'); t.className = 'parch-label'; t.style.fontSize = '20px'; t.textContent = title;
    const b = document.createElement('div'); b.style.fontStyle = 'italic'; b.textContent = body;
    this.el.append(t, b);
    this.el.style.display = 'block';
    this.hideAt = nowS + seconds;
  }

  update(nowS: number): void { if (this.hideAt && nowS > this.hideAt) { this.el.style.display = 'none'; this.hideAt = 0; } }
}
