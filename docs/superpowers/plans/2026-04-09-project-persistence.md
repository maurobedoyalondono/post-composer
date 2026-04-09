# Project Persistence & Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every project a fully persistent entity — auto-saved to localStorage on every change, with complete lifecycle flows (create, open, restore, merge JSON, load images, delete) and explicit handling of all edge cases.

**Architecture:** A `ProjectStore` coordinator subscribes to change events and debounces writes to `storage.saveProject(id, data)`. The brief ID is the universal key for all three localStorage buckets (`pc_brief_`, `pc_project_`, `pc_images_`). Loading a JSON file goes through a frame-by-frame diff modal; delete goes through a confirmation modal.

**Tech Stack:** Vanilla ES modules, localStorage, no build step. Test runner at `tests/runner.html`.

---

## File Structure

**New files:**
- `core/project-store.js` — auto-save coordinator (events → debounce → storage write)
- `ui/modals/project-diff-modal.js` — frame diff/merge UI
- `ui/modals/delete-confirm-modal.js` — delete confirmation UI

**Modified files:**
- `core/storage.js` — update `saveProject(id, projectData)` signature
- `editor/frame-manager.js` — add `diffProject(incomingData)` and `_diffFrame()` helper
- `editor/shell.js` — wire project-store, save status, diff modal, image duplication, banner/toast, flush on back
- `manager/brief-wizard.js` — save project skeleton + images in `_save()`
- `manager/projects.js` — replace `window.confirm` with modal, delete `pc_project_`, show corrupt state
- `manager/shell.js` — pass `getCurrentProjectId` and `onProjectDeleted` to ProjectList
- `app.js` — create `ProjectStore`, pass to `mountEditor`

**Updated test files:**
- `tests/core/storage.test.js` — update saveProject tests for new signature
- `tests/core/project-store.test.js` (new)
- `tests/editor/frame-manager-diff.test.js` (new)
- `tests/runner.html` — add new test imports

---

### Task 1: Update storage.saveProject signature

The current `saveProject(project)` destructures `{ id, title }` from the project object. The real project JSON has `{ project: { id, title }, frames: [...] }` — no top-level `id`. Change the signature to `saveProject(id, projectData)` so the caller controls the key.

**Files:**
- Modify: `core/storage.js:13-22`
- Modify: `tests/core/storage.test.js:8-27`

- [ ] **Step 1: Update the storage.test.js to use the new signature**

Open `tests/core/storage.test.js` and replace the three `saveProject` tests:

```js
// tests/core/storage.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { storage } from '../../core/storage.js';

const TEST_ID = '__test__';

describe('storage', () => {
  it('saveProject(id, data) and getProject round-trip', () => {
    const data = { project: { id: TEST_ID, title: 'Test' }, frames: [] };
    storage.saveProject(TEST_ID, data);
    const loaded = storage.getProject(TEST_ID);
    assertEqual(loaded.project.title, 'Test');
    storage.deleteProject(TEST_ID);
  });

  it('listProjects includes saved project', () => {
    const data = { project: { id: TEST_ID, title: 'Test' }, frames: [] };
    storage.saveProject(TEST_ID, data);
    const list = storage.listProjects();
    assert(list.some(p => p.id === TEST_ID));
    storage.deleteProject(TEST_ID);
  });

  it('deleteProject removes it from list', () => {
    storage.saveProject(TEST_ID, { project: { id: TEST_ID, title: 'Test' }, frames: [] });
    storage.deleteProject(TEST_ID);
    assert(!storage.listProjects().some(p => p.id === TEST_ID));
  });

  it('getProject returns null for unknown id', () => {
    assert(storage.getProject('__nonexistent__') === null);
  });

  it('savePrefs and getPrefs round-trip', () => {
    storage.savePrefs({ guideType: 'thirds', showSafeZone: true });
    const prefs = storage.getPrefs();
    assertEqual(prefs.guideType, 'thirds');
    assertEqual(prefs.showSafeZone, true);
  });
});
```

- [ ] **Step 2: Open tests/runner.html in browser — confirm existing storage tests FAIL** (they reference old signature)

Expected console: `✗ saveProject and getProject round-trip`

- [ ] **Step 3: Update storage.js saveProject method**

In `core/storage.js`, replace lines 13–22:

```js
/**
 * Save full project data keyed by id.
 * Throws on localStorage quota error — callers must handle.
 * @param {string} id — the brief id (universal project key)
 * @param {object} projectData — raw project JSON (frames, design_tokens, etc.)
 */
saveProject(id, projectData) {
  localStorage.setItem(KEYS.project(id), JSON.stringify(projectData));
  const index = this._readIndex();
  const existing = index.findIndex(p => p.id === id);
  const title = projectData?.project?.title ?? '';
  const entry = { id, title, updatedAt: Date.now() };
  if (existing >= 0) index[existing] = entry;
  else index.push(entry);
  localStorage.setItem(KEYS.index, JSON.stringify(index));
},
```

- [ ] **Step 4: Open tests/runner.html — confirm storage tests pass**

Expected: all `storage` tests green.

- [ ] **Step 5: Commit**

