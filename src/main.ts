import * as THREE from 'three';
import { parseScenario, type Station } from './debug/params';
import { DebugHud } from './debug/hud';
import { createClock, dayNumber, formatHour, hourOfDay, tickClock } from './sim/clock';
import { createBoat, stepBoat, telemetry, type Wind } from './sim/boat';
import { optimalTrim, trueWindAngle, windSide } from './sim/sailing';
import { hullPose } from './sim/waves';
import { nearestStation, walk, STATION_STAND } from './sim/deck';
import { initialWarp, stepWarp } from './sim/warp';
import { FirstPersonCamera } from './render/camera';
import { Celestial, FULL_OVERLAY, NO_OVERLAY } from './render/celestial';
import { julianDate } from './astro/time';
import { horizontalToVector } from './astro/transform';
import { Water } from './render/water';
import { Ship, DECK_Y } from './render/ship';
import { Lighting } from './render/lighting';
import { Input } from './ui/input';
import { Prompt } from './ui/prompt';
import { Dialogue } from './ui/dialogue';
import { Choice } from './ui/choice';
import { toKnots } from './nav/instruments';
import { Navigation } from './app/navigation';
import { TutorialRunner } from './tutorial/runner';
import { controlsFor } from './app/controls';
import { WorldSim } from './app/worldSim';
import { RoundRunner } from './app/rounds';
import { ParrotNags } from './app/nags';
import { OrdersCard } from './ui/ordersCard';
import { setHazeColor } from './render/haze';
import './ui/theme.css';
import type { StepSetup } from './tutorial/steps';
import type { InstrumentId } from './ui/instrumentOverlay';

const M_PER_DEG = 600; // DESIGN §6. Flat equirectangular: x = lon·600, z = −lat·600.
const SIM_STEP_S = 1 / 60;
const ACTIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;
const DECK_SPAWN = { x: 0.6, z: 1.0 }; // clear of all stations

// Entropy only picks the seed; everything downstream is seeded/deterministic.
const scenario = parseScenario(location.search, Math.floor(Math.random() * 1e9));

// --- renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 300, 2800);

const celestial = new Celestial(scene, renderer.getPixelRatio());
celestial.overlay = scenario.lines ? FULL_OVERLAY : NO_OVERLAY;
const water = new Water();
const ship = new Ship();
scene.add(water.mesh, ship.root);
const lighting = new Lighting(scene, ship.root, renderer);
// Game clock reads HOME TIME (UT at the patch's 0° meridian). JD = start date + clock.
const jdStart = julianDate(scenario.date.year, scenario.date.month, scenario.date.day);

const fp = new FirstPersonCamera(window.innerWidth / window.innerHeight);
ship.root.add(fp.rig);
fp.attachPointerLock(renderer.domElement);
fp.yawRad = THREE.MathUtils.degToRad(scenario.lookDeg);
fp.pitchRad = THREE.MathUtils.degToRad(scenario.pitchDeg);
// Debug: external chase camera (?cam=chase) orbiting off the starboard quarter.
const chase = scenario.chaseCam ? new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000) : null;

