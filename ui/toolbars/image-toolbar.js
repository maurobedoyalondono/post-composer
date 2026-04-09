// ui/toolbars/image-toolbar.js

/**
 * Render image/logo layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit = layer.fit ?? 'fill';

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

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  container.querySelector('#ctx-fit-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-fit]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { fit: btn.dataset.fit });
    container.querySelectorAll('#ctx-fit-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
