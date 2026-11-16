// What the bottom HUD says for the current situation: a status line and the control hints.
import type { Hint } from '../ui/prompt';
import type { Station } from '../debug/params';

export interface ControlsCtx {
  mode: Station;
  nearStationLabel: string | null;
  mouseCaptured: boolean;
  twaDeg: number;
  luffing: boolean;
  efficiency: number;
  warp: number;
  navStatus: string;
  navHints: Hint[];
}

const WALK: Hint = { id: 'walk', keys: ['W', 'A', 'S', 'D'], label: 'walk', codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD'] };
const STEER: Hint = { id: 'steer', keys: ['A', 'D'], label: 'steer', codes: ['KeyA', 'KeyD'] };
const TRIM: Hint = { id: 'trim', keys: ['W', 'S'], label: 'trim sail', codes: ['KeyW', 'KeyS'] };
const LEAVE: Hint = { id: 'leave', keys: ['E'], label: 'let go', codes: ['KeyE'] };
const STARS: Hint = { id: 'stars', keys: ['C'], label: 'star chart', codes: ['KeyC'] };

export function controlsFor(c: ControlsCtx): { status: string; hints: Hint[] } {
  if (c.mode === 'chart') return { status: '', hints: [] };
  const sail = c.twaDeg < 38 ? 'In irons: the bow is in the wind. Bear away.'
    : c.luffing ? 'The sail is luffing. Sheet in.'
    : c.efficiency < 0.75 ? 'Over-sheeted. Ease the sail out.' : '';
  const lines: string[] = [];
  if (c.mode !== 'deck' && sail) lines.push(`<span class="warn">${sail}</span>`);
  if (c.navStatus) lines.push(c.navStatus);
  if (c.warp > 1.05) lines.push(`making way ≫ ×${c.warp.toFixed(1)}`);

  const hints: Hint[] = [];
  if (!c.mouseCaptured) hints.push({ id: 'capture', keys: ['Click'], label: 'to look around', sticky: true });
  if (c.mode === 'helm') hints.push(STEER, TRIM, STARS, LEAVE);
  else if (c.mode === 'mast') hints.push({ ...TRIM, label: 'sheet in / ease' }, LEAVE);
  else {
    if (c.nearStationLabel) hints.push({ id: 'use', keys: ['E'], label: c.nearStationLabel, sticky: true });
    hints.push(WALK);
  }
  hints.push(...c.navHints);
  return { status: lines.join('\n'), hints };
}
