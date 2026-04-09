// ui/toolbars/image-toolbar.js

/**
 * Render image/logo layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string, frame: object, images: Map }} opts
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit      = layer.fit ?? 'fill';
  const showSize = !!(opts.frame?.multi_image);
  const widthPct  = layer.width_pct  ?? 100;
  const heightPct = layer.height_pct ?? 100;

  // Determine aspect ratio: natural image dimensions > stored layer ratio > unknown
  const img         = opts.images?.get(layer.src);
  const naturalRatio = (img && img.naturalWidth > 0) ? img.naturalWidth / img.naturalHeight : null;
  const storedRatio  = layer.aspect_ratio ?? null;
  const activeRatio  = naturalRatio ?? storedRatio;  // what we use for width→height math
  const ratioKnown   = naturalRatio != null;         // true = auto-detected, no editable field needed

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
        <input type="number" id="ctx-img-height" value="${heightPct.toFixed(1)}" min="1" max="200" step="1" readonly style="opacity:0.6;cursor:default;" title="Locked to aspect ratio — edit Width to resize">
      </div>
      ${!ratioKnown ? `
      <div class="ctrl">
        <span class="ctrl-label">Aspect ratio</span>
        <input type="number" id="ctx-img-ratio"
          value="${storedRatio != null ? storedRatio.toFixed(4) : ''}"
          placeholder="e.g. 1.7778"
          min="0.1" max="10" step="0.0001"
          title="Width ÷ Height — set manually when image dimensions are unavailable">
      </div>
      ` : ''}
      ` : ''}

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

  if (showSize) {
    // Aspect ratio manual input (shown only when natural dimensions unavailable)
    const ratioInput = container.querySelector('#ctx-img-ratio');
    if (ratioInput) {
      ratioInput.addEventListener('change', e => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          layerManager.updateLayer(frameIndex, layer.id, { aspect_ratio: val });
          layer.aspect_ratio = val; // keep in-scope reference current
        }
      });
    }

    container.querySelector('#ctx-img-width').addEventListener('change', e => {
      const newWidthPct = parseFloat(e.target.value);
      if (isNaN(newWidthPct) || newWidthPct < 1) return;

      // Use natural ratio, then stored ratio, then 1:1 fallback
      const ratio = naturalRatio ?? layer.aspect_ratio ?? null;
      const newHeightPct = ratio != null ? newWidthPct / ratio : newWidthPct;

      layerManager.updateLayer(frameIndex, layer.id, {
        width_pct:  newWidthPct,
        height_pct: newHeightPct,
      });

      // Update the read-only height display
      const heightInput = container.querySelector('#ctx-img-height');
      if (heightInput) heightInput.value = newHeightPct.toFixed(1);
    });
  }

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