```bash
git add core/storage.js tests/core/storage.test.js
git commit -m "refactor: storage.saveProject(id, data) — explicit key parameter"
```

---

### Task 2: core/project-store.js

The auto-save coordinator. Listens to change events, debounces 500ms, writes project JSON and stamps `brief.updatedAt`. Exposes `flush()` for pre-navigation saves. Dispatches `project:save-status` and `project:save-failed` events.

**Files:**
- Create: `core/project-store.js`
- Create: `tests/core/project-store.test.js`
- Modify: `tests/runner.html`

- [ ] **Step 1: Write the failing test**

Create `tests/core/project-store.test.js`:

```js
// tests/core/project-store.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { ProjectStore } from '../../core/project-store.js';
import { events } from '../../core/events.js';
import { storage } from '../../core/storage.js';

const BRIEF_ID = '__ps_test__';

function makeState(project = null) {
  return { project, activeBriefId: project ? BRIEF_ID : null, images: new Map() };
}

describe('ProjectStore', () => {
  it('flush() with no project does nothing', () => {
    const state = makeState(null);
    const ps = new ProjectStore(state);
    // Should not throw
    ps.flush();
    assert(storage.getProject(BRIEF_ID) === null);
  });

  it('flush() saves project to storage', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    storage.saveBrief({ id: BRIEF_ID, title: 'PS Test', platform: 'instagram', tone: 'cinematic', imageMeta: [], createdAt: Date.now() });
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    ps.flush();
    const saved = storage.getProject(BRIEF_ID);
    assert(saved !== null, 'project should be saved');
    assertEqual(saved.project.title, 'PS Test');
    storage.deleteProject(BRIEF_ID);
    storage.deleteBrief(BRIEF_ID);
  });

  it('flush() dispatches project:save-status saved', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    storage.saveBrief({ id: BRIEF_ID, title: 'PS Test', platform: 'instagram', tone: 'cinematic', imageMeta: [], createdAt: Date.now() });
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    let status = null;
    events.addEventListener('project:save-status', e => { status = e.detail.status; }, { once: true });
    ps.flush();
    assertEqual(status, 'saved');
    storage.deleteProject(BRIEF_ID);
    storage.deleteBrief(BRIEF_ID);
  });

  it('_schedule() dispatches project:save-status pending', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    let status = null;
    events.addEventListener('project:save-status', e => { status = e.detail.status; }, { once: true });
    events.dispatchEvent(new CustomEvent('layer:changed'));
    assertEqual(status, 'pending');
    ps.flush(); // clean up timer
  });
});
```

- [ ] **Step 2: Add test import to tests/runner.html**

In `tests/runner.html`, add before `summary()`:

```html
import './core/project-store.test.js';
```

- [ ] **Step 3: Open tests/runner.html — confirm new tests FAIL**

Expected: `ProjectStore` tests red with "Cannot find module".

- [ ] **Step 4: Create core/project-store.js**

```js
// core/project-store.js
import { storage } from './storage.js';
import { events }  from './events.js';

const SAVE_DELAY_MS = 500;

/**
 * Auto-save coordinator.
 * Listens for change events, debounces writes to localStorage.
 * Dispatches:
 *   project:save-status  { status: 'pending'|'saved'|'failed', time?: number }
 *   project:save-failed  { reason: 'quota'|'error' }
 */
export class ProjectStore {
  /**
   * @param {import('./state.js').AppState} state
   */
  constructor(state) {
    this._state = state;
    this._timer = null;

    for (const ev of ['layer:changed', 'frame:changed', 'layers:reordered', 'layer:deleted']) {
      events.addEventListener(ev, () => this._schedule());
    }
  }

  /** Schedule a debounced write. */
  _schedule() {
    if (!this._state.project || !this._state.activeBriefId) return;
    clearTimeout(this._timer);
    events.dispatchEvent(new CustomEvent('project:save-status', { detail: { status: 'pending' } }));
    this._timer = setTimeout(() => this._write(), SAVE_DELAY_MS);
  }

  /** Perform the actual write synchronously. */
  _write() {
    this._timer = null;
    if (!this._state.project || !this._state.activeBriefId) return;
    try {
      storage.saveProject(this._state.activeBriefId, this._state.project);
      const brief = storage.getBrief(this._state.activeBriefId);
      if (brief) storage.saveBrief(brief); // stamps updatedAt
      events.dispatchEvent(new CustomEvent('project:save-status', {
        detail: { status: 'saved', time: Date.now() },
      }));
    } catch (e) {
      const reason = (e.name === 'QuotaExceededError') ? 'quota' : 'error';
      events.dispatchEvent(new CustomEvent('project:save-failed', { detail: { reason } }));
      events.dispatchEvent(new CustomEvent('project:save-status', { detail: { status: 'failed' } }));
    }
  }

  /**
   * Force an immediate write, bypassing the debounce timer.
   * Call before navigation to guarantee no work is lost.
   */
  flush() {
    clearTimeout(this._timer);
    this._write();
  }
}
```

- [ ] **Step 5: Open tests/runner.html — confirm ProjectStore tests pass**

Expected: all `ProjectStore` tests green.

- [ ] **Step 6: Commit**

