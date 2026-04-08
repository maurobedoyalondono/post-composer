# Editor UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the editor shell into a project-header + 3-panel layout (filmstrip+tray | canvas | inspector) with a bottom view strip, floating draggable layers panel, and inspector-hosted layer controls — eliminating the context toolbar.

**Architecture:** Pure HTML/CSS/JS restructure — no new logic, no feature changes. The 4 toolbar renderer functions (`renderTextToolbar` etc.) are reused as-is, now called from the Inspector instead of the context toolbar. The LayersPanel becomes a fixed-position floating element appended to `document.body`. The bottom view strip replaces the top toolbar for guides and overlay toggles.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas, no build step. Browser-only. Live server at `http://localhost:5500`.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `styles/shell.css` | Modify | New header, left panel split, view strip, remove context-toolbar, inspector → 280px |
| `styles/components.css` | Modify | Layer badges, image tray cells, view-strip buttons, layers-panel → fixed position |
| `editor/shell.js` | Modify | New `_buildHTML()`, wiring: header nav, Load JSON/Images, view strip, layers toggle; remove context-toolbar |
| `ui/image-tray.js` | Create | Image grid component, listens to `images:loaded` |
| `ui/inspector.js` | Modify | Absorbs layer controls via toolbar renderers; WCAG badge slot; layer type badge |
| `ui/layers-panel.js` | Modify | `show()` / `hide()` / `toggle()` methods; drag-by-header |
| `tests/editor/integration-2c-pre.html` | Create | Smoke tests for new layout wiring |

---

## Task 1: CSS — Shell Layout

**Files:**
- Modify: `styles/shell.css`

- [ ] **Step 1: Replace shell.css with the new layout**

```css
/* styles/shell.css — Editor layout */

.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

/* ── Project header ──────────────────────── */
.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 48px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.btn-back {
  background: none;
  border: none;
  color: var(--color-accent-2);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: color 0.1s, background 0.1s;
}

.btn-back:hover {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.header-project-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-project-name.no-project {
  color: var(--color-text-muted);
  font-weight: 400;
}

.header-project-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Body (left | canvas | inspector) ────── */
.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Left panel (filmstrip + image tray) ─── */
.editor-left-panel {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.editor-filmstrip {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.editor-image-tray {
  height: 160px;
  flex-shrink: 0;
  overflow-y: auto;
  border-top: 1px solid var(--color-border);
  padding: 6px;
}

/* ── Canvas area ─────────────────────────── */
.editor-canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-bg);
  position: relative;
}

.editor-canvas-area canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

/* ── Inspector ───────────────────────────── */
.editor-inspector {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.inspector-section {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.inspector-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.inspector-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
  font-size: 12px;
}

.inspector-row .label {
  color: var(--color-text-muted);
}

.inspector-row .value {
  color: var(--color-text);
  font-weight: 500;
  text-align: right;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Empty state ─────────────────────────── */
.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 32px;
}

.editor-empty p {
  margin: 0;
  line-height: 1.5;
}

/* ── Bottom view strip ───────────────────── */
.editor-view-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.view-strip-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.view-strip-group.view-strip-right {
  margin-left: auto;
}

.view-strip-sep {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 2px;
}
```

- [ ] **Step 2: Verify the file saved — open `styles/shell.css` and confirm it starts with `/* styles/shell.css — Editor layout */`**

- [ ] **Step 3: Commit**

```bash
git add styles/shell.css
git commit -m "style: new editor shell layout — header, left panel, view strip"
```

---

## Task 2: CSS — Components

**Files:**
- Modify: `styles/components.css`

- [ ] **Step 1: Remove the context-toolbar block and add new component styles**

Find and remove this entire block from `styles/components.css`:

```css
/* ── Context toolbar ───────────────────────── */
.context-toolbar {
  display: flex;
  ...
}
/* ... all context-toolbar rules through the end of .context-toolbar .toolbar-sep */
```

Then append the following at the end of `styles/components.css`:

