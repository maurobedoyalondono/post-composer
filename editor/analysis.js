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
    // Saturation computed in linear-light space (approximation — perceptually
    // equivalent to sRGB HSV saturation for fully-saturated colours, slightly
    // distorted for mid-range colours, which is acceptable for a weight heatmap).
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
 * Rendering helper — covered by integration tests, not unit tests.
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
 * @note Contrast is measured against white only. Accurate for text on light or
 *       mid-tone backgrounds; will overstate contrast for text on dark backgrounds.
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
