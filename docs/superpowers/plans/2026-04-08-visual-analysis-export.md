# Visual Analysis + Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contrast/weight analysis overlays, click-to-probe, WCAG badge, and PNG export to the post-composer editor.

**Architecture:** Analysis runs on already-rendered canvas pixels via `ctx.getImageData()` at the end of `_repaint()` when active. Pure analysis functions live in `editor/analysis.js`, PNG export in `editor/export.js`. The inspector's WCAG badge (already wired in Plan 2c-pre) receives `analysis:contrast` events from shell. Shell adds buttons to the view strip.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, no build step. Tests via `tests/runner.html` + `tests/test-helper.js` (describe/it/assert/assertEqual).

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `editor/analysis.js` | **Create** | Pure analysis functions: linearize, relativeLuminance, contrastVsWhite, wcagLevel, computeContrastMap, computeWeightMap, computeCenterOfMass, drawCenterOfMass, sampleBoundsLuminance |
| `editor/export.js` | **Create** | exportFrame, exportAllFrames |
| `editor/renderer.js` | Modify | Add `analysisMode` opt; import analysis functions; add overlay pass after guides |
| `editor/shell.js` | Modify | Import analysis + export; add Contrast/Weight/Export buttons to view strip; wire toggles; canvas click-to-probe; post-repaint WCAG dispatch; pass `analysisMode` to renderer |
| `styles/components.css` | Modify | `.probe-popover`, `.wcag-badge`, `.wcag-aaa`, `.wcag-aa`, `.wcag-aa-large`, `.wcag-fail` |
| `tests/editor/analysis.test.js` | **Create** | Unit tests for all pure analysis functions |
| `tests/runner.html` | Modify | Add import for `./editor/analysis.test.js` |
| `tests/editor/integration-2c.html` | **Create** | Smoke tests for export functions and analysis event dispatch |

---

## Task 1: Failing tests for analysis.js

**Files:**
- Create: `tests/editor/analysis.test.js`

- [ ] **Step 1: Create the failing test file**

Create `tests/editor/analysis.test.js` with this content. It imports from `../../editor/analysis.js` which does not yet exist, so every test will fail with an import error — that is the expected failure.

