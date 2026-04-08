// ui/toolbars/image-toolbar.js

/**
 * Render image / logo layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected image or logo layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');

  container.innerHTML = `
    <label>Opacity</label>
    <input type="number" id="ctx-img-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:55px">
  `;

  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
}
