# Editor UI/UX Redesign (Plan 2c-pre)

## Goal

Restructure the editor shell into the correct three-panel layout defined by the master design spec — with a project header, proper left panel (filmstrip + image tray), clean canvas, full-property inspector, floating layers panel, and a bottom view strip. Eliminates the floating context toolbar by absorbing layer properties into the inspector. Establishes the layout slots that Plan 2c (visual analysis) will populate.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Projects  ·  [project name or "No project loaded"]           │
│               [Load JSON]  [Load Images]                        │
├───────────────┬─────────────────────────────┬───────────────────┤
│   LEFT PANEL  │       CANVAS AREA           │   INSPECTOR       │
│   (180px)     │       (flex: 1)             │   (280px)         │
│               │                             │                   │
│  ┌──────────┐ │                             │   (scrollable)    │
│  │Filmstrip │ │    ┌──────────────────┐    │                   │
│  │(thumbs,  │ │    │    <canvas>      │    │                   │
│  │ scroll)  │ │    └──────────────────┘    │                   │
│  ├──────────┤ │                             │                   │
│  │Image Tray│ │                             │                   │
│  │(grid,    │ │                             │                   │
│  │ scroll)  │ │                             │                   │
│  └──────────┘ │                             │                   │
├───────────────┴─────────────────────────────┴───────────────────┤
│  [⅓ Thirds][φ Phi][✛ Cross]  ·  [Safe Zone][Bounds]  ·  [Layers ▲]  │
└─────────────────────────────────────────────────────────────────┘

                  [Layers panel — floating, draggable]
