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
    assertEqual(comp.score, 100, `complementary score should be 100 for exact complementary pair, got ${comp.score}`);
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

  it('all-neutral input → returns 6 results all with score 0', () => {
    const colors = [makeColor(0, 5, 90, 100)]; // isNeutral=true (s < 10)
    const results = computeAllHarmonyScores(colors);
    assertEqual(results.length, 6, 'should still return 6 types');
    results.forEach(r => {
      assertEqual(r.score, 0, `score should be 0 for all-neutral input, got ${r.score} for ${r.type}`);
      assertEqual(r.inHarmony.length, 0, 'inHarmony should be empty for all-neutral');
      assertEqual(r.affecting.length, 0, 'affecting should be empty for all-neutral');
    });
  });

  it('degreesOff is correct — color 90° off a complementary pair has degreesOff > 0', () => {
    // Hues 0, 180 (complementary) + hue 90 (outside all sectors when comp is at 0/180)
    const colors = [
      makeColor(0, 80, 50, 50),
      makeColor(180, 80, 50, 30),
      makeColor(90, 80, 50, 20),  // 60° away from nearest sector boundary (90-30=60)
    ];
    const results = computeAllHarmonyScores(colors);
    const comp = results.find(r => r.type === 'complementary');
    const affecting = comp.affecting;
    assert(affecting.length > 0, 'should have at least one affecting color');
    affecting.forEach(c => {
      assert(c.degreesOff > 0, `degreesOff should be > 0 for out-of-sector color, got ${c.degreesOff}`);
      assert(typeof c.degreesOff === 'number', 'degreesOff should be a number');
    });
  });
});
