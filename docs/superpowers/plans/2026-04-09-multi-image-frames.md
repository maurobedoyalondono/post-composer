# Multi-Image Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-frame `multi_image` mode that allows multiple positioned image layers, aspect-ratio-locked canvas resize handles, per-frame background color override, and a toggle-off modal to safely revert to single-image mode.

**Architecture:** Six targeted file changes — no new abstractions, no new modules except the toggle-off modal and the `computeResizedBounds` pure function extracted from `DragResize` for testability. All changes are additive; single-image mode is untouched unless `frame.multi_image` is `true`. The resize math is extracted into an exported pure function so it can be unit-tested without DOM.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas API, browser pointer events, existing `tests/test-helper.js` micro-test framework (browser-based, open `tests/runner.html` to run).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/validator.js` | Modify | Allow `multi_image` + `bg_color` on frames; make `image_src`/`image_filename` optional when `multi_image` |
| `editor/renderer.js` | Modify | Per-frame `bg_color` resolution; skip `_drawCoverImage` when `multi_image` |
| `editor/drag-resize.js` | Modify | Export `computeResizedBounds` pure fn; add resize state + corner hit-test + aspect ratio + cursor |
| `ui/inspector.js` | Modify | Add Canvas section: `bg_color` picker + `multi_image` toggle; wire toggle-off modal |
| `ui/modals/multi-image-revert.js` | Create | Modal: choose background image when toggling off multi_image |
| `ui/toolbars/image-toolbar.js` | Modify | Width % + Height % controls when `frame.multi_image` is true |
| `editor/shell.js` | Modify | Fork drop handler: stack image layer when `multi_image`, replace filename when not |
| `tests/editor/drag-resize.test.js` | Create | Unit tests for `computeResizedBounds` |
| `tests/runner.html` | Modify | Add drag-resize test import |

---

## Task 1: Validator — allow `multi_image` and `bg_color` on frames

**Files:**
- Modify: `shared/validator.js` — `_validateFrame` function
- Modify: `tests/shared/validator.test.js` — add describe block at end of file

### Step 1.1: Write failing tests

Open `tests/shared/validator.test.js`. Add this block at the **end** of the file:

```js
describe('validator — frame multi_image and bg_color', () => {
  function frameProject(frameOverrides) {
    const p = minimal();
    p.frames = [{
      id: 'f01',
      image_src: 'test-img',
      image_filename: 'test.jpg',
      composition_pattern: 'editorial-anchor',
      layers: [],
      ...frameOverrides,
    }];
    // shape_quota waiver so shape quota doesn't fail with 1 frame
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'single frame test' };
    return p;
  }

  it('accepts multi_image: true without image_src/image_filename', () => {
    const p = minimal();
    p.frames = [{
      id: 'f01',
      multi_image: true,
      composition_pattern: 'editorial-anchor',
      layers: [],
    }];
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'test' };
    const result = validate(p);
    assert(result.valid, result.errors?.join(', '));
  });

  it('still requires image_src when multi_image is false', () => {
    const p = frameProject({ image_src: undefined });
    assert(!validate(p).valid);
  });

  it('still requires image_filename when multi_image is false', () => {
    const p = frameProject({ image_filename: undefined });
    assert(!validate(p).valid);
  });

  it('accepts a valid bg_color hex', () => {
    const result = validate(frameProject({ bg_color: '#1a2b3c' }));
    assert(result.valid, result.errors?.join(', '));
  });

  it('rejects bg_color that is not 6-digit hex', () => {
    assert(!validate(frameProject({ bg_color: 'red' })).valid);
    assert(!validate(frameProject({ bg_color: '#fff' })).valid);
    assert(!validate(frameProject({ bg_color: '#gggggg' })).valid);
  });

  it('accepts frame with no bg_color (absent)', () => {
    const result = validate(frameProject({}));
    assert(result.valid, result.errors?.join(', '));
  });
});
```

- [ ] **Step 1.1: Add the test block above to `tests/shared/validator.test.js`**

- [ ] **Step 1.2: Open `tests/runner.html` in browser — verify new tests FAIL**

Expected: 2 tests fail ("accepts multi_image: true without image_src/image_filename" and "accepts a valid bg_color hex").

- [ ] **Step 1.3: Modify `_validateFrame` in `shared/validator.js`**

Replace the existing `_validateFrame` function with:

```js
function _validateFrame(frame, index, usedLayerIds, err) {
  const label = `frames[${index}]`;
  if (!frame.id) err(`${label}.id is required`);

  // image_src and image_filename are required only in single-image mode
  if (!frame.multi_image) {
    if (!frame.image_src)      err(`${label}.image_src is required`);
    if (!frame.image_filename) err(`${label}.image_filename is required`);
  }

  // bg_color, if present, must be a valid 6-digit hex color
  if (frame.bg_color != null && !/^#[0-9a-fA-F]{6}$/.test(frame.bg_color)) {
    err(`${label}.bg_color must be a 6-digit hex color`);
  }

  if (!VALID_COMPOSITION_PATTERNS.includes(frame.composition_pattern))
    err(`${label}.composition_pattern "${frame.composition_pattern}" is not a valid pattern`);
  if (!Array.isArray(frame.layers)) err(`${label}.layers must be an array`);

  const frameLayerIds = new Set();
  for (let j = 0; j < (frame.layers ?? []).length; j++) {
    _validateLayer(frame.layers[j], `${label}.layers[${j}]`, frameLayerIds, err);
  }
}
```

- [ ] **Step 1.4: Open `tests/runner.html` in browser — verify all new tests PASS**

- [ ] **Step 1.5: Commit**

```bash
git add shared/validator.js tests/shared/validator.test.js
git commit -m "feat: allow multi_image and bg_color on frames in validator"
```

---

## Task 2: Renderer — per-frame bg_color + multi_image skip

**Files:**
- Modify: `editor/renderer.js` — `renderFrame` method, lines 32–37

No unit tests for the renderer (pixel-level output, verified visually in browser).

- [ ] **Step 2.1: Update background fill in `renderFrame`**

In `editor/renderer.js`, find the "Background fill" block (around line 31) and replace:

```js
// Background fill
ctx.fillStyle = project.design_tokens?.palette?.background ?? '#000000';
ctx.fillRect(0, 0, w, h);

