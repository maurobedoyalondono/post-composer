# Plan 1: Core Architecture + JSON Contract

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the working foundation — project scaffold, central state management, event bus, router, and a fully-validating JSON contract validator. No UI rendering yet; just the skeleton every other plan builds on.

**Architecture:** Vanilla JS ES modules, no build step, no dependencies. Central `AppState` class holds all runtime state. An `EventTarget`-based event bus decouples modules — they emit events, never call each other directly. A router switches between two hidden view containers without page reloads.

**Tech Stack:** HTML5, Vanilla JS (ES2022 modules), browser `<input type="color">`, localStorage, live server (VS Code Live Server or equivalent). Tests run in browser via `tests/runner.html`.

---

## File Map

**Created in this plan:**

| File | Responsibility |
|------|---------------|
| `index.html` | Single entry point, two view containers, script module entry |
| `app.js` | Bootstrap: instantiate AppState, mount router, attach global error handler |
| `core/events.js` | Singleton EventTarget-based event bus |
| `core/state.js` | `AppState` class — single source of truth for all runtime state |
| `core/router.js` | View switching between `#manager-view` and `#editor-view` |
| `core/storage.js` | localStorage CRUD — projects index + per-project JSON blobs |
| `shared/validator.js` | JSON contract validator — schema, design_tokens, variety_contract, frames, layers |
| `shared/fonts.js` | Google Fonts dynamic loader |
| `styles/base.css` | CSS custom properties (design tokens) + reset |
| `tests/runner.html` | Browser test runner — open in browser to run all tests |
| `tests/test-helper.js` | `assert()` + `describe()` + `it()` micro test helpers |
| `tests/core/state.test.js` | AppState tests |
| `tests/core/events.test.js` | Event bus tests |
| `tests/core/router.test.js` | Router tests |
| `tests/core/storage.test.js` | Storage tests |
| `tests/shared/validator.test.js` | Validator tests (the bulk of Plan 1 testing) |

**Not in this plan** (Plans 2–4): renderer, layers, editor modules, manager modules, visual-analysis, UI components.

---

## Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `styles/base.css`
- Create: `app.js`

- [ ] **Step 1.1: Create directory structure**

