# CLAUDE.md

First-person pirate sailing game teaching real celestial navigation. **Read `DESIGN.md` for the spec and `progress.md` for current state before doing anything.**

## Commands
- `npm run dev`: dev server
- `npm test`: vitest (pure logic)
- `npm run shot -- "<url>" out.png`: Playwright screenshot of a scenario. `<url>` can be just a query string (`"?lat=12&time=night&debug=1"`); the script starts its own Vite server. Locally you need `npm i -D playwright && npx playwright install chromium` once (not needed in the cloud container, which has it preinstalled).
- `npm run build-stars`: regenerate `src/data/stars.json` from HYG CSV

## Rules
- Work only on the current milestone in `progress.md`. Put ideas under "Ideas / later" instead of building them.
- Start each milestone in plan mode: goal, acceptance criteria, files to touch.
- Smallest working version first. No speculative abstractions, no unrelated refactors.
- Pure logic (`astro/`, `world/`, `nav/`, `sim/`) has no Three.js imports and has tests. Write astro tests first.
- Every gameplay state must be reachable via scenario URL params (`?seed=&lat=&lon=&time=&heading=&step=&debug=1`).
- Check visual work with `npm run shot` before calling it done.
- Keep files under ~300 lines and named by responsibility.
- Deterministic: all randomness goes through the seeded RNG.
- End of milestone: tests pass, screenshots taken, `progress.md` updated (done / decisions / known bugs), commit.

## Conventions
- TypeScript strict. Angles in degrees at API boundaries, radians internally; suffix variables `Deg`/`Rad`.
- Units: 1° latitude = 600 world units. Game day = 20 real minutes.
- Parrot dialogue lives in `src/content/parrot.json`, never hardcoded.
