# Project Persistence & Lifecycle Design

**Date:** 2026-04-09
**Status:** Approved

---

## Goal

Make projects fully persistent, cohesive entities. Every change auto-saves to localStorage. All project flows (create, open, edit, merge JSON, load images, delete) handle both the happy path and every meaningful edge case explicitly.

## Architecture

A project is one unified entity with three localStorage buckets sharing the same ID:

| Key | Contents |
|-----|----------|
| `pc_brief_{id}` | title, platform, tone, story, imageMeta[], createdAt, updatedAt |
| `pc_project_{id}` | full project JSON (frames, layers, design_tokens, export, image_index) |
| `pc_images_{id}` | `{ filename: DataURL }` map |

The brief ID is the universal key — all three buckets use it. `storage.saveProject()` and `storage.saveBrief()` already exist in `core/storage.js`; they are not currently called from the editor. This design wires them up.

### New module: `core/project-store.js`

The auto-save coordinator. Single responsibility: listen to change events, debounce, write to storage.

- Subscribes to: `layer:changed`, `frame:changed`, `layers:reordered`, `layer:deleted`
- Debounce: 500ms
- On flush: calls `storage.saveProject(state.project)` + updates `brief.updatedAt` via `storage.saveBrief()`
- On quota error: dispatches `project:save-failed` event with `{ reason: 'quota' }`
- On any write error: dispatches `project:save-failed` event with `{ reason: 'error' }`
- Exposes `flush()` — forces immediate synchronous save (used before navigation)

Nothing else calls `storage.saveProject()` directly. Project-store owns all writes.

### New UI modules

- `ui/modals/project-diff-modal.js` — frame-by-frame merge UI when loading a JSON file
- `ui/modals/delete-confirm-modal.js` — delete confirmation with project summary

---

## Flows

### 1. Project Creation (BriefWizard)

**Happy path:**
1. User completes BriefWizard
2. `storage.saveBrief(brief)` — saves metadata
3. `storage.saveProject({ project: { id: brief.id, title: brief.title }, frames: [], design_tokens: {}, export: {}, image_index: [] })` — saves empty project skeleton with matching ID
4. `storage.saveImages(brief.id, imageMap)` — saves uploaded images
5. Navigate to editor; project-store starts listening

**Edge — cancel mid-wizard:** No writes occur. No partial state left behind.

**Edge — image quota exceeded during wizard:**
- Partial image save is attempted
- Failed filenames returned by `storage.saveImages()`
- Toast: "X image(s) could not be saved (storage full): [filenames]. Project created without them."
- Project is still created and opened

---

### 2. Open Project (from Manager)

**Happy path:**
1. Load `pc_brief_{id}`, `pc_project_{id}`, `pc_images_{id}` from storage
2. Populate `state.project`, `state.images`, `state.activeBriefId`
3. Save `lastProjectId` to prefs
4. Navigate to editor

**Edge — `pc_project_{id}` missing or JSON.parse fails:**
- Error shown inline on project card: "Project data corrupted — cannot open"
- Offer "Delete project" button on the card
- Do not navigate to editor

**Edge — images partially or fully missing from storage (e.g. cleared externally):**
- Open project normally
- After load, compare `state.project.image_index` filenames against `state.images` keys
- If any missing: show dismissible banner in editor: "X image(s) could not be restored — reload them from disk"

---

### 3. Auto-save (while editing)

**Happy path:**
- Change event fires → project-store debounces 500ms → writes project JSON + updates `brief.updatedAt`
- Status indicator in editor header: "Saved" (after successful write) / "Saving…" (during debounce)

**Edge — localStorage quota exceeded:**
- `project:save-failed` dispatched with `reason: 'quota'`
- Persistent red banner in editor: "Auto-save failed — storage full. Export your project or delete unused projects to free space."
- Banner stays until a successful save

**Edge — write error (other):**
- `project:save-failed` dispatched with `reason: 'error'`
- Same persistent banner with generic message

---

### 4. Load JSON from File (diff/merge)

Triggered by the "Load JSON" button in the editor header.

**Step 1 — Parse and validate:**
- Read file as text → `JSON.parse()` → run through `shared/validator.js`
- On parse error or validation failure: error toast "Invalid project file: [reason]" — abort, no changes applied

**Step 2 — Diff:**
For each frame in the incoming JSON, classify against current `state.project.frames`:

| Classification | Condition |
|---------------|-----------|
| **Modified** | Same frame ID, at least one field differs |
| **New** | Frame ID exists only in incoming |
| **Removed** | Frame ID exists only in current |
| **Unchanged** | Same frame ID, identical content |

Changed fields detected per frame: `composition_pattern`, `bg_color`, `multi_image`, `image_filename`, and the full layers array (added/removed/modified layers by ID).

