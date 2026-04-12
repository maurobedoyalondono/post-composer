# Edit Brief Image Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the edit brief wizard so it always enters the annotation phase (with existing images loaded from IndexedDB), and adds an inline comparison screen when new files are selected alongside existing ones.

**Architecture:** All changes are in `manager/brief-wizard.js` and `styles/components.css`. The 16be227 bypass that skipped annotation in edit mode is removed. `_transitionToAnnotation()` gains two new code paths: (1) edit mode + no new files → hydrate `dataUrl` from IndexedDB, then enter annotation; (2) edit mode + new files + existing images → render an inline comparison screen with Keep/Replace buttons, which then enter annotation. The annotation entry logic is extracted into `_enterAnnotationMode()` to avoid repetition.

**Tech Stack:** Vanilla JS ES modules, IndexedDB via `imageStore`, `styles/components.css` CSS custom properties.

---

## File Map

| Action | File |
|--------|------|
| Modify | `manager/brief-wizard.js` — refactor `_transitionToAnnotation`, add `_enterAnnotationMode`, add `_renderImageComparison`, fix `_goNext` step-5 bypass, fix `_renderStep` button text |
| Modify | `styles/components.css` — append comparison screen styles |

---

## Task 1: Remove edit-mode bypass + fix button text

**Files:**
- Modify: `manager/brief-wizard.js`

The commit 16be227 added a bypass in `_goNext()` that made edit mode skip annotation and save directly. This is the root cause of annotations not persisting — the user could not enter the annotation phase to see or edit image notes. Remove it.

- [ ] **Step 1: Fix `_goNext()` — always call `_transitionToAnnotation()` at step 5**

In `_goNext()`, replace lines 161–174 (the `if (this._editId)` bypass):

```js
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
```

- [ ] **Step 2: Fix `_renderStep()` — step 5 always shows "Next"**

In `_renderStep()`, change line 190:

```js
    // BEFORE:
    this._nextBtn.textContent = (this._step === 5 && this._editId) ? 'Save' : 'Next';

    // AFTER:
    this._nextBtn.textContent = 'Next';
```

Step 5 always transitions to annotation (or comparison) — "Save" only appears on the last annotation image, which `_renderAnnotation()` already handles.

- [ ] **Step 3: Commit**

```bash
git add manager/brief-wizard.js
git commit -m "fix: always enter annotation phase from step 5; remove edit-mode save bypass"
```

---

## Task 2: Hydrate images from IndexedDB in edit mode + extract `_enterAnnotationMode()`

**Files:**
- Modify: `manager/brief-wizard.js`

When editing a brief with no new files selected, `this._data.imageMeta` has `{filename, label, annotation}` entries but no `dataUrl` — the thumbnails are blank in the annotation strip. Fix this by loading from IndexedDB before entering annotation mode. Also extract the annotation entry sequence into `_enterAnnotationMode()` so Task 3 can reuse it without duplication.

- [ ] **Step 1: Replace `_transitionToAnnotation()` with the new version**

Replace the entire `_transitionToAnnotation()` method (lines 356–384 in the current file):

```js
  async _transitionToAnnotation() {
    const fileInput = this._bodyEl.querySelector('input[type="file"]');
    const hasNewFiles = fileInput && fileInput.files && fileInput.files.length > 0;

    if (hasNewFiles) {
      const newImages = await readFiles(fileInput.files);
      const existing  = this._data.imageMeta ?? [];

      if (this._editId && existing.length > 0) {
        // Show comparison screen — user decides whether to replace
        this._renderImageComparison(existing, newImages);
        return;
      }
      // New brief or no existing images — use new files directly
      this._data.imageMeta = newImages;
    } else if (this._editId) {
      // Edit mode, no new files — hydrate dataUrls from IndexedDB
      const stored = await imageStore.load(this._editId);
      this._data.imageMeta = (this._data.imageMeta ?? []).map(m => ({
        ...m,
        dataUrl: stored[m.filename] ?? null,
      }));
    }

    await this._enterAnnotationMode();
  }
```

- [ ] **Step 2: Add `_enterAnnotationMode()` method after `_transitionToAnnotation()`**

