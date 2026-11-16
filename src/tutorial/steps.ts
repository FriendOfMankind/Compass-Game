// Tutorial step definitions (DESIGN §9). Pure data + check functions over a context snapshot.
// Steps 7–8 use the world's tutorial island (world/tutorialIsland.ts); goal text may say
// {island} and {islandLat}, which the runner fills in.
import { starByName } from '../astro/stars';
import { equatorialToHorizontal, horizontalToVector } from '../astro/transform';
import type { SkyOverlay } from '../render/celestial';

export interface TutorialCtx {
  mode: string;
  compassDeg: number;
  speedKn: number;
  efficiency: number;
  luffing: boolean;
  lookAzDeg: number;
  lookAltDeg: number;
  latDeg: number;
  lstDeg: number;
  instrument: string;
  raised: boolean;
  islandLatDeg: number;  // the tutorial island's latitude (steps 7–8)
  logged: boolean;       // the log has been thrown at least once
  marks: number;         // positions marked on the chart
  atIsland: boolean;     // arrived at the tutorial island
}

export interface StepSetup {
  latDeg?: number;
  hour?: number;
  headingDeg?: number;
  windFromDeg?: number;
  trimDeg?: number;
  at?: 'deck' | 'helm';
  instruments?: string[];
  /** Teleport to the tutorial start south-west of the tutorial island. */
  atTutorialStart?: boolean;
}

export interface Goal {
  text: string;
  check: (c: TutorialCtx) => boolean;
  holdS?: number;          // check must stay true this long
  intro?: string | string[]; // parrot key(s) when the goal starts
  hint?: string;           // parrot key after hintAfterS
  hintAfterS?: number;
  overlay?: Partial<SkyOverlay>;     // sky highlights while active
  hintOverlay?: Partial<SkyOverlay>; // extra highlights once the hint fires
  done?: string;
  /** Let time warp work during this goal (open-water passages). Default: no warp in the tutorial. */
  allowWarp?: boolean;
  /** When the hint fires, also ink the tutorial island onto the chart (the tutorial's one waypoint). */
  revealOnHint?: boolean;
  /** Ask a multiple-choice question after the check passes. Correct index is computed from ctx. */
  question?: { key: string; text: string; options: (c: TutorialCtx) => { labels: string[]; correct: number }; wrong: string };
}

export interface Step { n: number; title: string; setup?: StepSetup; goals: Goal[]; }

const NO_LINES: Partial<SkyOverlay> = { constellations: [] };

/** Angular distance between the look direction and a sky direction (degrees). */
export function lookDistanceDeg(c: TutorialCtx, altDeg: number, azDeg: number): number {
  const a = horizontalToVector(c.lookAltDeg, c.lookAzDeg), b = horizontalToVector(altDeg, azDeg);
  return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * (180 / Math.PI);
}

function starHz(c: TutorialCtx, name: string) {
  const s = starByName(name);
  return equatorialToHorizontal(s.raDeg, s.decDeg, c.latDeg, c.lstDeg);
}
const lookingAtStar = (c: TutorialCtx, name: string, tolDeg: number) => {
  const h = starHz(c, name);
  return h.altDeg > 0 && lookDistanceDeg(c, h.altDeg, h.azDeg) < tolDeg;
};
/** Facing the star (azimuth only, any pitch). Hand and kamal are drawn from the horizon at the
 *  look azimuth, so the player watches the horizon/fists, not the star: don't demand they centre it. */
const facingStar = (c: TutorialCtx, name: string, tolAzDeg: number) => {
  const h = starHz(c, name);
  return h.altDeg > 0 && Math.abs(((c.lookAzDeg - h.azDeg + 540) % 360) - 180) < tolAzDeg;
};

const fmtLat = (d: number) => `${Math.abs(Math.round(d))}°${d >= 0 ? 'N' : 'S'}`;

