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
}
