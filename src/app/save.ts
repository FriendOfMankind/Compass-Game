// localStorage save (one slot). Every access is wrapped: private windows, blocked storage and
// previews can throw or return nothing, and the game must still run.
import { parseProgress, type Progress } from '../sim/progression';

const KEY = 'dead-reckoning-save-v1';

export function loadProgress(): Progress | null {
  try { return parseProgress(localStorage.getItem(KEY)); } catch { return null; }
}

export function saveProgress(p: Progress): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* no storage: play on, unsaved */ }
}

export function clearProgress(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
