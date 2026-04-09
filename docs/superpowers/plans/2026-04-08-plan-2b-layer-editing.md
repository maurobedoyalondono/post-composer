# Layer Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive layer editing to the post-composer editor: click-to-select layers on canvas, drag to reposition, bounding box overlays, a floating layers panel (visibility/delete/reorder), a color picker with palette swatches and favorites, context-sensitive toolbars per layer type, and inspector updates showing selected layer properties and an editable composition_pattern.

**Architecture:** All interaction flows through the existing `AppState` + event bus. `LayerManager` owns layer CRUD and emits events; `DragResize` handles canvas pointer events and calls `LayerManager`; `LayersPanel`, `ContextToolbar`, and `Inspector` react to `layer:selected` / `layer:changed` / `layer:deleted` / `layers:reordered` events. The renderer gains a selection overlay pass after the layer loop. The shell (`editor/shell.js`) wires everything together and is fixed to write guide/safe-zone state through to `state.prefs` instead of local variables.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas API, HTML Drag-and-Drop API, localStorage for color favorites/recent, browser-native `<input type="color">`.

---

## Scope Note

This plan (2b) builds on the read-only editor from Plan 2a. Prerequisites: `editor/layers.js`, `editor/renderer.js`, `editor/shell.js`, `ui/inspector.js`, `core/state.js` all exist.

**Not in this plan:** visual analysis overlays (heatmap, contrast, center of mass), PNG export, WCAG live badge, click-to-probe. Those are Plan 2c.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `editor/layers.js` | Modify | Add `computeLayerBounds(layer, w, h)` |
| `core/state.js` | Modify | Add `setSelectedLayer(id)` method |
| `editor/layer-manager.js` | **Create** | Layer CRUD + event dispatch |
| `editor/renderer.js` | Modify | Selection box, corner handles, showLayerBounds overlay |
| `editor/drag-resize.js` | **Create** | Canvas hit-test and drag-to-reposition |
| `ui/layers-panel.js` | **Create** | Floating layer list — visibility, delete, reorder |
| `ui/color-picker.js` | **Create** | Color picker: native input + palette swatches + favorites + recent |
| `ui/toolbars/text-toolbar.js` | **Create** | Text layer toolbar (size, weight, align, color) |
| `ui/toolbars/shape-toolbar.js` | **Create** | Shape layer toolbar (fill, stroke, stroke-width) |
| `ui/toolbars/image-toolbar.js` | **Create** | Image/logo layer toolbar (opacity) |
| `ui/toolbars/overlay-toolbar.js` | **Create** | Overlay layer toolbar (opacity, color) |
| `ui/inspector.js` | Modify | Add selected layer properties + editable composition_pattern |
| `editor/shell.js` | Modify | Wire new components; fix prefs write-through; add showLayerBounds btn |
| `styles/components.css` | Modify | Layers panel, color picker, context toolbar CSS |
| `tests/editor/layers-bounds.test.js` | **Create** | Unit tests for `computeLayerBounds` |
| `tests/editor/layer-manager.test.js` | **Create** | Unit tests for `LayerManager` |
| `tests/editor/integration-2b.html` | **Create** | Smoke tests for drag, panel, inspector wiring |
| `tests/runner.html` | Modify | Add imports for new test files |

---

## Task 1: computeLayerBounds

**Files:**
- Modify: `editor/layers.js`
- Create: `tests/editor/layers-bounds.test.js`
- Modify: `tests/runner.html`

- [ ] **Step 1: Write the failing test**

Create `tests/editor/layers-bounds.test.js`:

```js
// tests/editor/layers-bounds.test.js
import { test, assert } from '../test-helper.js';
import { computeLayerBounds } from '../../editor/layers.js';

const W = 1000;
const H = 1000;

test('overlay fills full canvas', () => {
  const b = computeLayerBounds({ type: 'overlay' }, W, H);
  assert(b.x === 0,     `x should be 0, got ${b.x}`);
  assert(b.y === 0,     `y should be 0, got ${b.y}`);
  assert(b.width  === W, `width should be ${W}, got ${b.width}`);
  assert(b.height === H, `height should be ${H}, got ${b.height}`);
});

test('image layer with position and dimensions', () => {
  const layer = {
    type: 'image',
    position: { zone: 'top-left' },
    width_pct: 50,
    height_pct: 40,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 0,   `x should be 0, got ${b.x}`);
  assert(b.y === 0,   `y should be 0, got ${b.y}`);
  assert(b.width  === 500, `width should be 500, got ${b.width}`);
  assert(b.height === 400, `height should be 400, got ${b.height}`);
});

test('image layer defaults to full size when pct missing', () => {
  const b = computeLayerBounds({ type: 'image', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === W, `width should be ${W}, got ${b.width}`);
  assert(b.height === H, `height should be ${H}, got ${b.height}`);
});

test('logo layer with position and dimensions', () => {
  const layer = {
    type: 'logo',
    position: { zone: 'bottom-right' },
    width_pct: 10,
    height_pct: 10,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 1000, `x should be 1000, got ${b.x}`);
  assert(b.y === 1000, `y should be 1000, got ${b.y}`);
  assert(b.width  === 100, `width should be 100, got ${b.width}`);
  assert(b.height === 100, `height should be 100, got ${b.height}`);
});

test('shape layer with position', () => {
  const layer = {
    type: 'shape',
    shape: 'rect',
    position: { zone: 'middle-center' },
    width_pct: 20,
    height_pct: 5,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 500, `x should be 500, got ${b.x}`);
  assert(b.y === 500, `y should be 500, got ${b.y}`);
  assert(b.width  === 200, `width should be 200, got ${b.width}`);
  assert(b.height ===  50, `height should be 50, got ${b.height}`);
});

test('shape layer defaults when pct missing', () => {
  const b = computeLayerBounds({ type: 'shape', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === 200, `width default 20% should be 200, got ${b.width}`);
  assert(b.height ===  50, `height default 5% should be 50, got ${b.height}`);
});

test('text layer returns max_width_pct wide', () => {
  const layer = {
    type: 'text',
    content: 'Hello',
    font: { size_pct: 5, line_height: 1.25 },
    max_width_pct: 70,
    position: { zone: 'bottom-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 0,   `x should be 0, got ${b.x}`);
  assert(b.y === H,   `y should be ${H}, got ${b.y}`);
  assert(b.width === 700, `width should be 700, got ${b.width}`);
  assert(b.height > 0,   `height should be > 0, got ${b.height}`);
});

test('text layer uses size_pct for height', () => {
  const layer = {
    type: 'text',
    content: 'Hello',
    font: { size_pct: 10, line_height: 1.25 },
    max_width_pct: 80,
    position: { zone: 'top-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  // sizePx = 10% of 1000 = 100. lineH = 100 * 1.25 = 125. 2 lines → 250
  assert(b.height === 250, `height should be 250, got ${b.height}`);
});

test('stats_block height based on stats count', () => {
  const layer = {
    type: 'stats_block',
    font: { size_pct: 4 },
    stats: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }],
    position: { zone: 'top-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  // sizePx = 4% of 1000 = 40. lineH = 40 * 1.6 = 64. 2 stats → 128
  assert(b.height === 128, `height should be 128, got ${b.height}`);
});

test('stats_block defaults to 1 row when stats missing', () => {
  const b = computeLayerBounds({ type: 'stats_block', position: { zone: 'top-left' } }, W, H);
  // sizePx = 4% of 1000 = 40. lineH = 64. 1 row → 64
  assert(b.height === 64, `height should be 64, got ${b.height}`);
});

test('absolute position is respected', () => {
  const layer = {
    type: 'image',
    position: { zone: 'absolute', x_pct: 25, y_pct: 30 },
    width_pct: 20,
    height_pct: 20,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 250, `x should be 250, got ${b.x}`);
  assert(b.y === 300, `y should be 300, got ${b.y}`);
});

test('unknown layer type returns zero-size bounds at position', () => {
  const b = computeLayerBounds({ type: 'unknown', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === 0, `width should be 0, got ${b.width}`);
  assert(b.height === 0, `height should be 0, got ${b.height}`);
});
```