```bash
git add core/project-store.js tests/core/project-store.test.js tests/runner.html
git commit -m "feat: ProjectStore auto-save coordinator with debounce and flush"
```

---

### Task 3: Wire ProjectStore into app.js + editor/shell.js

Instantiate `ProjectStore` in `app.js`, pass it to `mountEditor`. Wire the back button to call `projectStore.flush()` before navigating. Add save-status indicator to the editor header.

**Files:**
- Modify: `app.js`
- Modify: `editor/shell.js`

- [ ] **Step 1: Update app.js**

Replace the full contents of `app.js`:

```js
// app.js
import { AppState }     from './core/state.js';
import { router }       from './core/router.js';
import { storage }      from './core/storage.js';
import { events }       from './core/events.js';
import { ProjectStore } from './core/project-store.js';
import { mountEditor }  from './editor/shell.js';
import { mountManager } from './manager/shell.js';

const state        = new AppState();
const projectStore = new ProjectStore(state);
let editorMounted  = false;

async function init() {
  router.init(state);

  mountManager(state);

  events.addEventListener('view:changed', e => {
    if (e.detail.view === 'editor' && !editorMounted) {
      mountEditor(state, projectStore);
      editorMounted = true;
    }
  });

  // Restore last session
  const { lastBriefId } = storage.getPrefs();
  if (lastBriefId && storage.getBrief(lastBriefId)) {
    state.activeBriefId = lastBriefId;
    router.navigate('editor');
  } else {
    router.navigate('manager');
  }
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
```

- [ ] **Step 2: Update editor/shell.js — add projectStore param, back button flush, save status HTML and listeners**

In `editor/shell.js`, make these changes:

**2a — Update function signature (line 24):**
```js
export function mountEditor(state, projectStore) {
```

**2b — Replace back button handler (lines 73–75):**
```js
root.querySelector('#btn-back').addEventListener('click', () => {
  projectStore.flush();
  router.navigate('manager');
});
```

**2c — Add save status listener after the back button wiring:**
```js
// ── Save status indicator ────────────────────
const saveStatusEl = root.querySelector('#save-status');
events.addEventListener('project:save-status', e => {
  const { status, time } = e.detail;
  if (status === 'pending') {
    saveStatusEl.textContent = 'Saving…';
    saveStatusEl.className = 'save-status save-status-pending';
  } else if (status === 'saved') {
    const t   = new Date(time);
    const hm  = t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    saveStatusEl.textContent = `Saved ${hm}`;
    saveStatusEl.className = 'save-status save-status-ok';
  } else if (status === 'failed') {
    saveStatusEl.textContent = 'Save failed ⚠';
    saveStatusEl.className = 'save-status save-status-error';
  }
});

events.addEventListener('project:save-failed', e => {
  const msg = e.detail.reason === 'quota'
    ? 'Auto-save failed — storage full. Export your project or delete unused projects.'
    : 'Auto-save failed — an error occurred.';
  _showBanner(root, msg);
});
```

**2d — Add `_showBanner` and `_showToast` helpers at the bottom of the file, before `_buildHTML`:**
```js
function _showBanner(root, msg) {
  let banner = root.querySelector('.save-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'save-error-banner';
    banner.style.cssText = [
      'position:sticky', 'top:0', 'z-index:100',
      'background:#7f1d1d', 'color:#fecaca',
      'padding:8px 16px', 'font-size:12px', 'text-align:center',
    ].join(';');
    root.querySelector('.editor-shell').prepend(banner);
  }
  banner.textContent = msg;
  banner.hidden = false;
}

function _showToast(msg, duration = 5000) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:9999', 'background:#1e293b', 'color:#e2e8f0',
    'padding:10px 18px', 'border-radius:6px', 'font-size:13px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
```

**2e — Also hide the save banner on successful save — add inside the `project:save-status` listener, in the `saved` branch:**
```js
} else if (status === 'saved') {
  const t   = new Date(time);
  const hm  = t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  saveStatusEl.textContent = `Saved ${hm}`;
  saveStatusEl.className = 'save-status save-status-ok';
  const banner = root.querySelector('.save-error-banner');
  if (banner) banner.hidden = true;
}
```

**2f — Add `#save-status` span to `_buildHTML` header, inside `.header-project-actions`:**

In the `_buildHTML` function, replace the header line:
```js
        <div class="header-project-actions">
```
with:
```js
        <span id="save-status" class="save-status" style="font-size:11px;color:#6b7280;margin-right:8px;"></span>
        <div class="header-project-actions">
```

- [ ] **Step 3: Open the app in browser, open a brief in editor, make a layer change, wait 500ms**

Expected: header shows "Saving…" then "Saved HH:MM". Check localStorage — `pc_project_{briefId}` should now exist.

- [ ] **Step 4: Commit**

```bash
git add app.js editor/shell.js
git commit -m "feat: wire ProjectStore into editor — save status indicator and back-button flush"
```

---

### Task 4: BriefWizard saves project skeleton + images

When creating a new brief, immediately create an empty project skeleton in localStorage so the editor has a project to restore. In edit mode, don't overwrite the existing project. Also save images to `pc_images_{id}` (in addition to `brief.imageMeta`).

