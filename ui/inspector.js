// ui/inspector.js
import { events } from '../core/events.js';

/**
 * Inspector panel — displays metadata for the currently active frame.
 */
export class Inspector {
  /**
   * @param {HTMLElement} container — .editor-inspector element
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, state) {
    this._el    = container;
    this._state = state;

    events.addEventListener('project:loaded', () => this._render());
    events.addEventListener('frame:changed',  () => this._render());
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>No frame selected</p></div>`;
      return;
    }

    const layerCount = frame.layers?.length ?? 0;

    this._el.innerHTML = `
      <div class="inspector-section">
        <div class="inspector-section-title">Frame</div>
        <div class="inspector-row">
          <span class="label">ID</span>
          <span class="value" title="${frame.id}">${frame.id}</span>
        </div>
        ${frame.label ? `
        <div class="inspector-row">
          <span class="label">Label</span>
          <span class="value" title="${frame.label}">${frame.label}</span>
        </div>` : ''}
        <div class="inspector-row">
          <span class="label">Index</span>
          <span class="value">${this._state.activeFrameIndex + 1} / ${this._state.project.frames.length}</span>
        </div>
      </div>
      <div class="inspector-section">
        <div class="inspector-section-title">Composition</div>
        <div style="margin-bottom:8px;">
          <span class="pattern-badge">${frame.composition_pattern}</span>
        </div>
      </div>
      <div class="inspector-section">
        <div class="inspector-section-title">Layers</div>
        <div class="inspector-row">
          <span class="label">Count</span>
          <span class="value">${layerCount}</span>
        </div>
        ${_layerList(frame.layers)}
      </div>
    `;
  }
}

function _layerList(layers) {
  if (!layers?.length) return '<div style="color:var(--color-text-muted);font-size:11px;">No layers</div>';
  return layers.map(l => `
    <div class="inspector-row" style="font-size:11px;">
      <span class="label" style="font-family:var(--font-mono)">${l.type}</span>
      <span class="value" style="color:var(--color-text-muted)">${l.id}</span>
    </div>
  `).join('');
}
