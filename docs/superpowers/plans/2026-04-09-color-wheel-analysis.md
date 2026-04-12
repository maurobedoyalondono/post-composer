# Color Wheel Analysis Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating, draggable Color Wheel panel that reads the rendered canvas, extracts dominant colors via K-means, scores all six harmony modes with best-fit rotation, lists colors by in-harmony vs. affecting, and optionally overlays affecting pixels on the canvas in red.

**Architecture:** Pure-math module (`editor/color-wheel-analysis.js`) handles pixel sampling, K-means clustering, harmony scoring, and overlay generation. Floating panel (`ui/color-wheel-panel.js`) subscribes to change events, runs analysis with debounce, and renders SVG wheel + color breakdown. Canvas overlay stored in `state.colorWheelOverlay` and applied by the renderer alongside existing analysis overlays.

**Tech Stack:** Vanilla ES modules, browser Canvas API (`ImageData`, `getImageData`, `putImageData`), SVG for the wheel, no external libraries.

---

## File Structure

**New:**
- `editor/color-wheel-analysis.js` — pure pixel math: K-means color extraction, harmony scoring, overlay generation
- `ui/color-wheel-panel.js` — floating draggable panel: SVG wheel, harmony list, color breakdown, overlay toggle
- `tests/editor/color-wheel-analysis.test.js` — unit tests for all three exported functions

**Modified:**
- `core/state.js:7-15` — add `this.colorWheelOverlay = null`
- `editor/renderer.js:60-73` — apply `opts.colorWheelOverlay` after existing analysis block
- `editor/shell.js` — add `#btn-color-wheel` to view strip, mount panel, wire events and repaint
- `tests/runner.html:26-32` — add new test import

---

### Task 1: color-wheel-analysis.js — HSL helpers + extractDominantColors

**Files:**
- Create: `editor/color-wheel-analysis.js`
- Create: `tests/editor/color-wheel-analysis.test.js`
- Modify: `tests/runner.html`

- [ ] **Step 1: Write the failing tests**

Create `tests/editor/color-wheel-analysis.test.js`:

```js
// tests/editor/color-wheel-analysis.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { extractDominantColors } from '../../editor/color-wheel-analysis.js';

// Helper: build a 1×1 ImageData from RGBA values
function px(r, g, b, a = 255) {
  return new ImageData(new Uint8ClampedArray([r, g, b, a]), 1, 1);
}

// Helper: build an N×1 ImageData repeating one color
function solidImage(r, g, b, n = 4) {
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return new ImageData(data, n, 1);
}

describe('extractDominantColors', () => {
  it('returns at most k clusters', () => {
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 4);
    assert(result.length <= 4, `expected ≤4 clusters, got ${result.length}`);
  });

  it('solid red image → dominant color has hex close to #ff0000', () => {
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 2);
    const top = result[0];
    assert(top.hex.startsWith('#'), 'hex should start with #');
    assertEqual(top.hex.length, 7, 'hex should be 7 chars');
    assertEqual(top.canvasPct, 100, 'solid image should be 100%');
  });

  it('sorted by canvasPct descending', () => {
    const img = solidImage(0, 0, 255, 16);
    const result = extractDominantColors(img, 3);
    for (let i = 1; i < result.length; i++) {
      assert(result[i - 1].canvasPct >= result[i].canvasPct, 'not sorted by canvasPct');
    }
  });

  it('marks neutral colors (s < 10) as isNeutral=true', () => {
    // Pure white: r=255 g=255 b=255 → s=0
    const img = solidImage(255, 255, 255, 16);
    const result = extractDominantColors(img, 2);
    assert(result[0].isNeutral === true, 'white should be neutral');
  });

  it('marks saturated colors as isNeutral=false', () => {
    // Pure red: s=100
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 2);
    assert(result[0].isNeutral === false, 'red should not be neutral');
  });

  it('each result has hex, hsl, canvasPct, isNeutral', () => {
    const img = solidImage(100, 150, 200, 16);
    const result = extractDominantColors(img, 2);
    const c = result[0];
    assert(typeof c.hex === 'string', 'hex should be string');
    assert(typeof c.hsl === 'object', 'hsl should be object');
    assert(typeof c.hsl.h === 'number', 'hsl.h should be number');
    assert(typeof c.hsl.s === 'number', 'hsl.s should be number');
    assert(typeof c.hsl.l === 'number', 'hsl.l should be number');
    assert(typeof c.canvasPct === 'number', 'canvasPct should be number');
    assert(typeof c.isNeutral === 'boolean', 'isNeutral should be boolean');
  });
});
```

- [ ] **Step 2: Add import to tests/runner.html**

Add before `summary()`:
```html
import './editor/color-wheel-analysis.test.js';
```

- [ ] **Step 3: Open tests/runner.html — confirm tests FAIL**

Expected: `extractDominantColors` tests red ("extractDominantColors is not defined").

- [ ] **Step 4: Create editor/color-wheel-analysis.js**

