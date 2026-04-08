// ui/toolbars/shape-toolbar.js

/**
 * Render shape layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected shape layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderShapeToolbar(container, layer, frameIndex, layerManager) {
  container.innerHTML = `
    <label>Fill</label>
    <input type="color" id="ctx-shape-fill" value="${layer.fill ?? '#6366f1'}">
    <div class="toolbar-sep"></div>
    <label>Stroke</label>
    <input type="color" id="ctx-shape-stroke" value="${layer.stroke ?? '#ffffff'}">
    <div class="toolbar-sep"></div>
    <label>Stroke W</label>
    <input type="number" id="ctx-shape-stroke-w" value="${layer.stroke_width ?? 1}" min="0" max="20" step="1" style="width:55px">
    <div class="toolbar-sep"></div>
    <label>Opacity</label>
    <input type="number" id="ctx-shape-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:55px">
  `;

  container.querySelector('#ctx-shape-fill').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { fill: e.target.value });
  });

  container.querySelector('#ctx-shape-stroke').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke: e.target.value });
  });

  container.querySelector('#ctx-shape-stroke-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke_width: parseFloat(e.target.value) });
  });

  container.querySelector('#ctx-shape-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
}
