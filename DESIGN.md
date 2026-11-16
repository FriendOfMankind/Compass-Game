# DESIGN.md — "Dead Reckoning" (working title)

A first-person, tropical-pirate sailing game where you navigate a procedurally generated archipelago using **real** celestial navigation: a compass, the stars, a few crude instruments, and your own bad decisions. A sarcastic parrot teaches you everything.

> Audience for this doc: Claude Code (the builder) and Colin (the designer/playtester).
> Rule zero: **build the smallest version that works, verify it, then move on.** Every milestone has acceptance criteria. Don't start the next milestone until the current one passes them and Colin has playtested it.

---

## 1. Pillars (in priority order)

1. **Sailing feels good.** If steering the boat isn't fun, nothing else matters. Arcade, not simulation.
2. **The navigation is real.** Everything the game teaches should work on an actual night sky. A player who finishes the tutorial should be able to walk outside and find north and estimate their latitude.
3. **It's funny.** Dry, sarcastic, never cringe. The humor lives mostly in the parrot and in the world's flavor text, not in slapstick.
4. **Intuitive.** No manual needed. The tutorial carries the player; after that, the UI stays out of the way.

Not pillars (explicitly out of scope for v1): combat, crew management, multiplayer, ship building, inventory Tetris, realistic sail physics.

---

## 2. Why real star data (and what actually matters)

Yes, use the real sky. It costs almost nothing (one small JSON file + ~150 lines of math) and it's what makes the game *teach* instead of *pretend*. But most of what a real navigator uses boils down to a handful of facts. These are the ones the game is built around:

### 2.1 Finding north: Polaris
- The **altitude of the north celestial pole above the horizon equals your latitude.** Polaris sits within ~0.7° of that pole, so in practice: *height of Polaris ≈ your latitude*. This is the single most important fact in the game.
- Finding Polaris: follow the two "pointer" stars at the end of the Big Dipper's bowl (**Dubhe and Merak**) about 5× their separation. Backup: Cassiopeia's "W" sits opposite the Dipper across Polaris.
- In the tropics Polaris is **low** (at 10°N it's only 10° up, about one fist at arm's length). At the equator it's on the horizon. South of the equator it's **gone**. This is great gameplay, not a problem.

### 2.2 Finding south: there is no good "south star"
- The south celestial pole has no bright star. Sigma Octantis is technically there but is magnitude ~5.4 (barely visible in perfect conditions, useless at sea).
- Real southern navigators use the **Southern Cross (Crux)**: extend the long axis of the cross (from Gacrux through Acrux) about 4.5 cross-lengths to reach the pole. The two **Pointers (Alpha & Beta Centauri)** help confirm you've got the real Crux and not the "False Cross".
- So the game naturally has a **northern-hemisphere skill** (Polaris) and a **southern-hemisphere skill** (Crux), and the world straddles the equator so the player needs both. That's the core skill progression, provided by nature for free.

### 2.3 Latitude sailing (the core loop)
- Historically, sailors couldn't measure longitude at sea until the marine chronometer (~1760s). Their solution was **latitude sailing**: sail north or south until you're at your destination's latitude, then turn and run due east or west along that line until you hit it.
- This is the game's main navigation loop. It's real, it's simple to explain, and it creates natural tension ("is the island east of me, or did I overshoot?").

### 2.4 East–west: dead reckoning
- Longitude comes from **dead reckoning**: heading × speed × time. The player gets a log line (a knotted rope that measures speed, which is where "knots" comes from) and a ship's log that records these automatically when they mark it.
- Errors accumulate on purpose. That's the drama.
- **Late-game upgrade: the chronometer.** Comparing local star time to "home port time" gives longitude directly. Historically accurate, and a satisfying endgame unlock.

### 2.5 Bonus real techniques (v2 flavor, do not build in v1)
- **Star compass / rising points:** a given star always rises at the same compass bearing from a given latitude (a Polynesian wayfinding technique).
- **Zenith stars:** each island latitude has stars that pass directly overhead (Arcturus passes over Hawaii, for example).
- **Noon sun sight:** the sun's altitude at local noon plus a declination table gives latitude in daytime.
- **Hand measurement:** a fist at arm's length ≈ 10°, a finger ≈ 2°. This *is* in v1, as the first instrument (see §5).

