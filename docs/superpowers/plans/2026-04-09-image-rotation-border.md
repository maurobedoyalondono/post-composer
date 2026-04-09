# Image Layer Rotation & Border — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual rotation (canvas drag handle + inspector preset buttons + numeric input) and per-layer inward border (per-layer toggle + color, global width) to image layers, plus update the AI manual.

**Architecture:** Rotation is stored as `rotation_deg` on image layers and applied via canvas `ctx.rotate()` around the layer center. All mouse hit-testing and resize operations inverse-rotate the mouse position before computing against the axis-aligned bounding box. Border is drawn as a filled rect at the full layer bounds; the image content is inset by `globals.border_width_px` — the layer's canvas footprint never changes.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D API, existing `createColorPicker` component.

---

## File Map

| File | Change |
|------|--------|
| `editor/layers.js` | Export `computeImageInsetRect`; update `renderLayer` + `_renderImageLayer` for rotation and border |
| `editor/renderer.js` | Pass `project.globals` to `renderLayer`; update `_drawSelection` to draw rotated box + rotation handle |
| `editor/drag-resize.js` | Export `rotatePoint` + `computeRotationHandlePoint`; update `DragResize` for rotation-aware hit-testing, resize, and rotate mode |
| `ui/toolbars/image-toolbar.js` | Add rotation group (presets + numeric) and border group (toggle + color picker) |
| `ui/inspector.js` | Add globals section with `border_width_px` input; pass `globals` in opts; add `#insp-globals` div |
| `editor/shell.js` | Add `globals:changed` to the repaint event list |
| `tests/editor/layers.test.js` | Add tests for `computeImageInsetRect` |
| `tests/editor/drag-resize.test.js` | Add tests for `rotatePoint` and `computeRotationHandlePoint` |
| `docs/ai-manual.md` | Add `rotation_deg` and `border` entries (Section 3); add checklist item (Section 8) |

---

## Task 1: Export `rotatePoint` and `computeRotationHandlePoint` from `drag-resize.js`

**Files:**
- Modify: `editor/drag-resize.js`
- Test: `tests/editor/drag-resize.test.js`

- [ ] **Step 1: Add the two exported pure functions to `editor/drag-resize.js`**

Insert after line 37 (after `computeResizedBounds`, before `export class DragResize`):

```js
/**
 * Rotate a point (px, py) around center (cx, cy) by angleDeg degrees (clockwise in canvas space).
 * @param {number} px @param {number} py
 * @param {number} cx @param {number} cy
 * @param {number} angleDeg
 * @returns {{ x: number, y: number }}
 */
export function rotatePoint(px, py, cx, cy, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx  = px - cx;
  const dy  = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Compute the canvas position of the rotation handle circle for an image layer.
 * The handle sits 24px above the top-center of the (possibly rotated) bounding box.
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @param {number} angleDeg
 * @returns {{ x: number, y: number }}
 */
export function computeRotationHandlePoint(bounds, angleDeg) {
  const cx = bounds.x + bounds.width  / 2;
  const cy = bounds.y + bounds.height / 2;
  // Unrotated handle: 24px above the top-center of the bounding box
  return rotatePoint(cx, bounds.y - 24, cx, cy, angleDeg);
}
```

- [ ] **Step 2: Add tests to `tests/editor/drag-resize.test.js`**

Append at the bottom of the file:

```js
import { rotatePoint, computeRotationHandlePoint } from '../../editor/drag-resize.js';

describe('rotatePoint', () => {
  it('0° rotation returns original point', () => {
    const r = rotatePoint(100, 50, 0, 0, 0);
    assert(Math.abs(r.x - 100) < 0.001, `x should be ~100, got ${r.x}`);
    assert(Math.abs(r.y -  50) < 0.001, `y should be ~50, got ${r.y}`);
  });

  it('90° clockwise around origin: (1,0) → (0,1) in canvas coords', () => {
    const r = rotatePoint(1, 0, 0, 0, 90);
    assert(Math.abs(r.x - 0) < 0.001, `x should be ~0, got ${r.x}`);
    assert(Math.abs(r.y - 1) < 0.001, `y should be ~1, got ${r.y}`);
  });

  it('180° around center returns opposite point', () => {
    const r = rotatePoint(200, 100, 100, 100, 180);
    assert(Math.abs(r.x -   0) < 0.001, `x should be ~0, got ${r.x}`);
    assert(Math.abs(r.y - 100) < 0.001, `y should be ~100, got ${r.y}`);
  });

  it('inverse rotation returns original point', () => {
    const p = rotatePoint(150, 80, 100, 100, 45);
    const back = rotatePoint(p.x, p.y, 100, 100, -45);
    assert(Math.abs(back.x - 150) < 0.001, `x should be ~150, got ${back.x}`);
    assert(Math.abs(back.y -  80) < 0.001, `y should be ~80, got ${back.y}`);
  });
});

describe('computeRotationHandlePoint', () => {
  const bounds = { x: 0, y: 100, width: 200, height: 100 };
  // center = (100, 150), unrotated handle = (100, 76) [100-24=76]

  it('0° — handle is directly above top-center', () => {
    const hp = computeRotationHandlePoint(bounds, 0);
    assert(Math.abs(hp.x - 100) < 0.001, `x should be ~100, got ${hp.x}`);
    assert(Math.abs(hp.y -  76) < 0.001, `y should be ~76, got ${hp.y}`);
  });

  it('90° — handle moves from above to the right of center', () => {
    // dx=0, dy=76-150=-74; rotated 90°: x'=100+0-(-74)*1=174, y'=150+0*1+(-74)*0=150
    const hp = computeRotationHandlePoint(bounds, 90);
    assert(Math.abs(hp.x - 174) < 0.001, `x should be ~174, got ${hp.x}`);
    assert(Math.abs(hp.y - 150) < 0.001, `y should be ~150, got ${hp.y}`);
  });
});
```

