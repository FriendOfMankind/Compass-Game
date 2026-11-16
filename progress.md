# progress.md

## Current milestone
M1: Boat feel (M0 done, awaiting Colin's playtest)

## Done
- **M0: Skeleton** — Vite + TS (strict) + Three.js; first-person mouse-look (click for pointer lock); static ocean plane + time-of-day sky gradient; game clock (20 min/day); debug HUD (`?debug=1`); scenario URL parser (`seed/lat/lon/time/heading/step/debug`); vitest (10 tests); `npm run shot` (Playwright, spins up its own Vite server).
  - `time=` accepts `dawn|day|noon|dusk|night|midnight`, `HH:MM`, or a number of hours.
  - Screenshots: `npm run shot -- "?lat=12&time=dusk&heading=90&debug=1" shots/x.png` (shots/ is gitignored).

## Decisions
- Real star data (HYG v4.x, mag ≤ 5.0), J2000, no precession/refraction.
- HYG license confirmed CC BY-SA 4.0 (astronexus.com/projects/hyg). Attribute in credits; share-alike likely covers the derived `stars.json`. GitHub mirror is frozen; canonical source is codeberg.org/astronexus/hyg (blocked from the cloud container — download from astronexus.com or have Colin drop the CSV in).
- World: 25°S–25°N, ~40° longitude (lon −20…+20 relative to patch), flat equirectangular mapping.
- World axes: +Y up, −Z = north, +X = east. Heading 0° = north, clockwise.
- **Visibility must be tighter than instrument precision.** Island visibility radius (haze/fog + low silhouettes) is a first-class tunable, target ~0.5–1° (300–600 m). Otherwise players navigate by eyeball and the instruments are pointless.
- **Long passages are skipped by time warp, not by bigger speed numbers** (Colin: "I don't want shit to take forever"). Planned: a smooth "make way" warp that ramps up while holding a steady course in open water and drops out on input, near land/reefs, or on events. Stars wheel faster under warp, which is honest. Build in M1 (feel) / M3 (DR log must integrate warped time correctly).
- **Core loop direction (Colin): round-based.** Each round: random start position + random time, a target place to reach; arrive = win, then a new round from a new spot. Supersedes DESIGN §7 contracts loop — see open questions below.

## Open questions (Colin)
- Round loop vs DESIGN ports/contracts/gold/upgrades/chronometer: does progression survive (unlock instruments across rounds?) or is it pure arcade rounds?
- Random *date* vs random *hour*: a random date can put the Dipper or Crux below the horizon all night at some latitudes. Proposal: randomize hour + position freely, constrain date to a window where at least one taught pole-finder is usable (or deliberately not, as a hard-mode modifier). Daytime starts need the noon-sun sight (currently v2) or just "wait for night".
- How is the target described? Exact lat (latitude sailing) + vague bearing, per DESIGN §7.

## Known bugs
- Ocean→sky horizon is a hard line (flat plane, no haze). Fine for M0; M1 water + visibility haze replace it.

## Playtest notes (Colin)
(add after each milestone)

## Ideas / later
- Star compass / rising points, zenith stars, noon sun sight
- Compass deviation, storms, rations