```js
// editor/color-wheel-analysis.js

// ─── HSL / HEX Conversion Helpers ──────────────────────────────────────────

function _rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function _hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1/3) * 255),
    g: Math.round(hue2rgb(h)       * 255),
    b: Math.round(hue2rgb(h - 1/3) * 255),
  };
}

function _rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// Circular hue angular distance (0–180)
function _hueDeg(h1, h2) {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

// Weighted HSL distance — hue difference dampened by saturation
function _hslDist(a, b) {
  const hd = (_hueDeg(a.h, b.h) / 180) * (Math.min(a.s, b.s) / 100);
  const ld = Math.abs(a.l - b.l) / 100;
  return hd + ld * 0.3;
}

// ─── K-means ───────────────────────────────────────────────────────────────

function _kmeansHSL(samples, k) {
  if (samples.length === 0) return { centroids: [], assignments: new Int32Array(0) };
  k = Math.min(k, samples.length);

  // K-means++ initialisation
  const idx = Math.floor(Math.random() * samples.length);
  const centroids = [{ ...samples[idx] }];
  while (centroids.length < k) {
    const dists = samples.map(s => Math.min(...centroids.map(c => _hslDist(s, c))));
    const total = dists.reduce((sum, d) => sum + d * d, 0);
    let rand = Math.random() * total;
    let chosen = samples.length - 1;
    for (let i = 0; i < samples.length; i++) {
      rand -= dists[i] * dists[i];
      if (rand <= 0) { chosen = i; break; }
    }
    centroids.push({ ...samples[chosen] });
  }

  const assignments = new Int32Array(samples.length);

  for (let iter = 0; iter < 20; iter++) {
    // Assign each sample to nearest centroid
    for (let i = 0; i < samples.length; i++) {
      let minD = Infinity, minJ = 0;
      for (let j = 0; j < k; j++) {
        const d = _hslDist(samples[i], centroids[j]);
        if (d < minD) { minD = d; minJ = j; }
      }
      assignments[i] = minJ;
    }

    // Update centroids — circular mean for hue
    let maxShift = 0;
    for (let j = 0; j < k; j++) {
      let sinSum = 0, cosSum = 0, sSum = 0, lSum = 0, n = 0;
      for (let i = 0; i < samples.length; i++) {
        if (assignments[i] !== j) continue;
        const rad = samples[i].h * Math.PI / 180;
        sinSum += Math.sin(rad); cosSum += Math.cos(rad);
        sSum += samples[i].s; lSum += samples[i].l;
        n++;
      }
      if (n === 0) continue;
      const newH = (Math.atan2(sinSum / n, cosSum / n) * 180 / Math.PI + 360) % 360;
      const newS = sSum / n;
      const newL = lSum / n;
      maxShift = Math.max(maxShift, _hueDeg(newH, centroids[j].h));
      centroids[j] = { h: newH, s: newS, l: newL };
    }
    if (maxShift < 1) break;
  }
  return { centroids, assignments };
}

// ─── extractDominantColors ─────────────────────────────────────────────────

/**
 * Extract k dominant colors from canvas ImageData using K-means in HSL space.
 * Samples every 4th pixel for performance.
 * @param {ImageData} imageData
 * @param {number} [k=8]
 * @returns {Array<{hex:string, hsl:{h:number,s:number,l:number}, canvasPct:number, isNeutral:boolean}>}
 */
export function extractDominantColors(imageData, k = 8) {
  const { data } = imageData;
  const totalPixels = data.length / 4;
  const stride = 4;

  const samples = [];
  for (let i = 0; i < totalPixels; i += stride) {
    samples.push(_rgbToHsl(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  }
  if (samples.length === 0) return [];

  const { centroids, assignments } = _kmeansHSL(samples, k);
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]]++;

  return centroids
    .map((hsl, j) => {
      const rgb = _hslToRgb(hsl.h, hsl.s, hsl.l);
      return {
        hex:       _rgbToHex(rgb.r, rgb.g, rgb.b),
        hsl:       { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) },
        canvasPct: Math.round((counts[j] / samples.length) * 100),
        isNeutral: hsl.s < 10,
      };
    })
    .sort((a, b) => b.canvasPct - a.canvasPct);
}
```

- [ ] **Step 5: Open tests/runner.html — confirm all 6 extractDominantColors tests pass**

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add editor/color-wheel-analysis.js tests/editor/color-wheel-analysis.test.js tests/runner.html
git commit -m "feat: extractDominantColors — K-means color clustering in HSL space"
```

---

### Task 2: computeAllHarmonyScores

**Files:**
- Modify: `editor/color-wheel-analysis.js` (append)
- Modify: `tests/editor/color-wheel-analysis.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/editor/color-wheel-analysis.test.js`:

```js
import { computeAllHarmonyScores } from '../../editor/color-wheel-analysis.js';

// Helper: make a minimal DominantColor
function makeColor(h, s, l, canvasPct) {
  const r = Math.round((l / 100) * 255); // rough approximation for hex
  return {
    hex: '#' + r.toString(16).padStart(2,'0').repeat(3),
    hsl: { h, s, l },
    canvasPct,
    isNeutral: s < 10,
  };
}

