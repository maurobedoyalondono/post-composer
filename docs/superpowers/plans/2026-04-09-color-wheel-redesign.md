# Color Wheel Algorithm Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HSL-based color harmony pipeline with OKLCH, tighten sector tolerances, add penalty scoring, and surface plain-language insights so that only intentional color choices score high.

**Architecture:** Full rewrite of `editor/color-wheel-analysis.js` (OKLCH conversion chain, tighter HARMONY_DEFS, penalty `_scoreRotation`, new `generateInsights` export). Targeted changes to `ui/color-wheel-panel.js` (4-level score colors, dashed arcs below 55%, OKLCH-based dot positions, insights panel, pulsing offender ring). Test file updated throughout.

**Tech Stack:** Vanilla JS ES modules, browser-based test runner (`tests/runner.html`), SVG for wheel rendering, SMIL for animation.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `editor/color-wheel-analysis.js` | Rewrite | OKLCH helpers, k-means, extraction, scoring, insights |
| `ui/color-wheel-panel.js` | Modify | Score display, dashed arcs, OKLCH dot positions, insights panel |
| `tests/editor/color-wheel-analysis.test.js` | Modify | Update all tests to OKLCH output shape, add insights tests |

---

## Task 1: OKLCH Extraction Pipeline

**Files:**
- Modify: `tests/editor/color-wheel-analysis.test.js` (update `makeColor` + `extractDominantColors` tests)
- Modify: `editor/color-wheel-analysis.js` (replace HSL helpers + k-means with OKLCH)

### Step 1.1 — Write the failing tests

Replace the entire `tests/editor/color-wheel-analysis.test.js` file. The key changes are:
- `makeColor(h, C, L, canvasPct)` uses OKLCH shape
- Property checks expect `oklch` not `hsl`
- Neutral threshold is `C < 0.04`
- All `computeAllHarmonyScores` and `computeAffectingOverlay` tests updated for OKLCH colors

```javascript
// tests/editor/color-wheel-analysis.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { extractDominantColors } from '../../editor/color-wheel-analysis.js';

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

  it('solid red image → dominant color has canvasPct 100', () => {
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

  it('each result has hex, oklch, canvasPct, isNeutral', () => {
    const img = solidImage(100, 150, 200, 16);
    const result = extractDominantColors(img, 2);
    const c = result[0];
    assert(typeof c.hex === 'string',     'hex should be string');
    assert(typeof c.oklch === 'object',   'oklch should be object');
    assert(typeof c.oklch.L === 'number', 'oklch.L should be number');
    assert(typeof c.oklch.C === 'number', 'oklch.C should be number');
    assert(typeof c.oklch.h === 'number', 'oklch.h should be number');
    assert(typeof c.canvasPct === 'number',  'canvasPct should be number');
    assert(typeof c.isNeutral === 'boolean', 'isNeutral should be boolean');
  });

  it('marks neutral colors (C < 0.04) as isNeutral=true — white', () => {
    const img = solidImage(255, 255, 255, 16); // white: OKLCH C ≈ 0
    const result = extractDominantColors(img, 2);
    assert(result[0].isNeutral === true, 'white should be neutral');
  });

  it('marks saturated colors as isNeutral=false — pure red', () => {
    const img = solidImage(255, 0, 0, 16); // red: OKLCH C ≈ 0.258
    const result = extractDominantColors(img, 2);
    assert(result[0].isNeutral === false, 'red should not be neutral');
  });

  it('pure red maps to OKLCH hue around 29°', () => {
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 2);
    const h = result[0].oklch.h;
    assert(h > 20 && h < 40, `pure red OKLCH hue should be ~29°, got ${h}`);
  });

  it('pure blue maps to OKLCH hue around 264°', () => {
    const img = solidImage(0, 0, 255, 16);
    const result = extractDominantColors(img, 2);
    const h = result[0].oklch.h;
    assert(h > 255 && h < 275, `pure blue OKLCH hue should be ~264°, got ${h}`);
  });

  it('all results have canvasPct > 0 (no empty clusters)', () => {
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 8);
    result.forEach(c => {
      assert(c.canvasPct > 0, `expected canvasPct > 0, got ${c.canvasPct}`);
    });
  });
});
```

- [ ] **Step 1.1: Write the failing tests** — paste the block above into `tests/editor/color-wheel-analysis.test.js`, replacing from line 1 through the end of the first `describe('extractDominantColors', ...)` block (lines 1–76). Leave the rest of the file (`computeAllHarmonyScores`, `computeAffectingOverlay` blocks) temporarily in place — they will be updated in Tasks 2 and 4.

- [ ] **Step 1.2: Open `tests/runner.html` in a browser — verify the new tests fail**

Expected: red ✗ rows for:
- `each result has hex, oklch, canvasPct, isNeutral` — `oklch should be object`
- `pure red maps to OKLCH hue around 29°` — `oklch is undefined`
- `pure blue maps to OKLCH hue around 264°` — `oklch is undefined`

Existing tests that were passing may also fail because `makeColor` is used in later blocks — that is expected; fix those in Task 2.

- [ ] **Step 1.3: Rewrite `editor/color-wheel-analysis.js` with OKLCH pipeline**

Replace the entire file with the following:

