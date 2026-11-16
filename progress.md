# progress.md

## Current milestone
M3.5: Look & feel: BUILT, awaiting Colin's verdict ("looks better and clearer?") + an FPS check on his machine (shadows are new).
M3 playtest answers are still outstanding. Next: M4 (world: islands, ports, trade winds + tutorial steps 7, 8, 10). M4 islands use the Kenney kit.

### Session handoff (2026-11-16)
- Last thing fixed: chart table wouldn't open (the E that opened it also closed it in the same frame). Fixed in `src/app/navigation.ts` (`chartCloseArmed`), verified in-browser: E opens, E closes, E reopens, Esc closes.
- Colin's M3 playtest is only partial: he reported the chart bug, nothing else yet. Before starting M4, ask for the M3 playtest answers below (tutorial confusion, parrot laughs, instrument progression, chart usefulness).
- Colin is on Windows PowerShell 5.1: give commands one per block, no `&&`. He runs `git pull` then `npm run dev`.
- Git: commits authored as Claude <noreply@anthropic.com> (history was rewritten once with Colin's approval). Remote: github.com/FriendOfMankind/Compass-Game, branch `main`.
- Kenney Pirate Kit (CC0) lives in `public/models/kenney-pirate/` (GLB + `Textures/colormap.png`, which every model references). Colin downloaded it; the cloud container can't reach kenney.nl.
- Throwaway Playwright drivers used for interaction checks: pattern = start Vite via `createServer`, load `?debug=1`, inspect `window.__game`. Recreate as needed (they lived in the session scratchpad).

## Done
- **M0: Skeleton** — Vite + TS (strict) + Three.js; first-person mouse-look (click for pointer lock); static ocean plane + time-of-day sky gradient; game clock (20 min/day); debug HUD (`?debug=1`); scenario URL parser (`seed/lat/lon/time/heading/step/debug`); vitest (10 tests); `npm run shot` (Playwright, spins up its own Vite server).
  - `time=` accepts `dawn|day|noon|dusk|night|midnight`, `HH:MM`, or a number of hours.
  - Screenshots: `npm run shot -- "?lat=12&time=dusk&heading=90&debug=1" shots/x.png` (shots/ is gitignored).

- **M1: Boat feel**: PASSED playtest ("feels pretty good… intuitive")
  - `sim/waves.ts`: 4 Gerstner waves, single source for shader uniforms + CPU `heightAt`/`hullPose` (tested: CPU inverse matches displaced surface to ±5 mm).
  - `sim/sailing.ts`: no-go zone 38°, polar peaks on a beam reach, dead run 70%; trim model (ease too far → luff, over-sheet → stall).
  - `sim/boat.ts`: speed with inertia, rudder rate-limited and self-centring, steerage scales with speed, heel away from wind.
  - `sim/deck.ts`: walk in boat-local coords, tapered deck bounds shared with the hull mesh; helm + mast stations.
  - `sim/warp.ts`: "making way" warp: 3 s hands-off at the helm while moving → ramps to ×8; any WASD drops it instantly. Clock + boat run warped; waves stay real-time.
  - Render: `render/water.ts` (Gerstner shader, flat-shaded via derivatives, denser grid near camera, amplitude fades with distance), `render/ship.ts` (generated low-poly sloop, boom/sail swing to leeward, sail billows or flaps, wheel turns, masthead pennant streams downwind). Camera rides the hull; head cancels 50% of roll.
  - Controls: click = capture mouse, WASD walk, E use/leave station. Helm: A/D steer, W/S trim (added after playtest). Mast: W sheet in, S ease.
  - New URL params: `wind=<from deg>` (default 60, NE trades), `at=deck|helm|mast`, `speed=<m/s>`; debug views `look=<deg rel. bow>`, `cam=chase`.
  - Screenshots: `shots/m1-chase.png`, `m1-helm.png`, `m1-mast-dusk.png` (local only, gitignored).

- **M2: The real sky (built, awaiting playtest)**
  - `scripts/build-stars.mjs` → `src/data/stars.json` (1,637 stars, mag ≤ 5, 86 KB). Downloads HYG v4.1 from the GitHub mirror (raw.githubusercontent.com works; codeberg + astronexus.com are blocked from the cloud container), or pass a local CSV path.
  - `src/astro/`: `time.ts` (JD, GMST, LST, low-precision sun), `transform.ts` (eq→horizontal, eq→world rotation matrix), `stars.ts` (catalogue, lookups, Crux pole construction, B–V colour). `src/data/constellations.ts`: Dipper, Little Dipper, Cassiopeia, Crux, Pointers, Orion, Scorpius as HIP pairs (resolved from HYG Bayer letters).
  - All DESIGN §4 tests pass, plus: Merak→Dubhe ×5 ≈ Polaris, every constellation HIP exists, date-window test. Crux ×4.5 lands within 3° of the pole with no fudging.
  - Render: `render/celestial.ts` (one per-frame update: sky gradient from real sun altitude, sun disc, star sphere rotated by the tested matrix), `render/stars.ts` (Points shader; size/brightness by magnitude, colour by B–V, horizon extinction). Observer lat/lon = the boat's live position, so sailing north raises Polaris.
  - Keys: C toggles constellation lines + chart markers: Polaris ring/label with dashed guide from the Dipper pointers (Merak→Dubhe ×5.2), and a South Pole ring/label ("no star here") with dashed guide along Crux (Gacrux→Acrux ×4.5). `render/skyMarkers.ts`.
  - Debug HUD: `look` line (compass direction + altitude of screen centre) and a centre crosshair. Params: `date=YYYY-MM-DD`, `pitch=`, `lines=1`. Debug HUD shows LST and sun altitude.
  - Acceptance screenshots: `?lat=20&time=23&heading=180&look=180&pitch=25` (Polaris ~20° up under the Dipper), `?lat=-15&time=23&heading=0&look=180&pitch=30` (Crux + Pointers, Scorpius rising SE).

- **M3: Instruments, navigation, tutorial (built, awaiting playtest)**
  - `src/nav/instruments.ts` (pure, tested): compass with fixed per-seed deviation ±2° + card swing while turning; log line ±10%; quadrant = sight altitude + plumb swing from hull motion, reads in 0.5° steps; kamal verdict; hand count.
  - `src/nav/dr.ts` (pure, tested): DR integrates the COMPASS reading and the LAST LOG reading (not the truth), so error accumulates. Marks, fixes, latitude lines.
  - Instruments (`src/app/navigation.ts`, `src/ui/instrumentOverlay.ts`): hold right-click to raise, 1/2/3 = hand/kamal/quadrant. Overlays are placed by projecting real sky directions, so a fist really is 10° wherever you look and the kamal board really sits on the horizon. Kamal knots 5/10/15/20/25° (scroll to change) until ports exist. No auto-solve: hand/kamal are judged by eye; only the quadrant shows a number.
  - Compass tape at the helm (`src/ui/compassTape.ts`) shows the deviated reading. DESIGN said 3D binnacle; tape is clearer. Revisit if it feels too HUD-ish.
  - Log line: press L anywhere, 4 s sandglass, speed feeds DR. Displayed knots are cosmetic (×0.6 of m/s, ~8 kn cruise); DR runs on internal units.
  - Chart table: new deck station (port side, abaft the mast; `at=chart`). Paper chart centred on DR: DR track, Mark DR position, draw latitude lines by typing (14N / 6S), scroll zoom, E/Esc close. Never shows true position.
  - Parrot: `src/ui/dialogue.ts` (queue, per-key cooldown, no repeat of last variant) + `src/content/parrot.json` (34 keys, all ≤20 words, each teaching line carries a fact). Nags: in irons, long luffing, looking for Polaris south of the equator.
  - Tutorial (`src/tutorial/steps.ts` + `runner.ts`): steps 1–6 and 9 with check functions, hold timers, timed hints (hints also reveal guide lines), multiple-choice latitude quiz in step 6. `?step=N` jumps. Warp is disabled while the tutorial runs. Same north wind in every step (test: no step starts you in irons).
  - Always-on centre reticle (look checks and sights measure from it). Debug: `window.__game` handle with `?debug=1` for Playwright probes.
  - Verified in a real (headless) browser: step 5 → 6 → raise hand → quiz → correct answer → step 9 teleport south.

- **M3.5: Look & feel (built, awaiting Colin's verdict)**: no gameplay changes; before/after shots in `shots/before-*` vs `shots/after-*` (local).
  - Kit test: Kenney ships are toy-proportioned and unusable from their own deck (the sail fills the screen), so we keep our sloop. The kit is for islands, props and distant ships.
  - Lighting (`render/lighting.ts`): sun follows the real sun direction and casts PCF-soft shadows (2048 map, 18 m frustum following the boat); hemisphere fill; Neutral tone mapping; warm lantern on the mast fades in at night.
  - Ship split into `shipHull.ts` (strake-textured hull, planked deck, cap rail), `shipRig.ts` (mast, sail with cloth seams, shrouds/forestay), `shipProps.ts` (8-spoke wheel, **3D brass binnacle whose card shows the compass READING**, chart table, mast lantern, Kenney barrels + crate via `render/models.ts`). Palette sampled from the Kenney colormap (`render/palette.ts`); canvas textures in `render/textures.ts`.
  - UI (`ui/theme.css`): one parchment/ink/brass style for the parrot, tutorial card, quiz, compass tape and chart. Font: IM Fell English SC (Google Fonts) for labels, Georgia body.
  - Control hints are key-cap chips that fade after 3 uses each; station prompts and "Click to look around" stay; H shows all hints again (`ui/prompt.ts`, `app/controls.ts`). Status line (sail warnings, log, warp) above them.
  - Chart: parchment, compass rose, tool buttons. **Latitude lines are ruled by dragging a ruler** (live 0.1° label, release to rule, right-click/Esc cancels), "Erase last line" undoes. Typed input removed. Pure `rulerLatitude()` + `undoLatLine()` in `nav/dr.ts`, tested.

## Decisions
- Real star data (HYG v4.x, mag ≤ 5.0), J2000, no precession/refraction.
- HYG license confirmed CC BY-SA 4.0 (astronexus.com/projects/hyg). Attribute in credits; share-alike likely covers the derived `stars.json`. GitHub mirror is frozen; canonical source is codeberg.org/astronexus/hyg (blocked from the cloud container — download from astronexus.com or have Colin drop the CSV in).
- World: 25°S–25°N, ~40° longitude (lon −20…+20 relative to patch), flat equirectangular mapping.
- World axes: +Y up, −Z = north, +X = east. Heading 0° = north, clockwise.
- **Visibility must be tighter than instrument precision.** Island visibility radius (haze/fog + low silhouettes) is a first-class tunable, target ~0.5–1° (300–600 m). Otherwise players navigate by eyeball and the instruments are pointless.
- **Long passages are skipped by time warp, not by bigger speed numbers** (Colin: "I don't want shit to take forever"). Planned: a smooth "make way" warp that ramps up while holding a steady course in open water and drops out on input, near land/reefs, or on events. Stars wheel faster under warp, which is honest. Build in M1 (feel) / M3 (DR log must integrate warped time correctly).
- **Core loop (Colin): round-based WITH progression.** Each round: random start position + random hour, a target to reach; arrive = win, new round from a new spot. Progression (gold, instrument upgrades, chronometer) persists across rounds — DESIGN §5/M6 still apply; rounds replace the contract board.
- **Date is constrained** to mid-April (default 2026-04-15, tested ±15 days): at every latitude −25…+25 a taught pole-finder (Dipper pointers north of the equator, Crux at ≤10°N) is >8° up during darkness. Rounds should pick dates inside Apr 1–30.
- **Clock = home time**: the game clock is UT at the patch's 0° meridian (lon 0 ≡ Greenwich). Local solar time and LST shift with longitude, which is exactly what the chronometer (M6) needs.
- Night = sun below −12° (nautical twilight); stars fade in between −2° and −10°. ~8–9 real minutes of star time per 20-minute day in April tropics. Not selling the game, so CC BY-SA is a non-issue beyond attribution.
- **Scale tension: DECIDED in M3**: knots are cosmetic (×0.6 m/s); the chart does DR maths internally, so players never multiply silly numbers. Was: time compression 72× ≪ distance compression ~185×. Fun visual speed (~12 m/s ≈ 1°/50 s) = 1°/game-hour = 60 "knots" in honest DR units. Options: accept silly knot numbers, slow the boat and lean on warp, or define a game knot. M1 shows m/s only.

## Open questions (Colin)
- How is the round target described? Exact lat (latitude sailing) + vague bearing, per DESIGN §7?
- Daytime spawns: wait for night (anchor fast-forward) until the noon-sun sight exists?

## Known bugs / rough edges
- M3.5: shadows cost GPU; unverified on real hardware (headless runs SwiftShader). If FPS drops, halve the shadow map (`render/lighting.ts`).
- M3.5: the IM Fell font loads from Google Fonts; offline it falls back to Georgia (fine).
- M3.5: the binnacle card is unlit (always readable at night). Real binnacles had a lamp, so it's defensible, but it is a bright spot while star-gazing.
- M3.5: the helm view shows up to 8 hint chips until they've faded. Watch whether that feels cluttered.
- Looking abeam on a heeled boat shifts your view ~5–7° (measured: camera pitch 12° → 17.6° actual). Correct physics, but it makes "look at the star" fiddly; the reticle + 4° tolerance cover it. Watch in playtest.
- Tutorial step 9 teleports you from 12°N to 12°S between steps (story jump, "crossing the line"). Real crossing comes with M4's world.
- FIXED: chart table opened and instantly closed on the same E press.
- Headless screenshots run ~17–20 fps, so parrot lines may already have expired in automated shots. Not a game bug.
- Headless screenshot FPS is 17–27 (SwiftShader software GL). Not representative; check real FPS in the debug HUD.
- Wheel fills the bottom of the helm view; boom sits just above head height at the mast. Tune after playtest.
- No collision with mast/wheel when walking (you can walk through them).
- Thin pale sliver can show under the stern from low outside angles (water mask vs hull taper). Only visible in `cam=chase`.
- Sail trim works from the helm too (Colin, after M1 playtest). Deviates from DESIGN §8 (mast-only); mast station kept.
- Ship is nearly black at night (no lantern/moon). Fine for star-gazing; might want a deck lantern later.
- No Milky Way (DESIGN: only if cheap). Skipped for now.

## Playtest notes (Colin)
### M3.5: please answer these
`git pull`, `npm run dev`, then: `/?at=helm&time=10&heading=90&lat=12&debug=1` (day), `/?at=helm&lat=15&time=21&debug=1` (night), walk to the chart table and drag a latitude line, `/?step=1`.
1. Better-looking? Anything that looks worse than before?
2. FPS in the debug HUD (top-left): what number, day vs night?
3. Are the fading hint chips clear, or cluttered?
4. Ruler on the chart: intuitive without being told?

### M3: please answer these
Try the tutorial from the top: `/?step=1`. Then free-sail at night: `/?at=helm&lat=15&time=21&debug=1`, measure Polaris with all three instruments (1/2/3, hold right-click), throw the log (L), open the chart table (walk to the table on the left, E).
1. Did any tutorial step confuse you or get stuck? Which?
2. Did the parrot make you laugh at least once? Which line fell flat?
3. Hand vs kamal vs quadrant: does the progression feel like better tools for the same skill?
4. Is the chart table useful or just there?

### M2
- Colin: can find the Dipper and Polaris without the lines. Asked for Polaris/south-pole highlights (done) and tutorial folded into M3 (done).

### M2: original questions
Try: `/?debug=1&at=helm&lat=20&time=21` → press C, look north. Then `&lat=-15` and look south. Sail north for a while at night under warp and watch Polaris climb.
1. Can you find the Big Dipper WITHOUT the lines (C off)? Polaris?
2. Are stars too bright/dim/big? (Varies a lot by monitor; headless screenshots aren't representative.)
3. Is dusk → night pacing right? (~8–9 min of real star time per 20-min day)
4. Anything look wrong vs. a real sky you've seen?

### M1
- Colin: "feels pretty good… overall intuitive. Once I need to go a certain direction, maybe upwind, things will get interesting."
- Reported: water clipping through the boat → FIXED (water masked inside hull footprint, +0.15 m freeboard). Bow didn't close + floating bowsprit → FIXED.
- Found while fixing: head-roll compensation doubled the tilt when looking aft → FIXED (compensation now in boat axes via a head rig).
- Still unanswered (watch in M2 playtest): Q3 trim-at-mast chore? Q4 nausea?

Original questions:
Try: `npm run dev` → open `/?debug=1&at=helm`. Also try `?time=dusk`, `?wind=0`.
1. Is steering responsive or sluggish? (turn rate 16°/s max)
2. Is speed/acceleration satisfying? (max 13 m/s on a beam reach, ~4 s to build)
3. Is trimming at the mast fun or a chore? Should trim also work from the helm?
4. Heel + roll: immersive or nauseating? (horizon tilts up to ~7° when heeled)
5. Does the warp kick in at the right time, and does it feel smooth?
6. Can you tell where the wind is coming from (pennant, sail)?

## Ideas / later
- Star compass / rising points, zenith stars, noon sun sight
- Compass deviation, storms, rations
