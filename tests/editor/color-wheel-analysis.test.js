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