```javascript
// editor/color-wheel-analysis.js

// ─── OKLCH Conversion Helpers ──────────────────────────────────────────────

// sRGB component [0,255] → linear light [0,1]
function _linearize(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// sRGB [0,255] → OKLCH { L [0-1], C [0-~0.4], h [0-360] }
function _rgbToOklch(r, g, b) {
  const rl = _linearize(r), gl = _linearize(g), bl = _linearize(b);

  // Linear sRGB → XYZ D65
  const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

  // XYZ → LMS (Oklab M1)
  const l = 0.8189330101 * X + 0.3618667424 * Y - 0.1288597137 * Z;
  const m = 0.0329845436 * X + 0.9293118715 * Y + 0.0361456387 * Z;
  const s = 0.0482003018 * X + 0.2643662691 * Y + 0.6338517070 * Z;

  // Cube root
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

  // LMS → OKLAB (M2)
  const L  =  0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a  =  1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bk =  0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // OKLAB → OKLCH
  const C = Math.sqrt(a * a + bk * bk);
  const h = C < 1e-4 ? 0 : (Math.atan2(bk, a) * 180 / Math.PI + 360) % 360;
  return { L, C, h };
}

// OKLCH centroid → hex string '#rrggbb'
function _oklchToHex(L, C, h) {
  const hRad = h * Math.PI / 180;
  const a  = C * Math.cos(hRad);
  const bk = C * Math.sin(hRad);

  // OKLAB → LMS (M2 inverse)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bk;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bk;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bk;

  const lc = l_ * l_ * l_, mc = m_ * m_ * m_, sc = s_ * s_ * s_;

  // LMS → XYZ (M1 inverse)
  const X =  1.2270138511 * lc - 0.5577999807 * mc + 0.2812561490 * sc;
  const Y = -0.0405801784 * lc + 1.1122568696 * mc - 0.0716766787 * sc;
  const Z = -0.0763812845 * lc - 0.4214819784 * mc + 1.5861632204 * sc;

  // XYZ → linear sRGB
  const rl =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gl = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bl =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

  const toSrgb = c => {
    const cl = Math.max(0, Math.min(1, c));
    return Math.round(
      (cl <= 0.0031308 ? 12.92 * cl : 1.055 * Math.pow(cl, 1 / 2.4) - 0.055) * 255
    );
  };
  return '#' + [toSrgb(rl), toSrgb(gl), toSrgb(bl)]
    .map(v => v.toString(16).padStart(2, '0')).join('');
}

// Circular hue angular distance (0–180)
function _hueDeg(h1, h2) {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

// ─── K-means in OKLCH ──────────────────────────────────────────────────────

// Perceptual distance: chroma-weighted hue + lightness component
function _oklchDist(a, b) {
  const hd = (_hueDeg(a.h, b.h) / 180) * (Math.min(a.C, b.C) / 0.4);
  const ld = Math.abs(a.L - b.L);
  return hd + ld * 0.3;
}

function _kmeansOklch(samples, k) {
  if (samples.length === 0) return { centroids: [], assignments: new Int32Array(0) };
  k = Math.min(k, samples.length);

  // K-means++ initialisation
  const idx = Math.floor(Math.random() * samples.length);
  const centroids = [{ ...samples[idx] }];
  while (centroids.length < k) {
    const dists = samples.map(s => Math.min(...centroids.map(c => _oklchDist(s, c))));
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
    for (let i = 0; i < samples.length; i++) {
      let minD = Infinity, minJ = 0;
      for (let j = 0; j < k; j++) {
        const d = _oklchDist(samples[i], centroids[j]);
        if (d < minD) { minD = d; minJ = j; }
      }
      assignments[i] = minJ;
    }

    let maxShift = 0;
    for (let j = 0; j < k; j++) {
      let sinSum = 0, cosSum = 0, CSum = 0, LSum = 0, n = 0;
      for (let i = 0; i < samples.length; i++) {
        if (assignments[i] !== j) continue;
        const rad = samples[i].h * Math.PI / 180;
        sinSum += Math.sin(rad); cosSum += Math.cos(rad);
        CSum += samples[i].C; LSum += samples[i].L;
        n++;
      }
      if (n === 0) continue;
      const newH = (Math.atan2(sinSum / n, cosSum / n) * 180 / Math.PI + 360) % 360;
      maxShift = Math.max(maxShift, _hueDeg(newH, centroids[j].h));
      centroids[j] = { L: LSum / n, C: CSum / n, h: newH };
    }
    if (maxShift < 1) break;
  }
  return { centroids, assignments };
}

// ─── extractDominantColors ─────────────────────────────────────────────────

/**
 * Extract k dominant colors from canvas ImageData using K-means in OKLCH space.
 * Samples every 4th pixel for performance.
 * @param {ImageData} imageData
 * @param {number} [k=8]
 * @returns {Array<{hex:string, oklch:{L:number,C:number,h:number}, canvasPct:number, isNeutral:boolean}>}
 */
export function extractDominantColors(imageData, k = 8) {
  const { data } = imageData;
  const totalPixels = data.length / 4;
  const sampleStep = 4;

  const samples = [];
  for (let i = 0; i < totalPixels; i += sampleStep) {
    samples.push(_rgbToOklch(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  }
  if (samples.length === 0) return [];

  const { centroids, assignments } = _kmeansOklch(samples, k);
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]]++;

  return centroids
    .map((oklch, j) => ({ oklch, j, count: counts[j] }))
    .filter(({ count }) => count > 0)
    .map(({ oklch, j }) => ({
      hex:       _oklchToHex(oklch.L, oklch.C, oklch.h),
      oklch:     { L: oklch.L, C: oklch.C, h: oklch.h },
      canvasPct: Math.round((counts[j] / samples.length) * 100),
      isNeutral: oklch.C < 0.04,
    }))
    .sort((a, b) => b.canvasPct - a.canvasPct);
}

// ─── Harmony Definitions ───────────────────────────────────────────────────

// Tighter half-widths: professional tolerances, not arbitrary ±30°
const HARMONY_DEFS = {
  complementary: [
    { offset: 0,   halfWidth: 15 },
    { offset: 180, halfWidth: 15 },
  ],
  'split-comp': [
    { offset: 0,   halfWidth: 18 },
    { offset: 150, halfWidth: 18 },
    { offset: 210, halfWidth: 18 },
  ],
  analogous: [
    { offset: 0, halfWidth: 30 },
  ],
  triad: [
    { offset: 0,   halfWidth: 15 },
    { offset: 120, halfWidth: 15 },
    { offset: 240, halfWidth: 15 },
  ],
  double: [
    { offset: 0,   halfWidth: 12 },
    { offset: 60,  halfWidth: 12 },
    { offset: 180, halfWidth: 12 },
    { offset: 240, halfWidth: 12 },
  ],
  square: [
    { offset: 0,   halfWidth: 12 },
    { offset: 90,  halfWidth: 12 },
    { offset: 180, halfWidth: 12 },
    { offset: 270, halfWidth: 12 },
  ],
};

// Operates on resolved sectors: { centerHue, halfWidth }
function _inSectors(hue, sectors) {
  return sectors.some(({ centerHue, halfWidth }) =>
    _hueDeg(hue, centerHue) <= halfWidth
  );
}

// 360-bin histogram from chromatic dominant colors weighted by canvasPct
function _buildHueHistogram(dominantColors) {
  const hist = new Float32Array(360);
  for (const c of dominantColors) {
    if (c.isNeutral) continue;
    hist[Math.round(c.oklch.h) % 360] += c.canvasPct;
  }
  return hist;
}

// Score a rotation with penalty for out-of-harmony chromatic colors
function _scoreRotation(hist, rootHue, sectorDefs, totalChromatic) {
  if (totalChromatic === 0) return 0;
  let inHarmony = 0, outOfHarmony = 0;
  for (let deg = 0; deg < 360; deg++) {
    if (hist[deg] === 0) continue;
    if (sectorDefs.some(({ offset, halfWidth }) => {
      const center = (rootHue + offset) % 360;
      return _hueDeg(deg, center) <= halfWidth;
    })) {
      inHarmony += hist[deg];
    } else {
      outOfHarmony += hist[deg];
    }
  }
  const raw = (inHarmony - 0.6 * outOfHarmony) / totalChromatic;
  return Math.max(0, Math.round(raw * 100));
}

/**
 * Compute best-fit harmony scores for all 6 harmony types.
 * Returns results sorted by score descending.
 * @param {Array<{hex:string,oklch:{L,C,h},canvasPct:number,isNeutral:boolean}>} dominantColors
 * @returns {Array<{type:string,score:number,rotation:number,sectors:Array<{centerHue:number,halfWidth:number}>,inHarmony:object[],affecting:object[]}>}
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

      const inHarmony = chromatic.filter(c => _inSectors(c.oklch.h, sectors));
      const affecting = chromatic
        .filter(c => !_inSectors(c.oklch.h, sectors))
        .map(c => ({
          ...c,
          degreesOff: Math.round(Math.min(...sectors.map(s =>
            Math.max(0, _hueDeg(c.oklch.h, s.centerHue) - s.halfWidth)
          ))),
        }));

      return { type, score: bestScore, rotation: bestRotation, sectors, inHarmony, affecting };
    })
    .sort((a, b) => b.score - a.score);
}

// ─── generateInsights ──────────────────────────────────────────────────────

/**
 * Generate 2-4 plain-language insight notes from harmony results.
 * @param {ReturnType<typeof computeAllHarmonyScores>} results
 * @param {ReturnType<typeof extractDominantColors>} dominantColors
 * @returns {Array<{label:string, text:string, offenderHex?:string}>}
 */
export function generateInsights(results, dominantColors) {
  const chromatic    = dominantColors.filter(c => !c.isNeutral);
  const neutral      = dominantColors.filter(c => c.isNeutral);
  const chromaticPct = chromatic.reduce((s, c) => s + c.canvasPct, 0);
  const neutralPct   = neutral.reduce((s, c) => s + c.canvasPct, 0);
  const meanChroma   = chromatic.length
    ? chromatic.reduce((s, c) => s + c.oklch.C * c.canvasPct, 0) / (chromaticPct || 1)
    : 0;

  if (chromaticPct === 0) {
    return [{ label: 'No color detected', text: 'No significant color found in this canvas. Add color to get harmony results.' }];
  }

  const best = results[0];
  const insights = [];

  // Single-color warning
  if (chromatic.length === 1) {
    insights.push({ label: 'Single color', text: 'Only one distinct color detected — add more elements for meaningful results.' });
  }

  // Insight 1: dominant offender
  const offender = best.affecting.length
    ? best.affecting.reduce((a, b) => a.canvasPct >= b.canvasPct ? a : b)
    : null;
  if (offender) {
    insights.push({
      label: 'Main conflict',
      text: `Your ${_colorName(offender.oklch.h)} tone (${offender.canvasPct}% of canvas) is the main source of conflict — it sits ${offender.degreesOff}° away from the nearest harmony sector.`,
      offenderHex: offender.hex,
    });
  } else {
    insights.push({ label: 'Harmony', text: 'All chromatic colors fall within the harmony sectors.' });
  }

  // Insight 2: harmony identification
  const typeName  = best.type.replace('-', ' ');
  const typeLabel = typeName.charAt(0).toUpperCase() + typeName.slice(1);
  insights.push({
    label: 'Best match',
    text: `${typeLabel} at ${best.score}%. ${_describeHues(chromatic)}`,
  });

  // Insight 3: neutral balance (conditional)
  if (neutralPct > 70) {
    insights.push({
      label: 'Neutral heavy',
      text: `${neutralPct}% of your canvas is neutral. Harmony is scored on a small chromatic sample — results are approximate.`,
    });
  } else if (meanChroma > 0.18) {
    insights.push({
      label: 'High chroma',
      text: 'Very high chroma overall — strong colors are competing across the canvas.',
    });
  }

  // Insight 4: actionable suggestion
  insights.push({ label: 'Suggestion', text: _suggestion(best, chromatic, neutralPct) });

  return insights;
}

function _colorName(hue) {
  const h = ((hue % 360) + 360) % 360;
  if (h < 15 || h >= 345) return 'red';
  if (h < 45)  return 'orange';
  if (h < 75)  return 'yellow';
  if (h < 105) return 'yellow-green';
  if (h < 135) return 'green';
  if (h < 165) return 'teal';
  if (h < 195) return 'cyan';
  if (h < 225) return 'sky blue';
  if (h < 255) return 'blue';
  if (h < 285) return 'indigo';
  if (h < 315) return 'violet';
  return 'magenta';
}

function _describeHues(chromatic) {
  if (!chromatic.length) return '';
  const h = chromatic[0].oklch.h;
  if (h < 60 || h >= 345)  return 'Your composition leans warm (red/orange).';
  if (h < 105) return 'Your composition leans warm (yellow/green).';
  if (h < 195) return 'Your composition leans cool (teal/cyan).';
  if (h < 270) return 'Your composition leans cool (blue).';
  return 'Your composition leans toward violet/purple.';
}

function _suggestion(best, chromatic, neutralPct) {
  if (best.affecting.length) {
    const top = best.affecting.reduce((a, b) => a.canvasPct >= b.canvasPct ? a : b);
    if (top.canvasPct > 20) {
      return 'Try a dark neutral background (#1a1a1a or #2d2d2d) to let your photo colors lead the composition.';
    }
  }
  if (neutralPct > 70) {
    return 'Your photos have rich desaturated tones — a subtle warm or cool tint on the background could enhance depth without adding conflict.';
  }
  if (chromatic.length >= 2) {
    return `The ${_colorName(chromatic[0].oklch.h)} tones are your strongest element — build your background and framing around those.`;
  }
  return 'The composition has good color focus — consider adding a complementary accent to create visual interest.';
}

// ─── computeAffectingOverlay ───────────────────────────────────────────────

/**
 * Build an RGBA overlay that tints affecting pixels red.
 * Uses OKLCH C < 0.04 for neutral detection (replaces HSL s < 10).
 * @param {ImageData} imageData
 * @param {Array<{centerHue:number, halfWidth:number}>} sectors
 * @returns {Uint8ClampedArray}
 */
export function computeAffectingOverlay(imageData, sectors) {
  const { data } = imageData;
  const n = data.length / 4;
  const out = new Uint8ClampedArray(data.length);

  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const { C, h } = _rgbToOklch(r, g, b);

    if (C < 0.04 || _inSectors(h, sectors)) {
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
    } else {
      out[i * 4] = 239; out[i * 4 + 1] = 68; out[i * 4 + 2] = 68; out[i * 4 + 3] = 128;
    }
  }
  return out;
}
```

