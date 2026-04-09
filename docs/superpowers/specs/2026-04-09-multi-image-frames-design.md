# Multi-Image Frames Design
**Date:** 2026-04-09
**Status:** Approved

---

## Overview

Frames currently support one full-bleed background image. This design adds a `multi_image` mode per frame that allows multiple image layers with independent positioning, sizing, and aspect-ratio-locked resizing. It also introduces per-frame background color overrides and extends the drag/resize system in `DragResize` with corner-handle resizing — a foundation that will later apply to text and shape layers.

---

## Part 1 — JSON Changes

### 1.1 New frame-level fields

Two optional fields added to each frame object:

```json
{
  "id": "frame-01",
  "multi_image": true,
  "bg_color": "#2a1f1a",
  "image_src": "...",
  "image_filename": "...",
  "layers": [ ... ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `multi_image` | boolean | `false` | Enables multi-image mode for this frame |
| `bg_color` | string (hex) | absent | Per-frame background color override |

### 1.2 Background color resolution

```
frame.bg_color
  → if absent: design_tokens.palette.background
    → if absent: '#000000'
```

`bg_color` works in both modes — even in single-image mode it shows through any transparent areas.

### 1.3 Image layers

No structural changes. `type: "image"` layers already support `width_pct`, `height_pct`, `position`, `fit`, `opacity`, `src`. Multiple image layers in the same frame already work structurally today.

### 1.4 `frame.image_filename` role

`frame.image_filename` is retained for backward compatibility and filmstrip thumbnail rendering. It is not the rendering path in `multi_image` mode — image layers are. When toggling off multi_image, the selected image layer promotes to `frame.image_filename`.

---

## Part 2 — Renderer Changes

### 2.1 Per-frame bg_color

```js
// editor/renderer.js — renderFrame()
ctx.fillStyle = frame.bg_color
  ?? project.design_tokens?.palette?.background
  ?? '#000000';
```

### 2.2 multi_image rendering path

```js
// Skip background cover render in multi_image mode — image layers handle it
if (!frame.multi_image) {
  const bg = images?.get(frame.image_filename);
  if (bg) _drawCoverImage(ctx, bg, w, h);
}
```

The layers loop, overlays, selection, guides, and analysis passes are unchanged.

---

## Part 3 — Inspector: Canvas Section

A new `#insp-canvas` section is inserted between Composition and Layer properties:

```
[Frame]       — id, label, index (existing)
[Composition] — pattern select (existing)
[Canvas]      — NEW
[Layer props] — selected layer toolbar (existing)
```

### 3.1 Canvas section controls

**Background color**
- `<input type="color">` + hex text field
- Reads `frame.bg_color` if set; otherwise shows `design_tokens.palette.background` as a greyed placeholder (read-only)
- Clearing the value removes `frame.bg_color` (reverts to project default)
- Dispatches `frame:changed` on change

**Multi-image toggle**
- `<input type="checkbox">` styled as a switch
- Label: "Multi-image frame"
- On → `frame.multi_image = true`, dispatches `frame:changed`
- Off → triggers the toggle-off modal (see 3.2)

### 3.2 Toggle-off modal

Shown whenever `multi_image` is turned off, regardless of how many image layers exist (even one — images in multi mode may not be sized for full-bleed).

**Modal contents:**
- Heading: "Choose background image"
- List of current image layers, each showing filename/label with a radio button
- Checkbox: **"Delete unused image layers"** — unchecked by default
- Confirm button

**On confirm:**
- Selected image layer → resized to `width_pct: 100`, `height_pct: 100`, position reset to `{ zone: 'absolute', x_pct: 0, y_pct: 0 }`. Stays in the layer stack.
- `frame.image_filename` updated to the selected layer's `src`
- `frame.multi_image` set to `false`
- If "Delete unused" checked → all other image layers removed
- If "Delete unused" unchecked → other image layers remain as positioned layers
- Dispatches `frame:changed`

**Edge case — no image layers:** Toggle off silently with no modal. `frame.multi_image = false`, `frame.image_filename` unchanged.

---

## Part 4 — DragResize: Resize System

### 4.1 New state

```js
this._resizing     = false;
this._resizeHandle = null;  // 'nw' | 'ne' | 'sw' | 'se'
this._origBounds   = null;  // { x, y, width, height } in canvas px at pointerdown
this._aspectRatio  = null;  // natural image ratio for image layers, null = free
```

### 4.2 _onDown — corner hit-test before body hit-test

If a layer is currently selected, check its 4 corner handles first. Hit radius: 8px (larger than the 6px visual handle for easier clicking).

Corner positions come from `computeLayerBounds(selectedLayer, w, h)`:
- `nw`: `(b.x, b.y)`
- `ne`: `(b.x + b.width, b.y)`
- `sw`: `(b.x, b.y + b.height)`
- `se`: `(b.x + b.width, b.y + b.height)`