// Background photo (keyed by image_filename)
const bg = images?.get(frame.image_filename);
if (bg) _drawCoverImage(ctx, bg, w, h);
```

with:

```js
// Background fill — frame bg_color overrides project palette
ctx.fillStyle = frame.bg_color ?? project.design_tokens?.palette?.background ?? '#000000';
ctx.fillRect(0, 0, w, h);

// Background photo — skipped in multi_image mode (image layers render themselves)
if (!frame.multi_image) {
  const bg = images?.get(frame.image_filename);
  if (bg) _drawCoverImage(ctx, bg, w, h);
}
```

- [ ] **Step 2.2: Visual smoke test in browser**

Load `canyon-series-2026.json` in the editor. Verify:
1. Frames still render normally (single-image mode unchanged).
2. Open the browser console and run:
   ```js
   state.activeFrame.bg_color = '#8B0000';
   events.dispatchEvent(new CustomEvent('frame:changed', { detail: {} }));
   ```
   Verify the canvas background turns dark red.
3. Set `state.activeFrame.bg_color = undefined` and re-dispatch — verify it reverts to project background.

- [ ] **Step 2.3: Commit**

```bash
git add editor/renderer.js
git commit -m "feat: per-frame bg_color override and multi_image renderer path"
```

---

## Task 3: DragResize — extract `computeResizedBounds` pure function

**Files:**
- Modify: `editor/drag-resize.js` — add exported pure function at top
- Create: `tests/editor/drag-resize.test.js`

This is the testable core of the resize system. Extract the math before wiring events.

- [ ] **Step 3.1: Create `tests/editor/drag-resize.test.js`**

```js
// tests/editor/drag-resize.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { computeResizedBounds } from '../../editor/drag-resize.js';

const orig = { x: 100, y: 100, width: 200, height: 100 };
const MIN = 10;

describe('computeResizedBounds — se handle (top-left fixed)', () => {
  it('grows bottom-right correctly', () => {
    const r = computeResizedBounds('se', orig, 350, 230, null, MIN);
    assertEqual(r.x, 100);
    assertEqual(r.y, 100);
    assertEqual(r.width, 250);
    assertEqual(r.height, 130);
  });

  it('applies aspect ratio: height follows width', () => {
    // ratio 2:1, mouse at x=300 → newW=200, newH=200/2=100
    const r = computeResizedBounds('se', orig, 300, 999, 2, MIN);
    assertEqual(r.x, 100);
    assertEqual(r.y, 100);
    assertEqual(r.width, 200);
    assertEqual(r.height, 100);
  });

  it('enforces minimum width', () => {
    const r = computeResizedBounds('se', orig, 101, 101, null, MIN);
    assert(r.width >= MIN, `width ${r.width} should be >= ${MIN}`);
    assert(r.height >= MIN, `height ${r.height} should be >= ${MIN}`);
  });
});

