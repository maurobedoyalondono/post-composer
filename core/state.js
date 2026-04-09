// core/state.js
const VALID_VIEWS         = ['manager', 'editor'];
const VALID_ANALYSIS_MODES = ['heatmap', 'zones', 'contrast', 'weight'];

export class AppState {
  constructor() {
    this.view             = 'manager';  // 'manager' | 'editor'
    this.project          = null;       // parsed project JSON or null
    this.images           = new Map();  // descriptive_label → HTMLImageElement
    this.activeFrameIndex = 0;
    this.selectedLayerId  = null;
    this.analysisMode     = null;       // null | 'heatmap' | 'zones' | 'contrast' | 'weight'
    this.prefs            = { guideType: null, showSafeZone: false, showLayerBounds: false };
    this.activeBriefId    = null;       // brief id to open when navigating to editor
    this.loadedBriefId    = null;       // brief id whose project is currently in state
  }

  /** @param {'manager'|'editor'} view */
  setView(view) {
    if (!VALID_VIEWS.includes(view)) throw new Error(`Unknown view: ${view}`);
    this.view = view;
  }

  /** @param {object|null} project */
  setProject(project) {
    this.project          = project;
    this.activeFrameIndex = 0;
    this.selectedLayerId  = null;
    if (project === null) {
      this.images.clear();
      this.loadedBriefId = null;
    }
  }

  /** @param {string|null} mode */
  setAnalysisMode(mode) {
    if (mode !== null && !VALID_ANALYSIS_MODES.includes(mode))
      throw new Error(`Unknown analysis mode: ${mode}`);
    this.analysisMode = mode;
  }

  /** @param {string|null} id */
  setSelectedLayer(id) {
    this.selectedLayerId = id ?? null;
  }

  /** @returns {object|null} */
  get activeFrame() {
    if (!this.project) return null;
    return this.project.frames?.[this.activeFrameIndex] ?? null;
  }
}
