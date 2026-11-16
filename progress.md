# progress.md

## Current milestone
M2: The real sky: BUILT, awaiting Colin's playtest. Next after sign-off: M3 (instruments & navigation).

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
  - Keys: C toggles constellation lines. Params: `date=YYYY-MM-DD`, `pitch=`, `lines=1`. Debug HUD shows LST and sun altitude.
  - Acceptance screenshots: `?lat=20&time=23&heading=180&look=180&pitch=25` (Polaris ~20° up under the Dipper), `?lat=-15&time=23&heading=0&look=180&pitch=30` (Crux + Pointers, Scorpius rising SE).

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
- **Scale tension (decide in M3):** time compression 72× ≪ distance compression ~185×. Fun visual speed (~12 m/s ≈ 1°/50 s) = 1°/game-hour = 60 "knots" in honest DR units. Options: accept silly knot numbers, slow the boat and lean on warp, or define a game knot. M1 shows m/s only.

## Open questions (Colin)
- How is the round target described? Exact lat (latitude sailing) + vague bearing, per DESIGN §7?
- Daytime spawns: wait for night (anchor fast-forward) until the noon-sun sight exists?

## Known bugs / rough edges
- Headless screenshot FPS is 17–27 (SwiftShader software GL). Not representative; check real FPS in the debug HUD.
- Wheel fills the bottom of the helm view; boom sits just above head height at the mast. Tune after playtest.
- No collision with mast/wheel when walking (you can walk through them).
- Thin pale sliver can show under the stern from low outside angles (water mask vs hull taper). Only visible in `cam=chase`.
- Sail trim works from the helm too (Colin, after M1 playtest). Deviates from DESIGN §8 (mast-only); mast station kept.
- Ship is nearly black at night (no lantern/moon). Fine for star-gazing; might want a deck lantern later.
- No Milky Way (DESIGN: only if cheap). Skipped for now.

## Playtest notes (Colin)
### M2: please answer these
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
