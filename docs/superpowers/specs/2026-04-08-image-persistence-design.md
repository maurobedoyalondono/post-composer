# Image Persistence — Design Spec

**Goal:** Make editor-loaded images durable across navigation, page reloads, and tab restores by storing them in localStorage keyed per brief, following the same pattern as FrameForge but adapted to post-composer's architecture.

---

## Problem

Images loaded via the "Load Images" button in the editor live only in `state.images` (in-memory) and a `sessionStorage` backup. Both are lost on tab close. `sessionStorage` also fails silently when the combined image data exceeds quota (~5–10 MB). The result: images disappear when navigating between views or reloading the page.

---

## Solution: `pc_images_{briefId}` in localStorage

Add a dedicated image store in localStorage, keyed by brief ID. On every editor open, images are loaded from this store (plus the brief's own `imageMeta`). On every "Load Images" action, images are saved to this store immediately.

---

## 1. Storage Layer — `core/storage.js`

Add three functions to the existing module. No new file.

**`saveImages(briefId, imageMap)`**
- `imageMap`: `{ [filename]: dataURL }`
- Reads existing `pc_images_{briefId}`, merges with new map: `{ ...existing, ...imageMap }`
- Writes merged result back to localStorage
- On quota error: attempts per-file fallback saves, skips files that still fail
- Returns `string[]` of filenames that could not be saved (empty array on full success)

**`loadImages(briefId)`** → `{ [filename]: dataURL }`
- Reads `pc_images_{briefId}` from localStorage
- Returns parsed object, or `{}` if key is absent or parse fails

**`deleteImages(briefId)`**
- Removes `pc_images_{briefId}` from localStorage
- Called when a brief is deleted

---

## 2. Editor Open — `editor/shell.js` (`_applyActiveBrief`)

On every navigation to the editor (mount + subsequent `view:changed → editor` events), merge images from both sources into `state.images`:

1. `brief.imageMeta[]` filtered to entries with a `dataUrl`
2. `Object.entries(storage.loadImages(briefId))`

For each `{ filename, dataUrl/value }` pair, skip if `state.images.has(filename)` already (dedup). Load missing ones via `new Image()` in parallel (`Promise.all`). Fire `images:loaded` only if at least one new image was added.

The existing guard `if (!state.activeBriefId) return` stays. The old guard `if (state.project) return` is removed — images must always be loaded regardless of project state.

---

## 3. Save on Image Load — `editor/shell.js` (`imgInput.change`)

After `frameManager.loadImages(files)` resolves successfully, save the newly loaded images to localStorage:

```js
if (state.activeBriefId) {
  const imageMap = {};
  Array.from(files).forEach(f => {
    const img = state.images.get(f.name);
    if (img?.src) imageMap[f.name] = img.src;
  });
  storage.saveImages(state.activeBriefId, imageMap);
}
```

No UI feedback needed for quota failures in this pass (images still work for the current session even if they couldn't be persisted).

---

## 4. Remove sessionStorage

Delete `_saveSession`, `_loadSession`, `_clearSession`, and all callers (the session restore IIFE and all `events.addEventListener(..., () => _saveSession(state))` calls). The `_SESSION_KEY` constant is also removed.

The project JSON is in `state.project` (in-memory, set by `frameManager.loadProject`). Images are now in localStorage. sessionStorage is no longer needed.

---

## 5. Brief Deletion — `core/storage.js` (`deleteBrief`)

Extend `deleteBrief(id)` to call `deleteImages(id)` after removing the brief entry and index, ensuring no orphaned image data is left behind.

---

## File Impact Summary

| File | Change |
|------|--------|
| `core/storage.js` | Add `saveImages`, `loadImages`, `deleteImages`; extend `deleteBrief` |
| `editor/shell.js` | Update `_applyActiveBrief` (merge both image sources, remove project guard); save to localStorage in `imgInput.change`; remove all sessionStorage helpers and callers |

---

## Out of Scope

- Quota warning UI (images still work in-session if localStorage is full)
- Image deletion / management UI
- Syncing images across multiple tabs