describe('computeResizedBounds — nw handle (bottom-right fixed)', () => {
  it('shrinks from top-left', () => {
    // fixed = (300, 200), mouse at (150, 150) → newW=150, newH=50
    const r = computeResizedBounds('nw', orig, 150, 150, null, MIN);
    assertEqual(r.x, 150);
    assertEqual(r.y, 150);
    assertEqual(r.width, 150);
    assertEqual(r.height, 50);
  });

  it('applies aspect ratio: height follows width', () => {
    // fixed=(300,200), ratio=2, mouse at x=200 → newW=100, newH=50
    const r = computeResizedBounds('nw', orig, 200, 999, 2, MIN);
    assertEqual(r.width, 100);
    assertEqual(r.height, 50);
    assertEqual(r.x, 200); // fixed(300) - newW(100)
    assertEqual(r.y, 150); // fixed(200) - newH(50)
  });
});

describe('computeResizedBounds — ne handle (bottom-left fixed)', () => {
  it('grows top-right correctly', () => {
    // fixed = (100, 200), mouse at (380, 80) → newW=280, newH=120
    const r = computeResizedBounds('ne', orig, 380, 80, null, MIN);
    assertEqual(r.x, 100);   // fixed left stays
    assertEqual(r.y, 80);    // fixed(200) - newH(120)
    assertEqual(r.width, 280);
    assertEqual(r.height, 120);
  });
});

