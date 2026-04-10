# Image Storage — Move to IndexedDB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage image storage with IndexedDB so images persist across page reloads and are never dropped due to quota limits.

**Architecture:** A new `core/image-store.js` module owns all IndexedDB I/O (lazy open, compound key `[briefId, filename]`). `storage.js` is updated to strip `dataUrl` from brief records. Every call site that previously used `storage.saveImages / loadImages` is updated to use `imageStore.save / load` instead.

**Tech Stack:** Native IndexedDB API (no library), ES modules, in-browser HTML test runner with custom test helper.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `core/image-store.js` | IndexedDB open, save, load, delete |
| Create | `tests/core/image-store.test.js` | Async tests for image-store |
| Create | `tests/core/runner-async.html` | Browser runner for async tests |
| Modify | `tests/test-helper.js` | Add `itAsync` / `summaryAsync` |
| Modify | `core/storage.js` | Strip dataUrl in saveBrief; remove saveImages/loadImages/deleteImages; fire-and-forget imageStore.delete in deleteBrief |
| Modify | `tests/core/storage-briefs.test.js` | Add test: saveBrief strips dataUrl |
| Modify | `manager/brief-wizard.js` | Use imageStore.save instead of storage.saveImages |
| Modify | `editor/shell.js` | Use imageStore.load/save; remove imageMeta.dataUrl path |
| Modify | `manager/shell.js` | Hydrate imageMeta from imageStore before export |

---

## Task 1: Add async test support to test helper

**Files:**
- Modify: `tests/test-helper.js`
- Create: `tests/core/runner-async.html`

- [ ] **Step 1: Add `itAsync` and `summaryAsync` to the test helper**

Open `tests/test-helper.js`. The file currently exports `describe`, `it`, `assert`, `assertEqual`, `assertDeepEqual`, `assertThrows`, and `summary`. Add two exports at the bottom of the file (after `summary`):

```js
// Async test registry — populated by itAsync(), drained by summaryAsync()
const _asyncTests = [];

export function itAsync(label, fn) {
  _asyncTests.push(
    fn().then(
      () => {
        passed++;
        const row = document.createElement('div');
        row.style.cssText = 'padding:3px 0 3px 16px;font-size:13px;color:#10b981;';
        row.textContent = `✓ ${label}`;
        document.getElementById('results').appendChild(row);
      },
      (e) => {
        failed++;
        const row = document.createElement('div');
        row.style.cssText = 'padding:3px 0 3px 16px;font-size:13px;color:#ef4444;';
        row.textContent = `✗ ${label}: ${e.message}`;
        document.getElementById('results').appendChild(row);
      }
    )
  );
}

export async function summaryAsync() {
  await Promise.all(_asyncTests);
  summary();
}
```

- [ ] **Step 2: Create the async test runner HTML**

Create `tests/core/runner-async.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer async tests</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    p    { color:#6b7280; margin-bottom:24px; font-size:13px; }
  </style>
</head>
<body>
  <h1>post-composer async test runner</h1>
  <p>Open browser console for additional detail. Refresh to re-run.</p>
  <div id="results"></div>
  <script type="module">
    import { summaryAsync } from '../test-helper.js';
    import './image-store.test.js';
    await summaryAsync();
  </script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add tests/test-helper.js tests/core/runner-async.html
git commit -m "test: add itAsync/summaryAsync helpers and async runner"
```

---

## Task 2: Write failing tests for `core/image-store.js`

**Files:**
- Create: `tests/core/image-store.test.js`

- [ ] **Step 1: Create the test file**

Create `tests/core/image-store.test.js`:

