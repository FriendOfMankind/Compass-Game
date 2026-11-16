// Bottom-centre context prompt + small status line (sail state, warp). Plain DOM.

export class Prompt {
  private readonly el: HTMLDivElement;
  private last = '';

  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
      font: '15px/1.5 Georgia, "Times New Roman", serif', color: '#fff8e7', textAlign: 'center',
      textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'none', whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
  }

  set(text: string): void {
    if (text === this.last) return;
    this.last = text;
    this.el.textContent = text;
  }
}