From `C:\Projects\Photos\Composers\post-composer\`, create these empty directories:

```
mkdir -p core shared editor manager ui/toolbars ui/analysis-panels ui/modals styles tests/core tests/shared data
```

- [ ] **Step 1.2: Create `styles/base.css`**

```css
/* styles/base.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --color-bg:        #0d0f1a;
  --color-surface:   #111827;
  --color-surface-2: #1a1f2e;
  --color-border:    #1e293b;
  --color-text:      #e2e8f0;
  --color-text-muted:#6b7280;
  --color-accent:    #6366f1;
  --color-accent-2:  #a5b4fc;
  --color-success:   #10b981;
  --color-warning:   #f59e0b;
  --color-danger:    #ef4444;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', 'Cascadia Code', monospace;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

html, body { height: 100%; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); font-size: 14px; }

#app { height: 100%; display: flex; flex-direction: column; }

#manager-view,
#editor-view { flex: 1; display: flex; flex-direction: column; }
```

- [ ] **Step 1.3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>post-composer</title>
  <link rel="stylesheet" href="styles/base.css">
</head>
<body>
  <div id="app">
    <div id="manager-view" hidden></div>
    <div id="editor-view"  hidden></div>
  </div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 1.4: Create `app.js` (stub — will be filled in Task 6)**

```js
// app.js
import { AppState }  from './core/state.js';
import { router }    from './core/router.js';
import { storage }   from './core/storage.js';

const state = new AppState();

async function init() {
  router.init(state);
  router.navigate('manager');
}

init().catch(err => console.error('Bootstrap failed:', err));
```

- [ ] **Step 1.5: Open `index.html` in browser via live server**

Verify: blank dark page loads with no console errors.

- [ ] **Step 1.6: Commit**

```bash
git add index.html app.js styles/base.css
git commit -m "feat: project scaffold — entry point, view containers, base CSS"
```

---

## Task 2: Test Infrastructure

**Files:**
- Create: `tests/test-helper.js`
- Create: `tests/runner.html`

- [ ] **Step 2.1: Create `tests/test-helper.js`**

```js
// tests/test-helper.js
let passed = 0;
let failed = 0;
let currentSuite = '';

export function describe(label, fn) {
  currentSuite = label;
  const section = document.createElement('div');
  section.style.cssText = 'margin:16px 0 8px;font-weight:700;font-size:15px;color:#a5b4fc;';
  section.textContent = label;
  document.getElementById('results').appendChild(section);
  fn();
}

export function it(label, fn) {
  const row = document.createElement('div');
  row.style.cssText = 'padding:3px 0 3px 16px;font-size:13px;';
  try {
    fn();
    passed++;
    row.style.color = '#10b981';
    row.textContent = `✓ ${label}`;
  } catch (e) {
    failed++;
    row.style.color = '#ef4444';
    row.textContent = `✗ ${label}: ${e.message}`;
  }
  document.getElementById('results').appendChild(row);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'assertion failed');
}

export function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export function assertDeepEqual(a, b, message) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(message ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export function assertThrows(fn, message) {
  try { fn(); throw new Error('expected throw but did not throw'); }
  catch (e) { if (e.message === 'expected throw but did not throw') throw e; }
}

export function summary() {
  const el = document.createElement('div');
  el.style.cssText = `margin-top:24px;padding:12px;border-radius:6px;font-weight:700;font-size:14px;background:${failed === 0 ? '#0f2d14' : '#2d0f14'};color:${failed === 0 ? '#4ade80' : '#f87171'};`;
  el.textContent = `${passed + failed} tests — ${passed} passed, ${failed} failed`;
  document.getElementById('results').appendChild(el);
}
```

- [ ] **Step 2.2: Create `tests/runner.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer tests</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    p    { color:#6b7280; margin-bottom:24px; font-size:13px; }
  </style>
</head>
<body>
  <h1>post-composer test runner</h1>
  <p>Open browser console for additional detail. Refresh to re-run.</p>
  <div id="results"></div>
  <script type="module">
    import { summary } from './test-helper.js';
    import './core/state.test.js';
    import './core/events.test.js';
    import './core/router.test.js';
    import './core/storage.test.js';
    import './shared/validator.test.js';
    summary();
  </script>
</body>
</html>
```

- [ ] **Step 2.3: Verify runner opens without errors**

Open `tests/runner.html` in browser. Expect: dark page with heading, no console errors, "0 tests" summary (no tests registered yet).

- [ ] **Step 2.4: Commit**

```bash
git add tests/
git commit -m "feat: browser test runner with assert/describe/it helpers"
```

---

## Task 3: Event Bus

**Files:**
- Create: `core/events.js`
- Create: `tests/core/events.test.js`

- [ ] **Step 3.1: Write failing test**

Create `tests/core/events.test.js`:

```js
// tests/core/events.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { events } from '../../core/events.js';

describe('events — event bus', () => {
  it('emits and receives a custom event', () => {
    let received = null;
    const handler = ({ detail }) => { received = detail; };
    events.addEventListener('test:ping', handler);
    events.dispatchEvent(new CustomEvent('test:ping', { detail: { msg: 'hello' } }));
    events.removeEventListener('test:ping', handler);
    assertEqual(received?.msg, 'hello');
  });

  it('does not receive events after removeEventListener', () => {
    let count = 0;
    const handler = () => count++;
    events.addEventListener('test:count', handler);
    events.removeEventListener('test:count', handler);
    events.dispatchEvent(new CustomEvent('test:count'));
    assertEqual(count, 0);
  });

  it('multiple listeners on same event all fire', () => {
    let a = 0, b = 0;
    const ha = () => a++;
    const hb = () => b++;
    events.addEventListener('test:multi', ha);
    events.addEventListener('test:multi', hb);
    events.dispatchEvent(new CustomEvent('test:multi'));
    events.removeEventListener('test:multi', ha);
    events.removeEventListener('test:multi', hb);
    assertEqual(a, 1);
    assertEqual(b, 1);
  });
});
```

- [ ] **Step 3.2: Run tests — expect FAIL (module not found)**

Open `tests/runner.html`. Expect: error about `../../core/events.js` not found.

- [ ] **Step 3.3: Create `core/events.js`**

```js
// core/events.js
// Singleton event bus. Modules emit and listen here — never call each other directly.
export const events = new EventTarget();
```

- [ ] **Step 3.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: 3 green passing tests under "events — event bus".

- [ ] **Step 3.5: Commit**

```bash
git add core/events.js tests/core/events.test.js
git commit -m "feat: event bus singleton"
```

---

## Task 4: AppState

**Files:**
- Create: `core/state.js`
- Create: `tests/core/state.test.js`

- [ ] **Step 4.1: Write failing test**

Create `tests/core/state.test.js`:

```js
// tests/core/state.test.js
import { describe, it, assert, assertEqual, assertThrows } from '../test-helper.js';
import { AppState } from '../../core/state.js';

describe('AppState', () => {
  it('initialises with default values', () => {
    const s = new AppState();
    assertEqual(s.view, 'manager');
    assert(s.project === null);
    assert(s.images instanceof Map);
    assertEqual(s.activeFrameIndex, 0);
    assert(s.selectedLayerId === null);
    assert(s.analysisMode === null);
  });

  it('setView changes view and rejects unknown views', () => {
    const s = new AppState();
    s.setView('editor');
    assertEqual(s.view, 'editor');
    assertThrows(() => s.setView('unknown'));
  });

  it('setProject stores project and resets frame/layer selection', () => {
    const s = new AppState();
    s.activeFrameIndex = 3;
    s.selectedLayerId = 'layer-1';
    s.setProject({ id: 'test', frames: [] });
    assertEqual(s.project.id, 'test');
    assertEqual(s.activeFrameIndex, 0);
    assert(s.selectedLayerId === null);
  });

  it('setProject(null) clears project and images', () => {
    const s = new AppState();
    s.setProject({ id: 'test', frames: [] });
    s.images.set('img-1', new Image());
    s.setProject(null);
    assert(s.project === null);
    assertEqual(s.images.size, 0);
  });

  it('setAnalysisMode accepts valid modes and null', () => {
    const s = new AppState();
    s.setAnalysisMode('heatmap');
    assertEqual(s.analysisMode, 'heatmap');
    s.setAnalysisMode('zones');
    assertEqual(s.analysisMode, 'zones');
    s.setAnalysisMode(null);
    assert(s.analysisMode === null);
    assertThrows(() => s.setAnalysisMode('invalid'));
  });

  it('activeFrame returns the correct frame object', () => {
    const s = new AppState();
    s.setProject({ id: 'p', frames: [{ id: 'f0' }, { id: 'f1' }] });
    s.activeFrameIndex = 1;
    assertEqual(s.activeFrame?.id, 'f1');
  });

  it('activeFrame returns null when no project', () => {
    const s = new AppState();
    assert(s.activeFrame === null);
  });
});
```

- [ ] **Step 4.2: Run tests — expect FAIL**

Refresh `tests/runner.html`. Expect: error about `../../core/state.js` not found.

- [ ] **Step 4.3: Create `core/state.js`**

```js
// core/state.js
const VALID_VIEWS         = ['manager', 'editor'];
const VALID_ANALYSIS_MODES = ['heatmap', 'zones', 'contrast', 'weight'];

export class AppState {
  constructor() {
    this.view             = 'manager';  // 'manager' | 'editor'
    this.project          = null;       // parsed project JSON or null
    this.images           = new Map();  // descriptive_label → HTMLImageElement
    this.activeFrameIndex = 0;
    this.selectedLayerId  = null;
    this.analysisMode     = null;       // null | 'heatmap' | 'zones' | 'contrast' | 'weight'
    this.prefs            = { guideType: null, showSafeZone: false, showLayerBounds: false };
  }

  /** @param {'manager'|'editor'} view */
  setView(view) {
    if (!VALID_VIEWS.includes(view)) throw new Error(`Unknown view: ${view}`);
    this.view = view;
  }

  /** @param {object|null} project */
  setProject(project) {
    this.project          = project;
    this.activeFrameIndex = 0;
    this.selectedLayerId  = null;
    if (project === null) this.images.clear();
  }

  /** @param {string|null} mode */
  setAnalysisMode(mode) {
    if (mode !== null && !VALID_ANALYSIS_MODES.includes(mode))
      throw new Error(`Unknown analysis mode: ${mode}`);
    this.analysisMode = mode;
  }

  /** @returns {object|null} */
  get activeFrame() {
    if (!this.project) return null;
    return this.project.frames?.[this.activeFrameIndex] ?? null;
  }
}
```

- [ ] **Step 4.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: 7 green passing tests under "AppState".

- [ ] **Step 4.5: Commit**

```bash
git add core/state.js tests/core/state.test.js
git commit -m "feat: AppState — central state with validated mutations"
```

---

## Task 5: Storage

**Files:**
- Create: `core/storage.js`
- Create: `tests/core/storage.test.js`

- [ ] **Step 5.1: Write failing test**

Create `tests/core/storage.test.js`:

```js
// tests/core/storage.test.js
import { describe, it, assert, assertEqual, assertDeepEqual } from '../test-helper.js';
import { storage } from '../../core/storage.js';

