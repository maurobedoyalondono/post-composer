# Image Storage — Move to IndexedDB

**Date:** 2026-04-09
**Status:** Approved

---

## Problem

Images are stored in `localStorage` in two places:

1. `pc_brief_{id}` — the brief record includes `imageMeta: [{filename, label, dataUrl}]`. The raw base64 dataUrls make this record several MB per brief, immediately exceeding the 5 MB localStorage quota.
2. `pc_images_{id}` — a separate map of `{filename → dataUrl}` also in localStorage, also subject to the same quota.

Consequence: saving a brief with images throws `QuotaExceededError`, and because images were never successfully persisted, they are lost on every page reload.

---

## Solution

Move all image data out of localStorage into IndexedDB, which has no practical quota limit. Strip `dataUrl` out of `imageMeta` in the brief record so the brief stays small and text-only.

---

## Storage Split

| Store | Keys / data |
|---|---|
| `localStorage` | Projects, briefs (`imageMeta` as `[{filename, label}]` — no dataUrl), prefs, indexes |
| `IndexedDB` (`pc_images_db`) | All image blobs, keyed by `[briefId, filename]` → dataUrl string |

The existing `pc_images_{id}` localStorage keys are abandoned — images were not reliably saved there anyway, so there is nothing to migrate.

---

## New Module: `core/image-store.js`

Single-responsibility module encapsulating all IndexedDB image I/O. `storage.js` remains synchronous and text-only.

### IndexedDB schema

```
Database:     pc_images_db   (version 1)
Object store: images
Key path:     ['briefId', 'filename']   — compound, no autoincrement
Value shape:  { briefId, filename, dataUrl }
```

### API

```js
// Upsert one or more images for a brief.
imageStore.save(briefId, imageMap)   // imageMap: { [filename]: dataUrl }
                                     // returns Promise<void>

// Load all images for a brief.
imageStore.load(briefId)             // returns Promise<{ [filename]: dataUrl }>

// Delete all images for a brief (call when brief is deleted).
imageStore.delete(briefId)           // returns Promise<void>
```

### Implementation notes

- The DB connection is opened lazily on the first call and reused for the lifetime of the page.
- `load(briefId)` uses `IDBKeyRange.bound([briefId, ''], [briefId, '\uffff'])` to efficiently fetch all records for a brief in a single cursor scan.
- `delete(briefId)` uses the same key range with `IDBObjectStore.delete(range)`.
- All methods return Promises wrapping IndexedDB request events; no external library required.

---

## Changes to Existing Files

### `core/storage.js`

- **`saveBrief(brief)`**: strip `dataUrl` from each entry in `imageMeta` before serialising. Store `[{filename, label}]` only. Input object is not mutated.
- **Remove** `saveImages`, `loadImages`, `deleteImages`. All callers updated to use `imageStore` directly.
- **`deleteBrief(id)`**: after removing the brief from localStorage, fire `imageStore.delete(id)` as a fire-and-forget (no await). Brief and index removal stays synchronous.

### `manager/brief-wizard.js`

- **`_save()`**: replace `storage.saveImages(brief.id, imageMap)` with `await imageStore.save(brief.id, imageMap)`.
- Import `imageStore` from `../core/image-store.js`.

### `editor/shell.js`

- **`_applyActiveBrief()`**: replace the two-source image merge (imageMeta.dataUrl + storage.loadImages) with a single `await imageStore.load(state.activeBriefId)` call. Remove the `brief.imageMeta.filter(m => m.dataUrl)` path entirely.
- **imgInput handler**: replace `storage.saveImages(state.activeBriefId, imageMap)` with `await imageStore.save(state.activeBriefId, imageMap)`. Update the error toast to reflect IndexedDB failure (not quota).
- Import `imageStore` from `../core/image-store.js`.

### `manager/shell.js`

- **`onExport`**: before calling `exportPackage`, load images from IndexedDB and hydrate `imageMeta`:
  ```js
  const storedImages = await imageStore.load(brief.id);
  const hydratedMeta = (brief.imageMeta ?? []).map(m => ({
    ...m,
    dataUrl: storedImages[m.filename] ?? null,
  }));
  await exportPackage(brief, hydratedMeta, platformLabel, toneLabel, slug);
  ```
- Import `imageStore` from `../core/image-store.js`.

---

## Flow Map (After Fix)

| Flow | Entry point | Behaviour |
|---|---|---|
| Create brief with images | `brief-wizard._save` | readFiles → imageMeta strips dataUrl → saveBrief (brief stays small) → imageStore.save → IndexedDB |
| Edit brief with new images | `brief-wizard._save` | Same as create; replaces existing IndexedDB entries for changed filenames |
| Editor reload | `editor/shell._applyActiveBrief` | Loads images exclusively from `imageStore.load(briefId)` → IndexedDB → images survive reload |
| Load images in editor | `editor/shell` imgInput handler | frameManager.loadImages → state; imageStore.save → IndexedDB |
| Export package | `manager/shell.onExport` | Hydrate imageMeta with dataUrls from imageStore.load, then exportPackage generates image-sheet.jpg |
| Delete brief | `projects.js → storage.deleteBrief` | Removes brief+project from localStorage; imageStore.delete removes all images from IndexedDB |

---

## Testing

- `tests/core/image-store.test.js` — new test file covering: save/load round-trip, load returns empty map for unknown briefId, delete removes all images for a brief, save overwrites existing entry for same filename.
- Existing `tests/core/storage-briefs.test.js` — no changes needed (all fixtures use `imageMeta: []`).
- Existing `tests/manager/exporter.test.js` — no changes needed (exporter functions take imageMeta array directly, not storage).
