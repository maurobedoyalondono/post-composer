# Spec — Thumbnail Export & Image Annotation Redesign
**Date:** 2026-04-12
**Status:** Approved

---

## Problem

The Project Manager export package gives agents too little information to make good initial decisions:

- `image-sheet.jpg` crops all images into 300×300 square cells, destroying aspect ratio and omitting labels or frame numbers
- `image-map.md` contains only `| Filename | Label |` — no context, no photographer intent
- `project-brief.txt` is too minimal for external AI models (no image context, no design vocabulary)
- There is no mechanism to capture per-image annotations (role, story, notes, stats) at project creation time or later

---

## Goals

1. Replace the image grid sheet with individual per-frame JPEG exports, aspect-ratio preserved, ≤500 KB each
2. Add per-image annotation support (role, silent flag, notes, story, stats) — stored in project data, entered once, never repeated
3. Redesign `image-map.md` to carry all per-image annotation data
4. Add `external-brief.md` — a self-contained document for external AI models (concept + image map + full ai-manual)
5. Keep `project-brief.txt` unchanged — internal pipeline agents continue to read it as-is
6. Update Concept Strategist and Color Advisor skills to consume individual image files and the rich image-map

---

## Data Model

### `imageMeta` item (extended)

```js
{
  filename: "CC2A2767.jpg",   // original filename
  label:    "cc2a2767",       // slug label
  dataUrl:  "...",            // stored in IndexedDB (unchanged)
  annotation: {
    role:   "opening",        // "opening" | "closing" | "anchor" | "transition" | "silent" | ""
    silent: false,            // true = no text overlay on this frame
    notes:  "",               // why this image matters, photographer intent
    story:  "",               // how/when captured, context
    stats:  "",               // any data/number to feature (optional)
  }
}
```

All `annotation` fields are optional. Unannotated images export cleanly with absent fields. The `annotation` object is stored as part of `brief.imageMeta` in localStorage and IndexedDB alongside the rest of project data.

**Backward compatibility:** existing briefs without `annotation` fields continue to work — exporters and UI treat missing `annotation` as an empty object.

---

## Wizard Extension (Initial Annotation)

### Flow

The 5-step wizard gains a per-image annotation phase after step 5 (image upload). After images are saved to IndexedDB, the wizard transitions to image annotation mode.

- Step indicator updates to: `Image 1 of 23`, `Image 2 of 23`, etc.
- A **thumbnail strip** appears at the top of the wizard body — a horizontally scrollable row of all uploaded images (small thumbnails, ~60px). Each thumbnail is clickable to jump directly to that image. No annotation indicators on thumbnails.
- Back/Next navigate sequentially through images
- All annotation fields are optional — Next with empty fields is valid

### Per-image annotation screen layout

```
┌─────────────────────────────────────┐
│ Image 3 of 23                       │
├─────────────────────────────────────┤
│ [img1][img2][img3][img4]... scroll  │  ← thumbnail strip, current highlighted
├─────────────────────────────────────┤
│ CC2A2823.jpg · cc2a2823             │
│ [image preview, aspect-ratio]       │
│ Role: [dropdown]  □ Silent          │
│ Notes: [textarea]                   │
│ Story: [textarea]                   │
│ Stats: [input]                      │
├─────────────────────────────────────┤
│ [Back]                    [Next →]  │
└─────────────────────────────────────┘
```

Last image: Next becomes **Save**. Annotations are written into `imageMeta` on Save.

### Role dropdown options

| Value | Label |
|-------|-------|
| `""` | (none) |
| `"opening"` | Opening |
| `"closing"` | Closing |
| `"anchor"` | Anchor |
| `"transition"` | Transition |
| `"silent"` | Silent |

When role = `"silent"`, the Silent checkbox is auto-checked.

### Edit mode (openEdit)

When editing an existing brief, the wizard shows only steps 1–5. Image annotation is handled by the annotation panel. The wizard does not re-enter annotation screens on edit.

---

## Image Annotation Panel

A **"Manage Images"** button on each project card opens a modal dialog.

### Layout

```
┌─────────────────────────────────────┐
│ Manage Images — [Project Title] [✕] │
├─────────────────────────────────────┤
│ [img1][img2][img3][img4]... scroll  │  ← same thumbnail strip, clickable
├─────────────────────────────────────┤
│ CC2A2823.jpg · cc2a2823             │
│ [image preview, aspect-ratio]       │
│ Role: [dropdown]  □ Silent          │
│ Notes: [textarea]                   │
│ Story: [textarea]                   │
│ Stats: [input]                      │
└─────────────────────────────────────┘
```