```css
/* ── Layer type badge ──────────────────────── */
.layer-type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.layer-type-badge.layer-type-text    { background: rgba(99,102,241,0.2);  color: var(--color-accent-2); }
.layer-type-badge.layer-type-shape   { background: rgba(16,185,129,0.2);  color: #6ee7b7; }
.layer-type-badge.layer-type-image,
.layer-type-badge.layer-type-logo    { background: rgba(245,158,11,0.2);  color: #fcd34d; }
.layer-type-badge.layer-type-overlay { background: rgba(107,114,128,0.2); color: #9ca3af; }

/* ── Inspector layer controls (absorbs context toolbar) ── */
.insp-layer-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 12px;
}

.insp-layer-controls label {
  color: var(--color-text-muted);
  font-size: 11px;
}

.insp-layer-controls select,
.insp-layer-controls input[type="number"] {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 3px 6px;
  width: 70px;
}

.insp-layer-controls input[type="color"] {
  width: 28px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  padding: 1px;
}

.insp-layer-controls input[type="checkbox"] {
  cursor: pointer;
}

.insp-layer-controls .toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  flex-shrink: 0;
}

/* ── Image tray ────────────────────────────── */
.image-tray-empty {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 16px 8px;
}

.image-tray-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.image-tray-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: default;
}

.image-tray-cell img {
  width: 76px;
  height: 76px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  display: block;
}

.image-tray-label {
  font-size: 9px;
  color: var(--color-text-muted);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 76px;
}

/* ── View strip buttons ────────────────────── */
.view-strip-btn {
  padding: 3px 8px;
  font-size: 11px;
  height: 26px;
}

/* ── Layers panel — now fixed floating ─────── */
.layers-panel {
  position: fixed;
  bottom: 48px;
  left: 16px;
  width: 220px;
  max-height: 50vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: none;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.layers-panel.open {
  display: flex;
}

.layers-panel-header {
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  cursor: move;
  user-select: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components.css
git commit -m "style: layer badges, image tray, view strip, floating layers panel"
```

---

## Task 3: Shell Restructure

**Files:**
- Modify: `editor/shell.js`

- [ ] **Step 1: Replace the entire `editor/shell.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add editor/shell.js
git commit -m "feat: restructure editor shell — header, view strip, floating layers panel"
```

---

## Task 4: ImageTray Component

**Files:**
- Create: `ui/image-tray.js`

- [ ] **Step 1: Create `ui/image-tray.js`**

```js
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
          <img src="${_esc(img.src)}" alt="${_esc(_basename(key))}">
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
```

- [ ] **Step 2: Commit**

```bash
git add ui/image-tray.js
git commit -m "feat: add ImageTray component"
```

---

## Task 5: Inspector Absorbs Layer Controls

**Files:**
- Modify: `ui/inspector.js`

- [ ] **Step 1: Replace `ui/inspector.js`**