describe('computeResizedBounds — sw handle (top-right fixed)', () => {
  it('grows bottom-left correctly', () => {
    // fixed = (300, 100), mouse at (50, 250) → newW=250, newH=150
    const r = computeResizedBounds('sw', orig, 50, 250, null, MIN);
    assertEqual(r.x, 50);    // fixed(300) - newW(250)
    assertEqual(r.y, 100);   // fixed top stays
    assertEqual(r.width, 250);
    assertEqual(r.height, 150);
  });
});
```

- [ ] **Step 3.2: Add `computeResizedBounds` export to `editor/drag-resize.js`**

Insert this block **after** the existing `import { computeLayerBounds } from './layers.js';` line, and **before** `export class DragResize {`:

```js
/**
 * Pure resize math — no DOM, fully testable.
 *
 * @param {'nw'|'ne'|'sw'|'se'} handle — which corner is being dragged
 * @param {{x: number, y: number, width: number, height: number}} origBounds — canvas px snapshot
 * @param {number} mx — current mouse x in canvas pixels
 * @param {number} my — current mouse y in canvas pixels
 * @param {number|null} aspectRatio — width/height ratio to lock; null = free resize
 * @param {number} minPx — minimum dimension in pixels
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function computeResizedBounds(handle, origBounds, mx, my, aspectRatio, minPx) {
  const { x, y, width, height } = origBounds;

  // Fixed corner = opposite of dragged handle
  const fixedX = (handle === 'nw' || handle === 'sw') ? x + width  : x;
  const fixedY = (handle === 'nw' || handle === 'ne') ? y + height : y;

  // Raw new dimensions from fixed corner to mouse
  let newW = Math.abs(mx - fixedX);
  let newH = Math.abs(my - fixedY);

  // Constrain to aspect ratio (height follows width)
  if (aspectRatio != null) newH = newW / aspectRatio;

  // Enforce minimum size
  newW = Math.max(newW, minPx);
  newH = Math.max(newH, minPx);

  // New top-left: if fixed corner is on the right/bottom, subtract new size from it
  const newX = (handle === 'nw' || handle === 'sw') ? fixedX - newW : fixedX;
  const newY = (handle === 'nw' || handle === 'ne') ? fixedY - newH : fixedY;

  return { x: newX, y: newY, width: newW, height: newH };
}
```

- [ ] **Step 3.3: Add the test import to `tests/runner.html`**

Open `tests/runner.html`. Find the block of `<script type="module">` import lines for editor tests. Add:

```html
<script type="module" src="./editor/drag-resize.test.js"></script>
```

- [ ] **Step 3.4: Open `tests/runner.html` in browser — verify all `computeResizedBounds` tests PASS**

- [ ] **Step 3.5: Commit**

```bash
git add editor/drag-resize.js tests/editor/drag-resize.test.js tests/runner.html
git commit -m "feat: extract computeResizedBounds pure fn + tests"
```

---

## Task 4: DragResize — wire resize into pointer events + cursor feedback

**Files:**
- Modify: `editor/drag-resize.js` — `DragResize` class

- [ ] **Step 4.1: Replace `DragResize` class with the full updated version**

Replace everything from `export class DragResize` to the final `}` with:

```js
export class DragResize {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/state.js').AppState} state
   * @param {import('./layer-manager.js').LayerManager} layerManager
   * @param {() => void} onRepaint
   */
  constructor(canvas, state, layerManager, onRepaint) {
    this._canvas   = canvas;
    this._state    = state;
    this._lm       = layerManager;
    this._repaint  = onRepaint;

    // Drag state
    this._dragging = false;
    this._startX   = 0;
    this._startY   = 0;
    this._origPos  = null;

    // Resize state
    this._resizing     = false;
    this._resizeHandle = null;  // 'nw' | 'ne' | 'sw' | 'se'
    this._origBounds   = null;  // { x, y, width, height } in canvas px at pointerdown
    this._aspectRatio  = null;  // natural image ratio, null = free

    canvas.addEventListener('pointerdown',   this._onDown.bind(this));
    canvas.addEventListener('pointermove',   this._onMove.bind(this));
    canvas.addEventListener('pointerup',     this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));
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
   * Test whether (cx, cy) is within `radius` px of a corner of `bounds`.
   * Returns the handle name ('nw','ne','sw','se') or null.
   */
  _hitHandle(cx, cy, bounds, radius) {
    const { x, y, width, height } = bounds;
    const corners = {
      nw: [x,         y         ],
      ne: [x + width, y         ],
      sw: [x,         y + height],
      se: [x + width, y + height],
    };
    for (const [handle, [hx, hy]] of Object.entries(corners)) {
      if (Math.abs(cx - hx) <= radius && Math.abs(cy - hy) <= radius) return handle;
    }
    return null;
  }

  /** Find the top-most non-hidden layer whose bounding box contains (cx, cy). */
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
    const w = this._canvas.width;
    const h = this._canvas.height;

    // Check resize handles on the currently selected layer first
    const selId = this._state.selectedLayerId;
    if (selId) {
      const selLayer = this._state.activeFrame?.layers?.find(l => l.id === selId);
      if (selLayer) {
        const bounds = computeLayerBounds(selLayer, w, h);
        const handle = this._hitHandle(x, y, bounds, 8);
        if (handle) {
          this._resizing     = true;
          this._resizeHandle = handle;
          this._origBounds   = { ...bounds };

          // Aspect ratio: lock for image layers using natural image dimensions
          if (selLayer.type === 'image' || selLayer.type === 'logo') {
            const img = this._state.images?.get(selLayer.src);
            this._aspectRatio = img
              ? img.naturalWidth / img.naturalHeight
              : null;
          } else {
            this._aspectRatio = null;
          }

          this._canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }
    }

    // Fall through to drag (existing logic unchanged)
    const layer = this._hitTest(x, y);
    if (layer) {
      this._lm.selectLayer(layer.id);
      this._dragging = true;
      this._startX   = x;
      this._startY   = y;
      this._origPos  = layer.position ? { ...layer.position } : null;
      this._canvas.setPointerCapture(e.pointerId);
    } else {
      this._lm.selectLayer(null);
    }
    e.preventDefault();
  }

  _onMove(e) {
    const { x, y } = this._toCanvas(e);
    const w = this._canvas.width;
    const h = this._canvas.height;

    // ── Resize branch ──────────────────────────────────────────────────────
    if (this._resizing) {
      const layer = this._state.activeFrame?.layers?.find(
        l => l.id === this._state.selectedLayerId
      );
      if (!layer) return;

      const minPx = Math.min(w, h) * 0.04; // 4% of smaller canvas dimension
      const { x: nx, y: ny, width: nw, height: nh } = computeResizedBounds(
        this._resizeHandle, this._origBounds, x, y, this._aspectRatio, minPx
      );

      layer.position  = { zone: 'absolute', x_pct: nx / w * 100, y_pct: ny / h * 100 };
      layer.width_pct  = nw / w * 100;
      layer.height_pct = nh / h * 100;
      this._repaint();
      return;
    }

    // ── Drag branch (unchanged) ────────────────────────────────────────────
    if (this._dragging) {
      const dx = x - this._startX;
      const dy = y - this._startY;

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
      return;
    }

    // ── Cursor feedback (no active operation) ──────────────────────────────
    const selId = this._state.selectedLayerId;
    if (selId) {
      const selLayer = this._state.activeFrame?.layers?.find(l => l.id === selId);
      if (selLayer) {
        const bounds = computeLayerBounds(selLayer, w, h);
        const handle = this._hitHandle(x, y, bounds, 8);
        if (handle) {
          this._canvas.style.cursor = (handle === 'nw' || handle === 'se')
            ? 'nw-resize'
            : 'ne-resize';
          return;
        }
      }
    }

    const hovered = this._hitTest(x, y);
    this._canvas.style.cursor = hovered ? 'move' : 'default';
  }

  _onUp(e) {
    if (this._resizing && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    } else if (this._dragging && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    }
    this._dragging     = false;
    this._resizing     = false;
    this._resizeHandle = null;
    this._origBounds   = null;
    this._aspectRatio  = null;
    this._origPos      = null;
  }
}
```

- [ ] **Step 4.2: Visual smoke test in browser**

Load the sample project. Add an image layer to a frame (via browser console):
```js
state.activeFrame.layers.push({
  id: 'test-img-layer',
  type: 'image',
  src: state.activeFrame.image_filename,
  position: { zone: 'absolute', x_pct: 10, y_pct: 10 },
  width_pct: 60,
  height_pct: 60,
  fit: 'cover',
  opacity: 1,
});
events.dispatchEvent(new CustomEvent('frame:changed', { detail: {} }));
```
Click the layer to select it. Verify:
1. Corner handles appear (blue squares).
2. Hover over a corner — cursor changes to `nw-resize` or `ne-resize`.
3. Drag a corner — layer resizes, aspect ratio is maintained.
4. Drag the body — layer moves as before.

- [ ] **Step 4.3: Commit**

```bash
git add editor/drag-resize.js
git commit -m "feat: aspect-ratio-locked resize handles in DragResize"
```

---

## Task 5: Inspector — Canvas section (bg_color + multi_image toggle)

**Files:**
- Modify: `ui/inspector.js` — `_render` method

- [ ] **Step 5.1: Add `_renderCanvasSection` method and insert into `_render`**

In `ui/inspector.js`, add this private method after `_renderLayerSection`:

```js
/** Render the Canvas section: bg_color override + multi_image toggle. */
_renderCanvasSection(frame) {
  const section = this._el.querySelector('#insp-canvas');
  if (!section) return;

  const projectBg = this._state.project?.design_tokens?.palette?.background ?? '#000000';
  const frameBg   = frame.bg_color ?? '';

  section.innerHTML = `
    <div class="inspector-section-title">Canvas</div>
    <div class="inspector-row">
      <span class="label">Background</span>
      <div style="display:flex;gap:4px;align-items:center;">
        <input type="color" id="insp-bg-color"
          value="${_esc(frameBg || projectBg)}"
          title="Frame background color (overrides project default)">
        <input type="text" id="insp-bg-hex"
          value="${_esc(frameBg)}"
          placeholder="${_esc(projectBg)}"
          maxlength="7"
          style="width:64px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
          title="Hex override — clear to use project default">
      </div>
    </div>
    <div class="inspector-row">
      <span class="label">Multi-image</span>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="checkbox" id="insp-multi-image" ${frame.multi_image ? 'checked' : ''}>
        <span style="font-size:11px;color:var(--color-text-muted);">Stack image layers</span>
      </label>
    </div>
  `;

  // bg_color: color picker
  section.querySelector('#insp-bg-color').addEventListener('input', e => {
    const hex = e.target.value;
    frame.bg_color = hex;
    section.querySelector('#insp-bg-hex').value = hex;
    events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
  });

  // bg_color: hex text field — clear = remove override
  section.querySelector('#insp-bg-hex').addEventListener('change', e => {
    const val = e.target.value.trim();
    if (!val) {
      delete frame.bg_color;
      section.querySelector('#insp-bg-color').value = projectBg;
    } else if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      frame.bg_color = val;
      section.querySelector('#insp-bg-color').value = val;
    }
    events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
  });

  // multi_image toggle
  section.querySelector('#insp-multi-image').addEventListener('change', e => {
    if (e.target.checked) {
      frame.multi_image = true;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    } else {
      // Toggle off — always show modal (see Task 7)
      e.target.checked = true; // revert checkbox until modal confirms
      this._onMultiImageToggleOff(frame);
    }
  });
}
```

- [ ] **Step 5.2: Update `_render` to add `#insp-canvas` and call `_renderCanvasSection`**

