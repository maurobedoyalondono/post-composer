// ui/filmstrip.js
import { renderer } from '../editor/renderer.js';
import { events }   from '../core/events.js';

const THUMB_W = 64;

/**
 * Filmstrip panel — renders one thumbnail per frame, handles click navigation.
 */
export class Filmstrip {
  /**
   * @param {HTMLElement} container — .editor-filmstrip element
   * @param {import('../editor/frame-manager.js').FrameManager} frameManager
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, frameManager, state) {
    this._el           = container;
    this._frameManager = frameManager;
    this._state        = state;
    this._items        = []; // Array of { el, canvas }

    events.addEventListener('project:loaded',  () => this._build());
    events.addEventListener('images:loaded',   () => this._renderAll());
    events.addEventListener('frame:changed',   e  => this._setActive(e.detail.index));
  }

  /** Build DOM items from current project frames. */
  _build() {
    const project = this._state.project;
    if (!project) return;

    this._el.innerHTML = '';
    this._items = [];

    const { width_px, height_px } = project.export;
    const aspect = height_px / width_px;
    const thumbH = Math.round(THUMB_W * aspect);

    for (let i = 0; i < project.frames.length; i++) {
      const item   = document.createElement('div');
      item.className = 'filmstrip-item';
      item.dataset.index = i;

      const canvas    = document.createElement('canvas');
      canvas.width    = THUMB_W;
      canvas.height   = thumbH;

      const num       = document.createElement('span');
      num.className   = 'frame-num';
      num.textContent = i + 1;

      item.appendChild(canvas);
      item.appendChild(num);
      this._el.appendChild(item);

      item.addEventListener('click', () => this._frameManager.setActiveFrame(i));
      this._items.push({ el: item, canvas });
    }

    this._setActive(0);
    this._renderAll();
  }

  /** Re-render all thumbnails. */
  _renderAll() {
    const project = this._state.project;
    if (!project) return;
    this._items.forEach(({ canvas }, i) => {
      renderer.renderFrame(canvas, project.frames[i], project, this._state.images);
    });
  }

  /** Mark one item active, remove from others. */
  _setActive(index) {
    this._items.forEach(({ el }, i) => {
      el.classList.toggle('active', i === index);
    });
    const active = this._items[index];
    if (active) active.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
