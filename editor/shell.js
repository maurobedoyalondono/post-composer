// editor/shell.js
import { FrameManager }         from './frame-manager.js';
import { LayerManager }         from './layer-manager.js';
import { DragResize }           from './drag-resize.js';
import { renderer }             from './renderer.js';
import { Filmstrip }            from '../ui/filmstrip.js';
import { Inspector }            from '../ui/inspector.js';
import { LayersPanel }          from '../ui/layers-panel.js';
import { ImageTray }            from '../ui/image-tray.js';
import { events }               from '../core/events.js';
import { router }               from '../core/router.js';
import { loadProjectFonts }     from '../shared/fonts.js';

/**
 * Mount the editor shell into #editor-view.
 * Call once after DOM is ready.
 * @param {import('../core/state.js').AppState} state
 */
export function mountEditor(state) {
  const root = document.getElementById('editor-view');
  if (!root) throw new Error('#editor-view not found');
  root.innerHTML = _buildHTML();

  const canvasEl      = root.querySelector('#editor-canvas');
  const filmstripEl   = root.querySelector('.editor-filmstrip');
  const imageTrayEl   = root.querySelector('.editor-image-tray');
  const inspectorEl   = root.querySelector('.editor-inspector');

  // Layers panel mounts to body (floating, fixed position)
  const layersPanelEl = document.createElement('div');
  layersPanelEl.className = 'layers-panel';
  document.body.appendChild(layersPanelEl);

  const frameManager = new FrameManager(state);
  const layerManager = new LayerManager(state);

  new Filmstrip(filmstripEl, frameManager, state);
  new Inspector(inspectorEl, state, layerManager);
  new ImageTray(imageTrayEl, state);
  const layersPanel = new LayersPanel(layersPanelEl, state, layerManager);

  function _repaint() {
    const frame = state.activeFrame;
    if (!frame || !state.project) return;
    _fitCanvas(canvasEl, root.querySelector('.editor-canvas-area'), state.project.export);
    renderer.renderFrame(canvasEl, frame, state.project, state.images, {
      guideType:       state.prefs.guideType,
      showSafeZone:    state.prefs.showSafeZone,
      selectedLayerId: state.selectedLayerId,
      showLayerBounds: state.prefs.showLayerBounds,
    });
  }

  new DragResize(canvasEl, state, layerManager, _repaint);

  // ── Header: back to Project Manager ────────
  root.querySelector('#btn-back').addEventListener('click', () => {
    router.navigate('manager');
  });

  // ── Header: project name updates ───────────
  const nameEl = root.querySelector('#header-project-name');
  events.addEventListener('project:loaded', () => {
    const title = state.project?.project?.title;
    if (title) {
      nameEl.textContent = title;
      nameEl.classList.remove('no-project');
    } else {
      nameEl.textContent = 'No project loaded';
      nameEl.classList.add('no-project');
    }
  });

  // ── Header: file inputs ─────────────────────
  const jsonInput = root.querySelector('#input-json');
  const imgInput  = root.querySelector('#input-images');

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

  // ── View strip: composition guides ─────────
  _wireGuideButtons(root, state, _repaint);

  // ── View strip: safe zone ──────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    state.prefs.showSafeZone = !state.prefs.showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showSafeZone);
    _repaint();
  });

  // ── View strip: layer bounds ───────────────
  root.querySelector('#btn-layer-bounds').addEventListener('click', e => {
    state.prefs.showLayerBounds = !state.prefs.showLayerBounds;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showLayerBounds);
    _repaint();
  });

  // ── View strip: layers panel toggle ────────
  const layersPanelBtn = root.querySelector('#btn-layers-panel');
  layersPanelBtn.addEventListener('click', () => {
    const isOpen = layersPanel.toggle();
    layersPanelBtn.setAttribute('aria-pressed', isOpen);
    layersPanelBtn.textContent = isOpen ? 'Layers ▼' : 'Layers ▲';
  });

  // ── Repaint on events ──────────────────────
  for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
    events.addEventListener(ev, _repaint);
  }
}

function _wireGuideButtons(root, state, repaint) {
  const guides = ['thirds', 'phi', 'cross'];
  guides.forEach(type => {
    const btn = root.querySelector(`#btn-guide-${type}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = state.prefs.guideType === type ? null : type;
      state.prefs.guideType = next;
      guides.forEach(t => {
        const b = root.querySelector(`#btn-guide-${t}`);
        if (b) b.setAttribute('aria-pressed', t === next);
      });
      repaint();
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

      <div class="editor-header">
        <button id="btn-back" class="btn-back">← Projects</button>
        <span id="header-project-name" class="header-project-name no-project">No project loaded</span>
        <div class="header-project-actions">
          <label class="btn view-strip-btn" for="input-json" title="Load project JSON">Load JSON</label>
          <input id="input-json" type="file" accept=".json" class="file-input-hidden">
          <label class="btn view-strip-btn" for="input-images" title="Load image files">Load Images</label>
          <input id="input-images" type="file" accept="image/*" multiple class="file-input-hidden">
        </div>
      </div>

      <div class="editor-body">

        <div class="editor-left-panel">
          <div class="editor-filmstrip"></div>
          <div class="editor-image-tray"></div>
        </div>

        <div class="editor-canvas-area">
          <canvas id="editor-canvas"></canvas>
        </div>

        <div class="editor-inspector"></div>

      </div>

      <div class="editor-view-strip">
        <div class="view-strip-group">
          <button id="btn-guide-thirds" class="btn view-strip-btn" aria-pressed="false" title="Rule of thirds">⅓ Thirds</button>
          <button id="btn-guide-phi"    class="btn view-strip-btn" aria-pressed="false" title="Golden ratio (φ)">φ Phi</button>
          <button id="btn-guide-cross"  class="btn view-strip-btn" aria-pressed="false" title="Cross">✛ Cross</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group">
          <button id="btn-safe-zone"    class="btn view-strip-btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
          <button id="btn-layer-bounds" class="btn view-strip-btn" aria-pressed="false" title="Layer bounds">Bounds</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group view-strip-right">
          <button id="btn-layers-panel" class="btn view-strip-btn" aria-pressed="false" title="Toggle layers panel">Layers ▲</button>
        </div>
      </div>

    </div>
  `;
}
