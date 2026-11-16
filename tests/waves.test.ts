import { describe, expect, it } from 'vitest';
import { WAVES, displace, heightAt, hullPose } from '../src/sim/waves';

describe('gerstner waves', () => {
  it('stays below the self-intersection limit (Σ Q·A·k < 1)', () => {
    const sum = WAVES.reduce((s, w) => s + w.q * w.amp * w.k, 0);
    expect(sum).toBeLessThan(1);
  });

  it('heightAt inverts the horizontal displacement (CPU buoyancy matches the shader)', () => {
    for (let i = 0; i < 50; i++) {
      const x0 = (i * 37.3) % 400 - 200 + 9000;
      const z0 = (i * 91.7) % 400 - 200 - 7000;
      const t = i * 1.37;
      const p = displace(x0, z0, t);
      expect(heightAt(p.x, p.z, t)).toBeCloseTo(p.y, 2); // ±5 mm
    }
  });

  it('is deterministic and bounded by total amplitude', () => {
    const maxA = WAVES.reduce((s, w) => s + w.amp, 0);
    for (let t = 0; t < 30; t += 0.7) {
      const h = heightAt(12.3, -45.6, t);
      expect(h).toBe(heightAt(12.3, -45.6, t));
      expect(Math.abs(h)).toBeLessThanOrEqual(maxA + 1e-9);
    }
  });

  it('flat water gives a flat pose', () => {
    const pose = hullPose(0, 0, 0.7, 3, 5, 1.8, []);
    expect(pose).toEqual({ heightM: 0, pitchRad: 0, rollRad: 0 });
  });

  it('a wave travelling from the bow pitches the bow up when the crest is there', () => {
    // Single long wave moving south (toward 180°): boat facing north meets it bow-first.
    const k = (2 * Math.PI) / 40;
    const w = [{ dirX: 0, dirZ: 1, k, amp: 1, q: 0, omega: 0, phase: 0 }];
    // Crest where k·z = π/2 → z = 10. Bow at z = −5 from origin... place boat so bow sits on the crest.
    // Bow (north) is at z − 5, stern at z + 5. Want bow at z=10 (y=1), stern at z=20 (y=0).
    const pose = hullPose(0, 15, 0, 0, 5, 1.8, w);
    expect(pose.pitchRad).toBeGreaterThan(0);
    expect(Math.abs(pose.rollRad)).toBeLessThan(1e-9);
  });
});