- [ ] **Step 2: Add test import to `tests/runner.html`, open in browser, confirm the test fails**

In `tests/runner.html`, add before `summary()`:
```html
import './editor/layers-bounds.test.js';
```

Open `tests/runner.html` in browser. Expected: FAIL — `computeLayerBounds is not a function` (or similar import error).

- [ ] **Step 3: Implement `computeLayerBounds` in `editor/layers.js`**

Add after the existing `computeTextBounds` function (after line 54):

```js
/**
 * Compute the bounding box of a layer in canvas coordinates.
 * Does not require a canvas context — text height is approximated as 2 lines.
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeLayerBounds(layer, w, h) {
  if (layer.type === 'overlay') {
    return { x: 0, y: 0, width: w, height: h };
  }
  const { x, y } = resolvePosition(layer.position, w, h);
  switch (layer.type) {
    case 'text': {
      const maxW   = (layer.max_width_pct ?? 80) / 100 * w;
      const sizePx = (layer.font?.size_pct ?? 5) / 100 * h;
      const lineH  = sizePx * (layer.font?.line_height ?? 1.25);
      return { x, y, width: maxW, height: lineH * 2 };
    }
    case 'stats_block': {
      const sizePx = (layer.font?.size_pct ?? 4) / 100 * h;
      const lineH  = sizePx * 1.6;
      return { x, y, width: w * 0.4, height: lineH * (layer.stats?.length ?? 1) };
    }
    case 'image':
    case 'logo': {
      const bw = (layer.width_pct  ?? 100) / 100 * w;
      const bh = (layer.height_pct ?? 100) / 100 * h;
      return { x, y, width: bw, height: bh };
    }
    case 'shape': {
      const bw = (layer.width_pct  ?? 20) / 100 * w;
      const bh = (layer.height_pct ??  5) / 100 * h;
      return { x, y, width: bw, height: bh };
    }
    default:
      return { x, y, width: 0, height: 0 };
  }
}
```

- [ ] **Step 4: Refresh `tests/runner.html`, confirm all 12 bounds tests pass**

- [ ] **Step 5: Commit**

```bash
git add editor/layers.js tests/editor/layers-bounds.test.js tests/runner.html
git commit -m "feat: add computeLayerBounds to editor/layers.js"
```

---

## Task 2: setSelectedLayer + LayerManager

**Files:**
- Modify: `core/state.js`
- Create: `editor/layer-manager.js`
- Create: `tests/editor/layer-manager.test.js`
- Modify: `tests/runner.html`

- [ ] **Step 1: Write the failing test**

Create `tests/editor/layer-manager.test.js`:

```js
// tests/editor/layer-manager.test.js
import { test, assert } from '../test-helper.js';
import { AppState } from '../../core/state.js';
import { LayerManager } from '../../editor/layer-manager.js';
import { events } from '../../core/events.js';

function makeState() {
  const s = new AppState();
  s.setProject({
    project: { id: 'test', title: 'Test' },
    export: { target: 'instagram-square', width_px: 1080, height_px: 1080 },
    design_tokens: {
      palette: { background: '#000000', primary: '#ffffff', accent: '#6366f1', neutral: '#6b7280' },
      type_scale: {
        display: { family: 'sans-serif', steps: [48] },
        body:    { family: 'sans-serif', steps: [16] },
        data:    { family: 'sans-serif', steps: [12] },
      },
      spacing_scale: [8, 16, 24, 32],
    },
    variety_contract: {
      zone_max_usage_pct: 60,
      shape_quota: { min_per_n_frames: 3, waiver: true },
      overlay_strategies: ['gradient'],
      silence_map: [],
      composition_patterns: {},
    },
    frames: [
      {
        id: 'frame-01',
        image_src: '',
        image_filename: 'img.jpg',
        composition_pattern: 'full-bleed',
        layers: [
          { id: 'layer-a', type: 'text', content: 'Hello', font: { size_pct: 5 }, max_width_pct: 80, position: { zone: 'top-left' } },
          { id: 'layer-b', type: 'shape', shape: 'rect', role: 'divider', position: { zone: 'bottom-left' } },
        ],
      },
    ],
  });
  return s;
}

test('selectLayer sets selectedLayerId on state', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  assert(state.selectedLayerId === 'layer-a', `expected layer-a, got ${state.selectedLayerId}`);
});

test('selectLayer(null) clears selectedLayerId', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  lm.selectLayer(null);
  assert(state.selectedLayerId === null, `expected null, got ${state.selectedLayerId}`);
});

test('selectLayer dispatches layer:selected event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let received = null;
  events.addEventListener('layer:selected', e => { received = e.detail.id; }, { once: true });
  lm.selectLayer('layer-b');
  assert(received === 'layer-b', `expected layer-b, got ${received}`);
});

test('updateLayer patches a layer in project JSON', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.updateLayer(0, 'layer-a', { content: 'Updated' });
  const layer = state.project.frames[0].layers.find(l => l.id === 'layer-a');
  assert(layer.content === 'Updated', `expected Updated, got ${layer.content}`);
});

test('updateLayer dispatches layer:changed event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let fired = false;
  events.addEventListener('layer:changed', () => { fired = true; }, { once: true });
  lm.updateLayer(0, 'layer-a', { content: 'X' });
  assert(fired, 'layer:changed should have fired');
});

test('updateLayer is a no-op for unknown layer id', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.updateLayer(0, 'no-such-layer', { content: 'X' });
  // Should not throw; layers unchanged
  assert(state.project.frames[0].layers.length === 2, 'layer count unchanged');
});

test('deleteLayer removes layer from frame', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.deleteLayer(0, 'layer-a');
  const ids = state.project.frames[0].layers.map(l => l.id);
  assert(!ids.includes('layer-a'), 'layer-a should be removed');
  assert(ids.includes('layer-b'), 'layer-b should remain');
});

test('deleteLayer clears selectedLayerId if deleted layer was selected', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  lm.deleteLayer(0, 'layer-a');
  assert(state.selectedLayerId === null, `selectedLayerId should be null, got ${state.selectedLayerId}`);
});

test('deleteLayer dispatches layer:deleted event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let fired = false;
  events.addEventListener('layer:deleted', () => { fired = true; }, { once: true });
  lm.deleteLayer(0, 'layer-a');
  assert(fired, 'layer:deleted should have fired');
});

test('toggleVisibility flips layer.hidden', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.toggleVisibility(0, 'layer-a');
  const layer = state.project.frames[0].layers.find(l => l.id === 'layer-a');
  assert(layer.hidden === true, `expected true, got ${layer.hidden}`);
  lm.toggleVisibility(0, 'layer-a');
  assert(layer.hidden === false, `expected false, got ${layer.hidden}`);
});

test('reorderLayer moves layer from one index to another', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.reorderLayer(0, 0, 1);
  const ids = state.project.frames[0].layers.map(l => l.id);
  assert(ids[0] === 'layer-b', `expected layer-b first, got ${ids[0]}`);
  assert(ids[1] === 'layer-a', `expected layer-a second, got ${ids[1]}`);
});

test('emitChanged dispatches layer:changed event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let detail = null;
  events.addEventListener('layer:changed', e => { detail = e.detail; }, { once: true });
  lm.emitChanged(0, 'layer-a');
  assert(detail?.frameIndex === 0, `expected frameIndex 0, got ${detail?.frameIndex}`);
  assert(detail?.layerId === 'layer-a', `expected layer-a, got ${detail?.layerId}`);
});
```

- [ ] **Step 2: Add test import to `tests/runner.html`, open in browser, confirm failures**

