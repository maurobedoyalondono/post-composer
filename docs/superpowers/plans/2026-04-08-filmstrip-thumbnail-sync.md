# Filmstrip Thumbnail Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep filmstrip thumbnails in sync with every layer mutation — not just project load and image load.

**Architecture:** Add a `_renderFrame(index)` method to `Filmstrip` and wire three new event listeners (`layer:changed`, `layer:deleted`, `layers:reordered`). Also update the `frame:changed` listener to re-render the incoming frame's thumbnail so image-drag assignments are reflected immediately.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, post-composer event bus (`core/events.js`).

---

## File Structure

| File | Change |
|------|--------|
| `ui/filmstrip.js` | Add `_renderFrame(index)`; add three event listeners; update `frame:changed` handler |

---

### Task 1: Add `_renderFrame` and wire mutation events

**Files:**
- Modify: `ui/filmstrip.js`

- [ ] **Step 1: Open `ui/filmstrip.js` and read the current constructor**

The constructor currently has:
```js
events.addEventListener('project:loaded',  () => this._build());
events.addEventListener('images:loaded',   () => this._renderAll());
events.addEventListener('frame:changed',   e  => this._setActive(e.detail.index));
```

- [ ] **Step 2: Replace the constructor event wiring and add `_renderFrame`**

Replace the entire file with:

```js
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

    events.addEventListener('project:loaded',   () => this._build());
    events.addEventListener('images:loaded',    () => this._renderAll());
    events.addEventListener('frame:changed',    e  => {
      this._setActive(e.detail.index);
      this._renderFrame(e.detail.index);
    });
    // Re-render the active frame thumbnail on any layer mutation
    events.addEventListener('layer:changed',    () => this._renderFrame(this._state.activeFrameIndex));
    events.addEventListener('layer:deleted',    () => this._renderFrame(this._state.activeFrameIndex));
    events.addEventListener('layers:reordered', () => this._renderFrame(this._state.activeFrameIndex));
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

  /** Re-render one thumbnail by frame index. */
  _renderFrame(index) {
    const project = this._state.project;
    if (!project) return;
    const item = this._items[index];
    if (!item) return;
    renderer.renderFrame(item.canvas, project.frames[index], project, this._state.images);
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
```

- [ ] **Step 3: Verify in browser**

1. Open the app, load `canyon-series-2026.json`
2. Load the four canyon images
3. Select frame 1 (editorial-anchor) — click a text layer in the layers panel
4. In the inspector, change the font size — filmstrip thumbnail for frame 1 should update immediately
5. Delete a layer — thumbnail updates
6. Click frame 3 — thumbnail re-renders
7. Drag an image from the tray onto the canvas — frame thumbnail updates

- [ ] **Step 4: Commit**

```bash
git add ui/filmstrip.js
git commit -m "fix: filmstrip thumbnails now update on layer mutations and frame navigation"
```
