# Color Wheel Analysis Tool — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Goal

A floating, draggable Color Wheel panel that reads the rendered canvas, extracts dominant colors, and evaluates how well those colors fit each classical color harmony scheme. Every harmony mode is scored automatically using a best-fit rotation algorithm, and colors that disrupt the active harmony are identified by name, canvas percentage, and angular deviation. An optional canvas overlay highlights the affecting pixels in red.

---

## Architecture

### New: `editor/color-wheel-analysis.js`

Pure pixel math — no DOM, no state dependencies. Three exported functions:

**`extractDominantColors(imageData, k = 8)`**

- Samples every 4th pixel of the `ImageData` for performance (~91k pixels on a 1080×1350 canvas).
- Converts each sampled pixel from sRGB to HSL.
- Clusters into `k` groups using K-means in HSL space (initialised with K-means++ seeding for stable convergence).
- Returns `DominantColor[]` sorted by canvas % descending:

```js
{
  hex: string,           // e.g. '#e85c3a'
  hsl: { h, s, l },     // h: 0–360, s: 0–100, l: 0–100
  canvasPct: number,     // % of total canvas pixels in this cluster
  isNeutral: boolean,    // true when s < 10 — no meaningful hue
}
```

- Neutral colors (`s < 10`) are included in the result but flagged. They appear in the panel's "NEUTRAL" section and are excluded from all harmony calculations.

---

**`computeAllHarmonyScores(dominantColors)`**

- Operates only on chromatic (non-neutral) dominant colors.
- For each of the 6 harmony types, iterates all root hues 0–359° in 1° steps.
- At each rotation: counts what % of chromatic canvas pixels fall inside any harmony sector (using precomputed per-hue lookup tables for speed).
- Records the rotation that maximises coverage — the best-fit score.
- Returns `HarmonyResult[]` sorted by score descending:

```js
{
  type: 'complementary' | 'split-comp' | 'analogous' | 'triad' | 'double' | 'square',
  score: number,           // 0–100, % of chromatic pixels in harmony
  rotation: number,        // best-fit root hue (0–359°)
  sectors: Sector[],       // { centerHue, halfWidth } for rendering
  inHarmony: DominantColor[],   // clusters whose hue centroid is inside a sector
  affecting: AffectingColor[],  // clusters outside all sectors
}
```

```js
// AffectingColor extends DominantColor:
{
  ...DominantColor,
  degreesOff: number,   // degrees to the nearest sector boundary
}
```

---

**`computeAffectingOverlay(imageData, sectors, tolerance = 30)`**

- Iterates every pixel of the `ImageData`.
- Converts each pixel to HSL.
- Skips neutral pixels (`s < 10`).
- For each chromatic pixel: if its hue falls outside all `sectors` (each sector defined by `centerHue ± halfWidth`), marks it with a red tint: `rgba(239, 68, 68, 0.5)`.
- Returns a `Uint8ClampedArray` of the same dimensions, ready for `putImageData`.

---

### Harmony Type Definitions

All sectors use ±30° half-width tolerance unless noted.

| Type | Sectors | Spacing | Notes |
|------|---------|---------|-------|
| Complementary | 2 | 180° apart | Classic opposite pair |
| Split-comp | 3 | Base + 150° each side | Softer than complementary |
| Analogous | 1 | Single 90°-wide zone | Adjacent hues; most harmonious |
| Triad | 3 | 120° apart | Balanced tension |
| Double (tetradic) | 4 | Two complementary pairs, 60° offset | Rich, complex |
| Square | 4 | 90° apart | Even tension across the wheel |

---

### New: `ui/color-wheel-panel.js`

Floating draggable panel. Same drag-by-header pattern as `LayersPanel`.

**Constructor:** `new ColorWheelPanel(container, state)`

- `container` — `.color-wheel-panel` div appended to body by shell (same pattern as layers panel).
- `state` — `AppState` instance.

**Methods:** `show()`, `hide()`, `toggle()` — mirror LayersPanel.

**Event subscriptions:** `frame:changed`, `layer:changed`, `layers:reordered`, `layer:deleted`, `project:loaded` — each triggers `_scheduleAnalysis()`.

**`_scheduleAnalysis()`** — debounces 400ms then calls `_runAnalysis()`.

**`_runAnalysis()`:**
1. Gets `ImageData` from the active frame's canvas via `document.getElementById('editor-canvas').getContext('2d').getImageData(...)`.
2. Calls `extractDominantColors(imageData)`.
3. Calls `computeAllHarmonyScores(dominantColors)`.
4. Stores results internally, calls `_render()`.
5. If "show on canvas" toggle is on: calls `computeAffectingOverlay(...)`, sets `state.colorWheelOverlay`, dispatches `color-wheel:overlay-changed`.

**`_render()`** — rebuilds panel innerHTML:

**Panel structure:**

```
┌─────────────────────────────────┐
│ ⊞ Color Wheel          ⟳  ×    │  ← header (drag handle)
├─────────────────────────────────┤
│ HARMONY MODE                    │
│ ● Triad          81% ████████   │  ← active (blue bg)
│   Double         74% ███████    │
│   Split-comp     71% ███████    │
│   Comp           67% ██████     │
│   Square         52% █████      │
│   Analogous      43% ████       │
├─────────────────────────────────┤
│          [SVG wheel]            │  ← 180×180px
│         Triad • 81%             │
├─────────────────────────────────┤
│ IN HARMONY                      │  ← green label
│ ■ ████████████ 43%  #e85c3a    │
│ ■ ████████     27%  #2d3a4a    │
│ ■ █████        18%  #4a9fd4    │
├─────────────────────────────────┤
│ AFFECTING — 19%                 │  ← red label
│ ■ ████         12%  #c4a35a +14°│
│ ■ ██            7%  #8b6914 +22°│
├─────────────────────────────────┤
│ NEUTRAL — 11%                   │  ← grey label
│ ■ ███           8%  #1a1a1a    │
│ ■ █             3%  #f5f5f0    │
├─────────────────────────────────┤
│ [ ] Show affecting on canvas    │  ← toggle
└─────────────────────────────────┘
```

