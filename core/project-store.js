// core/project-store.js
import { storage } from './storage.js';
import { events }  from './events.js';

const SAVE_DELAY_MS = 500;

/**
 * Auto-save coordinator.
 * Listens for change events, debounces writes to localStorage.
 * Dispatches:
 *   project:save-status  { status: 'pending'|'saved'|'failed', time?: number }
 *   project:save-failed  { reason: 'quota'|'error' }
 */
export class ProjectStore {
  /**
   * @param {import('./state.js').AppState} state
   */
  constructor(state) {
    this._state = state;
    this._timer = null;

    for (const ev of ['layer:changed', 'frame:changed', 'layers:reordered', 'layer:deleted']) {
      events.addEventListener(ev, () => this._schedule());
    }
  }

  /** Schedule a debounced write. */
  _schedule() {
    if (!this._state.project || !this._state.activeBriefId) return;
    clearTimeout(this._timer);
    events.dispatchEvent(new CustomEvent('project:save-status', { detail: { status: 'pending' } }));
    this._timer = setTimeout(() => this._write(), SAVE_DELAY_MS);
  }

  /** Perform the actual write synchronously. */
  _write() {
    this._timer = null;
    if (!this._state.project || !this._state.activeBriefId) return;
    try {
      storage.saveProject(this._state.activeBriefId, this._state.project);
      const brief = storage.getBrief(this._state.activeBriefId);
      if (brief) storage.saveBrief(brief); // stamps updatedAt
      events.dispatchEvent(new CustomEvent('project:save-status', {
        detail: { status: 'saved', time: Date.now() },
      }));
    } catch (e) {
      const reason = (e.name === 'QuotaExceededError') ? 'quota' : 'error';
      events.dispatchEvent(new CustomEvent('project:save-failed', { detail: { reason } }));
      events.dispatchEvent(new CustomEvent('project:save-status', { detail: { status: 'failed' } }));
    }
  }

  /**
   * Force an immediate write, bypassing the debounce timer.
   * Call before navigation to guarantee no work is lost.
   */
  flush() {
    clearTimeout(this._timer);
    this._write();
  }
}
