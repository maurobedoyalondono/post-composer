// editor/shell.js
import { FrameManager }         from './frame-manager.js';
import { LayerManager }         from './layer-manager.js';
import { DragResize }           from './drag-resize.js';
import { renderer }             from './renderer.js';
import { computeLayerBounds }   from './layers.js';
import { relativeLuminance, contrastVsWhite, wcagLevel, sampleBoundsLuminance }
                                from './analysis.js';
import { exportFrame, exportAllFrames } from './export.js';
import { Filmstrip }            from '../ui/filmstrip.js';
import { Inspector }            from '../ui/inspector.js';
import { LayersPanel }          from '../ui/layers-panel.js';
import { ImageTray }            from '../ui/image-tray.js';
import { events }               from '../core/events.js';
import { router }               from '../core/router.js';
import { loadProjectFonts }     from '../shared/fonts.js';
import { storage }              from '../core/storage.js';

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
      analysisMode:    state.analysisMode,
    });

    // Post-repaint WCAG dispatch: sample canvas at selected text layer bounds.
    // Skip when an analysis overlay is active — overlay pixels would corrupt the reading.
    const layerId = state.selectedLayerId;
    const layer   = frame?.layers?.find(l => l.id === layerId);
    if (!state.analysisMode && layer?.type === 'text') {
      const bounds = computeLayerBounds(layer, canvasEl.width, canvasEl.height);
      const result = sampleBoundsLuminance(canvasEl, bounds);
      events.dispatchEvent(new CustomEvent('analysis:contrast', { detail: result }));
    }
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

  // ── Auto-load brief context (runs on mount and on subsequent navigations) ─
  async function _applyActiveBrief() {
    if (!state.activeBriefId) return;
    const brief = storage.getBrief(state.activeBriefId);
    if (!brief) return;

    // Update header only when no project is loaded yet
    if (!state.project) {
      nameEl.textContent = `${brief.title} — load JSON to begin`;
      nameEl.classList.add('no-project');
    }

    // Collect images from both sources: brief wizard uploads + editor-loaded images
    const sources = [
      ...(brief.imageMeta ?? [])
        .filter(m => m.dataUrl)
        .map(m => ({ filename: m.filename, src: m.dataUrl })),
      ...Object.entries(storage.loadImages(state.activeBriefId))
        .map(([filename, src]) => ({ filename, src })),
    ];

    // Only load images not already in state.images
    const toLoad = sources.filter(({ filename }) => !state.images.has(filename));
    if (!toLoad.length) return;

    await Promise.all(toLoad.map(({ filename, src }) => new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { state.images.set(filename, img); resolve(); };
      img.onerror = () => { console.warn(`[shell] Failed to load image: ${filename}`); resolve(); };
      img.src = src;
    })));
    events.dispatchEvent(new CustomEvent('images:loaded'));
  }
  // Run immediately on mount (editor is lazy-mounted inside view:changed, so the
  // event has already fired by the time we get here)
  _applyActiveBrief();
  // Also run on subsequent back-and-forth navigations, then repaint to restore canvas
  events.addEventListener('view:changed', ({ detail }) => {
    if (detail.view === 'editor') {
      // _applyActiveBrief is async; _repaint runs immediately with current state.
      // images:loaded event triggers a second repaint once images finish loading.
      _applyActiveBrief();
      _repaint();
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
      // Ensure brief images are loaded for this project (loads any that are missing)
      await _applyActiveBrief();
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
      // Persist to localStorage so images survive reload and tab close
      if (state.activeBriefId) {
        const imageMap = {};
        files.forEach(f => {
          const img = state.images.get(f.name);
          if (img?.src) imageMap[f.name] = img.src;
        });
        storage.saveImages(state.activeBriefId, imageMap);
      }
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

  // ── View strip: analysis modes (mutually exclusive) ──
  const analysisModes = ['contrast', 'weight'];
  analysisModes.forEach(mode => {
    root.querySelector(`#btn-${mode}`).addEventListener('click', () => {
      const next = state.analysisMode === mode ? null : mode;
      state.setAnalysisMode(next);
      analysisModes.forEach(m => {
        root.querySelector(`#btn-${m}`).setAttribute('aria-pressed', m === next);
      });
      _repaint();
    });
  });

  // ── View strip: export ─────────────────────
  root.querySelector('#btn-export-frame').addEventListener('click', () => {
    if (!state.activeFrame || !state.project) return;
    // Re-render to a temp canvas at export resolution so the PNG is always clean
    // (no analysis overlays, no selection handles, no guides)
    const frame = state.activeFrame;
    const tempCanvas    = document.createElement('canvas');
    tempCanvas.width    = state.project.export.width_px;
    tempCanvas.height   = state.project.export.height_px;
    renderer.renderFrame(tempCanvas, frame, state.project, state.images, {});
    exportFrame(tempCanvas, frame.id);
  });

  root.querySelector('#btn-export-all').addEventListener('click', async () => {
    if (!state.project) return;
    const { skipped } = await exportAllFrames(
      state.project.frames, state, renderer,
      () => {}
    );
    if (skipped > 0) alert(`${skipped} frame(s) skipped — missing images.`);
  });

  // ── View strip: layers panel toggle ────────
  const layersPanelBtn = root.querySelector('#btn-layers-panel');
  layersPanelBtn.addEventListener('click', () => {
    const isOpen = layersPanel.toggle();
    layersPanelBtn.setAttribute('aria-pressed', isOpen);
    layersPanelBtn.textContent = isOpen ? 'Layers ▼' : 'Layers ▲';
  });

  // ── Canvas: click-to-probe (disabled by default, toggled via view strip) ─
  let probePopover = null;
  let probeActive  = false;
  const _dismissProbe = () => {
    if (probePopover) { probePopover.remove(); probePopover = null; }
  };

  const probeBtn = root.querySelector('#btn-probe');
  probeBtn.addEventListener('click', () => {
    probeActive = !probeActive;
    probeBtn.setAttribute('aria-pressed', probeActive);
    if (!probeActive) _dismissProbe();
  });

  canvasEl.addEventListener('click', e => {
    if (!state.project || !state.activeFrame) return;
    if (!probeActive) return;

    // Clicking an existing popover dismisses it
    if (probePopover) { _dismissProbe(); return; }

    const rect   = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width  / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const cx     = Math.min(Math.round((e.clientX - rect.left) * scaleX), canvasEl.width  - 1);
    const cy     = Math.min(Math.round((e.clientY - rect.top)  * scaleY), canvasEl.height - 1);
    const ctx    = canvasEl.getContext('2d');
    const pixel  = ctx.getImageData(cx, cy, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2];
    const L     = relativeLuminance(r, g, b);
    const ratio = contrastVsWhite(L);
    const level = wcagLevel(ratio);

    const canvasArea = root.querySelector('.editor-canvas-area');
    probePopover = document.createElement('div');
    probePopover.className = 'probe-popover';
    probePopover.title = 'Click canvas to dismiss';
    canvasArea.appendChild(probePopover);

    probePopover.textContent =
      `RGB: ${r}, ${g}, ${b}\n` +
      `Luminance: ${Math.round(L * 100)}%\n` +
      `Contrast vs white: ${ratio.toFixed(1)}:1\n` +
      `Level: ${level}`;

    // Position near click, clamped so the popover doesn't overflow the area
    const areaRect = canvasArea.getBoundingClientRect();
    const pw = 180, ph = 72;
    let px = e.clientX - areaRect.left + 14;
    let py = e.clientY - areaRect.top  + 14;
    if (px + pw > areaRect.width)  px = (e.clientX - areaRect.left) - pw - 14;
    if (py + ph > areaRect.height) py = (e.clientY - areaRect.top)  - ph - 14;
    probePopover.style.left = `${px}px`;
    probePopover.style.top  = `${py}px`;
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _dismissProbe();
  });

  // ── Canvas: drag image from tray ───────────
  canvasEl.addEventListener('dragover', e => {
    if (!state.project || !state.activeFrame) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvasEl.classList.add('drag-over');
  });
  canvasEl.addEventListener('dragleave', () => canvasEl.classList.remove('drag-over'));
  canvasEl.addEventListener('drop', e => {
    e.preventDefault();
    canvasEl.classList.remove('drag-over');
    if (!state.project || !state.activeFrame) return;
    const filename = e.dataTransfer.getData('text/plain');
    if (!filename || !state.images.has(filename)) return;
    const frame = state.activeFrame;
    if (frame.multi_image) {
      // Stack a new image layer at full size — user resizes from here
      const newLayer = {
        id:         `img-${Date.now()}`,
        type:       'image',
        src:        filename,
        position:   { zone: 'absolute', x_pct: 0, y_pct: 0 },
        width_pct:  100,
        height_pct: 100,
        fit:        'cover',
        opacity:    1,
      };
      frame.layers = frame.layers ?? [];
      // Insert after overlays, before text/shape layers
      const lastOverlayIdx = frame.layers.reduce((last, l, i) => l.type === 'overlay' ? i : last, -1);
      frame.layers.splice(lastOverlayIdx + 1, 0, newLayer);
      layerManager.selectLayer(newLayer.id);
    } else {
      // Existing behaviour — replace background image
      frame.image_filename = filename;
      const indexEntry = (state.project.image_index ?? []).find(i => i.filename === filename);
      if (indexEntry) frame.image_src = indexEntry.label;
    }
    events.dispatchEvent(new CustomEvent('frame:changed', {
      detail: { index: state.activeFrameIndex, frame: state.activeFrame },
    }));
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
        <div class="view-strip-group">
          <button id="btn-contrast" class="btn view-strip-btn" aria-pressed="false" title="Contrast map">Contrast</button>
          <button id="btn-weight"   class="btn view-strip-btn" aria-pressed="false" title="Visual weight map">Weight</button>
          <button id="btn-probe"    class="btn view-strip-btn" aria-pressed="false" title="Click canvas to probe pixel color and WCAG contrast">Probe</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group">
          <button id="btn-export-frame" class="btn view-strip-btn" title="Export current frame as PNG">Export Frame</button>
          <button id="btn-export-all"   class="btn view-strip-btn" title="Export all frames as PNG">Export All</button>
        </div>
        <div class="view-strip-sep"></div>
        <div class="view-strip-group view-strip-right">
          <button id="btn-layers-panel" class="btn view-strip-btn" aria-pressed="false" title="Toggle layers panel">Layers ▲</button>
        </div>
      </div>

    </div>
  `;
}
