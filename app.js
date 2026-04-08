// app.js
import { AppState }    from './core/state.js';
import { router }      from './core/router.js';
import { storage }     from './core/storage.js';
import { events }      from './core/events.js';
import { mountEditor } from './editor/shell.js';

const state = new AppState();
let editorMounted = false;

async function init() {
  router.init(state);

  events.addEventListener('view:changed', e => {
    if (e.detail.view === 'editor' && !editorMounted) {
      mountEditor(state);
      editorMounted = true;
    }
  });

  router.navigate('manager');
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