- [ ] **Step 1.4: Open `tests/runner.html` — verify Task 1 tests are now green**

Expected: all `extractDominantColors` rows show ✓. Some `computeAllHarmonyScores` rows may still fail (uses old `makeColor` helper) — that is fixed in Task 2.

- [ ] **Step 1.5: Commit**

```bash
cd "C:\Projects\Photos\Composers\post-composer"
git add editor/color-wheel-analysis.js tests/editor/color-wheel-analysis.test.js
git commit -m "feat: replace HSL with OKLCH extraction pipeline

Rewrites color-wheel-analysis.js to use OKLCH (perceptually uniform)
throughout. Neutral detection now uses C < 0.04 instead of HSL s < 10.
K-means distance metric is chroma-weighted hue in OKLCH space.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Tighter Harmony Scoring with Penalty

**Files:**
- Modify: `tests/editor/color-wheel-analysis.test.js` (update `makeColor` helper + `computeAllHarmonyScores` tests)

> Note: `HARMONY_DEFS`, `_scoreRotation`, and `computeAllHarmonyScores` are already implemented in Task 1's full rewrite. This task updates the test file so the tests validate the new behaviour correctly.

- [ ] **Step 2.1: Update the `computeAllHarmonyScores` test block**

Replace the existing `computeAllHarmonyScores` block (lines 79–175 in the original file) with the following. Note `makeColor` now takes `(h, C, L, canvasPct)` where `h` is OKLCH hue (0–360), `C` is chroma (0–0.4), `L` is lightness (0–1):

```javascript
import { computeAllHarmonyScores } from '../../editor/color-wheel-analysis.js';

