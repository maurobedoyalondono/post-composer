# Editor UI Completeness — Design Spec

**Goal:** Bring all four context toolbars, the color picker, and the left panel layout to a high standard — filling meaningful gaps from FrameForge analysis while making deliberate design decisions appropriate to post-composer's inline inspector model.

**Fonts deferred:** Font family picker is out of scope for this pass.

---

## 1. Left Panel Layout

**Current problem:** Filmstrip has `flex: 1`; image tray is fixed `flex: 0 0 230px`. With equal image and slide counts the split is visually illogical.

**Fix:** Both get `flex: 1`. The left panel becomes a true 50/50 split — filmstrip on top, image tray on bottom, each scrollable independently. The panel stays at `width: 180px`.

---

## 2. LayerManager — Copy / Paste

Add two methods and one module-level clipboard variable to `editor/layer-manager.js`.

```
_clipboard: object|null   // deep-cloned layer, module-level (not instance)
```

**`copyLayer(frameIndex, layerId)`**
- Finds the layer in state, deep-clones it via `JSON.parse(JSON.stringify(layer))`
- Stores clone in `_clipboard`
- Emits no event (silent operation)

**`pasteLayer(frameIndex)`**
- Guards: `_clipboard` null → return
- Deep-clones `_clipboard` again (so repeated paste works)
- Assigns new id: `_clipboard.id + '-copy-' + Date.now()`
- If clone has zone-based position, shifts `offset_x_pct` and `offset_y_pct` by +2 each (so paste isn't invisible under original)
- Pushes clone into `state.project.frames[frameIndex].layers`
- Selects the new layer
- Emits `layer:changed`

**`hasClipboard()`** — returns `!!_clipboard` (used to disable paste buttons when nothing is copied)

---

## 3. Text Toolbar

File: `ui/toolbars/text-toolbar.js`

The toolbar renders inside the inspector's layer-props section. Keep the current pattern (function-based, no floating panel).

### Controls

**Row 1 — Content**
- Full-width `<textarea>` (2 rows, resize: none) bound to `layer.content`
- Updates on `input` event → `layerManager.updateLayer(..., { content })`
- Placeholder: "Text content…"

**Row 2 — Typography**
- **Size %** — number input (min 1, max 30, step 0.5) → `font.size_pct`
- **Weight** — select (300 Light / 400 Regular / 600 SemiBold / 700 Bold) → `font.weight`
- **I** italic toggle button → `font.style` ('italic' / 'normal')
- **Align** — 3-button group (left / center / right) → `font.align`

**Row 3 — Spacing**
- **Line H** — number input (min 0.8, max 3.0, step 0.05) → `font.line_height`
- **Spacing** — number input (min -0.1, max 0.5, step 0.01) → `font.letter_spacing_em`
  *(renderer already reads `letter_spacing_em` — wire up the missing UI)*
- **Max W %** — number input (min 10, max 100, step 5) → `max_width_pct`

**Row 4 — Color + Shadow**
- **Color swatch** — opens `createColorPicker` popover → `font.color`
- **Shadow** toggle button (label: "Shadow ☀") → toggles `layer.shadow.enabled`
  - Default when enabling: `{ enabled: true, color: '#000000', blur_px: 8, offset_x: 2, offset_y: 2, opacity: 0.6 }`

**Row 5 — Actions**
- **Copy** button → `layerManager.copyLayer(frameIndex, layer.id)`
- **Paste** button (disabled when `!layerManager.hasClipboard()`) → `layerManager.pasteLayer(frameIndex)`
- **Delete** button (danger color) → `layerManager.deleteLayer(frameIndex, layer.id)`

### Renderer update (layers.js `_renderTextLayer`)
Add shadow rendering before the fill text call:
```js
if (layer.shadow?.enabled) {
  ctx.shadowColor   = layer.shadow.color ?? '#000000';
  ctx.shadowBlur    = layer.shadow.blur_px ?? 8;
  ctx.shadowOffsetX = layer.shadow.offset_x ?? 2;
  ctx.shadowOffsetY = layer.shadow.offset_y ?? 2;
  ctx.globalAlpha   = layer.shadow.opacity ?? 0.6;  // applied to shadow only via save/restore
}
```
Actually: use `ctx.shadowColor` with rgba alpha embedded, so shadow opacity doesn't require a second globalAlpha pass:
- Compose shadow color as `rgba(r,g,b,opacity)` from `layer.shadow.color` + `layer.shadow.opacity`
- Set `ctx.shadowColor`, `ctx.shadowBlur`, `ctx.shadowOffsetX/Y`
- Reset all shadow properties to defaults after drawing

---

## 4. Shape Toolbar

File: `ui/toolbars/shape-toolbar.js`

### Controls

**Row 1 — Fill + Opacity**
- **Color swatch** → `createColorPicker` popover → `layer.fill`
  *(replaces the native `<input type="color">` — gives palette + favorites)*
- **Opacity %** — number input (min 0, max 100, step 5) → `layer.opacity`

**Row 2 — Stroke**
- **Stroke color swatch** → `createColorPicker` → `layer.stroke`
- **Stroke W** — number input (min 0, max 20, step 1) → `layer.stroke_width`

**Row 3 — Dimensions**
- **W %** — number input (min 1, max 100, step 1) → `layer.width_pct`
- **H %** — number input (min 1, max 100, step 1) → `layer.height_pct`
- **↔** full-width button → `width_pct = 100`, `position.offset_x_pct = 0` (if zone-based) or `position.x_pct = 0` (if absolute)
- **↕** full-height button → `height_pct = 100`, `position.offset_y_pct = 0`

**Row 4 — Alignment**
Six buttons: ← align-left · → align-right · ↑ align-top · ↓ align-bottom · ⊕ center-h · ⊕ center-v

Alignment logic (absolute position model):
- All alignment ops convert the layer to `position.zone = 'absolute'` first using the same zone→absolute conversion as FrameForge's `_toAbsolutePos`
- `align-left` → `x_pct = 0`
- `align-right` → `x_pct = 100 - width_pct`
- `align-top` → `y_pct = 0`
- `align-bottom` → `y_pct = 100 - height_pct`
- `center-h` → `x_pct = (100 - width_pct) / 2`
- `center-v` → `y_pct = (100 - height_pct) / 2`

**Row 5 — Actions**
- Copy / Paste / Delete (same pattern as text toolbar)

---

## 5. Image Toolbar

File: `ui/toolbars/image-toolbar.js`

### Controls

**Row 1 — Fit mode**
- 3-button toggle group: **Cover** | **Contain** | **Fill**
- Reads/writes `layer.fit` ('cover' / 'contain' / 'fill')
- Default: 'cover'

**Row 2 — Opacity**
- Number input (0-100, step 5) → `layer.opacity`

**Row 3 — Actions**
- Copy / Paste / Delete

### Renderer update (layers.js `_renderImageLayer`)
Currently uses `ctx.drawImage(img, x, y, iw, ih)` (effectively fill/stretch).
Add fit-mode logic:
- `'cover'` — scale to fill, crop excess (same as current background draw)
- `'contain'` — scale to fit within bounds, letterbox with transparency
- `'fill'` — stretch to exact dimensions (current behavior)

---

## 6. Overlay Toolbar

File: `ui/toolbars/overlay-toolbar.js`

### Controls

**Row 1 — Base fill**
- **Color swatch** → `createColorPicker` → `layer.color`; disabled when gradient enabled
- **Opacity %** — number input (0-100, step 5) → `layer.opacity`

**Row 2 — Blend mode**
- `<select>` with options: Normal | Multiply | Screen | Overlay | Soft Light
- Reads/writes `layer.blend_mode` ('normal' / 'multiply' / 'screen' / 'overlay' / 'soft-light')
- Default: 'normal'

**Row 3 — Gradient toggle + direction**
- **Gradient** checkbox → `layer.gradient.enabled`
- When enabled, show direction buttons: ↓ to-bottom | ↑ to-top | → to-right | ← to-left
- Active direction gets accent highlight

**Row 4 — Gradient stops** (only when gradient enabled)
- **Start opacity** — range slider (0-100) → `layer.gradient.stops[0]` opacity
- **End opacity** — range slider (0-100) → `layer.gradient.stops[1]` opacity
- **Start pos %** — number input (0-100, step 5) → `layer.gradient.stops[0].at`
- **End pos %** — number input (0-100, step 5) → `layer.gradient.stops[1].at`

**Row 5 — Actions**
- Copy / Paste / Delete (no paste for overlay as blend context differs — only Copy + Delete)

### Gradient data model
The renderer uses `gradient.stops = [{at, color}]`. The toolbar manages two stops and derives color from `layer.color + stop opacity`:
- Stop 0: `{ at: from_pos/100, color: hexToRgba(layer.color, from_opacity/100) }`
- Stop 1: `{ at: to_pos/100,   color: hexToRgba(layer.color, to_opacity/100) }`

Default when enabling gradient for first time:
```js
{ enabled: true, direction: 'to-bottom',
  from_opacity: 0, from_pos: 0,
  to_opacity: 100, to_pos: 100 }
```
Toolbar stores `from_opacity`, `from_pos`, `to_opacity`, `to_pos` as UI state and derives `stops` on every change.

### Renderer update (layers.js `_renderOverlayLayer`)
Add blend mode support:
```js
const BLEND_MAP = {
  'normal': 'source-over', 'multiply': 'multiply',
  'screen': 'screen', 'overlay': 'overlay', 'soft-light': 'soft-light'
};
ctx.globalCompositeOperation = BLEND_MAP[layer.blend_mode] ?? 'source-over';
```
Set before `ctx.globalAlpha`, restore to `'source-over'` after.

---

## 7. Color Picker — Tones

File: `ui/color-picker.js`

### Behavior
When the user clicks a palette swatch, it expands inline to show 5 tonal variants of that color (lightness shifts: −40, −20, 0, +20, +40). Clicking a tone applies it. Clicking elsewhere or clicking the original swatch again collapses.

### Color math (pure functions, no external deps)
```
hexToRgb(hex)        → {r, g, b}
rgbToHsl({r,g,b})    → {h, s, l}
hslToRgb({h,s,l})    → {r, g, b}
rgbToHex({r,g,b})    → hex string
shiftLightness(hex, deltaL) → hex   (L clamped 5–95)
getTones(hex)        → [hex×5]      (steps: −40, −20, 0, +20, +40)
```

### UI structure
```
[Palette]
  [swatch] [swatch ▼ expanded]
              [tone] [tone] [●base] [tone] [tone]   ← inline expansion
  [swatch] [swatch]
```
Only one swatch can be expanded at a time. Clicking a different swatch collapses the current one and expands the new one.

The expanded tones row is inserted as a `<div class="cp-tones-row">` immediately after the swatch row in the DOM. It collapses (removed from DOM) on the next click.

---

## File Impact Summary

| File | Change |
|------|--------|
| `styles/shell.css` | Left panel flex split |
| `editor/layer-manager.js` | `copyLayer`, `pasteLayer`, `hasClipboard` |
| `editor/layers.js` | Shadow render (text), fit mode (image), blend mode (overlay) |
| `ui/toolbars/text-toolbar.js` | Full rewrite — add content area, italic, line-height, letter-spacing, shadow, copy/paste/delete |
| `ui/toolbars/shape-toolbar.js` | Add color picker, width/height %, alignment buttons, copy/paste/delete |
| `ui/toolbars/image-toolbar.js` | Add fit mode buttons, copy/paste/delete |
| `ui/toolbars/overlay-toolbar.js` | Add blend mode, gradient direction, gradient stops, delete |
| `ui/color-picker.js` | Add tones expansion — color math functions + tones row UI |
| `styles/components.css` | Toolbar layout styles, tone swatch styles, alignment button group |

---

## Out of Scope

- Font family picker (deferred)
- Undo / redo
- Layer lock
- Harmonies in color picker
