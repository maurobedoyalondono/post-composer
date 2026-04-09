// ui/modals/multi-image-revert.js

/**
 * Show a modal asking the user to choose which image becomes the background
 * when turning off multi_image mode.
 *
 * Always shown — even with a single image — because images in multi mode
 * may not be sized for full-bleed.
 *
 * @param {Array<{id: string, src: string}>} imageLayers — current image layers
 * @param {(selectedId: string, deleteUnused: boolean) => void} onConfirm
 */
export function showMultiImageRevertModal(imageLayers, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.6)',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');

  const modal = document.createElement('div');
  modal.style.cssText = [
    'background:var(--color-surface)', 'border:1px solid var(--color-border)',
    'border-radius:var(--radius-md)', 'padding:20px',
    'min-width:320px', 'max-width:480px', 'width:90%',
    'color:var(--color-text)', 'font-family:var(--font-sans)', 'font-size:13px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');
  modal.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Choose background image</div>
    <div>
      <p style="margin:0 0 10px;font-size:12px;color:var(--color-text-muted);">
        Select which image becomes the full-frame background.<br>
        It will be resized to fill the canvas.
      </p>
      <div id="modal-img-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
        ${imageLayers.map((l, i) => `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 6px;border-radius:var(--radius-sm);background:var(--color-surface-2);">
            <input type="radio" name="modal-bg-img" value="${_escAttr(l.id)}" ${i === 0 ? 'checked' : ''}>
            <span style="font-size:12px;font-family:var(--font-mono);">${_escHtml(l.src)}</span>
          </label>
        `).join('')}
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="modal-delete-unused">
        Delete unused image layers
      </label>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
      <button id="modal-cancel" class="btn">Cancel</button>
      <button id="modal-confirm" class="btn btn-primary">Confirm</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const dismiss = () => overlay.remove();

  modal.querySelector('#modal-cancel').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

  modal.querySelector('#modal-confirm').addEventListener('click', () => {
    const selectedId   = modal.querySelector('input[name="modal-bg-img"]:checked')?.value;
    const deleteUnused = modal.querySelector('#modal-delete-unused').checked;
    if (selectedId) {
      overlay.remove();
      onConfirm(selectedId, deleteUnused);
    }
  });
}

function _escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