**Files:**
- Modify: `manager/brief-wizard.js:297-329`

- [ ] **Step 1: Add storage import (already present, verify)**

`brief-wizard.js` line 2 already imports `storage`. No change needed.

- [ ] **Step 2: Update `_save()` method in brief-wizard.js**

Replace the existing `_save()` method (lines 297–330):

```js
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

  // Persist images to pc_images_{id} (in addition to brief.imageMeta)
  if (imageMeta.length > 0) {
    const imageMap = {};
    imageMeta.forEach(m => { if (m.dataUrl) imageMap[m.filename] = m.dataUrl; });
    const failed = storage.saveImages(brief.id, imageMap);
    if (failed.length > 0) {
      console.warn('[BriefWizard] Image quota exceeded for:', failed);
    }
  }

  this._dialog.close();
  this._onSave(brief);
}
```

- [ ] **Step 3: Open app, create a new project via wizard, check localStorage**

Open DevTools → Application → Local Storage. After completing the wizard you should see:
- `pc_brief_{id}` — brief metadata
- `pc_project_{id}` — empty skeleton: `{ project: { id, title }, frames: [], ... }`
- `pc_images_{id}` — image DataURLs (if images were added)

- [ ] **Step 4: Commit**

```bash
git add manager/brief-wizard.js
git commit -m "feat: wizard saves project skeleton and images on brief creation"
```

---

### Task 5: Session restoration — _applyActiveBrief restores project + missing images banner

Extend `_applyActiveBrief()` in `editor/shell.js` to restore the saved project from localStorage when the editor mounts. Handle corrupt data (navigate to manager with toast). Show a banner when referenced images are missing.

**Files:**
- Modify: `editor/shell.js:91-122`

- [ ] **Step 1: Replace _applyActiveBrief in editor/shell.js**

Find the `_applyActiveBrief` function (lines 91–122) and replace it entirely:

```js
async function _applyActiveBrief() {
  if (!state.activeBriefId) return;
  const brief = storage.getBrief(state.activeBriefId);
  if (!brief) return;

  // ── Restore saved project if none is loaded ──
  if (!state.project) {
    let savedProject = null;
    try {
      savedProject = storage.getProject(state.activeBriefId);
    } catch (e) {
      savedProject = null;
    }

    if (savedProject) {
      try {
        frameManager.loadProject(savedProject);
        await loadProjectFonts(savedProject.design_tokens);
      } catch (e) {
        // Stored project is corrupt — delete it and bail to manager
        console.warn('[shell] Stored project corrupt:', e);
        storage.deleteProject(state.activeBriefId);
        storage.savePrefs({ ...storage.getPrefs(), lastBriefId: null });
        _showToast('Project could not be restored — data was invalid.');
        router.navigate('manager');
        return;
      }
    } else {
      // No saved project yet (or it was deleted)
      nameEl.textContent = `${brief.title} — load JSON to begin`;
      nameEl.classList.add('no-project');
    }
  }

  // ── Load images not already in state ──
  const sources = [
    ...(brief.imageMeta ?? [])
      .filter(m => m.dataUrl)
      .map(m => ({ filename: m.filename, src: m.dataUrl })),
    ...Object.entries(storage.loadImages(state.activeBriefId))
      .map(([filename, src]) => ({ filename, src })),
  ];

  const toLoad = sources.filter(({ filename }) => !state.images.has(filename));
  if (toLoad.length) {
    await Promise.all(toLoad.map(({ filename, src }) => new Promise(resolve => {
      const img   = new Image();
      img.onload  = () => { state.images.set(filename, img); resolve(); };
      img.onerror = () => { console.warn(`[shell] Failed to load image: ${filename}`); resolve(); };
      img.src = src;
    })));
    events.dispatchEvent(new CustomEvent('images:loaded'));
  }

  // ── Missing images banner ──
  if (state.project) {
    const loaded   = state.images;
    const indexed  = (state.project.image_index ?? []).map(i => i.filename);
    const missing  = indexed.filter(fn => !loaded.has(fn));
    if (missing.length > 0) {
      _showBanner(root, `${missing.length} image(s) could not be restored — reload them from disk.`);
    }
  }
}
```

- [ ] **Step 2: Open app, create a new project, open it in editor — verify project restores without "load JSON to begin"**

Expected: the editor opens and shows an empty canvas (project title in header), not "load JSON to begin".

- [ ] **Step 3: Close tab entirely, reopen app — verify session is restored**

Expected: app navigates directly to editor with the last project loaded. Canvas renders, header shows project title.

- [ ] **Step 4: Manually corrupt `pc_project_{id}` in DevTools (set it to `"bad json"`), reload**

Expected: toast appears, app navigates to manager. `pc_project_{id}` is deleted from localStorage.

- [ ] **Step 5: Commit**

```bash
git add editor/shell.js
git commit -m "feat: session restoration and missing-images banner in _applyActiveBrief"
```

---

### Task 6: diffProject in frame-manager.js

Add a `diffProject(incomingData)` method that validates the incoming JSON and computes a structured diff against the current project's frames. Returns `{ modified, added, removed, unchanged }`.

