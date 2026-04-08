// tests/test-helper.js
let passed = 0;
let failed = 0;
let currentSuite = '';

export function describe(label, fn) {
  currentSuite = label;
  const section = document.createElement('div');
  section.style.cssText = 'margin:16px 0 8px;font-weight:700;font-size:15px;color:#a5b4fc;';
  section.textContent = label;
  document.getElementById('results').appendChild(section);
  fn();
}

export function it(label, fn) {
  const row = document.createElement('div');
  row.style.cssText = 'padding:3px 0 3px 16px;font-size:13px;';
  try {
    fn();
    passed++;
    row.style.color = '#10b981';
    row.textContent = `✓ ${label}`;
  } catch (e) {
    failed++;
    row.style.color = '#ef4444';
    row.textContent = `✗ ${label}: ${e.message}`;
  }
  document.getElementById('results').appendChild(row);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'assertion failed');
}

export function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export function assertDeepEqual(a, b, message) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(message ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export function assertThrows(fn, message) {
  try { fn(); throw new Error('expected throw but did not throw'); }
  catch (e) { if (e.message === 'expected throw but did not throw') throw e; }
}

export function summary() {
  const el = document.createElement('div');
  el.style.cssText = `margin-top:24px;padding:12px;border-radius:6px;font-weight:700;font-size:14px;background:${failed === 0 ? '#0f2d14' : '#2d0f14'};color:${failed === 0 ? '#4ade80' : '#f87171'};`;
  el.textContent = `${passed + failed} tests — ${passed} passed, ${failed} failed`;
  document.getElementById('results').appendChild(el);
}
