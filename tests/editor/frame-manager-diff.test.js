// tests/editor/frame-manager-diff.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { FrameManager } from '../../editor/frame-manager.js';

function makeState(frames = []) {
  const proj = {
    project: { id: 'test', title: 'Test' },
    design_tokens: { palette: {} },
    export: { width_px: 1080, height_px: 1350, format: 'png' },
    frames,
    image_index: [],
  };
  return {
    project: proj,
    images: new Map(),
    activeFrameIndex: 0,
    selectedLayerId: null,
    get activeFrame() { return this.project.frames[this.activeFrameIndex] ?? null; },
    setProject(p) { this.project = p; this.activeFrameIndex = 0; this.selectedLayerId = null; },
  };
}

function makeFrame(id, overrides = {}) {
  return {
    id,
    label: id,
    composition_pattern: 'full-bleed',
    image_filename: 'photo.jpg',
    bg_color: '#000000',
    layers: [],
    ...overrides,
  };
}

function makeProject(frames) {
  return {
    project: { id: 'incoming', title: 'Incoming' },
    design_tokens: { palette: {} },
    export: { width_px: 1080, height_px: 1350, format: 'png' },
    frames,
    image_index: [],
  };
}

describe('FrameManager.diffProject', () => {
  it('unchanged frame when identical', () => {
    const frame = makeFrame('f1');
    const state = makeState([frame]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.unchanged.length, 1);
    assertEqual(diff.modified.length, 0);
    assertEqual(diff.added.length, 0);
    assertEqual(diff.removed.length, 0);
  });

  it('detects modified field (bg_color)', () => {
    const state = makeState([makeFrame('f1', { bg_color: '#000' })]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1', { bg_color: '#fff' })]));
    assertEqual(diff.modified.length, 1);
    assertEqual(diff.modified[0].frameId, 'f1');
    assert(diff.modified[0].changes.some(c => c.field === 'bg_color'));
  });

  it('detects added frame', () => {
    const state = makeState([makeFrame('f1')]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1'), makeFrame('f2')]));
    assertEqual(diff.added.length, 1);
    assertEqual(diff.added[0].frame.id, 'f2');
  });

  it('detects removed frame', () => {
    const state = makeState([makeFrame('f1'), makeFrame('f2')]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.removed.length, 1);
    assertEqual(diff.removed[0].frame.id, 'f2');
  });

  it('detects added layer in frame', () => {
    const state = makeState([makeFrame('f1', { layers: [] })]);
    const fm = new FrameManager(state);
    const incomingFrame = makeFrame('f1', { layers: [{ id: 'l1', type: 'text' }] });
    const diff = fm.diffProject(makeProject([incomingFrame]));
    assertEqual(diff.modified.length, 1);
    assert(diff.modified[0].changes.some(c => c.field === 'layer:added' && c.layerId === 'l1'));
  });

  it('detects removed layer in frame', () => {
    const state = makeState([makeFrame('f1', { layers: [{ id: 'l1', type: 'text' }] })]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1', { layers: [] })]));
    assertEqual(diff.modified.length, 1);
    assert(diff.modified[0].changes.some(c => c.field === 'layer:removed' && c.layerId === 'l1'));
  });

  it('throws on invalid incoming project', () => {
    const state = makeState([]);
    const fm = new FrameManager(state);
    let threw = false;
    try { fm.diffProject({ not: 'valid' }); } catch { threw = true; }
    assert(threw, 'should throw on invalid project');
  });

  it('works when current project has no frames', () => {
    const state = makeState([]);
    const fm = new FrameManager(state);
    const diff = fm.diffProject(makeProject([makeFrame('f1')]));
    assertEqual(diff.added.length, 1);
    assertEqual(diff.modified.length, 0);
    assertEqual(diff.removed.length, 0);
  });
});