**Score color-coding** on harmony rows: green ≥ 75%, yellow 50–74%, red < 50%.

**SVG wheel details:**
- Outer hue ring: 12 arc segments covering the full 360° hue spectrum.
- Best-fit harmony sectors: blue semi-transparent wedges (`rgba(96,165,250,0.15)` fill, `rgba(96,165,250,0.5)` stroke).
- Dominant color dots:
  - Positioned by hue (angle) and saturation (radial distance from center).
  - Size scaled by `canvasPct` — largest cluster = 10px radius, smallest visible = 4px.
  - In-harmony dots: white stroke.
  - Affecting dots: red dashed stroke (`stroke-dasharray="3,2"` rgba(239,68,68)).
  - Neutral dots: plotted at the center regardless of hue, grey stroke.
- Center label: active harmony name + score %.

**"Show affecting on canvas" toggle:**
- Off by default.
- When turned on: triggers `_runAnalysis()` if overlay not yet computed, sets `state.colorWheelOverlay`.
- When turned off: sets `state.colorWheelOverlay = null`, dispatches `color-wheel:overlay-changed`.
- Also cleared automatically when the panel is closed (`hide()`).

**`⟳` refresh button:** Clears cached analysis and calls `_runAnalysis()` immediately (no debounce). Useful after a canvas change that didn't fire an event (e.g., after an export-resolution render).

---

### Modify: `core/state.js`

Add one property to `AppState`:

```js
this.colorWheelOverlay = null;  // Uint8ClampedArray | null
```

No setter needed — the panel sets it directly.

---

### Modify: `editor/renderer.js`

After the existing `if (opts.analysisMode)` block, add:

```js
if (opts.colorWheelOverlay) {
  ctx.putImageData(new ImageData(opts.colorWheelOverlay, w, h), 0, 0);
}
```

The color wheel overlay stacks on top of any active analysis overlay (contrast/weight). This is intentional — the user can run both at once.

---

### Modify: `editor/shell.js`

**View strip button** — add to the analysis group alongside Contrast / Weight / Probe:

```html
<button id="btn-color-wheel" class="btn view-strip-btn" aria-pressed="false"
  title="Color wheel harmony analysis">Color Wheel</button>
```

**Wire toggle** — same pattern as the layers panel button:

```js
const colorWheelBtn = root.querySelector('#btn-color-wheel');
colorWheelBtn.addEventListener('click', () => {
  const isOpen = colorWheelPanel.toggle();
  colorWheelBtn.setAttribute('aria-pressed', isOpen);
});
```

**Pass `colorWheelOverlay` to renderer** — inside `_repaint()`:

```js
renderer.renderFrame(canvasEl, frame, state.project, state.images, {
  ...existingOpts,
  colorWheelOverlay: state.colorWheelOverlay,
});
```

**Listen for overlay changes** to trigger repaint:

```js
events.addEventListener('color-wheel:overlay-changed', _repaint);
```

**Mount panel** — append `.color-wheel-panel` div to body, instantiate `ColorWheelPanel`:

```js
const colorWheelPanelEl = document.createElement('div');
colorWheelPanelEl.className = 'color-wheel-panel';
document.body.appendChild(colorWheelPanelEl);
const colorWheelPanel = new ColorWheelPanel(colorWheelPanelEl, state);
```

---

## Color Extraction — K-means Details

- **K = 8** clusters, fixed. Enough to capture the major colors without noise.
- **Initialisation:** K-means++ — first centroid chosen randomly, subsequent centroids chosen with probability proportional to squared distance from existing centroids. Produces stable, well-spread initial positions.
- **Convergence:** Max 20 iterations or until no centroid moves > 1° in hue (stable).
- **Distance metric:** Weighted HSL distance — hue difference weighted by saturation to reduce hue noise on near-neutral colors: `d = Δh × (s/100) + ΔL × 0.3`.
- **Sampling stride:** Every 4th pixel (stride = 4 pixels = 16 bytes in RGBA buffer). Balances accuracy vs. performance.

---

## Performance

- `extractDominantColors`: ~91k pixels × 20 K-means iterations — target < 50ms on modern hardware.
- `computeAllHarmonyScores`: 360 rotations × 6 harmony types × lookup table check — target < 20ms using precomputed per-degree hue histograms (256-bin hue histogram built once from the dominant color data).
- `computeAffectingOverlay`: full pixel scan once — target < 30ms.
- Total on re-analysis: < 100ms. Debounced 400ms so only fires after edits settle.

---

## Files Affected

**New:**
- `editor/color-wheel-analysis.js`
- `ui/color-wheel-panel.js`
- `tests/editor/color-wheel-analysis.test.js`

**Modified:**
- `core/state.js` — add `colorWheelOverlay: null`
- `editor/renderer.js` — apply `opts.colorWheelOverlay`
- `editor/shell.js` — button, panel mount, repaint wiring
- `tests/runner.html` — add new test import