```js
  async _enterAnnotationMode() {
    const images = this._data.imageMeta ?? [];
    if (images.length === 0) {
      await this._save();
      return;
    }

    this._annotating      = true;
    this._annotationIndex = 0;

    this._stripHostEl.innerHTML = '';
    this._strip = new ThumbnailStrip(images, (i) => {
      this._captureAnnotation();
      this._annotationIndex = i;
      this._renderAnnotation();
    });
    this._stripHostEl.appendChild(this._strip.el);
    this._stripHostEl.hidden = false;

    this._renderAnnotation();
  }
```

- [ ] **Step 3: Commit**

```bash
git add manager/brief-wizard.js
git commit -m "feat: hydrate image dataUrls from IndexedDB in edit mode; extract _enterAnnotationMode"
```

---

## Task 3: Add image comparison screen

**Files:**
- Modify: `manager/brief-wizard.js`
- Modify: `styles/components.css`

When the user selects new files in step 5 while editing a brief that already has images, show an inline comparison screen inside the wizard body. The screen shows existing filenames on the left and new filenames on the right, with Keep and Replace buttons. The footer Next button is hidden during this screen (the Keep/Replace buttons are the actions).

- [ ] **Step 1: Add `_renderImageComparison()` method after `_enterAnnotationMode()`**

```js
  _renderImageComparison(existingImages, newImages) {
    this._indicatorEl.textContent = 'Replace image set?';
    this._backBtn.hidden = true;
    this._nextBtn.hidden = true;

    const existingItems = existingImages
      .map(m => `<li class="wizard-comparison-item">${_escHtml(m.filename)}</li>`)
      .join('');
    const newItems = newImages
      .map(m => `<li class="wizard-comparison-item">${_escHtml(m.filename)}</li>`)
      .join('');

    this._bodyEl.innerHTML = `
      <div class="wizard-comparison">
        <div class="wizard-comparison-col">
          <div class="wizard-comparison-header">Existing (${existingImages.length})</div>
          <ul class="wizard-comparison-list">${existingItems}</ul>
        </div>
        <div class="wizard-comparison-col">
          <div class="wizard-comparison-header">New (${newImages.length})</div>
          <ul class="wizard-comparison-list">${newItems}</ul>
        </div>
      </div>
      <div class="wizard-comparison-actions">
        <button class="btn btn-secondary btn-keep-existing">Keep existing</button>
        <button class="btn btn-danger btn-replace-all">Replace all</button>
      </div>
    `;

    this._bodyEl.querySelector('.btn-keep-existing').addEventListener('click', async () => {
      this._nextBtn.hidden = false;
      this._backBtn.hidden = false;
      // Keep existing — load dataUrls from IndexedDB
      const stored = await imageStore.load(this._editId);
      this._data.imageMeta = (this._data.imageMeta ?? []).map(m => ({
        ...m,
        dataUrl: stored[m.filename] ?? null,
      }));
      await this._enterAnnotationMode();
    });

    this._bodyEl.querySelector('.btn-replace-all').addEventListener('click', async () => {
      this._nextBtn.hidden = false;
      this._backBtn.hidden = false;
      // Replace — use new images
      this._data.imageMeta = newImages;
      await this._enterAnnotationMode();
    });
  }
```

- [ ] **Step 2: Append comparison styles to `styles/components.css`**

Append to the end of the file:

```css
/* ── Wizard Image Comparison Screen ── */
.wizard-comparison {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
}

.wizard-comparison-col {
  flex: 1;
  min-width: 0;
}

.wizard-comparison-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.wizard-comparison-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}

.wizard-comparison-item {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wizard-comparison-item:last-child {
  border-bottom: none;
}

.wizard-comparison-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Commit**

```bash
git add manager/brief-wizard.js styles/components.css
git commit -m "feat: add image comparison screen when new files selected during edit"
```

---

## Manual smoke test

After all three tasks:

1. **Edit mode — no new files:** Open "Edit Brief" on a project with images. Navigate to step 5. Click Next. Verify thumbnail strip appears with images visible (not blank). Edit an annotation. Click Save on last image. Open "Manage Images" — verify annotations persisted.

2. **Edit mode — keep existing:** Open "Edit Brief". In step 5, select new image files. Click Next. Verify the comparison screen shows two columns. Click "Keep existing". Verify existing images appear in annotation strip with thumbnails.

3. **Edit mode — replace all:** Same as above, click "Replace all". Verify new images appear in annotation strip.

4. **New brief (unchanged):** Create a new project with images. Verify step 5 still says "Next" and transitions normally to annotation.