- [ ] **Step 3: Open `tests/runner.html` in a browser and verify all existing tests still pass and the new rotation math tests appear green**

Open: `tests/runner.html` (file:// or local server)
Expected: All previously passing tests still green; new `rotatePoint` and `computeRotationHandlePoint` suites appear and pass.

- [ ] **Step 4: Commit**

```bash
git add editor/drag-resize.js tests/editor/drag-resize.test.js
git commit -m "feat: export rotatePoint and computeRotationHandlePoint from drag-resize"
```

---

## Task 2: Export `computeImageInsetRect` + update `renderLayer` signature + `_renderImageLayer`

**Files:**
- Modify: `editor/layers.js`
- Test: `tests/editor/layers.test.js`

- [ ] **Step 1: Write failing tests for `computeImageInsetRect` in `tests/editor/layers.test.js`**

Append at the bottom of the file:

```js
import { computeImageInsetRect } from '../../editor/layers.js';

describe('computeImageInsetRect', () => {
  it('border 0 — returns original rect unchanged', () => {
    const r = computeImageInsetRect(10, 20, 200, 100, 0);
    assertEqual(r.x,      10);
    assertEqual(r.y,      20);
    assertEqual(r.width,  200);
    assertEqual(r.height, 100);
  });

  it('border 10 — insets by 10px on all sides', () => {
    const r = computeImageInsetRect(0, 0, 200, 100, 10);
    assertEqual(r.x,      10);
    assertEqual(r.y,      10);
    assertEqual(r.width,  180);
    assertEqual(r.height, 80);
  });

  it('border larger than half-width — width and height floored to 0', () => {
    const r = computeImageInsetRect(0, 0, 20, 20, 20);
    assertEqual(r.width,  0);
    assertEqual(r.height, 0);
  });

  it('null borderWidthPx treated as 0', () => {
    const r = computeImageInsetRect(5, 5, 100, 50, null);
    assertEqual(r.x, 5);
    assertEqual(r.y, 5);
    assertEqual(r.width, 100);
    assertEqual(r.height, 50);
  });
});
```

- [ ] **Step 2: Run tests — verify the new tests fail** (`computeImageInsetRect` not yet exported)

Open `tests/runner.html`. Expected: the four new `computeImageInsetRect` tests appear red.

- [ ] **Step 3: Export `computeImageInsetRect` from `editor/layers.js`**

Insert after the `computeLayerBounds` function (after line 133, before `export function renderLayer`):

```js
/**
 * Compute the image content rect after inset for a border.
 * Total bounding box footprint is unchanged — image shrinks inward.
 * @param {number} x - layer top-left x in canvas pixels
 * @param {number} y - layer top-left y in canvas pixels
 * @param {number} iw - layer width in canvas pixels
 * @param {number} ih - layer height in canvas pixels
 * @param {number|null} borderWidthPx
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeImageInsetRect(x, y, iw, ih, borderWidthPx) {
  const bw = borderWidthPx ?? 0;
  return {
    x:      x + bw,
    y:      y + bw,
    width:  Math.max(0, iw - bw * 2),
    height: Math.max(0, ih - bw * 2),
  };
}
```

- [ ] **Step 4: Update `renderLayer` to accept `globals` and pass it to `_renderImageLayer`**

Replace the existing `renderLayer` function (lines 143–152):

```js
/**
 * Render a single layer onto the canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @param {Map<string, HTMLImageElement>} images — keyed by filename
 * @param {object} [globals] — project.globals (for border_width_px)
 */
export function renderLayer(ctx, layer, w, h, images, globals = {}) {
  switch (layer.type) {
    case 'image':       _renderImageLayer(ctx, layer, w, h, images, globals); break;
    case 'overlay':     _renderOverlayLayer(ctx, layer, w, h);                break;
    case 'text':        _renderTextLayer(ctx, layer, w, h);                   break;
    case 'shape':       _renderShapeLayer(ctx, layer, w, h);                  break;
    case 'stats_block': _renderStatsBlock(ctx, layer, w, h);                  break;
    case 'logo':        _renderLogoLayer(ctx, layer, w, h, images);           break;
  }
}
```

- [ ] **Step 5: Replace `_renderImageLayer` with the rotation + border version**

Replace the entire `_renderImageLayer` function (lines 156–188):

```js
function _renderImageLayer(ctx, layer, w, h, images, globals) {
  const img = images?.get(layer.src);
  if (!img) return;

  const { x, y } = resolvePosition(layer.position, w, h);
  const iw = (layer.width_pct  ?? 100) / 100 * w;
  const ih = (layer.height_pct ?? 100) / 100 * h;
  const fit    = layer.fit ?? 'fill';
  const rotDeg = layer.rotation_deg ?? 0;

  const borderEnabled = layer.border?.enabled ?? false;
  const borderColor   = layer.border?.color   ?? '#ffffff';
  const bw = borderEnabled ? (globals?.border_width_px ?? 4) : 0;

  const cx = x + iw / 2;
  const cy = y + ih / 2;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  if (rotDeg !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate(rotDeg * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }

  // Border: fill full bounding box before image
  if (borderEnabled && bw > 0) {
    ctx.fillStyle = borderColor;
    ctx.fillRect(x, y, iw, ih);
  }

  // Image draw rect — inset by border width on all sides
  const inset = computeImageInsetRect(x, y, iw, ih, bw);
  const { x: ix, y: iy, width: iiw, height: iih } = inset;

  if (iiw <= 0 || iih <= 0) {
    ctx.restore();
    return;
  }

  if (fit === 'fill') {
    ctx.drawImage(img, ix, iy, iiw, iih);
  } else if (fit === 'cover') {
    const scale = Math.max(iiw / img.naturalWidth, iih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = ix + (iiw - dw) / 2;
    const dy = iy + (iih - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iiw, iih);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else { // contain
    const scale = Math.min(iiw / img.naturalWidth, iih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = ix + (iiw - dw) / 2;
    const dy = iy + (iih - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  ctx.restore();
}
```

- [ ] **Step 6: Run tests — verify all tests pass**

Open `tests/runner.html`. Expected: all tests green, including the four new `computeImageInsetRect` tests.

- [ ] **Step 7: Commit**

```bash
git add editor/layers.js tests/editor/layers.test.js
git commit -m "feat: add computeImageInsetRect, rotation and border rendering to image layers"
```

---

## Task 3: Pass `globals` from `renderer.js` to `renderLayer`; update selection drawing

**Files:**
- Modify: `editor/renderer.js`

- [ ] **Step 1: Pass `project.globals` to `renderLayer` in `renderFrame`**

In `renderer.js`, find the layer loop (lines 42–45):

```js
// Layers in declaration order — skip hidden layers
for (const layer of (frame.layers ?? [])) {
  if (layer.hidden) continue;
  renderLayer(ctx, layer, w, h, images);
}
```

Replace with:

```js
// Layers in declaration order — skip hidden layers
const globals = project.globals ?? {};
for (const layer of (frame.layers ?? [])) {
  if (layer.hidden) continue;
  renderLayer(ctx, layer, w, h, images, globals);
}
```

- [ ] **Step 2: Replace `_drawSelection` to draw rotated box + rotation handle**

Replace the entire `_drawSelection` function (lines 115–137):

```js
const ROTATION_HANDLE_RADIUS = 7;
const ROTATION_HANDLE_OFFSET = 24;

function _drawSelection(ctx, layer, w, h) {
  const b = layer.type === 'text'
    ? computeTextSelectionBounds(ctx, layer, w, h)
    : computeLayerBounds(layer, w, h);
  if (b.width === 0 && b.height === 0) return;

  const isImageType = (layer.type === 'image' || layer.type === 'logo');
  const rotDeg = isImageType ? (layer.rotation_deg ?? 0) : 0;
  const bcx = b.x + b.width  / 2;
  const bcy = b.y + b.height / 2;

  ctx.save();

  if (rotDeg !== 0) {
    ctx.translate(bcx, bcy);
    ctx.rotate(rotDeg * Math.PI / 180);
    ctx.translate(-bcx, -bcy);
  }

  // Selection box
  ctx.strokeStyle = 'rgba(100,160,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(b.x, b.y, b.width, b.height);

  // Corner handles
  const hs = 6;
  ctx.fillStyle = '#64a0ff';
  for (const [hx, hy] of [
    [b.x,           b.y],
    [b.x + b.width, b.y],
    [b.x,           b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }

  // Rotation handle — image/logo layers only (drawn in rotated space)
  if (isImageType) {
    const handleX = b.x + b.width / 2;
    const handleY = b.y - ROTATION_HANDLE_OFFSET;

    // Connector line
    ctx.strokeStyle = 'rgba(100,160,255,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(handleX, b.y);
    ctx.lineTo(handleX, handleY + ROTATION_HANDLE_RADIUS);
    ctx.stroke();

    // Handle circle
    ctx.strokeStyle = 'rgba(100,160,255,0.9)';
    ctx.lineWidth   = 2;
    ctx.fillStyle   = '#1a2a4a';
    ctx.beginPath();
    ctx.arc(handleX, handleY, ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotation arc icon inside circle
    ctx.strokeStyle = '#64a0ff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 3.5, 0.3, Math.PI * 1.7);
    ctx.stroke();
  }

  ctx.restore();
}
```

- [ ] **Step 3: Open the editor, load a project with an image layer in multi_image mode, select the layer, verify:**
  - Selection box rotates with the layer (test with `rotation_deg: 45` in the JSON)
  - Rotation handle circle appears above the top-center of the selected image
  - Non-image layers (text, shape) show no rotation handle

- [ ] **Step 4: Commit**

```bash
git add editor/renderer.js
git commit -m "feat: draw rotated selection box and rotation handle in renderer"
```

---

## Task 4: Update `DragResize` — rotation-aware hit-testing, resize, and rotate mode

**Files:**
- Modify: `editor/drag-resize.js`

- [ ] **Step 1: Import `rotatePoint` and `computeRotationHandlePoint` for internal use**

These are already defined in the same file. The functions just need to be called internally — no import needed.

Add four new state fields to the `DragResize` constructor, after `this._aspectRatio = null;` (line 62):

```js
// Rotate state
this._rotating           = false;
this._rotateCenter       = null;  // { x, y } canvas px center of layer
this._rotateStartAngle   = 0;     // angle (deg) from center to mouse at pointerdown
this._rotateLayerStartDeg = 0;    // layer.rotation_deg at pointerdown
```

- [ ] **Step 2: Update `_hitTest` to inverse-rotate the mouse for rotated image layers**

Replace the entire `_hitTest` method (lines 99–115):

```js
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
    let tx = cx, ty = cy;
    const angleDeg = layer.rotation_deg ?? 0;
    if (angleDeg !== 0) {
      const lx = b.x + b.width  / 2;
      const ly = b.y + b.height / 2;
      const u  = rotatePoint(tx, ty, lx, ly, -angleDeg);
      tx = u.x;
      ty = u.y;
    }
    if (tx >= b.x && tx <= b.x + b.width &&
        ty >= b.y && ty <= b.y + b.height) {
      return layer;
    }
  }
  return null;
}
```

- [ ] **Step 3: Update `_onDown` — check rotation handle, then inverse-rotate for resize handles**

Replace the entire `_onDown` method (lines 117–164):

```js
_onDown(e) {
  const { x, y } = this._toCanvas(e);
  const w = this._canvas.width;
  const h = this._canvas.height;

  const selId = this._state.selectedLayerId;
  if (selId) {
    const selLayer = this._state.activeFrame?.layers?.find(l => l.id === selId);
    if (selLayer) {
      const bounds  = computeLayerBounds(selLayer, w, h);
      const rotDeg  = selLayer.rotation_deg ?? 0;
      const isImage = selLayer.type === 'image' || selLayer.type === 'logo';

      // ── Rotation handle check (image/logo only, before resize handles) ──
      if (isImage) {
        const hp = computeRotationHandlePoint(bounds, rotDeg);
        if (Math.hypot(x - hp.x, y - hp.y) <= 10) {
          const bCx = bounds.x + bounds.width  / 2;
          const bCy = bounds.y + bounds.height / 2;
          this._rotating            = true;
          this._rotateCenter        = { x: bCx, y: bCy };
          this._rotateStartAngle    = Math.atan2(y - bCy, x - bCx) * 180 / Math.PI;
          this._rotateLayerStartDeg = rotDeg;
          this._canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }

      // ── Resize handle check — inverse-rotate mouse first ──
      let mx = x, my = y;
      if (rotDeg !== 0) {
        const bCx = bounds.x + bounds.width  / 2;
        const bCy = bounds.y + bounds.height / 2;
        const u   = rotatePoint(mx, my, bCx, bCy, -rotDeg);
        mx = u.x;
        my = u.y;
      }
      const handle = this._hitHandle(mx, my, bounds, HANDLE_RADIUS);
      if (handle) {
        this._resizing     = true;
        this._resizeHandle = handle;
        this._origBounds   = { ...bounds };

        if (isImage) {
          const img = this._state.images?.get(selLayer.src);
          this._aspectRatio = (img && img.naturalWidth > 0)
            ? img.naturalWidth / img.naturalHeight
            : (selLayer.aspect_ratio ?? null);
        } else {
          this._aspectRatio = null;
        }

        this._canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
  }

  // Fall through to drag (selection + move)
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
```

- [ ] **Step 4: Update `_onMove` — add rotate branch, add inverse-rotate to resize branch, add rotation handle cursor**

Replace the entire `_onMove` method (lines 166–236):

```js
_onMove(e) {
  const { x, y } = this._toCanvas(e);
  const w = this._canvas.width;
  const h = this._canvas.height;

  // ── Rotate branch ──────────────────────────────────────────────────────
  if (this._rotating) {
    const layer = this._state.activeFrame?.layers?.find(
      l => l.id === this._state.selectedLayerId
    );
    if (!layer) return;
    const { x: cx, y: cy } = this._rotateCenter;
    const currentAngle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    layer.rotation_deg = this._rotateLayerStartDeg + (currentAngle - this._rotateStartAngle);
    this._repaint();
    return;
  }

  // ── Resize branch ──────────────────────────────────────────────────────
  if (this._resizing) {
    const layer = this._state.activeFrame?.layers?.find(
      l => l.id === this._state.selectedLayerId
    );
    if (!layer) return;

    const minPx = Math.min(w, h) * 0.04;

    // Un-rotate mouse before computing resize — keeps width/height in layer-local space
    let mx = x, my = y;
    const rotDeg = layer.rotation_deg ?? 0;
    if (rotDeg !== 0) {
      const cx = this._origBounds.x + this._origBounds.width  / 2;
      const cy = this._origBounds.y + this._origBounds.height / 2;
      const u  = rotatePoint(mx, my, cx, cy, -rotDeg);
      mx = u.x;
      my = u.y;
    }

    const { x: nx, y: ny, width: nw, height: nh } = computeResizedBounds(
      this._resizeHandle, this._origBounds, mx, my, this._aspectRatio, minPx
    );

    layer.position   = { zone: 'absolute', x_pct: nx / w * 100, y_pct: ny / h * 100 };
    layer.width_pct  = nw / w * 100;
    layer.height_pct = nh / h * 100;
    this._repaint();
    return;
  }

  // ── Drag branch ────────────────────────────────────────────────────────
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
      const bounds  = computeLayerBounds(selLayer, w, h);
      const rotDeg  = selLayer.rotation_deg ?? 0;
      const isImage = selLayer.type === 'image' || selLayer.type === 'logo';

      // Rotation handle cursor
      if (isImage) {
        const hp = computeRotationHandlePoint(bounds, rotDeg);
        if (Math.hypot(x - hp.x, y - hp.y) <= 10) {
          this._canvas.style.cursor = 'grab';
          return;
        }
      }

      // Resize handle cursor (inverse-rotate mouse first)
      let mx = x, my = y;
      if (rotDeg !== 0) {
        const bCx = bounds.x + bounds.width  / 2;
        const bCy = bounds.y + bounds.height / 2;
        const u   = rotatePoint(mx, my, bCx, bCy, -rotDeg);
        mx = u.x;
        my = u.y;
      }
      const handle = this._hitHandle(mx, my, bounds, HANDLE_RADIUS);
      if (handle) {
        this._canvas.style.cursor = (handle === 'nw' || handle === 'se') ? 'nw-resize' : 'ne-resize';
        return;
      }
    }
  }

  const hovered = this._hitTest(x, y);
  this._canvas.style.cursor = hovered ? 'move' : 'default';
}
```

- [ ] **Step 5: Update `_onUp` to reset rotate state and emit `layer:changed`**

Replace the entire `_onUp` method (lines 238–251):

```js
_onUp(e) {
  this._canvas.style.cursor = 'default';
  if (this._rotating && this._state.selectedLayerId != null) {
    this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
  } else if (this._resizing && this._state.selectedLayerId != null) {
    this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
  } else if (this._dragging && this._state.selectedLayerId != null) {
    this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
  }
  this._dragging            = false;
  this._resizing            = false;
  this._rotating            = false;
  this._resizeHandle        = null;
  this._origBounds          = null;
  this._aspectRatio         = null;
  this._origPos             = null;
  this._rotateCenter        = null;
  this._rotateStartAngle    = 0;
  this._rotateLayerStartDeg = 0;
}
```

- [ ] **Step 6: Manual test in the editor — load a project with a multi_image frame, drag an image layer onto the canvas, then:**
  - Drag the rotation handle (circle above the selected image) — verify the image rotates freely
  - Use resize handles on a rotated image — verify resize still works correctly
  - Click elsewhere to deselect, click again — verify selection still works with rotated image
  - Verify cursor changes to `grab` when hovering over the rotation handle

- [ ] **Step 7: Run `tests/runner.html` — all existing drag-resize tests must still pass**

- [ ] **Step 8: Commit**

```bash
git add editor/drag-resize.js
git commit -m "feat: rotation handle drag and rotation-aware hit-testing in DragResize"
```

---

## Task 5: Add rotation group + border group to `image-toolbar.js`

**Files:**
- Modify: `ui/toolbars/image-toolbar.js`

- [ ] **Step 1: Add the `createColorPicker` import at the top of `image-toolbar.js`**

Add at line 1 (before the JSDoc comment):

```js
import { createColorPicker } from '../color-picker.js';
```

- [ ] **Step 2: Replace the entire `renderImageToolbar` function**

The new function adds a rotation section and border section. Replace everything from line 12 to the end of the file:

```js
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit       = layer.fit ?? 'fill';
  const showSize  = !!(opts.frame?.multi_image);
  const widthPct  = layer.width_pct  ?? 100;
  const heightPct = layer.height_pct ?? 100;
  const rotDeg    = layer.rotation_deg ?? 0;

  const cw = opts.canvasWidth  ?? 1080;
  const ch = opts.canvasHeight ?? 1350;

  const img          = opts.images?.get(layer.src);
  const naturalRatio = (img && img.naturalWidth > 0) ? img.naturalWidth / img.naturalHeight : null;
  const storedRatio  = layer.aspect_ratio ?? null;
  const activeRatio  = naturalRatio ?? storedRatio;
  const ratioKnown   = naturalRatio != null;

  const borderEnabled = layer.border?.enabled ?? false;
  const borderColor   = layer.border?.color   ?? '#ffffff';

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
        <input type="number" id="ctx-img-height" value="${heightPct.toFixed(1)}" min="1" max="200" step="1" readonly
          style="opacity:0.6;cursor:default;"
          title="Locked to aspect ratio — edit Width to resize">
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Aspect ratio</span>
        <input type="number" id="ctx-img-ratio"
          value="${activeRatio != null ? activeRatio.toFixed(4) : ''}"
          placeholder="e.g. 1.7778"
          min="0.1" max="20" step="0.0001"
          ${ratioKnown
            ? 'readonly style="opacity:0.6;cursor:default;" title="Auto-detected from image (width ÷ height in pixels)"'
            : 'title="Width ÷ height in pixels — define manually (e.g. 1.7778 for 16:9)"'}>
      </div>
      ` : ''}

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Rotation</span>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <button id="ctx-rot-ccw"   class="btn" title="Rotate 90° left">↺ 90°</button>
          <button id="ctx-rot-cw"    class="btn" title="Rotate 90° right">↻ 90°</button>
          <button id="ctx-rot-180"   class="btn" title="Rotate 180°">180°</button>
          <button id="ctx-rot-reset" class="btn" title="Reset to 0°">⊘</button>
          <input type="number" id="ctx-rotation" value="${rotDeg.toFixed(1)}"
            step="1"
            style="width:64px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
            title="Rotation in degrees (positive = clockwise)">
        </div>
      </div>

      <div class="ctrl tb-span-4">
        <span class="ctrl-label">Border</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="ctx-border-toggle" class="btn${borderEnabled ? ' btn-active' : ''}"
            title="${borderEnabled ? 'Border enabled — click to disable' : 'Border disabled — click to enable'}">
            ${borderEnabled ? '● On' : '○ Off'}
          </button>
          <div id="ctx-border-color-swatch"
            style="width:20px;height:20px;border-radius:3px;border:1px solid var(--color-border);
                   background:${borderColor};cursor:pointer;flex-shrink:0;
                   ${borderEnabled ? '' : 'opacity:0.35;pointer-events:none;'}"
            title="Border color">
          </div>
        </div>
      </div>
      <div id="ctx-border-color-picker" style="display:none;"></div>

      <div class="tb-actions">
        <button id="ctx-copy" class="btn">Copy</button>
        <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
        <button id="ctx-delete" class="btn tb-danger">Delete</button>
      </div>

    </div>
  `;

  // ── Fit ────────────────────────────────────────────────────────────────
  container.querySelector('#ctx-fit-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-fit]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { fit: btn.dataset.fit });
    container.querySelectorAll('#ctx-fit-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  // ── Opacity ────────────────────────────────────────────────────────────
  container.querySelector('#ctx-img-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  // ── Size controls (multi_image only) ────────────────────────────────────
  if (showSize) {
    if (!ratioKnown) {
      container.querySelector('#ctx-img-ratio').addEventListener('change', e => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          layerManager.updateLayer(frameIndex, layer.id, { aspect_ratio: val });
          layer.aspect_ratio = val;
        }
      });
    }

    container.querySelector('#ctx-img-width').addEventListener('change', e => {
      const newWidthPct = parseFloat(e.target.value);
      if (isNaN(newWidthPct) || newWidthPct < 1) return;
      const ratio = naturalRatio ?? layer.aspect_ratio ?? null;
      const newHeightPct = ratio != null ? newWidthPct * cw / (ratio * ch) : newWidthPct;
      layerManager.updateLayer(frameIndex, layer.id, { width_pct: newWidthPct, height_pct: newHeightPct });
      const heightInput = container.querySelector('#ctx-img-height');
      if (heightInput) heightInput.value = newHeightPct.toFixed(1);
    });
  }

  // ── Rotation presets ───────────────────────────────────────────────────
  container.querySelector('#ctx-rot-ccw').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: ((cur - 90) % 360 + 360) % 360 });
  });
  container.querySelector('#ctx-rot-cw').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: (cur + 90) % 360 });
  });
  container.querySelector('#ctx-rot-180').addEventListener('click', () => {
    const cur = layer.rotation_deg ?? 0;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: (cur + 180) % 360 });
  });
  container.querySelector('#ctx-rot-reset').addEventListener('click', () => {
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: 0 });
  });

  // ── Rotation numeric input ─────────────────────────────────────────────
  const rotInput = container.querySelector('#ctx-rotation');
  rotInput.addEventListener('change', e => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: val });
  });
  rotInput.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const cur  = layer.rotation_deg ?? 0;
    const step = e.shiftKey ? 10 : 1;
    const next = e.key === 'ArrowUp' ? cur + step : cur - step;
    layerManager.updateLayer(frameIndex, layer.id, { rotation_deg: next });
    e.target.value = next.toFixed(1);
  });

  // ── Border toggle ──────────────────────────────────────────────────────
  container.querySelector('#ctx-border-toggle').addEventListener('click', () => {
    const newEnabled = !(layer.border?.enabled ?? false);
    layerManager.updateLayer(frameIndex, layer.id, {
      border: { ...(layer.border ?? { color: '#ffffff' }), enabled: newEnabled },
    });
  });

  // ── Border color picker ────────────────────────────────────────────────
  const swatch        = container.querySelector('#ctx-border-color-swatch');
  const pickerEl      = container.querySelector('#ctx-border-color-picker');
  let pickerOpen      = false;

  swatch.addEventListener('click', () => {
    if (!pickerOpen) {
      const picker = createColorPicker({
        value:     layer.border?.color ?? '#ffffff',
        palette:   opts.palette   ?? {},
        projectId: opts.projectId ?? 'default',
        onChange:  (color) => {
          layerManager.updateLayer(frameIndex, layer.id, {
            border: { ...(layer.border ?? { enabled: false }), color },
          });
        },
      });
      pickerEl.innerHTML = '';
      pickerEl.appendChild(picker);
      pickerEl.style.display = 'block';
      pickerOpen = true;
    } else {
      pickerEl.style.display = 'none';
      pickerOpen = false;
    }
  });

  // ── Copy / Paste / Delete ─────────────────────────────────────────────
  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
```

