# Editor UI Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all four context toolbars, the color picker, and the left panel to a high standard — adding content editing, shadow, italic, line-height, letter-spacing, fit mode, blend mode, gradient controls, copy/paste, alignment, and tonal color variants.

**Architecture:** Each toolbar is a pure function that renders into the `.insp-layer-controls` div. The `Inspector` class calls them with `(container, layer, frameIndex, layerManager, opts)` where `opts = { palette, projectId }`. `LayerManager` gains module-level copy/paste clipboard. Renderer (`editor/layers.js`) gains shadow, fit mode, and blend mode support. Color picker gains tones via pure color math functions.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, localStorage (color picker favorites).

---

## File Structure

| File | Change |
|------|--------|
| `styles/shell.css` | Left panel 50/50 flex split |
| `editor/layer-manager.js` | Add `copyLayer`, `pasteLayer`, `hasClipboard` |
| `editor/layers.js` | Shadow (text), fit mode (image), blend mode (overlay) |
| `ui/inspector.js` | Pass `opts = { palette, projectId }` to all toolbar render calls |
| `ui/toolbars/text-toolbar.js` | Full rewrite: content, italic, line-height, letter-spacing, shadow, color picker, copy/paste/delete |
| `ui/toolbars/shape-toolbar.js` | Add color picker, width/height %, alignment, copy/paste/delete |
| `ui/toolbars/image-toolbar.js` | Add fit mode buttons, copy/paste/delete |
| `ui/toolbars/overlay-toolbar.js` | Add blend mode, gradient direction buttons, gradient stops, delete |
| `ui/color-picker.js` | Add tones expansion: color math + tones row UI |
| `styles/components.css` | Toolbar row styles, tone swatch styles, action button group |

---

### Task 1: Left panel 50/50 split

**Files:**
- Modify: `styles/shell.css`

- [ ] **Step 1: Find and update `.editor-image-tray` in `styles/shell.css`**

Current:
```css
.editor-image-tray {
  flex: 0 0 230px;
  overflow-y: auto;
  border-top: 1px solid var(--color-border);
  padding: 6px;
}
```

Replace with:
```css
.editor-image-tray {
  flex: 1;
  min-height: 80px;
  overflow-y: auto;
  border-top: 1px solid var(--color-border);
  padding: 6px;
}
```

The filmstrip already has `flex: 1; min-height: 80px`. Both panels now share space equally.

- [ ] **Step 2: Verify in browser**

Load the app. The left panel should show filmstrip and image tray in roughly equal halves. Both scroll independently.

- [ ] **Step 3: Commit**

```bash
git add styles/shell.css
git commit -m "fix: left panel filmstrip and image tray split to 50/50 flex"
```

---

### Task 2: LayerManager copy/paste clipboard

**Files:**
- Modify: `editor/layer-manager.js`

- [ ] **Step 1: Add module-level clipboard variable and three methods**

Add `let _clipboard = null;` before the class definition, and add three methods inside the class.

Full updated `editor/layer-manager.js`:

```js
// editor/layer-manager.js
import { events } from '../core/events.js';

/** Module-level clipboard for layer copy/paste. */
let _clipboard = null;

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
    if (!frame?.layers) return;
    const idx = frame.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;
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
    if (fromIdx < 0 || fromIdx >= frame.layers.length) return;
    if (toIdx < 0 || toIdx > frame.layers.length) return;
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

  // ── Copy / Paste ───────────────────────────────────────────────────────

  /**
   * Deep-clone a layer into the module-level clipboard.
   * Silent — no event emitted.
   */
  copyLayer(frameIndex, layerId) {
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const layer = frame.layers?.find(l => l.id === layerId);
    if (!layer) return;
    _clipboard = JSON.parse(JSON.stringify(layer));
  }

  /**
   * Paste the clipboard layer into a frame.
   * Assigns a new id and offsets position by +2% so paste is visible.
   * Emits: layer:changed
   */
  pasteLayer(frameIndex) {
    if (!_clipboard) return;
    const frame = this._state.project?.frames?.[frameIndex];
    if (!frame) return;
    const clone = JSON.parse(JSON.stringify(_clipboard));
    clone.id = `${_clipboard.id}-copy-${Date.now()}`;
    if (clone.position && clone.position.zone !== 'absolute') {
      clone.position.offset_x_pct = (clone.position.offset_x_pct ?? 0) + 2;
      clone.position.offset_y_pct = (clone.position.offset_y_pct ?? 0) + 2;
    } else if (clone.position?.zone === 'absolute') {
      clone.position.x_pct = (clone.position.x_pct ?? 0) + 2;
      clone.position.y_pct = (clone.position.y_pct ?? 0) + 2;
    }
    frame.layers = frame.layers ?? [];
    frame.layers.push(clone);
    this.selectLayer(clone.id);
    events.dispatchEvent(new CustomEvent('layer:changed', { detail: { frameIndex, layerId: clone.id } }));
  }

  /** Returns true when the clipboard has a layer ready to paste. */
  hasClipboard() {
    return !!_clipboard;
  }
}
```