```js
// tests/core/image-store.test.js
import { describe, itAsync, assert, assertDeepEqual } from '../test-helper.js';
import { imageStore } from '../../core/image-store.js';

const BRIEF_A = '__img_test_a__';
const BRIEF_B = '__img_test_b__';

describe('imageStore.save / imageStore.load', () => {
  itAsync('round-trips a single image', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,abc' });
    const result = await imageStore.load(BRIEF_A);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,abc', 'should round-trip dataUrl');
    await imageStore.delete(BRIEF_A);
  });

  itAsync('load returns empty map for unknown briefId', async () => {
    const result = await imageStore.load('__nonexistent_brief_img__');
    assertDeepEqual(result, {}, 'should return empty map for unknown brief');
  });

  itAsync('save overwrites existing entry for same filename', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,original' });
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,updated' });
    const result = await imageStore.load(BRIEF_A);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,updated', 'should have updated value');
    await imageStore.delete(BRIEF_A);
  });

  itAsync('save and load multiple images', async () => {
    await imageStore.save(BRIEF_A, {
      'a.jpg': 'data:image/jpeg;base64,aaa',
      'b.jpg': 'data:image/jpeg;base64,bbb',
    });
    const result = await imageStore.load(BRIEF_A);
    assert(result['a.jpg'] === 'data:image/jpeg;base64,aaa', 'should load a.jpg');
    assert(result['b.jpg'] === 'data:image/jpeg;base64,bbb', 'should load b.jpg');
    await imageStore.delete(BRIEF_A);
  });
});

describe('imageStore.delete', () => {
  itAsync('delete removes all images for a brief', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,abc' });
    await imageStore.delete(BRIEF_A);
    const result = await imageStore.load(BRIEF_A);
    assertDeepEqual(result, {}, 'should be empty after delete');
  });

  itAsync('delete does not remove images for other briefs', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,aaa' });
    await imageStore.save(BRIEF_B, { 'photo.jpg': 'data:image/jpeg;base64,bbb' });
    await imageStore.delete(BRIEF_A);
    const result = await imageStore.load(BRIEF_B);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,bbb', 'B images should survive delete of A');
    await imageStore.delete(BRIEF_B);
  });

  itAsync('delete on nonexistent briefId is a no-op', async () => {
    await imageStore.delete('__nonexistent_brief_img_del__');
    assert(true, 'no error on delete of nonexistent brief');
  });
});
```

- [ ] **Step 2: Open runner in browser and confirm tests fail**

Open `tests/core/runner-async.html` in a browser (via a local server or `file://`). Expected: all tests fail with something like "Failed to resolve module specifier `../../core/image-store.js`" or "imageStore is not defined". This confirms the tests are running and need the implementation.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/core/image-store.test.js
git commit -m "test: add failing tests for core/image-store"
```

---

## Task 3: Implement `core/image-store.js`

**Files:**
- Create: `core/image-store.js`

- [ ] **Step 1: Create the module**

Create `core/image-store.js`:

```js
// core/image-store.js
const DB_NAME    = 'pc_images_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let _db = null;

function _open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ['briefId', 'filename'] });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

