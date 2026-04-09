# Image Layer Rotation & Border — Design Spec

**Date:** 2026-04-09
**Scope:** Image layer enhancements — manual rotation from the editor, per-layer border with global width setting. Both features also update the AI manual.

---

## 1. Data Model

### Image layer — new optional fields

```json
{
  "id": "img-inset",
  "type": "image",
  "src": "...",
  "fit": "cover",
  "opacity": 1,
  "rotation_deg": 45,
  "border": {
    "enabled": true,
    "color": "#B85530"
  },
  "width_pct": 48,
  "height_pct": 60,
  "position": { "zone": "absolute", "x_pct": 52, "y_pct": 20 }
}
```

**`rotation_deg`**
- Type: number (float). Default: `0`.
- Any float value in degrees. Converted to radians at render time.
- Omitted from JSON when `0` (no serialization noise on untouched layers).

**`border`**
- Type: object. Default: absent (treated as `{ enabled: false }`).
- `border.enabled` — boolean, default `false`.
- `border.color` — hex string, default `"#ffffff"`. Preserved when `enabled` is toggled off so the color is restored on re-enable.

### Globals — new field

```json
"globals": {
  "google_fonts": [...],
  "border_width_px": 4
}
```

**`border_width_px`**
- Type: integer. Default: `4` (applied at read time if absent; written on first edit).
- Applies to every image layer where `border.enabled: true`. Stored in absolute pixels — not a percentage — because borders are a display element independent of canvas scale.

---

## 2. Rendering (`editor/layers.js`)

`_renderImageLayer()` render sequence for every image layer:

1. `ctx.save()`
2. Translate to layer center: `ctx.translate(cx, cy)`
3. Rotate: `ctx.rotate(rotation_deg * Math.PI / 180)`
4. Translate back: `ctx.translate(-cx, -cy)`
5. Set `ctx.globalAlpha = layer.opacity`
6. **If `border.enabled`:** `ctx.fillStyle = border.color; ctx.fillRect(x, y, w, h)` at the full layer bounds
7. **Draw image** into the inset rect: `ctx.drawImage(img, x + bw, y + bw, w - bw*2, h - bw*2)` where `bw = globals.border_width_px` (or `0` when border is disabled). The existing fit logic (cover / contain) operates within this inset rect.
8. `ctx.restore()`

`computeLayerBounds()` returns the **unrotated** axis-aligned bounding box — unchanged from today. The rotated visual outline is drawn in the renderer overlay pass (selection/handles), not in bounds.

---

## 3. Canvas Interaction (`editor/drag-resize.js` + rotation handle)

### Hit testing (click to select)

For image layers with `rotation_deg !== 0`: translate the mouse point into the layer's center-relative coordinate system and apply the inverse rotation (`-rotation_deg`) before testing against the axis-aligned bounding box. All other layer types are unaffected.

### Resize handles (existing corners)

- The 8 handle points are computed from the unrotated bounding box, then rotated around the layer center by `rotation_deg` for display.
- Mouse drag deltas for resize are un-rotated before being applied to `width_pct` / `height_pct`. Aspect ratio locking logic is unchanged.

### Rotation handle (new)

- **Position:** Circle (radius 7px) centered 24px above the top-center of the rotated bounding box, connected by a short line to the bounding box edge.
- **Hit test priority:** Checked before resize corner handles in the `mousedown` handler.
- **Rotate mode:** On drag, compute `Math.atan2(mouse - layerCenter)` each `mousemove`. Subtract the initial grab-angle offset so the image doesn't jump on first move. Write result to `layer.rotation_deg` via `updateLayer()`. Canvas re-renders live each frame.
- **Commit:** On `mouseup`, the value is already committed via `updateLayer()` — no additional step needed.
- No changes to text, shape, overlay, or stats_block interaction paths.

---

## 4. Image Toolbar (`ui/toolbars/image-toolbar.js`)

Two new groups added after the existing opacity row.

### Rotation group

```
[ ↺ 90° ] [ ↻ 90° ] [ 180° ] [ ⊘ ]   Rotation: [___°]
```

- **↺ 90°** — `updateLayer({ rotation_deg: (current - 90 + 360) % 360 })`
- **↻ 90°** — `updateLayer({ rotation_deg: (current + 90) % 360 })`
- **180°** — `updateLayer({ rotation_deg: (current + 180) % 360 })`
- **⊘ Reset** — `updateLayer({ rotation_deg: 0 })`
- **Numeric input** — binds to `layer.rotation_deg`. Accepts any float. Updates on `change`. Arrow key support: 1° per step, 10° with Shift held.
- Input and canvas handle stay in sync via the existing `layer:changed` event re-rendering the toolbar.

### Border group

```
[ Border ●/○ ]   Color: [████]
```

- **Toggle** — sets `layer.border.enabled`. When off, color swatch is greyed out but visible (color value preserved).
- **Color swatch** — opens the existing color component (project palette + favorites + custom picker). Writes to `layer.border.color`.
- Both controls appear only for image layers (same conditional as existing width/height controls).

---

## 5. Global Settings Panel

New field alongside the existing `google_fonts` editor:

```
Border width   [ 4 ] px
```

- Integer input, minimum 0.
- Reads/writes `globals.border_width_px`. Absent value defaults to `4` at read time, written on first edit.
- Changing the value immediately re-renders all frames — any layer with `border.enabled: true` updates in the canvas preview.

---

## 6. AI Manual Updates (`docs/ai-manual.md`)

### Addition to Section 3 — image layer

Appended after the existing single-image / multi-image mode description:

---

**`rotation_deg`** — optional, default `0`. Rotates the image layer around its center. Any float value in degrees. Applied after position and size. Does not change the layer's bounding box footprint in the JSON — the bounding box is always the axis-aligned box before rotation.

Use sparingly on `multi_image` frames where rotated insets can add editorial energy. Avoid on full-canvas background images (100×100%) — rotation is visually meaningless when the image already fills the frame and creates empty corner artifacts.

**`border`** — optional object. When `border.enabled: true`, a solid border is drawn at the layer's full bounding box and the image content is inset by `globals.border_width_px` on all four sides. The total canvas footprint of the layer does not change — the image content area shrinks to make room for the border within the existing bounds.

`border.color` — pull from `design_tokens.palette` for tonal consistency. Border width is a global setting and cannot be overridden per layer.

Anti-pattern: enabling a border on a full-canvas image (100×100%) — the border will be clipped by the canvas edge and only the inner inset effect will be visible, which is not the intended use.

---

### Addition to Section 8 — Pre-Output Checklist

```
□ border.enabled image layers: confirm layer is not full-canvas (100×100%) — border clips at canvas edges
```

---

## 7. Files Changed

| File | Change |
|------|--------|
| `editor/layers.js` | Rotation transform + border inset render in `_renderImageLayer()` |
| `editor/drag-resize.js` | Inverse-rotation hit testing, rotated handle placement, rotation handle + rotate mode |
| `ui/toolbars/image-toolbar.js` | Rotation group (presets + numeric input), border group (toggle + color) |
| Global settings panel | `border_width_px` integer input |
| `docs/ai-manual.md` | `rotation_deg` and `border` entries in Section 3; checklist item in Section 8 |

---

## 8. Out of Scope

- Rotation on text, shape, overlay, or stats_block layers
- Per-layer border width override
- Border radius (rounded corners)
- Animated rotation
- Flip horizontal / flip vertical (separate feature if needed)