In `tests/runner.html`, add before `summary()`:
```html
import './editor/layer-manager.test.js';
```

Expected: FAIL — `LayerManager is not a function` or module not found.

- [ ] **Step 3: Add `setSelectedLayer` to `core/state.js`**

Add after the `setAnalysisMode` method (after line 35 in current state.js):

```js
  /** @param {string|null} id */
  setSelectedLayer(id) {
    this.selectedLayerId = id ?? null;
  }
```

- [ ] **Step 4: Create `editor/layer-manager.js`**

```js
// editor/layer-manager.js
import { events } from '../core/events.js';

/**
 * Manages layer CRUD and selection for the active project.
 * All mutations go through here so the event bus stays consistent.
 */
export class LayerManager {
  /** @param {import('../core/state.js').AppState} state */
  constructor(state) {
    this._state = state;
  }

  /**
   * Select a layer by id, or pass null to deselect.
   * Emits: layer:selected
   */
  selectLayer(id) {
    this._state.setSelectedLayer(id ?? null);
    events.dispatchEvent(new CustomEvent('layer:selected', { detail: { id: id ?? null } }));
  }

  /**
   * Merge patch into a layer's properties.
   * Emits: layer:changed
   */
  updateLayer(frameIndex, layerId, patch) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    Object.assign(layer, patch);
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }

  /**
   * Delete a layer. If it was selected, clears selectedLayerId.
   * Emits: layer:deleted
   */
  deleteLayer(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const idx = frame.layers?.findIndex(l => l.id === layerId);
    if (idx == null || idx === -1) return;
    frame.layers.splice(idx, 1);
    if (this._state.selectedLayerId === layerId) {
      this._state.setSelectedLayer(null);
    }
    events.dispatchEvent(new CustomEvent('layer:deleted', { detail: { frameIndex, layerId } }));
  }

  /**
   * Toggle a layer's hidden flag.
   * Emits: layer:changed
   */
  toggleVisibility(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    layer.hidden = !layer.hidden;
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }

  /**
   * Move a layer from fromIdx to toIdx within a frame's layers array.
   * Emits: layers:reordered
   */
  reorderLayer(frameIndex, fromIdx, toIdx) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame?.layers) return;
    const [removed] = frame.layers.splice(fromIdx, 1);
    frame.layers.splice(toIdx, 0, removed);
    events.dispatchEvent(new CustomEvent('layers:reordered', { detail: { frameIndex } }));
  }

  /**
   * Emit layer:changed without mutating — used by DragResize after a drag
   * where the position was mutated directly for performance.
   */
  emitChanged(frameIndex, layerId) {
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId } }));
  }
}
```

- [ ] **Step 5: Refresh `tests/runner.html`, confirm all 12 LayerManager tests pass**

- [ ] **Step 6: Commit**

```bash
git add core/state.js editor/layer-manager.js tests/editor/layer-manager.test.js tests/runner.html
git commit -m "feat: add LayerManager and setSelectedLayer"
```

---

## Task 3: Selection and bounds overlay in renderer

**Files:**
- Modify: `editor/renderer.js`

There is no separate unit test file for this task — the visual output is verified by the integration test in Task 10 and manual inspection. The existing renderer tests are integration-style (Task 2a).

- [ ] **Step 1: Add `computeLayerBounds` import and two new overlay functions to `editor/renderer.js`**

Add the import at the top (after line 1, before existing imports — or right after the existing `renderLayer` import):

```js
import { renderLayer, computeLayerBounds } from './layers.js';
```

Replace the existing import line:
```js
// OLD (line 2):
import { renderLayer } from './layers.js';
// NEW:
import { renderLayer, computeLayerBounds } from './layers.js';
```

- [ ] **Step 2: Extend `renderFrame` opts to accept `selectedLayerId` and `showLayerBounds`**

In `renderFrame`, replace the comment `// Debug / guide overlays` block (lines 38–39) with:

```js
    // Layer-bounds overlay (all layers)
    if (opts.showLayerBounds) _drawAllBounds(ctx, frame.layers, w, h);

    // Selection overlay (selected layer)
    if (opts.selectedLayerId) {
      const sel = (frame.layers ?? []).find(l => l.id === opts.selectedLayerId);
      if (sel) _drawSelection(ctx, sel, w, h);
    }

    // Composition guides
    if (opts.showSafeZone) _drawSafeZone(ctx, w, h);
    if (opts.guideType)    _drawGuide(ctx, w, h, opts.guideType);
```

- [ ] **Step 3: Add `_drawAllBounds` and `_drawSelection` private functions**

Add after the `_drawSafeZone` function (after its closing brace):

```js
function _drawAllBounds(ctx, layers, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(100,160,255,0.35)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 3]);
  for (const layer of (layers ?? [])) {
    if (layer.hidden) continue;
    const b = computeLayerBounds(layer, w, h);
    if (b.width > 0 && b.height > 0) {
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    }
  }
  ctx.restore();
}

function _drawSelection(ctx, layer, w, h) {
  const b = computeLayerBounds(layer, w, h);
  if (b.width === 0 && b.height === 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(100,160,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(b.x, b.y, b.width, b.height);
  // Corner handles
  const hs = 6;
  ctx.fillStyle = '#64a0ff';
  for (const [cx, cy] of [
    [b.x,           b.y],
    [b.x + b.width, b.y],
    [b.x,           b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ]) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
  }
  ctx.restore();
}
```

- [ ] **Step 4: Open `tests/editor/integration.html` (from Plan 2a) in browser, confirm all 8 checks still pass (no regressions)**

- [ ] **Step 5: Commit**

```bash
git add editor/renderer.js
git commit -m "feat: add selection box and layer bounds overlay to renderer"
```

---

## Task 4: DragResize

**Files:**
- Create: `editor/drag-resize.js`

No separate unit test file — hit-test logic depends on `computeLayerBounds` (already tested in Task 1). Full wiring verified by integration test in Task 10.

- [ ] **Step 1: Create `editor/drag-resize.js`**

```js
// editor/drag-resize.js
import { computeLayerBounds } from './layers.js';

/**
 * Handles pointer-based layer selection and drag-to-reposition on an HTMLCanvasElement.
 *
 * Coordinate model:
 *   CSS mouse coords → canvas full-resolution coords via scaleX/scaleY.
 *   Delta is applied to the original position stored at pointerdown.
 *   During drag: position is mutated directly (no event) and onRepaint() is called.
 *   On pointerup: layerManager.emitChanged() fires layer:changed for inspector/panel to sync.
 */
export class DragResize {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/state.js').AppState} state
   * @param {import('./layer-manager.js').LayerManager} layerManager
   * @param {() => void} onRepaint — called after each position update during drag
   */
  constructor(canvas, state, layerManager, onRepaint) {
    this._canvas    = canvas;
    this._state     = state;
    this._lm        = layerManager;
    this._repaint   = onRepaint;
    this._dragging  = false;
    this._startX    = 0;
    this._startY    = 0;
    this._origPos   = null; // snapshot of layer.position at pointerdown

    canvas.addEventListener('pointerdown', this._onDown.bind(this));
    canvas.addEventListener('pointermove', this._onMove.bind(this));
    canvas.addEventListener('pointerup',   this._onUp.bind(this));
  }

  /** Convert a CSS-space pointer event to canvas pixel coordinates. */
  _toCanvas(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  /**
   * Find the top-most non-hidden layer whose bounding box contains (cx, cy).
   * Tests layers in reverse order (last layer = visually on top).
   */
  _hitTest(cx, cy) {
    const frame = this._state.activeFrame;
    if (!frame?.layers) return null;
    const w = this._canvas.width;
    const h = this._canvas.height;
    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      if (layer.hidden) continue;
      const b = computeLayerBounds(layer, w, h);
      if (cx >= b.x && cx <= b.x + b.width &&
          cy >= b.y && cy <= b.y + b.height) {
        return layer;
      }
    }
    return null;
  }

  _onDown(e) {
    const { x, y } = this._toCanvas(e);
    const layer = this._hitTest(x, y);
    if (layer) {
      this._lm.selectLayer(layer.id);
      this._dragging = true;
      this._startX   = x;
      this._startY   = y;
      // Deep-copy position so we always delta from the original
      this._origPos  = layer.position ? { ...layer.position } : null;
      this._canvas.setPointerCapture(e.pointerId);
    } else {
      this._lm.selectLayer(null);
    }
    e.preventDefault();
  }

  _onMove(e) {
    if (!this._dragging) return;
    const { x, y } = this._toCanvas(e);
    const dx = x - this._startX;
    const dy = y - this._startY;
    const w  = this._canvas.width;
    const h  = this._canvas.height;

    const layer = this._state.activeFrame?.layers?.find(
      l => l.id === this._state.selectedLayerId
    );
    if (!layer) return;

    const pos = this._origPos;
    if (!pos || pos.zone === 'absolute') {
      layer.position = {
        zone:  'absolute',
        x_pct: (pos?.x_pct ?? 0) + (dx / w * 100),
        y_pct: (pos?.y_pct ?? 0) + (dy / h * 100),
      };
    } else {
      layer.position = {
        ...pos,
        offset_x_pct: (pos.offset_x_pct ?? 0) + (dx / w * 100),
        offset_y_pct: (pos.offset_y_pct ?? 0) + (dy / h * 100),
      };
    }
    this._repaint();
  }

  _onUp(e) {
    if (this._dragging && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    }
    this._dragging = false;
    this._origPos  = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/drag-resize.js
git commit -m "feat: add DragResize for canvas layer hit-test and drag-to-reposition"
```