- [ ] **Step 3: Manual test in the editor — select an image layer in multi_image mode, verify:**
  - Rotation section shows four preset buttons and a numeric input
  - ↺ and ↻ rotate the image 90° each click
  - 180° flips, ⊘ resets to 0°
  - Numeric input accepts typed values and arrow key increments (1° per step, 10° with Shift)
  - Dragging the canvas rotation handle updates the numeric input on release (via layer:changed re-render)
  - Border toggle shows ● On / ○ Off and greys out the swatch when off
  - Clicking the color swatch when border is on opens the color picker
  - Picking a color immediately updates the border on canvas

- [ ] **Step 4: Commit**

```bash
git add ui/toolbars/image-toolbar.js
git commit -m "feat: rotation and border controls in image toolbar"
```

---

## Task 6: Add globals section (`border_width_px`) to `inspector.js` + wire `globals:changed` in shell

**Files:**
- Modify: `ui/inspector.js`
- Modify: `editor/shell.js`

- [ ] **Step 1: Add `#insp-globals` div and `_renderGlobalsSection` call to `_render` in `inspector.js`**

In the `_render` method, find the end of the `this._el.innerHTML` template string. After the `<div class="inspector-section" id="insp-layer-props"></div>` entry, add one more div:

```html
<div class="inspector-section" id="insp-globals">
</div>
```