// Helper: make a minimal DominantColor in OKLCH shape
function makeColor(h, C, L, canvasPct) {
  const v = Math.round(L * 255).toString(16).padStart(2, '0');
  return {
    hex: '#' + v.repeat(3),
    oklch: { L, C, h },
    canvasPct,
    isNeutral: C < 0.04,
  };
}

describe('computeAllHarmonyScores', () => {
  it('returns exactly 6 results', () => {
    const colors = [makeColor(0, 0.2, 0.6, 60), makeColor(180, 0.2, 0.6, 40)];
    const results = computeAllHarmonyScores(colors);
    assertEqual(results.length, 6, 'should return 6 harmony types');
  });

  it('sorted by score descending', () => {
    const colors = [makeColor(0, 0.2, 0.6, 60), makeColor(180, 0.2, 0.6, 40)];
    const results = computeAllHarmonyScores(colors);
    for (let i = 1; i < results.length; i++) {
      assert(results[i - 1].score >= results[i].score, 'not sorted by score');
    }
  });

  it('perfectly complementary colors (0° + 180°) → score 100', () => {
    // Both hues land inside ±15° sectors — inHarmony=100, outOfHarmony=0 → score=100
    const colors = [makeColor(0, 0.2, 0.6, 60), makeColor(180, 0.2, 0.6, 40)];
    const results = computeAllHarmonyScores(colors);
    const comp = results.find(r => r.type === 'complementary');
    assertEqual(comp.score, 100, `complementary score should be 100 for exact pair, got ${comp.score}`);
  });

  it('out-of-harmony color reduces score below 50 (penalty applied)', () => {
    // Two colors: 0° (50%) and 90° (50%) — for complementary root=0, 90° is outside ±15°
    // raw = (50 - 0.6×50) / 100 = 0.2 → score 20
    const colors = [makeColor(0, 0.2, 0.6, 50), makeColor(90, 0.2, 0.6, 50)];
    const results = computeAllHarmonyScores(colors);
    const comp = results.find(r => r.type === 'complementary');
    assert(comp.score < 50, `penalty should drop score below 50, got ${comp.score}`);
  });

  it('each result has type, score, rotation, sectors, inHarmony, affecting', () => {
    const colors = [makeColor(0, 0.2, 0.6, 100)];
    const results = computeAllHarmonyScores(colors);
    const r = results[0];
    assert(typeof r.type === 'string',     'type should be string');
    assert(typeof r.score === 'number',    'score should be number');
    assert(typeof r.rotation === 'number', 'rotation should be number');
    assert(Array.isArray(r.sectors),       'sectors should be array');
    assert(Array.isArray(r.inHarmony),     'inHarmony should be array');
    assert(Array.isArray(r.affecting),     'affecting should be array');
  });

  it('affecting colors have degreesOff property', () => {
    const colors = [makeColor(0, 0.2, 0.6, 100)];
    const results = computeAllHarmonyScores(colors);
    results.forEach(r => {
      r.affecting.forEach(c => {
        assert(typeof c.degreesOff === 'number', `degreesOff should be number, got ${typeof c.degreesOff}`);
      });
    });
  });

  it('neutral colors excluded from inHarmony and affecting', () => {
    const colors = [makeColor(0, 0.2, 0.6, 70), makeColor(0, 0.02, 0.9, 30)]; // neutral C=0.02
    const results = computeAllHarmonyScores(colors);
    results.forEach(r => {
      const all = [...r.inHarmony, ...r.affecting];
      assert(!all.some(c => c.isNeutral), 'neutral should not appear in inHarmony or affecting');
    });
  });

  it('all-neutral input → returns 6 results all with score 0', () => {
    const colors = [makeColor(0, 0.02, 0.9, 100)]; // C=0.02 → isNeutral=true
    const results = computeAllHarmonyScores(colors);
    assertEqual(results.length, 6, 'should still return 6 types');
    results.forEach(r => {
      assertEqual(r.score, 0, `score should be 0 for all-neutral, got ${r.score} for ${r.type}`);
      assertEqual(r.inHarmony.length, 0, 'inHarmony should be empty');
      assertEqual(r.affecting.length, 0, 'affecting should be empty');
    });
  });

  it('degreesOff correct — hue 90° outside complementary ±15° sectors', () => {
    // Complementary at 0°/180° (half-width 15°). Hue 90° is 90° from 0° sector:
    // degreesOff = _hueDeg(90, 0) - 15 = 90 - 15 = 75
    const colors = [
      makeColor(0,   0.2, 0.6, 50),
      makeColor(180, 0.2, 0.6, 30),
      makeColor(90,  0.2, 0.6, 20),
    ];
    const results = computeAllHarmonyScores(colors);
    const comp = results.find(r => r.type === 'complementary');
    const h90 = comp.affecting.find(c => c.oklch.h === 90);
    assert(h90, 'hue 90 should be in affecting');
    assertEqual(h90.degreesOff, 75, `degreesOff for hue 90 vs complementary should be 75, got ${h90.degreesOff}`);
  });
});
```

- [ ] **Step 2.2: Open `tests/runner.html` — verify all `computeAllHarmonyScores` tests pass**

Expected: all 8 rows green ✓. Pay special attention to:
- `out-of-harmony color reduces score below 50` — confirms the penalty formula
- `degreesOff correct` — confirms smaller sector (±15° not ±30°) was used in calculation

- [ ] **Step 2.3: Commit**

```bash
git add tests/editor/color-wheel-analysis.test.js
git commit -m "test: update computeAllHarmonyScores tests for OKLCH + penalty scoring

