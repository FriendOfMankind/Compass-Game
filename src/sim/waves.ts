// Gerstner waves. Single source of truth for BOTH the water shader (render/water.ts
// uploads WAVES as uniforms) and CPU buoyancy. Pure: no Three.js.
// Formula (GPU Gems ch.1): for a rest point (x0, z0),
//   θ = k·(D·p0) − ω·t + φ
//   x = x0 + Σ Q·A·Dx·cos θ,  y = Σ A·sin θ,  z = z0 + Σ Q·A·Dz·cos θ
// World axes: +X east, −Z north. Units: metres, seconds.

export interface Wave {
  dirX: number; // unit direction of travel
  dirZ: number;
  k: number;    // wavenumber 2π/λ
  amp: number;  // metres
  q: number;    // horizontal pinch (0 = sine, Q·A·k summed over waves must stay < 1)
  omega: number;
  phase: number;
}

const G = 9.81;

function makeWave(towardDeg: number, wavelengthM: number, ampM: number, steepness: number, phase: number): Wave {
  const rad = (towardDeg * Math.PI) / 180;
  const k = (2 * Math.PI) / wavelengthM;
  return {
    dirX: Math.sin(rad),
    dirZ: -Math.cos(rad),
    k,
    amp: ampM,
    q: steepness / (k * ampM * 4), // 4 waves → Σ Q·A·k = Σ steepness/4 ≤ 1
    omega: Math.sqrt(G * k),        // deep-water dispersion
    phase,
  };
}

/** Swell rolls toward ~240° (i.e. from the NE trades). Fixed for M1; wind-driven later. */
export const WAVES: readonly Wave[] = [
  makeWave(240, 64, 0.55, 0.55, 0.0),
  makeWave(215, 33, 0.3, 0.6, 1.7),
  makeWave(265, 17, 0.14, 0.6, 4.1),
  makeWave(195, 9, 0.06, 0.5, 2.3),
];

export interface Vec3 { x: number; y: number; z: number; }

/** Displaced position of the surface point that rests at (x0, z0). */
export function displace(x0: number, z0: number, t: number, waves: readonly Wave[] = WAVES): Vec3 {
  let x = x0, y = 0, z = z0;
  for (const w of waves) {
    const th = w.k * (w.dirX * x0 + w.dirZ * z0) - w.omega * t + w.phase;
    const c = Math.cos(th);
    x += w.q * w.amp * w.dirX * c;
    z += w.q * w.amp * w.dirZ * c;
    y += w.amp * Math.sin(th);
  }
  return { x, y, z };
}

/**
 * Water surface height at world (x, z). Gerstner moves points sideways, so we
 * invert the horizontal displacement with a few fixed-point iterations.
 */
export function heightAt(x: number, z: number, t: number, waves: readonly Wave[] = WAVES): number {
  let x0 = x, z0 = z;
  for (let i = 0; i < 4; i++) {
    const p = displace(x0, z0, t, waves);
    x0 -= p.x - x;
    z0 -= p.z - z;
  }
  return displace(x0, z0, t, waves).y;
}

export interface HullPose {
  heightM: number;
  pitchRad: number; // + = bow up
  rollRad: number;  // + = starboard side down (heel to starboard)
}

/** Samples bow/stern/port/starboard to get a hull pose. Heading 0 = north. */
export function hullPose(
  x: number, z: number, headingRad: number, t: number,
  halfLengthM = 5, halfBeamM = 1.8, waves: readonly Wave[] = WAVES,
): HullPose {
  const fx = Math.sin(headingRad), fz = -Math.cos(headingRad); // forward
  const sx = Math.cos(headingRad), sz = Math.sin(headingRad);  // starboard
  const bow = heightAt(x + fx * halfLengthM, z + fz * halfLengthM, t, waves);
  const stern = heightAt(x - fx * halfLengthM, z - fz * halfLengthM, t, waves);
  const stbd = heightAt(x + sx * halfBeamM, z + sz * halfBeamM, t, waves);
  const port = heightAt(x - sx * halfBeamM, z - sz * halfBeamM, t, waves);
  return {
    heightM: (bow + stern + stbd + port) / 4,
    pitchRad: Math.atan2(bow - stern, 2 * halfLengthM),
    rollRad: Math.atan2(port - stbd, 2 * halfBeamM),
  };
}
