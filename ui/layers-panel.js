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

    // Display layers in reverse order: visually "top" layer first
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

    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.addEventListener('click', () => this._lm.selectLayer(item.dataset.id));

      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.idx);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx   = parseInt(item.dataset.idx, 10);
        if (fromIdx !== toIdx) {
          this._lm.reorderLayer(this._state.activeFrameIndex, fromIdx, toIdx);
        }
      });
    });

    this._el.querySelectorAll('.vis-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._lm.toggleVisibility(this._state.activeFrameIndex, btn.dataset.id);
      });
    });

    this._el.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._lm.deleteLayer(this._state.activeFrameIndex, btn.dataset.id);
      });
    });
  }

  /** Update active highlight without full re-render — called on layer:selected. */
  _syncActive() {
    const selectedId = this._state.selectedLayerId;
    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === selectedId);
    });
  }
}
