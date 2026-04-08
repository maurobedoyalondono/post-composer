// ui/inspector.js
import { events } from '../core/events.js';

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

/**
 * Inspector panel — frame metadata, editable composition_pattern,
 * and selected layer properties.
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
    events.addEventListener('layer:changed',  () => this._renderLayerSection());
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>Load a project JSON<br>to get started.</p></div>`;
      return;
    }

    const layerCount = frame.layers?.length ?? 0;

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

      <div class="inspector-section" id="insp-layers">
        <div class="inspector-section-title">Layers (${layerCount})</div>
        ${_layerSummary(frame.layers)}
      </div>

      <div class="inspector-section" id="insp-layer-props">
        ${this._layerPropsHTML()}
      </div>
    `;

    this._el.querySelector('#insp-pattern-select')?.addEventListener('change', e => {
      const frame = this._state.activeFrame;
      if (!frame) return;
      frame.composition_pattern = e.target.value;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });
  }

  /** Re-render only the layer properties section — called on layer:changed to avoid full flicker. */
  _renderLayerSection() {
    const section = this._el.querySelector('#insp-layer-props');
    if (section) section.innerHTML = this._layerPropsHTML();
  }

  _layerPropsHTML() {
    const layerId = this._state.selectedLayerId;
    if (!layerId) return '<div class="editor-empty" style="padding:8px;font-size:11px;color:var(--color-text-muted);">Click a layer to inspect</div>';

    const frame = this._state.activeFrame;
    const layer = frame?.layers?.find(l => l.id === layerId);
    if (!layer) return '';

    const rows = [
      ['Type',    layer.type],
      ['ID',      layer.id],
      ['Zone',    layer.position?.zone ?? '—'],
      ['Hidden',  layer.hidden ? 'yes' : 'no'],
    ];

    if (layer.type === 'text') {
      rows.push(
        ['Content',   (layer.content ?? '').slice(0, 40)],
        ['Size %',    layer.font?.size_pct ?? '—'],
        ['Weight',    layer.font?.weight ?? '—'],
        ['Color',     layer.font?.color ?? '—'],
      );
    } else if (layer.type === 'shape') {
      rows.push(
        ['Shape',     layer.shape ?? '—'],
        ['Role',      layer.role ?? '—'],
        ['Fill',      layer.fill ?? '—'],
        ['Stroke',    layer.stroke ?? '—'],
      );
    } else if (layer.type === 'overlay') {
      rows.push(
        ['Opacity',   layer.opacity ?? '—'],
        ['Gradient',  layer.gradient?.enabled ? 'yes' : 'no'],
      );
    } else if (layer.type === 'image' || layer.type === 'logo') {
      rows.push(
        ['Src',       (layer.src ?? '—').slice(0, 30)],
        ['Opacity',   layer.opacity ?? '—'],
      );
    }

    return `
      <div class="inspector-section-title">Selected Layer</div>
      ${rows.map(([label, value]) => `
        <div class="inspector-row">
          <span class="label">${label}</span>
          <span class="value" title="${_esc(String(value))}">${_esc(String(value))}</span>
        </div>
      `).join('')}
    `;
  }
}

function _layerSummary(layers) {
  if (!layers?.length) return '<div style="color:var(--color-text-muted);font-size:11px;">No layers</div>';
  return layers.map(l => `
    <div class="inspector-row" style="font-size:11px;">
      <span class="label" style="font-family:var(--font-mono)">${_esc(l.type)}</span>
      <span class="value" style="color:var(--color-text-muted)">${_esc(l.id)}</span>
    </div>
  `).join('');
}

/** Escape HTML special characters to prevent XSS from project data. */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
