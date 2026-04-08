// tests/core/router.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { Router } from '../../core/router.js';
import { AppState } from '../../core/state.js';
import { events } from '../../core/events.js';

describe('Router', () => {
  function makeDOM() {
    const manager = document.createElement('div');
    manager.id = 'test-manager';
    const editor = document.createElement('div');
    editor.id = 'test-editor';
    document.body.appendChild(manager);
    document.body.appendChild(editor);
    return { manager, editor };
  }

  it('navigate to manager shows manager, hides editor', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    router.navigate('manager');
    assert(!manager.hidden);
    assert(editor.hidden);
    manager.remove(); editor.remove();
  });

  it('navigate to editor shows editor, hides manager', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    router.navigate('editor');
    assert(manager.hidden);
    assert(!editor.hidden);
    manager.remove(); editor.remove();
  });

  it('navigate emits view:changed event', () => {
    const { manager, editor } = makeDOM();
    const state = new AppState();
    const router = new Router('test-manager', 'test-editor');
    router.init(state);
    let emitted = null;
    const handler = ({ detail }) => { emitted = detail.view; };
    events.addEventListener('view:changed', handler);
    router.navigate('editor');
    events.removeEventListener('view:changed', handler);
    assertEqual(emitted, 'editor');
    manager.remove(); editor.remove();
  });
});