Updates makeColor helper to OKLCH shape, adds penalty verification test,
corrects degreesOff expected value for new ±15° sector half-width.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: generateInsights Tests

**Files:**
- Modify: `tests/editor/color-wheel-analysis.test.js` (add `generateInsights` block)

> The implementation is already in place from Task 1. This task writes tests for it.

- [ ] **Step 3.1: Append `generateInsights` tests to the test file**

Add after the `computeAllHarmonyScores` block (before the `computeAffectingOverlay` import line):

```javascript
import { generateInsights } from '../../editor/color-wheel-analysis.js';

describe('generateInsights', () => {
  it('all-neutral input → single no-color insight', () => {
    const neutral = [{ hex: '#808080', oklch: { L: 0.5, C: 0.01, h: 0 }, canvasPct: 100, isNeutral: true }];
    const fakeResults = [];
    const insights = generateInsights(fakeResults, neutral);
    assertEqual(insights.length, 1, 'should return exactly 1 insight for no-chroma canvas');
    assert(insights[0].label === 'No color detected', 'label should be No color detected');
  });

  it('returns array of insight objects with label and text', () => {
    const colors = [
      { hex: '#ff0000', oklch: { L: 0.6, C: 0.25, h: 29 }, canvasPct: 60, isNeutral: false },
      { hex: '#00ff00', oklch: { L: 0.9, C: 0.29, h: 143 }, canvasPct: 40, isNeutral: false },
    ];
    const results = computeAllHarmonyScores(colors);
    const insights = generateInsights(results, colors);
    assert(Array.isArray(insights), 'insights should be array');
    assert(insights.length >= 2, 'should return at least 2 insights');
    insights.forEach(ins => {
      assert(typeof ins.label === 'string', 'each insight should have label');
      assert(typeof ins.text  === 'string', 'each insight should have text');
    });
  });

  it('offender insight present when affecting colors exist', () => {
    // Three colors: two complementary + one conflict
    const colors = [
      { hex: '#f00', oklch: { L: 0.6, C: 0.25, h: 0   }, canvasPct: 40, isNeutral: false },
      { hex: '#0f0', oklch: { L: 0.9, C: 0.29, h: 180 }, canvasPct: 40, isNeutral: false },
      { hex: '#ff0', oklch: { L: 0.9, C: 0.20, h: 90  }, canvasPct: 20, isNeutral: false },
    ];
    const results = computeAllHarmonyScores(colors);
    const insights = generateInsights(results, colors);
    const conflict = insights.find(i => i.label === 'Main conflict');
    assert(conflict, 'Main conflict insight should exist');
    assert(typeof conflict.text === 'string' && conflict.text.length > 0, 'conflict insight should have text');
  });

  it('neutral-heavy insight shown when neutralPct > 70', () => {
    const colors = [
      { hex: '#808080', oklch: { L: 0.5, C: 0.01, h: 0 }, canvasPct: 80, isNeutral: true },
      { hex: '#ff0000', oklch: { L: 0.6, C: 0.25, h: 29 }, canvasPct: 20, isNeutral: false },
    ];
    const results = computeAllHarmonyScores(colors);
    const insights = generateInsights(results, colors);
    const neutralNote = insights.find(i => i.label === 'Neutral heavy');
    assert(neutralNote, 'Neutral heavy insight should appear when neutralPct > 70');
  });

  it('suggestion insight always present', () => {
    const colors = [
      { hex: '#ff0000', oklch: { L: 0.6, C: 0.25, h: 29 }, canvasPct: 100, isNeutral: false },
    ];
    const results = computeAllHarmonyScores(colors);
    const insights = generateInsights(results, colors);
    const suggestion = insights.find(i => i.label === 'Suggestion');
    assert(suggestion, 'Suggestion insight should always be present');
    assert(suggestion.text.length > 0, 'Suggestion should have non-empty text');
  });
});
```

