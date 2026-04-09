# Image Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editor-loaded images durable across page reloads and tab restores by storing them in localStorage keyed per brief (`pc_images_{briefId}`), and remove the fragile sessionStorage layer.

**Architecture:** Add `saveImages`, `loadImages`, `deleteImages` to `core/storage.js`. Update `_applyActiveBrief` in `editor/shell.js` to merge images from both the brief's `imageMeta` and `pc_images_{briefId}`. Save images to localStorage immediately after loading via "Load Images" button. Remove all sessionStorage helpers.

**Tech Stack:** Vanilla JS ES modules, localStorage, `FileReader` / `HTMLImageElement`.

---

## File Structure

| File | Change |
|------|--------|
| `core/storage.js` | Add `saveImages`, `loadImages`, `deleteImages`; extend `deleteBrief` |
| `editor/shell.js` | Update `_applyActiveBrief`; add localStorage save on image load; remove sessionStorage |

---

### Task 1: Add image storage functions to `core/storage.js`

**Files:**
- Modify: `core/storage.js`

**Context:** `core/storage.js` already has `saveBrief`, `getBrief`, `deleteBrief` and uses localStorage. Images will be stored at key `pc_images_{briefId}` as a JSON object `{ [filename]: dataURL }`.

- [ ] **Step 1: Read current end of `core/storage.js`**

Open `core/storage.js`. The file currently ends after `_readBriefIndex()`. The last few lines are:
```js
  _readBriefIndex() {
    const raw = localStorage.getItem(KEYS.briefIndex);
    return raw ? JSON.parse(raw) : [];
  },
};
```

- [ ] **Step 2: Add image key to KEYS and add the three functions**

After the `KEYS` object, add `images: id => \`pc_images_\${id}\`` to the KEYS constant, then add the three functions before the closing `};` of the `storage` export.

Replace the KEYS block at the top of `core/storage.js`:
```js
const KEYS = {
  index: 'pc_projects_index',
  project: id => `pc_project_${id}`,
  prefs: 'pc_prefs',
  briefIndex: 'pc_briefs',
  brief: id => `pc_brief_${id}`,
  images: id => `pc_images_${id}`,
};
```

Then, before the closing `};` of the `storage` export object, add:

```js
  // ── Image storage (per brief) ──────────────────────────────────────────

  /**
   * Load all stored images for a brief.
   * @param {string} briefId
   * @returns {{ [filename: string]: string }} filename → dataURL
   */
  loadImages(briefId) {
    try {
      const raw = localStorage.getItem(KEYS.images(briefId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Merge new images into localStorage for a brief.
   * @param {string} briefId
   * @param {{ [filename: string]: string }} imageMap — filename → dataURL
   * @returns {string[]} filenames that could not be saved due to quota
   */
  saveImages(briefId, imageMap) {
    const existing = this.loadImages(briefId);
    const merged   = { ...existing, ...imageMap };
    try {
      localStorage.setItem(KEYS.images(briefId), JSON.stringify(merged));
      return [];
    } catch {
      // Quota hit — try saving each image individually
      const failed = [];
      let saved = { ...existing };
      for (const [filename, dataURL] of Object.entries(imageMap)) {
        try {
          saved[filename] = dataURL;
          localStorage.setItem(KEYS.images(briefId), JSON.stringify(saved));
        } catch {
          delete saved[filename];
          failed.push(filename);
        }
      }
      return failed;
    }
  },

  /**
   * Remove all stored images for a brief (call when brief is deleted).
   * @param {string} briefId
   */
  deleteImages(briefId) {
    localStorage.removeItem(KEYS.images(briefId));
  },
```

- [ ] **Step 3: Extend `deleteBrief` to also delete images**

Find the `deleteBrief` function in `core/storage.js`:
```js
  deleteBrief(id) {
    localStorage.removeItem(KEYS.brief(id));
    const index = this._readBriefIndex().filter(b => b.id !== id);
    localStorage.setItem(KEYS.briefIndex, JSON.stringify(index));
  },
```

Replace with:
```js
  deleteBrief(id) {
    localStorage.removeItem(KEYS.brief(id));
    this.deleteImages(id);
    const index = this._readBriefIndex().filter(b => b.id !== id);
    localStorage.setItem(KEYS.briefIndex, JSON.stringify(index));
  },
```

- [ ] **Step 4: Verify storage functions exist**

Open browser console on the app page and run:
```js
// Should return {} (empty) for a non-existent brief
storage.loadImages('test-id');

// Should save and return the data
storage.saveImages('test-id', { 'foo.jpg': 'data:image/jpeg;base64,abc' });
storage.loadImages('test-id'); // → { 'foo.jpg': '...' }

storage.deleteImages('test-id');
storage.loadImages('test-id'); // → {}
```