### 2.6 Trade winds (real, and they make the world feel alive)
- North of the equator: **NE trade winds**. South of the equator: **SE trade winds**. Near the equator: the **doldrums** (weak, fickle wind).
- This gives the generated world a real logic: upwind voyages are slow, and the doldrums are a place you dread crossing. The parrot has opinions about the doldrums.

---

## 3. Star data

- **Source:** HYG Database (astronexus/HYG-Database on GitHub; it merges Hipparcos, Yale Bright Star and Gliese). **Check the current license when downloading** (it has been CC BY-SA); add attribution to the credits screen either way.
- **Preprocess once** with `scripts/build-stars.ts` → `src/data/stars.json`:
  - Keep stars with apparent magnitude ≤ 5.0 (~1,600 stars). Fields: `ra` (degrees), `dec` (degrees), `mag`, `ci` (B–V color index), `name` (proper name or null), `con` (constellation abbreviation), `hip` (Hipparcos ID).
  - Use J2000 positions. Ignore precession, nutation, proper motion, refraction and dip. Note these simplifications in a code comment; none of them matter at game precision.
- **Constellation lines:** hand-define only the constellations the game teaches, as pairs of HIP IDs in `src/data/constellations.ts`: Ursa Major (the Dipper), Ursa Minor, Cassiopeia, Crux, Centaurus (at least the Pointers), Orion, Scorpius. Lines are shown only in the tutorial or when a "star chart" overlay is toggled.
- **Rendering:** a `THREE.Points` sphere. Point size scales with magnitude, color comes from B–V. Add a faint Milky Way texture only if it's cheap.

---

## 4. Sky math (must be unit-tested)

All of this lives in `src/astro/` as **pure functions with no Three.js imports**, so it can be tested headless.

- **Observer state:** `lat` (deg), `lon` (deg), `gameTime` (sidereal-aware game clock).
- **Local sidereal time:** `LST = GST(gameTime) + lon`. Because longitude feeds directly into LST, the chronometer mechanic falls out of the math for free.
- **Equatorial → horizontal:**
  - `H = LST − RA`
  - `sin(alt) = sin(dec)·sin(lat) + cos(dec)·cos(lat)·cos(H)`
  - `az = atan2(−sin(H)·cos(dec), cos(lat)·sin(dec) − sin(lat)·cos(dec)·cos(H))`, normalized to 0–360° from north.
- **Rendering shortcut:** don't transform 1,600 stars on the CPU every frame. Place stars once in equatorial coordinates on a sphere, then rotate the whole group: tilt by `(90° − lat)` around the east–west axis and spin around the pole axis by `LST`. Use `equatorialToHorizontal()` only for gameplay checks (instrument readings, tutorial triggers) and tests.
- **Required tests (vitest):**
  - Polaris altitude ≈ observer latitude (±1°) for lat = 30, 15, 5, 0.
  - Polaris is below the horizon at lat = −10.
  - The Crux pole-pointing construction lands within ~3° of the south celestial pole.
  - A star with dec = lat passes through the zenith (alt ≈ 90°) at H = 0.
  - The group-rotation renderer and `equatorialToHorizontal()` agree to within 0.1° for 20 random stars at random lat/LST.

---

## 5. Instruments (the progression)

Each instrument is "raised" with right-click, which shows a first-person overlay and gives a reading. The player has to aim it themselves; there is no auto-solve.

| Tier | Instrument | Measures | Precision | How you get it |
|---|---|---|---|---|
| 0 | **Your hand** | altitude (fist = 10°, finger = 2°) | ±3° | Start |
| 0 | **Compass** | heading | ±2° (deviation near iron cargo? v2) | Start |
| 1 | **Kamal** (board on a knotted string) | altitude via knots, one per known port latitude | ±1° | Tutorial reward |
| 1 | **Log line + sandglass** | speed in knots | ±10% | Tutorial reward |
| 2 | **Quadrant** (plumb-bob style) | altitude, readable scale | ±0.5°, wobbles with waves | Bought |
| 3 | **Chronometer** | home-port time → longitude | ±1° | Endgame purchase |