- No explicit Save button — changes write to storage on field blur
- Clicking any thumbnail in the strip jumps immediately to that image
- Close button (✕) dismisses the panel
- After editing, the existing export button on the project card re-exports with updated data

---

## Export Package Redesign

### Package structure

```
[slug].zip
├── project-brief.txt       (unchanged — for internal pipeline agents)
├── image-map.md            (redesigned — rich per-image data)
├── external-brief.md       (NEW — for external AI models)
└── images/
    ├── 01-cc2a2767.jpg
    ├── 02-cc2a2769.jpg
    └── ...
```

`image-sheet.jpg` is **removed**.

### Individual image export

- Each image resized to fit within **1200px on the longest side**
- Aspect ratio always preserved — no cropping, no letterboxing
- Exported as JPEG at **0.75 quality** first; if the resulting blob exceeds 500 KB, retry at **0.65 quality**
- If still over 500 KB at 0.65, export at 0.65 regardless (very large sensors / RAW-sourced images may exceed target)
- Named `NN-label.jpg` where NN is zero-padded index (01, 02, … 23)
- Rendered via canvas `drawImage` with proportional scaling

### `image-map.md` — new format

One section per image. Blank annotation fields are omitted entirely.

```markdown
# Image Map — [Project Title]

## 01 · cc2a2767
**File:** CC2A2767.jpg
**Thumbnail:** images/01-cc2a2767.jpg
**Role:** opening
**Silent:** no
**Notes:** Wide establishing shot — sets the geographic and emotional scale of the series.
**Story:** Captured at 6am before the mist cleared; only window for this light.
**Stats:** —

## 02 · cc2a2769
**File:** CC2A2769.jpg
**Thumbnail:** images/02-cc2a2769.jpg
```

### `external-brief.md` — new file

Self-contained document for external AI models. Structure:

```markdown
# External Brief — [Project Title]

## Project
- Title, Platform, Tone, Story (from project-brief.txt)

## Image Map
[full image-map.md content embedded here]

---

## AI Design Manual
[full content of docs/ai-manual.md embedded here]
```

The generator fetches `docs/ai-manual.md` via HTTP at export time (the app is served via live-server, so a relative `fetch('../docs/ai-manual.md')` works). If the fetch fails, `external-brief.md` is still generated but includes a placeholder line: `[ai-manual.md could not be loaded — attach manually]`.

### `project-brief.txt` — unchanged

Internal pipeline agents (Concept Strategist) continue to read this file as-is. No changes to format or content.

---

## Agent Skill Updates

### Concept Strategist

**Current:** reads `image-sheet.jpg` (composite grid)
**New:** reads individual images from `inputs/images/` in sequence (01-label.jpg, 02-label.jpg, …)

**Current:** reads `image-map.md` as a simple filename→label table
**New:** reads `image-map.md` as a rich document — extracts per-frame role, silent flag, notes, story, stats to inform:
- Narrative structure (role fields suggest act assignments)
- Silence map candidates (silent flag)
- Viewer journey prose (notes + story give specific detail)
- Confirmed facts (stats fields)

Annotations are **guidance, not constraints** — the Concept Strategist reads them to make better initial proposals but remains free to suggest changes. The photographer's annotations represent intent, not a locked spec.

### Color Advisor

**Current:** reads `image-sheet.jpg` and locates each frame's thumbnail within the grid
**New:** reads `inputs/images/NN-label.jpg` directly for each frame being assessed

No change to analysis logic — still evaluates text zone luminance, dominant hues, and hue conflicts. Individual files give more accurate zone assessment than a 300×300 cropped grid cell.

### No changes needed

- **Art Director** — reads actual photograph via browser preview, not the inputs package
- **Creative Director** — works from narrative-brief.md, not inputs
- **Technical Producer** — works from creative-brief.md and color-overrides.md
- **Series Director** — validates downstream docs, not inputs
- **Art Orchestrator** — dispatches frames, does not read inputs

---

## Files Changed

| File | Change |
|------|--------|
| `manager/exporter.js` | Replace `generateImageSheet` with `generateIndividualImages`; rewrite `generateImageMap`; add `generateExternalBrief` |
| `manager/brief-wizard.js` | Add per-image annotation steps after step 5; add thumbnail strip component |
| `manager/` (new file) | `image-annotator.js` — annotation panel component for project card |
| `manager/` (styles) | Add styles for thumbnail strip, annotation panel, image preview |
| `.claude/skills/post-composer-concept-strategist/SKILL.md` | Update image read instructions; update image-map.md read instructions |
| `.claude/skills/post-composer-color-advisor/SKILL.md` | Update image read instructions |