```

---

## Project Header

A slim bar across the full width above the three panels.

**Left side:** `← Projects` button — calls `navigate('manager')`. Returns user to Project Manager view where they can switch projects or create new ones.

**Center:** Project name — reads from `state.project?.project?.title` or displays "No project loaded" in muted text when null.

**Right side:** `Load JSON` and `Load Images` — file inputs styled as secondary action buttons, labeled as project-level operations. These are the same file inputs currently in the toolbar, relocated into project context.

No guides, no overlay toggles here — those are view controls and belong in the view strip.

---

## Left Panel (180px)

Vertically split into two regions:

### Filmstrip (top, flex: 1, min-height: 0, scrollable)

Frame thumbnails, vertically stacked. Each thumbnail is 152px wide × proportional height (maintains export aspect ratio). Active frame highlighted. Clicking a thumbnail selects that frame.

Implemented by the existing `Filmstrip` component — only CSS changes needed (wider thumbnails).

### Image Tray (bottom, fixed height ~160px, scrollable)

A scrollable grid of loaded image thumbnails. Shows all images currently in `state.images`. Each cell shows the image filename below the thumbnail.

Purpose: visual reference for what images are loaded. Full drag-to-assign wiring is out of scope for this plan (Plan 4). The tray renders images and filenames only.

Implemented by `ui/image-tray.js` — new component, created in this plan.

A thin divider line separates the filmstrip from the image tray. When no images are loaded, image tray shows a muted "No images loaded" placeholder.

---

## Canvas Area (center, flex: 1)

The `<canvas>` element centered in the available space. No child elements — the layers panel is no longer a child of this div.

The canvas fitting logic (`_fitCanvas`) is unchanged.

---

## Inspector (right, 280px, scrollable)

Single scrollable column. Always visible. Content is context-sensitive:

### When no project is loaded

Empty state: "Load a project JSON to get started."

### When a project is loaded, no layer selected

**Frame section:**
- Composition pattern (display + editable `<select>`)
- Frame ID (read-only)
- Image filename (read-only, which image is assigned)

### When a layer is selected

**Layer section header:** Shows layer type badge (Text / Shape / Image / Overlay) and layer ID.

**Layer controls:** The same controls currently rendered by the 4 context toolbar renderers (`renderTextToolbar`, `renderShapeToolbar`, `renderImageToolbar`, `renderOverlayToolbar`) — rendered inline here instead of in the floating context toolbar.

**Below layer controls:** Frame section (composition pattern, frame ID) remains visible — the user can always see and change the frame-level properties without deselecting the layer.

### WCAG badge (Plan 2c slot)

A reserved row at the bottom of the Layer section for text layers: `<span id="insp-wcag-badge">`. Hidden when no text layer is selected. Plan 2c populates this — the HTML slot is created now.

---

## Bottom View Strip (full width, 36px)

Three groups separated by dividers:

**Guides group:** `[⅓ Thirds]  [φ Phi]  [✛ Cross]` — toggle buttons, mutually exclusive. Same logic as current `_wireGuideButtons`.

**Overlays group:** `[Safe Zone]  [Bounds]` — toggle buttons, independent. Same logic as current safe zone and bounds buttons.

**Panels group (right-aligned):** `[Layers ▲]` — toggles the floating layers panel open/closed. Arrow indicator flips when open.

**Analysis slots (Plan 2c):** Two buttons will be added here in Plan 2c: `[Contrast]` and `[Weight]`. The HTML slots are NOT created now — Plan 2c adds them.

---

## Floating Layers Panel

The layers panel is no longer a child of `.editor-canvas-area`. It is a `position: fixed` element appended to `document.body`.

**Default state:** Hidden (closed).

**Toggle:** The `[Layers ▲]` button in the view strip shows/hides it. The button's `aria-pressed` attribute reflects open state.

**Position:** Default position is `bottom: 48px; left: 16px` (just above the view strip, left side). The panel is draggable by its header — `mousedown` on `.layers-panel-header` activates drag; `mousemove` updates `left`/`top`; `mouseup` ends drag.

**Existing LayersPanel component:** No logic changes. Only the mount point and CSS positioning change.

---

## Context Toolbar — Eliminated

The `.context-toolbar` div is removed from the shell HTML. The `layer:selected` and `layer:deleted` listeners that called `_updateContextToolbar` are removed. The `_updateContextToolbar` function is removed.

The 4 toolbar renderer functions (`renderTextToolbar`, `renderShapeToolbar`, `renderImageToolbar`, `renderOverlayToolbar`) are NOT deleted — they are called from `Inspector._renderLayerSection()` instead.

---

## CSS Visual Design

**Header bar:** Dark surface (`--color-surface`), 48px height, `border-bottom: 1px solid var(--color-border)`. Project name in normal weight. Load JSON/Images as small secondary buttons (not the primary `.btn-primary` style). `← Projects` as a subtle text link with a left arrow.

**Left panel:** 180px width. Internal flexbox column: filmstrip grows to fill space, image tray fixed height. Divider between filmstrip and image tray.

**Image tray cells:** 64×64px thumbnails in a 2-column grid, `object-fit: cover`, filename truncated with ellipsis below.

**Inspector:** 280px width. Section headers: 10px uppercase, muted, letter-spaced. Layer type badge: small pill (colored by type — text=indigo, shape=emerald, image=amber, overlay=slate).

**Bottom view strip:** 36px height, `background: var(--color-surface)`, `border-top: 1px solid var(--color-border)`. Buttons are compact (28px height), icon + short label. Right-aligned Layers button has a `▲`/`▼` indicator.

**Floating layers panel:** `position: fixed`, `z-index: 100`, `min-width: 200px`, same surface background, rounded corners, drop shadow. Draggable header (`cursor: move`).

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `editor/shell.js` | Modify | Replace toolbar with header + view strip; remove context toolbar wiring; move layers panel mount to body |
| `ui/inspector.js` | Modify | Add `_renderLayerSection()` that calls the 4 toolbar renderers; add frame section; add WCAG slot |
| `ui/layers-panel.js` | Modify | Accept mount target as constructor arg (body instead of canvas-area); add drag-by-header |
| `ui/image-tray.js` | Create | New component — renders loaded images grid, listens to `images:loaded` |
| `styles/shell.css` | Modify | Left panel 180px + filmstrip/tray split; inspector 280px; header bar; view strip; remove context-toolbar styles |
| `styles/components.css` | Modify | Layer type badges; image tray cells; floating panel shadow; view strip button style |

---

## Explicitly Out of Scope

- Drag-to-assign from image tray to filmstrip frame (Plan 4)
- Analysis mode toggles in view strip (Plan 2c)
- WCAG badge logic (Plan 2c — only the HTML slot is created here)
- Inspector collapse/expand toggles per section (future)
- Left panel resize handle (future)
- Project Manager view (separate plan, Plan 4)
