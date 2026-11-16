// Usage: npm run shot -- "<scenario>" out.png
//   <scenario> may be a query string ("?lat=12&time=night&debug=1")
//   or a full URL (then no dev server is started).
// Starts a throwaway Vite server, renders the scenario in headless Chromium, saves a PNG.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const [scenarioArg = '?debug=1', outArg = 'shots/shot.png'] = process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(dirname(out), { recursive: true });

let server = null;
let url = scenarioArg;
if (!/^https?:\/\//.test(scenarioArg)) {
  server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const q = scenarioArg.startsWith('?') ? scenarioArg : `?${scenarioArg}`;
  url = `${base}/${q}`;
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.screenshot({ path: out });
  console.log(`saved ${out}  (${url})`);
  if (errors.length) {
    console.error('page errors:\n  ' + errors.join('\n  '));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server?.close();
}
