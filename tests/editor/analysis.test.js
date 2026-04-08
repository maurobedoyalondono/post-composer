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