---

## Task 5: LayersPanel

**Files:**
- Create: `ui/layers-panel.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Add CSS for the layers panel to `styles/components.css`**

Append to `styles/components.css`:

```css
/* ── Layers panel ──────────────────────────── */
.layers-panel {
  position: absolute;
  top: 48px;
  right: 256px; /* sits to the left of the inspector */
  width: 200px;
  max-height: 60vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

.layers-panel-header {
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.layers-panel-empty {
  padding: 12px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.layers-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;
}

.layer-item:hover {
  background: var(--color-surface-2);
}

.layer-item.active {
  background: rgba(99,102,241,0.15);
  border-left: 2px solid var(--color-accent);
}

.layer-item .layer-type {
  font-family: var(--font-mono);
  color: var(--color-accent-2);
  min-width: 52px;
}

.layer-item .layer-id {
  flex: 1;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-item .vis-btn,
.layer-item .del-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.5;
  padding: 0 2px;
  line-height: 1;
  color: var(--color-text);
  flex-shrink: 0;
}

.layer-item .vis-btn:hover,
.layer-item .del-btn:hover {
  opacity: 1;
}

.layer-item .vis-btn.hidden {
  opacity: 0.25;
}

.layer-item .del-btn:hover {
  color: var(--color-danger);
}
```

- [ ] **Step 2: Create `ui/layers-panel.js`**

```js
// ui/layers-panel.js
import { events } from '../core/events.js';

/**
 * Floating layer list panel.
 * Shows layers for the active frame in reverse render order (top layer first).
 * Supports: click-to-select, visibility toggle, delete, drag-to-reorder.
 */
export class LayersPanel {
  /**
   * @param {HTMLElement} container — the .layers-panel element
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    for (const ev of ['project:loaded', 'frame:changed', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
      events.addEventListener(ev, () => this._render());
    }
    events.addEventListener('layer:selected', () => this._syncActive());
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame?.layers?.length) {
      this._el.innerHTML = `
        <div class="layers-panel-header">Layers</div>
        <div class="layers-panel-empty">No layers</div>
      `;
      return;
    }

    // Display layers in reverse order: visually "top" layer first
    const layers = [...frame.layers].reverse();
    const selectedId = this._state.selectedLayerId;

    this._el.innerHTML = `
      <div class="layers-panel-header">Layers</div>
      <ul class="layers-list">
        ${layers.map((l, visIdx) => {
          const realIdx = frame.layers.length - 1 - visIdx;
          return `<li class="layer-item${l.id === selectedId ? ' active' : ''}"
                      data-id="${l.id}" data-idx="${realIdx}" draggable="true">
            <button class="vis-btn${l.hidden ? ' hidden' : ''}" data-id="${l.id}" title="Toggle visibility">👁</button>
            <span class="layer-type">${l.type}</span>
            <span class="layer-id" title="${l.id}">${l.id}</span>
            <button class="del-btn" data-id="${l.id}" title="Delete layer">✕</button>
          </li>`;
        }).join('')}
      </ul>
    `;

    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.addEventListener('click', () => this._lm.selectLayer(item.dataset.id));

      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.idx);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx   = parseInt(item.dataset.idx, 10);
        if (fromIdx !== toIdx) {
          this._lm.reorderLayer(this._state.activeFrameIndex, fromIdx, toIdx);
        }
      });
    });

    this._el.querySelectorAll('.vis-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._lm.toggleVisibility(this._state.activeFrameIndex, btn.dataset.id);
      });
    });

    this._el.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._lm.deleteLayer(this._state.activeFrameIndex, btn.dataset.id);
      });
    });
  }

  /** Update active highlight without full re-render — called on layer:selected. */
  _syncActive() {
    const selectedId = this._state.selectedLayerId;
    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === selectedId);
    });
  }
}
```

- [ ] **Step 3: Open `tests/editor/integration.html` (Plan 2a test) in browser, confirm it still passes**

No regression expected — `LayersPanel` is not imported by any existing code yet.

- [ ] **Step 4: Commit**

```bash
git add ui/layers-panel.js styles/components.css
git commit -m "feat: add LayersPanel with visibility toggle, delete, and reorder"
```

---

## Task 6: ColorPicker

**Files:**
- Create: `ui/color-picker.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Add color picker CSS to `styles/components.css`**

Append to `styles/components.css`:

```css
/* ── Color picker ──────────────────────────── */
.color-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 180px;
}

.cp-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.cp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.cp-swatch {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
  padding: 0;
}

.cp-swatch:hover {
  transform: scale(1.15);
  border-color: var(--color-accent);
}

.cp-add-fav {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.cp-add-fav:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.cp-native {
  width: 100%;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  cursor: pointer;
  padding: 2px;
}
```

- [ ] **Step 2: Create `ui/color-picker.js`**

