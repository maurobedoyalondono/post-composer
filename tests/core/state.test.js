// tests/core/state.test.js
import { describe, it, assert, assertEqual, assertThrows } from '../test-helper.js';
import { AppState } from '../../core/state.js';

describe('AppState', () => {
  it('initialises with default values', () => {
    const s = new AppState();
    assertEqual(s.view, 'manager');
    assert(s.project === null);
    assert(s.images instanceof Map);
    assertEqual(s.activeFrameIndex, 0);
    assert(s.selectedLayerId === null);
    assert(s.analysisMode === null);
  });

  it('setView changes view and rejects unknown views', () => {
    const s = new AppState();
    s.setView('editor');
    assertEqual(s.view, 'editor');
    assertThrows(() => s.setView('unknown'));
  });

  it('setProject stores project and resets frame/layer selection', () => {
    const s = new AppState();
    s.activeFrameIndex = 3;
    s.selectedLayerId = 'layer-1';
    s.setProject({ id: 'test', frames: [] });
    assertEqual(s.project.id, 'test');
    assertEqual(s.activeFrameIndex, 0);
    assert(s.selectedLayerId === null);
  });

  it('setProject(null) clears project and images', () => {
    const s = new AppState();
    s.setProject({ id: 'test', frames: [] });
    s.images.set('img-1', new Image());
    s.setProject(null);
    assert(s.project === null);
    assertEqual(s.images.size, 0);
  });

  it('setAnalysisMode accepts valid modes and null', () => {
    const s = new AppState();
    s.setAnalysisMode('heatmap');
    assertEqual(s.analysisMode, 'heatmap');
    s.setAnalysisMode('zones');
    assertEqual(s.analysisMode, 'zones');
    s.setAnalysisMode(null);
    assert(s.analysisMode === null);
    assertThrows(() => s.setAnalysisMode('invalid'));
  });

  it('activeFrame returns the correct frame object', () => {
    const s = new AppState();
    s.setProject({ id: 'p', frames: [{ id: 'f0' }, { id: 'f1' }] });
    s.activeFrameIndex = 1;
    assertEqual(s.activeFrame?.id, 'f1');
  });

  it('activeFrame returns null when no project', () => {
    const s = new AppState();
    assert(s.activeFrame === null);
  });
});