Design note: the hand-to-kamal-to-quadrant progression teaches the *same* skill (measure star altitude → latitude) with better and better precision. That's the satisfying loop: the player gets better tools for a skill they already understand.

---

## 6. World

- **Coordinates:** the world is a lat/lon patch from roughly **25°S to 25°N** and **~40° of longitude**. It uses a flat equirectangular mapping (ignore cos(lat) shrinkage; note this in a comment). It straddles the equator on purpose (see §2.2).
- **Scale compression:** 1° of latitude = **600 world units (meters)**. Cruising speed should cover about 1° per 45–60 s. Real scale would make one degree a 10-hour sail, so compression is mandatory.
- **Time compression:** one game day = **20 real minutes**, nights included (~8 min of usable star time). Add a "drop anchor and wait for nightfall" fast-forward.
- **Generation (seeded, deterministic):**
  - 8–14 islands in 2–4 archipelagos. Each island gets a name (generated, pirate-flavored, punny is fine), a lat/lon, a silhouette type (volcanic peak, flat atoll, twin hills…) and a flavor blurb.
  - **Constraint:** destination islands must have **distinct latitudes** (≥ 1.5° apart) so latitude sailing works.
  - At least 2 islands south of the equator and at least 1 deep in the doldrums band.
  - Reefs around some atolls (a hazard: touch one and you take hull damage plus parrot mockery).
  - Island meshes: low-poly, generated from noise and a radial falloff. Reuse terrain code from Colin's geology sandbox if it exists and is easy to port; otherwise keep it simple.
- **Wind field:** trade-wind model by latitude (NE trades north of ~5°N, SE trades south of ~5°S, weak variable wind in between) plus gentle noise. Wind direction is visible via a pennant at the masthead and on the water.
- **Weather (v1: one feature only):** cloudy nights that hide part of the sky. That's enough to force dead-reckoning use.

---

## 7. Core loop

1. At port, get a **contract or rumor**: "There's a cache on *Isla Regrettable*, 14°N, somewhere east of here. Probably."
2. Leave port, **steer to the destination's latitude** using Polaris or Crux plus an instrument.
3. **Turn east or west** and run the latitude, keeping a dead-reckoning log.
4. **Spot the island silhouette** and match it to the description. Land, collect the reward, buy upgrades.
5. Unlock harder contracts: farther away, across the equator, through the doldrums, under cloudy skies, or with vague clues ("where Arcturus kisses the top of your head").

**No minimap. No GPS. No waypoint markers** outside the tutorial. The paper chart only shows what the player has discovered or drawn.

---

## 8. Player & ship (first person)

- **On deck:** WASD to walk, mouse to look (pointer lock). The ship is small: a sloop with a helm, a mast, a chart table, and a rail to lean on.
- **Interactions (E):**
  - **Helm:** A/D steer, the camera stays first person, and a compass binnacle sits in view.
  - **Mast:** W/S trim the sail. There's one "efficiency" value from the angle between sail and wind; the sail luffs (flaps) when it's wrong. Speed depends on point of sail (no-go zone into the wind, best on a beam reach).
  - **Chart table:** opens the 2D paper chart. Click to mark position; it draws your DR track and lets you draw lines of latitude.
  - **Log line:** throw it to read speed.
- **Right-click:** raise the current instrument.
- **Boat physics:** custom, no physics engine. Heading, speed, and yaw rate, plus a buoyancy bob sampled from the same wave function the water shader uses (CPU copy of the Gerstner waves). Add mild roll/pitch for feel.

---

## 9. The parrot (tutorial + humor)

**Admiral Biscuit**, a parrot who claims to have been a decorated naval navigator before "the incident". He's never explained what the incident was. He's competent, smug, and tired of you.

