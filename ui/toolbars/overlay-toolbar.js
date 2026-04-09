// ui/toolbars/overlay-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render overlay layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderOverlayToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const { palette = {}, projectId = 'default' } = opts;
  const isGradient = !!layer.gradient?.enabled;
  const grad = layer.gradient ?? {};
  const dir  = grad.direction ?? 'to-bottom';

  container.innerHTML = `
    <div class="tb-grid">

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Color</span>
        <div id="ctx-ov-color-slot"></div>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Opacity %</span>
        <input type="number" id="ctx-ov-opacity" value="${Math.round((layer.opacity ?? 0.6) * 100)}" min="0" max="100" step="5">
      </div>
      <div class="ctrl tb-span-3">
        <span class="ctrl-label">Blend</span>
        <select id="ctx-ov-blend">
          <option value="normal"${(layer.blend_mode ?? 'normal') === 'normal' ? ' selected' : ''}>Normal</option>
          <option value="multiply"${layer.blend_mode === 'multiply' ? ' selected' : ''}>Multiply</option>
          <option value="screen"${layer.blend_mode === 'screen' ? ' selected' : ''}>Screen</option>
          <option value="overlay"${layer.blend_mode === 'overlay' ? ' selected' : ''}>Overlay</option>
          <option value="soft-light"${layer.blend_mode === 'soft-light' ? ' selected' : ''}>Soft Light</option>
        </select>
      </div>

      <div class="ctrl tb-span-${isGradient ? '1' : '4'}">
        <span class="ctrl-label">Gradient</span>
        <input type="checkbox" id="ctx-ov-gradient" ${isGradient ? 'checked' : ''}>
      </div>
      ${isGradient ? `
      <div class="ctrl tb-span-3">
        <span class="ctrl-label">Direction</span>
        <div class="tb-btn-group" id="ctx-grad-dir">
          <button class="btn${dir === 'to-bottom' ? ' btn-active' : ''}" data-dir="to-bottom" title="Top → Bottom">↓</button>
          <button class="btn${dir === 'to-top'    ? ' btn-active' : ''}" data-dir="to-top"    title="Bottom → Top">↑</button>
          <button class="btn${dir === 'to-right'  ? ' btn-active' : ''}" data-dir="to-right"  title="Left → Right">→</button>
          <button class="btn${dir === 'to-left'   ? ' btn-active' : ''}" data-dir="to-left"   title="Right → Left">←</button>
        </div>
      </div>

      <div class="ctrl tb-span-2">
        <span class="ctrl-label">Start opacity</span>
        <input type="range" id="ctx-grad-from-op" min="0" max="100" value="${grad.from_opacity ?? 0}" style="width:100%">
      </div>
      <div class="ctrl tb-span-2">
        <span class="ctrl-label">End opacity</span>
        <input type="range" id="ctx-grad-to-op" min="0" max="100" value="${grad.to_opacity ?? 100}" style="width:100%">
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Start pos %</span>
        <input type="number" id="ctx-grad-from-pos" value="${grad.from_pos ?? 0}" min="0" max="100" step="5">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">End pos %</span>
        <input type="number" id="ctx-grad-to-pos" value="${grad.to_pos ?? 100}" min="0" max="100" step="5">
      </div>
      ` : ''}

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  const colorPicker = createColorPicker({
    value: layer.color ?? '#000000',
    palette,
    projectId,
    onChange: color => layerManager.updateLayer(frameIndex, layer.id, { color }),
  });
  if (isGradient) colorPicker.style.opacity = '0.4';
  container.querySelector('#ctx-ov-color-slot').appendChild(colorPicker);

  container.querySelector('#ctx-ov-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  container.querySelector('#ctx-ov-blend').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { blend_mode: e.target.value });
  });

  container.querySelector('#ctx-ov-gradient').addEventListener('change', e => {
    const enabled = e.target.checked;
    const newGrad = enabled
      ? { enabled: true, direction: 'to-bottom', from_opacity: 0, from_pos: 0, to_opacity: 100, to_pos: 100,
          stops: [{ at: 0, color: _hexToRgba(layer.color ?? '#000000', 0) }, { at: 1, color: _hexToRgba(layer.color ?? '#000000', 1) }] }
      : { ...(layer.gradient ?? {}), enabled: false };
    layerManager.updateLayer(frameIndex, layer.id, { gradient: newGrad });
    renderOverlayToolbar(container, { ...layer, gradient: newGrad }, frameIndex, layerManager, opts);
  });

  container.querySelector('#ctx-grad-dir')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { gradient: { ...layer.gradient, direction: btn.dataset.dir } });
    container.querySelectorAll('#ctx-grad-dir .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  const _updateStops = () => {
    const fromOp  = parseInt(container.querySelector('#ctx-grad-from-op')?.value ?? '0',   10) / 100;
    const toOp    = parseInt(container.querySelector('#ctx-grad-to-op')?.value   ?? '100', 10) / 100;
    const fromPos = parseInt(container.querySelector('#ctx-grad-from-pos')?.value ?? '0',  10) / 100;
    const toPos   = parseInt(container.querySelector('#ctx-grad-to-pos')?.value   ?? '100',10) / 100;
    const color   = layer.color ?? '#000000';
    layerManager.updateLayer(frameIndex, layer.id, {
      gradient: {
        ...layer.gradient,
        from_opacity: fromOp * 100, from_pos: fromPos * 100,
        to_opacity:   toOp   * 100, to_pos:   toPos   * 100,
        stops: [
          { at: fromPos, color: _hexToRgba(color, fromOp) },
          { at: toPos,   color: _hexToRgba(color, toOp)   },
        ],
      },
    });
  };

  container.querySelector('#ctx-grad-from-op')?.addEventListener('input',  _updateStops);
  container.querySelector('#ctx-grad-to-op')?.addEventListener('input',    _updateStops);
  container.querySelector('#ctx-grad-from-pos')?.addEventListener('change', _updateStops);
  container.querySelector('#ctx-grad-to-pos')?.addEventListener('change',   _updateStops);

  container.querySelector('#ctx-copy').addEventListener('click', () => layerManager.copyLayer(frameIndex, layer.id));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}

function _hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
