// ui/layers-panel.js
import { events } from '../core/events.js';

/**
 * Floating layer list panel.
 * Shows layers for the active frame in reverse render order (top layer first).
 * Supports: click-to-select, visibility toggle, delete, drag-to-reorder.
 */
export class LayersPanel {
  /**
   * @param {HTMLElement} container — the .layers-panel element
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    for (const ev of ['project:loaded', 'frame:changed', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
      events.addEventListener(ev, () => this._render());
    }
    events.addEventListener('layer:selected', () => this._syncActive());

    // Event delegation — one listener per event type, wired once
    this._el.addEventListener('click', e => this._onClick(e));
    this._el.addEventListener('dragstart', e => this._onDragStart(e));
    this._el.addEventListener('dragover', e => e.preventDefault());
    this._el.addEventListener('drop', e => this._onDrop(e));
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame?.layers?.length) {
      this._el.innerHTML = `
        <div class="layers-panel-header">Layers</div>
        <div class="layers-panel-empty">No layers</div>
      `;
      return;
    }

    const layers = [...frame.layers].reverse();
    const selectedId = this._state.selectedLayerId;

    this._el.innerHTML = `
      <div class="layers-panel-header">Layers</div>
      <ul class="layers-list">
        ${layers.map((l, visIdx) => {
          const realIdx = frame.layers.length - 1 - visIdx;
          return `<li class="layer-item${l.id === selectedId ? ' active' : ''}"
                      data-id="${l.id}" data-idx="${realIdx}" draggable="true">
            <button class="vis-btn${l.hidden ? ' hidden' : ''}" data-id="${l.id}" title="Toggle visibility">👁</button>
            <span class="layer-type">${l.type}</span>
            <span class="layer-id" title="${l.id}">${l.id}</span>
            <button class="del-btn" data-id="${l.id}" title="Delete layer">✕</button>
          </li>`;
        }).join('')}
      </ul>
    `;
    // No per-item event listeners — delegation handles it all
  }

  _onClick(e) {
    const delBtn = e.target.closest('.del-btn');
    if (delBtn) {
      this._lm.deleteLayer(this._state.activeFrameIndex, delBtn.dataset.id);
      return;
    }
    const visBtn = e.target.closest('.vis-btn');
    if (visBtn) {
      this._lm.toggleVisibility(this._state.activeFrameIndex, visBtn.dataset.id);
      return;
    }
    const item = e.target.closest('.layer-item');
    if (item) {
      this._lm.selectLayer(item.dataset.id);
    }
  }

  _onDragStart(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;
    e.dataTransfer.setData('text/plain', item.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  _onDrop(e) {
    e.preventDefault();
    const item = e.target.closest('.layer-item');
    if (!item) return;
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIdx   = parseInt(item.dataset.idx, 10);
    if (fromIdx !== toIdx) {
      this._lm.reorderLayer(this._state.activeFrameIndex, fromIdx, toIdx);
    }
  }

  _syncActive() {
    const selectedId = this._state.selectedLayerId;
    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === selectedId);
    });
  }
}