At the end of the `_render` method (after `this._renderCanvasSection(frame)`), add:

```js
this._renderGlobalsSection();
```

- [ ] **Step 2: Add `_renderGlobalsSection` method to `Inspector`**

Add after the `_renderCanvasSection` method and before `}` (closing the class), inserting this new method:

```js
/** Render the Project Settings section: border_width_px. */
_renderGlobalsSection() {
  const section = this._el.querySelector('#insp-globals');
  if (!section) return;
  const project = this._state.project;
  if (!project) { section.innerHTML = ''; return; }

  const globals       = project.globals ?? {};
  const borderWidthPx = globals.border_width_px ?? 4;

  section.innerHTML = `
    <div class="inspector-section-title">Project Settings</div>
    <div class="inspector-row">
      <span class="label">Border width</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <input type="number" id="insp-border-width"
          value="${borderWidthPx}"
          min="0" step="1"
          style="width:52px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:3px 5px;"
          title="Border width in pixels — applied to all image layers with border enabled">
        <span style="font-size:11px;color:var(--color-text-muted);">px</span>
      </div>
    </div>
  `;

  section.querySelector('#insp-border-width').addEventListener('change', e => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) {
      e.target.value = (project.globals?.border_width_px ?? 4);
      return;
    }
    if (!project.globals) project.globals = {};
    project.globals.border_width_px = val;
    events.dispatchEvent(new CustomEvent('globals:changed'));
  });
}
```

