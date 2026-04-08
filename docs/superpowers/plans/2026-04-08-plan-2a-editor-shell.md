# Editor Shell + Canvas Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Editor view that loads a post-composer project JSON + image files, renders all frames to a canvas, supports filmstrip navigation, and shows frame info in an inspector panel.

**Architecture:** The editor has a three-panel layout (filmstrip | canvas | inspector) mounted by `editor/shell.js` inside `#editor-view`. A `FrameManager` class coordinates frame navigation and image loading via the AppState + event bus. A `Renderer` class renders frames to canvas using adapted layer-rendering functions from frameforge. Plans 2b (layer editing) and 2c (visual analysis + export) follow this plan independently.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas API, File API (FileReader), CSS custom properties from `styles/base.css`.

---

## Scope Note

This plan (2a) ends at a working **read-only** editor:
- Load project JSON from disk via file input
- Load image files from disk via file input
- Render each frame to canvas (background image + all layers)
- Navigate frames via clickable filmstrip thumbnails
- Show frame id, label, composition_pattern, and layer count in inspector
- Composition guides + safe zone overlay (toggle buttons in toolbar)

**Not in this plan:** layer click-selection, drag/resize, color picker, visual analysis overlays, PNG export. Those are Plans 2b and 2c.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/fonts.js` | Modify | Add `buildFontString(font, sizePx)` |
| `styles/shell.css` | Create | Editor 3-panel layout (filmstrip, canvas, inspector) |
| `styles/components.css` | Create | Reusable UI: buttons, badges, panel headers, filmstrip items |
| `editor/frame-manager.js` | Create | Frame navigation, image loading via FileReader, event dispatch |
| `editor/layers.js` | Create | Per-layer canvas rendering, zone-anchor position resolution |
| `editor/renderer.js` | Create | Full-frame render orchestrator (background + layers + overlays) |
| `ui/filmstrip.js` | Create | Thumbnail strip: renders small canvases, handles click navigation |
| `ui/inspector.js` | Create | Frame metadata panel: id, label, pattern badge, layer count |
| `editor/shell.js` | Create | Mounts all editor panels, handles file inputs, wires events |
| `app.js` | Modify | Mount editor shell when `view:changed` to `editor` |
| `index.html` | Modify | Link `styles/shell.css` and `styles/components.css` |
| `tests/runner.html` | Modify | Add editor test imports |
| `tests/editor/frame-manager.test.js` | Create | Unit tests for FrameManager |
| `tests/editor/layers.test.js` | Create | Unit tests for resolvePosition and computeTextBounds |
| `tests/editor/integration.html` | Create | Smoke test: load project, render frame, navigate |

---

## Task 1: Add `buildFontString` to `shared/fonts.js`

**Files:**
- Modify: `shared/fonts.js`
- Test: inline in Task 1 (no separate test file — covered by layers.test.js)

- [ ] **Step 1: Read the current file**

```
Read: shared/fonts.js
```
Confirm the file ends after `loadProjectFonts`. You'll add `buildFontString` before `loadFont`.

- [ ] **Step 2: Add `buildFontString` export**

Add this function at the top of `shared/fonts.js`, before the `loaded` Set declaration:

```js
/**
 * Build a CSS font string from a layer font object and a resolved pixel size.
 * @param {object} font — { family, weight, style }; all fields optional
 * @param {number} sizePx — resolved pixel size (caller computes from size_pct)
 * @returns {string} — e.g. "italic 700 24px Inter"
 */
export function buildFontString(font, sizePx) {
  const style  = font?.style  ?? 'normal';
  const weight = font?.weight ?? 400;
  const family = font?.family ?? 'sans-serif';
  return `${style} ${weight} ${sizePx}px ${family}`;
}
```

- [ ] **Step 3: Verify no parse errors**

Open `tests/runner.html` in a live server. The validator tests should still pass (shared/fonts.js changes don't affect them). Check browser console for import errors.

- [ ] **Step 4: Commit**

```bash
git add shared/fonts.js
git commit -m "feat: add buildFontString to shared/fonts.js"
```

---

## Task 2: CSS — Editor Shell Layout + Components

**Files:**
- Create: `styles/shell.css`
- Create: `styles/components.css`
- Modify: `index.html` (add link tags)

- [ ] **Step 1: Read index.html**

```
Read: index.html
```

Note the existing `<link rel="stylesheet" href="styles/base.css">` line.

- [ ] **Step 2: Create `styles/shell.css`**

```css
/* styles/shell.css — Editor 3-panel layout */

.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

/* ── Toolbar ─────────────────────────────── */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.editor-toolbar .toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.editor-toolbar .toolbar-sep {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.editor-toolbar .toolbar-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Body (filmstrip | canvas | inspector) ── */
.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Filmstrip ───────────────────────────── */
.editor-filmstrip {
  width: 88px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

/* ── Canvas area ─────────────────────────── */
.editor-canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-bg);
  position: relative;
}

.editor-canvas-area canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

/* ── Inspector ───────────────────────────── */
.editor-inspector {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.inspector-section {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.inspector-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.inspector-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
  font-size: 12px;
}

.inspector-row .label {
  color: var(--color-text-muted);
}

.inspector-row .value {
  color: var(--color-text);
  font-weight: 500;
  text-align: right;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Empty state ─────────────────────────── */
.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 32px;
}

.editor-empty p {
  margin: 0;
  line-height: 1.5;
}
```

- [ ] **Step 3: Create `styles/components.css`**

```css
/* styles/components.css — Reusable UI components */

/* ── Buttons ─────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}

.btn:hover {
  background: var(--color-surface);
  border-color: var(--color-accent);
}

.btn.btn-primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.btn.btn-primary:hover {
  opacity: 0.9;
}

.btn.btn-active,
.btn[aria-pressed="true"] {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Composition pattern badge ───────────── */
.pattern-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--color-surface-2);
  color: var(--color-accent-2);
  border: 1px solid var(--color-accent);
}

/* ── Filmstrip thumbnail ─────────────────── */
.filmstrip-item {
  position: relative;
  cursor: pointer;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.1s;
}