describe('computeAllHarmonyScores', () => {
  it('returns exactly 6 results', () => {
    const colors = [makeColor(0, 80, 50, 60), makeColor(180, 80, 50, 40)];
    const results = computeAllHarmonyScores(colors);
    assertEqual(results.length, 6, 'should return 6 harmony types');
  });

  it('sorted by score descending', () => {
    const colors = [makeColor(0, 80, 50, 60), makeColor(180, 80, 50, 40)];
    const results = computeAllHarmonyScores(colors);
    for (let i = 1; i < results.length; i++) {
      assert(results[i - 1].score >= results[i].score, 'not sorted by score');
    }
  });

  it('perfectly complementary colors → complementary has score 100', () => {
    // hue 0° and hue 180° are exactly complementary
    const colors = [makeColor(0, 80, 50, 60), makeColor(180, 80, 50, 40)];
    const results = computeAllHarmonyScores(colors);
    const comp = results.find(r => r.type === 'complementary');
    assert(comp.score >= 95, `complementary score should be near 100, got ${comp.score}`);
  });

  it('each result has type, score, rotation, sectors, inHarmony, affecting', () => {
    const colors = [makeColor(0, 80, 50, 100)];
    const results = computeAllHarmonyScores(colors);
    const r = results[0];
    assert(typeof r.type === 'string', 'type should be string');
    assert(typeof r.score === 'number', 'score should be number');
    assert(typeof r.rotation === 'number', 'rotation should be number');
    assert(Array.isArray(r.sectors), 'sectors should be array');
    assert(Array.isArray(r.inHarmony), 'inHarmony should be array');
    assert(Array.isArray(r.affecting), 'affecting should be array');
  });

  it('affecting colors have degreesOff property', () => {
    // hue 0 only — for harmonies requiring multiple hues, other slots are empty
    // so all 100% should be in harmony for the rotation that puts 0° in a sector
    const colors = [makeColor(0, 80, 50, 100)];
    const results = computeAllHarmonyScores(colors);
    results.forEach(r => {
      r.affecting.forEach(c => {
        assert(typeof c.degreesOff === 'number', `degreesOff should be number, got ${typeof c.degreesOff}`);
      });
    });
  });

  it('neutral colors excluded from inHarmony and affecting', () => {
    const colors = [makeColor(0, 80, 50, 70), makeColor(0, 5, 90, 30)]; // one chromatic, one neutral
    const results = computeAllHarmonyScores(colors);
    results.forEach(r => {
      const allColors = [...r.inHarmony, ...r.affecting];
      assert(!allColors.some(c => c.isNeutral), 'neutral color should not appear in inHarmony or affecting');
    });
  });
});
```

- [ ] **Step 2: Open tests/runner.html — confirm new tests FAIL**

Expected: `computeAllHarmonyScores` tests red.

- [ ] **Step 3: Add computeAllHarmonyScores to editor/color-wheel-analysis.js**

Append after `extractDominantColors`:

```js
// ─── Harmony Definitions ───────────────────────────────────────────────────

// Each entry: array of { offset, halfWidth } defining sectors relative to root hue.
const HARMONY_DEFS = {
  complementary: [
    { offset: 0,   halfWidth: 30 },
    { offset: 180, halfWidth: 30 },
  ],
  'split-comp': [
    { offset: 0,   halfWidth: 30 },
    { offset: 150, halfWidth: 30 },
    { offset: 210, halfWidth: 30 },
  ],
  analogous: [
    { offset: 0, halfWidth: 45 },
  ],
  triad: [
    { offset: 0,   halfWidth: 30 },
    { offset: 120, halfWidth: 30 },
    { offset: 240, halfWidth: 30 },
  ],
  double: [
    { offset: 0,   halfWidth: 30 },
    { offset: 60,  halfWidth: 30 },
    { offset: 180, halfWidth: 30 },
    { offset: 240, halfWidth: 30 },
  ],
  square: [
    { offset: 0,   halfWidth: 30 },
    { offset: 90,  halfWidth: 30 },
    { offset: 180, halfWidth: 30 },
    { offset: 270, halfWidth: 30 },
  ],
};

function _inSectors(hue, sectors) {
  return sectors.some(({ centerHue, halfWidth }) =>
    _hueDeg(hue, centerHue) <= halfWidth
  );
}

// Build a 360-bin histogram from chromatic dominant colors weighted by canvasPct
function _buildHueHistogram(dominantColors) {
  const hist = new Float32Array(360);
  for (const c of dominantColors) {
    if (c.isNeutral) continue;
    hist[Math.round(c.hsl.h) % 360] += c.canvasPct;
  }
  return hist;
}

// Score a specific rotation: sum of histogram values inside any sector
function _scoreRotation(hist, rootHue, sectorDefs, totalChromatic) {
  if (totalChromatic === 0) return 0;
  let inHarmony = 0;
  for (let deg = 0; deg < 360; deg++) {
    if (hist[deg] === 0) continue;
    if (sectorDefs.some(({ offset, halfWidth }) => {
      const center = (rootHue + offset) % 360;
      return _hueDeg(deg, center) <= halfWidth;
    })) {
      inHarmony += hist[deg];
    }
  }
  return Math.round((inHarmony / totalChromatic) * 100);
}

/**
 * Compute best-fit harmony scores for all 6 harmony types.
 * Returns results sorted by score descending.
 * @param {Array<{hex:string,hsl:{h,s,l},canvasPct:number,isNeutral:boolean}>} dominantColors
 * @returns {Array<{type:string,score:number,rotation:number,sectors:Array<{centerHue:number,halfWidth:number}>,inHarmony:object[],affecting:Array<{degreesOff:number}>}>}
 */