```js
import { describe, it, assertEqual, assert } from '../test-helper.js';
import {
  linearize, relativeLuminance, contrastVsWhite, wcagLevel,
  computeContrastMap, computeWeightMap, computeCenterOfMass,
} from '../../editor/analysis.js';

describe('linearize', () => {
  it('linearize(0) → 0', () => {
    assertEqual(linearize(0), 0);
  });
  it('linearize(1) → 1', () => {
    assertEqual(linearize(1), 1);
  });
  it('linearize(0.5) → correct non-linear value', () => {
    const expected = Math.pow((0.5 + 0.055) / 1.055, 2.4);
    assert(Math.abs(linearize(0.5) - expected) < 1e-10, 'linearize(0.5) mismatch');
  });
  it('linearize(0.04045) uses linear branch', () => {
    assert(Math.abs(linearize(0.04045) - 0.04045 / 12.92) < 1e-10, 'linear branch mismatch');
  });
});

describe('relativeLuminance', () => {
  it('white (255,255,255) → 1', () => {
    assert(Math.abs(relativeLuminance(255, 255, 255) - 1) < 1e-10, 'white luminance mismatch');
  });
  it('black (0,0,0) → 0', () => {
    assertEqual(relativeLuminance(0, 0, 0), 0);
  });
});

describe('contrastVsWhite', () => {
  it('L=1 (white vs white) → 1:1', () => {
    assert(Math.abs(contrastVsWhite(1) - 1) < 1e-6, 'white vs white should be 1:1');
  });
  it('L=0 (black vs white) → 21:1', () => {
    assert(Math.abs(contrastVsWhite(0) - 21) < 1e-6, 'black vs white should be 21:1');
  });
});

describe('wcagLevel', () => {
  it('ratio ≥ 7 → AAA', () => {
    assertEqual(wcagLevel(7), 'AAA');
    assertEqual(wcagLevel(21), 'AAA');
  });
  it('ratio 4.5–6.99 → AA', () => {
    assertEqual(wcagLevel(4.5), 'AA');
    assertEqual(wcagLevel(6.9), 'AA');
  });
  it('ratio 3–4.49 → AA Large', () => {
    assertEqual(wcagLevel(3), 'AA Large');
    assertEqual(wcagLevel(4.4), 'AA Large');
  });
  it('ratio < 3 → Fail', () => {
    assertEqual(wcagLevel(1), 'Fail');
    assertEqual(wcagLevel(2.9), 'Fail');
  });
});

describe('computeContrastMap', () => {
  it('pure white input → Fail (red #ef4444 overlay)', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const imageData = new ImageData(data, 1, 1);
    const out = computeContrastMap(imageData);
    assertEqual(out[0], 239, 'R should be 239 (#ef)');
    assertEqual(out[1], 68,  'G should be 68 (#44)');
    assertEqual(out[2], 68,  'B should be 68 (#44)');
  });
  it('pure black input → AAA (dark green #14532d overlay)', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    const imageData = new ImageData(data, 1, 1);
    const out = computeContrastMap(imageData);
    assertEqual(out[0], 20, 'R should be 20 (#14)');
    assertEqual(out[1], 83, 'G should be 83 (#53)');
    assertEqual(out[2], 45, 'B should be 45 (#2d)');
  });
  it('returns Uint8ClampedArray with same pixel count * 4', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const imageData = new ImageData(data, 4, 4);
    const out = computeContrastMap(imageData);
    assertEqual(out.length, 4 * 4 * 4);
    assert(out instanceof Uint8ClampedArray, 'should be Uint8ClampedArray');
  });
});

describe('computeWeightMap', () => {
  it('pure black pixel → weight > 0.5', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    const imageData = new ImageData(data, 1, 1);
    const { weights } = computeWeightMap(imageData);
    assert(weights[0] > 0.5, `expected weight > 0.5, got ${weights[0]}`);
  });
  it('pure white pixel → weight < 0.1', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const imageData = new ImageData(data, 1, 1);
    const { weights } = computeWeightMap(imageData);
    assert(weights[0] < 0.1, `expected weight < 0.1, got ${weights[0]}`);
  });
  it('returns Float32Array weights and Uint8ClampedArray overlay', () => {
    const data = new Uint8ClampedArray([128, 64, 32, 255]);
    const imageData = new ImageData(data, 1, 1);
    const { weights, overlay } = computeWeightMap(imageData);
    assert(weights instanceof Float32Array, 'weights should be Float32Array');
    assert(overlay instanceof Uint8ClampedArray, 'overlay should be Uint8ClampedArray');
    assertEqual(overlay.length, 4);
  });
});

describe('computeCenterOfMass', () => {
  it('uniform weight 4×4 → center at (1.5, 1.5)', () => {
    const W = 4, H = 4;
    const weights = new Float32Array(W * H).fill(1.0);
    const { x, y } = computeCenterOfMass(weights, W, H);
    assert(Math.abs(x - 1.5) < 0.01, `expected x≈1.5, got ${x}`);
    assert(Math.abs(y - 1.5) < 0.01, `expected y≈1.5, got ${y}`);
  });
  it('all weight in top-left corner → center at (0, 0)', () => {
    const W = 4, H = 4;
    const weights = new Float32Array(W * H).fill(0);
    weights[0] = 1.0;
    const { x, y } = computeCenterOfMass(weights, W, H);
    assertEqual(x, 0);
    assertEqual(y, 0);
  });
  it('zero total weight → returns fallback (W/2, H/2)', () => {
    const W = 4, H = 4;
    const weights = new Float32Array(W * H).fill(0);
    const { x, y } = computeCenterOfMass(weights, W, H);
    assertEqual(x, W / 2);
    assertEqual(y, H / 2);
  });
});
```

- [ ] **Step 2: Verify the test import fails (expected)**

Open `tests/runner.html` in a browser. You should see a module import error because `editor/analysis.js` doesn't exist yet. This confirms the tests are correctly wired and failing.

(No command to run — browser only. Skip if already confident.)

---

## Task 2: Implement editor/analysis.js

**Files:**
- Create: `editor/analysis.js`

- [ ] **Step 1: Create the implementation**

Create `editor/analysis.js`:

```js
// editor/analysis.js

/**
 * Linearise an sRGB channel value (0–1 range).
 * @param {number} c — 0 to 1
 * @returns {number}
 */
export function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute relative luminance from 0–255 R, G, B values.
 * @returns {number} 0 (black) to 1 (white)
 */
export function relativeLuminance(r, g, b) {
  return 0.2126 * linearize(r / 255)
       + 0.7152 * linearize(g / 255)
       + 0.0722 * linearize(b / 255);
}

/**
 * WCAG contrast ratio of a colour against white.
 * @param {number} L — relative luminance (0–1)
 * @returns {number} ratio (1–21)
 */
export function contrastVsWhite(L) {
  return 1.05 / (L + 0.05);
}

/**
 * WCAG level string from a contrast ratio.
 * @param {number} ratio
 * @returns {'AAA'|'AA'|'AA Large'|'Fail'}
 */
export function wcagLevel(ratio) {
  if (ratio >= 7)   return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3)   return 'AA Large';
  return 'Fail';
}

// Contrast map colour coding (RGBA). Alpha = Math.round(0.45 * 255) = 115.
const CONTRAST_COLORS = {
  'AAA':      [20,  83,  45,  115],  // dark green  #14532d
  'AA':       [34, 197,  94,  115],  // green       #22c55e
  'AA Large': [234,179,   8,  115],  // yellow      #eab308
  'Fail':     [239, 68,  68,  115],  // red         #ef4444
};

/**
 * Build a contrast-map RGBA overlay from canvas ImageData.
 * @param {ImageData} imageData
 * @returns {Uint8ClampedArray} RGBA overlay, same dimensions as imageData
 */
export function computeContrastMap(imageData) {
  const { data, width, height } = imageData;
  const n   = width * height;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const L     = relativeLuminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    const ratio = contrastVsWhite(L);
    const level = wcagLevel(ratio);
    const [cr, cg, cb, ca] = CONTRAST_COLORS[level];
    out[i * 4]     = cr;
    out[i * 4 + 1] = cg;
    out[i * 4 + 2] = cb;
    out[i * 4 + 3] = ca;
  }
  return out;
}

// Weight heatmap colour bands (RGBA). Alpha = Math.round(0.5 * 255) = 128.
const WEIGHT_COLORS = [
  [59, 130, 246, 128],  // blue   0.00–0.25  #3b82f6
  [34, 197,  94, 128],  // green  0.25–0.50  #22c55e
  [234,179,   8, 128],  // yellow 0.50–0.75  #eab308
  [239, 68,  68, 128],  // red    0.75–1.00  #ef4444
];

/**
 * Build a visual-weight map from canvas ImageData.
 * @param {ImageData} imageData
 * @returns {{ weights: Float32Array, overlay: Uint8ClampedArray }}
 */
export function computeWeightMap(imageData) {
  const { data, width, height } = imageData;
  const n       = width * height;
  const weights = new Float32Array(n);
  const overlay = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const R = linearize(data[i * 4]     / 255);
    const G = linearize(data[i * 4 + 1] / 255);
    const B = linearize(data[i * 4 + 2] / 255);
    const L   = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const sat = max === 0 ? 0 : (max - min) / max;
    const w   = (1 - L) * 0.7 + sat * 0.3;
    weights[i] = w;
    const band = Math.min(3, Math.floor(w * 4));
    const [cr, cg, cb, ca] = WEIGHT_COLORS[band];
    overlay[i * 4]     = cr;
    overlay[i * 4 + 1] = cg;
    overlay[i * 4 + 2] = cb;
    overlay[i * 4 + 3] = ca;
  }
  return { weights, overlay };
}

/**
 * Compute centre of mass from a per-pixel weight array.
 * @param {Float32Array} weights
 * @param {number} W — canvas width in pixels
 * @param {number} H — canvas height in pixels
 * @returns {{ x: number, y: number }} canvas pixel coordinates
 */
export function computeCenterOfMass(weights, W, H) {
  let totalWeight = 0, cx = 0, cy = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const w = weights[y * W + x];
      totalWeight += w;
      cx += x * w;
      cy += y * w;
    }
  }
  if (totalWeight === 0) return { x: W / 2, y: H / 2 };
  return { x: cx / totalWeight, y: cy / totalWeight };
}

/**
 * Draw a 12px crosshair with a 4px dot at the centre of mass.
 * White stroke over a dark shadow for visibility on any background.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawCenterOfMass(ctx, x, y) {
  const arm = 12;
  ctx.save();
  // Shadow pass
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
  ctx.stroke();
  // White pass
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
  ctx.stroke();
  // Centre dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Average the luminance of pixels in a bounding box and return contrast stats.
 * Used to populate the WCAG badge for the selected text layer.
 * @param {HTMLCanvasElement} canvas — must already be rendered
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @returns {{ ratio: number, level: string }}
 */
export function sampleBoundsLuminance(canvas, bounds) {
  const { x, y, width, height } = bounds;
  if (width <= 0 || height <= 0) return { ratio: 1, level: 'Fail' };
  const ctx       = canvas.getContext('2d');
  const imageData = ctx.getImageData(
    Math.round(x), Math.round(y),
    Math.round(width), Math.round(height)
  );
  const { data } = imageData;
  const n = imageData.width * imageData.height;
  let sumL = 0;
  for (let i = 0; i < n; i++) {
    sumL += relativeLuminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  const avgL  = sumL / n;
  const ratio = contrastVsWhite(avgL);
  return { ratio, level: wcagLevel(ratio) };
}
```