Expected: no errors, correct round-trip.

- [ ] **Step 5: Commit**

```bash
git add core/storage.js
git commit -m "feat: add per-brief image storage (saveImages/loadImages/deleteImages) to storage.js"
```

---

### Task 2: Update `editor/shell.js` — durable image loading and remove sessionStorage

**Files:**
- Modify: `editor/shell.js`

**Context:** `editor/shell.js` currently has:
- `_applyActiveBrief()` — loads brief images but only when `state.project === null` (partially fixed in a previous session, but still incomplete)
- `_saveSession`, `_loadSession`, `_clearSession` — sessionStorage helpers to remove
- A session restore IIFE — to remove
- `imgInput.change` handler — needs to save images to localStorage after loading

- [ ] **Step 1: Remove all sessionStorage helpers and callers**

In `editor/shell.js`, delete:
1. The three helper functions at the bottom of the file:
   ```js
   const _SESSION_KEY = 'pc_editor_session';
   function _saveSession(state) { ... }
   function _loadSession() { ... }
   function _clearSession() { ... }
   ```
2. The session restore IIFE:
   ```js
   (async () => {
     const saved = _loadSession();
     ...
   })();
   ```
3. All calls to `_saveSession(state)` — there are calls in the `drop` event handler and in the event listener loop:
   ```js
   for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', ...]) {
     events.addEventListener(ev, () => _saveSession(state));
   }
   ```
   and
   ```js
   _saveSession(state);  // in the canvas drop handler
   ```

- [ ] **Step 2: Update `_applyActiveBrief` to always load images from both sources**

Replace the current `_applyActiveBrief` function with:

```js
async function _applyActiveBrief() {
  if (!state.activeBriefId) return;
  const brief = storage.getBrief(state.activeBriefId);
  if (!brief) return;

  // Update header only when no project is loaded yet
  if (!state.project) {
    nameEl.textContent = `${brief.title} — load JSON to begin`;
    nameEl.classList.add('no-project');
  }

  // Collect images from both sources: brief wizard uploads + editor-loaded images
  const sources = [
    ...(brief.imageMeta ?? [])
      .filter(m => m.dataUrl)
      .map(m => ({ filename: m.filename, src: m.dataUrl })),
    ...Object.entries(storage.loadImages(state.activeBriefId))
      .map(([filename, src]) => ({ filename, src })),
  ];

  // Only load images not already in state.images
  const toLoad = sources.filter(({ filename }) => !state.images.has(filename));
  if (!toLoad.length) return;

  await Promise.all(toLoad.map(({ filename, src }) => new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { state.images.set(filename, img); resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  })));
  events.dispatchEvent(new CustomEvent('images:loaded'));
}
```

- [ ] **Step 3: Save images to localStorage after "Load Images"**

Find the `imgInput.change` handler:
```js
imgInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  try {
    await frameManager.loadImages(files);
  } catch (err) {
    console.warn('Image load error:', err);
  }
  imgInput.value = '';
});
```

Replace with:
```js
imgInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  try {
    await frameManager.loadImages(files);
    // Persist to localStorage so images survive reload and tab close
    if (state.activeBriefId) {
      const imageMap = {};
      files.forEach(f => {
        const img = state.images.get(f.name);
        if (img?.src) imageMap[f.name] = img.src;
      });
      storage.saveImages(state.activeBriefId, imageMap);
    }
  } catch (err) {
    console.warn('Image load error:', err);
  }
  imgInput.value = '';
});
```

- [ ] **Step 4: Verify `view:changed` handler still calls `_repaint`**

Confirm the `view:changed` listener (added in a previous session) looks like:
```js
events.addEventListener('view:changed', ({ detail }) => {
  if (detail.view === 'editor') {
    _applyActiveBrief();
    _repaint();
  }
});
```

If the `_repaint()` call is missing, add it.

- [ ] **Step 5: Verify in browser**

1. Open app, open a brief in editor
2. Load `canyon-series-2026.json`
3. Click "Load Images" and load the four canyon JPEG files
4. Images appear in tray and canvas renders — ✓
5. Open browser DevTools → Application → Local Storage
6. Confirm key `pc_images_{briefId}` exists with the four filenames as keys
7. Hard-refresh the page (Ctrl+Shift+R)
8. Navigate back to editor for the same brief
9. Images should reappear in the tray without re-loading — ✓
10. Navigate to manager and back to editor — images still there — ✓

- [ ] **Step 6: Commit**

```bash
git add editor/shell.js
git commit -m "feat: persist editor images to localStorage per brief; remove sessionStorage"
```
