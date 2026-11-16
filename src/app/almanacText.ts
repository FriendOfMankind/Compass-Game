// The chart's almanac box: tonight's home-meridian passages in home time (what the chronometer shows).
import { almanac } from '../astro/almanac';

/** jdStart: JD at game clock 0. Lists passages from 2 game hours ago onward (one you just watched still counts). */
export function almanacLines(jdStart: number, gameSeconds: number): string[] {
  const jdNow = jdStart + gameSeconds / 86400;
  return almanac(jdNow - 2 / 24).map((e) => {
    const h = ((((e.homeJd - jdStart) * 24) % 24) + 24) % 24;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${e.name.padEnd(11, ' ')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  });
}
