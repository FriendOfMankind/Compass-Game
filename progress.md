# progress.md

## Current milestone
M2: The real sky (next). M1 passed Colin's playtest.

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
  - Controls: click = capture mouse, WASD walk, E use/leave station. Helm: A/D steer. Mast: W sheet in, S ease.
  - New URL params: `wind=<from deg>` (default 60, NE trades), `at=deck|helm|mast`, `speed=<m/s>`; debug views `look=<deg rel. bow>`, `cam=chase`.
  - Screenshots: `shots/m1-chase.png`, `m1-helm.png`, `m1-mast-dusk.png` (local only, gitignored).

## Decisions
- Real star data (HYG v4.x, mag ≤ 5.0), J2000, no precession/refraction.
- HYG license confirmed CC BY-SA 4.0 (astronexus.com/projects/hyg). Attribute in credits; share-alike likely covers the derived `stars.json`. GitHub mirror is frozen; canonical source is codeberg.org/astronexus/hyg (blocked from the cloud container — download from astronexus.com or have Colin drop the CSV in).
- World: 25°S–25°N, ~40° longitude (lon −20…+20 relative to patch), flat equirectangular mapping.
- World axes: +Y up, −Z = north, +X = east. Heading 0° = north, clockwise.
- **Visibility must be tighter than instrument precision.** Island visibility radius (haze/fog + low silhouettes) is a first-class tunable, target ~0.5–1° (300–600 m). Otherwise players navigate by eyeball and the instruments are pointless.
- **Long passages are skipped by time warp, not by bigger speed numbers** (Colin: "I don't want shit to take forever"). Planned: a smooth "make way" warp that ramps up while holding a steady course in open water and drops out on input, near land/reefs, or on events. Stars wheel faster under warp, which is honest. Build in M1 (feel) / M3 (DR log must integrate warped time correctly).
- **Core loop (Colin): round-based WITH progression.** Each round: random start position + random hour, a target to reach; arrive = win, new round from a new spot. Progression (gold, instrument upgrades, chronometer) persists across rounds — DESIGN §5/M6 still apply; rounds replace the contract board.
- **Date is constrained** to a window where the taught pole-finders (Dipper and/or Crux) are usable at night across the world patch. Pick the exact window in M2 with tests (expected ~March–May). Not selling the game, so CC BY-SA is a non-issue beyond attribution.
- **Scale tension (decide in M3):** time compression 72× ≪ distance compression ~185×. Fun visual speed (~12 m/s ≈ 1°/50 s) = 1°/game-hour = 60 "knots" in honest DR units. Options: accept silly knot numbers, slow the boat and lean on warp, or define a game knot. M1 shows m/s only.

## Open questions (Colin)
- How is the round target described? Exact lat (latitude sailing) + vague bearing, per DESIGN §7?
- Daytime spawns: wait for night (anchor fast-forward) until the noon-sun sight exists?

## Known bugs / rough edges
- Headless screenshot FPS is 17–27 (SwiftShader software GL). Not representative; check real FPS in the debug HUD.
- Wheel fills the bottom of the helm view; boom sits just above head height at the mast. Tune after playtest.
- No collision with mast/wheel when walking (you can walk through them).
- Thin pale sliver can show under the stern from low outside angles (water mask vs hull taper). Only visible in `cam=chase`.
- Sail trim only at the mast (per DESIGN). Walking helm→mast→helm to fix trim may be annoying. Watch for it.
- Sky/sun are M0 placeholders (crude sun direction, no stars). M2.

## Playtest notes (Colin)
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