- [ ] **Step 3: Pass `globals` in the `opts` object inside `_renderLayerSection`**

In `_renderLayerSection`, find the `opts` object definition (around line 136):

```js
const opts = {
  palette:      this._state.project?.design_tokens?.palette ?? {},
  projectId:    this._state.project?.project?.id ?? 'default',
  frame:        this._state.activeFrame,
  images:       this._state.images,
  canvasWidth:  this._state.project?.export?.width_px  ?? 1080,
  canvasHeight: this._state.project?.export?.height_px ?? 1350,
};
```

Add `globals` as a new field:

```js
const opts = {
  palette:      this._state.project?.design_tokens?.palette ?? {},
  projectId:    this._state.project?.project?.id ?? 'default',
  frame:        this._state.activeFrame,
  images:       this._state.images,
  canvasWidth:  this._state.project?.export?.width_px  ?? 1080,
  canvasHeight: this._state.project?.export?.height_px ?? 1350,
  globals:      this._state.project?.globals ?? {},
};
```

- [ ] **Step 4: Wire `globals:changed` to `_repaint` in `editor/shell.js`**

Find the repaint event listener array at the bottom of `mountEditor` (around line 497):

```js
for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
  events.addEventListener(ev, _repaint);
}
```

Replace with:

```js
for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered', 'globals:changed']) {
  events.addEventListener(ev, _repaint);
}
```