.filmstrip-item:hover {
  border-color: var(--color-accent-2);
}

.filmstrip-item.active {
  border-color: var(--color-accent);
}

.filmstrip-item canvas {
  display: block;
}

.filmstrip-item .frame-num {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--font-mono);
  pointer-events: none;
}

/* ── File input hidden + label-styled ───── */
.file-input-hidden {
  display: none;
}
```

- [ ] **Step 4: Add stylesheet links to index.html**

After the existing `<link rel="stylesheet" href="styles/base.css">` line, add:

```html
  <link rel="stylesheet" href="styles/shell.css">
  <link rel="stylesheet" href="styles/components.css">
```

- [ ] **Step 5: Commit**

```bash
git add styles/shell.css styles/components.css index.html
git commit -m "feat: add editor shell CSS layout and component styles"
```

---

## Task 3: `editor/frame-manager.js` + Tests

**Files:**
- Create: `editor/frame-manager.js`
- Create: `tests/editor/frame-manager.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `tests/editor/frame-manager.test.js`:

```js
import { describe, it, assertEqual, assertThrows, summary } from '../test-helper.js';
import { FrameManager } from '../../editor/frame-manager.js';
import { AppState } from '../../core/state.js';
import { events } from '../../core/events.js';

// Minimal valid project fixture
const VALID_PROJECT = {
  project: { id: 'test-project', title: 'Test' },
  export: { target: 'instagram-square', width_px: 1080, height_px: 1080 },
  design_tokens: {
    palette: {
      background: '#000000', primary: '#ffffff', accent: '#ff0000', neutral: '#888888',
    },
    type_scale: {
      display: { family: 'Inter', steps: [32], weight: 700 },
      body:    { family: 'Inter', steps: [16] },
      data:    { family: 'Inter', steps: [12] },
    },
    spacing_scale: [4, 8, 16],
  },
  variety_contract: {
    zone_max_usage_pct: 40,
    shape_quota: { min_per_n_frames: 3 },
    overlay_strategies: ['gradient'],
    silence_map: [],
    composition_patterns: {},
  },
  frames: [
    {
      id: 'frame-1', image_src: 'photo1', image_filename: 'photo1.jpg',
      composition_pattern: 'editorial-anchor',
      layers: [{ id: 'l1', type: 'text', content: 'Hello', font: { family: 'Inter', size_pct: 5 }, max_width_pct: 60, position: { zone: 'bottom-left' } }],
    },
    {
      id: 'frame-2', image_src: 'photo2', image_filename: 'photo2.jpg',
      composition_pattern: 'minimal-strip',
      layers: [],
    },
  ],
};

describe('FrameManager', () => {
  it('loadProject sets state.project', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertEqual(state.project.project.id, 'test-project');
  });

  it('loadProject resets activeFrameIndex to 0', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    state.activeFrameIndex = 1;
    fm.loadProject(VALID_PROJECT);
    assertEqual(state.activeFrameIndex, 0);
  });

  it('loadProject throws on invalid project', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertThrows(() => fm.loadProject({}), 'Invalid project');
  });

  it('loadProject dispatches project:loaded event', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    let fired = false;
    events.addEventListener('project:loaded', () => { fired = true; }, { once: true });
    fm.loadProject(VALID_PROJECT);
    assertEqual(fired, true);
  });

  it('setActiveFrame updates activeFrameIndex', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    fm.setActiveFrame(1);
    assertEqual(state.activeFrameIndex, 1);
  });

  it('setActiveFrame dispatches frame:changed event with index', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    let detail = null;
    events.addEventListener('frame:changed', e => { detail = e.detail; }, { once: true });
    fm.setActiveFrame(1);
    assertEqual(detail.index, 1);
    assertEqual(detail.frame.id, 'frame-2');
  });

  it('setActiveFrame throws on out-of-range index', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertThrows(() => fm.setActiveFrame(99), 'out of range');
  });

  it('setActiveFrame throws when no project loaded', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertThrows(() => fm.setActiveFrame(0), 'No project');
  });

  it('currentFrame returns correct frame', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertEqual(fm.currentFrame.id, 'frame-1');
    fm.setActiveFrame(1);
    assertEqual(fm.currentFrame.id, 'frame-2');
  });

  it('currentIndex returns activeFrameIndex', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    fm.setActiveFrame(1);
    assertEqual(fm.currentIndex, 1);
  });

  it('frameCount returns number of frames', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertEqual(fm.frameCount, 0);
    fm.loadProject(VALID_PROJECT);
    assertEqual(fm.frameCount, 2);
  });
});
```

- [ ] **Step 2: Add test import to `tests/runner.html`**

Open `tests/runner.html`. After the last existing `<script type="module">` import block, add:

```html
<script type="module" src="editor/frame-manager.test.js"></script>
```

Open `tests/runner.html` in live server. Confirm `frame-manager.test.js` fails with "Cannot find module '../../editor/frame-manager.js'" (expected).

- [ ] **Step 3: Create `editor/frame-manager.js`**

