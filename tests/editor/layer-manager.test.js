// tests/editor/layer-manager.test.js
import { test, assert } from '../test-helper.js';
import { AppState } from '../../core/state.js';
import { LayerManager } from '../../editor/layer-manager.js';
import { events } from '../../core/events.js';

function makeState() {
  const s = new AppState();
  s.setProject({
    project: { id: 'test', title: 'Test' },
    export: { target: 'instagram-square', width_px: 1080, height_px: 1080 },
    design_tokens: {
      palette: { background: '#000000', primary: '#ffffff', accent: '#6366f1', neutral: '#6b7280' },
      type_scale: {
        display: { family: 'sans-serif', steps: [48] },
        body:    { family: 'sans-serif', steps: [16] },
        data:    { family: 'sans-serif', steps: [12] },
      },
      spacing_scale: [8, 16, 24, 32],
    },
    variety_contract: {
      zone_max_usage_pct: 60,
      shape_quota: { min_per_n_frames: 3, waiver: true },
      overlay_strategies: ['gradient'],
      silence_map: [],
      composition_patterns: {},
    },
    frames: [
      {
        id: 'frame-01',
        image_src: '',
        image_filename: 'img.jpg',
        composition_pattern: 'full-bleed',
        layers: [
          { id: 'layer-a', type: 'text', content: 'Hello', font: { size_pct: 5 }, max_width_pct: 80, position: { zone: 'top-left' } },
          { id: 'layer-b', type: 'shape', shape: 'rect', role: 'divider', position: { zone: 'bottom-left' } },
        ],
      },
    ],
  });
  return s;
}

test('selectLayer sets selectedLayerId on state', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  assert(state.selectedLayerId === 'layer-a', `expected layer-a, got ${state.selectedLayerId}`);
});

test('selectLayer(null) clears selectedLayerId', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  lm.selectLayer(null);
  assert(state.selectedLayerId === null, `expected null, got ${state.selectedLayerId}`);
});

test('selectLayer dispatches layer:selected event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let received = null;
  events.addEventListener('layer:selected', e => { received = e.detail.id; }, { once: true });
  lm.selectLayer('layer-b');
  assert(received === 'layer-b', `expected layer-b, got ${received}`);
});

test('updateLayer patches a layer in project JSON', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.updateLayer(0, 'layer-a', { content: 'Updated' });
  const layer = state.project.frames[0].layers.find(l => l.id === 'layer-a');
  assert(layer.content === 'Updated', `expected Updated, got ${layer.content}`);
});

test('updateLayer dispatches layer:changed event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let fired = false;
  events.addEventListener('layer:changed', () => { fired = true; }, { once: true });
  lm.updateLayer(0, 'layer-a', { content: 'X' });
  assert(fired, 'layer:changed should have fired');
});

test('updateLayer is a no-op for unknown layer id', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.updateLayer(0, 'no-such-layer', { content: 'X' });
  assert(state.project.frames[0].layers.length === 2, 'layer count unchanged');
});

test('deleteLayer removes layer from frame', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.deleteLayer(0, 'layer-a');
  const ids = state.project.frames[0].layers.map(l => l.id);
  assert(!ids.includes('layer-a'), 'layer-a should be removed');
  assert(ids.includes('layer-b'), 'layer-b should remain');
});

test('deleteLayer clears selectedLayerId if deleted layer was selected', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.selectLayer('layer-a');
  lm.deleteLayer(0, 'layer-a');
  assert(state.selectedLayerId === null, `selectedLayerId should be null, got ${state.selectedLayerId}`);
});

test('deleteLayer dispatches layer:deleted event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let fired = false;
  events.addEventListener('layer:deleted', () => { fired = true; }, { once: true });
  lm.deleteLayer(0, 'layer-a');
  assert(fired, 'layer:deleted should have fired');
});

test('toggleVisibility flips layer.hidden', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.toggleVisibility(0, 'layer-a');
  const layer = state.project.frames[0].layers.find(l => l.id === 'layer-a');
  assert(layer.hidden === true, `expected true, got ${layer.hidden}`);
  lm.toggleVisibility(0, 'layer-a');
  assert(layer.hidden === false, `expected false, got ${layer.hidden}`);
});

test('reorderLayer moves layer from one index to another', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  lm.reorderLayer(0, 0, 1);
  const ids = state.project.frames[0].layers.map(l => l.id);
  assert(ids[0] === 'layer-b', `expected layer-b first, got ${ids[0]}`);
  assert(ids[1] === 'layer-a', `expected layer-a second, got ${ids[1]}`);
});

test('emitChanged dispatches layer:changed event', () => {
  const state = makeState();
  const lm = new LayerManager(state);
  let detail = null;
  events.addEventListener('layer:changed', e => { detail = e.detail; }, { once: true });
  lm.emitChanged(0, 'layer-a');
  assert(detail?.frameIndex === 0, `expected frameIndex 0, got ${detail?.frameIndex}`);
  assert(detail?.layerId === 'layer-a', `expected layer-a, got ${detail?.layerId}`);
});
