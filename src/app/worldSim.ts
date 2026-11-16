// The world around the boat: islands (render), the trade-wind field, and what the boat runs
// into (reefs, beaches, arrivals, the doldrums). Turns pure world/ queries into game events.
import type * as THREE from 'three';
import { generateWorld, type Island, type World } from '../world/worldgen';
import { WindField } from '../world/wind';
import { proximity, WARP_BLOCK_M, type Proximity } from '../world/hazards';
import { islandHeight } from '../world/terrain';
import { Islands } from '../render/islands';
import { M_PER_DEG } from '../nav/dr';
import type { Boat, Wind } from '../sim/boat';
import type { Dialogue } from '../ui/dialogue';
import { Toast } from '../ui/toast';

const REEF_COOLDOWN_S = 2.5;
const DOLDRUMS_ENTER_DEG = 4, DOLDRUMS_EXIT_DEG = 5.5; // hysteresis so the parrot doesn't flap

export class WorldSim {
  readonly world: World;
  readonly islands: Islands;
  private readonly windField: WindField;
  readonly toast = new Toast();
  /** Arrival at any island (rounds use it). */
  onArrive: ((isl: Island, nowS: number) => void) | null = null;
  hullScrapes = 0;
  prox: Proximity | null = null;
  private lastReefS = -99;
  private visited: number | null = null; // island we're currently "at"
  private inDoldrums: boolean | null = null;

  constructor(seed: number, private readonly dialogue: Dialogue) {
    this.world = generateWorld(seed);
    this.windField = new WindField(seed);
    this.islands = new Islands(this.world);
  }

  windAt(latDeg: number, lonDeg: number, gameS: number): Wind { return this.windField.at(latDeg, lonDeg, gameS); }

  /** If a scenario drops the boat on land, slide it out to sea along the radial. */
  clearSpawn(boat: Boat): Boat {
    let b = boat;
    for (let i = 0; i < 400 && proximity(this.world, b.x, b.z).aground; i++) b = this.pushOut(b, 5);
    return b;
  }

  /** Per frame: hazards + events. Returns the (possibly corrected) boat and whether warp must stop. */
  update(boat: Boat, latDeg: number, nowS: number, camWorld: THREE.Vector3): { boat: Boat; blockWarp: boolean } {
    this.islands.update(camWorld);
    this.toast.update(nowS);
    const p = proximity(this.world, boat.x, boat.z);
    this.prox = p;
    let b = boat;

    if (p.onReef && nowS - this.lastReefS > REEF_COOLDOWN_S) {
      this.lastReefS = nowS;
      this.hullScrapes++;
      b = { ...b, speedMs: b.speedMs * 0.35 };
      this.dialogue.say('reef.hit', nowS, 8);
    }
    if (p.aground) {
      b = this.pushOut({ ...b, speedMs: Math.min(b.speedMs, 0.6) }, 0.5);
      this.dialogue.say('aground', nowS, 20);
    }
    const isl = p.arrived ? p.island : null;
    if (isl && this.visited !== isl.id) this.arrive(isl, nowS);
    if (!isl && p.shoreDistM > 400) this.visited = null;

    const absLat = Math.abs(latDeg);
    const nowIn = this.inDoldrums ? absLat < DOLDRUMS_EXIT_DEG : absLat < DOLDRUMS_ENTER_DEG;
    if (this.inDoldrums !== null && nowIn !== this.inDoldrums) this.dialogue.say(nowIn ? 'doldrums.enter' : 'doldrums.exit', nowS, 60);
    this.inDoldrums = nowIn;

    return { boat: b, blockWarp: p.shoreDistM < WARP_BLOCK_M };
  }

  private arrive(isl: Island, nowS: number): void {
    this.visited = isl.id;
    if (this.onArrive) { this.onArrive(isl, nowS); return; }
    this.toast.show(isl.name, `${isl.port ? 'A port. ' : ''}${isl.blurb}`, nowS);
    this.dialogue.say('island.arrive', nowS, 30);
  }

  private pushOut(b: Boat, stepM: number): Boat {
    const p = proximity(this.world, b.x, b.z);
    if (!p.island) return b;
    const cx = p.island.lonDeg * M_PER_DEG, cz = -p.island.latDeg * M_PER_DEG;
    const d = Math.hypot(b.x - cx, b.z - cz) || 1;
    // Only push while there's land under the keel.
    if (islandHeight(p.island, b.x - cx, b.z - cz) <= -1) return b;
    return { ...b, x: b.x + ((b.x - cx) / d) * stepM, z: b.z + ((b.z - cz) / d) * stepM };
  }
}