### Tone guide
- Dry and sarcastic, aimed at the player's choices, never mean-spirited about the player themselves.
- Short lines. Max ~20 words per bark. He gets bored too.
- Every teaching line should carry a real fact. The joke is the delivery vehicle.
- No pop-culture references, no "arr matey" spam (one "arr" per hour, used ironically), no fourth-wall memes.
- Examples:
  - "That's the Big Dipper. Follow the two stars at the end of the bowl. No, the *other* end. Yes. Keep going."
  - "Polaris is ten degrees up. Hold out your fist. One fist. Congratulations, you're at ten north. I knew that already."
  - "Welcome to the doldrums. Wind's on holiday. So's my patience."
  - "You hit a reef. In fairness, it was there first."
  - (Below the equator, looking for Polaris): "It's below the horizon. It's not hiding from you. Well. It is now."

### Implementation
- Lines live in `src/content/parrot.json`, keyed by event (`tutorial.step3.intro`, `reef.hit`, `doldrums.enter`, `idle.long`…) with 2–5 variants each, to avoid repeats.
- Speech is a subtitle bubble plus a squawk sound. No voice acting in v1.
- A cooldown system stops him from talking over himself or spamming.

### Tutorial (fully guided, the only place with waypoint hints)
Each step has a goal, a check function and parrot lines. Steps can be jumped to via URL (see §11).

1. **Walk & look.** Move around the deck, find the helm.
2. **Steering & compass.** Steer to heading 090°, hold it for 10 s.
3. **Sails & wind.** Trim the sail until the luffing stops; reach a target speed.
4. **Night falls.** Find the Big Dipper (the constellation is highlighted on first look).
5. **Find Polaris** via the pointers. The check passes when the player's view centers on Polaris.
6. **Measure with your hand.** Fist-count Polaris → state your latitude (multiple choice, ±2° tolerance).
7. **Latitude sailing.** Get the kamal; sail north to the latitude of the next island (marked by a knot), then turn east.
8. **Dead reckoning.** Throw the log, mark your position, find the island.
9. **Crossing the line** (the equator, sailor tradition; the parrot makes it a "ceremony"). Polaris disappears; learn the Southern Cross + Pointers → find the south celestial pole.
10. **Graduation.** Waypoints off. "You're on your own. Try not to embarrass me."

---

## 10. Tech stack

- **Vite + TypeScript + Three.js.** Runs in the browser, so it's easy to share via a link.
- **vitest** for pure-logic tests (astro, worldgen, wind, DR math).
- **Playwright** for screenshot checks (lets Claude Code *see* what it rendered; see §11).
- No game engine, no physics engine, no UI framework. Plain DOM overlays for HUD, dialogue, and the chart (canvas 2D).
- Audio: Web Audio with a tiny wrapper. Placeholder sounds are fine (waves, wind, sail luff, squawk).
- Art: low-poly, flat-shaded, toon-ish. Generated in code (geometry) wherever possible, so there's no asset pipeline. A warm tropical palette, glowing night sky.

### Suggested layout
```
src/
  astro/        pure: sidereal time, coordinate transforms, star queries
  world/        pure: seeded worldgen, wind field, island data
  nav/          pure: dead reckoning, instrument readings + noise
  sim/          boat state update (pure where possible)
  render/       three.js: water, sky, ship, islands, camera
  ui/           HUD, chart, dialogue bubbles, instrument overlays
  tutorial/     step definitions + checks
  content/      parrot.json, island name parts, contracts
  data/         stars.json, constellations.ts
  debug/        debug HUD, URL param parsing, scenario loader
scripts/        build-stars.ts
tests/          vitest + playwright
```

---

## 11. AI coding strategy (how Claude Code should build this)

These rules exist to save tokens and avoid rework. Follow them.

### 11.1 Keep logic pure and testable
Anything mathematical (sky, wind, worldgen, dead reckoning, instrument readings) goes in pure modules with unit tests. Claude can't "see" whether the sky is right, but it can prove Polaris sits at the correct altitude. **Write the tests first for `astro/`.**

### 11.2 Make the game inspectable
- **Debug HUD** (`?debug=1`): true lat/lon, heading, speed, wind, LST, game time, FPS, seed, current tutorial step.
- **Scenario URLs:** `?seed=42&lat=12&lon=-3&time=night&heading=90&step=5` jumps straight into a state. This is the biggest efficiency win in the project: never make Colin (or a test) sail for 3 minutes to reproduce a bug.
- **Screenshot script:** `npm run shot -- "<scenario url>" out.png` uses Playwright to capture a frame. Claude Code should use this to look at its own rendering work (sky, water, ship) before calling a visual milestone done.
- **Deterministic seeds everywhere.** Same seed = same world.

