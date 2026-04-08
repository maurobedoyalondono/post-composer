// core/router.js
import { events } from './events.js';

export class Router {
  /**
   * @param {string} managerId  — DOM id of manager view container
   * @param {string} editorId   — DOM id of editor view container
   */
  constructor(managerId = 'manager-view', editorId = 'editor-view') {
    this._managerId = managerId;
    this._editorId  = editorId;
    this._state     = null;
  }

  init(state) { this._state = state; }

  navigate(view) {
    this._state.setView(view);   // validates view name, throws on unknown
    document.getElementById(this._managerId).hidden = (view !== 'manager');
    document.getElementById(this._editorId).hidden  = (view !== 'editor');
    events.dispatchEvent(new CustomEvent('view:changed', { detail: { view } }));
  }
}

// Default singleton for app use
export const router = new Router();
