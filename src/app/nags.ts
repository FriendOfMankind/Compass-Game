// Occasional parrot remarks for things the player keeps doing (each needs to hold a while).
import type { Dialogue } from '../ui/dialogue';

export interface NagCtx { mode: string; twaDeg: number; luffing: boolean; lookAzDeg: number; lookAltDeg: number; latDeg: number; sunAltDeg: number; }

export class ParrotNags {
  private irons = 0;
  private luff = 0;
  private southLook = 0; // seconds each condition has held

  constructor(private readonly dialogue: Dialogue) {}

  update(c: NagCtx, dt: number, nowS: number): void {
    this.irons = c.mode === 'helm' && c.twaDeg < 38 ? this.irons + dt : 0;
    this.luff = c.luffing && c.twaDeg >= 38 ? this.luff + dt : 0;
    const northLow = Math.abs(((c.lookAzDeg + 540) % 360) - 180) < 25 && c.lookAltDeg < 15;
    this.southLook = c.latDeg < -1 && northLow && c.sunAltDeg < -10 ? this.southLook + dt : 0;
    if (this.irons > 4) this.dialogue.say('irons', nowS, 45);
    if (this.luff > 10) this.dialogue.say('luff.long', nowS, 60);
    if (this.southLook > 4) this.dialogue.say('south.lookingForPolaris', nowS, 120);
  }
}
