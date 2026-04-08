# Visual Analysis + Export Design (Plan 2c)

## Goal

Add visual analysis overlays and PNG export to the post-composer editor. The analyst sees contrast legibility and visual weight directly on the canvas, gets instant pixel readings via click-to-probe, and can export individual or all frames as clean PNGs.

## Architecture

The fully rendered canvas is the only ground truth. Analysis always reads from what the user sees — photo + shapes + overlays + text composed together. No separate image pipeline.

**Core principle:** analysis runs at the end of `_repaint()` when active. Any layer change, reorder, visibility toggle, or image load already triggers `_repaint()` — nothing special needed to keep overlays current.

**Flow:**
```
_repaint() renders frame normally
  → if analysisMode === 'contrast': draw contrast overlay on top
  → if analysisMode === 'weight':  draw weight overlay + center of mass on top
  → if a text layer is selected:   sample canvas at layer bounds
                                   → dispatch analysis:contrast event
                                   → inspector updates WCAG badge
```

`state.analysisMode` is the only new state: `null | 'contrast' | 'weight'`. Toggling a mode off sets it back to `null`.

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `editor/analysis.js` | **Create** | Pure analysis functions: contrast map, weight map, center of mass, bounds sampling |
| `editor/export.js` | **Create** | PNG export: single frame and batch |
| `editor/renderer.js` | Modify | Analysis overlay pass after layer loop; accept `analysisMode` in opts |
| `editor/shell.js` | Modify | Analysis toggle buttons, click-to-probe handler, export buttons, post-repaint WCAG dispatch |
| `ui/inspector.js` | Modify | Live WCAG badge for selected text layers |
| `core/state.js` | Modify | Add `analysisMode: null` property |
| `styles/components.css` | Modify | Probe popover, WCAG badge, export button styles |
| `tests/editor/analysis.test.js` | **Create** | Unit tests for pure analysis functions |

## Analysis Functions (`editor/analysis.js`)

### Contrast Map

For each pixel in the rendered canvas, compute WCAG contrast ratio against white.

**Linearisation:**
```js
function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
```

**Relative luminance:**
```js
L = 0.2126 * linearize(R/255) + 0.7152 * linearize(G/255) + 0.0722 * linearize(B/255)
```

**Contrast ratio against white:**
```js
ratio = 1.05 / (L + 0.05)
```

**Color coding** (drawn as RGBA overlay, alpha 0.45):
- ratio ≥ 7 → dark green `#14532d` (AAA)
- ratio ≥ 4.5 → green `#22c55e` (AA)
- ratio ≥ 3 → yellow `#eab308` (AA Large / decorative)
- ratio < 3 → red `#ef4444` (fail)

Returns a `Uint8ClampedArray` of RGBA values (same dimensions as the canvas), ready to be written via `ctx.putImageData`.

### Weight Map

Visual mass per pixel — darker and more saturated pixels are heavier.

**Per pixel:**
```js
// R, G, B are 0–1 linearized
const L = 0.2126*R + 0.7152*G + 0.0722*B;
const max = Math.max(R, G, B);
const min = Math.min(R, G, B);
const saturation = max === 0 ? 0 : (max - min) / max;
const weight = (1 - L) * 0.7 + saturation * 0.3;  // 0–1
```

**Heatmap mapping** (alpha 0.5):
- weight 0.0–0.25 → blue `#3b82f6`
- weight 0.25–0.5 → green `#22c55e`
- weight 0.5–0.75 → yellow `#eab308`
- weight 0.75–1.0 → red `#ef4444`

Returns a `Float32Array` of per-pixel weight values (0–1) AND a `Uint8ClampedArray` RGBA overlay.

### Center of Mass

Computed from the weight `Float32Array`:

```js
let totalWeight = 0, cx = 0, cy = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const w = weightMap[y * W + x];
    totalWeight += w;
    cx += x * w;
    cy += y * w;
  }
}
cx /= totalWeight;
cy /= totalWeight;
```

Returns `{ x, y }` in canvas pixel coordinates. Drawn by the renderer as a 12px crosshair (+) with a 4px filled dot at the intersection, in white with a 1px dark shadow for visibility.

### Bounds Luminance Sampling

```js
export function sampleBoundsLuminance(canvas, bounds) // returns { ratio, level }
```

Reads a rectangle of pixels from the rendered canvas via `ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)`. Averages their relative luminance. Returns `{ ratio, level }` where level is `'AAA' | 'AA' | 'AA Large' | 'Fail'`.

Called from shell after repaint when `state.selectedLayerId` refers to a text layer.

## Renderer Changes

`renderFrame` opts gains two new fields:
```js
{
  analysisMode: null | 'contrast' | 'weight',  // new
  // existing:
  guideType, showSafeZone, selectedLayerId, showLayerBounds
}
```

