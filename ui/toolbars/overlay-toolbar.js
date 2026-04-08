// ui/toolbars/overlay-toolbar.js

/**
 * Render overlay layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected overlay layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderOverlayToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');
  const isGradient = !!layer.gradient?.enabled;

  container.innerHTML = `
    <label>Opacity</label>
    <input type="number" id="ctx-ov-opacity" value="${Math.round((layer.opacity ?? 0.6) * 100)}" min="0" max="100" step="5" style="width:55px">
    <div class="toolbar-sep"></div>
    <label>Color</label>
    <input type="color" id="ctx-ov-color" value="${layer.color ?? '#000000'}" ${isGradient ? 'disabled' : ''}>
    <div class="toolbar-sep"></div>
    <label>Gradient</label>
    <input type="checkbox" id="ctx-ov-gradient" ${isGradient ? 'checked' : ''}>
  `;

  container.querySelector('#ctx-ov-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  container.querySelector('#ctx-ov-color').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { color: e.target.value });
  });

  container.querySelector('#ctx-ov-gradient').addEventListener('change', e => {
    const enabled = e.target.checked;
    layerManager.updateLayer(frameIndex, layer.id, {
      gradient: { ...layer.gradient, enabled },
    });
    container.querySelector('#ctx-ov-color').disabled = enabled;
  });
}
