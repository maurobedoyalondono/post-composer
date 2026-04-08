// core/storage.js
const KEYS = {
  index: 'pc_projects_index',
  project: id => `pc_project_${id}`,
  prefs: 'pc_prefs',
};

export const storage = {
  /** Save full project JSON. Updates the index automatically. */
  saveProject(project) {
    const { id, title } = project;
    localStorage.setItem(KEYS.project(id), JSON.stringify(project));
    const index = this._readIndex();
    const existing = index.findIndex(p => p.id === id);
    const entry = { id, title, updatedAt: Date.now() };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  /** Returns full project object or null. */
  getProject(id) {
    const raw = localStorage.getItem(KEYS.project(id));
    return raw ? JSON.parse(raw) : null;
  },

  /** Returns array of index entries: [{id, title, updatedAt}] sorted newest first. */
  listProjects() {
    return this._readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Removes project from storage and index. */
  deleteProject(id) {
    localStorage.removeItem(KEYS.project(id));
    const index = this._readIndex().filter(p => p.id !== id);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  savePrefs(prefs) { localStorage.setItem(KEYS.prefs, JSON.stringify(prefs)); },

  getPrefs() {
    const raw = localStorage.getItem(KEYS.prefs);
    return raw ? JSON.parse(raw) : {};
  },

  _readIndex() {
    const raw = localStorage.getItem(KEYS.index);
    return raw ? JSON.parse(raw) : [];
  },
};
