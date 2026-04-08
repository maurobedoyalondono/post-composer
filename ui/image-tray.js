// ui/image-tray.js
import { events } from '../core/events.js';

/**
 * Image tray — shows thumbnails of all loaded images.
 * Renders on images:loaded. No drag wiring (deferred to Plan 4).
 */
export class ImageTray {
  /**
   * @param {HTMLElement} container — .editor-image-tray element
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, state) {
    this._el    = container;
    this._state = state;
    events.addEventListener('images:loaded', () => this._render());
    this._render();
  }

  _render() {
    const images = this._state.images;
    if (!images || images.size === 0) {
      this._el.innerHTML = '<div class="image-tray-empty">No images</div>';
      return;
    }
    this._el.innerHTML = `<div class="image-tray-grid">
      ${Array.from(images.entries()).map(([key, img]) => `
        <div class="image-tray-cell" title="${_esc(key)}">
          <img src="${/^blob:/.test(img.src) ? _esc(img.src) : ''}" alt="${_esc(_basename(key))}">
          <span class="image-tray-label">${_esc(_basename(key))}</span>
        </div>
      `).join('')}
    </div>`;
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _basename(key) {
  return key.split(/[/\\]/).pop();
}
