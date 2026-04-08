// editor/shell.js
import { FrameManager }         from './frame-manager.js';
import { LayerManager }         from './layer-manager.js';
import { DragResize }           from './drag-resize.js';
import { renderer }             from './renderer.js';
import { Filmstrip }            from '../ui/filmstrip.js';
import { Inspector }            from '../ui/inspector.js';
import { LayersPanel }          from '../ui/layers-panel.js';
import { renderTextToolbar }    from '../ui/toolbars/text-toolbar.js';
import { renderShapeToolbar }   from '../ui/toolbars/shape-toolbar.js';
import { renderImageToolbar }   from '../ui/toolbars/image-toolbar.js';
import { renderOverlayToolbar } from '../ui/toolbars/overlay-toolbar.js';
import { events }               from '../core/events.js';
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
  const inspectorEl   = root.querySelector('.editor-inspector');
  const layersPanelEl = root.querySelector('.layers-panel');
  const ctxToolbarEl  = root.querySelector('.context-toolbar');

  const frameManager = new FrameManager(state);
  const layerManager = new LayerManager(state);

  new Filmstrip(filmstripEl, frameManager, state);
  new Inspector(inspectorEl, state, layerManager);
  new LayersPanel(layersPanelEl, state, layerManager);

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

  // ── File inputs ────────────────────────────────
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

  // ── Toolbar: safe zone ─────────────────────────
  root.querySelector('#btn-safe-zone').addEventListener('click', e => {
    state.prefs.showSafeZone = !state.prefs.showSafeZone;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showSafeZone);
    _repaint();
  });

  // ── Toolbar: layer bounds ──────────────────────
  root.querySelector('#btn-layer-bounds').addEventListener('click', e => {
    state.prefs.showLayerBounds = !state.prefs.showLayerBounds;
    e.currentTarget.setAttribute('aria-pressed', state.prefs.showLayerBounds);
    _repaint();
  });

  // ── Toolbar: composition guides ────────────────
  _wireGuideButtons(root, state, _repaint);

  // ── Context toolbar ────────────────────────────
  events.addEventListener('layer:selected', () => {
    _updateContextToolbar(ctxToolbarEl, state, layerManager);
  });

  // ── Repaint on events ──────────────────────────
  for (const ev of ['project:loaded', 'frame:changed', 'images:loaded', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
    events.addEventListener(ev, _repaint);
  }
}

function _updateContextToolbar(container, state, layerManager) {
  const layerId = state.selectedLayerId;
  if (!layerId) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  const frame = state.activeFrame;
  const layer = frame?.layers?.find(l => l.id === layerId);
  if (!layer) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  switch (layer.type) {
    case 'text':    renderTextToolbar(container, layer, state.activeFrameIndex, layerManager);    break;
    case 'shape':   renderShapeToolbar(container, layer, state.activeFrameIndex, layerManager);   break;
    case 'image':
    case 'logo':    renderImageToolbar(container, layer, state.activeFrameIndex, layerManager);   break;
    case 'overlay': renderOverlayToolbar(container, layer, state.activeFrameIndex, layerManager); break;
    default:        container.classList.add('hidden');
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
          <button id="btn-safe-zone"    class="btn" aria-pressed="false" title="Safe zone">Safe Zone</button>
          <button id="btn-layer-bounds" class="btn" aria-pressed="false" title="Layer bounds">Bounds</button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-filmstrip"></div>

        <div class="editor-canvas-area" style="position:relative;">
          <canvas id="editor-canvas"></canvas>
          <div class="layers-panel"></div>
        </div>

        <div class="editor-inspector">
          <div class="editor-empty">
            <p>Load a project JSON<br>to get started.</p>
          </div>
        </div>

      </div>

      <div class="context-toolbar hidden"></div>

    </div>
  `;
}