**Files:**
- Modify: `editor/frame-manager.js`
- Create: `tests/editor/frame-manager-diff.test.js`
- Modify: `tests/runner.html`

- [ ] **Step 1: Write the failing tests**

Create `tests/editor/frame-manager-diff.test.js`:

```js
// tests/editor/frame-manager-diff.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { FrameManager } from '../../editor/frame-manager.js';

function makeState(frames = []) {
  const proj = {
    project: { id: 'test', title: 'Test' },
    design_tokens: { palette: {} },
    export: { width_px: 1080, height_px: 1350, format: 'png' },
    frames,
    image_index: [],
  };
  return {
    project: proj,
    images: new Map(),
    activeFrameIndex: 0,
    selectedLayerId: null,
    get activeFrame() { return this.project.frames[this.activeFrameIndex] ?? null; },
    setProject(p) { this.project = p; this.activeFrameIndex = 0; this.selectedLayerId = null; },
  };
}

function makeFrame(id, overrides = {}) {
  return {
    id,
    label: id,
    composition_pattern: 'full-bleed',
    image_filename: 'photo.jpg',
    bg_color: '#000000',
    layers: [],
    ...overrides,
  };
}

function makeProject(frames) {
  return {
    project: { id: 'incoming', title: 'Incoming' },
    design_tokens: { palette: {} },
    export: { width_px: 1080, height_px: 1350, format: 'png' },
    frames,
    image_index: [],
  };
}

describe('FrameManager.diffProject', () => {
  it('unchanged frame when identical', () => {
    const frame = makeFrame('f1');
    const state = makeState([frame]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.unchanged.length, 1);
    assertEqual(diff.modified.length, 0);
    assertEqual(diff.added.length, 0);
    assertEqual(diff.removed.length, 0);
  });

  it('detects modified field (bg_color)', () => {
    const state = makeState([makeFrame('f1', { bg_color: '#000' })]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1', { bg_color: '#fff' })]));
    assertEqual(diff.modified.length, 1);
    assertEqual(diff.modified[0].frameId, 'f1');
    assert(diff.modified[0].changes.some(c => c.field === 'bg_color'));
  });

  it('detects added frame', () => {
    const state = makeState([makeFrame('f1')]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1'), makeFrame('f2')]));
    assertEqual(diff.added.length, 1);
    assertEqual(diff.added[0].frame.id, 'f2');
  });

  it('detects removed frame', () => {
    const state = makeState([makeFrame('f1'), makeFrame('f2')]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.removed.length, 1);
    assertEqual(diff.removed[0].frame.id, 'f2');
  });

  it('detects added layer in frame', () => {
    const state = makeState([makeFrame('f1', { layers: [] })]);
    const fm = new FrameManager(state);
    const incomingFrame = makeFrame('f1', { layers: [{ id: 'l1', type: 'text' }] });
    const diff = fm.diffProject(makeProject([incomingFrame]));
    assertEqual(diff.modified.length, 1);
    assert(diff.modified[0].changes.some(c => c.field === 'layer:added' && c.layerId === 'l1'));
  });

  it('detects removed layer in frame', () => {
    const state = makeState([makeFrame('f1', { layers: [{ id: 'l1', type: 'text' }] })]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1', { layers: [] })]));
    assertEqual(diff.modified.length, 1);
    assert(diff.modified[0].changes.some(c => c.field === 'layer:removed' && c.layerId === 'l1'));
  });

  it('throws on invalid incoming project', () => {
    const state = makeState([]);
    const fm = new FrameManager(state);
    let threw = false;
    try { fm.diffProject({ not: 'valid' }); } catch { threw = true; }
    assert(threw, 'should throw on invalid project');
  });

  it('works when current project has no frames', () => {
    const state = makeState([]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.added.length, 1);
    assertEqual(diff.modified.length, 0);
    assertEqual(diff.removed.length, 0);
  });
});
```

- [ ] **Step 2: Add import to tests/runner.html**

```html
import './editor/frame-manager-diff.test.js';
```

- [ ] **Step 3: Open tests/runner.html — confirm new tests FAIL**

Expected: `FrameManager.diffProject` tests red.

- [ ] **Step 4: Add diffProject and _diffFrame to editor/frame-manager.js**

At the bottom of `frame-manager.js`, before the closing `}` of the class, add the `diffProject` method:

```js
/**
 * Compute frame-level diff between incomingData and current state.project.
 * Throws if incomingData is invalid.
 * @param {object} incomingData
 * @returns {{ modified: object[], added: object[], removed: object[], unchanged: object[] }}
 */
diffProject(incomingData) {
  const { valid, errors } = validate(incomingData);
  if (!valid) throw new Error(`Invalid project: ${errors.join('; ')}`);

  const currentFrames  = this._state.project?.frames  ?? [];
  const incomingFrames = incomingData.frames ?? [];

  const currentMap  = new Map(currentFrames.map(f  => [f.id, f]));
  const incomingMap = new Map(incomingFrames.map(f => [f.id, f]));

  const modified  = [];
  const added     = [];
  const removed   = [];
  const unchanged = [];

  for (const [id, incomingFrame] of incomingMap) {
    if (!currentMap.has(id)) {
      added.push({ frame: incomingFrame });
    } else {
      const changes = _diffFrame(currentMap.get(id), incomingFrame);
      if (changes.length > 0) {
        modified.push({
          frameId: id,
          label: incomingFrame.label ?? id,
          changes,
          incomingFrame,
          currentFrame: currentMap.get(id),
        });
      } else {
        unchanged.push({ frame: incomingFrame });
      }
    }
  }

  for (const [id, currentFrame] of currentMap) {
    if (!incomingMap.has(id)) {
      removed.push({ frame: currentFrame });
    }
  }

  return { modified, added, removed, unchanged };
}
```

