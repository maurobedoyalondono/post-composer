// core/storage.js
const KEYS = {
  index: 'pc_projects_index',
  project: id => `pc_project_${id}`,
  prefs: 'pc_prefs',
  briefIndex: 'pc_briefs',
  brief: id => `pc_brief_${id}`,
  images: id => `pc_images_${id}`,
};

export const storage = {
  /**
   * Save full project data keyed by id.
   * Throws on localStorage quota error — callers must handle.
   * @param {string} id — the brief id (universal project key)
   * @param {object} projectData — raw project JSON (frames, design_tokens, etc.)
   */
  saveProject(id, projectData) {
    localStorage.setItem(KEYS.project(id), JSON.stringify(projectData));
    const index = this._readIndex();
    const existing = index.findIndex(p => p.id === id);
    const title = projectData?.project?.title ?? '';
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

  // ── Brief CRUD (Project Manager inputs — separate from editor project JSON) ──

  /** Save a project brief. Updates the brief index automatically. */
  saveBrief(brief) {
    const now = Date.now();
    const { id, title, platform, tone, imageMeta } = brief;
    localStorage.setItem(KEYS.brief(id), JSON.stringify({ ...brief, updatedAt: now }));
    const index = this._readBriefIndex();
    const existing = index.findIndex(b => b.id === id);
    const entry = {
      id, title, platform, tone,
      imageCount: Array.isArray(imageMeta) ? imageMeta.length : 0,
      updatedAt: now,
    };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(KEYS.briefIndex, JSON.stringify(index));
  },

  /** Returns full brief object or null. */
  getBrief(id) {
    const raw = localStorage.getItem(KEYS.brief(id));
    return raw ? JSON.parse(raw) : null;
  },

  /** Returns array of index entries [{id, title, updatedAt}] sorted newest first. */
  listBriefs() {
    return this._readBriefIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Removes brief from storage and index. */
  deleteBrief(id) {
    localStorage.removeItem(KEYS.brief(id));
    this.deleteImages(id);
    const index = this._readBriefIndex().filter(b => b.id !== id);
    localStorage.setItem(KEYS.briefIndex, JSON.stringify(index));
  },

  _readBriefIndex() {
    const raw = localStorage.getItem(KEYS.briefIndex);
    return raw ? JSON.parse(raw) : [];
  },

  // ── Image storage (per brief) ──────────────────────────────────────────

  /**
   * Load all stored images for a brief.
   * @param {string} briefId
   * @returns {{ [filename: string]: string }} filename → dataURL
   */
  loadImages(briefId) {
    try {
      const raw = localStorage.getItem(KEYS.images(briefId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Merge new images into localStorage for a brief.
   * @param {string} briefId
   * @param {{ [filename: string]: string }} imageMap — filename → dataURL
   * @returns {string[]} filenames that could not be saved due to quota
   */
  saveImages(briefId, imageMap) {
    const existing = this.loadImages(briefId);
    const merged   = { ...existing, ...imageMap };
    try {
      localStorage.setItem(KEYS.images(briefId), JSON.stringify(merged));
      return [];
    } catch {
      // Quota hit — try saving each image individually
      const failed = [];
      let saved = { ...existing };
      for (const [filename, dataURL] of Object.entries(imageMap)) {
        try {
          saved[filename] = dataURL;
          localStorage.setItem(KEYS.images(briefId), JSON.stringify(saved));
        } catch {
          delete saved[filename];
          failed.push(filename);
        }
      }
      return failed;
    }
  },

  /**
   * Remove all stored images for a brief (call when brief is deleted).
   * @param {string} briefId
   */
  deleteImages(briefId) {
    localStorage.removeItem(KEYS.images(briefId));
  },
};
