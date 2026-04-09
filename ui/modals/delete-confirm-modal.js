// ui/modals/delete-confirm-modal.js

/**
 * Show a delete confirmation modal.
 * @param {{ title: string, frameCount: number, imageCount: number, updatedAt: number }} info
 * @param {() => void} onConfirm
 */
export function showDeleteConfirmModal(info, onConfirm) {
  const { title, frameCount, imageCount, updatedAt } = info;
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown';

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
    'min-width:300px', 'max-width:420px', 'width:90%',
    'color:var(--color-text)', 'font-family:var(--font-sans)', 'font-size:13px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  modal.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Delete project?</div>
    <div style="background:var(--color-surface-2);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px;font-size:12px;">
      <div style="font-weight:600;margin-bottom:6px;">${_esc(title)}</div>
      <div style="color:var(--color-text-muted);">${frameCount} ${frameCount === 1 ? 'frame' : 'frames'} &middot; ${imageCount} ${imageCount === 1 ? 'image' : 'images'} &middot; Last saved ${_esc(dateStr)}</div>
    </div>
    <div style="font-size:12px;color:#f87171;margin-bottom:16px;">This cannot be undone.</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="del-cancel" class="btn">Cancel</button>
      <button id="del-confirm" class="btn btn-danger" style="background:#dc2626;color:#fff;border-color:#dc2626;">Delete</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const dismiss = () => overlay.remove();

  modal.querySelector('#del-cancel').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
  modal.querySelector('#del-confirm').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