After the class closing `}`, add the module-level helper:

```js
/**
 * Return list of changes between two frame objects.
 * @param {object} current
 * @param {object} incoming
 * @returns {object[]} array of change descriptors
 */
function _diffFrame(current, incoming) {
  const changes = [];

  for (const field of ['composition_pattern', 'bg_color', 'multi_image', 'image_filename']) {
    if (current[field] !== incoming[field]) {
      changes.push({ field, from: current[field], to: incoming[field] });
    }
  }

  const currentLayerIds  = new Set((current.layers  ?? []).map(l => l.id));
  const incomingLayerIds = new Set((incoming.layers ?? []).map(l => l.id));

  for (const l of (incoming.layers ?? [])) {
    if (!currentLayerIds.has(l.id)) {
      changes.push({ field: 'layer:added', layerId: l.id, type: l.type });
    }
  }
  for (const l of (current.layers ?? [])) {
    if (!incomingLayerIds.has(l.id)) {
      changes.push({ field: 'layer:removed', layerId: l.id, type: l.type });
    }
  }
  for (const l of (incoming.layers ?? [])) {
    const cl = (current.layers ?? []).find(x => x.id === l.id);
    if (cl && JSON.stringify(cl) !== JSON.stringify(l)) {
      changes.push({ field: 'layer:modified', layerId: l.id, type: l.type });
    }
  }

  return changes;
}
```

- [ ] **Step 5: Open tests/runner.html — confirm all frame-manager-diff tests pass**

Expected: all `FrameManager.diffProject` tests green.

- [ ] **Step 6: Commit**

```bash
git add editor/frame-manager.js tests/editor/frame-manager-diff.test.js tests/runner.html
git commit -m "feat: FrameManager.diffProject — frame-level diff for JSON merge"
```

---

### Task 7: project-diff-modal.js

The modal shown when loading a JSON file over an existing project. Shows modified frames (checkbox: replace, default unchecked), added frames (checkbox: add, default checked), removed frames (informational). Returns user selections to a callback.

**Files:**
- Create: `ui/modals/project-diff-modal.js`

- [ ] **Step 1: Create ui/modals/project-diff-modal.js**

```js
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
      if (c.field === 'layer:added')    return `<li>Layer added: ${_esc(c.type)} (${_esc(c.layerId)})</li>`;
      if (c.field === 'layer:removed')  return `<li>Layer removed: ${_esc(c.type)} (${_esc(c.layerId)})</li>`;
      if (c.field === 'layer:modified') return `<li>Layer modified: ${_esc(c.type)} (${_esc(c.layerId)})</li>`;
      const from = c.from != null ? String(c.from) : '—';
      const to   = c.to   != null ? String(c.to)   : '—';
      return `<li>${_esc(c.field)}: <s>${_esc(from)}</s> → ${_esc(to)}</li>`;
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
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Merge incoming JSON</div>
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
```

- [ ] **Step 2: Manually verify modal renders by importing in browser console (no formal test — visual component)**

Open the app. In DevTools console:
```js
import('./ui/modals/project-diff-modal.js').then(m => m.showProjectDiffModal({
  modified: [{ frameId: 'f1', label: 'Hero', changes: [{ field: 'bg_color', from: '#000', to: '#fff' }], incomingFrame: {}, currentFrame: {} }],
  added: [{ frame: { id: 'f2', label: 'Second' } }],
  removed: [{ frame: { id: 'f3', label: 'Old' } }],
  unchanged: [{ frame: { id: 'f4' } }],
}, sel => console.log('selections:', [...sel.replaceFrameIds], [...sel.addFrameIds])));
```

Expected: modal appears, checkboxes work, Apply logs selections, Cancel dismisses without callback.

- [ ] **Step 3: Commit**

```bash
git add ui/modals/project-diff-modal.js
git commit -m "feat: project-diff-modal — frame-by-frame merge UI"
```

---

### Task 8: Wire "Load JSON" through diff modal in editor/shell.js

Replace the direct `frameManager.loadProject(data)` call with the diff flow. When no project is loaded: load directly. When a project is loaded: show diff modal, apply selections, flush.

**Files:**
- Modify: `editor/shell.js:136-154`

- [ ] **Step 1: Add import for showProjectDiffModal at top of editor/shell.js**

Add to the imports at the top:
```js
import { showProjectDiffModal } from '../ui/modals/project-diff-modal.js';
```

- [ ] **Step 2: Replace the jsonInput change handler (lines 140–154)**

