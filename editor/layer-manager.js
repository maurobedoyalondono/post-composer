// editor/layer-manager.js
import { events } from '../core/events.js';

/** Module-level clipboard for layer copy/paste. */
let _clipboard = null;

/**
 * Manages layer CRUD and selection for the active project.
 * All mutations go through here so the event bus stays consistent.
 */
export class LayerManager {
  /** @param {import('../core/state.js').AppState} state */
  constructor(state) {
    this._state = state;
  }

  /**
   * Select a layer by id, or pass null to deselect.
   * Emits: layer:selected
   */
  selectLayer(id) {
    this._state.setSelectedLayer(id ?? null);
    events.dispatchEvent(new CustomEvent('layer:selected', { detail: { id: id ?? null } }));
  }

  /**
   * Merge patch into a layer's properties.
   * Emits: layer:changed
   */
  updateLayer(frameIndex, layerId, patch) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    Object.assign(layer, patch);
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }

  /**
   * Delete a layer. If it was selected, clears selectedLayerId.
   * Emits: layer:deleted
   */
  deleteLayer(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame?.layers) return;
    const idx = frame.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;
    frame.layers.splice(idx, 1);
    if (this._state.selectedLayerId === layerId) {
      this._state.setSelectedLayer(null);
    }
    events.dispatchEvent(new CustomEvent('layer:deleted', { detail: { frameIndex, layerId } }));
  }

  /**
   * Toggle a layer's hidden flag.
   * Emits: layer:changed
   */
  toggleVisibility(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    layer.hidden = !layer.hidden;
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }

  /**
   * Move a layer from fromIdx to toIdx within a frame's layers array.
   * Emits: layers:reordered
   */
  reorderLayer(frameIndex, fromIdx, toIdx) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame?.layers) return;
    if (fromIdx < 0 || fromIdx >= frame.layers.length) return;
    if (toIdx < 0 || toIdx > frame.layers.length) return;
    const [removed] = frame.layers.splice(fromIdx, 1);
    frame.layers.splice(toIdx, 0, removed);
    events.dispatchEvent(new CustomEvent('layers:reordered', { detail: { frameIndex } }));
  }

  /**
   * Emit layer:changed without mutating — used by DragResize after a drag
   * where the position was mutated directly for performance.
   */
  emitChanged(frameIndex, layerId) {
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }

  // ── Copy / Paste ───────────────────────────────────────────────────────

  /**
   * Deep-clone a layer into the module-level clipboard.
   * Silent — no event emitted.
   */
  copyLayer(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    _clipboard = JSON.parse(JSON.stringify(layer));
  }

  /**
   * Paste the clipboard layer into a frame.
   * Assigns a new id and offsets position by +2% so paste is visible.
   * Emits: layer:changed
   */
  pasteLayer(frameIndex) {
    if (!_clipboard) return;
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const clone = JSON.parse(JSON.stringify(_clipboard));
    clone.id = `${_clipboard.id}-copy-${Date.now()}`;
    if (clone.position && clone.position.zone !== 'absolute') {
      clone.position.offset_x_pct = (clone.position.offset_x_pct ?? 0) + 2;
      clone.position.offset_y_pct = (clone.position.offset_y_pct ?? 0) + 2;
    } else if (clone.position?.zone === 'absolute') {
      clone.position.x_pct = (clone.position.x_pct ?? 0) + 2;
      clone.position.y_pct = (clone.position.y_pct ?? 0) + 2;
    }
    frame.layers = frame.layers ?? [];
    frame.layers.push(clone);
    this.selectLayer(clone.id);
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId: clone.id } }));
  }

  /** Returns true when the clipboard has a layer ready to paste. */
  hasClipboard() {
    return !!_clipboard;
  }
}
