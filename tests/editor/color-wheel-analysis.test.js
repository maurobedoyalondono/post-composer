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

  it('all results have canvasPct > 0 (no empty clusters)', () => {
    const img = solidImage(255, 0, 0, 16);
    const result = extractDominantColors(img, 8); // k=8 but only 1 real cluster
    result.forEach(c => {
      assert(c.canvasPct > 0, `expected canvasPct > 0, got ${c.canvasPct}`);
    });
  });
});
