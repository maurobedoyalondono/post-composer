// tests/editor/drag-resize.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { computeResizedBounds } from '../../editor/drag-resize.js';

const orig = { x: 100, y: 100, width: 200, height: 100 };
const MIN = 10;

describe('computeResizedBounds — se handle (top-left fixed)', () => {
  it('grows bottom-right correctly', () => {
    const r = computeResizedBounds('se', orig, 350, 230, null, MIN);
    assertEqual(r.x, 100);
    assertEqual(r.y, 100);
    assertEqual(r.width, 250);
    assertEqual(r.height, 130);
  });

  it('applies aspect ratio: height follows width', () => {
    // ratio 2:1, mouse at x=300 → newW=200, newH=200/2=100
    const r = computeResizedBounds('se', orig, 300, 999, 2, MIN);
    assertEqual(r.x, 100);
    assertEqual(r.y, 100);
    assertEqual(r.width, 200);
    assertEqual(r.height, 100);
  });

  it('enforces minimum width', () => {
    const r = computeResizedBounds('se', orig, 101, 101, null, MIN);
    assert(r.width >= MIN, `width ${r.width} should be >= ${MIN}`);
    assert(r.height >= MIN, `height ${r.height} should be >= ${MIN}`);
  });
});

describe('computeResizedBounds — nw handle (bottom-right fixed)', () => {
  it('shrinks from top-left', () => {
    // fixed = (300, 200), mouse at (150, 150) → newW=150, newH=50
    const r = computeResizedBounds('nw', orig, 150, 150, null, MIN);
    assertEqual(r.x, 150);
    assertEqual(r.y, 150);
    assertEqual(r.width, 150);
    assertEqual(r.height, 50);
  });

  it('applies aspect ratio: height follows width', () => {
    // fixed=(300,200), ratio=2, mouse at x=200 → newW=100, newH=50
    const r = computeResizedBounds('nw', orig, 200, 999, 2, MIN);
    assertEqual(r.width, 100);
    assertEqual(r.height, 50);
    assertEqual(r.x, 200); // fixed(300) - newW(100)
    assertEqual(r.y, 150); // fixed(200) - newH(50)
  });
});

describe('computeResizedBounds — ne handle (bottom-left fixed)', () => {
  it('grows top-right correctly', () => {
    // fixed = (100, 200), mouse at (380, 80) → newW=280, newH=120
    const r = computeResizedBounds('ne', orig, 380, 80, null, MIN);
    assertEqual(r.x, 100);   // fixed left stays
    assertEqual(r.y, 80);    // fixed(200) - newH(120)
    assertEqual(r.width, 280);
    assertEqual(r.height, 120);
  });
});

describe('computeResizedBounds — sw handle (top-right fixed)', () => {
  it('grows bottom-left correctly', () => {
    // fixed = (300, 100), mouse at (50, 250) → newW=250, newH=150
    const r = computeResizedBounds('sw', orig, 50, 250, null, MIN);
    assertEqual(r.x, 50);    // fixed(300) - newW(250)
    assertEqual(r.y, 100);   // fixed top stays
    assertEqual(r.width, 250);
    assertEqual(r.height, 150);
  });
});