- [ ] **Step 3.2: Open `tests/runner.html` — verify all `generateInsights` tests pass**

Expected: 5 green ✓ rows in the `generateInsights` section.

- [ ] **Step 3.3: Commit**

```bash
git add tests/editor/color-wheel-analysis.test.js
git commit -m "test: add generateInsights test suite

Covers all-neutral, offender detection, neutral-heavy condition,
and always-present suggestion insight.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update computeAffectingOverlay Tests

**Files:**
- Modify: `tests/editor/color-wheel-analysis.test.js` (update overlay block for OKLCH neutral detection)

> Implementation already in place. Tests need comment updates and one new neutral-detection test.

- [ ] **Step 4.1: Replace the `computeAffectingOverlay` block**

Replace the existing `computeAffectingOverlay` describe block with:

```javascript
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

  it('pixel in harmony zone → copied unchanged (pure red, sector at 0°±30°)', () => {
    // Pure red: OKLCH h ≈ 29° — inside sector [0°±30°]
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
    // Pure green: OKLCH h ≈ 142° — outside sector [0°±30°]
    const data = new Uint8ClampedArray([0, 255, 0, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 0, halfWidth: 30 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 239, 'R should be 239 (red tint)');
    assertEqual(out[1], 68,  'G should be 68 (red tint)');
    assertEqual(out[2], 68,  'B should be 68 (red tint)');
    assertEqual(out[3], 128, 'A should be 128 (50% opacity)');
  });

  it('neutral pixel (OKLCH C < 0.04) → copied unchanged regardless of sectors', () => {
    // Pure white: OKLCH C ≈ 0 → neutral — passes through even with unmatched sector
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 120, halfWidth: 15 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 255, 'neutral pixel R unchanged');
    assertEqual(out[1], 255, 'neutral pixel G unchanged');
    assertEqual(out[2], 255, 'neutral pixel B unchanged');
    assertEqual(out[3], 255, 'neutral pixel A unchanged');
  });

  it('mid-gray pixel (near-neutral) → copied unchanged', () => {
    // rgb(128,128,128): OKLCH C ≈ 0 → treated as neutral
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    const imageData = new ImageData(data, 1, 1);
    const sectors = [{ centerHue: 200, halfWidth: 15 }];
    const out = computeAffectingOverlay(imageData, sectors);
    assertEqual(out[0], 128, 'gray pixel R unchanged');
    assertEqual(out[1], 128, 'gray pixel G unchanged');
    assertEqual(out[2], 128, 'gray pixel B unchanged');
  });
});
```

- [ ] **Step 4.2: Open `tests/runner.html` — verify all overlay tests pass**

Expected: 5 green ✓ rows in `computeAffectingOverlay`. If `mid-gray pixel` fails (gray has non-zero OKLCH C), adjust the sector halfWidth to something that matches or pick a more achromatic test color like `[200,200,200]`.

- [ ] **Step 4.3: Commit**

```bash
git add tests/editor/color-wheel-analysis.test.js
git commit -m "test: update computeAffectingOverlay tests for OKLCH neutral detection

