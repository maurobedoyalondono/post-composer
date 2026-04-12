// manager/image-annotator.js
import { storage }    from '../core/storage.js';
import { imageStore } from '../core/image-store.js';
import { ROLES }      from './constants.js';
import { ThumbnailStrip } from './thumbnail-strip.js';

/**
 * Modal panel for editing per-image annotations after a project is created.
 * Opened via the "Manage Images" button on a project card.
 * Changes persist to storage on every field change (auto-save).
 */
export class ImageAnnotator {
  /** @param {HTMLElement} container — element to append the <dialog> to */
  constructor(container) {
    this._briefId      = null;
    this._imageMeta    = [];
    this._currentIndex = 0;
    this._strip        = null;

    this._dialog = document.createElement('dialog');
    this._dialog.className = 'image-annotator';
    this._dialog.innerHTML = `
      <div class="annotator-header">
        <span class="annotator-title">Manage Images</span>
        <button class="annotator-close" aria-label="Close">&#x2715;</button>
      </div>
      <div class="annotator-strip-host"></div>
      <div class="annotator-body"></div>
    `;
    container.appendChild(this._dialog);

    this._titleEl    = this._dialog.querySelector('.annotator-title');
    this._stripHost  = this._dialog.querySelector('.annotator-strip-host');
    this._bodyEl     = this._dialog.querySelector('.annotator-body');

    this._dialog.querySelector('.annotator-close')
      .addEventListener('click', () => this._dialog.close());
  }

  /**
   * Open the panel for a given project.
   * @param {string} briefId
   */
  async open(briefId) {
    if (this._dialog.open) return;
    this._briefId = briefId;
    const brief   = storage.getBrief(briefId);
    if (!brief || !brief.imageMeta || brief.imageMeta.length === 0) return;

    this._titleEl.textContent = `Manage Images — ${brief.title}`;

    const stored = await imageStore.load(briefId);
    this._imageMeta = brief.imageMeta.map(m => ({
      ...m,
      dataUrl: stored[m.filename] ?? null,
    }));

    this._currentIndex = 0;

    this._stripHost.innerHTML = '';
    this._strip = new ThumbnailStrip(this._imageMeta, (i) => {
      this._saveCurrentAnnotation();
      this._currentIndex = i;
      this._render();
    });
    this._stripHost.appendChild(this._strip.el);

    this._render();
    this._dialog.showModal();
  }

  _render() {
    const entry = this._imageMeta[this._currentIndex];
    if (!entry) return;

    const ann = entry.annotation ?? {};
    const roleOptions = ROLES.map(r =>
      `<option value="${_escAttr(r.id)}" ${ann.role === r.id ? 'selected' : ''}>${_escHtml(r.label)}</option>`
    ).join('');

    this._bodyEl.innerHTML = `
      <div class="annotator-image-meta">${_escHtml(entry.filename ?? '')} · ${_escHtml(entry.label ?? '')}</div>
      ${entry.dataUrl
        ? `<img class="annotator-preview" src="${entry.dataUrl}" alt="${_escAttr(entry.label ?? '')}">`
        : '<div class="annotator-no-preview">No preview available</div>'}
      <div class="annotator-fields">
        <div class="annotator-row">
          <label class="annotator-field-label">Role
            <select class="ann-role">${roleOptions}</select>
          </label>
          <label class="annotator-silent-label">
            <input type="checkbox" class="ann-silent" ${ann.silent ? 'checked' : ''}>
            Silent (no text overlay)
          </label>
        </div>
        <label class="annotator-field-label">Notes
          <textarea class="annotator-textarea ann-notes" rows="3" placeholder="Why this image matters, photographer intent...">${_escHtml(ann.notes ?? '')}</textarea>
        </label>
        <label class="annotator-field-label">Story
          <textarea class="annotator-textarea ann-story" rows="3" placeholder="How/when captured, context...">${_escHtml(ann.story ?? '')}</textarea>
        </label>
        <label class="annotator-field-label">Stats
          <input type="text" class="annotator-input ann-stats" placeholder="Any data or numbers to feature..." value="${_escAttr(ann.stats ?? '')}">
        </label>
      </div>
    `;

    const roleEl   = this._bodyEl.querySelector('.ann-role');
    const silentEl = this._bodyEl.querySelector('.ann-silent');

    roleEl.addEventListener('change', () => {
      if (roleEl.value === 'silent') silentEl.checked = true;
      this._saveCurrentAnnotation();
    });

    silentEl.addEventListener('change', () => this._saveCurrentAnnotation());

    this._bodyEl.querySelectorAll('.ann-notes, .ann-story, .ann-stats').forEach(el => {
      el.addEventListener('change', () => this._saveCurrentAnnotation());
    });
  }

  _saveCurrentAnnotation() {
    const entry = this._imageMeta[this._currentIndex];
    if (!entry) return;

    entry.annotation = {
      role:   this._bodyEl.querySelector('.ann-role')?.value   ?? '',
      silent: this._bodyEl.querySelector('.ann-silent')?.checked ?? false,
      notes:  this._bodyEl.querySelector('.ann-notes')?.value  ?? '',
      story:  this._bodyEl.querySelector('.ann-story')?.value  ?? '',
      stats:  this._bodyEl.querySelector('.ann-stats')?.value  ?? '',
    };

    const brief = storage.getBrief(this._briefId);
    if (!brief) return;

    // Strip dataUrl before saving to localStorage
    brief.imageMeta = this._imageMeta.map(({ dataUrl: _omit, ...rest }) => rest);
    storage.saveBrief(brief);
  }
}

// ---------------------------------------------------------------------------
// Private escaping helpers (same as brief-wizard.js)
// ---------------------------------------------------------------------------
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _escAttr(str) {
  return _escHtml(str);
}
