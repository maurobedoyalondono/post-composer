# Filmstrip Thumbnail Sync — Design Spec

**Goal:** Keep filmstrip thumbnails in sync with all frame state changes — layer edits, layer deletions, reorders, and image assignment — not just project load and image load.

---

## Problem

`Filmstrip` listens to `project:loaded` (rebuilds) and `images:loaded` (re-renders all). It does **not** listen to `layer:changed`, `layer:deleted`, or `layers:reordered`. Any edit made via the inspector — moving a layer, changing text, toggling a shadow — updates the canvas but leaves every filmstrip thumbnail showing the old state.

---

## Root Cause

`ui/filmstrip.js` constructor wires three events only:

```js
events.addEventListener('project:loaded',  () => this._build());
events.addEventListener('images:loaded',   () => this._renderAll());
events.addEventListener('frame:changed',   e  => this._setActive(e.detail.index));
```

`frame:changed` only sets the active highlight — it does not re-render. `layer:changed`, `layer:deleted`, and `layers:reordered` are never handled.

---

## Fix — `ui/filmstrip.js`

### New method: `_renderFrame(index)`

Renders one thumbnail by index. Used when only one frame is known to have changed.

```js
_renderFrame(index) {
  const project = this._state.project;
  if (!project) return;
  const item = this._items[index];
  if (!item) return;
  renderer.renderFrame(item.canvas, project.frames[index], project, this._state.images);
}
```

### Updated constructor — additional event listeners

```js
// Re-render the active frame's thumbnail on any layer mutation
events.addEventListener('layer:changed',     () => this._renderFrame(this._state.activeFrameIndex));
events.addEventListener('layer:deleted',     () => this._renderFrame(this._state.activeFrameIndex));
events.addEventListener('layers:reordered',  () => this._renderFrame(this._state.activeFrameIndex));
```

Layer mutations always apply to the currently active frame, so `state.activeFrameIndex` is the correct target. Re-rendering all thumbnails on every keystroke (e.g. typing in a text field) would be wasteful; targeted single-frame re-render is the right trade-off.

### `frame:changed` — also re-render the incoming frame

When the user clicks a different frame in the filmstrip, `frame:changed` fires. The new active frame's thumbnail should be refreshed at that point too (catches image-drag assignment that doesn't fire a separate event):

```js
events.addEventListener('frame:changed', e => {
  this._setActive(e.detail.index);
  this._renderFrame(e.detail.index);
});
```

---

## File Impact Summary

| File | Change |
|------|--------|
| `ui/filmstrip.js` | Add `_renderFrame(index)` method; add listeners for `layer:changed`, `layer:deleted`, `layers:reordered`; update `frame:changed` listener to also call `_renderFrame` |

---

## Out of Scope

- Debouncing thumbnail re-renders (not needed — canvas renders at 64 px are fast)
- Thumbnail re-render progress indicator