- [ ] **Step 5: Manual test:**
  - Load a project and verify the "Project Settings" section appears in the inspector below the Canvas section
  - Change the border width — canvas updates immediately on all image layers with `border.enabled: true`
  - Verify invalid input (negative, non-numeric) is rejected and reverts

- [ ] **Step 6: Commit**

```bash
git add ui/inspector.js editor/shell.js
git commit -m "feat: border_width_px global setting in inspector, globals:changed event"
```

---

## Task 7: Update `docs/ai-manual.md`

**Files:**
- Modify: `docs/ai-manual.md`

- [ ] **Step 1: Add `rotation_deg` and `border` entries to Section 3 (image layer)**

Find the end of the "Single-image mode" / "Multi-image mode" block in Section 3 (after the `img-inset` JSON example, before `### overlay layer`). Insert:

```markdown
**`rotation_deg`** — optional, default `0`. Rotates the image layer around its center. Any float value in degrees (positive = clockwise). Applied after position and size. Does not change the layer's bounding box footprint in the JSON — the bounding box is always the axis-aligned box before rotation.

Use on `multi_image` inset layers where a slight rotation adds editorial energy. Avoid on full-canvas background images (100×100%) — rotation is visually meaningless when the image fills the frame and produces empty corner artifacts.

**`border`** — optional object. When `border.enabled: true`, a solid border is drawn at the layer's full bounding box and the image content is inset by `globals.border_width_px` on all four sides. The total canvas footprint of the layer does not change — the image shrinks inward.

- `border.color` — hex string. Pull from `design_tokens.palette` for tonal consistency.
- Border width is set globally in `globals.border_width_px` (integer, pixels). It cannot be overridden per layer.

Anti-pattern: enabling a border on a full-canvas image (100×100%) — the border clips at the canvas edge and is largely invisible.

**`globals.border_width_px`** — integer, default `4`. Applies to every image layer where `border.enabled: true`. Set in the Project Settings panel; not per-frame.
```