**Step 3 — Diff modal:**
- Header: "Merge incoming JSON into [project title]"
- One row per frame (unchanged frames hidden by default, "Show unchanged" toggle)
- Per modified frame: frame ID + label, list of changed fields, checkbox "Replace with incoming" (default: **unchecked** — current wins)
- Per new frame: label "New frame (not in current project)", checkbox "Add this frame" (default: **checked**)
- Per removed frame: label "Only in current project (not in file)", informational — no action taken by default
- Footer: "Apply X changes" button, "Cancel" button

**Step 4 — Apply:**
- For each frame marked "Replace": overwrite that frame in `state.project.frames`
- For each frame marked "Add": append to `state.project.frames`
- Removed frames: never touched (current project keeps them)
- Trigger `project:loaded` event → full re-render
- Project-store `flush()` called immediately — saves without waiting for debounce

**Edge — user cancels modal:** Zero changes applied. State untouched.

**Edge — all frames unchanged:** Modal still shown with message "No differences found." Cancel-only.

**Edge — incoming JSON has zero frames:** Modal shown: "Incoming file has no frames." Cancel-only.

---

### 5. Load Images (while in editor)

**Happy path:**
- Read files as DataURLs
- Merge into `state.images`
- `storage.saveImages(state.activeBriefId, newEntries)` — merges new entries
- Auto-save fires (project `image_index` may reference these filenames)

**Edge — filename already exists in `state.images`:**
- Before loading: detect collisions
- Show inline confirmation per colliding filename: "Replace existing '[filename]'?" with Yes / Skip buttons
- Non-colliding files load immediately without waiting

**Edge — quota exceeded:**
- Attempt to save each image individually
- Return list of failed filenames from `storage.saveImages()`
- Toast: "X image(s) could not be saved (storage full): [filenames]"
- Successfully saved images are available normally

---

### 6. Delete Project (from Manager)

**Happy path:**
1. User clicks Delete on a project card
2. Confirmation modal shows:
   - Project title
   - Frame count
   - Image count
   - Last saved timestamp
   - Warning: "This cannot be undone."
3. User confirms → delete `pc_project_{id}`, `pc_brief_{id}`, `pc_images_{id}`
4. Remove from project list in UI

**Edge — project is currently open in editor:**
- Detect via `state.activeBriefId === id`
- Force navigate back to manager first (project-store `flush()` is NOT called — we're deleting)
- Then delete all three buckets
- Clear `state.project`, `state.images`, `state.activeBriefId`
- Clear `lastProjectId` from prefs

**Edge — one bucket deletion fails:**
- Show error: "Could not fully delete project — try again"
- Do not remove from project list
- No partial deletes left visible to user (re-read storage to verify actual state)

---

### 7. Session Restoration (app load)

**Happy path:**
1. `prefs.lastProjectId` exists
2. Load all three buckets
3. Navigate to editor (skipping manager)

**Edge — stored project JSON is missing or corrupt:**
- Delete `pc_project_{id}` from storage
- Clear `lastProjectId` from prefs
- Navigate to manager
- Toast: "Your last project could not be restored."

**Edge — images partially missing:**
- Navigate to editor normally
- Show missing-images banner (same as flow 2 edge)

**Edge — no `lastProjectId`:**
- Show manager as normal

---

### 8. Navigate Back to Manager

- `project-store.flush()` called synchronously before navigation
- No "unsaved changes" confirmation needed — flush guarantees state is written
- `state.project`, `state.images` are cleared after flush to free memory

---

## Status Indicator

A small persistent element in the editor header (right side) showing:

| State | Display |
|-------|---------|
| Changes pending | "Saving…" (muted) |
| Last save successful | "Saved [time]" (muted) |
| Save failed | "Save failed" (red) |

Clicking "Save failed" opens a tooltip explaining the reason and next steps.

---

## Storage Quota Strategy

- Images are the primary quota consumer (DataURLs can be large)
- Project JSON is typically small (< 50 KB)
- On quota error: banner directs user to delete unused projects via manager
- No automatic compression or eviction — user decides what to remove

---

## Files Affected

**Modified:**
- `core/storage.js` — ensure `saveProject` stores with brief ID as key; add `updatedAt` stamp to `saveBrief`
- `editor/frame-manager.js` — add `mergeProject(incomingData)` method (diff logic); `loadProject` no longer sets state directly without going through project-store
- `editor/shell.js` — wire "Load JSON" through diff modal; wire image duplicate detection; show save-status indicator; flush on back navigation
- `manager/brief-wizard.js` — save project skeleton on wizard completion
- `manager/projects.js` — wire delete through confirmation modal; show corrupted-project state on cards
- `app.js` — session restoration on load

**New:**
- `core/project-store.js` — auto-save coordinator
- `ui/modals/project-diff-modal.js` — frame diff/merge UI
- `ui/modals/delete-confirm-modal.js` — delete confirmation UI
