// tests/editor/layers-bounds.test.js
import { test, assert } from '../test-helper.js';
import { computeLayerBounds } from '../../editor/layers.js';

const W = 1000;
const H = 1000;

test('overlay fills full canvas', () => {
  const b = computeLayerBounds({ type: 'overlay' }, W, H);
  assert(b.x === 0,     `x should be 0, got ${b.x}`);
  assert(b.y === 0,     `y should be 0, got ${b.y}`);
  assert(b.width  === W, `width should be ${W}, got ${b.width}`);
  assert(b.height === H, `height should be ${H}, got ${b.height}`);
});

test('image layer with position and dimensions', () => {
  const layer = {
    type: 'image',
    position: { zone: 'top-left' },
    width_pct: 50,
    height_pct: 40,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 0,   `x should be 0, got ${b.x}`);
  assert(b.y === 0,   `y should be 0, got ${b.y}`);
  assert(b.width  === 500, `width should be 500, got ${b.width}`);
  assert(b.height === 400, `height should be 400, got ${b.height}`);
});

test('image layer defaults to full size when pct missing', () => {
  const b = computeLayerBounds({ type: 'image', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === W, `width should be ${W}, got ${b.width}`);
  assert(b.height === H, `height should be ${H}, got ${b.height}`);
});

test('logo layer with position and dimensions', () => {
  const layer = {
    type: 'logo',
    position: { zone: 'bottom-right' },
    width_pct: 10,
    height_pct: 10,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 1000, `x should be 1000, got ${b.x}`);
  assert(b.y === 1000, `y should be 1000, got ${b.y}`);
  assert(b.width  === 100, `width should be 100, got ${b.width}`);
  assert(b.height === 100, `height should be 100, got ${b.height}`);
});

test('shape layer with position', () => {
  const layer = {
    type: 'shape',
    shape: 'rect',
    position: { zone: 'middle-center' },
    width_pct: 20,
    height_pct: 5,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 500, `x should be 500, got ${b.x}`);
  assert(b.y === 500, `y should be 500, got ${b.y}`);
  assert(b.width  === 200, `width should be 200, got ${b.width}`);
  assert(b.height ===  50, `height should be 50, got ${b.height}`);
});

test('shape layer defaults when pct missing', () => {
  const b = computeLayerBounds({ type: 'shape', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === 200, `width default 20% should be 200, got ${b.width}`);
  assert(b.height ===  50, `height default 5% should be 50, got ${b.height}`);
});

test('text layer returns max_width_pct wide', () => {
  const layer = {
    type: 'text',
    content: 'Hello',
    font: { size_pct: 5, line_height: 1.25 },
    max_width_pct: 70,
    position: { zone: 'bottom-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 0,   `x should be 0, got ${b.x}`);
  assert(b.y === H,   `y should be ${H}, got ${b.y}`);
  assert(b.width === 700, `width should be 700, got ${b.width}`);
  // sizePx = 5% of 1000 = 50. lineH = 50 * 1.25 = 62.5. 2 lines → 125
  assert(b.height === 125, `height should be 125, got ${b.height}`);
});

test('text layer uses size_pct for height', () => {
  const layer = {
    type: 'text',
    content: 'Hello',
    font: { size_pct: 10, line_height: 1.25 },
    max_width_pct: 80,
    position: { zone: 'top-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  // sizePx = 10% of 1000 = 100. lineH = 100 * 1.25 = 125. 2 lines → 250
  assert(b.height === 250, `height should be 250, got ${b.height}`);
});

test('stats_block height based on stats count', () => {
  const layer = {
    type: 'stats_block',
    font: { size_pct: 4 },
    stats: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }],
    position: { zone: 'top-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  // sizePx = 4% of 1000 = 40. lineH = 40 * 1.6 = 64. 2 stats → 128
  assert(b.height === 128, `height should be 128, got ${b.height}`);
});

test('stats_block defaults to 1 row when stats missing', () => {
  const b = computeLayerBounds({ type: 'stats_block', position: { zone: 'top-left' } }, W, H);
  // sizePx = 4% of 1000 = 40. lineH = 64. 1 row → 64
  assert(b.height === 64, `height should be 64, got ${b.height}`);
});

test('stats_block width is 40% of canvas width', () => {
  const layer = {
    type: 'stats_block',
    font: { size_pct: 4 },
    stats: [{ label: 'A', value: '1' }],
    position: { zone: 'top-left' },
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.width === W * 0.4, `width should be ${W * 0.4}, got ${b.width}`);
});

test('logo layer defaults to 10%/10% when pct missing', () => {
  const b = computeLayerBounds({ type: 'logo', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === 100, `width should be 100, got ${b.width}`);
  assert(b.height === 100, `height should be 100, got ${b.height}`);
});

test('absolute position is respected', () => {
  const layer = {
    type: 'image',
    position: { zone: 'absolute', x_pct: 25, y_pct: 30 },
    width_pct: 20,
    height_pct: 20,
  };
  const b = computeLayerBounds(layer, W, H);
  assert(b.x === 250, `x should be 250, got ${b.x}`);
  assert(b.y === 300, `y should be 300, got ${b.y}`);
});

test('unknown layer type returns zero-size bounds at position', () => {
  const b = computeLayerBounds({ type: 'unknown', position: { zone: 'top-left' } }, W, H);
  assert(b.width  === 0, `width should be 0, got ${b.width}`);
  assert(b.height === 0, `height should be 0, got ${b.height}`);
});
