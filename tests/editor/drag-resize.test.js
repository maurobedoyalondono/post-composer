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

  it('applies aspect ratio: height follows clamped width', () => {
    // fixed=(300,100), ratio=2, mouse at x=200 → newW=100, newH=50
    const r = computeResizedBounds('sw', orig, 200, 999, 2, MIN);
    assertEqual(r.width, 100);
    assertEqual(r.height, 50);
    assertEqual(r.x, 200); // fixed(300) - newW(100)
    assertEqual(r.y, 100); // fixed top stays
  });
});

describe('computeResizedBounds — aspect ratio + minimum size interaction', () => {
  it('height follows clamped width when mouse is at fixed corner (aspect locked)', () => {
    // Mouse at fixed corner → raw newW ~0 → clamped to MIN=10, newH must be 10/ratio not floored independently
    // ratio=4, so newH should be 10/4=2.5, not 10 (which would break the ratio)
    const r = computeResizedBounds('se', orig, 101, 101, 4, MIN);
    assertEqual(r.width, MIN);
    // height = MIN / ratio = 10 / 4 = 2.5 — follows ratio from clamped width
    assertEqual(r.height, MIN / 4);
  });
});

import { rotatePoint, computeRotationHandlePoint } from '../../editor/drag-resize.js';

describe('rotatePoint', () => {
  it('0° rotation returns original point', () => {
    const r = rotatePoint(100, 50, 0, 0, 0);
    assert(Math.abs(r.x - 100) < 0.001, `x should be ~100, got ${r.x}`);
    assert(Math.abs(r.y -  50) < 0.001, `y should be ~50, got ${r.y}`);
  });

  it('90° clockwise around origin: (1,0) → (0,1) in canvas coords', () => {
    const r = rotatePoint(1, 0, 0, 0, 90);
    assert(Math.abs(r.x - 0) < 0.001, `x should be ~0, got ${r.x}`);
    assert(Math.abs(r.y - 1) < 0.001, `y should be ~1, got ${r.y}`);
  });

  it('180° around center returns opposite point', () => {
    const r = rotatePoint(200, 100, 100, 100, 180);
    assert(Math.abs(r.x -   0) < 0.001, `x should be ~0, got ${r.x}`);
    assert(Math.abs(r.y - 100) < 0.001, `y should be ~100, got ${r.y}`);
  });

  it('inverse rotation returns original point', () => {
    const p = rotatePoint(150, 80, 100, 100, 45);
    const back = rotatePoint(p.x, p.y, 100, 100, -45);
    assert(Math.abs(back.x - 150) < 0.001, `x should be ~150, got ${back.x}`);
    assert(Math.abs(back.y -  80) < 0.001, `y should be ~80, got ${back.y}`);
  });
});

describe('computeRotationHandlePoint', () => {
  const bounds = { x: 0, y: 100, width: 200, height: 100 };
  // center = (100, 150), unrotated handle = (100, 76) [100-24=76]

  it('0° — handle is directly above top-center', () => {
    const hp = computeRotationHandlePoint(bounds, 0);
    assert(Math.abs(hp.x - 100) < 0.001, `x should be ~100, got ${hp.x}`);
    assert(Math.abs(hp.y -  76) < 0.001, `y should be ~76, got ${hp.y}`);
  });

  it('90° — handle moves from above to the right of center', () => {
    // dx=0, dy=76-150=-74; rotated 90°: x'=100+0-(-74)*1=174, y'=150+0*1+(-74)*0=150
    const hp = computeRotationHandlePoint(bounds, 90);
    assert(Math.abs(hp.x - 174) < 0.001, `x should be ~174, got ${hp.x}`);
    assert(Math.abs(hp.y - 150) < 0.001, `y should be ~150, got ${hp.y}`);
  });
});