// Every step uses the same steady north wind (from 0°): continuing between steps keeps your
// heading, so a wind shift could leave you pointing straight into it (in irons).
export const STEPS: readonly Step[] = [
  {
    n: 1, title: 'Walk & look', setup: { at: 'deck', hour: 9, instruments: [] },
    goals: [{ text: 'Find the wheel at the back of the boat and press E', intro: 'tutorial.step1.intro', hint: 'tutorial.step1.hint', hintAfterS: 25, done: 'tutorial.step1.done', check: (c) => c.mode === 'helm' }],
  },
  {
    n: 2, title: 'Steering & compass', setup: { at: 'helm', hour: 9.5, headingDeg: 150, windFromDeg: 0, instruments: [] },
    goals: [{
      text: 'Steer (A/D) to 090° on the compass and hold it for 10 seconds', intro: 'tutorial.step2.intro', hint: 'tutorial.step2.hint', hintAfterS: 30,
      done: 'tutorial.step2.done', holdS: 10, check: (c) => c.mode === 'helm' && Math.abs(((c.compassDeg - 90 + 540) % 360) - 180) < 5,
    }],
  },
  {
    n: 3, title: 'Sails & wind', setup: { at: 'helm', hour: 10, headingDeg: 90, windFromDeg: 0, trimDeg: 90, instruments: [] },
    goals: [{
      text: 'Trim the sail (W sheets in, S eases) until it stops flapping and you make 6+ knots', intro: 'tutorial.step3.intro', hint: 'tutorial.step3.hint',
      hintAfterS: 20, done: 'tutorial.step3.done', holdS: 2, check: (c) => !c.luffing && c.efficiency > 0.85 && c.speedKn >= 6,
    }],
  },
  {
    n: 4, title: 'Night falls', setup: { at: 'helm', hour: 21, latDeg: 12, headingDeg: 90, windFromDeg: 0, instruments: [] },
    goals: [{
      text: 'Find the Big Dipper in the northern sky', intro: 'tutorial.step4.intro', hint: 'tutorial.step4.hint', hintAfterS: 25,
      done: 'tutorial.step4.done', holdS: 1, overlay: { ...NO_LINES, constellations: ['UMa'] },
      check: (c) => lookingAtStar(c, 'Megrez', 16),
    }],
  },
  {
    n: 5, title: 'Find Polaris', setup: { at: 'helm', hour: 21.2, latDeg: 12, headingDeg: 90, windFromDeg: 0, instruments: [] },
    goals: [{
      text: 'Follow the two end stars of the bowl to Polaris and look right at it', intro: 'tutorial.step5.intro', hint: 'tutorial.step5.hint', hintAfterS: 30,
      done: 'tutorial.step5.done', holdS: 0.6, overlay: { constellations: ['UMa'] }, hintOverlay: { polarisGuide: true },
      check: (c) => lookingAtStar(c, 'Polaris', 4), // boat motion makes tighter than ~4° a dexterity test
    }],
  },
  {
    n: 6, title: 'Measure with your hand', setup: { at: 'helm', hour: 21.4, latDeg: 12, headingDeg: 90, windFromDeg: 0, instruments: ['hand'] },
    goals: [{
      text: 'Face Polaris and hold right-click to raise your fists. Count fists from the horizon up to the star', intro: 'tutorial.step6.intro', hint: 'tutorial.step6.hint',
      hintAfterS: 30, done: 'tutorial.step6.done', holdS: 1.5, overlay: { constellations: ['UMa'], polaris: true },
      check: (c) => c.raised && c.instrument === 'hand' && facingStar(c, 'Polaris', 10),
      question: {
        key: 'tutorial.step6.ask', text: 'Polaris is about how high, and so what is our latitude?', wrong: 'tutorial.step6.wrong',
        options: (c) => {
          const truth = Math.round(c.latDeg);
          const set = [truth, truth + 8, truth - 7, truth + 18].map((v) => Math.max(0, v));
          const uniq = [...new Set(set)].sort((a, b) => a - b);
          return { labels: uniq.map((v) => `${v}° up → ${fmtLat(v)}`), correct: uniq.indexOf(truth) };
        },
      },
    }],
  },
  {
    n: 7, title: 'Latitude sailing', setup: { at: 'helm', hour: 21.6, atTutorialStart: true, headingDeg: 0, windFromDeg: 160, instruments: ['hand', 'kamal'] },
    goals: [
      {
        text: 'Switch to the kamal (2), face Polaris and hold right-click to raise it', intro: ['tutorial.step7.intro', 'tutorial.step7.kamal'], hint: 'tutorial.step7.kamalHint',
        hintAfterS: 25, done: 'tutorial.step7.kamalDone', holdS: 1, overlay: { polaris: true },
        check: (c) => c.raised && c.instrument === 'kamal' && facingStar(c, 'Polaris', 10),
      },
      {
        text: 'Sail north until Polaris sits on the {island} knot ({islandLat}). Check with the kamal as you go', intro: 'tutorial.step7.north', hint: 'tutorial.step7.northHint',
        hintAfterS: 90, done: 'tutorial.step7.northDone', holdS: 0, overlay: { polaris: true }, allowWarp: true,
        check: (c) => Math.abs(c.latDeg - c.islandLatDeg) < 0.2,
      },
      {
        text: 'Now turn east (090) and run along the latitude', intro: 'tutorial.step7.east', hint: 'tutorial.step7.eastHint', hintAfterS: 25,
        done: 'tutorial.step7.done', holdS: 3, check: (c) => c.mode === 'helm' && Math.abs(((c.compassDeg - 90 + 540) % 360) - 180) < 12,
      },
    ],
  },
  {
    n: 8, title: 'Dead reckoning', setup: { at: 'helm', hour: 21.9, windFromDeg: 160, instruments: ['hand', 'kamal'] },
    goals: [
      {
        text: 'Throw the log line (L) and wait for the sandglass', intro: 'tutorial.step8.intro', hint: 'tutorial.step8.logHint', hintAfterS: 20,
        done: 'tutorial.step8.logDone', check: (c) => c.logged,
      },
      {
        text: 'Walk to the chart table (press E to let go of the wheel), open it and mark your position', intro: 'tutorial.step8.chart', hint: 'tutorial.step8.chartHint',
        hintAfterS: 40, done: 'tutorial.step8.chartDone', check: (c) => c.marks > 0,
      },
      {
        text: 'Keep heading east along {islandLat} until {island} comes out of the haze, then reach it', intro: 'tutorial.step8.find', hint: 'tutorial.step8.findHint',
        hintAfterS: 75, revealOnHint: true, allowWarp: true, done: 'tutorial.step8.done', check: (c) => c.atIsland,
      },
    ],
  },
  {
    n: 9, title: 'Crossing the line', setup: { at: 'helm', hour: 22, latDeg: -12, headingDeg: 180, windFromDeg: 0, instruments: ['hand'] },
    goals: [
      {
        text: 'South of the equator: find the Southern Cross and its two Pointers (look south)', intro: ['tutorial.step9.intro', 'tutorial.step9.polaris', 'tutorial.step9.cross'], hint: 'tutorial.step9.crossHint',
        hintAfterS: 30, done: 'tutorial.step9.crossDone', holdS: 1, overlay: { constellations: ['Cru', 'Cen'] },
        check: (c) => lookingAtStar(c, 'Acrux', 10),
      },
      {
        text: 'Extend the Cross\'s long bar about 4.5 times. Look at the empty south pole', hint: 'tutorial.step9.poleHint', hintAfterS: 25,
        done: 'tutorial.step9.done', holdS: 1, overlay: { constellations: ['Cru', 'Cen'] }, hintOverlay: { southGuide: true, south: true },
        check: (c) => -c.latDeg > 0 && lookDistanceDeg(c, -c.latDeg, 180) < 4,
      },
    ],
  },
  {
    n: 10, title: 'Graduation', setup: { instruments: ['hand', 'kamal'] }, // the quadrant is bought (DESIGN §5)
    goals: [{
      text: 'No more hints. Orders come next: an exact latitude and a vague direction. Off you go', intro: 'tutorial.step10.intro',
      done: 'tutorial.step10.done', holdS: 6, check: () => true,
    }],
  },
];

export const stepIndex = (n: number) => STEPS.findIndex((s) => s.n === n);
