// tests/core/storage.test.js
import { describe, it, assert, assertEqual, assertDeepEqual } from '../test-helper.js';
import { storage } from '../../core/storage.js';

const TEST_ID = '__test__';

describe('storage', () => {
  it('saveProject(id, data) and getProject round-trip', () => {
    const data = { project: { id: TEST_ID, title: 'Test' }, frames: [] };
    storage.saveProject(TEST_ID, data);
    const loaded = storage.getProject(TEST_ID);
    assertEqual(loaded.project.title, 'Test');
    storage.deleteProject(TEST_ID);
  });

  it('listProjects includes saved project', () => {
    const data = { project: { id: TEST_ID, title: 'Test' }, frames: [] };
    storage.saveProject(TEST_ID, data);
    const list = storage.listProjects();
    assert(list.some(p => p.id === TEST_ID));
    storage.deleteProject(TEST_ID);
  });

  it('deleteProject removes it from list', () => {
    storage.saveProject(TEST_ID, { project: { id: TEST_ID, title: 'Test' }, frames: [] });
    storage.deleteProject(TEST_ID);
    assert(!storage.listProjects().some(p => p.id === TEST_ID));
  });

  it('getProject returns null for unknown id', () => {
    assert(storage.getProject('__nonexistent__') === null);
  });

  it('savePrefs and getPrefs round-trip', () => {
    storage.savePrefs({ guideType: 'thirds', showSafeZone: true });
    const prefs = storage.getPrefs();
    assertEqual(prefs.guideType, 'thirds');
    assertEqual(prefs.showSafeZone, true);
  });
});