```js
// ui/inspector.js
import { events }              from '../core/events.js';
import { renderTextToolbar }   from './toolbars/text-toolbar.js';
import { renderShapeToolbar }  from './toolbars/shape-toolbar.js';
import { renderImageToolbar }  from './toolbars/image-toolbar.js';
import { renderOverlayToolbar} from './toolbars/overlay-toolbar.js';

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

/**
 * Inspector panel — frame metadata, editable composition_pattern,
 * and selected layer controls (absorbs context toolbar).
 */
export class Inspector {
  /**
   * @param {HTMLElement} container — .editor-inspector element
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    events.addEventListener('project:loaded', () => this._render());
    events.addEventListener('frame:changed',  () => this._render());
    events.addEventListener('layer:selected', () => this._render());
    events.addEventListener('layer:deleted',  () => this._render());
    events.addEventListener('layer:changed',  () => this._renderLayerSection());

    // Plan 2c: listen for analysis:contrast to update WCAG badge
    events.addEventListener('analysis:contrast', e => {
      const badge = this._el.querySelector('#insp-wcag-badge');
      if (!badge) return;
      const { ratio, level } = e.detail;
      badge.textContent = level;
      badge.className = `wcag-badge wcag-${level.toLowerCase().replace(' ', '-')}`;
      badge.style.display = '';
    });
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame) {
      this._el.innerHTML = `<div class="editor-empty"><p>Load a project JSON<br>to get started.</p></div>`;
      return;
    }

    this._el.innerHTML = `
      <div class="inspector-section" id="insp-frame">
        <div class="inspector-section-title">Frame</div>
        <div class="inspector-row">
          <span class="label">ID</span>
          <span class="value" title="${_esc(frame.id)}">${_esc(frame.id)}</span>
        </div>
        ${frame.label ? `
        <div class="inspector-row">
          <span class="label">Label</span>
          <span class="value" title="${_esc(frame.label)}">${_esc(frame.label)}</span>
        </div>` : ''}
        <div class="inspector-row">
          <span class="label">Index</span>
          <span class="value">${this._state.activeFrameIndex + 1} / ${this._state.project.frames.length}</span>
        </div>
      </div>

      <div class="inspector-section" id="insp-composition">
        <div class="inspector-section-title">Composition</div>
        <div style="margin-bottom:6px;">
          <select id="insp-pattern-select" style="width:100%;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;padding:4px 6px;">
            ${VALID_COMPOSITION_PATTERNS.map(p =>
              `<option value="${p}"${frame.composition_pattern === p ? ' selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="inspector-section" id="insp-layer-props">
      </div>
    `;

    this._el.querySelector('#insp-pattern-select')?.addEventListener('change', e => {
      const frame = this._state.activeFrame;
      if (!frame) return;
      frame.composition_pattern = e.target.value;
      events.dispatchEvent(new CustomEvent('frame:changed', { detail: { index: this._state.activeFrameIndex } }));
    });

    this._renderLayerSection();
  }

  /** Re-render only the layer section — called on layer:changed to avoid full flicker. */
  _renderLayerSection() {
    const section = this._el.querySelector('#insp-layer-props');
    if (!section) return;

    const layerId = this._state.selectedLayerId;
    if (!layerId) {
      section.innerHTML = '<div class="editor-empty" style="padding:8px;font-size:11px;color:var(--color-text-muted);">Select a layer to edit</div>';
      return;
    }

    const frame = this._state.activeFrame;
    const layer = frame?.layers?.find(l => l.id === layerId);
    if (!layer) { section.innerHTML = ''; return; }

    const isText = layer.type === 'text';

    section.innerHTML = `
      <div class="inspector-section-title">
        <span class="layer-type-badge layer-type-${_esc(layer.type)}">${_esc(layer.type)}</span>
        <span style="color:var(--color-text-muted);font-family:var(--font-mono);font-size:9px;">${_esc(layer.id)}</span>
      </div>
      <div class="insp-layer-controls" id="insp-layer-controls"></div>
      <div class="inspector-row" style="margin-top:6px;">
        <span class="label">Zone</span>
        <span class="value">${_esc(layer.position?.zone ?? '—')}</span>
      </div>
      ${isText ? `
      <div class="inspector-row">
        <span class="label">WCAG</span>
        <span class="wcag-badge" id="insp-wcag-badge" style="display:none"></span>
      </div>` : ''}
    `;

    const controlsEl = section.querySelector('#insp-layer-controls');
    const fi = this._state.activeFrameIndex;
    switch (layer.type) {
      case 'text':    renderTextToolbar(controlsEl, layer, fi, this._lm);    break;
      case 'shape':   renderShapeToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'image':
      case 'logo':    renderImageToolbar(controlsEl, layer, fi, this._lm);   break;
      case 'overlay': renderOverlayToolbar(controlsEl, layer, fi, this._lm); break;
    }
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/inspector.js
git commit -m "feat: inspector absorbs layer controls, adds WCAG badge slot"
```

---

## Task 6: LayersPanel — Floating + Drag

**Files:**
- Modify: `ui/layers-panel.js`

- [ ] **Step 1: Replace `ui/layers-panel.js`**

```js
// ui/layers-panel.js
import { events } from '../core/events.js';

/**
 * Floating layer list panel.
 * Shows layers for the active frame in reverse render order (top layer first).
 * Supports: click-to-select, visibility toggle, delete, drag-to-reorder, drag-by-header.
 */
export class LayersPanel {
  /**
   * @param {HTMLElement} container — .layers-panel element (appended to body by shell)
   * @param {import('../core/state.js').AppState} state
   * @param {import('../editor/layer-manager.js').LayerManager} layerManager
   */
  constructor(container, state, layerManager) {
    this._el = container;
    this._state = state;
    this._lm = layerManager;

    for (const ev of ['project:loaded', 'frame:changed', 'layer:changed', 'layer:deleted', 'layers:reordered']) {
      events.addEventListener(ev, () => this._render());
    }
    events.addEventListener('layer:selected', () => this._syncActive());

    // Event delegation — one listener per event type, wired once
    this._el.addEventListener('click', e => this._onClick(e));
    this._el.addEventListener('dragstart', e => this._onDragStart(e));
    this._el.addEventListener('dragover', e => e.preventDefault());
    this._el.addEventListener('drop', e => this._onDrop(e));

    this._initDrag();
  }

  /** Show the panel. Returns true. */
  show() {
    this._el.classList.add('open');
    return true;
  }

  /** Hide the panel. Returns false. */
  hide() {
    this._el.classList.remove('open');
    return false;
  }

  /** Toggle open/closed. Returns the new open state (true = open). */
  toggle() {
    const isOpen = this._el.classList.toggle('open');
    return isOpen;
  }

  _render() {
    const frame = this._state.activeFrame;
    if (!frame?.layers?.length) {
      this._el.innerHTML = `
        <div class="layers-panel-header">Layers</div>
        <div class="layers-panel-empty">No layers</div>
      `;
      this._initDrag();
      return;
    }

    const layers = [...frame.layers].reverse();
    const selectedId = this._state.selectedLayerId;

    this._el.innerHTML = `
      <div class="layers-panel-header">Layers</div>
      <ul class="layers-list">
        ${layers.map((l, visIdx) => {
          const realIdx = frame.layers.length - 1 - visIdx;
          return `<li class="layer-item${l.id === selectedId ? ' active' : ''}"
                      data-id="${l.id}" data-idx="${realIdx}" draggable="true">
            <button class="vis-btn${l.hidden ? ' hidden' : ''}" data-id="${l.id}" title="Toggle visibility">👁</button>
            <span class="layer-type">${l.type}</span>
            <span class="layer-id" title="${l.id}">${l.id}</span>
            <button class="del-btn" data-id="${l.id}" title="Delete layer">✕</button>
          </li>`;
        }).join('')}
      </ul>
    `;
    this._initDrag();
  }

  /** Wire drag-by-header so the panel can be repositioned. */
  _initDrag() {
    const header = this._el.querySelector('.layers-panel-header');
    if (!header) return;

    let startX, startY, origLeft, origTop;

    const onMouseMove = e => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this._el.style.left   = `${origLeft + dx}px`;
      this._el.style.top    = `${origTop  + dy}px`;
      this._el.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };

    header.addEventListener('mousedown', e => {
      const rect = this._el.getBoundingClientRect();
      startX   = e.clientX;
      startY   = e.clientY;
      origLeft = rect.left;
      origTop  = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);
      e.preventDefault();
    });
  }

  _onClick(e) {
    const delBtn = e.target.closest('.del-btn');
    if (delBtn) {
      this._lm.deleteLayer(this._state.activeFrameIndex, delBtn.dataset.id);
      return;
    }
    const visBtn = e.target.closest('.vis-btn');
    if (visBtn) {
      this._lm.toggleVisibility(this._state.activeFrameIndex, visBtn.dataset.id);
      return;
    }
    const item = e.target.closest('.layer-item');
    if (item) {
      this._lm.selectLayer(item.dataset.id);
    }
  }

  _onDragStart(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;
    e.dataTransfer.setData('text/plain', item.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  _onDrop(e) {
    e.preventDefault();
    const item = e.target.closest('.layer-item');
    if (!item) return;
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIdx   = parseInt(item.dataset.idx, 10);
    if (fromIdx !== toIdx) {
      this._lm.reorderLayer(this._state.activeFrameIndex, fromIdx, toIdx);
    }
  }

  _syncActive() {
    const selectedId = this._state.selectedLayerId;
    this._el.querySelectorAll('.layer-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === selectedId);
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/layers-panel.js
git commit -m "feat: LayersPanel — show/hide/toggle, drag-by-header"
```

---

## Task 7: Integration Smoke Test

**Files:**
- Create: `tests/editor/integration-2c-pre.html`

- [ ] **Step 1: Create `tests/editor/integration-2c-pre.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Editor UI Redesign — Smoke Test (2c-pre)</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    .pass { color:#10b981; } .fail { color:#ef4444; }
  </style>
</head>
<body>
  <h1>Editor UI Redesign — Smoke Test (2c-pre)</h1>
  <div id="results"></div>

  <script type="module">
    import { AppState }     from '../../core/state.js';
    import { LayerManager } from '../../editor/layer-manager.js';
    import { LayersPanel }  from '../../ui/layers-panel.js';
    import { ImageTray }    from '../../ui/image-tray.js';
    import { Inspector }    from '../../ui/inspector.js';
    import { events }       from '../../core/events.js';

    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function check(label, condition) {
      const ok = !!condition;
      if (ok) passed++; else failed++;
      results.innerHTML += `<div class="${ok ? 'pass' : 'fail'}">[${ok ? 'PASS' : 'FAIL'}] ${label}</div>`;
    }

    // ── Minimal project ────────────────────────────────────────────────────
    const project = {
      project:  { id: 'test-2c-pre', title: 'Redesign Test' },
      export:   { target: 'instagram-square', width_px: 1080, height_px: 1080 },
      design_tokens: {
        palette: { background: '#000000', primary: '#ffffff', accent: '#6366f1', neutral: '#6b7280' },
        type_scale: { display: { family: 'sans-serif', steps: [48] }, body: { family: 'sans-serif', steps: [16] }, data: { family: 'sans-serif', steps: [12] } },
        spacing_scale: [8, 16, 24],
      },
      variety_contract: { zone_max_usage_pct: 60, shape_quota: { min_per_n_frames: 3, waiver: true }, overlay_strategies: ['gradient'], silence_map: [], composition_patterns: {} },
      frames: [{
        id: 'f1',
        image_src: '',
        image_filename: 'test.jpg',
        composition_pattern: 'full-bleed',
        layers: [
          { id: 'layer-text', type: 'text', content: 'Hello', font: { size_pct: 5, line_height: 1.25 }, max_width_pct: 80, position: { zone: 'top-left' } },
          { id: 'layer-shape', type: 'shape', shape: 'rect', role: 'divider', position: { zone: 'bottom-left' }, width_pct: 50, height_pct: 5 },
        ],
      }],
    };

    const state = new AppState();
    state.setProject(project);
    const lm = new LayerManager(state);

    // ── Check 1: LayersPanel show/hide/toggle ──────────────────────────────
    const panelEl = document.createElement('div');
    panelEl.className = 'layers-panel';
    document.body.appendChild(panelEl);
    const lp = new LayersPanel(panelEl, state, lm);

    check('LayersPanel.show() returns true',  lp.show() === true);
    check('LayersPanel panel has class open after show', panelEl.classList.contains('open'));
    check('LayersPanel.hide() returns false', lp.hide() === false);
    check('LayersPanel panel lacks class open after hide', !panelEl.classList.contains('open'));
    check('LayersPanel.toggle() opens and returns true', lp.toggle() === true);
    check('LayersPanel.toggle() closes and returns false', lp.toggle() === false);

    // ── Check 2: ImageTray renders empty state ──────────────────────────────
    const trayEl = document.createElement('div');
    const it = new ImageTray(trayEl, state);
    check('ImageTray shows empty state when no images', trayEl.innerHTML.includes('No images'));

    // ── Check 3: ImageTray renders images on images:loaded ──────────────────
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = () => {
      state.images.set('test-image.jpg', img);
      events.dispatchEvent(new CustomEvent('images:loaded'));
      check('ImageTray shows image cells after images:loaded', trayEl.querySelector('.image-tray-cell') !== null);
      check('ImageTray shows image label', trayEl.innerHTML.includes('test-image.jpg'));

      // ── Check 4: Inspector renders layer controls ──────────────────────────
      const inspEl = document.createElement('div');
      const insp = new Inspector(inspEl, state, lm);
      lm.selectLayer('layer-text');

      check('Inspector renders layer type badge for text', inspEl.innerHTML.includes('layer-type-text'));
      check('Inspector renders WCAG badge slot', inspEl.querySelector('#insp-wcag-badge') !== null);
      check('Inspector renders insp-layer-controls', inspEl.querySelector('#insp-layer-controls') !== null);

      lm.selectLayer('layer-shape');
      check('Inspector renders layer type badge for shape', inspEl.innerHTML.includes('layer-type-shape'));

      // ── Check 5: analysis:contrast updates WCAG badge ──────────────────────
      lm.selectLayer('layer-text');
      const badge = inspEl.querySelector('#insp-wcag-badge');
      events.dispatchEvent(new CustomEvent('analysis:contrast', { detail: { ratio: 4.8, level: 'AA' } }));
      check('WCAG badge text updates on analysis:contrast', badge?.textContent === 'AA');
      check('WCAG badge gains wcag-aa class', badge?.classList.contains('wcag-aa'));

      // ── Summary ───────────────────────────────────────────────────────────
      results.innerHTML += `<hr><b>${passed} passed, ${failed} failed</b>`;
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: Open the test in the browser**

Navigate to: `http://localhost:5500/tests/editor/integration-2c-pre.html`

Expected: All checks pass (green). The image:loaded check requires the inline data URI image to load — this happens asynchronously, so the final checks appear ~50ms after page load.

- [ ] **Step 3: Commit**

```bash
git add tests/editor/integration-2c-pre.html
git commit -m "test: editor UI redesign smoke test (2c-pre)"
```

---

## Self-Review Checklist

- [x] `← Projects` button → `router.navigate('manager')` — wired in shell Task 3
- [x] Project name from `state.project?.project?.title` — wired in shell Task 3
- [x] Load JSON / Load Images in header — wired in shell Task 3
- [x] Left panel 180px with filmstrip + image tray — CSS Task 1, shell Task 3
- [x] Filmstrip unchanged (component not modified) — `THUMB_W` still 64; filmstrip CSS allows parent to control width
- [x] Image tray renders images, empty state — ImageTray Task 4, CSS Task 2
- [x] Layers panel `position: fixed` bottom-left — CSS Task 2
- [x] Layers panel appended to `document.body` in shell — Task 3
- [x] Layers panel `show/hide/toggle` — Task 6
- [x] Toggle button in view strip updates `aria-pressed` and label text — Task 3
- [x] Drag-by-header in layers panel — Task 6 `_initDrag()`
- [x] Inspector absorbs layer controls — Task 5 `_renderLayerSection()`
- [x] Inspector calls toolbar renderers with `.insp-layer-controls` container — Task 5
- [x] WCAG badge slot (`#insp-wcag-badge`) hidden by default, shown on `analysis:contrast` event — Task 5
- [x] Layer type badge with per-type color — CSS Task 2, Inspector Task 5
- [x] Context toolbar removed from HTML, CSS, and shell wiring — Task 1, Task 2, Task 3
- [x] View strip: guides, safe zone, bounds — Task 3
- [x] `_fitCanvas` unchanged — Task 3
- [x] `_repaint` unchanged — Task 3
- [x] No references to removed `_updateContextToolbar` — cleaned in Task 3
- [x] Integration test covers: show/hide/toggle, image tray, inspector layer controls, WCAG badge — Task 7
