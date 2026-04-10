// ui/inspector.js
import { events }              from '../core/events.js';
import { renderTextToolbar }   from './toolbars/text-toolbar.js';
import { renderShapeToolbar }  from './toolbars/shape-toolbar.js';
import { renderImageToolbar }  from './toolbars/image-toolbar.js';
import { renderOverlayToolbar} from './toolbars/overlay-toolbar.js';
import { showMultiImageRevertModal } from './modals/multi-image-revert.js';

const DEFAULT_BORDER_WIDTH_PX = 4;

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
    events.addEventListener('layer:changed',   () => this._renderLayerSection());
    events.addEventListener('globals:changed', () => this._renderGlobalsSection());

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

      <div class="inspector-section" id="insp-canvas">
      </div>

      <div class="inspector-section" id="insp-layer-props">
      </div>

      <div class="inspector-section" id="insp-globals">
      </div>
    `;

    this._el.querySelector('#insp-pattern-select')?.addEventListener('change', e => {
      const frame = this._state.activeFrame;
      if (!frame) return;
      frame.composition_pattern = e.target.value;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });

    this._renderLayerSection();
    this._renderCanvasSection(frame);
    this._renderGlobalsSection();
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
    const opts = {
      palette:      this._state.project?.design_tokens?.palette ?? {},
      projectId:    this._state.project?.project?.id ?? 'default',
      frame:        this._state.activeFrame,
      images:       this._state.images,
      canvasWidth:  this._state.project?.export?.width_px  ?? 1080,
      canvasHeight: this._state.project?.export?.height_px ?? 1350,
      globals:      this._state.project?.globals ?? {},
    };
    switch (layer.type) {
      case 'text':    renderTextToolbar(controlsEl, layer, fi, this._lm, opts);    break;
      case 'shape':   renderShapeToolbar(controlsEl, layer, fi, this._lm, opts);   break;
      case 'image':
      case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm, opts);   break;
      case 'overlay': renderOverlayToolbar(controlsEl, layer, fi, this._lm, opts); break;
    }
  }

  /** Render the Canvas section: bg_color override + multi_image toggle. */
  _renderCanvasSection(frame) {
    const section = this._el.querySelector('#insp-canvas');
    if (!section) return;

    const projectBg = this._state.project?.design_tokens?.palette?.background ?? '#000000';
    const frameBg   = frame.bg_color ?? '';

    section.innerHTML = `
      <div class="inspector-section-title">Canvas</div>
      <div class="inspector-row">
        <span class="label">Background</span>
        <div style="display:flex;gap:4px;align-items:center;">
          <input type="color" id="insp-bg-color"
            value="${_esc(frameBg || projectBg)}"
            title="Frame background color (overrides project default)">
          <input type="text" id="insp-bg-hex"
            value="${_esc(frameBg)}"
            placeholder="${_esc(projectBg)}"
            maxlength="7"
            style="width:64px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
            title="Hex override — clear to use project default">
        </div>
      </div>
      <div class="inspector-row">
        <span class="label">Multi-image</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="insp-multi-image" ${frame.multi_image ? 'checked' : ''}>
          <span style="font-size:11px;color:var(--color-text-muted);">Stack image layers</span>
        </label>
      </div>
    `;

    // bg_color: color picker
    section.querySelector('#insp-bg-color').addEventListener('input', e => {
      const hex = e.target.value;
      frame.bg_color = hex;
      section.querySelector('#insp-bg-hex').value = hex;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });

    // bg_color: hex text field — clear = remove override
    section.querySelector('#insp-bg-hex').addEventListener('change', e => {
      const val = e.target.value.trim();
      if (!val) {
        delete frame.bg_color;
        section.querySelector('#insp-bg-color').value = projectBg;
        events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
      } else if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        frame.bg_color = val;
        section.querySelector('#insp-bg-color').value = val;
        events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
      } else {
        e.target.value = frame.bg_color ?? ''; // reset to last valid value
      }
    });

    // multi_image toggle
    section.querySelector('#insp-multi-image').addEventListener('change', e => {
      if (e.target.checked) {
        frame.multi_image = true;
        events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
      } else {
        // Toggle off — always show modal (see Task 7)
        e.target.checked = true; // revert checkbox until modal confirms
        this._onMultiImageToggleOff(frame);
      }
    });
  }

  /** Render the Project Settings section: border_width_px. */
  _renderGlobalsSection() {
    const section = this._el.querySelector('#insp-globals');
    if (!section) return;
    const project = this._state.project;
    if (!project) { section.innerHTML = ''; return; }

    const globals       = project.globals ?? {};
    const borderWidthPx = globals.border_width_px ?? DEFAULT_BORDER_WIDTH_PX;

    section.innerHTML = `
      <div class="inspector-section-title">Project Settings</div>
      <div class="inspector-row">
        <span class="label">Border width</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <input type="number" id="insp-border-width"
            value="${borderWidthPx}"
            min="0" step="1"
            style="width:52px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
            title="Border width in pixels — applied to all image layers with border enabled">
          <span style="font-size:11px;color:var(--color-text-muted);">px</span>
        </div>
      </div>
    `;

    section.querySelector('#insp-border-width').addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) {
        e.target.value = (project.globals?.border_width_px ?? DEFAULT_BORDER_WIDTH_PX);
        return;
      }
      if (!project.globals) project.globals = {};
      project.globals.border_width_px = val;
      events.dispatchEvent(new CustomEvent('globals:changed'));
    });
  }

  /** Show the revert modal when turning off multi_image. */
  _onMultiImageToggleOff(frame) {
    const imageLayers = (frame.layers ?? []).filter(l => l.type === 'image');

    // No image layers — toggle off silently
    if (!imageLayers.length) {
      frame.multi_image = false;
      const checkbox = this._el.querySelector('#insp-canvas #insp-multi-image');
      if (checkbox) checkbox.checked = false;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
      return;
    }

    showMultiImageRevertModal(
      imageLayers.map(l => ({ id: l.id, src: l.src })),
      (selectedId, deleteUnused) => {
        const selected = frame.layers.find(l => l.id === selectedId);
        if (!selected) return;

        // Promote selected layer to full-frame background
        selected.position   = { zone: 'absolute', x_pct: 0, y_pct: 0 };
        selected.width_pct  = 100;
        selected.height_pct = 100;
        selected.fit        = 'cover';

        // Update frame background references
        frame.image_filename = selected.src;
        const indexEntry = (this._state.project?.image_index ?? [])
          .find(i => i.filename === selected.src);
        if (indexEntry) frame.image_src = indexEntry.label;

        // Optionally delete unused image layers
        if (deleteUnused) {
          frame.layers = frame.layers.filter(l => l.type !== 'image' || l.id === selectedId);
        }

        frame.multi_image = false;
        const checkbox = this._el.querySelector('#insp-canvas #insp-multi-image');
        if (checkbox) checkbox.checked = false;
        events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
      }
    );
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