window.addEventListener('resize', () => {
  fp.camera.aspect = window.innerWidth / window.innerHeight;
  fp.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- state ------------------------------------------------------------------
const wind: Wind = { fromDeg: scenario.windFromDeg ?? 60, strength: 1 };
const windFixed = scenario.windFromDeg !== null;
let boat = createBoat(
  scenario.lonDeg * M_PER_DEG, -scenario.latDeg * M_PER_DEG, scenario.headingDeg,
  optimalTrim(trueWindAngle(scenario.headingDeg, wind.fromDeg)),
);
boat = { ...boat, speedMs: scenario.speedMs };
let mode: Station = scenario.at;
let player = mode === 'deck' ? { ...DECK_SPAWN } : { ...STATION_STAND[mode] };
let clock = createClock(scenario.hour);
let warp = initialWarp();
let waveTime = 0;
let simAccum = 0;
const pose = { h: 0, pitch: 0, roll: 0 };
let wasRaised = false;

const input = new Input();
const prompt = new Prompt();
const dialogue = new Dialogue(scenario.seed);
const choice = new Choice();
const hud = scenario.debug ? new DebugHud() : null;
const nags = new ParrotNags(dialogue);
const worldSim = new WorldSim(scenario.seed, dialogue);
scene.add(worldSim.islands.group);
boat = worldSim.clearSpawn(boat);
let blockWarp = false;
const camWorld = new THREE.Vector3();
const lookDir = new THREE.Vector3();
const projV = new THREE.Vector3();

const nav = new Navigation(scenario.seed, { latDeg: scenario.latDeg, lonDeg: scenario.lonDeg }, dialogue, () => { mode = 'deck'; });
if (mode === 'chart') nav.openChart();
// Debug/test handle (?debug=1 only): lets Playwright scripts inspect state instead of guessing.
if (scenario.debug) (window as unknown as { __game: unknown }).__game = { nav, celestial };

const tutorial = scenario.step === null ? null : new TutorialRunner(scenario.step, {
  applySetup: (s: StepSetup, jump: boolean) => {
    if (s.latDeg !== undefined) {
      boat = { ...boat, z: -s.latDeg * M_PER_DEG };
      nav.resetFix({ latDeg: s.latDeg, lonDeg: boat.x / M_PER_DEG });
    }
    if (s.hour !== undefined && (jump || s.hour - hourOfDay(clock) > 1)) {
      clock = { ...clock, gameSeconds: dayNumber(clock) * 86400 + s.hour * 3600 };
    }
    if (s.windFromDeg !== undefined) wind.fromDeg = s.windFromDeg;
    if (s.trimDeg !== undefined) boat = { ...boat, trimDeg: s.trimDeg };
    if (jump && s.headingDeg !== undefined) {
      boat = { ...boat, headingDeg: s.headingDeg, trimDeg: s.trimDeg ?? optimalTrim(trueWindAngle(s.headingDeg, wind.fromDeg)) };
    }
    if (jump && s.at) { mode = s.at; player = s.at === 'deck' ? { ...DECK_SPAWN } : { ...STATION_STAND[s.at] }; }
  },
  setOverlay: (o) => { celestial.overlay = o; },
  setInstruments: (ids) => {
    nav.available = new Set(ids as InstrumentId[]);
    if (!nav.available.has(nav.instrument)) nav.instrument = (ids[0] as InstrumentId) ?? 'hand';
  },
}, dialogue, choice);

// Rounds (core loop): bare URL or ?round=N. Kamal knots = northern port latitudes + the orders'.
const ordersCard = new OrdersCard();
const rounds = scenario.round === null || tutorial ? null : new RoundRunner(worldSim.world, scenario.seed, scenario.round, {
  placeBoat: (latDeg, lonDeg, h0) => {
    Object.assign(wind, worldSim.windAt(latDeg, lonDeg, clock.gameSeconds)); // trim for the wind actually there
    const headingDeg = trueWindAngle(h0, wind.fromDeg) < 50 ? (h0 + 90) % 360 : h0; // never start in irons
    boat = worldSim.clearSpawn({ ...boat, x: lonDeg * M_PER_DEG, z: -latDeg * M_PER_DEG, headingDeg, speedMs: 4, trimDeg: optimalTrim(trueWindAngle(headingDeg, wind.fromDeg)) });
    nav.resetFix({ latDeg, lonDeg });
    mode = 'helm'; player = { ...STATION_STAND.helm };
  },
  setHour: (h) => { // always forward: the next time it's h o'clock
    const t = dayNumber(clock) * 86400 + h * 3600;
    clock = { ...clock, gameSeconds: t > clock.gameSeconds ? t : t + 86400 };
    return clock.gameSeconds;
  },
  setOrders: (text) => {
    nav.chart.orders = text;
    ordersCard.set(`Round ${rounds?.round.n ?? ''} · orders`, text);
    const t = rounds?.round.target;
    nav.setKamalKnots([
      ...worldSim.world.islands.filter((i) => i.port && i.latDeg > 0.5 && i.id !== t?.id).map((i) => ({ deg: +i.latDeg.toFixed(1), label: `${i.latDeg.toFixed(1)}° ${i.name}` })),
      ...(t && t.latDeg > 0.5 ? [{ deg: +t.latDeg.toFixed(1), label: `${t.latDeg.toFixed(1)}° ${t.name} (orders)` }] : []),
    ]);
  },
  discover: (isl) => { if (!nav.chart.known.some((k) => k.name === isl.name)) nav.chart.known.push({ name: isl.name, latDeg: isl.latDeg, lonDeg: isl.lonDeg }); },
}, dialogue, worldSim.toast);
if (rounds) {
  worldSim.onArrive = (isl, nowS) => rounds.onArrive(isl, nowS, clock.gameSeconds);
  rounds.start(performance.now() / 1000);
}
if (scenario.debug) Object.assign((window as unknown as { __game: object }).__game, {
  rounds, worldSim, teleport: (latDeg: number, lonDeg: number) => { boat = { ...boat, x: lonDeg * M_PER_DEG, z: -latDeg * M_PER_DEG }; },
});

// --- helpers ----------------------------------------------------------------
let lastMs = performance.now();
let fps = 60;
let frames = 0;

/** Where the eyes point, in compass azimuth + altitude (world axes: +X east, −Z north). */
function lookAngles(): { lookAzDeg: number; lookAltDeg: number } {
  fp.camera.getWorldDirection(lookDir);
  const az = THREE.MathUtils.radToDeg(Math.atan2(lookDir.x, -lookDir.z));
  return { lookAzDeg: (az + 360) % 360, lookAltDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(lookDir.y, -1, 1))) };
}