- [ ] **Step 2: Add analysis.test.js to runner.html**

Edit `tests/runner.html` — add the import line before `summary()`:

Old block (inside `<script type="module">`):
```js
    import './editor/layer-manager.test.js';
    summary();
```

New block:
```js
    import './editor/layer-manager.test.js';
    import './editor/analysis.test.js';
    summary();
```

- [ ] **Step 3: Verify tests pass**

Open `tests/runner.html` in a browser. Look for the `linearize`, `relativeLuminance`, `contrastVsWhite`, `wcagLevel`, `computeContrastMap`, `computeWeightMap`, `computeCenterOfMass` suites. All tests should show green ✓.

- [ ] **Step 4: Commit**

```bash
cd C:/Projects/Photos/Composers/post-composer
git add editor/analysis.js tests/editor/analysis.test.js tests/runner.html
git commit -m "feat: add analysis.js with contrast map, weight map, center of mass"
```

---

## Task 3: Create editor/export.js

**Files:**
- Create: `editor/export.js`

(No unit tests for export — browser download APIs can't be meaningfully unit-tested. Smoke tested in Task 8.)

- [ ] **Step 1: Create the file**

Create `editor/export.js`:

```js
// editor/export.js

/**
 * Export the current canvas as a PNG download.
 * The canvas is already at full export resolution — no re-render needed.
 * @param {HTMLCanvasElement} canvas
 * @param {string} frameId
 */
export function exportFrame(canvas, frameId) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `frame-${frameId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Export all frames as individual PNG downloads.
 * Renders each frame into a temporary canvas at full export resolution.
 * Waits 100 ms between downloads to avoid browser popup blocking.
 *
 * @param {object[]} frames — project.frames array
 * @param {import('../core/state.js').AppState} state
 * @param {import('./renderer.js').Renderer} rendererInstance
 * @param {(i: number, total: number) => void} onProgress — called after each frame
 * @returns {Promise<{ skipped: number }>}
 */
export async function exportAllFrames(frames, state, rendererInstance, onProgress) {
  const total   = frames.length;
  let   skipped = 0;

  for (let i = 0; i < total; i++) {
    const frame = frames[i];

    if (!state.images.has(frame.image_filename)) {
      skipped++;
      onProgress(i + 1, total);
      continue;
    }

    const tempCanvas    = document.createElement('canvas');
    tempCanvas.width    = state.project.export.width_px;
    tempCanvas.height   = state.project.export.height_px;

    // Render clean — no overlays, no selection, no guides
    rendererInstance.renderFrame(tempCanvas, frame, state.project, state.images, {});

    await new Promise(resolve => {
      tempCanvas.toBlob(blob => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `frame-${frame.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });

    onProgress(i + 1, total);
    if (i < total - 1) await new Promise(r => setTimeout(r, 100));
  }

  return { skipped };
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/export.js
git commit -m "feat: add export.js — exportFrame and exportAllFrames"
```

---

## Task 4: Update editor/renderer.js — analysis overlay pass

**Files:**
- Modify: `editor/renderer.js`

- [ ] **Step 1: Add import and analysis overlay to renderer.js**

The full new content of `editor/renderer.js` (replace existing file):

```js
// editor/renderer.js
import { renderLayer, computeLayerBounds } from './layers.js';
import {
  computeContrastMap, computeWeightMap,
  computeCenterOfMass, drawCenterOfMass,
} from './analysis.js';

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
   * @param {string|null} [opts.selectedLayerId] — id of the currently selected layer
   * @param {boolean} [opts.showLayerBounds] — draw bounding boxes for all visible layers
   * @param {string|null} [opts.analysisMode] — 'contrast', 'weight', or null
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

    // Analysis overlay — reads fully composed pixels, writes RGBA overlay
    if (opts.analysisMode) {
      const imageData = ctx.getImageData(0, 0, w, h);
      if (opts.analysisMode === 'contrast') {
        const overlay = computeContrastMap(imageData);
        ctx.putImageData(new ImageData(overlay, w, h), 0, 0);
      } else if (opts.analysisMode === 'weight') {
        const { weights, overlay } = computeWeightMap(imageData);
        ctx.putImageData(new ImageData(overlay, w, h), 0, 0);
        const { x, y } = computeCenterOfMass(weights, w, h);
        drawCenterOfMass(ctx, x, y);
      }
    }
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

- [ ] **Step 2: Commit**

```bash
git add editor/renderer.js
git commit -m "feat: add analysis overlay pass to renderer (contrast + weight modes)"
```

---

## Task 5: CSS — probe popover and WCAG badge colours

**Files:**
- Modify: `styles/components.css`

- [ ] **Step 1: Add styles to components.css**

Append the following block to the end of `styles/components.css`:

```css
/* ── Probe popover ──────────────────────────────────────────── */
.probe-popover {
  position: absolute;
  background: rgba(10, 10, 20, 0.92);
  color: #e2e8f0;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 8px 10px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 50;
  white-space: pre;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* ── WCAG badge colours ─────────────────────────────────────── */
.wcag-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.wcag-aaa      { background: #14532d; color: #4ade80; }
.wcag-aa       { background: #166534; color: #86efac; }
.wcag-aa-large { background: #713f12; color: #fde68a; }
.wcag-fail     { background: #7f1d1d; color: #fca5a5; }
```

- [ ] **Step 2: Commit**

```bash
git add styles/components.css
git commit -m "feat: add probe-popover and WCAG badge colour styles"
```

---

## Task 6: Update editor/shell.js — buttons, wiring, probe, WCAG dispatch

**Files:**
- Modify: `editor/shell.js`

- [ ] **Step 1: Replace editor/shell.js with the full updated version**

Replace the entire file with:

```js
// editor/shell.js
import { FrameManager }         from './frame-manager.js';
import { LayerManager }         from './layer-manager.js';
import { DragResize }           from './drag-resize.js';
import { renderer }             from './renderer.js';
import { computeLayerBounds }   from './layers.js';
import { relativeLuminance, contrastVsWhite, wcagLevel, sampleBoundsLuminance }
                                from './analysis.js';
import { exportFrame, exportAllFrames } from './export.js';
import { Filmstrip }            from '../ui/filmstrip.js';
import { Inspector }            from '../ui/inspector.js';
import { LayersPanel }          from '../ui/layers-panel.js';
import { ImageTray }            from '../ui/image-tray.js';
import { events }               from '../core/events.js';
import { router }               from '../core/router.js';
import { loadProjectFonts }     from '../shared/fonts.js';

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
  const imageTrayEl   = root.querySelector('.editor-image-tray');
  const inspectorEl   = root.querySelector('.editor-inspector');

  // Layers panel mounts to body (floating, fixed position)
  const layersPanelEl = document.createElement('div');
  layersPanelEl.className = 'layers-panel';
  document.body.appendChild(layersPanelEl);

  const frameManager = new FrameManager(state);
  const layerManager = new LayerManager(state);

  new Filmstrip(filmstripEl, frameManager, state);
  new Inspector(inspectorEl, state, layerManager);
  new ImageTray(imageTrayEl, state);
  const layersPanel = new LayersPanel(layersPanelEl, state, layerManager);

  function _repaint() {
    const frame = state.activeFrame;
    if (!frame || !state.project) return;
    _fitCanvas(canvasEl, root.querySelector('.editor-canvas-area'), state.project.export);
    renderer.renderFrame(canvasEl, frame, state.project, state.images, {
      guideType:       state.prefs.guideType,
      showSafeZone:    state.prefs.showSafeZone,
      selectedLayerId: state.selectedLayerId,
      showLayerBounds: state.prefs.showLayerBounds,
      analysisMode:    state.analysisMode,
    });

    // Post-repaint WCAG dispatch: sample canvas at selected text layer bounds
    const layerId = state.selectedLayerId;
    const layer   = state.activeFrame?.layers?.find(l => l.id === layerId);
    if (layer?.type === 'text') {
      const bounds = computeLayerBounds(layer, canvasEl.width, canvasEl.height);
      const result = sampleBoundsLuminance(canvasEl, bounds);
      events.dispatchEvent(new CustomEvent('analysis:contrast', { detail: result }));
    }
  }

  new DragResize(canvasEl, state, layerManager, _repaint);

  // ── Header: back to Project Manager ────────
  root.querySelector('#btn-back').addEventListener('click', () => {
    router.navigate('manager');
  });

  // ── Header: project name updates ───────────
  const nameEl = root.querySelector('#header-project-name');
  events.addEventListener('project:loaded', () => {
    const title = state.project?.project?.title;
    if (title) {
      nameEl.textContent = title;
      nameEl.classList.remove('no-project');
    } else {
      nameEl.textContent = 'No project loaded';
      nameEl.classList.add('no-project');
    }
  });

  // ── Header: file inputs ─────────────────────
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

  // ── View strip: composition guides ─────────
  _wireGuideButtons(root, state, _repaint);

  // ── View strip: safe zone ──────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    state.prefs.showSafeZone = !state.prefs.showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showSafeZone);
    _repaint();
  });

  // ── View strip: layer bounds ───────────────
  root.querySelector('#btn-layer-bounds').addEventListener('click', e => {
    state.prefs.showLayerBounds = !state.prefs.showLayerBounds;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showLayerBounds);
    _repaint();
  });

  // ── View strip: analysis modes (mutually exclusive) ──
  const analysisModes = ['contrast', 'weight'];
  analysisModes.forEach(mode => {
    root.querySelector(`#btn-${mode}`).addEventListener('click', () => {
      const next = state.analysisMode === mode ? null : mode;
      state.setAnalysisMode(next);
      analysisModes.forEach(m => {
        root.querySelector(`#btn-${m}`).setAttribute('aria-pressed', m === next);
      });
      _repaint();
    });
  });

  // ── View strip: export ─────────────────────
  root.querySelector('#btn-export-frame').addEventListener('click', () => {
    if (!state.activeFrame) return;
    exportFrame(canvasEl, state.activeFrame.id);
  });

  root.querySelector('#btn-export-all').addEventListener('click', async () => {
    if (!state.project) return;
    const { skipped } = await exportAllFrames(
      state.project.frames, state, renderer,
      (i, total) => console.log(`Exporting ${i}/${total}...`)
    );
    if (skipped > 0) alert(`${skipped} frame(s) skipped — missing images.`);
  });

  // ── View strip: layers panel toggle ────────
  const layersPanelBtn = root.querySelector('#btn-layers-panel');
  layersPanelBtn.addEventListener('click', () => {
    const isOpen = layersPanel.toggle();
    layersPanelBtn.setAttribute('aria-pressed', isOpen);
    layersPanelBtn.textContent = isOpen ? 'Layers ▼' : 'Layers ▲';
  });

  // ── Canvas: click-to-probe ─────────────────
  let probePopover = null;
  canvasEl.addEventListener('click', e => {
    if (!state.project || !state.activeFrame) return;
    const rect   = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width  / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const cx     = Math.round((e.clientX - rect.left) * scaleX);
    const cy     = Math.round((e.clientY - rect.top)  * scaleY);
    const ctx    = canvasEl.getContext('2d');
    const pixel  = ctx.getImageData(cx, cy, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2];
    const L     = relativeLuminance(r, g, b);
    const ratio = contrastVsWhite(L);
    const level = wcagLevel(ratio);

    const canvasArea = root.querySelector('.editor-canvas-area');
    if (!probePopover) {
      probePopover = document.createElement('div');
      probePopover.className = 'probe-popover';
      canvasArea.appendChild(probePopover);
    }
    probePopover.textContent =
      `RGB: ${r}, ${g}, ${b}\n` +
      `Luminance: ${Math.round(L * 100)}%\n` +
      `Contrast vs white: ${ratio.toFixed(1)}:1\n` +
      `Level: ${level}`;

    // Position near click, clamped so the popover doesn't overflow the area
    const areaRect = canvasArea.getBoundingClientRect();
    const pw = 180, ph = 72;
    let px = e.clientX - areaRect.left + 14;
    let py = e.clientY - areaRect.top  + 14;
    if (px + pw > areaRect.width)  px = (e.clientX - areaRect.left) - pw - 14;
    if (py + ph > areaRect.height) py = (e.clientY - areaRect.top)  - ph - 14;
    probePopover.style.left = `${px}px`;
    probePopover.style.top  = `${py}px`;
  });

  // ── Repaint on events ──────────────────────
  for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
    events.addEventListener(ev, _repaint);
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

      <div class="editor-header">
        <button id="btn-back" class="btn-back">← Projects</button>
        <span id="header-project-name" class="header-project-name no-project">No project loaded</span>
        <div class="header-project-actions">
          <label class="btn view-strip-btn" for="input-json" title="Load project JSON">Load JSON</label>
          <input id="input-json" type="file" accept=".json" class="file-input-hidden">
          <label class="btn view-strip-btn" for="input-images" title="Load image files">Load Images</label>
          <input id="input-images" type="file" accept="image/*" multiple class="file-input-hidden">
        </div>
      </div>

      <div class="editor-body">

        <div class="editor-left-panel">
          <div class="editor-filmstrip"></div>
          <div class="editor-image-tray"></div>
        </div>

        <div class="editor-canvas-area">
          <canvas id="editor-canvas"></canvas>
        </div>

        <div class="editor-inspector"></div>

      </div>

      <div class="editor-view-strip">
        <div class="view-strip-group">
          <button id="btn-guide-thirds" class="btn view-strip-btn" aria-pressed="false" title="Rule of thirds">⅓ Thirds</button>
          <button id="btn-guide-phi"    class="btn view-strip-btn" aria-pressed="false" title="Golden ratio (φ)">φ Phi</button>
          <button id="btn-guide-cross"  class="btn view-strip-btn" aria-pressed="false" title="Cross">✛ Cross</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group">
          <button id="btn-safe-zone"    class="btn view-strip-btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
          <button id="btn-layer-bounds" class="btn view-strip-btn" aria-pressed="false" title="Layer bounds">Bounds</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group">
          <button id="btn-contrast" class="btn view-strip-btn" aria-pressed="false" title="Contrast map">Contrast</button>
          <button id="btn-weight"   class="btn view-strip-btn" aria-pressed="false" title="Visual weight map">Weight</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group">
          <button id="btn-export-frame" class="btn view-strip-btn" title="Export current frame as PNG">Export Frame</button>
          <button id="btn-export-all"   class="btn view-strip-btn" title="Export all frames as PNG">Export All</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group view-strip-right">
          <button id="btn-layers-panel" class="btn view-strip-btn" aria-pressed="false" title="Toggle layers panel">Layers ▲</button>
        </div>
      </div>

    </div>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/shell.js
git commit -m "feat: wire analysis modes, export, click-to-probe, WCAG dispatch in shell"
```

---

## Task 7: Smoke test — integration-2c.html

**Files:**
- Create: `tests/editor/integration-2c.html`

- [ ] **Step 1: Create the smoke test page**

Create `tests/editor/integration-2c.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Plan 2c integration smoke tests</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    p    { color:#6b7280; margin-bottom:24px; font-size:13px; }
  </style>
</head>
<body>
  <h1>Plan 2c smoke tests</h1>
  <p>Export functions + analysis event dispatch. No pixel assertions.</p>
  <div id="results"></div>
  <script type="module">
    import { describe, it, assert, assertEqual, summary } from '../test-helper.js';
    import { exportFrame } from '../../editor/export.js';
    import { exportAllFrames } from '../../editor/export.js';
    import { sampleBoundsLuminance } from '../../editor/analysis.js';
    import { events } from '../../core/events.js';

    describe('exportFrame', () => {
      it('runs without throwing on a blank canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width  = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 100, 100);
        let threw = false;
        try { exportFrame(canvas, 'smoke-test-frame'); }
        catch (e) { threw = true; }
        assert(!threw, 'exportFrame should not throw');
      });
    });

    describe('exportAllFrames', () => {
      it('skips frames with missing images and returns skipped count', async () => {
        const { AppState } = await import('../../core/state.js');
        const { renderer } = await import('../../editor/renderer.js');
        const state = new AppState();
        state.project = {
          frames: [
            { id: 'f1', image_filename: 'missing.jpg', layers: [] },
          ],
          export: { width_px: 100, height_px: 100 },
          design_tokens: { palette: { background: '#000' } },
        };
        // state.images is empty — frame will be skipped
        const progress = [];
        const result = await exportAllFrames(
          state.project.frames, state, renderer,
          (i, total) => progress.push({ i, total })
        );
        assertEqual(result.skipped, 1, 'should report 1 skipped frame');
        assertEqual(progress.length, 1, 'onProgress called once');
      });
    });

    describe('sampleBoundsLuminance', () => {
      it('returns ratio and level from a white canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 100, 100);
        const bounds = { x: 10, y: 10, width: 80, height: 80 };
        const { ratio, level } = sampleBoundsLuminance(canvas, bounds);
        assert(typeof ratio === 'number', 'ratio should be a number');
        assert(typeof level === 'string', 'level should be a string');
        assert(ratio > 0.9 && ratio < 1.1, `white vs white should be ~1:1, got ${ratio}`);
        assertEqual(level, 'Fail', 'white on white fails contrast');
      });
      it('returns ratio and level from a black canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 100, 100);
        const { ratio, level } = sampleBoundsLuminance(canvas, { x: 0, y: 0, width: 100, height: 100 });
        assert(ratio > 20, `black vs white should be ~21:1, got ${ratio}`);
        assertEqual(level, 'AAA');
      });
      it('handles zero-size bounds gracefully', () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 100;
        const { ratio, level } = sampleBoundsLuminance(canvas, { x: 0, y: 0, width: 0, height: 0 });
        assertEqual(ratio, 1);
        assertEqual(level, 'Fail');
      });
    });

    describe('analysis:contrast event', () => {
      it('can dispatch and receive analysis:contrast events', () => {
        let received = null;
        const handler = e => { received = e.detail; };
        events.addEventListener('analysis:contrast', handler);
        events.dispatchEvent(new CustomEvent('analysis:contrast', {
          detail: { ratio: 4.8, level: 'AA' }
        }));
        events.removeEventListener('analysis:contrast', handler);
        assert(received !== null, 'event should be received');
        assertEqual(received.ratio, 4.8);
        assertEqual(received.level, 'AA');
      });
    });

    summary();
  </script>
</body>
</html>
```

- [ ] **Step 2: Open the smoke test page in a browser and verify all pass**

Open `tests/editor/integration-2c.html` in a browser. All 7 tests should show green ✓.

- [ ] **Step 3: Commit**

```bash
git add tests/editor/integration-2c.html
git commit -m "test: add integration-2c.html smoke tests for export and analysis dispatch"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `linearize()` function | Task 2 analysis.js |
| `relativeLuminance()` | Task 2 |
| `contrastVsWhite()` | Task 2 |
| `wcagLevel()` | Task 2 |
| `computeContrastMap()` — RGBA overlay, alpha 0.45 | Task 2 |
| `computeWeightMap()` — Float32Array + RGBA overlay, alpha 0.5 | Task 2 |
| `computeCenterOfMass()` | Task 2 |
| `drawCenterOfMass()` — 12px crosshair + 4px dot | Task 2 |
| `sampleBoundsLuminance()` | Task 2 |
| `exportFrame()` | Task 3 |
| `exportAllFrames()` with skip + 100ms delay | Task 3 |
| Renderer `analysisMode` opt + overlay pass after guides | Task 4 |
| Contrast/Weight toggle buttons in view strip | Task 6 |
| Export Frame/Export All buttons in view strip | Task 6 |
| Analysis modes mutually exclusive | Task 6 |
| Click-to-probe popover | Task 6 |
| Post-repaint WCAG dispatch for text layers | Task 6 |
| `analysisMode` passed to renderer in `_repaint()` | Task 6 |
| `.probe-popover` CSS | Task 5 |
| `.wcag-aaa/.wcag-aa/.wcag-aa-large/.wcag-fail` CSS | Task 5 |
| Inspector WCAG badge already wired (Plan 2c-pre) | Already done ✓ |
| Unit tests for pure analysis functions | Task 1 + 2 |
| `tests/editor/integration-2c.html` smoke tests | Task 7 |
| Alert on skipped frames in batch export | Task 6 |

All requirements covered. No gaps.