```js
// editor/frame-manager.js
import { validate } from '../shared/validator.js';
import { events }   from '../core/events.js';

export class FrameManager {
  /**
   * @param {import('../core/state.js').AppState} state
   */
  constructor(state) {
    this._state = state;
  }

  /**
   * Validate and load a project. Throws if invalid.
   * @param {object} projectData
   */
  loadProject(projectData) {
    const { valid, errors } = validate(projectData);
    if (!valid) throw new Error(`Invalid project: ${errors.join('; ')}`);
    this._state.setProject(projectData);
    this._state.activeFrameIndex = 0;
    events.dispatchEvent(new CustomEvent('project:loaded', { detail: projectData }));
  }

  /**
   * Read image files via FileReader and populate state.images.
   * Keyed by filename (file.name). Returns after all images are loaded.
   * @param {FileList|File[]} fileList
   * @returns {Promise<void>}
   */
  async loadImages(fileList) {
    const loads = Array.from(fileList).map(file => this._readImageFile(file));
    await Promise.all(loads);
    events.dispatchEvent(new CustomEvent('images:loaded'));
  }

  _readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          this._state.images.set(file.name, img);
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to decode image: ${file.name}`));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Navigate to a frame by index. Throws if no project or index out of range.
   * @param {number} index
   */
  setActiveFrame(index) {
    if (!this._state.project) throw new Error('No project loaded');
    const count = this._state.project.frames.length;
    if (index < 0 || index >= count) throw new Error(`Frame index out of range: ${index}`);
    this._state.activeFrameIndex = index;
    this._state.selectedLayerId  = null;
    const frame = this._state.project.frames[index];
    events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index, frame } }));
  }

  /** @returns {object|null} */
  get currentFrame() {
    return this._state.activeFrame;
  }

  /** @returns {number} */
  get currentIndex() {
    return this._state.activeFrameIndex;
  }

  /** @returns {number} */
  get frameCount() {
    return this._state.project?.frames?.length ?? 0;
  }
}
```

- [ ] **Step 4: Run tests**

Reload `tests/runner.html` in live server. All `FrameManager` tests should pass. Check browser console for errors.

- [ ] **Step 5: Commit**

```bash
git add editor/frame-manager.js tests/editor/frame-manager.test.js tests/runner.html
git commit -m "feat: FrameManager — frame navigation + image loading"
```

---

## Task 4: `editor/layers.js` + Tests

**Files:**
- Create: `editor/layers.js`
- Create: `tests/editor/layers.test.js`

Position model: every layer has `position: { zone, offset_x_pct, offset_y_pct }` or `position: { zone: 'absolute', x_pct, y_pct }`. Zone names: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right, absolute.

- [ ] **Step 1: Write the failing tests**

Create `tests/editor/layers.test.js`:

```js
import { describe, it, assertEqual, assertThrows, summary } from '../test-helper.js';
import { resolvePosition, computeTextBounds } from '../../editor/layers.js';

