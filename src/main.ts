import * as THREE from 'three';
import { parseScenario } from './debug/params';
import { DebugHud } from './debug/hud';
import { createClock, dayNumber, formatHour, hourOfDay, tickClock } from './sim/clock';
import { FirstPersonCamera } from './render/camera';
import { Sky, daylight } from './render/sky';
import { Ocean } from './render/ocean';

// Entropy only picks the seed; everything downstream is seeded/deterministic.
const scenario = parseScenario(location.search, Math.floor(Math.random() * 1e9));

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 200, 3000);
const fpCam = new FirstPersonCamera(window.innerWidth / window.innerHeight, scenario.headingDeg);
fpCam.attachPointerLock(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1);
scene.add(hemi);

const sky = new Sky();
const ocean = new Ocean();
scene.add(sky.mesh, ocean.mesh);

const hud = scenario.debug ? new DebugHud() : null;
let clock = createClock(scenario.hour);

window.addEventListener('resize', () => {
  fpCam.camera.aspect = window.innerWidth / window.innerHeight;
  fpCam.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastMs = performance.now();
let fps = 60;
let frames = 0;

function frame(nowMs: number): void {
  const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;

  clock = tickClock(clock, dt);
  const hour = hourOfDay(clock);
  const light = daylight(hour);

  const horizon = sky.update(hour, fpCam.camera);
  (scene.fog as THREE.Fog).color.copy(horizon);
  ocean.update(light, fpCam.camera);
  hemi.intensity = 0.35 + 0.75 * light;

  renderer.render(scene, fpCam.camera);

  hud?.update(nowMs, {
    latDeg: scenario.latDeg,
    lonDeg: scenario.lonDeg,
    headingDeg: fpCam.headingDeg,
    speedKn: 0,
    windText: '— (M4)',
    lstText: '— (M2)',
    timeText: `day ${dayNumber(clock)} ${formatHour(hour)}`,
    fps,
    seed: scenario.seed,
    step: scenario.step,
  });

  // Signal for the screenshot script: a few frames have rendered.
  if (++frames === 5) (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
