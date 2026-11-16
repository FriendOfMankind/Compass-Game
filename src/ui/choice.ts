// Multiple-choice prompt (tutorial questions). Frees the mouse while open.
export class Choice {
  private readonly root = document.createElement('div');

  constructor() {
    Object.assign(this.root.style, {
      position: 'fixed', left: '50%', top: '30%', transform: 'translateX(-50%)', display: 'none',
      background: 'rgba(250, 240, 215, 0.97)', color: '#2a1d10', padding: '16px 20px', borderRadius: '10px',
      font: '17px Georgia, serif', boxShadow: '0 6px 24px rgba(0,0,0,0.6)', textAlign: 'center',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.root);
  }

  get isOpen(): boolean { return this.root.style.display !== 'none'; }

  ask(question: string, options: string[], onPick: (index: number) => void): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.innerHTML = '';
    const q = document.createElement('div'); q.textContent = question; q.style.marginBottom = '12px';
    this.root.appendChild(q);
    options.forEach((label, i) => {
      const b = document.createElement('button'); b.textContent = label;
      Object.assign(b.style, { font: 'inherit', margin: '4px', padding: '6px 14px', background: '#f6ecd2', border: '1px solid #5a3a1c', borderRadius: '6px', cursor: 'pointer' });
      b.onclick = () => { this.root.style.display = 'none'; onPick(i); };
      this.root.appendChild(b);
    });
    this.root.style.display = 'block';
  }
}