export const imageStore = {
  /**
   * Upsert one or more images for a brief.
   * @param {string} briefId
   * @param {{ [filename: string]: string }} imageMap  filename → dataUrl
   * @returns {Promise<void>}
   */
  async save(briefId, imageMap) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const [filename, dataUrl] of Object.entries(imageMap)) {
        store.put({ briefId, filename, dataUrl });
      }
      tx.oncomplete = () => resolve();
      tx.onerror    = e => reject(e.target.error);
      tx.onabort    = e => reject(e.target.error);
    });
  },

  /**
   * Load all images for a brief.
   * @param {string} briefId
   * @returns {Promise<{ [filename: string]: string }>}
   */
  async load(briefId) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx     = db.transaction(STORE_NAME, 'readonly');
      const store  = tx.objectStore(STORE_NAME);
      const range  = IDBKeyRange.bound([briefId, ''], [briefId, '\uffff']);
      const result = {};
      const req    = store.openCursor(range);
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          result[cursor.value.filename] = cursor.value.dataUrl;
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = e => reject(e.target.error);
    });
  },

  /**
   * Delete all images for a brief.
   * @param {string} briefId
   * @returns {Promise<void>}
   */
  async delete(briefId) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([briefId, ''], [briefId, '\uffff']);
      const req   = store.delete(range);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  },
};
```

- [ ] **Step 2: Open runner and confirm all tests pass**

Open `tests/core/runner-async.html` in a browser. Expected: all 7 tests show green ✓.

- [ ] **Step 3: Commit**

```bash
git add core/image-store.js
git commit -m "feat: add core/image-store — IndexedDB-backed image persistence"
```

---

## Task 4: Update `core/storage.js` — strip dataUrl, remove image methods

**Files:**
- Modify: `core/storage.js`
- Modify: `tests/core/storage-briefs.test.js`

- [ ] **Step 1: Write a failing test for the dataUrl-stripping behaviour**

Open `tests/core/storage-briefs.test.js`. Add this test to the existing `describe('storage.saveBrief / getBrief', ...)` block, after the last `it(...)` in that block:

```js
  it('saveBrief strips dataUrl from imageMeta before storing', () => {
    const b = {
      id: '__strip_test__',
      title: 'Strip Test',
      platform: 'instagram-portrait',
      story: 'A story.',
      tone: 'cinematic',
      imageMeta: [
        { filename: 'a.jpg', label: 'Photo A', dataUrl: 'data:image/jpeg;base64,AAAA' },
      ],
      createdAt: Date.now(),
    };
    storage.saveBrief(b);
    const got = storage.getBrief('__strip_test__');
    assertEqual(got.imageMeta.length, 1, 'should have one entry');
    assertEqual(got.imageMeta[0].filename, 'a.jpg', 'should keep filename');
    assertEqual(got.imageMeta[0].label, 'Photo A', 'should keep label');
    assert(!('dataUrl' in got.imageMeta[0]), 'dataUrl must be stripped');
    storage.deleteBrief('__strip_test__');
  });
