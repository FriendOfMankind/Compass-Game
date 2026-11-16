// Procedural audio (DESIGN §10: Web Audio, tiny wrapper, placeholder sounds are fine).
// Beds: sea, wind, water rush past the hull, sail luffing. One-shots: parrot squawk,
// log splash, reef crunch, arrival bell. No files: everything is shaped noise and oscillators.
// Browsers block audio until a user gesture, so it starts on the first click/key. M mutes.

const MUTE_KEY = 'dead-reckoning-muted';

export interface SoundFrame { speedMs: number; windStrength: number; luffing: boolean; warp: number; }

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sea!: GainNode;
  private wind!: GainNode;
  private rush!: GainNode;
  private luff!: GainNode;
  private noise!: AudioBuffer;
  private muted = false;
  private t = 0;

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* no storage */ }
    const start = () => { this.init(); window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start); };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  private init(): void {
    if (this.ctx) return;
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    // 4 s of noise, shared by every bed (different filters make different sounds).
    this.noise = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; brown = (brown + 0.02 * w) / 1.02; d[i] = w * 0.5 + brown * 3; }
    this.sea = this.bed('lowpass', 420, 0.7, 0.35);
    this.wind = this.bed('bandpass', 900, 0.6, 0);
    this.rush = this.bed('highpass', 1400, 0.5, 0);
    this.luff = this.bed('bandpass', 300, 1.2, 0);
  }

  private bed(type: BiquadFilterType, freq: number, q: number, gain: number): GainNode {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4; // decorrelate the beds
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  /** Per frame. */
  update(f: SoundFrame, dt: number): void {
    if (!this.ctx) return;
    this.t += dt;
    const now = this.ctx.currentTime, k = 0.25;
    const swell = 0.28 + 0.1 * Math.sin(this.t * 0.7) + 0.05 * Math.sin(this.t * 1.9);
    this.sea.gain.setTargetAtTime(swell, now, k);
    const gust = 0.8 + 0.2 * Math.sin(this.t * 0.31) * Math.sin(this.t * 1.13);
    this.wind.gain.setTargetAtTime(0.16 * f.windStrength * gust * (f.warp > 1.5 ? 1.3 : 1), now, k);
    this.rush.gain.setTargetAtTime(Math.min(0.12, f.speedMs * 0.009), now, k);
    // Luffing canvas: noise chopped at ~9 Hz.
    const flap = f.luffing ? 0.22 * (0.5 + 0.5 * Math.sign(Math.sin(this.t * 2 * Math.PI * 9))) : 0;
    this.luff.gain.setTargetAtTime(flap, now, 0.01);
  }

  /** Two quick rising chirps: the parrot has something to say. */
  squawk(): void {
    const c = this.ctx; if (!c) return;
    for (const [at, f0, f1] of [[0, 1300, 2300], [0.14, 1600, 900]] as const) {
      const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
      o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2;
      const t0 = c.currentTime + at;
      o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + 0.11);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      o.connect(bp).connect(g).connect(this.master); o.start(t0); o.stop(t0 + 0.14);
    }
  }

  private burst(type: BiquadFilterType, freq: number, gain: number, dur: number): void {
    const c = this.ctx; if (!c) return;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(), t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t0, Math.random() * 3); src.stop(t0 + dur);
  }

  splash(): void { this.burst('lowpass', 1200, 0.5, 0.5); }
  crunch(): void { this.burst('lowpass', 260, 0.9, 0.7); this.burst('bandpass', 1800, 0.3, 0.25); }

  /** Ship's bell: two strikes, for arriving. */
  bell(): void {
    const c = this.ctx; if (!c) return;
    for (const at of [0, 0.45]) for (const [freq, amp] of [[880, 0.12], [2210, 0.05], [1320, 0.04]] as const) {
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at;
      o.frequency.value = freq;
      g.gain.setValueAtTime(amp, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.6);
      o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 1.7);
    }
  }
}
