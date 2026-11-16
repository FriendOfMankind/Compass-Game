// Persistent orders card (top right, same slot/style as the tutorial goal card).
export class OrdersCard {
  private readonly el = document.createElement('div');

  constructor() {
    this.el.id = 'goal-card';
    this.el.className = 'parch';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  set(title: string, text: string | null): void {
    if (!text) { this.el.style.display = 'none'; return; }
    this.el.innerHTML = '';
    const t = document.createElement('div'); t.className = 'parch-label'; t.textContent = title;
    const b = document.createElement('div'); b.textContent = text;
    this.el.append(t, b);
    this.el.style.display = 'block';
  }
}