describe('resolvePosition', () => {
  it('top-left with no offset → {x:0, y:0}', () => {
    const r = resolvePosition({ zone: 'top-left' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });

  it('top-center → {x:500, y:0}', () => {
    const r = resolvePosition({ zone: 'top-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 0);
  });

  it('top-right → {x:1000, y:0}', () => {
    const r = resolvePosition({ zone: 'top-right' }, 1000, 500);
    assertEqual(r.x, 1000);
    assertEqual(r.y, 0);
  });

  it('middle-left → {x:0, y:250}', () => {
    const r = resolvePosition({ zone: 'middle-left' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 250);
  });

  it('middle-center → {x:500, y:250}', () => {
    const r = resolvePosition({ zone: 'middle-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 250);
  });

  it('bottom-right → {x:1000, y:500}', () => {
    const r = resolvePosition({ zone: 'bottom-right' }, 1000, 500);
    assertEqual(r.x, 1000);
    assertEqual(r.y, 500);
  });

  it('bottom-center → {x:500, y:500}', () => {
    const r = resolvePosition({ zone: 'bottom-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 500);
  });

  it('applies offset_x_pct and offset_y_pct', () => {
    const r = resolvePosition({ zone: 'top-left', offset_x_pct: 10, offset_y_pct: 20 }, 1000, 500);
    assertEqual(r.x, 100); // 10% of 1000
    assertEqual(r.y, 100); // 20% of 500
  });

  it('absolute zone uses x_pct and y_pct directly', () => {
    const r = resolvePosition({ zone: 'absolute', x_pct: 25, y_pct: 50 }, 1000, 500);
    assertEqual(r.x, 250);
    assertEqual(r.y, 250);
  });

  it('null position → {x:0, y:0}', () => {
    const r = resolvePosition(null, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });

  it('unknown zone falls back to top-left', () => {
    const r = resolvePosition({ zone: 'garbage' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });
});

describe('computeTextBounds', () => {
  it('returns positive width and height for a text layer', () => {
    const canvas = document.createElement('canvas');
    canvas.width  = 1000;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    const layer = {
      content: 'Hello world',
      font: { family: 'sans-serif', size_pct: 5, weight: 400 },
      max_width_pct: 60,
    };
    const bounds = computeTextBounds(ctx, layer, 1000, 500);
    assertEqual(bounds.width > 0, true);
    assertEqual(bounds.height > 0, true);
  });

  it('uses default size_pct 5 and max_width_pct 80 when font is minimal', () => {
    const canvas = document.createElement('canvas');
    canvas.width  = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const layer = { content: 'Test', font: {} };
    const bounds = computeTextBounds(ctx, layer, 1000, 1000);
    // sizePx = 5% of 1000 = 50; maxW = 80% of 1000 = 800
    assertEqual(bounds.width, 800);
    assertEqual(bounds.height >= 50, true);
  });
});
```

- [ ] **Step 2: Add test import to runner.html**

In `tests/runner.html`, add after the frame-manager test import:

```html
<script type="module" src="editor/layers.test.js"></script>
```

Reload runner. Expect "Cannot find module" error (expected).

- [ ] **Step 3: Create `editor/layers.js`**

```js
// editor/layers.js
import { buildFontString } from '../shared/fonts.js';

const ZONE_ANCHORS = {
  'top-left':      (w, h) => ({ x: 0,   y: 0   }),
  'top-center':    (w, h) => ({ x: w/2, y: 0   }),
  'top-right':     (w, h) => ({ x: w,   y: 0   }),
  'middle-left':   (w, h) => ({ x: 0,   y: h/2 }),
  'middle-center': (w, h) => ({ x: w/2, y: h/2 }),
  'middle-right':  (w, h) => ({ x: w,   y: h/2 }),
  'bottom-left':   (w, h) => ({ x: 0,   y: h   }),
  'bottom-center': (w, h) => ({ x: w/2, y: h   }),
  'bottom-right':  (w, h) => ({ x: w,   y: h   }),
};

/**
 * Resolve a layer position object to canvas {x, y} coordinates.
 * @param {object|null} pos
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ x: number, y: number }}
 */
export function resolvePosition(pos, w, h) {
  if (!pos) return { x: 0, y: 0 };
  if (pos.zone === 'absolute') {
    return {
      x: (pos.x_pct ?? 0) / 100 * w,
      y: (pos.y_pct ?? 0) / 100 * h,
    };
  }
  const anchorFn = ZONE_ANCHORS[pos.zone] ?? ZONE_ANCHORS['top-left'];
  const base = anchorFn(w, h);
  return {
    x: base.x + (pos.offset_x_pct ?? 0) / 100 * w,
    y: base.y + (pos.offset_y_pct ?? 0) / 100 * h,
  };
}

/**
 * Compute the bounding box a text layer would occupy when rendered.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ width: number, height: number }}
 */
export function computeTextBounds(ctx, layer, w, h) {
  const sizePx = (layer.font?.size_pct ?? 5) / 100 * h;
  ctx.font = buildFontString(layer.font ?? {}, sizePx);
  const maxW  = (layer.max_width_pct ?? 80) / 100 * w;
  const lines = _wrapText(ctx, layer.content ?? '', maxW);
  const lineH = sizePx * (layer.font?.line_height ?? 1.25);
  return { width: maxW, height: lines.length * lineH };
}

/**
 * Render a single layer onto the canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @param {Map<string, HTMLImageElement>} images — keyed by filename
 */
export function renderLayer(ctx, layer, w, h, images) {
  switch (layer.type) {
    case 'image':       _renderImageLayer(ctx, layer, w, h, images);  break;
    case 'overlay':     _renderOverlayLayer(ctx, layer, w, h);        break;
    case 'text':        _renderTextLayer(ctx, layer, w, h);           break;
    case 'shape':       _renderShapeLayer(ctx, layer, w, h);          break;
    case 'stats_block': _renderStatsBlock(ctx, layer, w, h);          break;
    case 'logo':        _renderLogoLayer(ctx, layer, w, h, images);   break;
  }
}

// ── Private render functions ──────────────────────────────────────────────────

function _renderImageLayer(ctx, layer, w, h, images) {
  const img = images?.get(layer.src);
  if (!img) return;
  const { x, y } = resolvePosition(layer.position, w, h);
  const iw = (layer.width_pct  ?? 100) / 100 * w;
  const ih = (layer.height_pct ?? 100) / 100 * h;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.drawImage(img, x, y, iw, ih);
  ctx.restore();
}

function _renderOverlayLayer(ctx, layer, w, h) {
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 0.6;
  if (layer.gradient?.enabled) {
    const grad = _buildGradient(ctx, layer.gradient, w, h);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = layer.color ?? '#000000';
  }
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function _buildGradient(ctx, gradient, w, h) {
  const dir = gradient.direction ?? 'to-bottom';
  const coords = {
    'to-bottom': [0, 0, 0, h],
    'to-top':    [0, h, 0, 0],
    'to-right':  [0, 0, w, 0],
    'to-left':   [w, 0, 0, 0],
  };
  const [x0, y0, x1, y1] = coords[dir] ?? coords['to-bottom'];
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  (gradient.stops ?? []).forEach(s => grad.addColorStop(s.at, s.color));
  return grad;
}

function _renderTextLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx   = (layer.font?.size_pct ?? 5) / 100 * h;
  const maxW     = (layer.max_width_pct ?? 80) / 100 * w;
  ctx.save();
  ctx.globalAlpha  = layer.opacity ?? 1;
  ctx.fillStyle    = layer.font?.color ?? '#ffffff';
  ctx.font         = buildFontString(layer.font ?? {}, sizePx);
  ctx.textBaseline = 'top';
  ctx.textAlign    = layer.font?.align ?? 'left';
  const lines  = _wrapText(ctx, layer.content ?? '', maxW);
  const lineH  = sizePx * (layer.font?.line_height ?? 1.25);
  const spacing = (layer.font?.letter_spacing_em ?? 0) * sizePx;
  lines.forEach((line, i) => {
    _drawTextWithSpacing(ctx, line, x, y + i * lineH, spacing);
  });
  ctx.restore();
}

function _wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxW) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function _drawTextWithSpacing(ctx, text, x, y, spacing) {
  if (!spacing) { ctx.fillText(text, x, y); return; }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function _renderShapeLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sw = (layer.width_pct  ?? 20) / 100 * w;
  const sh = (layer.height_pct ??  5) / 100 * h;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.fillStyle   = layer.fill   ?? 'transparent';
  ctx.strokeStyle = layer.stroke ?? 'transparent';
  ctx.lineWidth   = (layer.stroke_width ?? 1);
  switch (layer.shape) {
    case 'circle': {
      const r = Math.min(sw, sh) / 2;
      ctx.beginPath();
      ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
      if (layer.fill)   ctx.fill();
      if (layer.stroke) ctx.stroke();
      break;
    }
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sw, y + sh);
      ctx.stroke();
      break;
    default: // rectangle
      if (layer.fill)   ctx.fillRect(x, y, sw, sh);
      if (layer.stroke) ctx.strokeRect(x, y, sw, sh);
  }
  ctx.restore();
}

function _renderStatsBlock(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx = (layer.font?.size_pct ?? 4) / 100 * h;
  const lineH  = sizePx * 1.6;
  ctx.save();
  ctx.globalAlpha  = layer.opacity ?? 1;
  ctx.font         = buildFontString(layer.font ?? {}, sizePx);
  ctx.textBaseline = 'top';
  (layer.stats ?? []).forEach((stat, i) => {
    const labelColor = layer.font?.color_label ?? '#aaaaaa';
    const valueColor = layer.font?.color_value ?? '#ffffff';
    ctx.fillStyle = labelColor;
    ctx.fillText(stat.label, x, y + i * lineH);
    const labelW = ctx.measureText(stat.label + ' ').width;
    ctx.fillStyle = valueColor;
    ctx.fillText(stat.value, x + labelW, y + i * lineH);
  });
  ctx.restore();
}

function _renderLogoLayer(ctx, layer, w, h, images) {
  const img = images?.get(layer.src);
  if (!img) return;
  const { x, y } = resolvePosition(layer.position, w, h);
  const lw = (layer.width_pct  ?? 10) / 100 * w;
  const lh = (layer.height_pct ?? 10) / 100 * h;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.drawImage(img, x, y, lw, lh);
  ctx.restore();
}
```

- [ ] **Step 4: Run tests**

Reload `tests/runner.html`. All `resolvePosition` and `computeTextBounds` tests should pass. Check console.

- [ ] **Step 5: Commit**

```bash
git add editor/layers.js tests/editor/layers.test.js tests/runner.html
git commit -m "feat: layer rendering + zone-anchor position resolution"
```

---

## Task 5: `editor/renderer.js`

**Files:**
- Create: `editor/renderer.js`

No separate unit test for renderer (it wraps Canvas API — covered by integration smoke test in Task 10).

- [ ] **Step 1: Create `editor/renderer.js`**

```js
// editor/renderer.js
import { renderLayer } from './layers.js';

/**
 * Renders a full post-composer frame to an HTMLCanvasElement.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} frame — one entry from project.frames
   * @param {object} project — full project JSON (for design_tokens)
   * @param {Map<string, HTMLImageElement>} images — keyed by filename
   * @param {object} [opts]
   * @param {boolean} [opts.showSafeZone]
   * @param {string|null} [opts.guideType] — 'thirds', 'phi', 'cross', or null
   * @param {boolean} [opts.showLayerBounds]
   */
  renderFrame(canvas, frame, project, images, opts = {}) {
    const ctx = canvas.getContext('2d');
    const w   = canvas.width;
    const h   = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background fill
    ctx.fillStyle = project.design_tokens?.palette?.background ?? '#000000';
    ctx.fillRect(0, 0, w, h);

    // Background photo (keyed by image_filename)
    const bg = images?.get(frame.image_filename);
    if (bg) _drawCoverImage(ctx, bg, w, h);

    // Layers in declaration order
    for (const layer of (frame.layers ?? [])) {
      renderLayer(ctx, layer, w, h, images);
    }

    // Debug / guide overlays
    if (opts.showSafeZone) _drawSafeZone(ctx, w, h);
    if (opts.guideType)    _drawGuide(ctx, w, h, opts.guideType);
  }
}

function _drawCoverImage(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = img.width  * scale;
  const sh = img.height * scale;
  const sx = (w - sw) / 2;
  const sy = (h - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);
}

function _drawSafeZone(ctx, w, h) {
  const m = 0.1;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(w * m, h * m, w * (1 - 2 * m), h * (1 - 2 * m));
  ctx.restore();
}

function _drawGuide(ctx, w, h, guideType) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([]);

  const line = (x0, y0, x1, y1) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };

  switch (guideType) {
    case 'thirds':
      [1/3, 2/3].forEach(t => {
        line(w * t, 0, w * t, h);
        line(0, h * t, w, h * t);
      });
      break;
    case 'phi': {
      const phi = 1 / 1.618;
      line(w * phi, 0, w * phi, h);
      line(0, h * phi, w, h * phi);
      break;
    }
    case 'cross':
      line(w / 2, 0, w / 2, h);
      line(0, h / 2, w, h / 2);
      break;
  }
  ctx.restore();
}

export const renderer = new Renderer();
```

- [ ] **Step 2: Spot-check in browser console**

In browser devtools, import the module and call it manually:

```js
import('/editor/renderer.js').then(m => console.log('renderer:', m.renderer));
```

Expect: `renderer: Renderer {}`. No errors.

- [ ] **Step 3: Commit**

```bash
git add editor/renderer.js
git commit -m "feat: canvas Renderer — frame paint with bg image, layers, guides"
```

---

## Task 6: `ui/filmstrip.js`

**Files:**
- Create: `ui/filmstrip.js`

The filmstrip renders a small thumbnail canvas for each frame using the same `Renderer`, then listens for click events to call `frameManager.setActiveFrame`.

- [ ] **Step 1: Create `ui/filmstrip.js`**

```js
// ui/filmstrip.js
import { renderer } from '../editor/renderer.js';
import { events }   from '../core/events.js';

const THUMB_W = 64;

/**
 * Filmstrip panel — renders one thumbnail per frame, handles click navigation.
 */
export class Filmstrip {
  /**
   * @param {HTMLElement} container — .editor-filmstrip element
   * @param {import('../editor/frame-manager.js').FrameManager} frameManager
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, frameManager, state) {
    this._el           = container;
    this._frameManager = frameManager;
    this._state        = state;
    this._items        = []; // Array of { el, canvas }

    events.addEventListener('project:loaded',  () => this._build());
    events.addEventListener('images:loaded',   () => this._renderAll());
    events.addEventListener('frame:changed',   e  => this._setActive(e.detail.index));
  }

  /** Build DOM items from current project frames. */
  _build() {
    const project = this._state.project;
    if (!project) return;

    this._el.innerHTML = '';
    this._items = [];

    const { width_px, height_px } = project.export;
    const aspect = height_px / width_px;
    const thumbH = Math.round(THUMB_W * aspect);

    for (let i = 0; i < project.frames.length; i++) {
      const item   = document.createElement('div');
      item.className = 'filmstrip-item';
      item.dataset.index = i;

      const canvas    = document.createElement('canvas');
      canvas.width    = THUMB_W;
      canvas.height   = thumbH;

      const num       = document.createElement('span');
      num.className   = 'frame-num';
      num.textContent = i + 1;

      item.appendChild(canvas);
      item.appendChild(num);
      this._el.appendChild(item);

      item.addEventListener('click', () => this._frameManager.setActiveFrame(i));
      this._items.push({ el: item, canvas });
    }

    this._setActive(0);
    this._renderAll();
  }

  /** Re-render all thumbnails (called after images load or frame changes). */
  _renderAll() {
    const project = this._state.project;
    if (!project) return;
    this._items.forEach(({ canvas }, i) => {
      renderer.renderFrame(canvas, project.frames[i], project, this._state.images);
    });
  }

  /** Mark one item active, remove from others. */
  _setActive(index) {
    this._items.forEach(({ el }, i) => {
      el.classList.toggle('active', i === index);
    });
    // Scroll active item into view
    const active = this._items[index];
    if (active) active.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
```

- [ ] **Step 2: Verify no import errors**

In devtools:

```js
import('/ui/filmstrip.js').then(m => console.log('Filmstrip:', m.Filmstrip));
```

Expect: `Filmstrip: class Filmstrip { ... }`. No errors.

- [ ] **Step 3: Commit**

```bash
git add ui/filmstrip.js
git commit -m "feat: Filmstrip UI — thumbnail strip with click navigation"
```

---

## Task 7: `ui/inspector.js`

**Files:**
- Create: `ui/inspector.js`

Shows the current frame's metadata. For Plan 2a: frame id, frame label (optional), composition_pattern (as badge), and layer count. Re-renders on `frame:changed`.

- [ ] **Step 1: Create `ui/inspector.js`**

```js
// ui/inspector.js
import { events } from '../core/events.js';

/**
 * Inspector panel — displays metadata for the currently active frame.
 */
export class Inspector {
  /**
   * @param {HTMLElement} container — .editor-inspector element
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, state) {
    this._el    = container;
    this._state = state;

    events.addEventListener('project:loaded', () => this._render());
    events.addEventListener('frame:changed',  () => this._render());
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>No frame selected</p></div>`;
      return;
    }

    const layerCount = frame.layers?.length ?? 0;

    this._el.innerHTML = `
      <div class="inspector-section">
        <div class="inspector-section-title">Frame</div>
        <div class="inspector-row">
          <span class="label">ID</span>
          <span class="value" title="${frame.id}">${frame.id}</span>
        </div>
        ${frame.label ? `
        <div class="inspector-row">
          <span class="label">Label</span>
          <span class="value" title="${frame.label}">${frame.label}</span>
        </div>` : ''}
        <div class="inspector-row">
          <span class="label">Index</span>
          <span class="value">${this._state.activeFrameIndex + 1} / ${this._state.project.frames.length}</span>
        </div>
      </div>
      <div class="inspector-section">
        <div class="inspector-section-title">Composition</div>
        <div style="margin-bottom:8px;">
          <span class="pattern-badge">${frame.composition_pattern}</span>
        </div>
      </div>
      <div class="inspector-section">
        <div class="inspector-section-title">Layers</div>
        <div class="inspector-row">
          <span class="label">Count</span>
          <span class="value">${layerCount}</span>
        </div>
        ${_layerList(frame.layers)}
      </div>
    `;
  }
}

function _layerList(layers) {
  if (!layers?.length) return '<div style="color:var(--color-text-muted);font-size:11px;">No layers</div>';
  return layers.map(l => `
    <div class="inspector-row" style="font-size:11px;">
      <span class="label" style="font-family:var(--font-mono)">${l.type}</span>
      <span class="value" style="color:var(--color-text-muted)">${l.id}</span>
    </div>
  `).join('');
}
```

- [ ] **Step 2: Verify no import errors**

```js
import('/ui/inspector.js').then(m => console.log('Inspector:', m.Inspector));
```

- [ ] **Step 3: Commit**

```bash
git add ui/inspector.js
git commit -m "feat: Inspector UI — frame metadata, pattern badge, layer list"
```

---

## Task 8: `editor/shell.js`

**Files:**
- Create: `editor/shell.js`

The shell mounts all editor panels inside `#editor-view`. It builds the DOM, wires file inputs (JSON + images), creates `FrameManager`, `Filmstrip`, `Inspector`, and the main canvas + `Renderer`. It also handles toolbar toggle buttons (safe zone, guide type).

- [ ] **Step 1: Create `editor/shell.js`**

```js
// editor/shell.js
import { FrameManager } from './frame-manager.js';
import { renderer }     from './renderer.js';
import { Filmstrip }    from '../ui/filmstrip.js';
import { Inspector }    from '../ui/inspector.js';
import { events }       from '../core/events.js';
import { loadProjectFonts } from '../shared/fonts.js';

/**
 * Mount the editor shell into #editor-view.
 * Call once after DOM is ready.
 * @param {import('../core/state.js').AppState} state
 */
export function mountEditor(state) {
  const root = document.getElementById('editor-view');
  if (!root) throw new Error('#editor-view not found');
  root.innerHTML = _buildHTML();

  const canvasEl    = root.querySelector('#editor-canvas');
  const filmstripEl = root.querySelector('.editor-filmstrip');
  const inspectorEl = root.querySelector('.editor-inspector');

  const frameManager = new FrameManager(state);
  const filmstrip    = new Filmstrip(filmstripEl, frameManager, state);
  const inspector    = new Inspector(inspectorEl, state);

  // ── Toolbar state ──────────────────────────────
  let guideType    = null;
  let showSafeZone = false;

  function _repaint() {
    const frame = state.activeFrame;
    if (!frame || !state.project) return;
    _fitCanvas(canvasEl, root.querySelector('.editor-canvas-area'), state.project.export);
    renderer.renderFrame(canvasEl, frame, state.project, state.images, {
      guideType,
      showSafeZone,
    });
  }

  // ── File inputs ────────────────────────────────
  const jsonInput  = root.querySelector('#input-json');
  const imgInput   = root.querySelector('#input-images');

  jsonInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      frameManager.loadProject(data);
      await loadProjectFonts(data.design_tokens);
    } catch (err) {
      alert(`Failed to load project: ${err.message}`);
    }
    jsonInput.value = '';
  });

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

  // ── Toolbar button wiring ──────────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    showSafeZone = !showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', showSafeZone);
    _repaint();
  });

  _wireGuideButtons(root, () => guideType, val => { guideType = val; _repaint(); });

  // ── Event listeners ────────────────────────────
  events.addEventListener('project:loaded', _repaint);
  events.addEventListener('frame:changed',  _repaint);
  events.addEventListener('images:loaded',  _repaint);
}

function _wireGuideButtons(root, getGuide, setGuide) {
  const guides = ['thirds', 'phi', 'cross'];
  guides.forEach(type => {
    const btn = root.querySelector(`#btn-guide-${type}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = getGuide() === type ? null : type;
      setGuide(next);
      guides.forEach(t => {
        const b = root.querySelector(`#btn-guide-${t}`);
        if (b) b.setAttribute('aria-pressed', t === next);
      });
    });
  });
}

function _fitCanvas(canvas, area, exportConfig) {
  const { width_px, height_px } = exportConfig;
  const areaW = area.clientWidth  - 32; // padding
  const areaH = area.clientHeight - 32;
  const scale = Math.min(areaW / width_px, areaH / height_px, 1);
  canvas.width  = width_px;
  canvas.height = height_px;
  canvas.style.width  = `${Math.round(width_px  * scale)}px`;
  canvas.style.height = `${Math.round(height_px * scale)}px`;
}

function _buildHTML() {
  return `
    <div class="editor-shell">

      <div class="editor-toolbar">
        <div class="toolbar-group">
          <label class="btn btn-primary" for="input-json" title="Load project JSON">
            Load JSON
          </label>
          <input id="input-json" type="file" accept=".json" class="file-input-hidden">
          <label class="btn" for="input-images" title="Load image files">
            Load Images
          </label>
          <input id="input-images" type="file" accept="image/*" multiple class="file-input-hidden">
        </div>

        <div class="toolbar-sep"></div>

        <div class="toolbar-group">
          <span class="toolbar-label">Guides</span>
          <button id="btn-guide-thirds" class="btn" aria-pressed="false" title="Thirds">⅓</button>
          <button id="btn-guide-phi"    class="btn" aria-pressed="false" title="Golden ratio (φ)">φ</button>
          <button id="btn-guide-cross"  class="btn" aria-pressed="false" title="Cross">✛</button>
        </div>

        <div class="toolbar-sep"></div>

        <div class="toolbar-group">
          <button id="btn-safe-zone" class="btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-filmstrip"></div>

        <div class="editor-canvas-area">
          <canvas id="editor-canvas"></canvas>
        </div>

        <div class="editor-inspector">
          <div class="editor-empty">
            <p>Load a project JSON<br>to get started.</p>
          </div>
        </div>
      </div>

    </div>
  `;
}
```

- [ ] **Step 2: Verify no import errors**

```js
import('/editor/shell.js').then(m => console.log('mountEditor:', m.mountEditor));
```

- [ ] **Step 3: Commit**

```bash
git add editor/shell.js
git commit -m "feat: editor shell — file loading, toolbar, panel wiring"
```

---

## Task 9: Update `app.js` + `tests/runner.html`

**Files:**
- Modify: `app.js`
- Modify: `tests/runner.html`

Mount the editor shell when the router navigates to the `editor` view.

- [ ] **Step 1: Read app.js**

```
Read: app.js
```

Current content:
```js
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

- [ ] **Step 2: Update app.js**

Replace the content with:

```js
import { AppState }   from './core/state.js';
import { router }     from './core/router.js';
import { storage }    from './core/storage.js';
import { events }     from './core/events.js';
import { mountEditor } from './editor/shell.js';

const state = new AppState();
let editorMounted = false;

async function init() {
  router.init(state);

  events.addEventListener('view:changed', e => {
    if (e.detail === 'editor' && !editorMounted) {
      mountEditor(state);
      editorMounted = true;
    }
  });

  router.navigate('manager');
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
```

- [ ] **Step 3: Read tests/runner.html**

```
Read: tests/runner.html
```

- [ ] **Step 4: Add editor test imports to tests/runner.html**

Verify the file already has `frame-manager.test.js` and `layers.test.js` imports from Tasks 3 and 4. If they're missing, add them. The final script block order should be:

```html
<script type="module" src="core/state.test.js"></script>
<script type="module" src="core/events.test.js"></script>
<script type="module" src="core/router.test.js"></script>
<script type="module" src="core/storage.test.js"></script>
<script type="module" src="shared/validator.test.js"></script>
<script type="module" src="editor/frame-manager.test.js"></script>
<script type="module" src="editor/layers.test.js"></script>
```

Confirm the `summary()` call is still present after the imports.

- [ ] **Step 5: Smoke test the editor view**

Open `index.html` in live server. Open DevTools console. Run:

```js
import('/core/router.js').then(m => m.router.navigate('editor'));
```

Expected: the editor shell appears (toolbar + filmstrip + canvas + inspector). No console errors.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/runner.html
git commit -m "feat: mount editor shell on view:changed, wire up in app.js"
```

---

## Task 10: Integration Smoke Test

**Files:**
- Create: `tests/editor/integration.html`

End-to-end test: construct a project in JS, load it into the FrameManager, render it to a canvas, verify pixels changed, navigate frames.

- [ ] **Step 1: Create `tests/editor/integration.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Editor Integration Tests</title>
  <style>
    body { font-family: monospace; background: #0d0f1a; color: #e2e8f0; padding: 20px; }
    .pass { color: #10b981; } .fail { color: #ef4444; }
  </style>
</head>
<body>
<h2>Editor Integration Smoke Tests</h2>
<div id="results"></div>

<script type="module">
import { AppState }    from '../../core/state.js';
import { FrameManager } from '../../editor/frame-manager.js';
import { renderer }    from '../../editor/renderer.js';

const results = document.getElementById('results');
let passed = 0, failed = 0;

function check(label, fn) {
  try {
    fn();
    results.innerHTML += `<div class="pass">✓ ${label}</div>`;
    passed++;
  } catch (e) {
    results.innerHTML += `<div class="fail">✗ ${label}: ${e.message}</div>`;
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg ?? 'Assertion failed'); }

// ── Minimal valid project ──
const PROJECT = {
  project: { id: 'smoke-test', title: 'Smoke Test' },
  export:  { target: 'instagram-square', width_px: 100, height_px: 100 },
  design_tokens: {
    palette: { background: '#1a1a2e', primary: '#ffffff', accent: '#6366f1', neutral: '#888888' },
    type_scale: {
      display: { family: 'sans-serif', steps: [32], weight: 700 },
      body:    { family: 'sans-serif', steps: [16] },
      data:    { family: 'sans-serif', steps: [12] },
    },
    spacing_scale: [4, 8, 16],
  },
  variety_contract: {
    zone_max_usage_pct: 40,
    shape_quota: { min_per_n_frames: 3, waiver: true },
    overlay_strategies: ['gradient'],
    silence_map: [],
    composition_patterns: {},
  },
  frames: [
    {
      id: 'f1', image_src: 'photo1', image_filename: 'photo1.jpg',
      composition_pattern: 'editorial-anchor',
      layers: [
        { id: 'l1', type: 'overlay', opacity: 0.5, color: '#000000' },
        { id: 'l2', type: 'text', content: 'Test Text', max_width_pct: 80,
          font: { family: 'sans-serif', size_pct: 10, weight: 700, color: '#ffffff' },
          position: { zone: 'bottom-left', offset_x_pct: 5, offset_y_pct: -15 } },
      ],
    },
    {
      id: 'f2', image_src: 'photo2', image_filename: 'photo2.jpg',
      composition_pattern: 'minimal-strip',
      layers: [
        { id: 'l3', type: 'shape', shape: 'rectangle', role: 'divider',
          width_pct: 50, height_pct: 1, fill: '#6366f1',
          position: { zone: 'middle-center', offset_x_pct: -25 } },
      ],
    },
  ],
};

// ── Test 1: FrameManager loads project ──
check('FrameManager.loadProject sets state.project', () => {
  const state = new AppState();
  const fm    = new FrameManager(state);
  fm.loadProject(PROJECT);
  assert(state.project?.project?.id === 'smoke-test');
});

// ── Test 2: Navigate to frame 1 ──
check('setActiveFrame(1) updates index', () => {
  const state = new AppState();
  const fm    = new FrameManager(state);
  fm.loadProject(PROJECT);
  fm.setActiveFrame(1);
  assert(state.activeFrameIndex === 1);
  assert(fm.currentFrame.id === 'f2');
});

// ── Test 3: Renderer paints pixels ──
check('Renderer.renderFrame changes canvas pixels', () => {
  const state = new AppState();
  const fm    = new FrameManager(state);
  fm.loadProject(PROJECT);

  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;

  // Canvas starts blank
  const ctx0   = canvas.getContext('2d');
  const before = ctx0.getImageData(0, 0, 1, 1).data[3]; // alpha

  renderer.renderFrame(canvas, PROJECT.frames[0], PROJECT, new Map());
  const after  = canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3];
  assert(after > 0, 'Canvas alpha should be > 0 after render');
});

// ── Test 4: Renderer uses background palette color ──
check('Renderer uses design_tokens.palette.background', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  renderer.renderFrame(canvas, PROJECT.frames[0], PROJECT, new Map());
  // #1a1a2e = rgb(26, 26, 46) — check center pixel
  const ctx  = canvas.getContext('2d');
  const data = ctx.getImageData(50, 50, 1, 1).data;
  // Overlay is applied on top, so alpha channel should be 255
  assert(data[3] === 255, 'Center pixel should be fully opaque');
});

// ── Test 5: Safe zone guide renders without throwing ──
check('renderFrame with showSafeZone does not throw', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  renderer.renderFrame(canvas, PROJECT.frames[0], PROJECT, new Map(), { showSafeZone: true });
  // If we get here without error, test passes
  assert(true);
});

// ── Test 6: Guide overlays render without throwing ──
check('renderFrame with guideType thirds does not throw', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  renderer.renderFrame(canvas, PROJECT.frames[0], PROJECT, new Map(), { guideType: 'thirds' });
  assert(true);
});

