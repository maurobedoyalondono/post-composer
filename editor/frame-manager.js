// editor/frame-manager.js
import { validate } from '../shared/validator.js';
import { events }   from '../core/events.js';

export class FrameManager {
  /**
   * @param {import('../core/state.js').AppState} state
   */
  constructor(state) {
    this._state = state;
  }

  /**
   * Validate and load a project. Throws if invalid.
   * @param {object} projectData
   */
  loadProject(projectData) {
    const { valid, errors } = validate(projectData);
    if (!valid) throw new Error(`Invalid project: ${errors.join('; ')}`);
    this._state.setProject(projectData);
    this._state.activeFrameIndex = 0;
    events.dispatchEvent(new CustomEvent('project:loaded', { detail: projectData }));
  }

  /**
   * Read image files via FileReader and populate state.images.
   * Keyed by filename (file.name). Returns after all images are loaded.
   * @param {FileList|File[]} fileList
   * @returns {Promise<void>}
   */
  async loadImages(fileList) {
    const loads = Array.from(fileList).map(file => this._readImageFile(file));
    await Promise.all(loads);
    events.dispatchEvent(new CustomEvent('images:loaded'));
  }

  _readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          this._state.images.set(file.name, img);
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to decode image: ${file.name}`));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Navigate to a frame by index. Throws if no project or index out of range.
   * @param {number} index
   */
  setActiveFrame(index) {
    if (!this._state.project) throw new Error('No project loaded');
    const count = this._state.project.frames.length;
    if (index < 0 || index >= count) throw new Error(`Frame index out of range: ${index}`);
    this._state.activeFrameIndex = index;
    this._state.selectedLayerId  = null;
    const frame = this._state.project.frames[index];
    events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index, frame } }));
  }

  /** @returns {object|null} */
  get currentFrame() {
    return this._state.activeFrame;
  }

  /** @returns {number} */
  get currentIndex() {
    return this._state.activeFrameIndex;
  }

  /** @returns {number} */
  get frameCount() {
    return this._state.project?.frames?.length ?? 0;
  }

  /**
   * Compute frame-level diff between incomingData and current state.project.
   * Throws if incomingData is invalid.
   * @param {object} incomingData
   * @returns {{
   *   modified:  Array<{ frameId: string, label: string, changes: object[], incomingFrame: object, currentFrame: object }>,
   *   added:     Array<{ frame: object }>,
   *   removed:   Array<{ frame: object }>,
   *   unchanged: Array<{ frame: object }>,
   * }}
   */
  diffProject(incomingData) {
    const { valid, errors } = validate(incomingData);
    if (!valid) throw new Error(`Invalid project: ${errors.join('; ')}`);

    const currentFrames  = this._state.project?.frames  ?? [];
    const incomingFrames = incomingData.frames ?? [];

    const currentMap  = new Map(currentFrames.map(f  => [f.id, f]));
    const incomingMap = new Map(incomingFrames.map(f => [f.id, f]));

    const modified  = [];
    const added     = [];
    const removed   = [];
    const unchanged = [];

    for (const [id, incomingFrame] of incomingMap) {
      if (!currentMap.has(id)) {
        added.push({ frame: incomingFrame });
      } else {
        const changes = _diffFrame(currentMap.get(id), incomingFrame);
        if (changes.length > 0) {
          modified.push({
            frameId: id,
            label: incomingFrame.label ?? id,
            changes,
            incomingFrame,
            currentFrame: currentMap.get(id),
          });
        } else {
          unchanged.push({ frame: incomingFrame });
        }
      }
    }

    for (const [id, currentFrame] of currentMap) {
      if (!incomingMap.has(id)) {
        removed.push({ frame: currentFrame });
      }
    }

    return { modified, added, removed, unchanged };
  }
}

/**
 * Return list of changes between two frame objects.
 * @param {object} current
 * @param {object} incoming
 * @returns {object[]} array of change descriptors
 */
function _diffFrame(current, incoming) {
  const changes = [];

  for (const field of ['composition_pattern', 'bg_color', 'multi_image', 'image_filename']) {
    if (current[field] !== incoming[field]) {
      changes.push({ field, from: current[field], to: incoming[field] });
    }
  }

  const currentLayerIds  = new Set((current.layers  ?? []).map(l => l.id));
  const incomingLayerIds = new Set((incoming.layers ?? []).map(l => l.id));

  for (const l of (incoming.layers ?? [])) {
    if (!currentLayerIds.has(l.id)) {
      changes.push({ field: 'layer:added', layerId: l.id, type: l.type });
    }
  }
  for (const l of (current.layers ?? [])) {
    if (!incomingLayerIds.has(l.id)) {
      changes.push({ field: 'layer:removed', layerId: l.id, type: l.type });
    }
  }
  for (const l of (incoming.layers ?? [])) {
    const cl = (current.layers ?? []).find(x => x.id === l.id);
    if (cl && JSON.stringify(cl) !== JSON.stringify(l)) {
      changes.push({ field: 'layer:modified', layerId: l.id, type: l.type });
    }
  }

  return changes;
}