const TEST_ID = '__test__';

describe('storage', () => {
  it('saveProject and getProject round-trip', () => {
    const proj = { id: TEST_ID, title: 'Test', frames: [] };
    storage.saveProject(proj);
    const loaded = storage.getProject(TEST_ID);
    assertEqual(loaded.title, 'Test');
    storage.deleteProject(TEST_ID);
  });

  it('listProjects includes saved project', () => {
    const proj = { id: TEST_ID, title: 'Test', frames: [] };
    storage.saveProject(proj);
    const list = storage.listProjects();
    assert(list.some(p => p.id === TEST_ID));
    storage.deleteProject(TEST_ID);
  });

  it('deleteProject removes it from list', () => {
    storage.saveProject({ id: TEST_ID, title: 'Test', frames: [] });
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

- [ ] **Step 5.2: Run tests — expect FAIL**

Refresh `tests/runner.html`. Expect: error about `../../core/storage.js` not found.

- [ ] **Step 5.3: Create `core/storage.js`**

```js
// core/storage.js
const KEYS = {
  index: 'pc_projects_index',
  project: id => `pc_project_${id}`,
  prefs: 'pc_prefs',
};

export const storage = {
  /** Save full project JSON. Updates the index automatically. */
  saveProject(project) {
    const { id, title } = project;
    localStorage.setItem(KEYS.project(id), JSON.stringify(project));
    const index = this._readIndex();
    const existing = index.findIndex(p => p.id === id);
    const entry = { id, title, updatedAt: Date.now() };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  /** Returns full project object or null. */
  getProject(id) {
    const raw = localStorage.getItem(KEYS.project(id));
    return raw ? JSON.parse(raw) : null;
  },

  /** Returns array of index entries: [{id, title, updatedAt}] sorted newest first. */
  listProjects() {
    return this._readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Removes project from storage and index. */
  deleteProject(id) {
    localStorage.removeItem(KEYS.project(id));
    const index = this._readIndex().filter(p => p.id !== id);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  savePrefs(prefs) { localStorage.setItem(KEYS.prefs, JSON.stringify(prefs)); },

  getPrefs() {
    const raw = localStorage.getItem(KEYS.prefs);
    return raw ? JSON.parse(raw) : {};
  },

  _readIndex() {
    const raw = localStorage.getItem(KEYS.index);
    return raw ? JSON.parse(raw) : [];
  },
};
```

- [ ] **Step 5.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: 5 green tests under "storage".

- [ ] **Step 5.5: Commit**

```bash
git add core/storage.js tests/core/storage.test.js
git commit -m "feat: localStorage storage — project CRUD + prefs"
```

---

## Task 6: Router

**Files:**
- Create: `core/router.js`
- Create: `tests/core/router.test.js`

- [ ] **Step 6.1: Write failing test**

Create `tests/core/router.test.js`:

```js
// tests/core/router.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { Router } from '../../core/router.js';
import { AppState } from '../../core/state.js';
import { events } from '../../core/events.js';

describe('Router', () => {
  function makeDOM() {
    const manager = document.createElement('div');
    manager.id = 'test-manager';
    const editor = document.createElement('div');
    editor.id = 'test-editor';
    document.body.appendChild(manager);
    document.body.appendChild(editor);
    return { manager, editor };
  }

  it('navigate to manager shows manager, hides editor', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    router.navigate('manager');
    assert(!manager.hidden);
    assert(editor.hidden);
    manager.remove(); editor.remove();
  });

  it('navigate to editor shows editor, hides manager', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    router.navigate('editor');
    assert(manager.hidden);
    assert(!editor.hidden);
    manager.remove(); editor.remove();
  });

  it('navigate emits view:changed event', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    let emitted = null;
    const handler = ({ detail }) => { emitted = detail.view; };
    events.addEventListener('view:changed', handler);
    router.navigate('editor');
    events.removeEventListener('view:changed', handler);
    assertEqual(emitted, 'editor');
    manager.remove(); editor.remove();
  });
});
```

- [ ] **Step 6.2: Run tests — expect FAIL**

Refresh `tests/runner.html`. Expect: error about `../../core/router.js` not found.

- [ ] **Step 6.3: Create `core/router.js`**

```js
// core/router.js
import { events } from './events.js';

export class Router {
  /**
   * @param {string} managerId  — DOM id of manager view container
   * @param {string} editorId   — DOM id of editor view container
   */
  constructor(managerId = 'manager-view', editorId = 'editor-view') {
    this._managerId = managerId;
    this._editorId  = editorId;
    this._state     = null;
  }

  init(state) { this._state = state; }

  navigate(view) {
    this._state.setView(view);   // validates view name, throws on unknown
    document.getElementById(this._managerId).hidden = (view !== 'manager');
    document.getElementById(this._editorId).hidden  = (view !== 'editor');
    events.dispatchEvent(new CustomEvent('view:changed', { detail: { view } }));
  }
}

// Default singleton for app use
export const router = new Router();
```

- [ ] **Step 6.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: 3 green tests under "Router".

- [ ] **Step 6.5: Update `app.js` with singleton router**

```js
// app.js
import { AppState } from './core/state.js';
import { router }   from './core/router.js';
import { storage }  from './core/storage.js';

const state = new AppState();

async function init() {
  router.init(state);
  router.navigate('manager');
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
```

- [ ] **Step 6.6: Verify app loads in browser**

Open `index.html` via live server. Expect: dark blank page, console says "post-composer ready", no errors.

- [ ] **Step 6.7: Commit**

```bash
git add core/router.js tests/core/router.test.js app.js
git commit -m "feat: router — view switching with event emission"
```

---

## Task 7: Fonts Loader

**Files:**
- Create: `shared/fonts.js`

No tests for this task — font loading is async and depends on external network (Google Fonts). Verified manually.

- [ ] **Step 7.1: Create `shared/fonts.js`**

```js
// shared/fonts.js
// Loads Google Fonts by family name. Caches loaded families to avoid duplicate requests.
const loaded = new Set();

/**
 * Loads a Google Fonts family if not already loaded.
 * @param {string} family — e.g. "Inter", "Cormorant Garamond"
 * @param {number[]} weights — e.g. [400, 700]
 * @returns {Promise<void>}
 */
export async function loadFont(family, weights = [400, 700]) {
  const key = `${family}:${weights.join(',')}`;
  if (loaded.has(key)) return;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(';')}&display=swap`;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  await new Promise((resolve, reject) => {
    link.onload  = resolve;
    link.onerror = () => reject(new Error(`Failed to load font: ${family}`));
    document.head.appendChild(link);
  });
  loaded.add(key);
  // Wait for font to be available in FontFaceSet
  await document.fonts.ready;
}

/**
 * Load all fonts referenced in a project's design_tokens.
 * @param {object} designTokens — project.design_tokens
 */
export async function loadProjectFonts(designTokens) {
  const { type_scale } = designTokens ?? {};
  if (!type_scale) return;
  const loads = [];
  for (const role of Object.values(type_scale)) {
    if (role?.family) {
      loads.push(loadFont(role.family, [role.weight ?? 400, 700]).catch(
        () => console.warn(`Font not found: ${role.family}`)
      ));
    }
  }
  await Promise.all(loads);
}
```

- [ ] **Step 7.2: Manual smoke test**

Open browser console on `index.html`. Run:

```js
import('./shared/fonts.js').then(m => m.loadFont('Inter').then(() => console.log('Inter loaded')));
```

Expect: "Inter loaded" in console, no errors.

- [ ] **Step 7.3: Commit**

```bash
git add shared/fonts.js
git commit -m "feat: Google Fonts dynamic loader with project-level bulk load"
```

---

## Task 8: JSON Validator — Schema Foundation

**Files:**
- Create: `shared/validator.js`
- Create: `tests/shared/validator.test.js`

This is the most important module in Plan 1. Build it incrementally across Tasks 8–11.

- [ ] **Step 8.1: Write failing tests for basic structure validation**

Create `tests/shared/validator.test.js`:

```js
// tests/shared/validator.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { validate } from '../../shared/validator.js';

// Minimal valid project fixture used across all tests
function minimal() {
  return {
    project: { id: 'test-project', title: 'Test', version: '1.0', created: '2026-04-08' },
    export: { target: 'instagram-portrait', width_px: 1080, height_px: 1350, dpi: 72, scale_factor: 2, format: 'png' },
    design_tokens: {
      palette: { background: '#000000', primary: '#ffffff', accent: '#ff0000', neutral: '#888888' },
      type_scale: {
        display: { family: 'Cormorant Garamond', weight: 700, steps: { xl: 12, lg: 10, md: 8, sm: 6 } },
        body:    { family: 'Inter', weight: 400, steps: { md: 3.5, sm: 3.0, xs: 2.5 } },
        data:    { family: 'Inter', weight: 700, steps: { xl: 16, lg: 12, md: 8, sm: 5 } },
      },
      spacing_scale: [4, 6, 8, 12, 16, 24],
    },
    variety_contract: {
      zone_max_usage_pct: 40,
      shape_quota: { min_per_n_frames: 3, waiver: null },
      overlay_strategies: ['gradient', 'solid-bar'],
      overlay_strategies_min: 2,
      accent_color_frames: [],
      accent_color_min: 0,
      copy_tone_variety: false,
      silence_map: [],
      composition_patterns: {},
    },
    globals: { background_color: '#000000', safe_zone_pct: 5 },
    frames: [],
    image_index: [],
  };
}

describe('validator — top-level structure', () => {
  it('accepts a minimal valid project', () => {
    const result = validate(minimal());
    assert(result.valid, result.errors?.join(', '));
  });

  it('rejects missing project block', () => {
    const p = minimal(); delete p.project;
    assert(!validate(p).valid);
  });

  it('rejects missing export block', () => {
    const p = minimal(); delete p.export;
    assert(!validate(p).valid);
  });

  it('rejects missing design_tokens', () => {
    const p = minimal(); delete p.design_tokens;
    assert(!validate(p).valid);
  });

  it('rejects missing variety_contract', () => {
    const p = minimal(); delete p.variety_contract;
    assert(!validate(p).valid);
  });

  it('rejects missing frames array', () => {
    const p = minimal(); delete p.frames;
    assert(!validate(p).valid);
  });

  it('rejects project.id with spaces', () => {
    const p = minimal(); p.project.id = 'has spaces';
    assert(!validate(p).valid);
  });

  it('rejects unknown export.target', () => {
    const p = minimal(); p.export.target = 'not-a-target';
    assert(!validate(p).valid);
  });
});
```

- [ ] **Step 8.2: Run tests — expect FAIL**

Refresh `tests/runner.html`. Expect: error about `../../shared/validator.js` not found.

- [ ] **Step 8.3: Create `shared/validator.js` — structure validation**

```js
// shared/validator.js

const VALID_TARGETS = [
  'instagram-square', 'instagram-portrait', 'instagram-story',
  'facebook-feed', 'facebook-cover',
  'print-a4-portrait', 'print-a4-landscape',
  'custom',
];

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

const VALID_SHAPE_ROLES = [
  'divider', 'accent', 'anchor', 'badge', 'frame', 'silhouette', 'callout',
];

const VALID_ZONES = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
  'absolute',
];

const VALID_OVERLAY_STRATEGIES = ['gradient', 'solid-bar', 'duotone', 'flat', 'none'];

/**
 * Validate a parsed post-composer project JSON.
 * @param {object} project
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(project) {
  const errors = [];

  function err(msg) { errors.push(msg); }

  // Top-level required blocks
  if (!project.project)         err('Missing required block: project');
  if (!project.export)          err('Missing required block: export');
  if (!project.design_tokens)   err('Missing required block: design_tokens');
  if (!project.variety_contract)err('Missing required block: variety_contract');
  if (!Array.isArray(project.frames)) err('Missing required array: frames');

  if (errors.length) return { valid: false, errors };

  // project block
  if (!project.project.id)                          err('project.id is required');
  if (project.project.id && /\s/.test(project.project.id)) err('project.id must not contain spaces');
  if (!project.project.title)                        err('project.title is required');

  // export block
  if (!VALID_TARGETS.includes(project.export.target))
    err(`export.target "${project.export.target}" is not a valid target`);
  if (typeof project.export.width_px  !== 'number') err('export.width_px must be a number');
  if (typeof project.export.height_px !== 'number') err('export.height_px must be a number');

  // design_tokens
  _validateDesignTokens(project.design_tokens, err);

  // variety_contract
  _validateVarietyContract(project.variety_contract, err);

  // frames
  const usedLayerIds = {};
  for (let i = 0; i < project.frames.length; i++) {
    _validateFrame(project.frames[i], i, usedLayerIds, err);
  }

  // variety contract enforcement (only when frames are present)
  if (project.frames.length > 0) {
    _enforceVarietyContract(project, err);
  }

  return { valid: errors.length === 0, errors };
}

function _validateDesignTokens(dt, err) {
  if (!dt.palette)             return err('design_tokens.palette is required');
  const requiredColors = ['background', 'primary', 'accent', 'neutral'];
  for (const key of requiredColors) {
    if (!dt.palette[key]) err(`design_tokens.palette.${key} is required`);
    else if (!/^#[0-9a-fA-F]{6}$/.test(dt.palette[key]))
      err(`design_tokens.palette.${key} must be a 6-digit hex color`);
  }
  if (!dt.type_scale)          return err('design_tokens.type_scale is required');
  for (const role of ['display', 'body', 'data']) {
    if (!dt.type_scale[role])  err(`design_tokens.type_scale.${role} is required`);
    else {
      if (!dt.type_scale[role].family) err(`design_tokens.type_scale.${role}.family is required`);
      if (!dt.type_scale[role].steps)  err(`design_tokens.type_scale.${role}.steps is required`);
    }
  }
  if (!Array.isArray(dt.spacing_scale)) err('design_tokens.spacing_scale must be an array');
}

function _validateVarietyContract(vc, err) {
  if (typeof vc.zone_max_usage_pct !== 'number') err('variety_contract.zone_max_usage_pct must be a number');
  if (!vc.shape_quota)                            err('variety_contract.shape_quota is required');
  if (!Array.isArray(vc.overlay_strategies))      err('variety_contract.overlay_strategies must be an array');
  for (const s of (vc.overlay_strategies ?? [])) {
    if (!VALID_OVERLAY_STRATEGIES.includes(s))
      err(`variety_contract.overlay_strategies: "${s}" is not a valid strategy`);
  }
  if (!Array.isArray(vc.silence_map))             err('variety_contract.silence_map must be an array');
  if (typeof vc.composition_patterns !== 'object' || Array.isArray(vc.composition_patterns))
    err('variety_contract.composition_patterns must be an object');
}

function _validateFrame(frame, index, usedLayerIds, err) {
  const label = `frames[${index}]`;
  if (!frame.id)                err(`${label}.id is required`);
  if (!frame.image_src)         err(`${label}.image_src is required`);
  if (!frame.image_filename)    err(`${label}.image_filename is required`);
  if (!VALID_COMPOSITION_PATTERNS.includes(frame.composition_pattern))
    err(`${label}.composition_pattern "${frame.composition_pattern}" is not a valid pattern`);
  if (!Array.isArray(frame.layers)) err(`${label}.layers must be an array`);

  const frameLayerIds = new Set();
  for (let j = 0; j < (frame.layers ?? []).length; j++) {
    _validateLayer(frame.layers[j], `${label}.layers[${j}]`, frameLayerIds, err);
  }
}

function _validateLayer(layer, label, frameLayerIds, err) {
  if (!layer.id)   return err(`${label}.id is required`);
  if (!layer.type) return err(`${label}.type is required`);
  if (frameLayerIds.has(layer.id)) err(`${label}: duplicate layer id "${layer.id}" within frame`);
  frameLayerIds.add(layer.id);

  const VALID_TYPES = ['image', 'text', 'shape', 'overlay', 'stats_block', 'logo'];
  if (!VALID_TYPES.includes(layer.type)) err(`${label}.type "${layer.type}" is not valid`);

  if (layer.type === 'text') {
    if (!layer.content)         err(`${label}: text layer requires content`);
    if (!layer.font)            err(`${label}: text layer requires font`);
    if (layer.font && !layer.font.size_pct) err(`${label}: text layer font.size_pct is required`);
    if (layer.font && layer.max_width_pct == null) err(`${label}: text layer requires max_width_pct`);
  }

  if (layer.type === 'shape') {
    if (!layer.shape)           err(`${label}: shape layer requires shape type`);
    if (!VALID_SHAPE_ROLES.includes(layer.role))
      err(`${label}: shape layer requires a valid role (got "${layer.role}")`);
  }

  if (layer.position) {
    if (!layer.position.zone)   err(`${label}.position.zone is required`);
    else if (!VALID_ZONES.includes(layer.position.zone))
      err(`${label}.position.zone "${layer.position.zone}" is not valid`);
  }
}

function _enforceVarietyContract(project, err) {
  const vc     = project.variety_contract;
  const frames = project.frames;
  const textFrames = frames.filter(f =>
    f.layers?.some(l => l.type === 'text' || l.type === 'stats_block')
  );

  // Zone distribution
  const zoneCounts = {};
  for (const frame of textFrames) {
    for (const layer of (frame.layers ?? [])) {
      if ((layer.type === 'text' || layer.type === 'stats_block') && layer.position?.zone) {
        const z = layer.position.zone;
        zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;
      }
    }
  }
  if (textFrames.length > 0) {
    const maxAllowed = Math.ceil(textFrames.length * (vc.zone_max_usage_pct / 100));
    for (const [zone, count] of Object.entries(zoneCounts)) {
      if (count > maxAllowed)
        err(`variety_contract: zone "${zone}" used ${count} times but max allowed is ${maxAllowed} (${vc.zone_max_usage_pct}% of ${textFrames.length} text frames)`);
    }
  }

  // Shape quota
  const { min_per_n_frames, waiver } = vc.shape_quota ?? {};
  if (min_per_n_frames && !waiver) {
    const shapeFrames = frames.filter(f => f.layers?.some(l => l.type === 'shape'));
    const required = Math.floor(frames.length / min_per_n_frames);
    if (shapeFrames.length < required)
      err(`variety_contract: shape_quota requires at least ${required} frame(s) with shapes (1 per ${min_per_n_frames}), found ${shapeFrames.length}`);
  }

  // Overlay strategies
  const usedStrategies = new Set();
  for (const frame of frames) {
    for (const layer of (frame.layers ?? [])) {
      if (layer.type === 'overlay') {
        const strat = layer.gradient?.enabled ? 'gradient' : 'solid-bar';
        usedStrategies.add(strat);
      }
    }
  }
  if (vc.overlay_strategies_min && usedStrategies.size < vc.overlay_strategies_min)
    err(`variety_contract: requires ${vc.overlay_strategies_min} overlay strategies, found ${usedStrategies.size}`);

  // Composition pattern distribution
  const patternCounts = {};
  for (const frame of frames) {
    if (frame.composition_pattern) {
      patternCounts[frame.composition_pattern] = (patternCounts[frame.composition_pattern] ?? 0) + 1;
    }
  }
  const maxPatternAllowed = Math.ceil(frames.length * 0.40);
  for (const [pattern, count] of Object.entries(patternCounts)) {
    if (pattern !== 'full-bleed' && pattern !== 'minimal-strip' && count > maxPatternAllowed)
      err(`variety_contract: pattern "${pattern}" used ${count} times, exceeds 40% limit (${maxPatternAllowed} of ${frames.length} frames)`);
  }
}
```

- [ ] **Step 8.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: 8 green tests under "validator — top-level structure".

- [ ] **Step 8.5: Commit**

```bash
git add shared/validator.js tests/shared/validator.test.js
git commit -m "feat: JSON validator — structure, design_tokens, variety_contract, layer schema"
```

---

## Task 9: Validator — Frame and Variety Contract Tests

**Files:**
- Modify: `tests/shared/validator.test.js` — add frame and contract enforcement tests

- [ ] **Step 9.1: Add frame validation tests to `tests/shared/validator.test.js`**

Append to the existing file:

```js
// ── append to tests/shared/validator.test.js ──

function frameWith(overrides) {
  return Object.assign({
    id: 'frame-01',
    image_src: 'wide-shot',
    image_filename: 'IMG_001.jpg',
    composition_pattern: 'editorial-anchor',
    layers: [],
  }, overrides);
}

function textLayer(overrides) {
  return Object.assign({
    id: 'text-1', type: 'text',
    content: 'Hello world',
    font: { family: 'Inter', size_pct: 9, weight: 700, color: '#fff', opacity: 1 },
    position: { zone: 'bottom-left', offset_x_pct: 6, offset_y_pct: -8 },
    max_width_pct: 80,
  }, overrides);
}

function shapeLayer(overrides) {
  return Object.assign({
    id: 'shape-1', type: 'shape',
    shape: 'line', role: 'divider',
    position: { zone: 'bottom-left', offset_x_pct: 6, offset_y_pct: -10 },
    dimensions: { width_pct: 20, height_px: 2 },
    fill_color: '#fff', fill_opacity: 0.6,
  }, overrides);
}

function overlayLayer(gradient, overrides) {
  return Object.assign({
    id: 'overlay-1', type: 'overlay',
    color: '#000', opacity: 1,
    gradient: gradient
      ? { enabled: true, direction: 'to-bottom', from_opacity: 0, to_opacity: 0.7, from_position_pct: 40, to_position_pct: 100 }
      : { enabled: false },
  }, overrides);
}

describe('validator — frames', () => {
  it('accepts a valid frame with a text layer', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer()] })];
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });

  it('rejects frame missing composition_pattern', () => {
    const p = minimal();
    p.frames = [frameWith({ composition_pattern: undefined })];
    assert(!validate(p).valid);
  });

  it('rejects invalid composition_pattern', () => {
    const p = minimal();
    p.frames = [frameWith({ composition_pattern: 'not-a-pattern' })];
    assert(!validate(p).valid);
  });

  it('rejects frame missing image_filename', () => {
    const p = minimal();
    p.frames = [frameWith({ image_filename: undefined })];
    assert(!validate(p).valid);
  });

  it('rejects text layer missing max_width_pct', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ max_width_pct: undefined })] })];
    assert(!validate(p).valid);
  });

  it('rejects shape layer without role', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [shapeLayer({ role: undefined })] })];
    assert(!validate(p).valid);
  });

  it('rejects shape layer with invalid role', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [shapeLayer({ role: 'decoration' })] })];
    assert(!validate(p).valid);
  });

  it('rejects duplicate layer ids within a frame', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ id: 'dup' }), shapeLayer({ id: 'dup' })] })];
    assert(!validate(p).valid);
  });

  it('rejects invalid position zone', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ position: { zone: 'invalid-zone' } })] })];
    assert(!validate(p).valid);
  });
});

describe('validator — variety contract enforcement', () => {
  it('flags zone overuse when one zone exceeds 40%', () => {
    // 4 text frames all using bottom-left = 100% → must fail
    const p = minimal();
    p.variety_contract.zone_max_usage_pct = 40;
    p.frames = [1,2,3,4].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: ['editorial-anchor','minimal-strip','data-callout','layered-depth'][i],
      layers: [overlayLayer(true, { id: `ov-${n}` }), textLayer({ id: `t-${n}` })],
    }));
    const r = validate(p);
    assert(!r.valid, 'expected zone overuse to be flagged');
    assert(r.errors.some(e => e.includes('zone')));
  });

  it('accepts zone distribution within 40% limit', () => {
    const zones = ['bottom-left','bottom-right','top-left','top-right'];
    const patterns = ['editorial-anchor','minimal-strip','data-callout','layered-depth'];
    const p = minimal();
    p.variety_contract.zone_max_usage_pct = 40;
    p.variety_contract.overlay_strategies = ['gradient', 'solid-bar'];
    p.variety_contract.overlay_strategies_min = 2;
    p.frames = [1,2,3,4].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: patterns[i],
      layers: [
        overlayLayer(i < 2, { id: `ov-${n}` }),
        textLayer({ id: `t-${n}`, position: { zone: zones[i], offset_x_pct: 6, offset_y_pct: -8 } }),
      ],
    }));
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });

  it('flags shape quota violation when no shapes present', () => {
    const p = minimal();
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: null };
    p.frames = [1,2,3].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: ['editorial-anchor','minimal-strip','data-callout'][i],
      layers: [textLayer({ id: `t-${n}` })],
    }));
    assert(!validate(p).valid);
  });

  it('accepts shape quota when waiver is set', () => {
    const p = minimal();
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'no scene geometry in this series' };
    p.variety_contract.overlay_strategies_min = 0;
    p.frames = [frameWith({ layers: [textLayer()] })];
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });
});
```

- [ ] **Step 9.2: Run tests — expect all PASS**

Refresh `tests/runner.html`. Expect: all new frame and variety contract tests pass (green).

- [ ] **Step 9.3: Commit**

```bash
git add tests/shared/validator.test.js
git commit -m "test: validator — frame validation + variety contract enforcement tests"
```

---

## Task 10: Validator — Export Helper

**Files:**
- Modify: `shared/validator.js` — add `summarise()` helper

- [ ] **Step 10.1: Append `summarise()` to `shared/validator.js`**

```js
// Add at the bottom of shared/validator.js

/**
 * Returns a structured summary of a valid project for display in the UI.
 * Only call after validate() returns valid: true.
 * @param {object} project
 * @returns {{ frameCount: number, layerCount: number, patternDistribution: object, contractSummary: object }}
 */
export function summarise(project) {
  const layerCount = project.frames.reduce((sum, f) => sum + (f.layers?.length ?? 0), 0);
  const patternDistribution = {};
  for (const frame of project.frames) {
    const p = frame.composition_pattern;
    patternDistribution[p] = (patternDistribution[p] ?? 0) + 1;
  }
  return {
    frameCount: project.frames.length,
    layerCount,
    patternDistribution,
    contractSummary: {
      silenceMap:        project.variety_contract.silence_map,
      overlayStrategies: project.variety_contract.overlay_strategies,
      shapeWaiver:       project.variety_contract.shape_quota?.waiver ?? null,
    },
  };
}
```

- [ ] **Step 10.2: Add summarise test to `tests/shared/validator.test.js`**

```js
// ── append to tests/shared/validator.test.js ──
import { validate, summarise } from '../../shared/validator.js';

describe('validator — summarise', () => {
  it('returns correct frame and layer counts', () => {
    const p = minimal();
    p.frames = [
      frameWith({ id: 'f1', image_filename: 'a.jpg', layers: [textLayer()] }),
      frameWith({ id: 'f2', image_filename: 'b.jpg', composition_pattern: 'minimal-strip', layers: [] }),
    ];
    const s = summarise(p);
    assertEqual(s.frameCount, 2);
    assertEqual(s.layerCount, 1);
  });

  it('returns pattern distribution', () => {
    const p = minimal();
    p.frames = [
      frameWith({ id: 'f1', image_filename: 'a.jpg', composition_pattern: 'editorial-anchor', layers: [] }),
      frameWith({ id: 'f2', image_filename: 'b.jpg', composition_pattern: 'editorial-anchor', layers: [] }),
      frameWith({ id: 'f3', image_filename: 'c.jpg', composition_pattern: 'full-bleed', layers: [] }),
    ];
    const s = summarise(p);
    assertEqual(s.patternDistribution['editorial-anchor'], 2);
    assertEqual(s.patternDistribution['full-bleed'], 1);
  });
});
```

- [ ] **Step 10.3: Fix import in test file**

The `summarise` import was already included in step 10.2. Verify the top of `tests/shared/validator.test.js` still has:
```js
import { validate } from '../../shared/validator.js';
```
Update it to:
```js
import { validate, summarise } from '../../shared/validator.js';
```

- [ ] **Step 10.4: Run tests — expect PASS**

Refresh `tests/runner.html`. Expect: summarise tests green.

- [ ] **Step 10.5: Commit**

```bash
git add shared/validator.js tests/shared/validator.test.js
git commit -m "feat: validator — summarise() helper for UI display"
```

---

## Task 11: Integration Smoke Test

**Files:**
- Create: `tests/integration.html`

Verify all core modules work together in a real browser context — not unit tests, but a wiring check.

- [ ] **Step 11.1: Create `tests/integration.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Integration smoke test</title>
  <style>body{background:#0d0f1a;color:#e2e8f0;font-family:system-ui;padding:24px;}</style>
</head>
<body>
  <h2 style="color:#a5b4fc">Integration Smoke Test</h2>
  <div id="log"></div>
  <script type="module">
    import { AppState }  from '../core/state.js';
    import { events }    from '../core/events.js';
    import { Router }    from '../core/router.js';
    import { storage }   from '../core/storage.js';
    import { validate }  from '../shared/validator.js';
    import { loadFont }  from '../shared/fonts.js';

    const log = document.getElementById('log');
    function ok(msg)   { log.innerHTML += `<div style="color:#10b981">✓ ${msg}</div>`; }
    function fail(msg) { log.innerHTML += `<div style="color:#ef4444">✗ ${msg}</div>`; }

    // 1. AppState
    const state = new AppState();
    state.view === 'manager' ? ok('AppState initialised') : fail('AppState bad initial view');

    // 2. Event bus
    let got = false;
    events.addEventListener('smoke:test', () => got = true);
    events.dispatchEvent(new CustomEvent('smoke:test'));
    got ? ok('Event bus working') : fail('Event bus not working');

    // 3. Router
    document.body.insertAdjacentHTML('beforeend', '<div id="manager-view" hidden></div><div id="editor-view" hidden></div>');
    const router = new Router('manager-view', 'editor-view');
    router.init(state);
    router.navigate('editor');
    !document.getElementById('editor-view').hidden ? ok('Router: editor visible') : fail('Router: editor not visible');
    document.getElementById('manager-view').hidden ? ok('Router: manager hidden') : fail('Router: manager not hidden');

    // 4. Storage
    storage.saveProject({ id: '__smoke__', title: 'smoke', frames: [] });
    const loaded = storage.getProject('__smoke__');
    loaded?.title === 'smoke' ? ok('Storage: save/load working') : fail('Storage: save/load failed');
    storage.deleteProject('__smoke__');
    !storage.getProject('__smoke__') ? ok('Storage: delete working') : fail('Storage: delete failed');

    // 5. Validator
    const proj = {
      project: { id: 'smoke-test', title: 'Smoke', version: '1.0', created: '2026-04-08' },
      export: { target: 'instagram-portrait', width_px: 1080, height_px: 1350, dpi: 72, scale_factor: 2, format: 'png' },
      design_tokens: {
        palette: { background: '#000', primary: '#fff', accent: '#f00', neutral: '#888' },
        type_scale: {
          display: { family: 'Cormorant Garamond', weight: 700, steps: { xl: 12, lg: 10, md: 8, sm: 6 } },
          body:    { family: 'Inter', weight: 400, steps: { md: 3.5, sm: 3.0, xs: 2.5 } },
          data:    { family: 'Inter', weight: 700, steps: { xl: 16, lg: 12, md: 8, sm: 5 } },
        },
        spacing_scale: [4, 6, 8],
      },
      variety_contract: {
        zone_max_usage_pct: 40, shape_quota: { min_per_n_frames: 3, waiver: null },
        overlay_strategies: ['gradient'], overlay_strategies_min: 1,
        accent_color_frames: [], accent_color_min: 0,
        copy_tone_variety: false, silence_map: [], composition_patterns: {},
      },
      globals: { background_color: '#000', safe_zone_pct: 5 },
      frames: [], image_index: [],
    };
    const result = validate(proj);
    result.valid ? ok('Validator: valid project accepted') : fail('Validator: rejected valid project — ' + result.errors[0]);

    // 6. Fonts
    try {
      await loadFont('Inter', [400, 700]);
      ok('Fonts: Inter loaded from Google Fonts');
    } catch(e) {
      fail('Fonts: ' + e.message);
    }
  </script>
</body>
</html>
```

- [ ] **Step 11.2: Open `tests/integration.html` in browser**

Expect: 8 green checkmarks, no red rows. Font loading may take 1–2 seconds on first load.

- [ ] **Step 11.3: Commit**

```bash
git add tests/integration.html
git commit -m "test: integration smoke test — all core modules wired together"
```

---

## Task 12: Final Wiring + README

**Files:**
- Create: `README.md`

- [ ] **Step 12.1: Create `README.md`**

```markdown
# post-composer

Browser-based photography composition tool. No build step, no Node, no dependencies.

## Running

Open with any live server:
- VS Code: Live Server extension → right-click `index.html` → Open with Live Server
- Python: `python -m http.server 5500` → open `http://localhost:5500`

## Tests

Open `tests/runner.html` in browser to run unit tests.
Open `tests/integration.html` in browser for integration smoke test.

## Structure

- `core/`    — state, events, router, storage
- `editor/`  — canvas renderer and editor view (Plan 2)
- `manager/` — project manager view (Plan 4)
- `shared/`  — validator, fonts, visual-analysis
- `ui/`      — stateless UI components
- `styles/`  — CSS
- `tests/`   — browser-based tests
- `docs/`    — specs and plans

## Plans

- Plan 1 (this): Core architecture + JSON contract ✓
- Plan 2: Editor view — renderer, layers, visual analysis, export
- Plan 3: AI pipeline skills redesign
- Plan 4: Project Manager view — brief wizard, package export
```

- [ ] **Step 12.2: Final full test run**

Open `tests/runner.html`. Expect: all tests green.
Open `tests/integration.html`. Expect: all checks green.
Open `index.html`. Expect: dark page, console says "post-composer ready".

- [ ] **Step 12.3: Final commit**

```bash
git add README.md
git commit -m "docs: README with run instructions and plan index"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| Browser-only, no build step | All tasks — pure ES modules, no npm |
| Central AppState class | Task 4 |
| Event bus (no callbacks between modules) | Task 3 |
| Router — view switching without page reload | Task 6 |
| localStorage CRUD | Task 5 |
| design_tokens in JSON schema | Task 8 validator |
| variety_contract in JSON schema | Task 8–9 validator |
| composition_pattern required per frame | Task 8–9 validator |
| shape.role required when shape used | Task 8 validator |
| Single position model (zone anchors) | Task 8 validator |
| Zone distribution enforcement (40% max) | Task 9 validator |
| Shape quota enforcement | Task 9 validator |
| Overlay strategy variety enforcement | Task 8–9 validator |
| Composition pattern distribution enforcement | Task 8 validator |
| Google Fonts loader | Task 7 |
| File max ~300 lines | All files — largest is validator.js (~230 lines) |

**Not in this plan** (deferred to Plan 2+): renderer, layers, visual-analysis, all UI components, editor view, manager view, AI skills.

**Placeholder scan:** No TBDs or TODOs found. All code steps are complete.

**Type consistency check:** `AppState`, `events`, `Router`, `storage`, `validate`, `summarise`, `loadFont`, `loadProjectFonts` — all names consistent across files and tests.