```

- [ ] **Step 2: Open `tests/runner.html` and confirm the new test fails**

Open `tests/runner.html` in a browser. Locate the `storage.saveBrief / getBrief` section. The new test "saveBrief strips dataUrl from imageMeta before storing" should show red ✗.

- [ ] **Step 3: Update `core/storage.js`**

Make three changes:

**Change A — `saveBrief`: strip dataUrl.**

Find this block in `saveBrief`:
```js
  saveBrief(brief) {
    const now = Date.now();
    const { id, title, platform, tone, imageMeta } = brief;
    localStorage.setItem(KEYS.brief(id), JSON.stringify({ ...brief, updatedAt: now }));
```

Replace with:
```js
  saveBrief(brief) {
    const now = Date.now();
    const { id, title, platform, tone, imageMeta } = brief;
    const slimMeta = (imageMeta ?? []).map(({ filename, label }) => ({ filename, label }));
    localStorage.setItem(KEYS.brief(id), JSON.stringify({ ...brief, imageMeta: slimMeta, updatedAt: now }));
```

**Change B — `deleteBrief`: replace `this.deleteImages(id)` with fire-and-forget IndexedDB delete.**

First, add an import at the top of the file (line 1, before the `const KEYS` line):
```js
import { imageStore } from './image-store.js';
```

Then find inside `deleteBrief`:
```js
    localStorage.removeItem(KEYS.brief(id));
    this.deleteImages(id);
```

Replace with:
```js
    localStorage.removeItem(KEYS.brief(id));
    imageStore.delete(id); // fire-and-forget — brief removed sync, images cleaned up async
```

**Change C — Remove the three image methods entirely.**

Delete the entire comment and three methods block (lines 102–154 in the original file):
```js
  // ── Image storage (per brief) ──────────────────────────────────────────

  /**
   * Load all stored images for a brief.
   * ...
   */
  loadImages(briefId) { ... },

  /**
   * Merge new images into localStorage for a brief.
   * ...
   */
  saveImages(briefId, imageMap) { ... },

  /**
   * Remove all stored images for a brief (call when brief is deleted).
   * ...
   */
  deleteImages(briefId) { ... },
```

Also remove the `images` key from the `KEYS` object at the top (remove the line `images: id => \`pc_images_\${id}\`,`).

- [ ] **Step 4: Confirm the new test passes, all existing tests still pass**

Open `tests/runner.html`. Expected: all tests green including the new "saveBrief strips dataUrl" test. No regressions.

- [ ] **Step 5: Commit**

```bash
git add core/storage.js tests/core/storage-briefs.test.js
git commit -m "feat: saveBrief strips dataUrl from imageMeta; remove localStorage image methods"
```

---

## Task 5: Update `manager/brief-wizard.js`

**Files:**
- Modify: `manager/brief-wizard.js`

- [ ] **Step 1: Add the imageStore import**

At the top of `manager/brief-wizard.js`, the existing imports are:
```js
import { storage } from '../core/storage.js';
import { PLATFORMS, TONES, slugify, autoLabel } from './constants.js';
```

Add the imageStore import:
```js
import { storage } from '../core/storage.js';
import { imageStore } from '../core/image-store.js';
import { PLATFORMS, TONES, slugify, autoLabel } from './constants.js';
```

- [ ] **Step 2: Replace the saveImages call in `_save()`**

Find this block near the end of `_save()`:
```js
    // Persist images to pc_images_{id} (in addition to brief.imageMeta)
    if (imageMeta.length > 0) {
      const imageMap = {};
      imageMeta.forEach(m => { if (m.dataUrl) imageMap[m.filename] = m.dataUrl; });
      const failed = storage.saveImages(brief.id, imageMap);
      if (failed.length > 0) {
        console.warn('[BriefWizard] Image quota exceeded for:', failed);
      }
    }
```

Replace with:
```js
    // Persist images to IndexedDB
    if (imageMeta.length > 0) {
      const imageMap = {};
      imageMeta.forEach(m => { if (m.dataUrl) imageMap[m.filename] = m.dataUrl; });
      if (Object.keys(imageMap).length > 0) {
        await imageStore.save(brief.id, imageMap);
      }
    }
```

- [ ] **Step 3: Verify manually**

Open the app in a browser, create a new brief, attach images, save it. Reload the page. Open the editor for that brief — images should still be present. Check DevTools → Application → IndexedDB → `pc_images_db` → `images` to confirm the entries exist.

- [ ] **Step 4: Commit**

```bash
git add manager/brief-wizard.js
git commit -m "feat: brief-wizard saves images to IndexedDB via imageStore"
```

---

## Task 6: Update `editor/shell.js`

**Files:**
- Modify: `editor/shell.js`

- [ ] **Step 1: Add the imageStore import**

At the top of `editor/shell.js`, existing imports include `import { storage } from '../core/storage.js';`. Add after it:
```js
import { imageStore } from '../core/image-store.js';
```

- [ ] **Step 2: Replace the image-loading block in `_applyActiveBrief()`**

Find this block (around line 185):
```js
    // ── Load images not already in state ──
    const sources = [
      ...(brief.imageMeta ?? [])
        .filter(m => m.dataUrl)
        .map(m => ({ filename: m.filename, src: m.dataUrl })),
      ...Object.entries(storage.loadImages(state.activeBriefId))
        .map(([filename, src]) => ({ filename, src })),
    ];

    const toLoad = sources.filter(({ filename }) => !state.images.has(filename));
```

Replace with:
```js
    // ── Load images not already in state ──
    const storedImages = await imageStore.load(state.activeBriefId);
    const sources = Object.entries(storedImages)
      .map(([filename, src]) => ({ filename, src }));

    const toLoad = sources.filter(({ filename }) => !state.images.has(filename));
```

- [ ] **Step 3: Replace the saveImages call in the imgInput handler**

Find this block in the imgInput handler (around line 307):
```js
      if (state.activeBriefId) {
        const imageMap = {};
        toLoad.forEach(f => {
          const img = state.images.get(f.name);
          if (img?.src) imageMap[f.name] = img.src;
        });
        const failed = storage.saveImages(state.activeBriefId, imageMap);
        if (failed.length > 0) {
          _showToast(`${failed.length} image(s) could not be saved (storage full): ${failed.join(', ')}`);
        }
      }
```

Replace with:
```js
      if (state.activeBriefId) {
        const imageMap = {};
        toLoad.forEach(f => {
          const img = state.images.get(f.name);
          if (img?.src) imageMap[f.name] = img.src;
        });
        if (Object.keys(imageMap).length > 0) {
          await imageStore.save(state.activeBriefId, imageMap).catch(err => {
            _showToast(`Images could not be saved: ${err.message}`);
          });
        }
      }
```

- [ ] **Step 4: Verify manually**

Open the app in a browser. Open a brief in the editor. Use the "Load Images" button in the editor header to load image files. Reload the page and navigate back to the editor for that brief — images should load automatically from IndexedDB. The "N image(s) could not be restored" banner should not appear.

- [ ] **Step 5: Commit**

```bash
git add editor/shell.js
git commit -m "feat: editor loads and saves images via IndexedDB; remove imageMeta.dataUrl path"
```

---

## Task 7: Update `manager/shell.js` — hydrate imageMeta for export

**Files:**
- Modify: `manager/shell.js`

- [ ] **Step 1: Add the imageStore import**

At the top of `manager/shell.js`, add:
```js
import { imageStore } from '../core/image-store.js';
```

The existing imports are:
```js
import { BriefWizard }  from './brief-wizard.js';
import { ProjectList }  from './projects.js';
import { exportPackage } from './exporter.js';
import { slugify, PLATFORMS, TONES } from './constants.js';
import { router }       from '../core/router.js';
import { storage }      from '../core/storage.js';
```

Add the imageStore import after the storage import.

- [ ] **Step 2: Hydrate imageMeta before calling `exportPackage`**

Find the `onExport` handler:
```js
    onExport: async (brief) => {
      const platform = PLATFORMS.find(p => p.id === brief.platform);
      const tone     = TONES.find(t => t.id === brief.tone);
      const platformLabel = platform ? platform.label : brief.platform;
      const toneLabel     = tone ? tone.label : brief.tone;
      const slug = slugify(brief.title);
      try {
        await exportPackage(brief, brief.imageMeta ?? [], platformLabel, toneLabel, slug);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    },
```

Replace with:
```js
    onExport: async (brief) => {
      const platform = PLATFORMS.find(p => p.id === brief.platform);
      const tone     = TONES.find(t => t.id === brief.tone);
      const platformLabel = platform ? platform.label : brief.platform;
      const toneLabel     = tone ? tone.label : brief.tone;
      const slug = slugify(brief.title);
      try {
        const storedImages  = await imageStore.load(brief.id);
        const hydratedMeta  = (brief.imageMeta ?? []).map(m => ({
          ...m,
          dataUrl: storedImages[m.filename] ?? null,
        }));
        await exportPackage(brief, hydratedMeta, platformLabel, toneLabel, slug);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    },
```

- [ ] **Step 3: Verify manually**

Open the app, open a brief that has images saved (from Task 5 verification). Click "Export Package". Open the downloaded ZIP — `image-sheet.jpg` should contain a thumbnail grid of the images.

- [ ] **Step 4: Commit**

```bash
git add manager/shell.js
git commit -m "feat: hydrate imageMeta from IndexedDB before export package"
```

---

## Task 8: End-to-end smoke test

- [ ] **Step 1: Full reload test**

1. Open the app. Create a new brief with 2–3 images.
2. Hard-reload the page (`Ctrl+Shift+R` / `Cmd+Shift+R`).
3. Open the project in the editor. Confirm images are in the image tray — no "could not be restored" banner.

- [ ] **Step 2: Edit brief test**

1. Click "Edit Brief" on an existing brief with images.
2. Advance to step 5 — confirm "N images already loaded" hint appears.
3. Save without replacing images.
4. Reload and reopen in editor — original images still present.

- [ ] **Step 3: Delete brief test**

1. Delete a brief that has images.
2. Open DevTools → Application → IndexedDB → `pc_images_db` → `images`.
3. Confirm no records remain for that briefId.

- [ ] **Step 4: Export test**

1. Export a brief that has images.
2. Open the ZIP — confirm `image-sheet.jpg` is present and contains the images.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: image storage end-to-end corrections"
```
