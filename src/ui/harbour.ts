// Between rounds: what the trip paid, what you can buy, "Set sail" for the next orders.
// Frees the mouse while open (like the chart).
import { PRICES, canBuy, owns, type Item, type Progress, type Reward } from '../sim/progression';

const ITEMS: { id: Item; name: string; blurb: string }[] = [
  { id: 'quadrant', name: 'Quadrant', blurb: 'Reads a star\'s height to half a degree. Wobbles with the waves. Key 3.' },
  { id: 'chronometer', name: 'Chronometer', blurb: 'Keeps home time at sea. Time a star crossing the meridian and you have your longitude. Key 4.' },
];

export class Harbour {
  private readonly root = document.createElement('div');

  constructor() {
    this.root.className = 'parch';
    this.root.id = 'harbour';
    this.root.style.display = 'none';
    document.body.appendChild(this.root);
  }

  get isOpen(): boolean { return this.root.style.display !== 'none'; }

  open(title: string, reward: Reward, p: Progress, onBuy: (i: Item) => Progress, onSail: () => void): void {
    if (document.pointerLockElement) document.exitPointerLock();
    let progress = p;
    const render = () => {
      this.root.innerHTML = '';
      const h = document.createElement('div'); h.className = 'parch-label'; h.style.fontSize = '22px'; h.textContent = title;
      const pay = document.createElement('div');
      pay.className = 'pay';
      const line = (k: string, v: number) => `<div><span>${k}</span><span>${v >= 0 ? '+' : ''}${v}</span></div>`;
      pay.innerHTML = line('Delivery', reward.base) + line('Distance', reward.distance) + (reward.scrapes ? line('Hull repairs', reward.scrapes) : '')
        + `<div class="total"><span>Purse</span><span>${progress.gold} gold</span></div>`;
      const shop = document.createElement('div');
      shop.className = 'shop';
      for (const it of ITEMS) {
        const row = document.createElement('div');
        const have = owns(progress, it.id);
        row.innerHTML = `<div><b>${it.name}</b> · ${have ? 'owned' : `${PRICES[it.id]} gold`}<br><i>${it.blurb}</i></div>`;
        const b = document.createElement('button');
        b.textContent = have ? '✓' : 'Buy';
        b.disabled = !canBuy(progress, it.id);
        b.onclick = () => { progress = onBuy(it.id); render(); };
        row.appendChild(b);
        shop.appendChild(row);
      }
      const sail = document.createElement('button');
      sail.className = 'sail'; sail.textContent = 'Set sail: next orders';
      sail.onclick = () => { this.root.style.display = 'none'; onSail(); };
      this.root.append(h, pay, shop, sail);
    };
    render();
    this.root.style.display = 'block';
  }
}