- [ ] **Step 2: Verify in browser**

Open browser console:
```js
// After loading a project and selecting a layer, these should exist:
typeof layerManager.copyLayer   // 'function'
typeof layerManager.pasteLayer  // 'function'
typeof layerManager.hasClipboard // 'function'
layerManager.hasClipboard() // false initially
```

- [ ] **Step 3: Commit**

```bash
git add editor/layer-manager.js
git commit -m "feat: add copyLayer, pasteLayer, hasClipboard to LayerManager"
```

---

### Task 3: Renderer — shadow, fit mode, blend mode

**Files:**
- Modify: `editor/layers.js`

- [ ] **Step 1: Add shadow rendering to `_renderTextLayer`**

Find `_renderTextLayer` in `editor/layers.js`. It currently starts with:
```js
function _renderTextLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx   = (layer.font?.size_pct ?? 5) / 100 * h;
  const maxW     = (layer.max_width_pct ?? 80) / 100 * w;
  ctx.save();
  ctx.globalAlpha  = layer.opacity ?? 1;
  ctx.fillStyle    = layer.font?.color ?? '#ffffff';
  ctx.font         = buildFontString(layer.font ?? {}, sizePx);
```

After `ctx.save();` and before `ctx.globalAlpha = ...`, insert shadow setup:

```js
function _renderTextLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx   = (layer.font?.size_pct ?? 5) / 100 * h;
  const maxW     = (layer.max_width_pct ?? 80) / 100 * w;
  ctx.save();

  // Shadow — compose color+opacity into a single rgba value
  if (layer.shadow?.enabled) {
    const sc = _hexToRgba(layer.shadow.color ?? '#000000', layer.shadow.opacity ?? 0.6);
    ctx.shadowColor   = sc;
    ctx.shadowBlur    = layer.shadow.blur_px ?? 8;
    ctx.shadowOffsetX = layer.shadow.offset_x ?? 2;
    ctx.shadowOffsetY = layer.shadow.offset_y ?? 2;
  }

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
```

Add the `_hexToRgba` helper at the bottom of the file (before the closing of the module):

