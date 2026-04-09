// ui/toolbars/text-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render text layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderTextToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const font   = layer.font   ?? {};
  const shadow = layer.shadow ?? {};
  const { palette = {}, projectId = 'default' } = opts;

  const isLeft   = !font.align || font.align === 'left';
  const isCenter = font.align === 'center';
  const isRight  = font.align === 'right';
  const isItalic = font.style === 'italic';

  container.innerHTML = `
    <div class="tb-grid">

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Content</span>
        <textarea id="ctx-text-content" rows="3">${_esc(layer.content ?? '')}</textarea>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Size %</span>
        <input type="number" id="ctx-font-size" value="${font.size_pct ?? 5}" min="1" max="30" step="0.5">
      </div>
      <div class="ctrl tb-span-2">
        <span class="ctrl-label">Weight</span>
        <select id="ctx-font-weight">
          <option value="300"${font.weight === 300 ? ' selected' : ''}>Light</option>
          <option value="400"${(!font.weight || font.weight === 400) ? ' selected' : ''}>Regular</option>
          <option value="600"${font.weight === 600 ? ' selected' : ''}>SemiBold</option>
          <option value="700"${font.weight === 700 ? ' selected' : ''}>Bold</option>
        </select>
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Style</span>
        <button id="ctx-italic" class="btn${isItalic ? ' btn-active' : ''}" style="font-style:italic">I</button>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Align</span>
        <div class="tb-btn-group" id="ctx-align-group">
          <button class="btn${isLeft   ? ' btn-active' : ''}" data-align="left">Left</button>
          <button class="btn${isCenter ? ' btn-active' : ''}" data-align="center">Cntr</button>
          <button class="btn${isRight  ? ' btn-active' : ''}" data-align="right">Right</button>
        </div>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Line H</span>
        <input type="number" id="ctx-line-height" value="${font.line_height ?? 1.25}" min="0.8" max="3.0" step="0.05">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Spacing</span>
        <input type="number" id="ctx-letter-spacing" value="${font.letter_spacing_em ?? 0}" min="-0.1" max="0.5" step="0.01">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Max W %</span>
        <input type="number" id="ctx-max-width" value="${layer.max_width_pct ?? 80}" min="10" max="100" step="5">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Shadow</span>
        <button id="ctx-shadow" class="btn${shadow.enabled ? ' btn-active' : ''}">Shadow</button>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Color</span>
        <div id="ctx-color-picker-slot"></div>
      </div>

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  // Color picker
  container.querySelector('#ctx-color-picker-slot').appendChild(
    createColorPicker({
      value: font.color ?? '#ffffff',
      palette,
      projectId,
      onChange: color => layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, color } }),
    })
  );

  container.querySelector('#ctx-text-content').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { content: e.target.value });
  });

  container.querySelector('#ctx-font-size').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, size_pct: parseFloat(e.target.value) } });
  });

  container.querySelector('#ctx-font-weight').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, weight: parseInt(e.target.value, 10) } });
  });

  container.querySelector('#ctx-italic').addEventListener('click', e => {
    const next = layer.font?.style === 'italic' ? 'normal' : 'italic';
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, style: next } });
    e.currentTarget.classList.toggle('btn-active', next === 'italic');
  });

  container.querySelector('#ctx-align-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, align: btn.dataset.align } });
    container.querySelectorAll('#ctx-align-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  container.querySelector('#ctx-line-height').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, line_height: parseFloat(e.target.value) } });
  });

  container.querySelector('#ctx-letter-spacing').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, letter_spacing_em: parseFloat(e.target.value) } });
  });

  container.querySelector('#ctx-max-width').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { max_width_pct: parseInt(e.target.value, 10) });
  });

  container.querySelector('#ctx-shadow').addEventListener('click', e => {
    const enabled = !layer.shadow?.enabled;
    const newShadow = enabled
      ? { enabled: true, color: '#000000', blur_px: 8, offset_x: 2, offset_y: 2, opacity: 0.6 }
      : { ...(layer.shadow ?? {}), enabled: false };
    layerManager.updateLayer(frameIndex, layer.id, { shadow: newShadow });
    e.currentTarget.classList.toggle('btn-active', enabled);
  });

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
