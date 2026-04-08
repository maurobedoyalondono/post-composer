// editor/layer-manager.js
import { events } from '../core/events.js';

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
    if (!frame) return;
    const idx = frame.layers?.findIndex(l => l.id === layerId);
    if (idx == null || idx === -1) return;
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
}
