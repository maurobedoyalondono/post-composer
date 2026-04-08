// ui/inspector.js
import { events }              from '../core/events.js';
import { renderTextToolbar }   from './toolbars/text-toolbar.js';
import { renderShapeToolbar }  from './toolbars/shape-toolbar.js';
import { renderImageToolbar }  from './toolbars/image-toolbar.js';
import { renderOverlayToolbar} from './toolbars/overlay-toolbar.js';

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

/**
 * Inspector panel — frame metadata, editable composition_pattern,
 * and selected layer controls (absorbs context toolbar).
 */
export class Inspector {
  /**
   * @param {HTMLElement} container — .editor-inspector element
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    events.addEventListener('project:loaded', () => this._render());
    events.addEventListener('frame:changed',  () => this._render());
    events.addEventListener('layer:selected', () => this._render());
    events.addEventListener('layer:deleted',  () => this._render());
    events.addEventListener('layer:changed',  () => this._renderLayerSection());

    // Plan 2c: listen for analysis:contrast to update WCAG badge
    events.addEventListener('analysis:contrast', e => {
      const badge = this._el.querySelector('#insp-wcag-badge');
      if (!badge) return;
      const { ratio, level } = e.detail;
      badge.textContent = level;
      badge.className = `wcag-badge wcag-${level.toLowerCase().replace(/ /g, '-')}`;
      badge.style.display = '';
    });
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>Load a project JSON<br>to get started.</p></div>`;
      return;
    }

    this._el.innerHTML = `
      <div class="inspector-section" id="insp-frame">
        <div class="inspector-section-title">Frame</div>
        <div class="inspector-row">
          <span class="label">ID</span>
          <span class="value" title="${_esc(frame.id)}">${_esc(frame.id)}</span>
        </div>
        ${frame.label ? `
        <div class="inspector-row">
          <span class="label">Label</span>
          <span class="value" title="${_esc(frame.label)}">${_esc(frame.label)}</span>
        </div>` : ''}
        <div class="inspector-row">
          <span class="label">Index</span>
          <span class="value">${this._state.activeFrameIndex + 1} / ${this._state.project.frames.length}</span>
        </div>
      </div>

      <div class="inspector-section" id="insp-composition">
        <div class="inspector-section-title">Composition</div>
        <div style="margin-bottom:6px;">
          <select id="insp-pattern-select" style="width:100%;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:4px 6px;">
            ${VALID_COMPOSITION_PATTERNS.map(p =>
              `<option value="${p}"${frame.composition_pattern === p ? ' selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="inspector-section" id="insp-layer-props">
      </div>
    `;

    this._el.querySelector('#insp-pattern-select')?.addEventListener('change', e => {
      const frame = this._state.activeFrame;
      if (!frame) return;
      frame.composition_pattern = e.target.value;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });

    this._renderLayerSection();
  }

  /** Re-render only the layer section — called on layer:changed to avoid full flicker. */
  _renderLayerSection() {
    const section = this._el.querySelector('#insp-layer-props');
    if (!section) return;

    const layerId = this._state.selectedLayerId;
    if (!layerId) {
      section.innerHTML = '<div class="editor-empty" style="padding:8px;font-size:11px;color:var(--color-text-muted);">Select a layer to edit</div>';
      return;
    }

    const frame = this._state.activeFrame;
    const layer = frame?.layers?.find(l => l.id === layerId);
    if (!layer) { section.innerHTML = ''; return; }

    const isText = layer.type === 'text';

    section.innerHTML = `
      <div class="inspector-section-title">
        <span class="layer-type-badge layer-type-${_esc(layer.type)}">${_esc(layer.type)}</span>
        <span style="color:var(--color-text-muted);font-family:var(--font-mono);font-size:9px;">${_esc(layer.id)}</span>
      </div>
      <div class="insp-layer-controls" id="insp-layer-controls"></div>
      <div class="inspector-row" style="margin-top:6px;">
        <span class="label">Zone</span>
        <span class="value">${_esc(layer.position?.zone ?? '—')}</span>
      </div>
      ${isText ? `
      <div class="inspector-row">
        <span class="label">WCAG</span>
        <span class="wcag-badge" id="insp-wcag-badge" style="display:none"></span>
      </div>` : ''}
    `;

    const controlsEl = section.querySelector('#insp-layer-controls');
    const fi = this._state.activeFrameIndex;
    switch (layer.type) {
      case 'text':    renderTextToolbar(controlsEl, layer, fi, this._lm);    break;
      case 'shape':   renderShapeToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'image':
      case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'overlay': renderOverlayToolbar(controlsEl, layer, fi, this._lm); break;
    }
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