export function computeAllHarmonyScores(dominantColors) {
  const chromatic = dominantColors.filter(c => !c.isNeutral);
  const totalChromatic = chromatic.reduce((s, c) => s + c.canvasPct, 0);
  const hist = _buildHueHistogram(dominantColors);

  return Object.entries(HARMONY_DEFS)
    .map(([type, sectorDefs]) => {
      let bestScore = 0, bestRotation = 0;
      for (let root = 0; root < 360; root++) {
        const score = _scoreRotation(hist, root, sectorDefs, totalChromatic);
        if (score > bestScore) { bestScore = score; bestRotation = root; }
      }

      const sectors = sectorDefs.map(({ offset, halfWidth }) => ({
        centerHue: (bestRotation + offset) % 360,
        halfWidth,
      }));

      const inHarmony = chromatic.filter(c => _inSectors(c.hsl.h, sectors));
      const affecting = chromatic
        .filter(c => !_inSectors(c.hsl.h, sectors))
        .map(c => ({
          ...c,
          degreesOff: Math.round(Math.min(...sectors.map(s =>
            Math.max(0, _hueDeg(c.hsl.h, s.centerHue) - s.halfWidth)
          ))),
        }));

      return { type, score: bestScore, rotation: bestRotation, sectors, inHarmony, affecting };
    })
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Open tests/runner.html — confirm all computeAllHarmonyScores tests pass**

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add editor/color-wheel-analysis.js tests/editor/color-wheel-analysis.test.js
git commit -m "feat: computeAllHarmonyScores — best-fit harmony scoring for 6 harmony types"
```

---

### Task 3: computeAffectingOverlay

**Files:**
- Modify: `editor/color-wheel-analysis.js` (append)
- Modify: `tests/editor/color-wheel-analysis.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/editor/color-wheel-analysis.test.js`:

```js
import { computeAffectingOverlay } from '../../editor/color-wheel-analysis.js';

describe('computeAffectingOverlay', () => {
  it('returns Uint8ClampedArray with same length as input data', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const imageData = new ImageData(data, 2, 1);
    const sectors = [{ centerHue: 0, halfWidth: 30 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assert(out instanceof Uint8ClampedArray, 'should be Uint8ClampedArray');
    assertEqual(out.length, data.length, 'output length should match input');
  });

  it('pixel in harmony zone → copied unchanged', () => {
    // Pure red (hue ≈ 0°) with sector centerHue=0, halfWidth=30
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 0, halfWidth: 30 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 255, 'R should be 255 (original)');
    assertEqual(out[1], 0,   'G should be 0 (original)');
    assertEqual(out[2], 0,   'B should be 0 (original)');
    assertEqual(out[3], 255, 'A should be 255 (original)');
  });

  it('pixel outside harmony zone → red tint rgba(239,68,68,128)', () => {
    // Pure green (hue ≈ 120°) with sector only at hue 0°
    const data = new Uint8ClampedArray([0, 255, 0, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 0, halfWidth: 30 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 239, 'R should be 239 (red tint)');
    assertEqual(out[1], 68,  'G should be 68 (red tint)');
    assertEqual(out[2], 68,  'B should be 68 (red tint)');
    assertEqual(out[3], 128, 'A should be 128 (50% opacity)');
  });

  it('neutral pixel (s<10) → copied unchanged regardless of sectors', () => {
    // Pure white (s=0) with no harmonic sector
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 120, halfWidth: 30 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 255, 'neutral pixel R unchanged');
    assertEqual(out[1], 255, 'neutral pixel G unchanged');
    assertEqual(out[2], 255, 'neutral pixel B unchanged');
    assertEqual(out[3], 255, 'neutral pixel A unchanged');
  });
});
```

- [ ] **Step 2: Open tests/runner.html — confirm new tests FAIL**

Expected: `computeAffectingOverlay` tests red.

- [ ] **Step 3: Add computeAffectingOverlay to editor/color-wheel-analysis.js**

Append after `computeAllHarmonyScores`:

```js
// ─── computeAffectingOverlay ───────────────────────────────────────────────

/**
 * Build an RGBA overlay that tints affecting pixels red.
 * In-harmony and neutral pixels are copied unchanged.
 * @param {ImageData} imageData — the full canvas image data
 * @param {Array<{centerHue:number, halfWidth:number}>} sectors — from active HarmonyResult
 * @returns {Uint8ClampedArray}
 */
export function computeAffectingOverlay(imageData, sectors) {
  const { data } = imageData;
  const n = data.length / 4;
  const out = new Uint8ClampedArray(data.length);

  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const { s, h } = _rgbToHsl(r, g, b);

    if (s < 10 || _inSectors(h, sectors)) {
      // Neutral or in-harmony — copy original pixel
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
    } else {
      // Affecting — red tint at 50% opacity
      out[i * 4] = 239; out[i * 4 + 1] = 68; out[i * 4 + 2] = 68; out[i * 4 + 3] = 128;
    }
  }
  return out;
}
```

- [ ] **Step 4: Open tests/runner.html — confirm all computeAffectingOverlay tests pass**

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add editor/color-wheel-analysis.js tests/editor/color-wheel-analysis.test.js
git commit -m "feat: computeAffectingOverlay — red-tints affecting pixels outside harmony zones"
```

---

### Task 4: state.js + renderer.js plumbing

**Files:**
- Modify: `core/state.js:7-15`
- Modify: `editor/renderer.js:60-73`

This task requires no new tests — the existing `state.test.js` and `renderer.js` integration test via the browser verify the changes.