### 11.3 Work in milestones (see §12)
- Start each milestone in **plan mode**: restate the goal and acceptance criteria, list files to touch, then build.
- Smallest working version first, then polish only what Colin flags in playtest.
- **Do not refactor unrelated code.** Do not add features not in the current milestone. If something seems missing, write it in `progress.md` under "Ideas / later", don't build it.
- At the end of each milestone: run tests, take screenshots, update `progress.md`, commit.

### 11.4 Keep context cheap
- `CLAUDE.md` holds the conventions and commands; `progress.md` holds the current state, decisions made and known bugs. Read those instead of re-exploring the repo every session.
- Keep files small (< ~300 lines) and named by responsibility so it's obvious where things live.
- Start a fresh session per milestone.

### 11.5 Model allocation (if switching is available)
- **Strongest model** (Fable/Opus): M1 water + boat feel, M2 sky math + rendering, worldgen design, and any bug that survives two attempts.
- **Cheaper model** (Sonnet): UI, chart table, dialogue system, content wiring, test boilerplate, polish passes.

### 11.6 Feel is a human call
Claude verifies correctness; **Colin verifies fun.** After each milestone, Colin plays for 5–10 minutes and writes feedback in `progress.md` under "Playtest notes". The next session starts by reading those notes.

---

## 12. Milestones

Each one should be playable when it's done.

### M0: Skeleton (small)
Vite + TS + Three.js, a first-person camera on a static ocean plane, debug HUD, scenario URL parser, vitest + Playwright screenshot script working.
**Done when:** `npm run dev` shows ocean + sky gradient; `npm test` passes; `npm run shot` produces a PNG.

### M1: Boat feel (the most important milestone)
Gerstner-wave water shader + matching CPU wave function, the sloop (simple low-poly), walk on deck, take the helm, steer, sail trim with a point-of-sail speed curve, constant test wind, bob/roll.
**Done when:** Colin says sailing around for 2 minutes is fun even with nothing to do. Do not move on until this is true.

### M2: The real sky
Build `stars.json`, the astro module + tests (§4), the star sphere renderer, a day/night cycle with sun + moonless nights, constellation-line overlay toggle.
**Done when:** all astro tests pass; screenshot at lat 20 looking north shows Polaris ~20° up with the Dipper recognizable; screenshot at lat −15 looking south shows Crux + Pointers.

### M3: Instruments & navigation
Compass binnacle, hand measurement, kamal, quadrant (wobble with waves), log line, chart table with DR track and latitude lines.
**Done when:** a player can determine their latitude within the instrument's precision and plot a DR position; tests cover DR math and instrument noise.

### M4: The world
Seeded archipelago generation per §6, island meshes + silhouettes, reefs, trade-wind field + doldrums, ports with a simple contract board.
**Done when:** 5 different seeds all produce valid worlds (constraint tests pass); latitude sailing to a contract island works end to end.

### M5: Tutorial & parrot
Dialogue system, `parrot.json`, all 10 tutorial steps with check functions and step-jump URLs.
**Done when:** a fresh player completes the tutorial without outside help (Colin finds a guinea pig) and laughs at least once.

### M6: Progression & polish
Gold + upgrades (quadrant, chronometer), cloudy nights, sound, title screen, credits (with star-data attribution), save to localStorage.
**Done when:** there's a 30–60 minute game loop from tutorial to chronometer.

---

## 13. Open questions (Colin to decide)

- [ ] Does the player name the ship, or is it pre-named (*The Questionable Decision*)?
- [ ] Should hand/instrument readings be typed in by the player, or just displayed? (Typed in teaches more but is more friction. Suggestion: tutorial asks for typed answers, displayed after that.)
- [ ] Desktop only, or must it work on mobile? (Suggestion: desktop only for v1.)
- [ ] Is there any failure state beyond hull damage (e.g., rations running out)? (Suggestion: no, for v1.)