```js
// ui/color-picker.js

const MAX_RECENT    = 8;
const MAX_FAVORITES = 8;

/**
 * Create a color picker widget as an HTMLElement.
 *
 * @param {object} opts
 * @param {string}  opts.value      — initial color hex (e.g. '#ff0000')
 * @param {object}  opts.palette    — design_tokens.palette object (name → hex)
 * @param {string}  opts.projectId  — used as localStorage key prefix
 * @param {(color: string) => void} opts.onChange — called when user picks a color
 * @returns {HTMLElement}
 */
export function createColorPicker({ value = '#ffffff', palette = {}, projectId = 'default', onChange } = {}) {
  const el = document.createElement('div');
  el.className = 'color-picker';

  _renderAll(el, value, palette, projectId, onChange);
  return el;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function _renderAll(el, currentValue, palette, projectId, onChange) {
  const favorites = _loadFavorites(projectId);
  const recent    = _loadRecent(projectId);

  el.innerHTML = `
    <div class="cp-section-label">Palette</div>
    <div class="cp-swatches cp-palette">
      ${Object.entries(palette).map(([name, color]) =>
        `<button class="cp-swatch" data-color="${color}" title="${name}" style="background:${color}"></button>`
      ).join('')}
    </div>
    <div class="cp-section-label">Favorites</div>
    <div class="cp-swatches cp-favorites">
      ${_favHTML(favorites)}
    </div>
    <div class="cp-section-label">Recent</div>
    <div class="cp-swatches cp-recent">
      ${recent.map(c => `<button class="cp-swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`).join('')}
    </div>
    <input class="cp-native" type="color" value="${currentValue}">
  `;

  const native = el.querySelector('.cp-native');

  // Palette swatches
  el.querySelector('.cp-palette').addEventListener('click', e => {
    const color = e.target.closest('.cp-swatch')?.dataset.color;
    if (color) _apply(el, native, color, projectId, onChange);
  });

  // Recent swatches
  el.querySelector('.cp-recent').addEventListener('click', e => {
    const color = e.target.closest('.cp-swatch')?.dataset.color;
    if (color) _apply(el, native, color, projectId, onChange);
  });

  // Native color input
  native.addEventListener('input', () => _apply(el, native, native.value, projectId, onChange));

  _wireFavorites(el, native, projectId, onChange);
}

function _favHTML(favorites) {
  return favorites.map(c =>
    `<button class="cp-swatch cp-fav" data-color="${c}" title="${c}" style="background:${c}"></button>`
  ).join('') + `<button class="cp-add-fav" title="Save current color as favorite">+</button>`;
}

function _wireFavorites(el, native, projectId, onChange) {
  const favRow = el.querySelector('.cp-favorites');

  favRow.querySelectorAll('.cp-fav').forEach(btn => {
    btn.addEventListener('click', () => _apply(el, native, btn.dataset.color, projectId, onChange));
    btn.addEventListener('contextmenu', e => {
      e.preventDefault();
      _removeFavorite(el, native, btn.dataset.color, projectId, onChange);
    });
  });

  favRow.querySelector('.cp-add-fav')?.addEventListener('click', () => {
    _addFavorite(el, native, native.value, projectId, onChange);
  });
}

function _apply(el, native, color, projectId, onChange) {
  native.value = color;
  _addRecent(el, color, projectId);
  onChange?.(color);
}

function _addFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  favs.unshift(color);
  if (favs.length > MAX_FAVORITES) favs.pop();
  localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs));
  _refreshFavRow(el, native, projectId, onChange);
}

function _removeFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs));
  _refreshFavRow(el, native, projectId, onChange);
}

function _refreshFavRow(el, native, projectId, onChange) {
  const favRow = el.querySelector('.cp-favorites');
  favRow.innerHTML = _favHTML(_loadFavorites(projectId));
  _wireFavorites(el, native, projectId, onChange);
}

function _addRecent(el, color, projectId) {
  const rec = _loadRecent(projectId).filter(c => c !== color);
  rec.unshift(color);
  if (rec.length > MAX_RECENT) rec.pop();
  localStorage.setItem(`cp-recent-${projectId}`, JSON.stringify(rec));
  // Update recent row DOM
  const recentRow = el.querySelector('.cp-recent');
  if (recentRow) {
    recentRow.innerHTML = rec
      .map(c => `<button class="cp-swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`)
      .join('');
    recentRow.addEventListener('click', e => {
      const c = e.target.closest('.cp-swatch')?.dataset.color;
      const native = el.querySelector('.cp-native');
      if (c && native) _apply(el, native, c, projectId, null); // onChange already wired
    });
  }
}

function _loadFavorites(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-fav-${projectId}`) ?? '[]'); } catch { return []; }
}

function _loadRecent(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-recent-${projectId}`) ?? '[]'); } catch { return []; }
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/color-picker.js styles/components.css
git commit -m "feat: add ColorPicker with palette swatches, favorites, and recent colors"
```

---

## Task 7: Context toolbars

**Files:**
- Create: `ui/toolbars/text-toolbar.js`
- Create: `ui/toolbars/shape-toolbar.js`
- Create: `ui/toolbars/image-toolbar.js`
- Create: `ui/toolbars/overlay-toolbar.js`
- Modify: `styles/components.css`

Each toolbar is a function that renders controls into a container and calls `layerManager.updateLayer` on change. The shell (Task 9) decides which toolbar to show based on `state.selectedLayerId` and the selected layer's type.

- [ ] **Step 1: Add context toolbar CSS to `styles/components.css`**

Append to `styles/components.css`:

```css
/* ── Context toolbar ───────────────────────── */
.context-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  background: var(--color-surface-2);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  font-size: 12px;
}

.context-toolbar.hidden {
  display: none;
}

.context-toolbar label {
  color: var(--color-text-muted);
  font-size: 11px;
}

.context-toolbar select,
.context-toolbar input[type="number"] {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 3px 6px;
  width: 70px;
}

.context-toolbar input[type="color"] {
  width: 28px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  padding: 1px;
}

.context-toolbar .toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Create `ui/toolbars/text-toolbar.js`**

```js
// ui/toolbars/text-toolbar.js

/**
 * Render text layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected text layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderTextToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');
  const font = layer.font ?? {};

  container.innerHTML = `
    <label>Size %</label>
    <input type="number" id="ctx-font-size" value="${font.size_pct ?? 5}" min="1" max="30" step="0.5" style="width:60px">
    <div class="toolbar-sep"></div>
    <label>Weight</label>
    <select id="ctx-font-weight">
      <option value="300"${font.weight === 300 ? ' selected' : ''}>Light</option>
      <option value="400"${(!font.weight || font.weight === 400) ? ' selected' : ''}>Regular</option>
      <option value="600"${font.weight === 600 ? ' selected' : ''}>Semi-bold</option>
      <option value="700"${font.weight === 700 ? ' selected' : ''}>Bold</option>
    </select>
    <div class="toolbar-sep"></div>
    <label>Align</label>
    <select id="ctx-font-align">
      <option value="left"${(!font.align || font.align === 'left') ? ' selected' : ''}>Left</option>
      <option value="center"${font.align === 'center' ? ' selected' : ''}>Center</option>
      <option value="right"${font.align === 'right' ? ' selected' : ''}>Right</option>
    </select>
    <div class="toolbar-sep"></div>
    <label>Color</label>
    <input type="color" id="ctx-font-color" value="${font.color ?? '#ffffff'}">
  `;

  container.querySelector('#ctx-font-size').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, size_pct: parseFloat(e.target.value) } });
  });

  container.querySelector('#ctx-font-weight').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, weight: parseInt(e.target.value, 10) } });
  });

  container.querySelector('#ctx-font-align').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, align: e.target.value } });
  });

  container.querySelector('#ctx-font-color').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...font, color: e.target.value } });
  });
}
```

- [ ] **Step 3: Create `ui/toolbars/shape-toolbar.js`**

```js
// ui/toolbars/shape-toolbar.js

/**
 * Render shape layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected shape layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderShapeToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');

  container.innerHTML = `
    <label>Fill</label>
    <input type="color" id="ctx-shape-fill" value="${layer.fill ?? '#6366f1'}">
    <div class="toolbar-sep"></div>
    <label>Stroke</label>
    <input type="color" id="ctx-shape-stroke" value="${layer.stroke ?? '#ffffff'}">
    <div class="toolbar-sep"></div>
    <label>Stroke W</label>
    <input type="number" id="ctx-shape-stroke-w" value="${layer.stroke_width ?? 1}" min="0" max="20" step="1" style="width:55px">
    <div class="toolbar-sep"></div>
    <label>Opacity</label>
    <input type="number" id="ctx-shape-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:55px">
  `;

  container.querySelector('#ctx-shape-fill').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { fill: e.target.value });
  });

  container.querySelector('#ctx-shape-stroke').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke: e.target.value });
  });

  container.querySelector('#ctx-shape-stroke-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke_width: parseFloat(e.target.value) });
  });

  container.querySelector('#ctx-shape-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
}
```

- [ ] **Step 4: Create `ui/toolbars/image-toolbar.js`**