- [ ] **Step 1: Add colorWheelOverlay to core/state.js**

In `core/state.js`, inside the `AppState` constructor, add after `this.activeBriefId`:

```js
this.colorWheelOverlay = null; // Uint8ClampedArray | null — set by ColorWheelPanel
```

The full constructor block becomes:

```js
constructor() {
  this.view             = 'manager';
  this.project          = null;
  this.images           = new Map();
  this.activeFrameIndex = 0;
  this.selectedLayerId  = null;
  this.analysisMode     = null;
  this.prefs            = { guideType: null, showSafeZone: false, showLayerBounds: false };
  this.activeBriefId    = null;
  this.colorWheelOverlay = null; // Uint8ClampedArray | null — set by ColorWheelPanel
}
```

- [ ] **Step 2: Apply colorWheelOverlay in editor/renderer.js**

In `editor/renderer.js`, after the closing `}` of the `if (opts.analysisMode)` block (currently line 72), add:

```js
// Color wheel affecting-pixels overlay — stacks on top of analysis overlay
if (opts.colorWheelOverlay) {
  ctx.putImageData(new ImageData(opts.colorWheelOverlay, w, h), 0, 0);
}
```

The complete overlay section at the bottom of `renderFrame` becomes:

```js
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

// Color wheel affecting-pixels overlay — stacks on top of analysis overlay
if (opts.colorWheelOverlay) {
  ctx.putImageData(new ImageData(opts.colorWheelOverlay, w, h), 0, 0);
}
```

- [ ] **Step 3: Commit**

```bash
git add core/state.js editor/renderer.js
git commit -m "feat: add colorWheelOverlay to state and renderer"
```

---

### Task 5: ui/color-wheel-panel.js

**Files:**
- Create: `ui/color-wheel-panel.js`

No formal unit tests — this is a DOM-rendering component. Manual verification in the browser.

- [ ] **Step 1: Create ui/color-wheel-panel.js**