```js
function _hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

- [ ] **Step 2: Add fit mode to `_renderImageLayer`**

Replace the current `_renderImageLayer` function:

```js
function _renderImageLayer(ctx, layer, w, h, images) {
  const img = images?.get(layer.src);
  if (!img) return;
  const { x, y } = resolvePosition(layer.position, w, h);
  const iw = (layer.width_pct  ?? 100) / 100 * w;
  const ih = (layer.height_pct ?? 100) / 100 * h;
  const fit = layer.fit ?? 'fill';
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  if (fit === 'fill') {
    ctx.drawImage(img, x, y, iw, ih);
  } else if (fit === 'cover') {
    const scale = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (iw - dw) / 2;
    const dy = y + (ih - dh) / 2;
    ctx.beginPath();
    ctx.rect(x, y, iw, ih);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
  } else { // contain
    const scale = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (iw - dw) / 2;
    const dy = y + (ih - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  ctx.restore();
}
```

- [ ] **Step 3: Add blend mode to `_renderOverlayLayer`**

Replace the current `_renderOverlayLayer` function:

```js
const BLEND_MAP = {
  'normal':     'source-over',
  'multiply':   'multiply',
  'screen':     'screen',
  'overlay':    'overlay',
  'soft-light': 'soft-light',
};

function _renderOverlayLayer(ctx, layer, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = BLEND_MAP[layer.blend_mode] ?? 'source-over';
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
```

Note: `BLEND_MAP` should be declared at module scope (before the render functions), not inside the function.

- [ ] **Step 4: Verify in browser**

Load `canyon-series-2026.json` and all four images.
- Frame 1 (editorial-anchor): The `f04-text` layer in frame 4 has `shadow: { enabled: true, ... }` — select frame 4, the text "Where light becomes architecture." should have a drop shadow.
- Frame 3 (data-callout): The `f03-watermark` image layer has `fit: 'contain'` — it should render contained within its bounds.
- Frame 3 overlay has `blend_mode: 'multiply'` — the overlay should blend multiplicatively.

- [ ] **Step 5: Commit**

```bash
git add editor/layers.js
git commit -m "feat: add shadow rendering (text), fit mode (image), blend mode (overlay) to layers renderer"
```

---

### Task 4: Color picker — tones expansion

**Files:**
- Modify: `ui/color-picker.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Add color math helpers to `ui/color-picker.js`**

Add these pure functions at the bottom of `ui/color-picker.js` (after `_loadRecent`):

```js
// ── Color math for tones ────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function _rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function _hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function _rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function _shiftLightness(hex, deltaL) {
  const hsl = _rgbToHsl(_hexToRgb(hex));
  hsl.l = Math.max(5, Math.min(95, hsl.l + deltaL));
  return _rgbToHex(_hslToRgb(hsl));
}

function _getTones(hex) {
  return [-40, -20, 0, +20, +40].map(d => _shiftLightness(hex, d));
}
```

- [ ] **Step 2: Add tones row behavior to `_renderAll` in `ui/color-picker.js`**

Find the existing `_renderAll` function. After the `_wireFavorites(el, native, projectId, onChange);` line at the end, add:

```js
  // Wire tones expansion on palette swatches
  _wireTonesExpansion(el, native, projectId, onChange);
```

Then add the `_wireTonesExpansion` function after `_wireFavorites`:

```js
function _wireTonesExpansion(el, native, projectId, onChange) {
  let expandedSwatch = null;
  let tonesRow = null;

  el.querySelector('.cp-palette').addEventListener('click', e => {
    const swatch = e.target.closest('.cp-swatch[data-color]');
    if (!swatch) return;

    // Collapse if same swatch clicked again
    if (swatch === expandedSwatch) {
      tonesRow?.remove();
      expandedSwatch = null;
      tonesRow = null;
      return;
    }

    // Remove existing tones row
    tonesRow?.remove();

    // Build tones row
    const tones = _getTones(swatch.dataset.color);
    tonesRow = document.createElement('div');
    tonesRow.className = 'cp-tones-row';
    tonesRow.innerHTML = tones.map((t, i) =>
      `<button class="cp-swatch cp-tone${i === 2 ? ' cp-tone-base' : ''}" data-color="${t}" title="${t}" style="background:${t}"></button>`
    ).join('');
    tonesRow.querySelectorAll('.cp-swatch').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _apply(el, native, btn.dataset.color, projectId, onChange);
        tonesRow?.remove();
        expandedSwatch = null;
        tonesRow = null;
      });
    });

    // Insert after the palette row
    const paletteRow = el.querySelector('.cp-palette');
    paletteRow.insertAdjacentElement('afterend', tonesRow);
    expandedSwatch = swatch;
  });
}
```

- [ ] **Step 3: Add tones CSS to `styles/components.css`**

At the end of `styles/components.css`, add:

```css
/* ── Color picker — tones row ──────────────── */
.cp-tones-row {
  display: flex;
  gap: 3px;
  padding: 2px 0;
}

.cp-tone {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s;
}

.cp-tone:hover {
  transform: scale(1.15);
  border-color: var(--color-accent);
}

.cp-tone-base {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}
```

- [ ] **Step 4: Verify in browser**

Open the color picker on any layer (requires toolbars implemented in later tasks). Click a palette swatch — a row of 5 tone swatches should appear below the palette row. Clicking a tone applies that color and collapses the row. Clicking the same swatch again collapses without applying.

*(Color math can be verified in console: `_getTones('#B85530')` should return 5 hex strings varying from dark to light.)*

- [ ] **Step 5: Commit**

```bash
git add ui/color-picker.js styles/components.css
git commit -m "feat: color picker tones expansion with HSL color math"
```

---

### Task 5: Inspector — pass palette and projectId to toolbars

**Files:**
- Modify: `ui/inspector.js`

**Context:** All toolbars will now accept a fifth parameter `opts = { palette, projectId }` for the color picker. The inspector needs to assemble and pass this object.

- [ ] **Step 1: Update `_renderLayerSection` in `ui/inspector.js`**

Find the switch statement near the bottom of `_renderLayerSection`:
```js
    const controlsEl = section.querySelector('#insp-layer-controls');
    const fi = this._state.activeFrameIndex;
    switch (layer.type) {
      case 'text':    renderTextToolbar(controlsEl, layer, fi, this._lm);    break;
      case 'shape':   renderShapeToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'image':
      case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'overlay': renderOverlayToolbar(controlsEl, layer, fi, this._lm); break;
    }
```

Replace with:
```js
    const controlsEl = section.querySelector('#insp-layer-controls');
    const fi = this._state.activeFrameIndex;
    const opts = {
      palette:   this._state.project?.design_tokens?.palette ?? {},
      projectId: this._state.project?.project?.id ?? 'default',
    };
    switch (layer.type) {
      case 'text':    renderTextToolbar(controlsEl, layer, fi, this._lm, opts);    break;
      case 'shape':   renderShapeToolbar(controlsEl, layer, fi, this._lm, opts);   break;
      case 'image':
      case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm, opts);   break;
      case 'overlay': renderOverlayToolbar(controlsEl, layer, fi, this._lm, opts); break;
    }
```

- [ ] **Step 2: Commit**

```bash
git add ui/inspector.js
git commit -m "feat: pass palette and projectId opts to all toolbar render functions"
```

---

### Task 6: Text toolbar — full rewrite

**Files:**
- Modify: `ui/toolbars/text-toolbar.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Replace `ui/toolbars/text-toolbar.js` entirely**

```js
// ui/toolbars/text-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render text layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderTextToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const font = layer.font ?? {};
  const shadow = layer.shadow ?? {};
  const { palette = {}, projectId = 'default' } = opts;

  container.innerHTML = `
    <div class="tb-row">
      <textarea id="ctx-text-content" class="tb-textarea" rows="2" placeholder="Text content…">${_esc(layer.content ?? '')}</textarea>
    </div>
    <div class="tb-row">
      <label>Size %</label>
      <input type="number" id="ctx-font-size" value="${font.size_pct ?? 5}" min="1" max="30" step="0.5" style="width:52px">
      <label>Weight</label>
      <select id="ctx-font-weight">
        <option value="300"${font.weight === 300 ? ' selected' : ''}>Light</option>
        <option value="400"${(!font.weight || font.weight === 400) ? ' selected' : ''}>Regular</option>
        <option value="600"${font.weight === 600 ? ' selected' : ''}>SemiBold</option>
        <option value="700"${font.weight === 700 ? ' selected' : ''}>Bold</option>
      </select>
      <button id="ctx-italic" class="btn${font.style === 'italic' ? ' btn-active' : ''}" title="Italic" style="font-style:italic;min-width:28px">I</button>
      <div id="ctx-align-group" class="tb-btn-group">
        <button class="btn${(!font.align || font.align==='left')?' btn-active':''}" data-align="left" title="Align left">⬅</button>
        <button class="btn${font.align==='center'?' btn-active':''}" data-align="center" title="Align center">⬛</button>
        <button class="btn${font.align==='right'?' btn-active':''}" data-align="right" title="Align right">➡</button>
      </div>
    </div>
    <div class="tb-row">
      <label>Line H</label>
      <input type="number" id="ctx-line-height" value="${font.line_height ?? 1.25}" min="0.8" max="3.0" step="0.05" style="width:52px">
      <label>Spacing</label>
      <input type="number" id="ctx-letter-spacing" value="${font.letter_spacing_em ?? 0}" min="-0.1" max="0.5" step="0.01" style="width:52px">
      <label>Max W %</label>
      <input type="number" id="ctx-max-width" value="${layer.max_width_pct ?? 80}" min="10" max="100" step="5" style="width:52px">
    </div>
    <div class="tb-row">
      <label>Color</label>
      <div id="ctx-color-picker-slot"></div>
      <button id="ctx-shadow" class="btn${shadow.enabled ? ' btn-active' : ''}" title="Toggle text shadow">Shadow</button>
    </div>
    <div class="tb-row tb-actions">
      <button id="ctx-copy" class="btn" title="Copy layer">Copy</button>
      <button id="ctx-paste" class="btn" title="Paste layer" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
      <button id="ctx-delete" class="btn tb-danger" title="Delete layer">Delete</button>
    </div>
  `;

  // Color picker
  const pickerSlot = container.querySelector('#ctx-color-picker-slot');
  const picker = createColorPicker({
    value: font.color ?? '#ffffff',
    palette,
    projectId,
    onChange: color => layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, color } }),
  });
  pickerSlot.appendChild(picker);

  // Content textarea
  container.querySelector('#ctx-text-content').addEventListener('input', e => {
    layerManager.updateLayer(frameIndex, layer.id, { content: e.target.value });
  });

  // Font size
  container.querySelector('#ctx-font-size').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, size_pct: parseFloat(e.target.value) } });
  });

  // Weight
  container.querySelector('#ctx-font-weight').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, weight: parseInt(e.target.value, 10) } });
  });

  // Italic toggle
  container.querySelector('#ctx-italic').addEventListener('click', e => {
    const isItalic = layer.font?.style === 'italic';
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, style: isItalic ? 'normal' : 'italic' } });
    e.currentTarget.classList.toggle('btn-active', !isItalic);
  });

  // Align group
  container.querySelector('#ctx-align-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, align: btn.dataset.align } });
    container.querySelectorAll('#ctx-align-group .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  // Line height
  container.querySelector('#ctx-line-height').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, line_height: parseFloat(e.target.value) } });
  });

  // Letter spacing
  container.querySelector('#ctx-letter-spacing').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { font: { ...layer.font, letter_spacing_em: parseFloat(e.target.value) } });
  });

  // Max width
  container.querySelector('#ctx-max-width').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { max_width_pct: parseInt(e.target.value, 10) });
  });

  // Shadow toggle
  container.querySelector('#ctx-shadow').addEventListener('click', e => {
    const enabled = !layer.shadow?.enabled;
    const newShadow = enabled
      ? { enabled: true, color: '#000000', blur_px: 8, offset_x: 2, offset_y: 2, opacity: 0.6 }
      : { ...(layer.shadow ?? {}), enabled: false };
    layerManager.updateLayer(frameIndex, layer.id, { shadow: newShadow });
    e.currentTarget.classList.toggle('btn-active', enabled);
  });

  // Copy / Paste / Delete
  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => {
    layerManager.pasteLayer(frameIndex);
  });
  container.querySelector('#ctx-delete').addEventListener('click', () => {
    layerManager.deleteLayer(frameIndex, layer.id);
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Add toolbar CSS to `styles/components.css`**

Append to `styles/components.css`:

```css
/* ── Toolbar rows ───────────────────────────── */
.tb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  width: 100%;
}

.tb-textarea {
  width: 100%;
  resize: none;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 4px 6px;
}

.tb-btn-group {
  display: flex;
  gap: 2px;
}

.tb-actions {
  border-top: 1px solid var(--color-border);
  padding-top: 6px;
  margin-top: 2px;
}

.tb-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.tb-danger:hover {
  background: rgba(239,68,68,0.15);
}
```

- [ ] **Step 3: Verify in browser**

Select a text layer. The inspector should show: textarea with the text content, size/weight/italic/align row, line-height/spacing/max-width row, color picker + shadow toggle, copy/paste/delete row. Edit the textarea — canvas and filmstrip thumbnail update.

- [ ] **Step 4: Commit**

```bash
git add ui/toolbars/text-toolbar.js styles/components.css
git commit -m "feat: text toolbar full rewrite — content, italic, line-height, letter-spacing, shadow, copy/paste/delete"
```

---

### Task 7: Shape toolbar — color picker, dimensions, alignment, copy/paste/delete

**Files:**
- Modify: `ui/toolbars/shape-toolbar.js`

- [ ] **Step 1: Replace `ui/toolbars/shape-toolbar.js` entirely**

```js
// ui/toolbars/shape-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render shape layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderShapeToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const { palette = {}, projectId = 'default' } = opts;

  container.innerHTML = `
    <div class="tb-row">
      <label>Fill</label>
      <div id="ctx-fill-picker-slot"></div>
      <label>Opacity %</label>
      <input type="number" id="ctx-shape-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:52px">
    </div>
    <div class="tb-row">
      <label>Stroke</label>
      <div id="ctx-stroke-picker-slot"></div>
      <label>Stroke W</label>
      <input type="number" id="ctx-shape-stroke-w" value="${layer.stroke_width ?? 0}" min="0" max="20" step="1" style="width:52px">
    </div>
    <div class="tb-row">
      <label>W %</label>
      <input type="number" id="ctx-shape-w" value="${layer.width_pct ?? 20}" min="1" max="100" step="1" style="width:52px">
      <label>H %</label>
      <input type="number" id="ctx-shape-h" value="${layer.height_pct ?? 5}" min="1" max="100" step="1" style="width:52px">
      <button id="ctx-full-w" class="btn" title="Full width">↔</button>
      <button id="ctx-full-h" class="btn" title="Full height">↕</button>
    </div>
    <div class="tb-row">
      <div id="ctx-align-group" class="tb-btn-group">
        <button class="btn" data-align="left"   title="Align left">⬅L</button>
        <button class="btn" data-align="right"  title="Align right">R➡</button>
        <button class="btn" data-align="top"    title="Align top">⬆T</button>
        <button class="btn" data-align="bottom" title="Align bottom">B⬇</button>
        <button class="btn" data-align="center-h" title="Center horizontal">⬛H</button>
        <button class="btn" data-align="center-v" title="Center vertical">⬛V</button>
      </div>
    </div>
    <div class="tb-row tb-actions">
      <button id="ctx-copy" class="btn">Copy</button>
      <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
      <button id="ctx-delete" class="btn tb-danger">Delete</button>
    </div>
  `;

  // Fill color picker
  const fillSlot = container.querySelector('#ctx-fill-picker-slot');
  fillSlot.appendChild(createColorPicker({
    value: layer.fill ?? '#6366f1',
    palette,
    projectId,
    onChange: color => layerManager.updateLayer(frameIndex, layer.id, { fill: color }),
  }));

  // Stroke color picker
  const strokeSlot = container.querySelector('#ctx-stroke-picker-slot');
  strokeSlot.appendChild(createColorPicker({
    value: layer.stroke ?? '#ffffff',
    palette,
    projectId,
    onChange: color => layerManager.updateLayer(frameIndex, layer.id, { stroke: color }),
  }));

  container.querySelector('#ctx-shape-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });
  container.querySelector('#ctx-shape-stroke-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { stroke_width: parseFloat(e.target.value) });
  });
  container.querySelector('#ctx-shape-w').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { width_pct: parseFloat(e.target.value) });
  });
  container.querySelector('#ctx-shape-h').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { height_pct: parseFloat(e.target.value) });
  });

  // Full width / height snaps
  container.querySelector('#ctx-full-w').addEventListener('click', () => {
    const pos = layer.position?.zone === 'absolute'
      ? { ...layer.position, x_pct: 0 }
      : { ...layer.position, offset_x_pct: 0 };
    layerManager.updateLayer(frameIndex, layer.id, { width_pct: 100, position: pos });
  });
  container.querySelector('#ctx-full-h').addEventListener('click', () => {
    const pos = layer.position?.zone === 'absolute'
      ? { ...layer.position, y_pct: 0 }
      : { ...layer.position, offset_y_pct: 0 };
    layerManager.updateLayer(frameIndex, layer.id, { height_pct: 100, position: pos });
  });

  // Alignment — converts to absolute position
  container.querySelector('#ctx-align-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    const wPct = layer.width_pct  ?? 20;
    const hPct = layer.height_pct ??  5;
    let x_pct = layer.position?.x_pct ?? 0;
    let y_pct = layer.position?.y_pct ?? 0;
    switch (btn.dataset.align) {
      case 'left':     x_pct = 0; break;
      case 'right':    x_pct = 100 - wPct; break;
      case 'top':      y_pct = 0; break;
      case 'bottom':   y_pct = 100 - hPct; break;
      case 'center-h': x_pct = (100 - wPct) / 2; break;
      case 'center-v': y_pct = (100 - hPct) / 2; break;
    }
    layerManager.updateLayer(frameIndex, layer.id, {
      position: { zone: 'absolute', x_pct, y_pct },
    });
  });

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
```

- [ ] **Step 2: Verify in browser**

Select the `f01-divider` shape layer. Inspector shows fill color picker (accent red), opacity, stroke, W%/H%, alignment buttons, copy/paste/delete. Change fill — canvas updates. Click align-center-h — shape moves to horizontal center.

- [ ] **Step 3: Commit**

```bash
git add ui/toolbars/shape-toolbar.js
git commit -m "feat: shape toolbar — color picker, dimensions, alignment, copy/paste/delete"
```

---

### Task 8: Image toolbar — fit mode and copy/paste/delete

**Files:**
- Modify: `ui/toolbars/image-toolbar.js`

- [ ] **Step 1: Replace `ui/toolbars/image-toolbar.js` entirely**

```js
// ui/toolbars/image-toolbar.js

/**
 * Render image/logo layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderImageToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const fit = layer.fit ?? 'fill';

  container.innerHTML = `
    <div class="tb-row">
      <label>Fit</label>
      <div class="tb-btn-group" id="ctx-fit-group">
        <button class="btn${fit==='cover'?' btn-active':''}"   data-fit="cover"   title="Cover — fill, crop excess">Cover</button>
        <button class="btn${fit==='contain'?' btn-active':''}" data-fit="contain" title="Contain — fit within bounds">Contain</button>
        <button class="btn${fit==='fill'?' btn-active':''}"    data-fit="fill"    title="Fill — stretch to exact size">Fill</button>
      </div>
    </div>
    <div class="tb-row">
      <label>Opacity %</label>
      <input type="number" id="ctx-img-opacity" value="${Math.round((layer.opacity ?? 1) * 100)}" min="0" max="100" step="5" style="width:52px">
    </div>
    <div class="tb-row tb-actions">
      <button id="ctx-copy" class="btn">Copy</button>
      <button id="ctx-paste" class="btn" ${layerManager.hasClipboard() ? '' : 'disabled'}>Paste</button>
      <button id="ctx-delete" class="btn tb-danger">Delete</button>
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

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
    container.querySelector('#ctx-paste').disabled = false;
  });
  container.querySelector('#ctx-paste').addEventListener('click', () => layerManager.pasteLayer(frameIndex));
  container.querySelector('#ctx-delete').addEventListener('click', () => layerManager.deleteLayer(frameIndex, layer.id));
}
```

- [ ] **Step 2: Verify in browser**

Select the `f03-watermark` image layer (in frame 3). Inspector shows Cover/Contain/Fill fit buttons — Contain should be pre-selected. Toggle to Cover — the image scales to fill its bounds, clipping excess. Toggle to Fill — stretches.

- [ ] **Step 3: Commit**

```bash
git add ui/toolbars/image-toolbar.js
git commit -m "feat: image toolbar — fit mode (cover/contain/fill), copy/paste/delete"
```

---

### Task 9: Overlay toolbar — blend mode, gradient direction, gradient stops, delete

**Files:**
- Modify: `ui/toolbars/overlay-toolbar.js`

- [ ] **Step 1: Replace `ui/toolbars/overlay-toolbar.js` entirely**

```js
// ui/toolbars/overlay-toolbar.js
import { createColorPicker } from '../color-picker.js';

