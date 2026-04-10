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

  // Cube root — Math.cbrt handles negative values correctly (unlike Math.pow(x, 1/3)).
  // For sRGB gamut inputs, l/m/s are always non-negative, but Math.cbrt is safe either way.
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

// Perceptual distance: chroma-weighted hue + lightness component.
// Near-neutral samples (C near 0) collapse hue weight toward 0, which means
// very desaturated samples of different hues are treated as similar. This is
// intentional — for near-neutral pixels, hue is unreliable and lightness dominates.
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
      // Per-cluster rounding: displayed section totals may sum to 99 or 101 — this is expected.
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
  const typeLabel = best.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
  // chromatic is pre-sorted by canvasPct descending (from extractDominantColors),
  // so chromatic[0] is the dominant chromatic color.
  const h = chromatic[0].oklch.h;
  // OKLCH hue reference: red≈29°, orange≈55°, yellow≈110°, green≈142°, cyan≈195°, blue≈264°, violet≈308°, magenta≈330°
  if (h < 45 || h >= 340) return 'Your composition leans warm (red/orange).';
  if (h < 90)  return 'Your composition leans warm (yellow).';
  if (h < 145) return 'Your composition leans toward green.';
  if (h < 215) return 'Your composition leans cool (teal/cyan).';
  if (h < 280) return 'Your composition leans cool (blue).';
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
 * Note: runs _rgbToOklch on every pixel — more expensive than the old HSL path.
 * For large canvases, consider running this in a Worker if main-thread jank occurs.
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