In the `_render` method, find the line:
```js
      <div class="inspector-section" id="insp-layer-props">
```

Insert the Canvas section div **before** it:

```js
      <div class="inspector-section" id="insp-canvas">
      </div>

      <div class="inspector-section" id="insp-layer-props">
```

Then at the end of `_render`, after `this._renderLayerSection()`, add:

```js
    this._renderCanvasSection(frame);
```

- [ ] **Step 5.3: Add placeholder `_onMultiImageToggleOff` method (wired in Task 7)**

Add this stub after `_renderCanvasSection`:

```js
/** Called when user toggles multi_image off. Wired in Task 7. */
_onMultiImageToggleOff(frame) {
  // Stub — implemented in Task 7
  frame.multi_image = false;
  const checkbox = this._el.querySelector('#insp-multi-image');
  if (checkbox) checkbox.checked = false;
  events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
}
```

- [ ] **Step 5.4: Visual smoke test in browser**

Load the sample project. Verify:
1. Inspector shows a "Canvas" section with a color picker and "Multi-image" checkbox.
2. Changing the bg color updates the canvas in real time.
3. Clearing the hex field reverts to the project background color.
4. Toggling multi_image on/off sets `frame.multi_image` (check in console: `state.activeFrame.multi_image`).

- [ ] **Step 5.5: Commit**

