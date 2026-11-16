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
import { Celestial } from './render/celestial';
import { julianDate } from './astro/time';
import { Water } from './render/water';
import { Ship, DECK_Y } from './render/ship';
import { Input } from './ui/input';
import { Prompt } from './ui/prompt';

const M_PER_DEG = 600; // DESIGN §6. Flat equirectangular: x = lon·600, z = −lat·600.
const SIM_STEP_S = 1 / 60;
const ACTIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

// Entropy only picks the seed; everything downstream is seeded/deterministic.
const scenario = parseScenario(location.search, Math.floor(Math.random() * 1e9));

// --- renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 300, 2800);
const hemi = new THREE.HemisphereLight(0xffffff, 0x2a3d4f, 1);
const sun = new THREE.DirectionalLight(0xfff1d6, 1);
scene.add(hemi, sun);

const celestial = new Celestial(scene, renderer.getPixelRatio());
celestial.linesVisible = scenario.lines;
const water = new Water();
const ship = new Ship();
scene.add(water.mesh, ship.root);
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
const wind: Wind = { fromDeg: scenario.windFromDeg, strength: 1 };
let boat = createBoat(
  scenario.lonDeg * M_PER_DEG, -scenario.latDeg * M_PER_DEG, scenario.headingDeg,
  optimalTrim(trueWindAngle(scenario.headingDeg, wind.fromDeg)),
);
boat = { ...boat, speedMs: scenario.speedMs };
let mode: Station = scenario.at;
let player = mode === 'deck' ? { x: 0, z: 2.6 } : { ...STATION_STAND[mode] };
let clock = createClock(scenario.hour);
let warp = initialWarp();
let waveTime = 0;
let simAccum = 0;
const pose = { h: 0, pitch: 0, roll: 0 };

const input = new Input();
const prompt = new Prompt();
const hud = scenario.debug ? new DebugHud() : null;
const camWorld = new THREE.Vector3();

// --- loop -------------------------------------------------------------------
let lastMs = performance.now();
let fps = 60;
let frames = 0;

function handleKeys(): void {
  if (input.pressed('KeyC')) celestial.linesVisible = !celestial.linesVisible;
}

function handleStations(): void {
  if (!input.pressed('KeyE')) return;
  if (mode !== 'deck') { mode = 'deck'; return; }
  const st = nearestStation(player);
  if (st) { mode = st.id; player = { ...STATION_STAND[st.id] }; }
}

function promptText(tel: ReturnType<typeof telemetry>): string {
  const warpLine = warp.warp > 1.05 ? `\nmaking way  ≫ ×${warp.warp.toFixed(1)}` : '';
  const sailLine = tel.twaDeg < 38 ? 'in irons: bow is in the wind'
    : tel.luffing ? 'sail is luffing: sheet in (W)'
    : tel.efficiency < 0.75 ? 'sail is over-sheeted: ease out (S)' : '';
  if (mode === 'helm') return `A / D  steer    ·    W / S  trim sail    ·    C  star lines    ·    E  let go${sailLine ? `\n${sailLine}` : ''}${warpLine}`;
  if (mode === 'mast') return `W  sheet in    ·    S  ease out    ·    E  let go\n${sailLine || 'sail is drawing nicely'}`;
  const st = nearestStation(player);
  return st ? `E  ${st.label}` : 'WASD walk  ·  mouse look  (click to capture mouse)';
}

function frame(nowMs: number): void {
  const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;

  handleKeys();
  handleStations();
  if (mode === 'deck') player = walk(player, input.axis('KeyS', 'KeyW'), input.axis('KeyA', 'KeyD'), fp.yawRad, dt);
  const boatInput = {
    steer: mode === 'helm' ? input.axis('KeyA', 'KeyD') : 0,
    trim: mode === 'mast' || mode === 'helm' ? input.axis('KeyS', 'KeyW') : 0,
  };

  warp = stepWarp(warp, {
    atHelm: mode === 'helm', inputActive: input.anyDown(ACTIVE_KEYS), speedMs: boat.speedMs, blocked: false,
  }, dt);
  const simDt = dt * warp.warp;
  simAccum += simDt;
  while (simAccum >= SIM_STEP_S) { boat = stepBoat(boat, boatInput, wind, SIM_STEP_S); simAccum -= SIM_STEP_S; }
  clock = tickClock(clock, simDt);
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
  ship.update(waveTime, boat.trimDeg, side, tel.luffing, tel.efficiency, boat.rudder, wind.fromDeg + 180 - boat.headingDeg);
  fp.place(player.x, DECK_Y, player.z, ship.root.rotation.z);
  ship.root.updateMatrixWorld();
  fp.camera.getWorldPosition(camWorld);

  const hour = hourOfDay(clock);
  const latDeg = -boat.z / M_PER_DEG, lonDeg = boat.x / M_PER_DEG;
  const sky = celestial.update(jdStart + clock.gameSeconds / 86400, latDeg, lonDeg, camWorld);
  const light = sky.daylight;
  (scene.fog as THREE.Fog).color.copy(sky.horizon);
  water.update(waveTime, camWorld, sky.horizon, light, sky.sunDir, ship.root.matrixWorld);
  hemi.intensity = 0.3 + 0.8 * light;
  sun.intensity = 1.6 * light;
  sun.position.copy(sky.sunDir).multiplyScalar(100);

  if (chase) {
    const a = headingRad + THREE.MathUtils.degToRad(135 + scenario.lookDeg);
    chase.position.set(boat.x + Math.sin(a) * 26, 9, boat.z - Math.cos(a) * 26);
    chase.lookAt(boat.x, 3, boat.z);
  }
  renderer.render(scene, chase ?? fp.camera);
  prompt.set(promptText(tel));

  hud?.update(nowMs, {
    latDeg,
    lonDeg,
    headingDeg: boat.headingDeg,
    speedMs: boat.speedMs,
    windText: `from ${wind.fromDeg.toFixed(0)}°  twa ${tel.twaDeg.toFixed(0)}°  trim ${boat.trimDeg.toFixed(0)}°  eff ${(tel.efficiency * 100).toFixed(0)}%${tel.luffing ? ' LUFF' : ''}`,
    lstText: `${(sky.lstDeg / 15).toFixed(2)}h  sun ${sky.sunAltDeg.toFixed(1)}°`,
    timeText: `day ${dayNumber(clock)} ${formatHour(hour)}  warp ×${warp.warp.toFixed(1)}  [${mode}]`,
    fps,
    seed: scenario.seed,
    step: scenario.step,
  });

  input.endFrame();
  if (++frames === 120) // ~2 s: lets heel and hull pose settle for screenshots
    (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