/** Sky direction → screen pixels (for instrument overlays). */
function project(azDeg: number, altDeg: number): { x: number; y: number } | null {
  const [x, y, z] = horizontalToVector(altDeg, azDeg);
  projV.set(camWorld.x + x * 100, camWorld.y + y * 100, camWorld.z + z * 100).project(fp.camera);
  if (projV.z > 1) return null;
  return { x: (projV.x * 0.5 + 0.5) * window.innerWidth, y: (-projV.y * 0.5 + 0.5) * window.innerHeight };
}

function islandDebug(): string {
  const p = worldSim.prox;
  return p?.island ? `near ${p.island.name} (${p.island.kind}${p.island.port ? ', port' : ''}) ${p.shoreDistM.toFixed(0)} m${p.onReef ? ' REEF' : ''}` : '';
}

const uiBlocked = () => nav.chart.isOpen || choice.isOpen;

function handleKeys(): void {
  if (input.pressed('KeyC')) celestial.overlay = celestial.overlay === FULL_OVERLAY ? NO_OVERLAY : FULL_OVERLAY;
  if (mode === 'chart' || !input.pressed('KeyE') || uiBlocked()) return;
  if (mode !== 'deck') { mode = 'deck'; return; }
  const st = nearestStation(player);
  if (!st) return;
  mode = st.id;
  player = { ...STATION_STAND[st.id] };
  if (st.id === 'chart') nav.openChart();
}