If a corner is hit:
- Set `_resizing = true`, `_resizeHandle = handle`
- Snapshot `_origBounds`
- For image layers: `_aspectRatio = img.naturalWidth / img.naturalHeight` using `state.images.get(layer.src)`
- For all other layer types: `_aspectRatio = null`
- Capture pointer, skip body hit-test

If no corner hit → fall through to existing drag logic (unchanged).

### 4.3 _onMove — resize branch

When `_resizing`:

1. **Fixed corner** = opposite of dragged handle:
   - `'se'` → fixed = `(origBounds.x, origBounds.y)` (top-left)
   - `'nw'` → fixed = `(origBounds.x + origBounds.width, origBounds.y + origBounds.height)` (bottom-right)
   - `'ne'` → fixed = `(origBounds.x, origBounds.y + origBounds.height)` (bottom-left)
   - `'sw'` → fixed = `(origBounds.x + origBounds.width, origBounds.y)` (top-right)

2. **Raw new dimensions** from fixed point to current mouse position.

3. **Aspect ratio constraint** (when `_aspectRatio` is set):
   - `newHeight = newWidth / _aspectRatio`
   - Fixed corner remains anchored

4. **Minimum size**: 4% of canvas width/height to prevent collapsing.

5. **Write back to layer**:
   ```js
   layer.position  = { zone: 'absolute', x_pct: newX / w * 100, y_pct: newY / h * 100 };
   layer.width_pct  = newWidth  / w * 100;
   layer.height_pct = newHeight / h * 100;
   ```

6. Call `_repaint()`

### 4.4 _onUp

Same as current drag path: emit `layer:changed`, clear `_resizing`, `_resizeHandle`, `_origBounds`, `_aspectRatio`.

### 4.5 Cursor feedback

`_onMove` when not dragging or resizing: check handle proximity on the selected layer, set `canvas.style.cursor`:
- Near `nw` or `se` → `nw-resize`
- Near `ne` or `sw` → `ne-resize`
- Body hit → `move`
- Otherwise → `default`

### 4.6 Scope

Resize activates for all layer types (corner hit-test runs whenever a layer is selected). Aspect ratio locking is only applied to image layers today. Text and shape resize behavior (free vs. constrained) is deferred to a future plan.

---

## Part 5 — Drop Behavior Change

`shell.js` canvas drop handler forks on `frame.multi_image`:

**`multi_image: false` (default)** — existing behavior unchanged:
```js
frame.image_filename = filename;
const indexEntry = (state.project.image_index ?? []).find(i => i.filename === filename);
if (indexEntry) frame.image_src = indexEntry.label;
```

**`multi_image: true`** — stack a new image layer:
```js
const newLayer = {
  id: `img-${Date.now()}`,
  type: 'image',
  src: filename,
  position: { zone: 'absolute', x_pct: 0, y_pct: 0 },
  width_pct: 100,
  height_pct: 100,
  fit: 'cover',
  opacity: 1,
};
frame.layers.push(newLayer);
layerManager.selectLayer(newLayer.id);
```

New layer starts full-size (`100×100%`). User resizes from there using corner handles.

---

## Part 6 — Image Toolbar: Size Controls

Shown only when `frame.multi_image` is true. Added below the existing fit/opacity controls:

| Control | Behavior |
|---------|----------|
| Width % | Editable number input. Writes `layer.width_pct`. Computes `layer.height_pct = width_pct / aspectRatio` using natural image dimensions. |
| Height % | Read-only display. Updates reactively when width changes. |

In single-image mode, size controls are hidden — the image always fills the canvas.

---

## Files Affected

| File | Change |
|------|--------|
| `editor/renderer.js` | Per-frame `bg_color` resolution; skip cover render when `multi_image` |
| `editor/drag-resize.js` | Add resize state, corner hit-test, aspect-ratio-locked resize, cursor feedback |
| `editor/shell.js` | Fork drop handler on `frame.multi_image`; wire toggle-off modal |
| `ui/inspector.js` | Add Canvas section (`bg_color` + `multi_image` toggle) |
| `ui/toolbars/image-toolbar.js` | Add Width/Height controls when `multi_image` is active |
| `shared/validator.js` | Allow `multi_image` and `bg_color` on frames (no breaking changes) |

**Not affected:** `core/`, `editor/layers.js`, `editor/layer-manager.js`, `editor/frame-manager.js`, `ui/filmstrip.js`, `ui/layers-panel.js`, `manager/`

---

## Decisions Not Made

- Resize behavior for text and shape layers (free vs. aspect-locked vs. shift-key constrained) — deferred to a future plan
- Whether `frame.multi_image` and `frame.bg_color` are validated as part of the variety contract — deferred
