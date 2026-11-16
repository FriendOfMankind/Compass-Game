// Build src/data/stars.json from the HYG catalogue (CC BY-SA 4.0, astronexus — attribute in credits).
// Usage: npm run build-stars [-- path/to/hygdata_v41.csv]
// Without a path, downloads v4.1 from the (frozen but still served) GitHub mirror.
// Canonical source: https://codeberg.org/astronexus/hyg
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const MAG_LIMIT = 5.0;

/** Minimal CSV line parser (handles quoted fields, no embedded newlines in HYG). */
function parseLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const path = process.argv[2];
const text = path ? readFileSync(path, 'utf8') : await (await fetch(SOURCE_URL)).text();
const lines = text.split(/\r?\n/).filter(Boolean);
const head = parseLine(lines[0]);
const col = (n) => { const i = head.indexOf(n); if (i < 0) throw new Error(`missing column ${n}`); return i; };
const C = { id: col('id'), hip: col('hip'), proper: col('proper'), ra: col('ra'), dec: col('dec'), mag: col('mag'), ci: col('ci'), con: col('con'), bayer: col('bayer') };

const stars = [];
for (let i = 1; i < lines.length; i++) {
  const f = parseLine(lines[i]);
  const mag = Number(f[C.mag]);
  if (f[C.id] === '0' || !(mag <= MAG_LIMIT)) continue; // id 0 = the Sun
  const ci = f[C.ci] === '' ? 0.6 : Number(f[C.ci]);
  stars.push([
    +(Number(f[C.ra]) * 15).toFixed(4),  // RA hours → degrees
    +Number(f[C.dec]).toFixed(4),
    +mag.toFixed(2),
    +ci.toFixed(2),
    f[C.hip] === '' ? null : Number(f[C.hip]),
    f[C.con] || null,
    f[C.proper] || null,
    f[C.bayer] || null,
  ]);
}
stars.sort((a, b) => a[2] - b[2]); // brightest first

const json = {
  source: 'HYG v4.1 (astronexus.com), CC BY-SA 4.0. J2000 positions; mag <= 5.0.',
  fields: ['raDeg', 'decDeg', 'mag', 'bv', 'hip', 'con', 'name', 'bayer'],
  stars,
};
writeFileSync(new URL('../src/data/stars.json', import.meta.url), JSON.stringify(json));
console.log(`wrote ${stars.length} stars`);
