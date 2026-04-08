// editor/shell.js
import { FrameManager }     from './frame-manager.js';
import { renderer }         from './renderer.js';
import { Filmstrip }        from '../ui/filmstrip.js';
import { Inspector }        from '../ui/inspector.js';
import { events }           from '../core/events.js';
import { loadProjectFonts } from '../shared/fonts.js';

/**
 * Mount the editor shell into #editor-view.
 * Call once after DOM is ready.
 * @param {import('../core/state.js').AppState} state
 */
export function mountEditor(state) {
  const root = document.getElementById('editor-view');
  if (!root) throw new Error('#editor-view not found');
  root.innerHTML = _buildHTML();

  const canvasEl    = root.querySelector('#editor-canvas');
  const filmstripEl = root.querySelector('.editor-filmstrip');
  const inspectorEl = root.querySelector('.editor-inspector');

  const frameManager = new FrameManager(state);
  new Filmstrip(filmstripEl, frameManager, state);
  new Inspector(inspectorEl, state);

  // ── Toolbar state ──────────────────────────────
  let guideType    = null;
  let showSafeZone = false;

  function _repaint() {
    const frame = state.activeFrame;
    if (!frame || !state.project) return;
    _fitCanvas(canvasEl, root.querySelector('.editor-canvas-area'), state.project.export);
    renderer.renderFrame(canvasEl, frame, state.project, state.images, {
      guideType,
      showSafeZone,
    });
  }

  // ── File inputs ────────────────────────────────
  const jsonInput  = root.querySelector('#input-json');
  const imgInput   = root.querySelector('#input-images');

  jsonInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      frameManager.loadProject(data);
      await loadProjectFonts(data.design_tokens);
    } catch (err) {
      alert(`Failed to load project: ${err.message}`);
    }
    jsonInput.value = '';
  });

  imgInput.addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      await frameManager.loadImages(files);
    } catch (err) {
      console.warn('Image load error:', err);
    }
    imgInput.value = '';
  });

  // ── Toolbar buttons ────────────────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    showSafeZone = !showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', showSafeZone);
    _repaint();
  });

  _wireGuideButtons(root, () => guideType, val => { guideType = val; _repaint(); });

  // ── Repaint on events ──────────────────────────
  events.addEventListener('project:loaded', _repaint);
  events.addEventListener('frame:changed',  _repaint);
  events.addEventListener('images:loaded',  _repaint);
}

function _wireGuideButtons(root, getGuide, setGuide) {
  const guides = ['thirds', 'phi', 'cross'];
  guides.forEach(type => {
    const btn = root.querySelector(`#btn-guide-${type}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = getGuide() === type ? null : type;
      setGuide(next);
      guides.forEach(t => {
        const b = root.querySelector(`#btn-guide-${t}`);
        if (b) b.setAttribute('aria-pressed', t === next);
      });
    });
  });
}

function _fitCanvas(canvas, area, exportConfig) {
  const { width_px, height_px } = exportConfig;
  const areaW = area.clientWidth  - 32;
  const areaH = area.clientHeight - 32;
  const scale = Math.min(areaW / width_px, areaH / height_px, 1);
  canvas.width  = width_px;
  canvas.height = height_px;
  canvas.style.width  = `${Math.round(width_px  * scale)}px`;
  canvas.style.height = `${Math.round(height_px * scale)}px`;
}

function _buildHTML() {
  return `
    <div class="editor-shell">

      <div class="editor-toolbar">
        <div class="toolbar-group">
          <label class="btn btn-primary" for="input-json" title="Load project JSON">
            Load JSON
          </label>
          <input id="input-json" type="file" accept=".json" class="file-input-hidden">
          <label class="btn" for="input-images" title="Load image files">
            Load Images
          </label>
          <input id="input-images" type="file" accept="image/*" multiple class="file-input-hidden">
        </div>

        <div class="toolbar-sep"></div>

        <div class="toolbar-group">
          <span class="toolbar-label">Guides</span>
          <button id="btn-guide-thirds" class="btn" aria-pressed="false" title="Thirds">⅓</button>
          <button id="btn-guide-phi"    class="btn" aria-pressed="false" title="Golden ratio (φ)">φ</button>
          <button id="btn-guide-cross"  class="btn" aria-pressed="false" title="Cross">✛</button>
        </div>

        <div class="toolbar-sep"></div>

        <div class="toolbar-group">
          <button id="btn-safe-zone" class="btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-filmstrip"></div>

        <div class="editor-canvas-area">
          <canvas id="editor-canvas"></canvas>
        </div>

        <div class="editor-inspector">
          <div class="editor-empty">
            <p>Load a project JSON<br>to get started.</p>
          </div>
        </div>

      </div>

    </div>
  `;
}