// --- loop -------------------------------------------------------------------
function frame(nowMs: number): void {
  const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  const nowS = nowMs / 1000;
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;

  handleKeys();
  const free = !uiBlocked();
  if (mode === 'deck' && free) player = walk(player, input.axis('KeyS', 'KeyW'), input.axis('KeyA', 'KeyD'), fp.yawRad, dt);
  const boatInput = {
    steer: mode === 'helm' && free ? input.axis('KeyA', 'KeyD') : 0,
    trim: (mode === 'mast' || mode === 'helm') && free ? input.axis('KeyS', 'KeyW') : 0,
  };

  warp = stepWarp(warp, {
    atHelm: mode === 'helm', inputActive: input.anyDown(ACTIVE_KEYS) || nav.raised || !free, speedMs: boat.speedMs,
    blocked: (tutorial?.active ?? false) || blockWarp, // no fast-forwarding while learning, or into land
  }, dt);
  if (!windFixed && !tutorial?.active) Object.assign(wind, worldSim.windAt(-boat.z / M_PER_DEG, boat.x / M_PER_DEG, clock.gameSeconds));
  const simDt = dt * warp.warp;
  simAccum += simDt;
  while (simAccum >= SIM_STEP_S) { boat = stepBoat(boat, boatInput, wind, SIM_STEP_S); simAccum -= SIM_STEP_S; }
  clock = tickClock(clock, simDt);
  ({ boat, blockWarp } = worldSim.update(boat, -boat.z / M_PER_DEG, nowS, camWorld));
  rounds?.update(nowS);
  waveTime += dt; // waves animate in real time even under warp, or the sea looks frantic

  // Hull pose: sample the same waves the shader draws, then low-pass (a 12 m hull has inertia).
  const headingRad = THREE.MathUtils.degToRad(boat.headingDeg);
  const p = hullPose(boat.x, boat.z, headingRad, waveTime);
  const k = 1 - Math.exp(-dt / 0.35);
  pose.h += (p.heightM - pose.h) * k;
  pose.pitch += (p.pitchRad - pose.pitch) * k;
  pose.roll += (p.rollRad - pose.roll) * k;
  ship.root.position.set(boat.x, pose.h - 0.1, boat.z);
  ship.root.rotation.set(pose.pitch, -headingRad, -(pose.roll + THREE.MathUtils.degToRad(boat.heelDeg)));

  const tel = telemetry(boat, wind);
  const side = windSide(boat.headingDeg, wind.fromDeg);
  ship.setCompass(nav.compassDeg);
  ship.update(waveTime, boat.trimDeg, side, tel.luffing, tel.efficiency, boat.rudder, wind.fromDeg + 180 - boat.headingDeg);
  fp.place(player.x, DECK_Y, player.z, ship.root.rotation.z);
  ship.root.updateMatrixWorld();
  fp.camera.getWorldPosition(camWorld);

  const hour = hourOfDay(clock);
  const latDeg = -boat.z / M_PER_DEG, lonDeg = boat.x / M_PER_DEG;
  const sky = celestial.update(jdStart + clock.gameSeconds / 86400, latDeg, lonDeg, camWorld);
  const light = sky.daylight;
  (scene.fog as THREE.Fog).color.copy(sky.horizon);
  setHazeColor(sky.horizon);
  water.update(waveTime, camWorld, sky.horizon, light, sky.sunDir, ship.root.matrixWorld);
  lighting.update(light, sky.sunAltDeg, sky.sunDir, ship.root.position);

  if (chase) {
    const a = headingRad + THREE.MathUtils.degToRad(135 + scenario.lookDeg);
    chase.position.set(boat.x + Math.sin(a) * 26, 9, boat.z - Math.cos(a) * 26);
    chase.lookAt(boat.x, 3, boat.z);
  }
  renderer.render(scene, chase ?? fp.camera);

  const look = lookAngles();
  const navFrame = {
    mode, trueHeadingDeg: boat.headingDeg, yawRateDeg: boat.yawRateDeg, speedMs: boat.speedMs, simDt, nowS, ...look,
    hullPitchDeg: THREE.MathUtils.radToDeg(pose.pitch), hullRollDeg: THREE.MathUtils.radToDeg(pose.roll), project,
  };
  nav.handleInput(input, navFrame);
  const navUi = nav.update(navFrame);
  const ui = controlsFor({
    mode, nearStationLabel: mode === 'deck' ? nearestStation(player)?.label ?? null : null,
    mouseCaptured: document.pointerLockElement === renderer.domElement,
    twaDeg: tel.twaDeg, luffing: tel.luffing, efficiency: tel.efficiency, warp: warp.warp,
    navStatus: [navUi.status, worldSim.hullScrapes ? `Hull: ${worldSim.hullScrapes} scrape${worldSim.hullScrapes > 1 ? 's' : ''}` : ''].filter(Boolean).join('    ·    '),
    navHints: navUi.hints,
  });
  if (nav.raised && !wasRaised) prompt.use('raise');
  wasRaised = nav.raised;
  prompt.set(ui.status, ui.hints, input);

  tutorial?.update({
    mode, compassDeg: nav.compassDeg, speedKn: toKnots(boat.speedMs), efficiency: tel.efficiency, luffing: tel.luffing,
    ...look, latDeg, lstDeg: sky.lstDeg, instrument: nav.instrument, raised: nav.raised,
  }, nowS, dt);
  nags.update({ mode, twaDeg: tel.twaDeg, luffing: tel.luffing, ...look, latDeg, sunAltDeg: celestial.lastSunAltDeg }, dt, nowS);
  dialogue.update();

  hud?.update(nowMs, {
    latDeg,
    lonDeg,
    headingDeg: boat.headingDeg,
    speedMs: boat.speedMs,
    windText: `${islandDebug()}\nfrom ${wind.fromDeg.toFixed(0)}° ×${wind.strength.toFixed(2)}  twa ${tel.twaDeg.toFixed(0)}°  trim ${boat.trimDeg.toFixed(0)}°  eff ${(tel.efficiency * 100).toFixed(0)}%${tel.luffing ? ' LUFF' : ''}`,
    ...look,
    lstText: `${(sky.lstDeg / 15).toFixed(2)}h  sun ${sky.sunAltDeg.toFixed(1)}°`,
    timeText: `day ${dayNumber(clock)} ${formatHour(hour)}  warp ×${warp.warp.toFixed(1)}  [${mode}]`,
    fps,
    seed: scenario.seed,
    step: tutorial?.active ? tutorial.stepN : null,
  });

  input.endFrame();
  if (++frames === 120) // ~2 s: lets heel and hull pose settle for screenshots
    (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