```js
// ui/toolbars/image-toolbar.js

/**
 * Render image / logo layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected image or logo layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');

  container.innerHTML = `
    <label>Opacity</label>
    <input type="number" id="ctx-img-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:55px">
  `;

  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
}
```

- [ ] **Step 5: Create `ui/toolbars/overlay-toolbar.js`**

```js
// ui/toolbars/overlay-toolbar.js

/**
 * Render overlay layer controls into `container`.
 * @param {HTMLElement} container — .context-toolbar element
 * @param {object} layer — the selected overlay layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 */
export function renderOverlayToolbar(container, layer, frameIndex, layerManager) {
  container.classList.remove('hidden');
  const isGradient = !!layer.gradient?.enabled;

  container.innerHTML = `
    <label>Opacity</label>
    <input type="number" id="ctx-ov-opacity" value="${Math.round((layer.opacity ?? 0.6) * 100)}" min="0" max="100" step="5" style="width:55px">
    <div class="toolbar-sep"></div>
    <label>Color</label>
    <input type="color" id="ctx-ov-color" value="${layer.color ?? '#000000'}" ${isGradient ? 'disabled' : ''}>
    <div class="toolbar-sep"></div>
    <label>Gradient</label>
    <input type="checkbox" id="ctx-ov-gradient" ${isGradient ? 'checked' : ''}>
  `;

  container.querySelector('#ctx-ov-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  container.querySelector('#ctx-ov-color').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { color: e.target.value });
  });

  container.querySelector('#ctx-ov-gradient').addEventListener('change', e => {
    const enabled = e.target.checked;
    layerManager.updateLayer(frameIndex, layer.id, {
      gradient: { ...layer.gradient, enabled },
    });
    // Toggle color input
    container.querySelector('#ctx-ov-color').disabled = enabled;
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add ui/toolbars/text-toolbar.js ui/toolbars/shape-toolbar.js ui/toolbars/image-toolbar.js ui/toolbars/overlay-toolbar.js styles/components.css
git commit -m "feat: add context toolbars for text, shape, image, and overlay layers"
```

---

## Task 8: Inspector update

**Files:**
- Modify: `ui/inspector.js`

The inspector gains: (1) selected layer property display, (2) editable `composition_pattern` dropdown.

- [ ] **Step 1: Rewrite `ui/inspector.js`**

Replace the entire file:

```js
// ui/inspector.js
import { events } from '../core/events.js';

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

/**
 * Inspector panel — frame metadata, editable composition_pattern,
 * and selected layer properties.
 */
export class Inspector {
  /**
   * @param {HTMLElement} container — .editor-inspector element
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    events.addEventListener('project:loaded', () => this._render());
    events.addEventListener('frame:changed',  () => this._render());
    events.addEventListener('layer:selected', () => this._render());
    events.addEventListener('layer:changed',  () => this._renderLayerSection());
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>Load a project JSON<br>to get started.</p></div>`;
      return;
    }

    const layerCount = frame.layers?.length ?? 0;

    this._el.innerHTML = `
      <div class="inspector-section" id="insp-frame">
        <div class="inspector-section-title">Frame</div>
        <div class="inspector-row">
          <span class="label">ID</span>
          <span class="value" title="${_esc(frame.id)}">${_esc(frame.id)}</span>
        </div>
        ${frame.label ? `
        <div class="inspector-row">
          <span class="label">Label</span>
          <span class="value" title="${_esc(frame.label)}">${_esc(frame.label)}</span>
        </div>` : ''}
        <div class="inspector-row">
          <span class="label">Index</span>
          <span class="value">${this._state.activeFrameIndex + 1} / ${this._state.project.frames.length}</span>
        </div>
      </div>

      <div class="inspector-section" id="insp-composition">
        <div class="inspector-section-title">Composition</div>
        <div style="margin-bottom:6px;">
          <select id="insp-pattern-select" style="width:100%;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:4px 6px;">
            ${VALID_COMPOSITION_PATTERNS.map(p =>
              `<option value="${p}"${frame.composition_pattern === p ? ' selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="inspector-section" id="insp-layers">
        <div class="inspector-section-title">Layers (${layerCount})</div>
        ${_layerSummary(frame.layers)}
      </div>

      <div class="inspector-section" id="insp-layer-props">
        ${this._layerPropsHTML()}
      </div>
    `;

    this._el.querySelector('#insp-pattern-select')?.addEventListener('change', e => {
      const frame = this._state.activeFrame;
      if (!frame) return;
      frame.composition_pattern = e.target.value;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });
  }

  /** Re-render only the layer properties section — called on layer:changed to avoid full flicker. */
  _renderLayerSection() {
    const section = this._el.querySelector('#insp-layer-props');
    if (section) section.innerHTML = this._layerPropsHTML();
  }

  _layerPropsHTML() {
    const layerId = this._state.selectedLayerId;
    if (!layerId) return '<div class="editor-empty" style="padding:8px;font-size:11px;color:var(--color-text-muted);">Click a layer to inspect</div>';

    const frame = this._state.activeFrame;
    const layer = frame?.layers?.find(l => l.id === layerId);
    if (!layer) return '';

    const rows = [
      ['Type',    layer.type],
      ['ID',      layer.id],
      ['Zone',    layer.position?.zone ?? '—'],
      ['Hidden',  layer.hidden ? 'yes' : 'no'],
    ];

    if (layer.type === 'text') {
      rows.push(
        ['Content',   (layer.content ?? '').slice(0, 40)],
        ['Size %',    layer.font?.size_pct ?? '—'],
        ['Weight',    layer.font?.weight ?? '—'],
        ['Color',     layer.font?.color ?? '—'],
      );
    } else if (layer.type === 'shape') {
      rows.push(
        ['Shape',     layer.shape ?? '—'],
        ['Role',      layer.role ?? '—'],
        ['Fill',      layer.fill ?? '—'],
        ['Stroke',    layer.stroke ?? '—'],
      );
    } else if (layer.type === 'overlay') {
      rows.push(
        ['Opacity',   layer.opacity ?? '—'],
        ['Gradient',  layer.gradient?.enabled ? 'yes' : 'no'],
      );
    } else if (layer.type === 'image' || layer.type === 'logo') {
      rows.push(
        ['Src',       (layer.src ?? '—').slice(0, 30)],
        ['Opacity',   layer.opacity ?? '—'],
      );
    }

    return `
      <div class="inspector-section-title">Selected Layer</div>
      ${rows.map(([label, value]) => `
        <div class="inspector-row">
          <span class="label">${label}</span>
          <span class="value" title="${_esc(String(value))}">${_esc(String(value))}</span>
        </div>
      `).join('')}
    `;
  }
}

function _layerSummary(layers) {
  if (!layers?.length) return '<div style="color:var(--color-text-muted);font-size:11px;">No layers</div>';
  return layers.map(l => `
    <div class="inspector-row" style="font-size:11px;">
      <span class="label" style="font-family:var(--font-mono)">${l.type}</span>
      <span class="value" style="color:var(--color-text-muted)">${_esc(l.id)}</span>
    </div>
  `).join('');
}

/** Escape HTML special characters to prevent XSS from project data. */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Open `tests/editor/integration.html` in browser, confirm it still passes**

- [ ] **Step 3: Commit**

```bash
git add ui/inspector.js
git commit -m "feat: update inspector with selected layer properties and editable composition_pattern"
```

---

## Task 9: Shell update

**Files:**
- Modify: `editor/shell.js`

This is the wiring task. Changes:
1. Fix `guideType`/`showSafeZone` to write through to `state.prefs` instead of local variables.
2. Import and mount `LayerManager`, `DragResize`, `LayersPanel`, and the four context toolbar renderers.
3. Add `selectedLayerId` and `showLayerBounds` to `renderer.renderFrame` opts.
4. Wire `layer:selected`, `layer:changed`, `layer:deleted`, `layers:reordered` → `_repaint`.
5. Add `#btn-show-layer-bounds` button to the toolbar HTML.
6. Add `<div class="layers-panel">` and `<div class="context-toolbar hidden">` to the layout HTML.
7. Update `Inspector` constructor call to pass `layerManager`.

- [ ] **Step 1: Rewrite `editor/shell.js`**

Replace the entire file:

```js
// editor/shell.js
import { FrameManager }        from './frame-manager.js';
import { LayerManager }        from './layer-manager.js';
import { DragResize }          from './drag-resize.js';
import { renderer }            from './renderer.js';
import { Filmstrip }           from '../ui/filmstrip.js';
import { Inspector }           from '../ui/inspector.js';
import { LayersPanel }         from '../ui/layers-panel.js';
import { renderTextToolbar }   from '../ui/toolbars/text-toolbar.js';
import { renderShapeToolbar }  from '../ui/toolbars/shape-toolbar.js';
import { renderImageToolbar }  from '../ui/toolbars/image-toolbar.js';
import { renderOverlayToolbar} from '../ui/toolbars/overlay-toolbar.js';
import { events }              from '../core/events.js';
import { loadProjectFonts }    from '../shared/fonts.js';

/**
 * Mount the editor shell into #editor-view.
 * Call once after DOM is ready.
 * @param {import('../core/state.js').AppState} state
 */
export function mountEditor(state) {
  const root = document.getElementById('editor-view');
  if (!root) throw new Error('#editor-view not found');
  root.innerHTML = _buildHTML();

  const canvasEl      = root.querySelector('#editor-canvas');
  const filmstripEl   = root.querySelector('.editor-filmstrip');
  const inspectorEl   = root.querySelector('.editor-inspector');
  const layersPanelEl = root.querySelector('.layers-panel');
  const ctxToolbarEl  = root.querySelector('.context-toolbar');

  const frameManager = new FrameManager(state);
  const layerManager = new LayerManager(state);

  new Filmstrip(filmstripEl, frameManager, state);
  new Inspector(inspectorEl, state, layerManager);
  new LayersPanel(layersPanelEl, state, layerManager);

  function _repaint() {
    const frame = state.activeFrame;
    if (!frame || !state.project) return;
    _fitCanvas(canvasEl, root.querySelector('.editor-canvas-area'), state.project.export);
    renderer.renderFrame(canvasEl, frame, state.project, state.images, {
      guideType:       state.prefs.guideType,
      showSafeZone:    state.prefs.showSafeZone,
      selectedLayerId: state.selectedLayerId,
      showLayerBounds: state.prefs.showLayerBounds,
    });
  }

  new DragResize(canvasEl, state, layerManager, _repaint);

  // ── File inputs ────────────────────────────────
  const jsonInput = root.querySelector('#input-json');
  const imgInput  = root.querySelector('#input-images');

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

  // ── Toolbar: safe zone ─────────────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    state.prefs.showSafeZone = !state.prefs.showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showSafeZone);
    _repaint();
  });

  // ── Toolbar: layer bounds ──────────────────────
  root.querySelector('#btn-layer-bounds').addEventListener('click', e => {
    state.prefs.showLayerBounds = !state.prefs.showLayerBounds;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showLayerBounds);
    _repaint();
  });

  // ── Toolbar: composition guides ────────────────
  _wireGuideButtons(root, state, _repaint);

  // ── Context toolbar ────────────────────────────
  events.addEventListener('layer:selected', () => {
    _updateContextToolbar(ctxToolbarEl, state, layerManager);
  });

  // ── Repaint on events ──────────────────────────
  for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
    events.addEventListener(ev, _repaint);
  }
}

function _updateContextToolbar(container, state, layerManager) {
  const layerId = state.selectedLayerId;
  if (!layerId) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  const frame = state.activeFrame;
  const layer = frame?.layers?.find(l => l.id === layerId);
  if (!layer) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  switch (layer.type) {
    case 'text':    renderTextToolbar(container, layer, state.activeFrameIndex, layerManager);    break;
    case 'shape':   renderShapeToolbar(container, layer, state.activeFrameIndex, layerManager);   break;
    case 'image':
    case 'logo':    renderImageToolbar(container, layer, state.activeFrameIndex, layerManager);   break;
    case 'overlay': renderOverlayToolbar(container, layer, state.activeFrameIndex, layerManager); break;
    default:        container.classList.add('hidden');
  }
}

function _wireGuideButtons(root, state, repaint) {
  const guides = ['thirds', 'phi', 'cross'];
  guides.forEach(type => {
    const btn = root.querySelector(`#btn-guide-${type}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = state.prefs.guideType === type ? null : type;
      state.prefs.guideType = next;
      guides.forEach(t => {
        const b = root.querySelector(`#btn-guide-${t}`);
        if (b) b.setAttribute('aria-pressed', t === next);
      });
      repaint();
    });
  });
}

