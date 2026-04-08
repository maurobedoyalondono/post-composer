import { describe, it, assertEqual } from '../test-helper.js';
import { resolvePosition, computeTextBounds } from '../../editor/layers.js';

describe('resolvePosition', () => {
  it('top-left with no offset → {x:0, y:0}', () => {
    const r = resolvePosition({ zone: 'top-left' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });

  it('top-center → {x:500, y:0}', () => {
    const r = resolvePosition({ zone: 'top-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 0);
  });

  it('top-right → {x:1000, y:0}', () => {
    const r = resolvePosition({ zone: 'top-right' }, 1000, 500);
    assertEqual(r.x, 1000);
    assertEqual(r.y, 0);
  });

  it('middle-left → {x:0, y:250}', () => {
    const r = resolvePosition({ zone: 'middle-left' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 250);
  });

  it('middle-center → {x:500, y:250}', () => {
    const r = resolvePosition({ zone: 'middle-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 250);
  });

  it('bottom-right → {x:1000, y:500}', () => {
    const r = resolvePosition({ zone: 'bottom-right' }, 1000, 500);
    assertEqual(r.x, 1000);
    assertEqual(r.y, 500);
  });

  it('bottom-center → {x:500, y:500}', () => {
    const r = resolvePosition({ zone: 'bottom-center' }, 1000, 500);
    assertEqual(r.x, 500);
    assertEqual(r.y, 500);
  });

  it('applies offset_x_pct and offset_y_pct', () => {
    const r = resolvePosition({ zone: 'top-left', offset_x_pct: 10, offset_y_pct: 20 }, 1000, 500);
    assertEqual(r.x, 100); // 10% of 1000
    assertEqual(r.y, 100); // 20% of 500
  });

  it('absolute zone uses x_pct and y_pct directly', () => {
    const r = resolvePosition({ zone: 'absolute', x_pct: 25, y_pct: 50 }, 1000, 500);
    assertEqual(r.x, 250);
    assertEqual(r.y, 250);
  });

  it('null position → {x:0, y:0}', () => {
    const r = resolvePosition(null, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });

  it('unknown zone falls back to top-left', () => {
    const r = resolvePosition({ zone: 'garbage' }, 1000, 500);
    assertEqual(r.x, 0);
    assertEqual(r.y, 0);
  });
});

describe('computeTextBounds', () => {
  it('returns positive width and height for a text layer', () => {
    const canvas = document.createElement('canvas');
    canvas.width  = 1000;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    const layer = {
      content: 'Hello world',
      font: { family: 'sans-serif', size_pct: 5, weight: 400 },
      max_width_pct: 60,
    };
    const bounds = computeTextBounds(ctx, layer, 1000, 500);
    assertEqual(bounds.width > 0, true);
    assertEqual(bounds.height > 0, true);
  });

  it('uses default size_pct 5 and max_width_pct 80 when font is minimal', () => {
    const canvas = document.createElement('canvas');
    canvas.width  = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const layer = { content: 'Test', font: {} };
    const bounds = computeTextBounds(ctx, layer, 1000, 1000);
    // sizePx = 5% of 1000 = 50; maxW = 80% of 1000 = 800
    assertEqual(bounds.width, 800);
    assertEqual(bounds.height >= 50, true);
  });
});
