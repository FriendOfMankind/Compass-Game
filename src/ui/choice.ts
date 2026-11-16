// Multiple-choice prompt (tutorial questions). Frees the mouse while open.
export class Choice {
  private readonly root = document.createElement('div');

  constructor() {
    this.root.id = 'choice';
    this.root.className = 'parch';
    this.root.style.display = 'none';
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
      b.onclick = () => { this.root.style.display = 'none'; onPick(i); };
      this.root.appendChild(b);
    });
    this.root.style.display = 'block';
  }
}