```js
jsonInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  jsonInput.value = '';

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    _showToast(`Invalid JSON file: ${err.message}`);
    return;
  }

  // Validate before going any further
  try {
    if (!state.project) {
      // No project loaded yet — load directly
      frameManager.loadProject(data);
      await loadProjectFonts(data.design_tokens);
      await _applyActiveBrief();
      projectStore.flush();
      return;
    }

    // Project loaded — go through diff modal
    const diff = frameManager.diffProject(data);
    showProjectDiffModal(diff, ({ replaceFrameIds, addFrameIds }) => {
      // Apply replace selections
      for (const { frameId, incomingFrame } of diff.modified) {
        if (replaceFrameIds.has(frameId)) {
          const idx = state.project.frames.findIndex(f => f.id === frameId);
          if (idx >= 0) state.project.frames[idx] = incomingFrame;
        }
      }
      // Apply add selections
      for (const { frame } of diff.added) {
        if (addFrameIds.has(frame.id)) {
          state.project.frames.push(frame);
        }
      }
      // Re-set active frame to 0 to avoid out-of-range index
      state.activeFrameIndex = 0;
      state.selectedLayerId  = null;
      events.dispatchEvent(new CustomEvent('project:loaded', { detail: state.project }));
      loadProjectFonts(state.project.design_tokens);
      projectStore.flush();
    });
  } catch (err) {
    _showToast(`Failed to load file: ${err.message}`);
  }
});
```

- [ ] **Step 3: Test the happy path — load a JSON file with changes over an existing project**

1. Create a project, open it in editor
2. Click "Load JSON", select a valid project JSON file
3. Expected: diff modal appears, showing modified/added/removed frames
4. Check some boxes, click Apply
5. Expected: selected frames updated, canvas refreshes, "Saved HH:MM" appears in header

- [ ] **Step 4: Test edge cases**

- Load a JSON file with no differences → toast "No differences found in the loaded file" OR modal with "No differences found" + Cancel only
- Load an invalid JSON file → toast "Invalid JSON file: ..."
- Load a JSON that fails validation → toast "Failed to load file: Invalid project: ..."
- Load JSON when no project is loaded → loads directly, no modal

- [ ] **Step 5: Commit**

```bash
git add editor/shell.js
git commit -m "feat: Load JSON goes through frame diff modal when project is loaded"
```

---

### Task 9: Image duplicate detection in editor/shell.js

Before loading images, detect filenames already in `state.images`. Prompt once for all collisions. Show toast if quota is exceeded.

**Files:**
- Modify: `editor/shell.js:156-174`

- [ ] **Step 1: Replace imgInput change handler (lines 156–174)**

```js
imgInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  imgInput.value = '';
  if (!files.length) return;

  // Detect filename collisions
  const collisions    = files.filter(f => state.images.has(f.name));
  const nonCollisions = files.filter(f => !state.images.has(f.name));
  let toLoad = [...nonCollisions];

  if (collisions.length > 0) {
    const names = collisions.map(f => f.name).join(', ');
    if (confirm(`These images are already loaded:\n${names}\n\nReplace them?`)) {
      toLoad = [...toLoad, ...collisions];
    }
    // If declined, collisions are simply skipped
  }

  if (!toLoad.length) return;

  try {
    await frameManager.loadImages(toLoad);
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
  } catch (err) {
    _showToast(`Image load error: ${err.message}`);
  }
});
```

- [ ] **Step 2: Test — load the same image twice**

1. Load an image into the editor
2. Load the same filename again
3. Expected: confirmation dialog appears with the filename
4. Click "OK" → image is replaced, tray refreshes
5. Click "Cancel" → image is NOT replaced, existing one stays

- [ ] **Step 3: Commit**

```bash
git add editor/shell.js
git commit -m "feat: image duplicate detection with confirmation before replace"
```

---

### Task 10: delete-confirm-modal.js

A modal that shows project title, frame count, image count, and last saved date before confirming deletion. Replaces `window.confirm`.

**Files:**
- Create: `ui/modals/delete-confirm-modal.js`

