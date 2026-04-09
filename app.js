// app.js
import { AppState }    from './core/state.js';
import { router }      from './core/router.js';
import { storage }     from './core/storage.js';
import { events }      from './core/events.js';
import { mountEditor }  from './editor/shell.js';
import { mountManager } from './manager/shell.js';

const state = new AppState();
let editorMounted = false;

async function init() {
  router.init(state);

  mountManager(state);

  events.addEventListener('view:changed', e => {
    if (e.detail.view === 'editor' && !editorMounted) {
      mountEditor(state);
      editorMounted = true;
    }
  });

  // Restore last session: if a brief was open, navigate straight back to the editor
  const { lastBriefId } = storage.getPrefs();
  if (lastBriefId && storage.getBrief(lastBriefId)) {
    state.activeBriefId = lastBriefId;
    router.navigate('editor');
  } else {
    router.navigate('manager');
  }
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
