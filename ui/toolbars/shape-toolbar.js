// ui/toolbars/shape-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render shape layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderShapeToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const { palette = {}, projectId = 'default' } = opts;

  container.innerHTML = `
    <div class="tb-grid">

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Fill</span>
        <div id="ctx-fill-picker-slot"></div>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Stroke</span>
        <div id="ctx-stroke-picker-slot"></div>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Opacity %</span>
        <input type="number" id="ctx-shape-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Stroke W</span>
        <input type="number" id="ctx-shape-stroke-w" value="${layer.stroke_width ?? 0}" min="0" max="20" step="1">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">W %</span>
        <input type="number" id="ctx-shape-w" value="${layer.width_pct ?? 20}" min="1" max="100" step="1">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">H %</span>
        <input type="number" id="ctx-shape-h" value="${layer.height_pct ?? 5}" min="1" max="100" step="1">
      </div>

      <div class="ctrl tb-span-2">
        <span class="ctrl-label">Snap</span>
        <div class="tb-btn-group">
          <button id="ctx-full-w" class="btn" title="Full width">↔ W</button>
          <button id="ctx-full-h" class="btn" title="Full height">↕ H</button>
        </div>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Align</span>
        <div class="tb-btn-group" id="ctx-align-group">
          <button class="btn" data-align="left"     title="Left">⬅</button>
          <button class="btn" data-align="right"    title="Right">➡</button>
          <button class="btn" data-align="top"      title="Top">⬆</button>
          <button class="btn" data-align="bottom"   title="Bottom">⬇</button>
          <button class="btn" data-align="center-h" title="Center H">⊟H</button>
          <button class="btn" data-align="center-v" title="Center V">⊟V</button>
        </div>
      </div>

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  container.querySelector('#ctx-fill-picker-slot').appendChild(
    createColorPicker({
      value: layer.fill ?? '#6366f1',
      palette,
      projectId,
      onChange: color => layerManager.updateLayer(frameIndex, layer.id, { fill: color }),
    })
  );

  container.querySelector('#ctx-stroke-picker-slot').appendChild(
    createColorPicker({
      value: layer.stroke ?? '#ffffff',
      palette,
      projectId,
      onChange: color => layerManager.updateLayer(frameIndex, layer.id, { stroke: color }),
    })
  );

  container.querySelector('#ctx-shape-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
  container.querySelector('#ctx-shape-stroke-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke_width: parseFloat(e.target.value) });
  });
  container.querySelector('#ctx-shape-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { width_pct: parseFloat(e.target.value) });
  });
  container.querySelector('#ctx-shape-h').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { height_pct: parseFloat(e.target.value) });
  });

  container.querySelector('#ctx-full-w').addEventListener('click', () => {
    const pos = layer.position?.zone === 'absolute'
      ? { ...layer.position, x_pct: 0 }
      : { ...layer.position, offset_x_pct: 0 };
    layerManager.updateLayer(frameIndex, layer.id, { width_pct: 100, position: pos });
  });
  container.querySelector('#ctx-full-h').addEventListener('click', () => {
    const pos = layer.position?.zone === 'absolute'
      ? { ...layer.position, y_pct: 0 }
      : { ...layer.position, offset_y_pct: 0 };
    layerManager.updateLayer(frameIndex, layer.id, { height_pct: 100, position: pos });
  });

  container.querySelector('#ctx-align-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    const wPct = layer.width_pct  ?? 20;
    const hPct = layer.height_pct ??  5;
    let x_pct = layer.position?.x_pct ?? 0;
    let y_pct = layer.position?.y_pct ?? 0;
    switch (btn.dataset.align) {
      case 'left':     x_pct = 0; break;
      case 'right':    x_pct = 100 - wPct; break;
      case 'top':      y_pct = 0; break;
      case 'bottom':   y_pct = 100 - hPct; break;
      case 'center-h': x_pct = (100 - wPct) / 2; break;
      case 'center-v': y_pct = (100 - hPct) / 2; break;
    }
    layerManager.updateLayer(frameIndex, layer.id, { position: { zone: 'absolute', x_pct, y_pct } });
  });

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
