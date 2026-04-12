// manager/brief-wizard.js
import { storage } from '../core/storage.js';
import { imageStore } from '../core/image-store.js';
import { PLATFORMS, TONES, slugify, autoLabel } from './constants.js';
import { ROLES } from './constants.js';
import { ThumbnailStrip } from './thumbnail-strip.js';

// ---------------------------------------------------------------------------
// Helper: read a FileList as data URLs
// ---------------------------------------------------------------------------
async function readFiles(fileList) {
  const results = await Promise.all(
    Array.from(fileList).map(
      file =>
        new Promise(resolve => {
          const reader = new FileReader();
          reader.onload  = e => resolve({ filename: file.name, label: autoLabel(file.name), dataUrl: e.target.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    )
  );
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------------
// BriefWizard
// ---------------------------------------------------------------------------
export class BriefWizard {
  /**
   * @param {HTMLElement} container — element to append the <dialog> to
   * @param {Function}    onSave   — called with the saved brief after storage.saveBrief()
   */
  constructor(container, onSave) {
    this._onSave  = onSave;
    this._step    = 1;
    this._data    = {};
    this._editId  = null;

    // Build dialog
    this._dialog = document.createElement('dialog');
    this._dialog.className = 'brief-wizard';
    this._dialog.innerHTML = `
      <div class="wizard-header">
        <span class="wizard-step-indicator">Step 1 of 5</span>
        <button class="wizard-close" aria-label="Close">&#x2715;</button>
      </div>
      <div class="wizard-strip-host" hidden></div>
      <div class="wizard-body"></div>
      <div class="wizard-footer">
        <button class="wizard-back">Back</button>
        <button class="wizard-next">Next</button>
      </div>
    `;
    container.appendChild(this._dialog);

    // Cache elements
    this._indicatorEl = this._dialog.querySelector('.wizard-step-indicator');
    this._bodyEl      = this._dialog.querySelector('.wizard-body');
    this._backBtn     = this._dialog.querySelector('.wizard-back');
    this._nextBtn     = this._dialog.querySelector('.wizard-next');
    this._closeBtn    = this._dialog.querySelector('.wizard-close');
    this._stripHostEl     = this._dialog.querySelector('.wizard-strip-host');
    this._annotating      = false;
    this._annotationIndex = 0;
    this._strip           = null;

    // Wire static buttons
    this._closeBtn.addEventListener('click', () => this._dialog.close());
    this._backBtn.addEventListener('click',  () => this._goBack());
    this._nextBtn.addEventListener('click',  () => this._goNext());
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Open wizard for a new brief. */
  open() {
    this._editId = null;
    this._data   = {};
    this._step   = 1;
    this._annotating      = false;
    this._annotationIndex = 0;
    this._strip           = null;
    this._stripHostEl.hidden = true;
    this._renderStep();
    this._dialog.showModal();
  }

  /**
   * Open wizard pre-populated for editing an existing brief.
   * @param {object} brief — full brief from storage.getBrief()
   */
  openEdit(brief) {
    this._editId = brief.id;
    this._data   = {
      id:         brief.id,
      title:      brief.title      ?? '',
      platform:   brief.platform   ?? '',
      story:      brief.story      ?? '',
      tone:       brief.tone       ?? '',
      imageMeta:  brief.imageMeta  ?? [],
      createdAt:  brief.createdAt  ?? Date.now(),
    };
    this._annotating      = false;
    this._annotationIndex = 0;
    this._strip           = null;
    this._stripHostEl.hidden = true;
    this._step = 1;
    this._renderStep();
    this._dialog.showModal();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  _goBack() {
    if (this._annotating) {
      if (this._annotationIndex > 0) {
        this._captureAnnotation();
        this._annotationIndex--;
        this._strip.select(this._annotationIndex);
        this._renderAnnotation();
      }
      return;
    }
    if (this._step <= 1) return;
    this._captureStep();   // save current field value without validating
    this._step -= 1;
    this._renderStep();
  }

  async _goNext() {
    // ── Annotation mode ──────────────────────────────────────────────────
    if (this._annotating) {
      this._captureAnnotation();

      if (this._annotationIndex < this._data.imageMeta.length - 1) {
        this._annotationIndex++;
        this._strip.select(this._annotationIndex);
        this._renderAnnotation();
      } else {
        // All images annotated — save
        this._nextBtn.disabled = true;
        try {
          await this._save();
        } catch (err) {
          const errorEl = document.createElement('div');
          errorEl.className = 'wizard-error';
          errorEl.textContent = `Save failed: ${err.message}`;
          this._bodyEl.appendChild(errorEl);
        } finally {
          this._nextBtn.disabled = false;
        }
      }
      return;
    }

    // ── Normal wizard steps ───────────────────────────────────────────────
    if (!this._validateStep()) return;
    this._captureStep();

    if (this._step === 5) {
      this._nextBtn.disabled = true;
      try {
        await this._transitionToAnnotation();
      } catch (err) {
        const errorEl = this._bodyEl.querySelector('.wizard-error');
        if (errorEl) { errorEl.textContent = `Error: ${err.message}`; errorEl.hidden = false; }
      } finally {
        this._nextBtn.disabled = false;
      }
    } else {
      this._step += 1;
      this._renderStep();
    }
  }

  // ── Step rendering ────────────────────────────────────────────────────────

  _renderStep() {
    if (this._annotating) {
      this._renderAnnotation();
      return;
    }
    this._indicatorEl.textContent = `Step ${this._step} of 5`;
    this._backBtn.hidden = (this._step === 1);
    this._nextBtn.textContent = 'Next';

    switch (this._step) {
      case 1: this._renderStep1(); break;
      case 2: this._renderStep2(); break;
      case 3: this._renderStep3(); break;
      case 4: this._renderStep4(); break;
      case 5: this._renderStep5(); break;
    }
  }

  _renderStep1() {
    const title = this._data.title ?? '';
    this._bodyEl.innerHTML = `
      <label class="wizard-label">Project Title</label>
      <input class="wizard-input" type="text" placeholder="e.g. Canyon Series 2026" value="${_escAttr(title)}">
      <div class="wizard-error" hidden></div>
    `;
    const input = this._bodyEl.querySelector('.wizard-input');
    const errorEl = this._bodyEl.querySelector('.wizard-error');
    input.addEventListener('input', () => this._clearError(errorEl));
    // Focus at end of existing value
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  _renderStep2() {
    const selected = this._data.platform ?? '';
    const radios = PLATFORMS.map(p => `
      <label class="wizard-radio-option">
        <input type="radio" name="platform" value="${_escAttr(p.id)}" ${p.id === selected ? 'checked' : ''}>
        ${_escHtml(p.label)}
      </label>
    `).join('');
    this._bodyEl.innerHTML = `
      <label class="wizard-label">Platform</label>
      <div class="wizard-radio-group">${radios}</div>
      <div class="wizard-error" hidden></div>
    `;
    const errorEl = this._bodyEl.querySelector('.wizard-error');
    this._bodyEl.querySelectorAll('input[type="radio"]').forEach(r =>
      r.addEventListener('change', () => this._clearError(errorEl))
    );
  }

  _renderStep3() {
    const story = this._data.story ?? '';
    this._bodyEl.innerHTML = `
      <label class="wizard-label">Story / Creative Brief</label>
      <textarea class="wizard-textarea" rows="6" placeholder="Describe the visual story, mood, or concept...">${_escHtml(story)}</textarea>
      <div class="wizard-error" hidden></div>
    `;
    const textarea = this._bodyEl.querySelector('.wizard-textarea');
    const errorEl  = this._bodyEl.querySelector('.wizard-error');
    textarea.addEventListener('input', () => this._clearError(errorEl));
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  _renderStep4() {
    const selected = this._data.tone ?? '';
    const radios = TONES.map(t => `
      <label class="wizard-radio-option">
        <input type="radio" name="tone" value="${_escAttr(t.id)}" ${t.id === selected ? 'checked' : ''}>
        ${_escHtml(t.label)}
      </label>
    `).join('');
    this._bodyEl.innerHTML = `
      <label class="wizard-label">Tone</label>
      <div class="wizard-radio-group">${radios}</div>
      <div class="wizard-error" hidden></div>
    `;
    const errorEl = this._bodyEl.querySelector('.wizard-error');
    this._bodyEl.querySelectorAll('input[type="radio"]').forEach(r =>
      r.addEventListener('change', () => this._clearError(errorEl))
    );
  }

  _renderStep5() {
    const existingCount = (this._data.imageMeta ?? []).length;
    const existingNote  = existingCount > 0
      ? `<p class="wizard-hint">${existingCount} image(s) already loaded. Selecting new files will replace them.</p>`
      : '';
    this._bodyEl.innerHTML = `
      <label class="wizard-label">Images (optional)</label>
      <p class="wizard-hint">Select the photos you want to include in this project.</p>
      ${existingNote}
      <input class="wizard-input" type="file" accept="image/*" multiple>
      <div class="wizard-error" hidden></div>
    `;
  }

  // ── Capture current step's value into this._data (no validation) ──────────

  _captureStep() {
    switch (this._step) {
      case 1: {
        const input = this._bodyEl.querySelector('.wizard-input');
        if (input) this._data.title = input.value;
        break;
      }
      case 2: {
        const checked = this._bodyEl.querySelector('input[name="platform"]:checked');
        if (checked) this._data.platform = checked.value;
        break;
      }
      case 3: {
        const textarea = this._bodyEl.querySelector('.wizard-textarea');
        if (textarea) this._data.story = textarea.value;
        break;
      }
      case 4: {
        const checked = this._bodyEl.querySelector('input[name="tone"]:checked');
        if (checked) this._data.tone = checked.value;
        break;
      }
      // Step 5 is captured async during _save()
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  _validateStep() {
    const errorEl = this._bodyEl.querySelector('.wizard-error');
    switch (this._step) {
      case 1: {
        const input = this._bodyEl.querySelector('.wizard-input');
        if (!input.value.trim()) {
          this._showError(errorEl, 'Project title is required.');
          return false;
        }
        break;
      }
      case 2: {
        const checked = this._bodyEl.querySelector('input[name="platform"]:checked');
        if (!checked) {
          this._showError(errorEl, 'Please select a platform.');
          return false;
        }
        break;
      }
      case 3: {
        const textarea = this._bodyEl.querySelector('.wizard-textarea');
        if (!textarea.value.trim()) {
          this._showError(errorEl, 'Story / creative brief is required.');
          return false;
        }
        break;
      }
      case 4: {
        const checked = this._bodyEl.querySelector('input[name="tone"]:checked');
        if (!checked) {
          this._showError(errorEl, 'Please select a tone.');
          return false;
        }
        break;
      }
      case 5:
        // Images are optional — no validation needed
        break;
    }
    return true;
  }

  // ── Annotation transition ──────────────────────────────────────────────────

  async _transitionToAnnotation() {
    const fileInput = this._bodyEl.querySelector('input[type="file"]');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      this._data.imageMeta = await readFiles(fileInput.files);
    }

    const images = this._data.imageMeta ?? [];
    if (images.length === 0) {
      // No images — save directly
      await this._save();
      return;
    }

    // Enter annotation mode
    this._annotating      = true;
    this._annotationIndex = 0;

    this._strip = new ThumbnailStrip(images, (i) => {
      this._captureAnnotation();
      this._annotationIndex = i;
      this._renderAnnotation();
    });

    this._stripHostEl.innerHTML = '';
    this._stripHostEl.appendChild(this._strip.el);
    this._stripHostEl.hidden = false;

    this._renderAnnotation();
  }

  _renderAnnotation() {
    const images = this._data.imageMeta ?? [];
    const total  = images.length;
    const entry  = images[this._annotationIndex] ?? {};
    const ann    = entry.annotation ?? {};

    this._indicatorEl.textContent = `Image ${this._annotationIndex + 1} of ${total}`;
    this._backBtn.hidden = (this._annotationIndex === 0);
    this._nextBtn.textContent = (this._annotationIndex === total - 1) ? 'Save' : 'Next';

    const roleOptions = ROLES.map(r =>
      `<option value="${r.id}" ${ann.role === r.id ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    this._bodyEl.innerHTML = `
      <div class="wizard-annotation-meta">${_escHtml(entry.filename ?? '')} · ${_escHtml(entry.label ?? '')}</div>
      ${entry.dataUrl
        ? `<img class="wizard-annotation-preview" src="${entry.dataUrl}" alt="${_escAttr(entry.label ?? '')}">`
        : ''}
      <div class="wizard-annotation-fields">
        <div class="wizard-annotation-row">
          <label class="wizard-annotation-label">Role
            <select class="ann-role">${roleOptions}</select>
          </label>
          <label class="wizard-annotation-silent">
            <input type="checkbox" class="ann-silent" ${ann.silent ? 'checked' : ''}>
            Silent (no text overlay)
          </label>
        </div>
        <label class="wizard-annotation-label">Notes
          <textarea class="wizard-textarea ann-notes" rows="2" placeholder="Why this image matters, photographer intent...">${_escHtml(ann.notes ?? '')}</textarea>
        </label>
        <label class="wizard-annotation-label">Story
          <textarea class="wizard-textarea ann-story" rows="2" placeholder="How/when captured, context...">${_escHtml(ann.story ?? '')}</textarea>
        </label>
        <label class="wizard-annotation-label">Stats
          <input type="text" class="wizard-input ann-stats" placeholder="Any data or numbers to feature..." value="${_escAttr(ann.stats ?? '')}">
        </label>
      </div>
    `;

    // Auto-check silent when role = 'silent'
    const roleEl   = this._bodyEl.querySelector('.ann-role');
    const silentEl = this._bodyEl.querySelector('.ann-silent');
    roleEl.addEventListener('change', () => {
      if (roleEl.value === 'silent') silentEl.checked = true;
    });
  }

  _captureAnnotation() {
    const images = this._data.imageMeta ?? [];
    const entry  = images[this._annotationIndex];
    if (!entry) return;

    entry.annotation = {
      role:   this._bodyEl.querySelector('.ann-role')?.value   ?? '',
      silent: this._bodyEl.querySelector('.ann-silent')?.checked ?? false,
      notes:  this._bodyEl.querySelector('.ann-notes')?.value  ?? '',
      story:  this._bodyEl.querySelector('.ann-story')?.value  ?? '',
      stats:  this._bodyEl.querySelector('.ann-stats')?.value  ?? '',
    };
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async _save() {
    // Read images from step 5 file input
    const fileInput = this._bodyEl.querySelector('input[type="file"]');
    let imageMeta;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      imageMeta = await readFiles(fileInput.files);
    } else {
      imageMeta = this._data.imageMeta ?? [];
    }

    // Resolve createdAt: preserve for edits, set now for new briefs
    let createdAt;
    if (this._editId) {
      const existing = storage.getBrief(this._editId);
      createdAt = (existing && existing.createdAt) ? existing.createdAt : Date.now();
    } else {
      createdAt = Date.now();
    }

    const brief = {
      id:        this._editId ?? `${slugify(this._data.title)}-${Date.now()}`,
      title:     this._data.title.trim(),
      platform:  this._data.platform,
      story:     this._data.story.trim(),
      tone:      this._data.tone,
      imageMeta: imageMeta,
      createdAt: createdAt,
    };

    storage.saveBrief(brief);

    // New brief: save empty project skeleton so the editor has something to restore.
    // Edit brief: never overwrite an existing project.
    if (!this._editId && !storage.getProject(brief.id)) {
      storage.saveProject(brief.id, {
        project:       { id: brief.id, title: brief.title },
        design_tokens: { palette: {} },
        export:        { width_px: 1080, height_px: 1350, format: 'png' },
        frames:        [],
        image_index:   [],
      });
    }

    // Persist images to IndexedDB (best-effort — brief is already saved above)
    if (imageMeta.length > 0) {
      const imageMap = {};
      imageMeta.forEach(m => { if (m.dataUrl) imageMap[m.filename] = m.dataUrl; });
      if (Object.keys(imageMap).length > 0) {
        await imageStore.save(brief.id, imageMap).catch(err => {
          console.warn('[BriefWizard] Image save to IndexedDB failed:', err);
        });
      }
    }

    this._dialog.close();
    this._onSave(brief);
  }

  // ── Error helpers ─────────────────────────────────────────────────────────

  _showError(errorEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  _clearError(errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Private escaping helpers (module-level, not exported)
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
