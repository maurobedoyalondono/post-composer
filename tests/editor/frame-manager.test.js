import { describe, it, assertEqual, assertThrows } from '../test-helper.js';
import { FrameManager } from '../../editor/frame-manager.js';
import { AppState } from '../../core/state.js';
import { events } from '../../core/events.js';

// Minimal valid project fixture
const VALID_PROJECT = {
  project: { id: 'test-project', title: 'Test' },
  export: { target: 'instagram-square', width_px: 1080, height_px: 1080 },
  design_tokens: {
    palette: {
      background: '#000000', primary: '#ffffff', accent: '#ff0000', neutral: '#888888',
    },
    type_scale: {
      display: { family: 'Inter', steps: [32], weight: 700 },
      body:    { family: 'Inter', steps: [16] },
      data:    { family: 'Inter', steps: [12] },
    },
    spacing_scale: [4, 8, 16],
  },
  variety_contract: {
    zone_max_usage_pct: 40,
    shape_quota: { min_per_n_frames: 3 },
    overlay_strategies: ['gradient'],
    silence_map: [],
    composition_patterns: {},
  },
  frames: [
    {
      id: 'frame-1', image_src: 'photo1', image_filename: 'photo1.jpg',
      composition_pattern: 'editorial-anchor',
      layers: [{ id: 'l1', type: 'text', content: 'Hello', font: { family: 'Inter', size_pct: 5 }, max_width_pct: 60, position: { zone: 'bottom-left' } }],
    },
    {
      id: 'frame-2', image_src: 'photo2', image_filename: 'photo2.jpg',
      composition_pattern: 'minimal-strip',
      layers: [],
    },
  ],
};

describe('FrameManager', () => {
  it('loadProject sets state.project', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertEqual(state.project.project.id, 'test-project');
  });

  it('loadProject resets activeFrameIndex to 0', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    state.activeFrameIndex = 1;
    fm.loadProject(VALID_PROJECT);
    assertEqual(state.activeFrameIndex, 0);
  });

  it('loadProject throws on invalid project', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertThrows(() => fm.loadProject({}), 'Invalid project');
  });

  it('loadProject dispatches project:loaded event', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    let fired = false;
    events.addEventListener('project:loaded', () => { fired = true; }, { once: true });
    fm.loadProject(VALID_PROJECT);
    assertEqual(fired, true);
  });

  it('setActiveFrame updates activeFrameIndex', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    fm.setActiveFrame(1);
    assertEqual(state.activeFrameIndex, 1);
  });

  it('setActiveFrame dispatches frame:changed event with index', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    let detail = null;
    events.addEventListener('frame:changed', e => { detail = e.detail; }, { once: true });
    fm.setActiveFrame(1);
    assertEqual(detail.index, 1);
    assertEqual(detail.frame.id, 'frame-2');
  });

  it('setActiveFrame throws on out-of-range index', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertThrows(() => fm.setActiveFrame(99), 'out of range');
  });

  it('setActiveFrame throws when no project loaded', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertThrows(() => fm.setActiveFrame(0), 'No project');
  });

  it('currentFrame returns correct frame', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    assertEqual(fm.currentFrame.id, 'frame-1');
    fm.setActiveFrame(1);
    assertEqual(fm.currentFrame.id, 'frame-2');
  });

  it('currentIndex returns activeFrameIndex', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    fm.loadProject(VALID_PROJECT);
    fm.setActiveFrame(1);
    assertEqual(fm.currentIndex, 1);
  });

  it('frameCount returns number of frames', () => {
    const state = new AppState();
    const fm = new FrameManager(state);
    assertEqual(fm.frameCount, 0);
    fm.loadProject(VALID_PROJECT);
    assertEqual(fm.frameCount, 2);
  });
});
