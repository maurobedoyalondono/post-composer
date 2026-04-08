// ui/toolbars/text-toolbar.js

/**
 * Render text layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected text layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderTextToolbar(container, layer, frameIndex, layerManager) {
  const font = layer.font ?? {};

  container.innerHTML = `
    <label>Size %</label>
    <input type="number" id="ctx-font-size" value="${font.size_pct ?? 5}" min="1" max="30" step="0.5" style="width:60px">
    <div class="toolbar-sep"></div>
    <label>Weight</label>
    <select id="ctx-font-weight">
      <option value="300"${font.weight === 300 ? ' selected' : ''}>Light</option>
      <option value="400"${(!font.weight || font.weight === 400) ? ' selected' : ''}>Regular</option>
      <option value="600"${font.weight === 600 ? ' selected' : ''}>Semi-bold</option>
      <option value="700"${font.weight === 700 ? ' selected' : ''}>Bold</option>
    </select>
    <div class="toolbar-sep"></div>
    <label>Align</label>
    <select id="ctx-font-align">
      <option value="left"${(!font.align || font.align === 'left') ? ' selected' : ''}>Left</option>
      <option value="center"${font.align === 'center' ? ' selected' : ''}>Center</option>
      <option value="right"${font.align === 'right' ? ' selected' : ''}>Right</option>
    </select>
    <div class="toolbar-sep"></div>
    <label>Color</label>
    <input type="color" id="ctx-font-color" value="${font.color ?? '#ffffff'}">
  `;

  container.querySelector('#ctx-font-size').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, size_pct: parseFloat(e.target.value) } });
  });

  container.querySelector('#ctx-font-weight').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, weight: parseInt(e.target.value, 10) } });
  });

  container.querySelector('#ctx-font-align').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, align: e.target.value } });
  });

  container.querySelector('#ctx-font-color').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, color: e.target.value } });
  });
}