- [ ] **Step 1: Create ui/modals/delete-confirm-modal.js**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add ui/modals/delete-confirm-modal.js
git commit -m "feat: delete-confirm-modal with project summary"
```

---

### Task 11: Wire delete modal in projects.js + handle open project + delete pc_project_

Replace `window.confirm` in `manager/projects.js` with the new modal. Also delete `pc_project_{id}` on deletion (currently only `storage.deleteBrief` is called, which deletes brief + images but NOT the project JSON). Pass `getCurrentProjectId` and `onProjectDeleted` from `manager/shell.js`.

**Files:**
- Modify: `manager/projects.js`
- Modify: `manager/shell.js`

- [ ] **Step 1: Add import to manager/projects.js**

Add at the top:
```js
import { showDeleteConfirmModal } from '../ui/modals/delete-confirm-modal.js';
import { storage } from '../core/storage.js';
```

`storage` is already imported — just add the modal import.

- [ ] **Step 2: Update ProjectList constructor to accept new deps**

The existing constructor signature is `constructor(container, deps)`. The `deps` object now includes two new optional callbacks. No change to the constructor itself is needed — they're accessed via `this.deps`.

- [ ] **Step 3: Replace the btn-delete handler in manager/projects.js**

Find the `else if (btn.classList.contains('btn-delete'))` block (lines 108–114) and replace:

```js
} else if (btn.classList.contains('btn-delete')) {
  const id = btn.dataset.id;
  const brief = storage.getBrief(id);
  if (!brief) return;

  let projectData = null;
  try { projectData = storage.getProject(id); } catch { /* corrupt, still allow delete */ }
  const frameCount = projectData?.frames?.length ?? 0;
  const imageCount = brief.imageCount ?? 0;

  showDeleteConfirmModal(
    { title: brief.title, frameCount, imageCount, updatedAt: brief.updatedAt },
    () => {
      // If this project is currently open in editor, clear state
      if (this.deps.getCurrentProjectId?.() === id) {
        this.deps.onProjectDeleted?.(id);
      }
      storage.deleteProject(id);
      storage.deleteBrief(id); // also calls storage.deleteImages(id)
      this.refresh();
    }
  );
}
```

- [ ] **Step 4: Update manager/shell.js to pass the new deps**

In `manager/shell.js`, update the `ProjectList` constructor call:

```js
projectList = new ProjectList(listEl, {
  wizard,
  onOpenEditor: (briefId) => {
    state.activeBriefId = briefId;
    storage.savePrefs({ ...storage.getPrefs(), lastBriefId: briefId });
    router.navigate('editor');
  },
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
  getCurrentProjectId: () => state.activeBriefId,
  onProjectDeleted: (deletedId) => {
    state.activeBriefId = null;
    state.setProject(null);
    storage.savePrefs({ ...storage.getPrefs(), lastBriefId: null });
  },
});
```

- [ ] **Step 5: Also show corrupt project state on project cards**

In `manager/projects.js`, inside the `for (const brief of entries)` loop, after creating the `card` element (after the `card.innerHTML = ...` block), add:

```js
// Show corrupt state if project data is missing or unreadable
let projectOk = false;
try { projectOk = !!storage.getProject(brief.id); } catch { /* corrupt */ }
if (!projectOk) {
  const warn = document.createElement('div');
  warn.style.cssText = 'font-size:11px;color:#f87171;padding:4px 0 0;';
  warn.textContent = '⚠ Project data missing or corrupt';
  card.querySelector('.project-card-details').appendChild(warn);
}
```

- [ ] **Step 6: Test delete flow**

1. Create a project, open it in editor, go back to manager
2. Click Delete — confirm modal appears with frame count, image count, date
3. Click "Delete" → project removed from list, `pc_project_`, `pc_brief_`, `pc_images_` all removed from localStorage
4. Click Cancel → project stays

- [ ] **Step 7: Test delete-while-open**

1. Create a project, open in editor, navigate back to manager
2. Open the project in editor again (navigate to editor)
3. Navigate back to manager
4. Delete the project
5. Expected: project deleted, state cleared (no lingering `activeBriefId`)
6. Click "New Project" → wizard opens fine (previous state is clean)

- [ ] **Step 8: Commit**

```bash
git add manager/projects.js manager/shell.js
git commit -m "feat: delete project via confirmation modal, clears pc_project_ and state"
```

---

## Self-review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| localStorage only, `saveProject(id, data)` | Task 1 |
| `ProjectStore` auto-save coordinator, debounce 500ms | Task 2 |
| `flush()` before navigation | Task 3 |
| Save status indicator in editor header | Task 3 |
| Save-failed persistent banner | Task 3 |
| BriefWizard saves project skeleton on create | Task 4 |
| BriefWizard saves images to `pc_images_` | Task 4 |
| Session restoration on app load | Task 5 |
| Corrupt project → navigate to manager with toast | Task 5 |
| Missing images banner | Task 5 |
| `diffProject` in FrameManager | Task 6 |
| Project diff modal | Task 7 |
| Load JSON → diff modal when project loaded | Task 8 |
| Load JSON → direct when no project | Task 8 |
| Invalid JSON → toast, no changes | Task 8 |
| Image duplicate detection | Task 9 |
| Image quota exceeded toast | Task 9 |
| Delete confirmation modal with summary | Task 10 |
| Delete clears `pc_project_`, `pc_brief_`, `pc_images_` | Task 11 |
| Delete-while-open clears state | Task 11 |
| Corrupt project card warning | Task 11 |

All requirements covered. ✓

### Type consistency check

- `storage.saveProject(id, projectData)` — used consistently in Tasks 1, 2, 4, 5
- `ProjectStore.flush()` — called in Tasks 3 (back button) and 8 (after diff apply)
- `frameManager.diffProject(data)` — returns `{ modified, added, removed, unchanged }` — used consistently in Tasks 6 and 8
- `showProjectDiffModal(diff, onApply)` — `onApply` receives `{ replaceFrameIds: Set, addFrameIds: Set }` — consistent between Tasks 7 and 8
- `showDeleteConfirmModal({ title, frameCount, imageCount, updatedAt }, onConfirm)` — consistent between Tasks 10 and 11
- `deps.getCurrentProjectId()` / `deps.onProjectDeleted(id)` — defined in Task 11 shell.js, consumed in Task 11 projects.js ✓