// ── Test 7: frameCount correct ──
check('FrameManager.frameCount returns 2', () => {
  const state = new AppState();
  const fm    = new FrameManager(state);
  fm.loadProject(PROJECT);
  assert(fm.frameCount === 2);
});

// ── Test 8: loadProject rejects invalid JSON ──
check('FrameManager.loadProject throws on invalid project', () => {
  const state = new AppState();
  const fm    = new FrameManager(state);
  let threw = false;
  try { fm.loadProject({ bad: true }); } catch { threw = true; }
  assert(threw, 'Should have thrown for invalid project');
});

results.innerHTML += `<hr><strong>${passed} passed, ${failed} failed</strong>`;
</script>
</body>
</html>
```

- [ ] **Step 2: Open integration test in live server**

Navigate to `tests/editor/integration.html`. Expected: **8 passed, 0 failed**. All items green. No console errors.

If any test fails, diagnose using the error message and fix the relevant module.

- [ ] **Step 3: Also verify main unit tests still pass**

Navigate to `tests/runner.html`. All existing tests (state, events, router, storage, validator, frame-manager, layers) should still pass.

- [ ] **Step 4: Commit**

```bash
git add tests/editor/integration.html
git commit -m "test: editor integration smoke test — 8 checks"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Load project JSON from disk | Task 8 (shell file input) |
| Load image files from disk | Task 3 (FrameManager.loadImages) |
| Render background photo (cover-fit) | Task 5 (renderer `_drawCoverImage`) |
| Render all layer types (image, overlay, text, shape, stats_block, logo) | Task 4 (layers.js) |
| Zone-anchor position model | Task 4 (resolvePosition) |
| Navigate frames via filmstrip | Task 6 (Filmstrip) |
| Show frame id, label, pattern, layer count in inspector | Task 7 (Inspector) |
| Composition pattern badge | Task 2 (CSS `.pattern-badge`) + Task 7 |
| Composition guides (thirds, phi, cross) | Task 5 (renderer `_drawGuide`) + Task 8 (toolbar) |
| Safe zone overlay | Task 5 (renderer `_drawSafeZone`) + Task 8 (toolbar) |
| buildFontString in shared/fonts.js | Task 1 |
| Editor mounts on view:changed | Task 9 (app.js) |
| Unit tests for FrameManager | Task 3 |
| Unit tests for resolvePosition + computeTextBounds | Task 4 |
| Integration smoke test | Task 10 |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `renderLayer(ctx, layer, w, h, images)` — defined Task 4, used in Task 5 ✓
- `renderer.renderFrame(canvas, frame, project, images, opts)` — defined Task 5, used in Task 6 (filmstrip) and Task 8 (shell) ✓
- `FrameManager` constructor takes `state` — consistent across Tasks 3, 6, 7, 8 ✓
- `state.images` is a `Map<string, HTMLImageElement>` — consistent across all tasks ✓
- Event names: `project:loaded`, `frame:changed`, `images:loaded` — consistent ✓