```bash
git add ui/inspector.js
git commit -m "feat: Canvas section in inspector — bg_color and multi_image toggle"
```

---

## Task 6: Toggle-off modal

**Files:**
- Create: `ui/modals/multi-image-revert.js`

- [ ] **Step 6.1: Create `ui/modals/multi-image-revert.js`**

```js
// ui/modals/multi-image-revert.js

/**
 * Show a modal asking the user to choose which image becomes the background
 * when turning off multi_image mode.
 *
 * @param {Array<{id: string, src: string}>} imageLayers — current image layers
 * @param {(selectedId: string, deleteUnused: boolean) => void} onConfirm
 */
export function showMultiImageRevertModal(imageLayers, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-header">Choose background image</div>
    <div class="modal-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--color-text-muted);">
        Select which image becomes the full-frame background.<br>
        It will be resized to fill the canvas.
      </p>
      <div id="modal-img-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
        ${imageLayers.map((l, i) => `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 6px;border-radius:var(--radius-sm);background:var(--color-surface-2);">
            <input type="radio" name="modal-bg-img" value="${_escAttr(l.id)}" ${i === 0 ? 'checked' : ''}>
            <span style="font-size:12px;font-family:var(--font-mono);">${_escHtml(l.src)}</span>
          </label>
        `).join('')}
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="modal-delete-unused">
        Delete unused image layers
      </label>
    </div>
    <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
      <button id="modal-confirm" class="btn btn-primary">Confirm</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#modal-confirm').addEventListener('click', () => {
    const selectedId    = modal.querySelector('input[name="modal-bg-img"]:checked')?.value;
    const deleteUnused  = modal.querySelector('#modal-delete-unused').checked;
    overlay.remove();
    if (selectedId) onConfirm(selectedId, deleteUnused);
  });
}

function _escAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

- [ ] **Step 6.2: Commit**

```bash
git add ui/modals/multi-image-revert.js
git commit -m "feat: multi-image revert modal component"
```

---

## Task 7: Wire toggle-off modal into Inspector

**Files:**
- Modify: `ui/inspector.js` — import modal, replace `_onMultiImageToggleOff` stub

- [ ] **Step 7.1: Add import to `ui/inspector.js`**

At the top of `ui/inspector.js`, add:

```js
import { showMultiImageRevertModal } from './modals/multi-image-revert.js';
```

- [ ] **Step 7.2: Replace the `_onMultiImageToggleOff` stub with the real implementation**

Replace the stub method:

```js
/** Called when user toggles multi_image off. Wired in Task 7. */
_onMultiImageToggleOff(frame) {
  // Stub — implemented in Task 7
  frame.multi_image = false;
  const checkbox = this._el.querySelector('#insp-multi-image');
  if (checkbox) checkbox.checked = false;
  events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
}
```

with:

```js
/** Show the revert modal when turning off multi_image. */
_onMultiImageToggleOff(frame) {
  const imageLayers = (frame.layers ?? []).filter(l => l.type === 'image');

  // No image layers — toggle off silently
  if (!imageLayers.length) {
    frame.multi_image = false;
    const checkbox = this._el.querySelector('#insp-multi-image');
    if (checkbox) checkbox.checked = false;
    events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    return;
  }

  showMultiImageRevertModal(
    imageLayers.map(l => ({ id: l.id, src: l.src })),
    (selectedId, deleteUnused) => {
      const selected = frame.layers.find(l => l.id === selectedId);
      if (!selected) return;

      // Promote selected layer to full-frame background
      selected.position   = { zone: 'absolute', x_pct: 0, y_pct: 0 };
      selected.width_pct  = 100;
      selected.height_pct = 100;
      selected.fit        = 'cover';

      // Update frame background references
      frame.image_filename = selected.src;
      const indexEntry = (this._state.project?.image_index ?? [])
        .find(i => i.filename === selected.src);
      if (indexEntry) frame.image_src = indexEntry.label;

      // Optionally delete unused image layers
      if (deleteUnused) {
        frame.layers = frame.layers.filter(l => l.type !== 'image' || l.id === selectedId);
      }

      frame.multi_image = false;
      const checkbox = this._el.querySelector('#insp-multi-image');
      if (checkbox) checkbox.checked = false;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    }
  );
}
```

- [ ] **Step 7.3: Visual smoke test**

In browser, toggle on multi_image, add two image layers via tray drag, then toggle off. Verify:
1. Modal appears with both images listed as radio options.
2. "Delete unused image layers" checkbox is unchecked by default.
3. Select one, confirm — that image becomes full-frame, `frame.multi_image` is false.
4. Check console: `state.activeFrame.image_filename` matches the selected image.
5. Repeat, this time checking "Delete unused" — verify the other image layer is gone from `state.activeFrame.layers`.

- [ ] **Step 7.4: Commit**

```bash
git add ui/inspector.js ui/modals/multi-image-revert.js
git commit -m "feat: wire toggle-off modal in inspector"
```

---

## Task 8: Image toolbar — Width/Height controls

**Files:**
- Modify: `ui/toolbars/image-toolbar.js`

- [ ] **Step 8.1: Update `renderImageToolbar` to accept `frame` and show size controls**

Replace the entire contents of `ui/toolbars/image-toolbar.js` with:

```js
// ui/toolbars/image-toolbar.js

