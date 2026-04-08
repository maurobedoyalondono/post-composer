// app.js
import { AppState } from './core/state.js';
import { router }   from './core/router.js';
import { storage }  from './core/storage.js';

const state = new AppState();

async function init() {
  router.init(state);
  router.navigate('manager');
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
