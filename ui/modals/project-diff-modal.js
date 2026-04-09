// ui/modals/project-diff-modal.js

/**
 * Show the frame diff/merge modal.
 *
 * @param {{ modified: object[], added: object[], removed: object[], unchanged: object[] }} diff
 * @param {(selections: { replaceFrameIds: Set<string>, addFrameIds: Set<string> }) => void} onApply
 */
export function showProjectDiffModal(diff, onApply) {
  const { modified, added, removed, unchanged } = diff;
  const totalChanges = modified.length + added.length;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.7)',
    'display:flex', 'align-items:flex-start', 'justify-content:center',
    'padding:32px 16px', 'overflow-y:auto',
  ].join(';');

  const modal = document.createElement('div');
  modal.style.cssText = [
    'background:var(--color-surface)', 'border:1px solid var(--color-border)',
    'border-radius:var(--radius-md)', 'padding:20px',
    'min-width:360px', 'max-width:560px', 'width:100%',
    'color:var(--color-text)', 'font-family:var(--font-sans)', 'font-size:13px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  // Build rows for each category
  const modifiedRows = modified.map(({ frameId, label, changes }) => {
    const changeList = changes.map(c => {
      if (c.field === 'layer:added')    return `<li>Incoming adds layer: ${_esc(c.type)} <span style="opacity:0.6;">(${_esc(c.layerId)})</span></li>`;
      if (c.field === 'layer:removed')  return `<li>Incoming removes layer: ${_esc(c.type)} <span style="opacity:0.6;">(${_esc(c.layerId)})</span></li>`;
      if (c.field === 'layer:modified') return `<li>Incoming modifies layer: ${_esc(c.type)} <span style="opacity:0.6;">(${_esc(c.layerId)})</span></li>`;
      const from = c.from != null ? String(c.from) : '—';
      const to   = c.to   != null ? String(c.to)   : '—';
      return `<li>${_esc(c.field)}: ${_esc(from)} (current) → ${_esc(to)} (incoming)</li>`;
    }).join('');
    return `
      <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">
        <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">
          <input type="checkbox" data-action="replace" data-id="${_esc(frameId)}" style="margin-top:3px;">
          <span>
            <strong>${_esc(label)}</strong>
            <span style="color:var(--color-text-muted);font-size:11px;margin-left:6px;">replace with incoming</span>
            <ul style="margin:4px 0 0 12px;padding:0;font-size:11px;color:var(--color-text-muted);">${changeList}</ul>
          </span>
        </label>
      </div>`;
  }).join('');

  const addedRows = added.map(({ frame }) => `
    <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" data-action="add" data-id="${_esc(frame.id)}" checked>
        <span>
          <strong>${_esc(frame.label ?? frame.id)}</strong>
          <span style="color:var(--color-text-muted);font-size:11px;margin-left:6px;">new frame — add to project</span>
        </span>
      </label>
    </div>`).join('');

  const removedRows = removed.length > 0 ? `
    <div style="margin-top:12px;">
      <div style="font-size:11px;font-weight:600;color:var(--color-text-muted);margin-bottom:4px;">IN CURRENT PROJECT ONLY (not in file — kept as-is)</div>
      ${removed.map(({ frame }) => `
        <div style="padding:4px 0;font-size:12px;color:var(--color-text-muted);">${_esc(frame.label ?? frame.id)}</div>
      `).join('')}
    </div>` : '';

  const unchangedNote = unchanged.length > 0
    ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:8px;">${unchanged.length} unchanged frame(s) not shown.</div>`
    : '';

  const noDiffsMsg = totalChanges === 0
    ? `<div style="padding:16px 0;color:var(--color-text-muted);">No differences found between the file and the current project.</div>`
    : '';

  modal.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Merge incoming JSON</div>
    ${totalChanges > 0 ? `<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:12px;">Check a frame to replace your current version with the incoming one. Unchecked frames are left untouched.</div>` : ''}
    ${noDiffsMsg}
    ${totalChanges > 0 ? `<div style="font-size:11px;font-weight:600;color:var(--color-text-muted);margin-bottom:6px;">MODIFIED FRAMES</div>` : ''}
    ${modifiedRows}
    ${added.length > 0 ? `<div style="font-size:11px;font-weight:600;color:var(--color-text-muted);margin:10px 0 6px;">NEW FRAMES</div>` : ''}
    ${addedRows}
    ${removedRows}
    ${unchangedNote}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
      <button id="diff-cancel" class="btn">Cancel</button>
      ${totalChanges > 0 ? `<button id="diff-apply" class="btn btn-primary">Apply selected</button>` : ''}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const dismiss = () => overlay.remove();

  modal.querySelector('#diff-cancel').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

  const applyBtn = modal.querySelector('#diff-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const replaceFrameIds = new Set();
      const addFrameIds     = new Set();
      modal.querySelectorAll('input[data-action="replace"]:checked').forEach(cb => replaceFrameIds.add(cb.dataset.id));
      modal.querySelectorAll('input[data-action="add"]:checked').forEach(cb => addFrameIds.add(cb.dataset.id));
      overlay.remove();
      onApply({ replaceFrameIds, addFrameIds });
    });
  }
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