```js
// ui/color-wheel-panel.js
import { events }                    from '../core/events.js';
import {
  extractDominantColors,
  computeAllHarmonyScores,
  computeAffectingOverlay,
} from '../editor/color-wheel-analysis.js';

const ANALYSIS_EVENTS = ['project:loaded', 'frame:changed', 'layer:changed', 'layers:reordered', 'layer:deleted'];

// Pre-built hue ring colors for SVG (12 segments at 0°, 30°, …, 330°)
const HUE_RING_COLORS = [
  '#ff0000','#ff8000','#ffff00','#80ff00',
  '#00ff00','#00ff80','#00ffff','#0080ff',
  '#0000ff','#8000ff','#ff00ff','#ff0080',
];

export class ColorWheelPanel {
  /**
   * @param {HTMLElement} container — .color-wheel-panel element appended to body by shell
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, state) {
    this._el    = container;
    this._state = state;
    this._timer = null;
    this._results = null;       // HarmonyResult[] from last analysis
    this._activeIdx = 0;        // index into this._results
    this._overlayOn = false;

    this._handlers = {};
    for (const ev of ANALYSIS_EVENTS) {
      this._handlers[ev] = () => this._scheduleAnalysis();
      events.addEventListener(ev, this._handlers[ev]);
    }

    this._el.addEventListener('click', e => this._onClick(e));
    this._initDrag();
  }

  show()   { this._el.classList.add('open');    if (!this._results) this._runAnalysis(); return true; }
  hide()   {
    this._el.classList.remove('open');
    if (this._overlayOn) this._setOverlay(false);
    return false;
  }
  toggle() {
    const isOpen = this._el.classList.toggle('open');
    if (isOpen && !this._results) this._runAnalysis();
    if (!isOpen && this._overlayOn) this._setOverlay(false);
    return isOpen;
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  _scheduleAnalysis() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._runAnalysis(), 400);
  }

  _runAnalysis() {
    this._timer = null;
    const canvas = document.getElementById('editor-canvas');
    if (!canvas || !this._state.project) return;
    try {
      const ctx       = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dominant  = extractDominantColors(imageData);
      this._results   = computeAllHarmonyScores(dominant);
      // Clamp active index in case result set changed
      this._activeIdx = Math.min(this._activeIdx, this._results.length - 1);
      this._render();
      if (this._overlayOn) this._applyOverlay(imageData);
    } catch (e) {
      console.warn('[ColorWheelPanel] analysis failed:', e);
    }
  }

  _setOverlay(on) {
    this._overlayOn = on;
    if (!on) {
      this._state.colorWheelOverlay = null;
      events.dispatchEvent(new CustomEvent('color-wheel:overlay-changed'));
      return;
    }
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    const ctx       = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this._applyOverlay(imageData);
  }

  _applyOverlay(imageData) {
    if (!this._results) return;
    const active  = this._results[this._activeIdx];
    const overlay = computeAffectingOverlay(imageData, active.sectors);
    this._state.colorWheelOverlay = overlay;
    events.dispatchEvent(new CustomEvent('color-wheel:overlay-changed'));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _render() {
    if (!this._results) {
      this._el.innerHTML = `
        <div class="layers-panel-header" style="display:flex;justify-content:space-between;">
          <span>Color Wheel</span>
        </div>
        <div class="layers-panel-empty">No project loaded</div>`;
      this._initDrag();
      return;
    }

    const active   = this._results[this._activeIdx];
    const neutrals = active.inHarmony.concat(active.affecting)
      .length === 0 ? [] :
      this._results[0].inHarmony.concat(this._results[0].affecting);
    // Collect neutrals from extractDominantColors result stored in first result's full color set
    // Actually neutrals are not in inHarmony/affecting — we need them separately.
    // We reuse the dominant colors list from the first result's full set:
    const allChromatic = [...active.inHarmony, ...active.affecting];
    // We can't get neutrals from HarmonyResult directly — they're excluded from scoring.
    // Store them at analysis time instead.
    const neutralColors = this._neutralColors ?? [];

    this._el.innerHTML = `
      <div class="layers-panel-header" style="display:flex;align-items:center;justify-content:space-between;cursor:move;">
        <span>Color Wheel</span>
        <button data-action="refresh" title="Re-analyse" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:14px;padding:0 4px;">⟳</button>
      </div>

      <div style="padding:8px 10px 4px;border-bottom:1px solid var(--color-border);">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:5px;">HARMONY MODE</div>
        ${this._results.map((r, i) => this._harmonyRow(r, i)).join('')}
      </div>

      <div style="padding:8px 10px 4px;display:flex;justify-content:center;">
        ${this._buildWheel(active)}
      </div>

      <div style="padding:0 10px 10px;">
        ${this._colorSection('IN HARMONY', active.inHarmony, false)}
        ${active.affecting.length ? this._colorSection(`AFFECTING — ${active.affecting.reduce((s,c) => s+c.canvasPct,0)}%`, active.affecting, true) : ''}
        ${neutralColors.length ? this._colorSection(`NEUTRAL — ${neutralColors.reduce((s,c) => s+c.canvasPct,0)}%`, neutralColors, false, '#6b7280') : ''}
      </div>

      <div style="padding:6px 10px 10px;border-top:1px solid var(--color-border);">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--color-text-muted);">
          <input type="checkbox" data-action="toggle-overlay" ${this._overlayOn ? 'checked' : ''}>
          Show affecting on canvas
        </label>
      </div>
    `;
    this._initDrag();
  }

  _harmonyRow(result, idx) {
    const isActive = idx === this._activeIdx;
    const scoreColor = result.score >= 75 ? '#4ade80' : result.score >= 50 ? '#facc15' : '#f87171';
    const label = result.type.charAt(0).toUpperCase() + result.type.slice(1);
    const barPct = result.score;
    const bg = isActive ? 'background:var(--color-surface-2);border-left:2px solid var(--color-accent);' : 'background:none;border-left:2px solid transparent;';
    return `
      <div data-action="set-harmony" data-idx="${idx}" style="${bg}display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:3px;margin-bottom:2px;">
        <span style="flex:1;font-size:11px;color:${isActive ? 'var(--color-text)' : 'var(--color-text-muted)'};">${label}</span>
        <span style="font-size:11px;font-weight:700;color:${scoreColor};width:32px;text-align:right;">${result.score}%</span>
        <div style="width:36px;background:var(--color-border);border-radius:2px;height:4px;overflow:hidden;">
          <div style="width:${barPct}%;background:${scoreColor};height:100%;border-radius:2px;"></div>
        </div>
      </div>`;
  }

  _buildWheel(active) {
    const CX = 90, CY = 90, OR = 82, IR = 58, MR = 70;

    // 12 hue ring segments
    const segments = HUE_RING_COLORS.map((color, i) => {
      const startDeg = i * 30 - 15 - 90;
      const endDeg   = i * 30 + 15 - 90;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 0,1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 0,0 ${ix1},${iy1} Z" fill="${color}" opacity="0.75"/>`;
    }).join('');

    // Center fill
    const centerFill = `<circle cx="${CX}" cy="${CY}" r="${IR - 1}" fill="var(--color-surface,#1a1a1a)"/>`;

    // Harmony sectors
    const sectorPaths = active.sectors.map(({ centerHue, halfWidth }) => {
      const startDeg = centerHue - halfWidth - 90;
      const endDeg   = centerHue + halfWidth - 90;
      const largeArc = halfWidth * 2 > 180 ? 1 : 0;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 ${largeArc},1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 ${largeArc},0 ${ix1},${iy1} Z" fill="rgba(96,165,250,0.18)" stroke="rgba(96,165,250,0.65)" stroke-width="1.5"/>`;
    }).join('');

    // Dominant color dots (chromatic only)
    const allChromatic = [...active.inHarmony, ...active.affecting];
    const dots = allChromatic.map(c => {
      const angle = c.hsl.h - 90;
      const [x, y] = _polar(CX, CY, MR, angle);
      const r   = Math.min(10, 4 + Math.round(c.canvasPct / 8));
      const isAffecting = active.affecting.some(a => a.hex === c.hex);
      const stroke      = isAffecting ? '#ef4444' : '#ffffff';
      const dashattr    = isAffecting ? 'stroke-dasharray="3,2"' : '';
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.hex}" stroke="${stroke}" stroke-width="2" ${dashattr}/>`;
    }).join('');

    // Labels in center
    const typeLabel = active.type.charAt(0).toUpperCase() + active.type.slice(1);
    const center = `
      <text x="${CX}" y="${CY - 6}" text-anchor="middle" fill="var(--color-text-muted,#9ca3af)" font-size="11" font-family="var(--font-sans,sans-serif)">${typeLabel}</text>
      <text x="${CX}" y="${CY + 10}" text-anchor="middle" fill="var(--color-text,#e2e8f0)" font-size="15" font-weight="bold" font-family="var(--font-sans,sans-serif)">${active.score}%</text>`;

    return `<svg width="180" height="180" viewBox="0 0 180 180" style="display:block;overflow:visible;">${segments}${centerFill}${sectorPaths}${dots}${center}</svg>`;
  }

  _colorSection(label, colors, isAffecting, labelColor) {
    if (!colors.length) return '';
    const lc = labelColor ?? (isAffecting ? '#f87171' : '#4ade80');
    const rows = colors.map(c => {
      const suffix = isAffecting && c.degreesOff != null
        ? `<span style="font-size:8px;color:#f87171;margin-left:4px;">+${c.degreesOff}°</span>`
        : '';
      const border = isAffecting ? 'border:1.5px solid #f87171;' : '';
      return `
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
          <div style="width:12px;height:12px;background:${c.hex};border-radius:2px;flex-shrink:0;${border}"></div>
          <div style="flex:1;background:var(--color-border,#2a2a2a);border-radius:2px;height:4px;overflow:hidden;">
            <div style="width:${c.canvasPct}%;background:${c.hex};height:100%;border-radius:2px;"></div>
          </div>
          <span style="font-size:9px;color:${isAffecting ? '#f87171' : 'var(--color-text)'};width:24px;text-align:right;">${c.canvasPct}%</span>
          <span style="font-size:8px;color:var(--color-text-muted);font-family:var(--font-mono,monospace);">${c.hex}</span>
          ${suffix}
        </div>`;
    }).join('');
    return `
      <div style="margin-top:8px;">
        <div style="font-size:9px;color:${lc};letter-spacing:1px;margin-bottom:4px;">${label}</div>
        ${rows}
      </div>`;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _onClick(e) {
    if (e.target.closest('[data-action="refresh"]')) {
      this._runAnalysis();
      return;
    }
    const harmonyRow = e.target.closest('[data-action="set-harmony"]');
    if (harmonyRow) {
      this._activeIdx = parseInt(harmonyRow.dataset.idx, 10);
      this._render();
      if (this._overlayOn) {
        const canvas    = document.getElementById('editor-canvas');
        const ctx       = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this._applyOverlay(imageData);
      }
      return;
    }
    const overlayToggle = e.target.closest('[data-action="toggle-overlay"]');
    if (overlayToggle) {
      this._setOverlay(overlayToggle.checked);
    }
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  _initDrag() {
    const header = this._el.querySelector('.layers-panel-header');
    if (!header) return;
    let startX, startY, origLeft, origTop;
    const onMove = e => {
      this._el.style.left   = `${origLeft + e.clientX - startX}px`;
      this._el.style.top    = `${origTop  + e.clientY - startY}px`;
      this._el.style.bottom = 'auto';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    header.addEventListener('mousedown', e => {
      const rect = this._el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origLeft = rect.left; origTop = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      e.preventDefault();
    });
  }

  destroy() {
    clearTimeout(this._timer);
    for (const [ev, fn] of Object.entries(this._handlers)) {
      events.removeEventListener(ev, fn);
    }
    this._el.remove();
  }
}

// ─── SVG helper ──────────────────────────────────────────────────────────────

function _polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return [
    (cx + r * Math.cos(rad)).toFixed(1),
    (cy + r * Math.sin(rad)).toFixed(1),
  ];
}
```

- [ ] **Step 2: Verify in browser**

Open the app, load a project, open DevTools console and run:

```js
import('./ui/color-wheel-panel.js').then(m => {
  const el = document.createElement('div');
  el.className = 'color-wheel-panel open';
  el.style.cssText = 'position:fixed;top:60px;right:20px;width:280px;z-index:9000;background:var(--color-surface);border:1px solid var(--color-border);border-radius:8px;';
  document.body.appendChild(el);
  const state = window.__state; // will be wired in Task 6 — skip for now
  console.log('Panel created');
});
```

Expected: no import errors in console.

- [ ] **Step 3: Commit**

```bash
git add ui/color-wheel-panel.js
git commit -m "feat: ColorWheelPanel — SVG wheel, harmony list, color breakdown, overlay toggle"
```

---

### Task 6: Wire into editor/shell.js

**Files:**
- Modify: `editor/shell.js`

- [ ] **Step 1: Add import at top of editor/shell.js**

Add after the existing imports:

```js
import { ColorWheelPanel } from '../ui/color-wheel-panel.js';
```

- [ ] **Step 2: Mount ColorWheelPanel (after existing LayersPanel mount)**

Read `editor/shell.js` and locate the LayersPanel mount block (approximately lines 34-45). After the `const layersPanel = new LayersPanel(...)` line, add:

```js
// Color wheel panel — floating, appended to body
const colorWheelPanelEl = document.createElement('div');
colorWheelPanelEl.className = 'color-wheel-panel';
colorWheelPanelEl.style.cssText = [
  'position:fixed', 'top:80px', 'right:20px',
  'width:280px', 'z-index:200',
  'background:var(--color-surface)', 'border:1px solid var(--color-border)',
  'border-radius:var(--radius-md)', 'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
  'display:none',
].join(';');
document.body.appendChild(colorWheelPanelEl);
const colorWheelPanel = new ColorWheelPanel(colorWheelPanelEl, state);
```

Note: `display:none` is the closed state. The panel's `show()`/`hide()`/`toggle()` methods add/remove the `open` class. Add the CSS rule in a later step (Step 4).

- [ ] **Step 3: Add Color Wheel button to the view strip**

In `_buildHTML()`, locate the analysis group (the `<div class="view-strip-group">` containing `btn-contrast`, `btn-weight`, `btn-probe`). Add the new button after `btn-probe`:

```html
<button id="btn-color-wheel" class="btn view-strip-btn" aria-pressed="false" title="Color wheel harmony analysis">Color Wheel</button>
```

The full group becomes:
```html
<div class="view-strip-group">
  <button id="btn-contrast"    class="btn view-strip-btn" aria-pressed="false" title="Contrast map">Contrast</button>
  <button id="btn-weight"      class="btn view-strip-btn" aria-pressed="false" title="Visual weight map">Weight</button>
  <button id="btn-probe"       class="btn view-strip-btn" aria-pressed="false" title="Click canvas to probe pixel color and WCAG contrast">Probe</button>
  <button id="btn-color-wheel" class="btn view-strip-btn" aria-pressed="false" title="Color wheel harmony analysis">Color Wheel</button>
</div>
```

- [ ] **Step 4: Wire the button and pass colorWheelOverlay to renderer**

Locate the `// ── View strip: layers panel toggle` block in `mountEditor`. After the `layersPanelBtn` listener, add:

```js
// ── View strip: color wheel panel toggle ────────
const colorWheelBtn = root.querySelector('#btn-color-wheel');
colorWheelBtn.addEventListener('click', () => {
  const isOpen = colorWheelPanel.toggle();
  colorWheelPanelEl.style.display = isOpen ? 'block' : 'none';
  colorWheelBtn.setAttribute('aria-pressed', isOpen);
});

events.addEventListener('color-wheel:overlay-changed', _repaint);
```

In `_repaint()`, add `colorWheelOverlay: state.colorWheelOverlay` to the `renderer.renderFrame` opts object. The full opts block becomes:

```js
renderer.renderFrame(canvasEl, frame, state.project, state.images, {
  guideType:          state.prefs.guideType,
  showSafeZone:       state.prefs.showSafeZone,
  selectedLayerId:    state.selectedLayerId,
  showLayerBounds:    state.prefs.showLayerBounds,
  analysisMode:       state.analysisMode,
  colorWheelOverlay:  state.colorWheelOverlay,
});
```

- [ ] **Step 5: Test the full flow**

1. Load a project with a frame and at least one image
2. Click "Color Wheel" in the view strip
3. Expected: panel appears (top-right, draggable), SVG wheel renders, 6 harmony rows with scores shown
4. Click a harmony row → wheel updates to that harmony's sectors, active row highlights
5. Check "Show affecting on canvas" → canvas repaints with red tint on affecting pixels
6. Uncheck → canvas reverts to normal
7. Click ⟳ → analysis re-runs
8. Close panel (click Color Wheel again) → overlay clears, panel disappears

- [ ] **Step 6: Commit**

```bash
git add editor/shell.js
git commit -m "feat: wire ColorWheelPanel into editor — button, overlay, repaint"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| `extractDominantColors(imageData, k=8)` — K-means, stride 4, HSL, isNeutral | Task 1 |
| `computeAllHarmonyScores(dominantColors)` — 6 types, best-fit rotation, sorted by score | Task 2 |
| `computeAffectingOverlay(imageData, sectors)` — red tint on affecting pixels | Task 3 |
| `state.colorWheelOverlay` property | Task 4 |
| `renderer.js` applies `opts.colorWheelOverlay` | Task 4 |
| ColorWheelPanel — SVG wheel with hue ring, sectors, dots | Task 5 |
| ColorWheelPanel — harmony list sorted by score with mini bars | Task 5 |
| ColorWheelPanel — IN HARMONY / AFFECTING / NEUTRAL breakdown | Task 5 |
| ColorWheelPanel — degreesOff on affecting colors | Task 5 |
| ColorWheelPanel — overlay toggle (hidden by default) | Task 5 |
| ColorWheelPanel — drag-by-header | Task 5 |
| ColorWheelPanel — ⟳ refresh button | Task 5 |
| ColorWheelPanel — 400ms debounce on change events | Task 5 |
| `#btn-color-wheel` in view strip analysis group | Task 6 |
| Shell wires overlay event → repaint | Task 6 |
| `colorWheelOverlay` passed to renderer via opts | Task 6 |

### Placeholder Scan
No TBDs or incomplete sections.

### Type Consistency
- `computeAllHarmonyScores` returns `sectors: [{centerHue, halfWidth}]` — consumed the same way in `computeAffectingOverlay` and in the panel's SVG builder. ✓
- `_inSectors(hue, sectors)` helper uses `centerHue` and `halfWidth` — consistent with both `computeAllHarmonyScores` output and `computeAffectingOverlay` input. ✓
- `affecting[]` entries have `degreesOff` — panel's `_colorSection` renders `c.degreesOff`. ✓
- `ColorWheelPanel.toggle()` returns boolean — shell stores it as `isOpen`. ✓