/**
 * Render overlay layer controls into `container`.
 * @param {HTMLElement} container
 * @param {object} layer
 * @param {number} frameIndex
 * @param {import('../../editor/layer-manager.js').LayerManager} layerManager
 * @param {{ palette: object, projectId: string }} opts
 */
export function renderOverlayToolbar(container, layer, frameIndex, layerManager, opts = {}) {
  const { palette = {}, projectId = 'default' } = opts;
  const isGradient = !!layer.gradient?.enabled;
  const grad = layer.gradient ?? {};
  const dir  = grad.direction ?? 'to-bottom';

  container.innerHTML = `
    <div class="tb-row">
      <label>Color</label>
      <div id="ctx-ov-color-slot"></div>
      <label>Opacity %</label>
      <input type="number" id="ctx-ov-opacity" value="${Math.round((layer.opacity ?? 0.6) * 100)}" min="0" max="100" step="5" style="width:52px">
    </div>
    <div class="tb-row">
      <label>Blend</label>
      <select id="ctx-ov-blend">
        <option value="normal"${(layer.blend_mode??'normal')==='normal'?' selected':''}>Normal</option>
        <option value="multiply"${layer.blend_mode==='multiply'?' selected':''}>Multiply</option>
        <option value="screen"${layer.blend_mode==='screen'?' selected':''}>Screen</option>
        <option value="overlay"${layer.blend_mode==='overlay'?' selected':''}>Overlay</option>
        <option value="soft-light"${layer.blend_mode==='soft-light'?' selected':''}>Soft Light</option>
      </select>
    </div>
    <div class="tb-row">
      <label>Gradient</label>
      <input type="checkbox" id="ctx-ov-gradient" ${isGradient ? 'checked' : ''}>
      ${isGradient ? `
      <div class="tb-btn-group" id="ctx-grad-dir">
        <button class="btn${dir==='to-bottom'?' btn-active':''}" data-dir="to-bottom" title="Top to bottom">↓</button>
        <button class="btn${dir==='to-top'?' btn-active':''}"    data-dir="to-top"    title="Bottom to top">↑</button>
        <button class="btn${dir==='to-right'?' btn-active':''}"  data-dir="to-right"  title="Left to right">→</button>
        <button class="btn${dir==='to-left'?' btn-active':''}"   data-dir="to-left"   title="Right to left">←</button>
      </div>` : ''}
    </div>
    ${isGradient ? `
    <div class="tb-row">
      <label>Start opacity</label>
      <input type="range" id="ctx-grad-from-op" min="0" max="100" value="${grad.from_opacity ?? 0}" style="width:80px">
      <label>End opacity</label>
      <input type="range" id="ctx-grad-to-op"   min="0" max="100" value="${grad.to_opacity ?? 100}" style="width:80px">
    </div>
    <div class="tb-row">
      <label>Start pos %</label>
      <input type="number" id="ctx-grad-from-pos" value="${grad.from_pos ?? 0}"   min="0" max="100" step="5" style="width:52px">
      <label>End pos %</label>
      <input type="number" id="ctx-grad-to-pos"   value="${grad.to_pos ?? 100}" min="0" max="100" step="5" style="width:52px">
    </div>` : ''}
    <div class="tb-row tb-actions">
      <button id="ctx-copy" class="btn">Copy</button>
      <button id="ctx-delete" class="btn tb-danger">Delete</button>
    </div>
  `;

  // Color picker (disabled when gradient is on)
  const colorSlot = container.querySelector('#ctx-ov-color-slot');
  const colorPicker = createColorPicker({
    value: layer.color ?? '#000000',
    palette,
    projectId,
    onChange: color => layerManager.updateLayer(frameIndex, layer.id, { color }),
  });
  if (isGradient) colorPicker.style.opacity = '0.4';
  colorSlot.appendChild(colorPicker);

  container.querySelector('#ctx-ov-opacity').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { opacity: parseInt(e.target.value, 10) / 100 });
  });

  container.querySelector('#ctx-ov-blend').addEventListener('change', e => {
    layerManager.updateLayer(frameIndex, layer.id, { blend_mode: e.target.value });
  });

  container.querySelector('#ctx-ov-gradient').addEventListener('change', e => {
    const enabled = e.target.checked;
    const newGrad = enabled
      ? { enabled: true, direction: 'to-bottom', from_opacity: 0, from_pos: 0, to_opacity: 100, to_pos: 100,
          stops: [{ at: 0, color: _hexToRgba(layer.color ?? '#000000', 0) }, { at: 1, color: _hexToRgba(layer.color ?? '#000000', 1) }] }
      : { ...(layer.gradient ?? {}), enabled: false };
    layerManager.updateLayer(frameIndex, layer.id, { gradient: newGrad });
    // Re-render toolbar to show/hide gradient controls
    renderOverlayToolbar(container, { ...layer, gradient: newGrad }, frameIndex, layerManager, opts);
  });

  // Gradient direction
  container.querySelector('#ctx-grad-dir')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    const newGrad = { ...layer.gradient, direction: btn.dataset.dir };
    layerManager.updateLayer(frameIndex, layer.id, { gradient: newGrad });
    container.querySelectorAll('#ctx-grad-dir .btn').forEach(b => b.classList.toggle('btn-active', b === btn));
  });

  // Gradient stop opacities
  const _updateStops = () => {
    const fromOp  = parseInt(container.querySelector('#ctx-grad-from-op')?.value ?? '0', 10) / 100;
    const toOp    = parseInt(container.querySelector('#ctx-grad-to-op')?.value   ?? '100', 10) / 100;
    const fromPos = parseInt(container.querySelector('#ctx-grad-from-pos')?.value ?? '0', 10) / 100;
    const toPos   = parseInt(container.querySelector('#ctx-grad-to-pos')?.value   ?? '100', 10) / 100;
    const color   = layer.color ?? '#000000';
    layerManager.updateLayer(frameIndex, layer.id, {
      gradient: {
        ...layer.gradient,
        from_opacity: fromOp * 100, from_pos: fromPos * 100,
        to_opacity:   toOp   * 100, to_pos:   toPos   * 100,
        stops: [
          { at: fromPos, color: _hexToRgba(color, fromOp) },
          { at: toPos,   color: _hexToRgba(color, toOp)   },
        ],
      },
    });
  };

  container.querySelector('#ctx-grad-from-op')?.addEventListener('input', _updateStops);
  container.querySelector('#ctx-grad-to-op')?.addEventListener('input', _updateStops);
  container.querySelector('#ctx-grad-from-pos')?.addEventListener('change', _updateStops);
  container.querySelector('#ctx-grad-to-pos')?.addEventListener('change', _updateStops);

  container.querySelector('#ctx-copy').addEventListener('click', () => {
    layerManager.copyLayer(frameIndex, layer.id);
  });
  container.querySelector('#ctx-delete').addEventListener('click', () => {
    layerManager.deleteLayer(frameIndex, layer.id);
  });
}

