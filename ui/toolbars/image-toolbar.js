// ui/toolbars/image-toolbar.js

import { createColorPicker } from '../color-picker.js';

/**
 * Render image/logo layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string, frame: object, images: Map,
 *           canvasWidth: number, canvasHeight: number }} opts
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit       = layer.fit ?? 'fill';
  const showSize  = !!(opts.frame?.multi_image);
  const widthPct  = layer.width_pct  ?? 100;
  const heightPct = layer.height_pct ?? 100;
  const rotDeg    = layer.rotation_deg ?? 0;

  const cw = opts.canvasWidth  ?? 1080;
  const ch = opts.canvasHeight ?? 1350;

  const img          = opts.images?.get(layer.src);
  const naturalRatio = (img && img.naturalWidth > 0) ? img.naturalWidth / img.naturalHeight : null;
  const storedRatio  = layer.aspect_ratio ?? null;
  const activeRatio  = naturalRatio ?? storedRatio;
  const ratioKnown   = naturalRatio != null;

  const borderEnabled = layer.border?.enabled ?? false;
  const borderColor   = layer.border?.color   ?? '#ffffff';

  container.innerHTML = `
    <div class="tb-grid">

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Fit</span>
        <div class="tb-btn-group" id="ctx-fit-group">
          <button class="btn${fit === 'cover'   ? ' btn-active' : ''}" data-fit="cover"   title="Fill bounds, crop excess">Cover</button>
          <button class="btn${fit === 'contain' ? ' btn-active' : ''}" data-fit="contain" title="Fit within bounds">Contain</button>
          <button class="btn${fit === 'fill'    ? ' btn-active' : ''}" data-fit="fill"    title="Stretch to exact size">Fill</button>
        </div>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Opacity %</span>
        <input type="number" id="ctx-img-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5">
      </div>

      ${showSize ? `
      <div class="ctrl">
        <span class="ctrl-label">Width %</span>
        <input type="number" id="ctx-img-width" value="${widthPct.toFixed(1)}" min="1" max="200" step="1">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Height %</span>
        <input type="number" id="ctx-img-height" value="${heightPct.toFixed(1)}" min="1" max="200" step="1" readonly
          style="opacity:0.6;cursor:default;"
          title="Locked to aspect ratio — edit Width to resize">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Aspect ratio</span>
        <input type="number" id="ctx-img-ratio"
          value="${activeRatio != null ? activeRatio.toFixed(4) : ''}"
          placeholder="e.g. 1.7778"
          min="0.1" max="20" step="0.0001"
          ${ratioKnown
            ? 'readonly style="opacity:0.6;cursor:default;" title="Auto-detected from image (width ÷ height in pixels)"'
            : 'title="Width ÷ height in pixels — define manually (e.g. 1.7778 for 16:9)"'}>
      </div>
      ` : ''}

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Rotation</span>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <button id="ctx-rot-ccw"   class="btn" title="Rotate 90° left">↺ 90°</button>
          <button id="ctx-rot-cw"    class="btn" title="Rotate 90° right">↻ 90°</button>
          <button id="ctx-rot-180"   class="btn" title="Rotate 180°">180°</button>
          <button id="ctx-rot-reset" class="btn" title="Reset to 0°">⊘</button>
          <input type="number" id="ctx-rotation" value="${rotDeg.toFixed(1)}"
            step="1"
            style="width:64px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
            title="Rotation in degrees (positive = clockwise)">
        </div>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Border</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="ctx-border-toggle" class="btn${borderEnabled ? ' btn-active' : ''}"
            title="${borderEnabled ? 'Border enabled — click to disable' : 'Border disabled — click to enable'}">
            ${borderEnabled ? '● On' : '○ Off'}
          </button>
          <div id="ctx-border-color-swatch"
            style="width:20px;height:20px;border-radius:3px;border:1px solid var(--color-border);
                   background:${borderColor};cursor:pointer;flex-shrink:0;
                   ${borderEnabled ? '' : 'opacity:0.35;pointer-events:none;'}"
            title="Border color">
          </div>
        </div>
      </div>
      <div id="ctx-border-color-picker" style="display:none;"></div>

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  // ── Fit ────────────────────────────────────────────────────────────────
  container.querySelector('#ctx-fit-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-fit]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { fit: btn.dataset.fit });
    container.querySelectorAll('#ctx-fit-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  // ── Opacity ────────────────────────────────────────────────────────────
  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  // ── Size controls (multi_image only) ────────────────────────────────────
  if (showSize) {
    if (!ratioKnown) {
      container.querySelector('#ctx-img-ratio').addEventListener('change', e => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          layerManager.updateLayer(frameIndex, layer.id, { aspect_ratio: val });
          layer.aspect_ratio = val;
        }
      });
    }

    container.querySelector('#ctx-img-width').addEventListener('change', e => {
      const newWidthPct = parseFloat(e.target.value);
      if (isNaN(newWidthPct) || newWidthPct < 1) return;
      const ratio = naturalRatio ?? layer.aspect_ratio ?? null;
      const newHeightPct = ratio != null ? newWidthPct * cw / (ratio * ch) : newWidthPct;
      layerManager.updateLayer(frameIndex, layer.id, { width_pct: newWidthPct, height_pct: newHeightPct });
      const heightInput = container.querySelector('#ctx-img-height');
      if (heightInput) heightInput.value = newHeightPct.toFixed(1);
    });
  }

  // ── Rotation presets ───────────────────────────────────────────────────
  container.querySelector('#ctx-rot-ccw').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: ((cur - 90) % 360 + 360) % 360 });
  });
  container.querySelector('#ctx-rot-cw').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: (cur + 90) % 360 });
  });
  container.querySelector('#ctx-rot-180').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: (cur + 180) % 360 });
  });
  container.querySelector('#ctx-rot-reset').addEventListener('click', () => {
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: 0 });
  });

  // ── Rotation numeric input ─────────────────────────────────────────────
  const rotInput = container.querySelector('#ctx-rotation');
  rotInput.addEventListener('change', e => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: val });
  });
  rotInput.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const cur  = parseFloat(e.target.value) || 0;
    const step = e.shiftKey ? 10 : 1;
    const next = e.key === 'ArrowUp' ? cur + step : cur - step;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: next });
    e.target.value = next.toFixed(1);
  });

  // ── Border toggle ──────────────────────────────────────────────────────
  container.querySelector('#ctx-border-toggle').addEventListener('click', () => {
    const newEnabled = !(layer.border?.enabled ?? false);
    layerManager.updateLayer(frameIndex, layer.id, {
      border: { ...(layer.border ?? { color: '#ffffff' }), enabled: newEnabled },
    });
  });

  // ── Border color picker ────────────────────────────────────────────────
  const swatch        = container.querySelector('#ctx-border-color-swatch');
  const pickerEl      = container.querySelector('#ctx-border-color-picker');
  let pickerOpen      = false;

  swatch.addEventListener('click', () => {
    if (!pickerOpen) {
      const picker = createColorPicker({
        value:     layer.border?.color ?? '#ffffff',
        palette:   opts.palette   ?? {},
        projectId: opts.projectId ?? 'default',
        onChange:  (color) => {
          layerManager.updateLayer(frameIndex, layer.id, {
            border: { ...(layer.border ?? { enabled: false }), color },
          });
        },
      });
      pickerEl.innerHTML = '';
      pickerEl.appendChild(picker);
      pickerEl.style.display = 'block';
      pickerOpen = true;
    } else {
      pickerEl.style.display = 'none';
      pickerOpen = false;
    }
  });

  // ── Copy / Paste / Delete ─────────────────────────────────────────────
  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