After the existing overlay sequence, if `analysisMode` is set:
1. Call `ctx.getImageData(0, 0, W, H)` to read the fully rendered frame
2. Pass to the appropriate analysis function
3. Write the returned RGBA overlay via `ctx.putImageData`
4. If `analysisMode === 'weight'`, also draw the center of mass crosshair

The analysis functions and crosshair draw are all in `analysis.js` — renderer imports and calls them.

## Shell Changes

### New toolbar buttons

Added to the existing toolbar group with Safe Zone and Bounds:
```html
<button id="btn-contrast"    class="btn" aria-pressed="false" title="Contrast map">Contrast</button>
<button id="btn-weight"      class="btn" aria-pressed="false" title="Weight map">Weight</button>
```

Toggle logic: clicking an active mode deactivates it (sets `analysisMode` to null). The two modes are mutually exclusive — activating one deactivates the other.

Added to a new export group:
```html
<button id="btn-export-frame" class="btn" title="Export current frame as PNG">Export Frame</button>
<button id="btn-export-all"   class="btn" title="Export all frames as PNG">Export All</button>
```

### Click-to-probe

Shell adds a `click` listener on `canvasEl`. On each click:
1. Convert CSS coords to canvas coords (same scaling as DragResize)
2. `ctx.getImageData(cx, cy, 1, 1)` → reads single pixel
3. Linearise R, G, B → compute luminance → compute ratio against white
4. Determine WCAG level
5. Create or update a `.probe-popover` div positioned near the click (clamped to canvas bounds)
6. Subsequent canvas click dismisses the popover and shows a new one at the new point

Popover content:
```
RGB: 214, 87, 42
Luminance: 23%
Contrast vs white: 4.8:1
Level: AA ✓
```

### Post-repaint WCAG dispatch

At the end of `_repaint()`, after rendering:
```js
const layerId = state.selectedLayerId;
const layer = state.activeFrame?.layers?.find(l => l.id === layerId);
if (layer?.type === 'text') {
  const bounds = computeLayerBounds(layer, canvasEl.width, canvasEl.height);
  const result = sampleBoundsLuminance(canvasEl, bounds);
  events.dispatchEvent(new CustomEvent('analysis:contrast', { detail: result }));
}
```

## Inspector Changes

When a text layer is selected, `_layerPropsHTML()` adds a WCAG badge row:

```html
<div class="inspector-row">
  <span class="label">WCAG</span>
  <span class="wcag-badge wcag-aa" id="insp-wcag-badge">AA</span>
</div>
```

Inspector listens to `analysis:contrast` and updates `#insp-wcag-badge` innerHTML and class (`wcag-aaa`, `wcag-aa`, `wcag-aa-large`, `wcag-fail`). Also listens to `layer:selected` — when a non-text layer is selected, the badge is hidden.

## Export (`editor/export.js`)

### Single frame

```js
export function exportFrame(canvas, frameId) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frame-${frameId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
```

The canvas is already rendered at full export resolution — no re-render needed.

### Batch export

```js
export async function exportAllFrames(frames, state, renderer, onProgress)
```

For each frame:
1. Create a temporary `<canvas>` at `state.project.export.width_px × height_px`
2. Call `renderer.renderFrame(tempCanvas, frame, state.project, state.images, {})` — no overlays
3. If the frame's image is not in `state.images`, skip and count as skipped
4. `canvas.toBlob()` → download as `frame-{frame.id}.png`
5. Wait 100ms between downloads to avoid browser popup blocking
6. Call `onProgress(i, total)` after each frame

Shell shows a brief `alert()` at the end if any frames were skipped due to missing images.

## CSS

**Probe popover** (`.probe-popover`): absolute positioned over the canvas area, dark background, monospace font, small padding, pointer-events none (so clicks pass through to the canvas), z-index above canvas.

**WCAG badge** (`.wcag-badge`): inline pill, color-coded:
- `.wcag-aaa` → dark green background
- `.wcag-aa` → green background
- `.wcag-aa-large` → yellow background, dark text
- `.wcag-fail` → red background

## Testing

`tests/editor/analysis.test.js` covers:
- `linearize()` — 0 → 0, 1 → 1, 0.5 → correct non-linear value
- `computeContrast()` — pure white pixel → ratio = 1:1 (same color, no contrast), pure black pixel → ratio = 21:1
- `computeContrast()` — mid-grey pixel → correct ratio and level
- `computeWeightMap()` — pure black pixel → weight near 1, pure white pixel → weight near 0
- `computeCenterOfMass()` — uniform weight → center at (W/2, H/2), all weight in one corner → center near that corner
- `sampleBoundsLuminance()` — requires a canvas; tested via integration test

`tests/editor/integration-2c.html` — smoke tests for export functions and analysis event dispatch (no pixel assertions, just that functions run without throwing).

## Explicitly Out of Scope

- Heatmap resolution settings
- Analysis on frames without a loaded image (skip gracefully)
- ZIP download for batch export (multiple individual downloads instead)
- Any analysis overlay included in PNG exports (exports always render clean)