Updates comments to reflect C < 0.04 threshold. Adds mid-gray test.
Pixel values unchanged — red/green/white behaviour is identical under OKLCH.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Update color-wheel-panel.js

**Files:**
- Modify: `ui/color-wheel-panel.js`

No automated tests for this task — verify visually by opening the app.

- [ ] **Step 5.1: Update the import line**

Change line 1–7:

```javascript
// ui/color-wheel-panel.js
import { events }                    from '../core/events.js';
import {
  extractDominantColors,
  computeAllHarmonyScores,
  computeAffectingOverlay,
  generateInsights,
} from '../editor/color-wheel-analysis.js';
```

- [ ] **Step 5.2: Add `_scoreColor` helper and extend state fields**

After `const ANALYSIS_EVENTS = [...]` line (line 9), add:

```javascript
// Returns score badge color for 4-level scale
function _scoreColor(score) {
  if (score >= 80) return '#4ade80';
  if (score >= 55) return '#facc15';
  if (score >= 30) return '#fb923c';
  return '#f87171';
}
```

In the `constructor`, add three new fields after `this._neutralColors = []`:

```javascript
this._insights     = null;   // insight[] from last generateInsights call
this._allNeutral   = false;  // true when chromaticPct === 0
this._lowConfidence = false; // true when chromaticPct < 5
```

- [ ] **Step 5.3: Update `_runAnalysis` to call `generateInsights` and set flags**

Replace the try block in `_runAnalysis` (lines 67–76):

```javascript
    try {
      const ctx       = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dominant  = extractDominantColors(imageData);
      this._neutralColors = dominant.filter(c => c.isNeutral);
      this._results   = computeAllHarmonyScores(dominant);
      this._insights  = generateInsights(this._results, dominant);
      const chromaticPct = dominant.filter(c => !c.isNeutral).reduce((s, c) => s + c.canvasPct, 0);
      this._allNeutral    = chromaticPct === 0;
      this._lowConfidence = chromaticPct > 0 && chromaticPct < 5;
      // Clamp active index in case result set changed
      this._activeIdx = Math.min(this._activeIdx, this._results.length - 1);
      this._render();
      if (this._overlayOn) this._applyOverlay(imageData);
    } catch (e) {
      console.warn('[ColorWheelPanel] analysis failed:', e);
    }
```

- [ ] **Step 5.4: Update `_harmonyRow` — 4-level score colors + `~`/`—` prefix**

Replace the `_harmonyRow` method (lines 150–164):

```javascript
  _harmonyRow(result, idx) {
    const isActive   = idx === this._activeIdx;
    const scoreColor = _scoreColor(result.score);
    const label      = result.type.charAt(0).toUpperCase() + result.type.slice(1);
    const barPct     = result.score;
    const scoreLabel = this._allNeutral    ? '—'
                     : this._lowConfidence ? `~${result.score}%`
                     :                      `${result.score}%`;
    const bg = isActive
      ? 'background:var(--color-surface-2);border-left:2px solid var(--color-accent);'
      : 'background:none;border-left:2px solid transparent;';
    return `
      <div data-action="set-harmony" data-idx="${idx}" style="${bg}display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:3px;margin-bottom:2px;">
        <span style="flex:1;font-size:11px;color:${isActive ? 'var(--color-text)' : 'var(--color-text-muted)'};">${label}</span>
        <span style="font-size:11px;font-weight:700;color:${scoreColor};width:36px;text-align:right;">${scoreLabel}</span>
        <div style="width:36px;background:var(--color-border);border-radius:2px;height:4px;overflow:hidden;">
          <div style="width:${barPct}%;background:${scoreColor};height:100%;border-radius:2px;"></div>
        </div>
      </div>`;
  }
```

- [ ] **Step 5.5: Update `_buildWheel` — OKLCH dot positions, dashed arcs, pulsing ring**

Replace the `_buildWheel` method (lines 166–214):

```javascript
  _buildWheel(active) {
    const CX = 90, CY = 90, OR = 82, IR = 58, MR = 70;

    // Dominant offender: highest canvasPct in affecting (gets pulsing ring)
    const offender = active.affecting.length
      ? active.affecting.reduce((a, b) => a.canvasPct >= b.canvasPct ? a : b)
      : null;

    // 12 hue ring segments (unchanged)
    const segments = HUE_RING_COLORS.map((color, i) => {
      const startDeg = i * 30 - 15 - 90;
      const endDeg   = i * 30 + 15 - 90;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 0,1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 0,0 ${ix1},${iy1} Z" fill="${color}" opacity="0.75"/>`;
    }).join('');

    const centerFill = `<circle cx="${CX}" cy="${CY}" r="${IR - 1}" fill="var(--color-surface,#1a1a1a)"/>`;

    // Harmony sectors — dashed stroke when score < 55 (weak fit signal)
    const isDashed = active.score < 55;
    const sectorPaths = active.sectors.map(({ centerHue, halfWidth }) => {
      const startDeg = centerHue - halfWidth - 90;
      const endDeg   = centerHue + halfWidth - 90;
      const largeArc = halfWidth * 2 > 180 ? 1 : 0;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      const dashattr = isDashed ? 'stroke-dasharray="4,3"' : '';
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 ${largeArc},1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 ${largeArc},0 ${ix1},${iy1} Z" fill="rgba(96,165,250,0.18)" stroke="rgba(96,165,250,0.65)" stroke-width="1.5" ${dashattr}/>`;
    }).join('');

    // Color dots — angle from OKLCH hue, pulsing ring for dominant offender
    const allChromatic = [...active.inHarmony, ...active.affecting];
    let pulsingRings = '';
    const dots = allChromatic.map(c => {
      const angle = c.oklch.h - 90;
      const [x, y] = _polar(CX, CY, MR, angle);
      const r          = Math.min(10, 4 + Math.round(c.canvasPct / 8));
      const isAffecting = active.affecting.some(a => a.hex === c.hex);
      const stroke      = isAffecting ? '#ef4444' : '#ffffff';
      const dashattr    = isAffecting ? 'stroke-dasharray="3,2"' : '';

      if (offender && c.hex === offender.hex) {
        pulsingRings += `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="#ef4444" stroke-width="1.5">
          <animate attributeName="r" values="${r + 3};${r + 7};${r + 3}" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.5s" repeatCount="indefinite"/>
        </circle>`;
      }

      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.hex}" stroke="${stroke}" stroke-width="2" ${dashattr}/>`;
    }).join('');

    const typeLabel    = active.type.charAt(0).toUpperCase() + active.type.slice(1);
    const scoreDisplay = this._allNeutral    ? '—'
                       : this._lowConfidence ? `~${active.score}%`
                       :                      `${active.score}%`;
    const center = `
      <text x="${CX}" y="${CY - 6}" text-anchor="middle" fill="var(--color-text-muted,#9ca3af)" font-size="11" font-family="var(--font-sans,sans-serif)">${typeLabel}</text>
      <text x="${CX}" y="${CY + 10}" text-anchor="middle" fill="${_scoreColor(active.score)}" font-size="15" font-weight="bold" font-family="var(--font-sans,sans-serif)">${scoreDisplay}</text>`;

    return `<svg width="180" height="180" viewBox="0 0 180 180" style="display:block;overflow:visible;">${segments}${centerFill}${sectorPaths}${pulsingRings}${dots}${center}</svg>`;
  }