- [ ] **Step 2: Add checklist item to Section 8 (Pre-Output Checklist)**

Find the checklist block in Section 8. Add at the end, before the closing ` ``` `:

```
□ border.enabled image layers: confirm layer is not full-canvas (100×100%) — border clips at canvas edge
```

- [ ] **Step 3: Verify the manual reads correctly — open `docs/ai-manual.md` and check that:**
  - `rotation_deg` entry appears in Section 3 under image layer
  - `border` entry appears immediately after
  - `globals.border_width_px` is documented
  - New checklist item appears at the bottom of Section 8

- [ ] **Step 4: Commit**

```bash
git add docs/ai-manual.md
git commit -m "docs: add rotation_deg and border entries to ai-manual"
```

---

## Task 8: Full integration smoke test

- [ ] **Step 1: Open the editor with a test project that has a multi_image frame**

Set `frame.multi_image: true` on one frame. Drag two images from the image tray onto the canvas.

- [ ] **Step 2: Rotation end-to-end**
  - Select one image layer
  - Drag the rotation handle — verify smooth free rotation
  - Click ↺ 90° — verify 90° CCW
  - Click ↻ 90° — verify 90° CW
  - Click 180° — verify flip
  - Click ⊘ — verify resets to 0°
  - Type `33.5` in the numeric input — verify the canvas matches
  - Verify the numeric input updates after a drag-rotation (on mouse release)

- [ ] **Step 3: Border end-to-end**
  - Select an image layer
  - Toggle Border to ● On — verify a border appears around the image (image content shrinks inside bounds)
  - Click the color swatch — pick a bright red `#ff0000` — verify border color changes
  - Toggle Border to ○ Off — verify border disappears; image fills bounds again
  - Toggle back to On — verify the red color is preserved

- [ ] **Step 4: Global border width end-to-end**
  - Set border_width_px to `20` in Project Settings — verify all bordered layers update immediately
  - Set to `0` — verify bordered layers look identical to non-bordered (no visible border, no inset)
  - Reset to `4`

- [ ] **Step 5: Resize a rotated layer — verify it still resizes correctly (not skewed)**

- [ ] **Step 6: Run `tests/runner.html` — all tests must pass**

- [ ] **Step 7: Final commit with summary**

```bash
git add -A
git status  # confirm only expected files changed
git commit -m "feat: image layer rotation and border — full feature complete"
```
