// Title screen: shown on a bare URL. Every choice navigates to a scenario URL, so each
// state stays reachable by URL (CLAUDE.md) and a reload resumes where you are.
import type { Progress } from '../sim/progression';

const CREDITS = `
<div class="parch-label">Credits</div>
<p><b>Star data:</b> HYG Database v4.1 by David Nash (astronexus.com), CC BY-SA 4.0. Derived file: <code>stars.json</code>, same licence.</p>
<p><b>3D models:</b> Pirate Kit by Kenney (kenney.nl), CC0.</p>
<p><b>Font:</b> IM Fell English SC by Igino Marini, SIL Open Font License.</p>
<p><b>Engine:</b> three.js (MIT).</p>
<p>Sound is generated live (Web Audio). Press <kbd>M</kbd> to mute.</p>
<p>The parrot's opinions are his own.</p>`;

export function showTitle(save: Progress | null, newSeed: number): void {
  const root = document.createElement('div');
  root.id = 'title';
  document.body.classList.add('title-open'); // hides the HUD underneath (theme.css)
  const go = (q: string) => { location.search = q; };
  const h = document.createElement('h1'); h.textContent = 'Dead Reckoning';
  const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = 'Find your way by the stars. The parrot will not help much.';
  const btn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; return b; };
  root.append(h, sub);
  if (save) root.append(btn(`Continue: round ${save.round}, ${save.gold} gold`, () => go(`?seed=${save.seed}&round=${save.round}&resume=1`)));
  root.append(
    btn('Learn the ropes (tutorial)', () => go('?step=1')),
    btn(save ? 'New voyage (replaces your save)' : 'New voyage', () => go(`?seed=${newSeed}&round=1`)),
  );
  const credits = document.createElement('div'); credits.className = 'parch credits'; credits.innerHTML = CREDITS;
  root.append(btn('Credits', () => { credits.style.display = credits.style.display === 'block' ? 'none' : 'block'; }), credits);
  document.body.appendChild(root);
}