```

- [ ] **Step 5.6: Add `_renderInsights` method and wire it into `_render`**

Add a new method after `_colorSection` (after line 240):

```javascript
  _renderInsights(insights) {
    if (!insights || !insights.length) return '';
    const items = insights.map(ins => `
      <div style="margin-bottom:8px;">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:2px;">${ins.label.toUpperCase()}</div>
        <div style="font-size:11px;color:var(--color-text);line-height:1.5;">${ins.text}</div>
      </div>`).join('');
    return `
      <div style="padding:8px 10px 10px;border-top:1px solid var(--color-border);">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px;">INSIGHTS</div>
        ${items}
      </div>`;
  }
```

In the `_render` method, add `${this._renderInsights(this._insights)}` between the color sections div and the overlay toggle div. The end of the `this._el.innerHTML` template should look like:

```javascript
      <div style="padding:0 10px 10px;">
        ${this._colorSection('IN HARMONY', active.inHarmony, false)}
        ${active.affecting.length ? this._colorSection(`AFFECTING — ${active.affecting.reduce((s,c) => s+c.canvasPct,0)}%`, active.affecting, true) : ''}
        ${neutralColors.length ? this._colorSection(`NEUTRAL — ${neutralColors.reduce((s,c) => s+c.canvasPct,0)}%`, neutralColors, false, '#6b7280') : ''}
      </div>

      ${this._renderInsights(this._insights)}

      <div style="padding:6px 10px 10px;border-top:1px solid var(--color-border);">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--color-text-muted);">
          <input type="checkbox" data-action="toggle-overlay" ${this._overlayOn ? 'checked' : ''}>
          Show affecting on canvas
        </label>
      </div>
```

- [ ] **Step 5.7: Open the app and verify visually**

Open `index.html` in a browser. Load a project with photos. Open the Color Wheel panel. Verify:

1. **Score rows** — 4 colour levels: green ≥80%, yellow ≥55%, orange ≥30%, red <30%
2. **Sector arcs** — dashed when best score < 55%, solid when ≥55%
3. **Pulsing red ring** — the most-conflicting dot has an animated red ring
4. **Colour dots** — positioned by OKLCH hue (may shift slightly vs. old HSL positions for warm/cool colours)
5. **Insights panel** — appears below the colour sections, shows MAIN CONFLICT / BEST MATCH / SUGGESTION labels with explanatory text
6. **Score values** — previously-100% combinations now score significantly lower (confirming the fix)

- [ ] **Step 5.8: Commit**

```bash
git add ui/color-wheel-panel.js
git commit -m "feat: update color wheel panel for OKLCH, insights, and strict scoring UI

Adds 4-level score color scale, dashed sector arcs for weak fits,
OKLCH-based dot positioning, pulsing offender ring, and plain-language
insights panel. Imports generateInsights from analysis module.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| OKLCH conversion chain | Task 1 `_rgbToOklch`, `_oklchToHex` |
| Neutral filter C < 0.04 | Task 1 `extractDominantColors`, `computeAffectingOverlay` |
| K-means in OKLCH | Task 1 `_kmeansOklch`, `_oklchDist` |
| Tighter sector half-widths | Task 1 `HARMONY_DEFS` |
| Penalty scoring formula | Task 1 `_scoreRotation` |
| 4 score levels in UI | Task 5 `_scoreColor`, `_harmonyRow` |
| Dashed arcs when score < 55% | Task 5 `_buildWheel` |
| OKLCH hue for dot positions | Task 5 `_buildWheel` |
| Pulsing ring for dominant offender | Task 5 `_buildWheel` |
| Insights panel (4 insight types) | Task 1 `generateInsights`, Task 5 `_renderInsights` |
| `~` prefix when chromaticPct < 5% | Task 5 `_harmonyRow`, `_buildWheel` |
| `—` score when all-neutral | Task 5 `_harmonyRow`, `_buildWheel` |
| Single-cluster warning | Task 1 `generateInsights` |