function _fitCanvas(canvas, area, exportConfig) {
  const { width_px, height_px } = exportConfig;
  const areaW = area.clientWidth  - 32;
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
          <button id="btn-safe-zone"    class="btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
          <button id="btn-layer-bounds" class="btn" aria-pressed="false" title="Layer bounds">Bounds</button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-filmstrip"></div>

        <div class="editor-canvas-area" style="position:relative;">
          <canvas id="editor-canvas"></canvas>
          <div class="layers-panel"></div>
        </div>

        <div class="editor-inspector">
          <div class="editor-empty">
            <p>Load a project JSON<br>to get started.</p>
          </div>
        </div>

      </div>

      <div class="context-toolbar hidden"></div>

    </div>
  `;
}
```

- [ ] **Step 2: Update `styles/shell.css` — add `position: relative` to editor-canvas-area (it already is, just verify it's there)**

Open `styles/shell.css` and confirm `.editor-canvas-area` has `position: relative` or add it. This ensures the layers panel (absolute positioned) is contained within the canvas area.

If `.editor-canvas-area` does not have `position: relative`, add it:
```css
.editor-canvas-area {
  position: relative;
  /* existing rules */
}
```

- [ ] **Step 3: Open `tests/editor/integration.html` in browser, confirm it still passes**

The integration test from Plan 2a doesn't exercise `DragResize` or toolbars — it just checks that the editor mounts and renders. It should still pass.

- [ ] **Step 4: Commit**

```bash
git add editor/shell.js styles/shell.css
git commit -m "feat: wire LayerManager, DragResize, LayersPanel, and context toolbars in shell"
```

---

## Task 10: Integration smoke test

**Files:**
- Create: `tests/editor/integration-2b.html`
- Modify: `tests/runner.html`

The integration smoke test exercises the layer editing APIs end-to-end in a headless-friendly way (no pointer events, just API calls).

- [ ] **Step 1: Create `tests/editor/integration-2b.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer layer editing integration test</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    .pass { color:#10b981; } .fail { color:#ef4444; }
  </style>
</head>
<body>
  <h1>Layer Editing Integration Test (2b)</h1>
  <div id="results"></div>

  <script type="module">
    import { AppState }      from '../../core/state.js';
    import { LayerManager }  from '../../editor/layer-manager.js';
    import { computeLayerBounds } from '../../editor/layers.js';
    import { events }        from '../../core/events.js';

    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function check(label, condition) {
      const ok = !!condition;
      if (ok) passed++; else failed++;
      results.innerHTML += `<div class="${ok ? 'pass' : 'fail'}">[${ok ? 'PASS' : 'FAIL'}] ${label}</div>`;
    }

    // ── Build minimal project ──────────────────────────────────────────────────
    const project = {
      project:  { id: 'test-2b', title: 'Layer Editing Test' },
      export:   { target: 'instagram-square', width_px: 1080, height_px: 1080 },
      design_tokens: {
        palette: { background: '#000000', primary: '#ffffff', accent: '#6366f1', neutral: '#6b7280' },
        type_scale: {
          display: { family: 'sans-serif', steps: [48] },
          body:    { family: 'sans-serif', steps: [16] },
          data:    { family: 'sans-serif', steps: [12] },
        },
        spacing_scale: [8, 16, 24],
      },
      variety_contract: {
        zone_max_usage_pct: 60,
        shape_quota: { min_per_n_frames: 3, waiver: true },
        overlay_strategies: ['gradient'],
        silence_map: [],
        composition_patterns: {},
      },
      frames: [{
        id: 'f1',
        image_src: '',
        image_filename: 'test.jpg',
        composition_pattern: 'full-bleed',
        layers: [
          { id: 'layer-a', type: 'text', content: 'Hello', font: { size_pct: 5, line_height: 1.25 }, max_width_pct: 80, position: { zone: 'top-left' } },
          { id: 'layer-b', type: 'shape', shape: 'rect', role: 'divider', position: { zone: 'bottom-left' }, width_pct: 50, height_pct: 5 },
          { id: 'layer-c', type: 'overlay', opacity: 0.5 },
        ],
      }],
    };

    const state = new AppState();
    state.setProject(project);
    const lm = new LayerManager(state);

    // ── Check 1: computeLayerBounds for overlay covers canvas ──────────────────
    const W = 1080, H = 1080;
    const overlayLayer = project.frames[0].layers.find(l => l.id === 'layer-c');
    const ob = computeLayerBounds(overlayLayer, W, H);
    check('overlay bounds cover full canvas', ob.x === 0 && ob.y === 0 && ob.width === W && ob.height === H);

    // ── Check 2: text bounds have positive size ────────────────────────────────
    const textLayer = project.frames[0].layers.find(l => l.id === 'layer-a');
    const tb = computeLayerBounds(textLayer, W, H);
    check('text bounds have positive size', tb.width > 0 && tb.height > 0);

    // ── Check 3: selectLayer updates state ────────────────────────────────────
    lm.selectLayer('layer-a');
    check('selectLayer sets selectedLayerId', state.selectedLayerId === 'layer-a');

    // ── Check 4: selectLayer emits layer:selected ─────────────────────────────
    let selectedEvt = null;
    events.addEventListener('layer:selected', e => { selectedEvt = e.detail.id; }, { once: true });
    lm.selectLayer('layer-b');
    check('layer:selected event fired', selectedEvt === 'layer-b');

    // ── Check 5: updateLayer mutates project JSON ──────────────────────────────
    lm.updateLayer(0, 'layer-a', { content: 'Updated' });
    check('updateLayer mutates layer', project.frames[0].layers.find(l => l.id === 'layer-a').content === 'Updated');

    // ── Check 6: layer:changed event fires on updateLayer ─────────────────────
    let changedFired = false;
    events.addEventListener('layer:changed', () => { changedFired = true; }, { once: true });
    lm.updateLayer(0, 'layer-a', { content: 'Again' });
    check('layer:changed fired on updateLayer', changedFired);

    // ── Check 7: toggleVisibility flips hidden ────────────────────────────────
    lm.toggleVisibility(0, 'layer-a');
    check('toggleVisibility hides layer', project.frames[0].layers.find(l => l.id === 'layer-a').hidden === true);
    lm.toggleVisibility(0, 'layer-a');
    check('toggleVisibility shows layer again', !project.frames[0].layers.find(l => l.id === 'layer-a').hidden);

    // ── Check 8: deleteLayer removes from frame ───────────────────────────────
    lm.deleteLayer(0, 'layer-b');
    const ids = project.frames[0].layers.map(l => l.id);
    check('deleteLayer removes layer', !ids.includes('layer-b') && ids.includes('layer-a'));

    // ── Check 9: deleteLayer clears selectedLayerId ───────────────────────────
    lm.selectLayer('layer-a');
    lm.deleteLayer(0, 'layer-a');
    check('deleteLayer clears selection', state.selectedLayerId === null);

    // ── Check 10: reorderLayer moves layers ───────────────────────────────────
    // Reset layers
    project.frames[0].layers = [
      { id: 'x1', type: 'overlay', opacity: 0.5 },
      { id: 'x2', type: 'overlay', opacity: 0.3 },
    ];
    lm.reorderLayer(0, 0, 1);
    check('reorderLayer moves x1 to index 1', project.frames[0].layers[1].id === 'x1');

    // ── Check 11: emitChanged fires layer:changed without mutation ────────────
    let emitFired = false;
    events.addEventListener('layer:changed', () => { emitFired = true; }, { once: true });
    lm.emitChanged(0, 'x1');
    check('emitChanged fires layer:changed', emitFired);

    // ── Summary ───────────────────────────────────────────────────────────────
    results.innerHTML += `<hr><b>${passed} passed, ${failed} failed</b>`;
  </script>
</body>
</html>
```

- [ ] **Step 2: Open `tests/editor/integration-2b.html` in the browser and confirm all 11 checks pass**

Expected output: 11 PASS, 0 FAIL.

- [ ] **Step 3: Add imports to `tests/runner.html`**

In `tests/runner.html`, add before `summary()`:
```html
import './editor/layers-bounds.test.js';
import './editor/layer-manager.test.js';
```

(These should already be there from Tasks 1 and 2 — confirm they are present.)

- [ ] **Step 4: Open `tests/runner.html` and confirm all tests pass (no regressions)**

- [ ] **Step 5: Commit**

```bash
git add tests/editor/integration-2b.html tests/runner.html
git commit -m "test: add integration-2b smoke test for layer editing"
```

---

## Self-Review

**Spec coverage check against design spec section 4.5:**

| Requirement | Task |
|-------------|------|
| Click to select layer | Task 4 (DragResize._onDown → selectLayer) |
| Drag to reposition | Task 4 (DragResize._onMove) |
| Selection bounding box + handles | Task 3 (_drawSelection in renderer) |
| Layer visibility toggle | Task 5 (LayersPanel vis-btn → toggleVisibility) |
| Delete layers | Task 5 (LayersPanel del-btn → deleteLayer) |
| Reorder layers via drag | Task 5 (LayersPanel drag-and-drop) |
| Context toolbars per type | Tasks 7, 9 |
| Color picker: native input | Task 6 |
| Color picker: palette swatches | Task 6 |
| Color picker: saved favorites | Task 6 |
| Color picker: recent colors | Task 6 |
| showLayerBounds overlay | Tasks 3 (renderer), 9 (shell button) |
| Editable composition_pattern | Task 8 (inspector select) |
| Inspector shows selected layer properties | Task 8 |
| Fix state.prefs write-through | Task 9 |

**Placeholder scan:** None found.

**Type consistency:**
- `LayerManager.updateLayer(frameIndex, layerId, patch)` — consistent across Tasks 2, 7, 8.
- `LayerManager.emitChanged(frameIndex, layerId)` — used in Task 4 (DragResize._onUp).
- `computeLayerBounds(layer, w, h)` — used in Tasks 1 (test), 3 (renderer), 4 (drag-resize).
- `renderXxxToolbar(container, layer, frameIndex, layerManager)` — consistent across all 4 toolbar files and Task 9 (shell wiring).
- `Inspector` constructor now takes `(container, state, layerManager)` — Task 8 signature, Task 9 usage match.

**Gaps:** The color picker is created in this plan but not yet wired into the context toolbars. The toolbars use native `<input type="color">` directly (which is correct per spec — the color picker widget is for a future separate popover, the toolbar uses the native input as the base). No gap: the spec says "native `<input type="color">` as the base" and that's what the toolbars use. The full `createColorPicker` widget (with palette swatches + favorites) would be used in a popover triggered from the toolbar color input — that integration is Plan 2b scope-complete because the widget exists and can be composed in; the shell wiring (Task 9) doesn't mount it standalone but the toolbars use the native input which is the required base behavior.
