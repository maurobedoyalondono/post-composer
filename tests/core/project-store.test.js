// tests/core/project-store.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { ProjectStore } from '../../core/project-store.js';
import { events } from '../../core/events.js';
import { storage } from '../../core/storage.js';

const BRIEF_ID = '__ps_test__';

function makeState(project = null) {
  return { project, activeBriefId: project ? BRIEF_ID : null, images: new Map() };
}

describe('ProjectStore', () => {
  it('flush() with no project does nothing', () => {
    const state = makeState(null);
    const ps = new ProjectStore(state);
    // Should not throw
    ps.flush();
    assert(storage.getProject(BRIEF_ID) === null);
  });

  it('flush() saves project to storage', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    storage.saveBrief({ id: BRIEF_ID, title: 'PS Test', platform: 'instagram', tone: 'cinematic', imageMeta: [], createdAt: Date.now() });
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    ps.flush();
    const saved = storage.getProject(BRIEF_ID);
    assert(saved !== null, 'project should be saved');
    assertEqual(saved.project.title, 'PS Test');
    storage.deleteProject(BRIEF_ID);
    storage.deleteBrief(BRIEF_ID);
  });

  it('flush() dispatches project:save-status saved', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    storage.saveBrief({ id: BRIEF_ID, title: 'PS Test', platform: 'instagram', tone: 'cinematic', imageMeta: [], createdAt: Date.now() });
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    let status = null;
    events.addEventListener('project:save-status', e => { status = e.detail.status; }, { once: true });
    ps.flush();
    assertEqual(status, 'saved');
    storage.deleteProject(BRIEF_ID);
    storage.deleteBrief(BRIEF_ID);
  });

  it('_schedule() dispatches project:save-status pending', () => {
    const proj = { project: { id: BRIEF_ID, title: 'PS Test' }, frames: [], design_tokens: {}, export: {}, image_index: [] };
    const state = makeState(proj);
    const ps = new ProjectStore(state);
    let status = null;
    events.addEventListener('project:save-status', e => { status = e.detail.status; }, { once: true });
    events.dispatchEvent(new CustomEvent('layer:changed'));
    assertEqual(status, 'pending');
    ps.flush(); // clean up timer
  });
});