function _hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

- [ ] **Step 2: Verify in browser**

Select the `f01-overlay` layer (frame 1). Inspector shows: color picker, opacity, blend mode (Normal selected), Gradient checkbox (checked for f01). Check gradient — direction buttons appear. Move start opacity slider — gradient updates on canvas. Change blend mode on `f03-overlay` to Multiply — canvas updates.

- [ ] **Step 3: Commit**

```bash
git add ui/toolbars/overlay-toolbar.js
git commit -m "feat: overlay toolbar — blend mode, gradient direction, gradient stops, copy/delete"
```

---

### Task 10: Self-review and final verification

- [ ] **Step 1: Load the full Canyon Series sample**

Open the app. Open the canyon-series-2026 brief. Load the JSON. Load all four images.

- [ ] **Step 2: Verify each feature**

| Feature | How to verify |
|---------|--------------|
| Left panel 50/50 | Filmstrip and image tray share equal space |
| Text content editing | Select f01-headline, edit text in textarea — canvas updates, thumbnail updates |
| Italic toggle | Click I — font italic on canvas |
| Line height | Change to 1.8 — text lines spread out |
| Letter spacing | Change to 0.1 — characters spaced out |
| Shadow | Click Shadow button on f04-text — shadow appears |
| Color picker tones | Click palette swatch — tones row appears |
| Copy/paste layer | Copy a layer, go to frame 2, paste — new layer appears |
| Delete | Delete button removes layer |
| Shape alignment | Select f01-divider, click align-center-h — bar moves to center |
| Fit mode | Select f03-watermark (contain) — image fits without distortion |
| Blend mode | Select f03-overlay — Multiply mode, canvas tinted differently vs Normal |
| Gradient stops | Select f01-overlay (gradient on) — adjust start opacity slider, gradient fades |
| Thumbnail sync | Edit any layer — filmstrip thumbnail for that frame updates |

- [ ] **Step 3: Final commit if anything was missed**

```bash
git add -A
git commit -m "fix: final cleanup and verified UI completeness features"
```