/**
 * Render image/logo layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string, frame: object, images: Map }} opts
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit          = layer.fit ?? 'fill';
  const showSize     = !!(opts.frame?.multi_image);
  const widthPct     = layer.width_pct  ?? 100;
  const heightPct    = layer.height_pct ?? 100;

  container.innerHTML = `
    <div class="tb-grid">

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Fit</span>
        <div class="tb-btn-group" id="ctx-fit-group">
          <button class="btn${fit === 'cover'   ? ' btn-active' : ''}" data-fit="cover"   title="Fill bounds, crop excess">Cover</button>
          <button class="btn${fit === 'contain' ? ' btn-active' : ''}" data-fit="contain" title="Fit within bounds">Contain</button>
          <button class="btn${fit === 'fill'    ? ' btn-active' : ''}" data-fit="fill"    title="Stretch to exact size">Fill</button>
        </div>
      </div>

      <div class="ctrl">
        <span class="ctrl-label">Opacity %</span>
        <input type="number" id="ctx-img-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5">
      </div>

      ${showSize ? `
      <div class="ctrl">
        <span class="ctrl-label">Width %</span>
        <input type="number" id="ctx-img-width" value="${widthPct.toFixed(1)}" min="1" max="200" step="1">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Height %</span>
        <input type="number" id="ctx-img-height" value="${heightPct.toFixed(1)}" min="1" max="200" step="1" readonly style="opacity:0.6;cursor:default;" title="Locked to aspect ratio — edit Width to resize">
      </div>
      ` : ''}

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  container.querySelector('#ctx-fit-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-fit]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { fit: btn.dataset.fit });
    container.querySelectorAll('#ctx-fit-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  if (showSize) {
    container.querySelector('#ctx-img-width').addEventListener('change', e => {
      const newWidthPct = parseFloat(e.target.value);
      if (isNaN(newWidthPct) || newWidthPct < 1) return;

      // Compute locked height using natural image aspect ratio
      const img = opts.images?.get(layer.src);
      let newHeightPct = newWidthPct;
      if (img && img.naturalWidth > 0) {
        const ratio = img.naturalWidth / img.naturalHeight;
        newHeightPct = newWidthPct / ratio;
      }

      layerManager.updateLayer(frameIndex, layer.id, {
        width_pct:  newWidthPct,
        height_pct: newHeightPct,
      });

      // Update the read-only height display
      const heightInput = container.querySelector('#ctx-img-height');
      if (heightInput) heightInput.value = newHeightPct.toFixed(1);
    });
  }

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
```

- [ ] **Step 8.2: Update the `renderImageToolbar` call in `ui/inspector.js` to pass `frame` and `images`**

In `_renderLayerSection`, find the switch case for image/logo:

```js
case 'image':
case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm, opts);   break;
```

Update `opts` to include `frame` and `images`:

```js
const opts = {
  palette:   this._state.project?.design_tokens?.palette ?? {},
  projectId: this._state.project?.project?.id ?? 'default',
  frame:     this._state.activeFrame,
  images:    this._state.images,
};
```

(This replaces the existing `opts` object already defined just above the switch statement — just add the two new fields.)

- [ ] **Step 8.3: Visual smoke test**

In browser:
1. Enable multi_image on a frame.
2. Drop an image from the tray (or add one via console as in Task 4 smoke test).
3. Select the image layer.
4. Verify the toolbar shows "Width %" and "Height %" controls.
5. Change Width — verify height auto-updates and the canvas repaints with new size.
6. Disable multi_image on the frame — verify Width/Height controls disappear from the toolbar.

- [ ] **Step 8.4: Commit**

```bash
git add ui/toolbars/image-toolbar.js ui/inspector.js
git commit -m "feat: width/height controls in image toolbar for multi_image frames"
```

---

## Task 9: Shell — drop behavior fork

**Files:**
- Modify: `editor/shell.js` — canvas drop handler

- [ ] **Step 9.1: Update the canvas drop handler in `editor/shell.js`**

Find the `canvasEl.addEventListener('drop', ...)` block (around line 304). After the line `if (!filename || !state.images.has(filename)) return;`, add `const frame = state.activeFrame;` then replace everything up to (but not including) the `events.dispatchEvent` call with:

```js
  if (frame.multi_image) {
    // Stack a new image layer at full size — user resizes from here
    const newLayer = {
      id:         `img-${Date.now()}`,
      type:       'image',
      src:        filename,
      position:   { zone: 'absolute', x_pct: 0, y_pct: 0 },
      width_pct:  100,
      height_pct: 100,
      fit:        'cover',
      opacity:    1,
    };
    frame.layers = frame.layers ?? [];
    frame.layers.push(newLayer);
    layerManager.selectLayer(newLayer.id);
  } else {
    // Existing behaviour — replace background image
    frame.image_filename = filename;
    const indexEntry = (state.project.image_index ?? []).find(i => i.filename === filename);
    if (indexEntry) frame.image_src = indexEntry.label;
  }
```

The `events.dispatchEvent(new CustomEvent('frame:changed', ...))` line that follows stays unchanged.

- [ ] **Step 9.2: Visual smoke test**

In browser:
1. In single-image mode: drag an image from the tray to the canvas — verify `frame.image_filename` is updated (background changes).
2. Enable multi_image. Drag an image — verify a new image layer is added to `frame.layers` (check `state.activeFrame.layers` in console). Drag another — verify a second layer stacks on top.

- [ ] **Step 9.3: Commit**

```bash
git add editor/shell.js
git commit -m "feat: fork drop handler — stack image layers in multi_image mode"
```

---

## Task 10: Final integration smoke test

- [ ] **Step 10.1: Full end-to-end verification**

Open the editor in browser. Run through this checklist:

**Single-image mode (default)**
- [ ] Load `canyon-series-2026.json` — renders correctly, no regressions.
- [ ] Change inspector bg_color — canvas background updates.
- [ ] Clear bg_color hex field — canvas reverts to project palette background.
- [ ] Drag image from tray to canvas — `image_filename` updates (background changes), no image layer created.
- [ ] Drag a text/shape layer — moves as before.
- [ ] Drag a corner handle on a text layer — resizes (free, no aspect ratio lock).

**Multi-image mode**
- [ ] Toggle multi_image on in inspector — `frame.multi_image` is true.
- [ ] Drag image from tray — new image layer created at full size, selected.
- [ ] Drag a second image from tray — second image layer stacks, selected.
- [ ] Click first image layer — select it.
- [ ] Drag corner handle — resizes with aspect ratio locked to natural image dimensions.
- [ ] Edit Width % in toolbar — height auto-follows.
- [ ] Toggle multi_image off — modal appears with both images listed.
- [ ] Select one, leave "Delete unused" unchecked — confirm. Verify: selected promoted to 100×100, `frame.multi_image = false`, other layer still present.
- [ ] Toggle multi_image off again on a frame with one image layer — modal still appears (always shown).
- [ ] Toggle multi_image off on a frame with no image layers — toggles silently.

**Validator**
- [ ] Open `tests/runner.html` — all tests pass including the new `validator — frame multi_image and bg_color` suite and `computeResizedBounds` suite.

- [ ] **Step 10.2: Commit all remaining changes (if any)**

```bash
git add -A
git commit -m "feat: multi-image frames — complete feature"
```
