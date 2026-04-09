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
  const sampleStep = 4;

  const samples = [];
  for (let i = 0; i < totalPixels; i += sampleStep) {
    samples.push(_rgbToHsl(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  }
  if (samples.length === 0) return [];

  const { centroids, assignments } = _kmeansHSL(samples, k);
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]]++;

  return centroids
    .map((hsl, j) => ({ hsl, j, count: counts[j] }))
    .filter(({ count }) => count > 0)
    .map(({ hsl, j }) => {
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

// _inSectors operates on resolved sectors: { centerHue, halfWidth }
// (produced by computeAllHarmonyScores after finding bestRotation)
// _scoreRotation operates on definition sectors: { offset, halfWidth }
// (from HARMONY_DEFS, relative to rootHue)
// The two different shapes are intentional: _scoreRotation inlines the math
// for performance (called 2160 times), while _inSectors uses resolved sectors
// to classify the final inHarmony/affecting lists (called ≤8 times).
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
 * @returns {Array<{type:string,score:number,rotation:number,sectors:Array<{centerHue:number,halfWidth:number}>,inHarmony:object[],affecting:Array<{hex:string,hsl:object,canvasPct:number,isNeutral:boolean,degreesOff:number}>}>}
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
