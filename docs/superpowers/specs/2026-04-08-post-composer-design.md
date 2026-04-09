# post-composer — Master Design Spec
**Session:** PC-2026-0408-A
**Date:** 2026-04-08
**Status:** Approved

---

## Overview

post-composer is a complete redesign of the frameforge toolchain. It replaces a monolithic, organically grown application with three cleanly separated concerns connected by a well-defined shared contract.

The root problem with frameforge was not missing features — it was missing *structure*. The app grew without intention: a 1,976-line `app.js`, global state scattered across modules, imperative callbacks between components, and an AI pipeline that approved every frame in isolation and never checked whether the series as a whole was visually varied. The result was technically correct output that looked flat and repetitive.

post-composer fixes this at every level: architecture, data contract, and AI pipeline.

---

## Part 1 — Three Concerns

### 1.1 Separation

| Concern | What it is | Where it lives |
|---------|-----------|----------------|
| **post-composer** | One browser app — Project Manager view + Editor view | `C:\Projects\Photos\Composers\post-composer\` |
| **AI Pipeline** | Claude Code skills — 7-step orchestration producing the project JSON | `.claude/skills/post-composer-[role]/` |
| **Shared Contract** | JSON schema + intermediate documents connecting both | Per-project folder structure |

### 1.2 Workflow

```
Project Manager (app)
  → exports inputs package (image-sheet, image-map, project-brief)

AI Pipeline (Claude Code skills)
  → Concept Strategist reads inputs → narrative-brief.md
  → Creative Director reads narrative-brief → creative-brief.md (+ variety contract)
  → Color Advisor reads creative-brief → color-overrides.md
  → Technical Producer reads all three → project-slug.json (validated)
  → Series Director reads JSON + image-sheet → variety check → approves or rejects
  → Art Director works per frame with series context

Editor (app)
  → loads project-slug.json + raw images
  → renders, refines, exports final PNGs
```

### 1.3 Build Order (Approach C — Contract Core + Editor Co-evolve)

1. **Contract Core** — JSON schema, design tokens, variety contract, intermediate document structure
2. **Editor** — canvas renderer, layer editing, visual analysis (co-evolves contract as needed)
3. **Finalize Contract** — lock schema after editor reveals real usage patterns
4. **AI Pipeline skills** — redesigned skills using finalized contract
5. **Project Manager** — project CRUD, brief wizard, package export

---

## Part 2 — Shared Contract

### 2.1 Project Folder Structure

Every project lives in its own folder. All inputs are produced by the app. AI roles only produce documents that require judgment.

```
project-slug/
├── inputs/                        ← all exported by Project Manager app
│   ├── image-sheet.jpg            ← low-res thumbnail grid, filenames beneath each photo
│   ├── image-map.md               ← one table: frame | raw_filename | descriptive_label
│   └── project-brief.txt          ← project metadata + story + embedded AI manual
│
├── shared/                        ← one owner per file, no duplication between files
│   ├── narrative-brief.md         ← Concept Strategist (Step 1)
│   ├── creative-brief.md          ← Creative Director (Step 2) — includes variety contract
│   └── color-overrides.md         ← Color Advisor (Step 3) — overrides only, not full palette
│
├── project-slug.json              ← Technical Producer (Step 4)
└── screenshots/                   ← Art Director (Step 5+)
    ├── frame-01-v1.jpg
    └── ...
```

**Ownership principle:** If a machine can produce it, the app produces it. AI roles only produce documents requiring judgment — narrative strategy, creative direction, color decisions.

**No duplication principle:** Each document is authoritative for exactly one thing. Later documents reference earlier ones; they never re-state what is already established. `color-overrides.md` contains only overrides — it never re-lists the full palette from `creative-brief.md`.

### 2.2 image-map.md Format

A single table replacing the previous two-document approach (`image-map.md` + `frame-image-mapping.md`). The Project Manager app generates this automatically from the project's loaded files.

```markdown
| frame     | raw_filename   | descriptive_label          |
|-----------|----------------|---------------------------|
| frame-01  | CC2A1369.jpg   | wide-canyon-overview       |
| frame-02  | CC2A1463.jpg   | eroded-channels-closeup    |
| frame-03  | CC2A1495.jpg   | columnar-formations        |
```

- `frame` — assigned by the user in the Project Manager (drag order or explicit assignment)
- `raw_filename` — exact filename as it exists on disk
- `descriptive_label` — slug-style label describing the shot content; used by all AI roles to reference images in documents and by the Technical Producer as `image_src` in the JSON

### 2.3 project-brief.txt Format

Exported by the Project Manager on demand. Self-contained for the "other AI models" workflow path.

```
# post-composer Project Brief
Generated: YYYY-MM-DD

## Project
- Title: [user input]
- Project ID: [slug]
- Platform: [selected platform with dimensions]
- Total images: [count]

## Story & Direction
[user's story text]

Tone: [user selection or "AI decides"]

## Images
[count] images provided alongside this brief.
See image-map.md for the full frame → filename → label mapping.

---
# post-composer AI Generation Manual
[current version of the AI manual embedded here]
```

The embedded manual updates automatically on each export — the Project Manager always embeds the current version.

### 2.4 JSON Schema Redesign

#### Top-level structure

```json
{
  "project":          { ... },
  "export":           { ... },
  "design_tokens":    { ... },
  "variety_contract": { ... },
  "globals":          { ... },
  "frames":           [ ... ],
  "image_index":      [ ... ]
}
```

#### design_tokens (new)

Replaces the current loose `globals` bag. Gives the AI a defined vocabulary rather than inventing values each time.

```json
"design_tokens": {
  "palette": {
    "background": "#1a1a2e",
    "primary":    "#E0D8CE",
    "accent":     "#B85530",
    "neutral":    "#5C6B74"
  },
  "type_scale": {
    "display": {
      "family": "Cormorant Garamond",
      "weight": 700,
      "steps": { "xl": 12, "lg": 10, "md": 8, "sm": 6 }
    },
    "body": {
      "family": "Inter",
      "weight": 400,
      "steps": { "md": 3.5, "sm": 3.0, "xs": 2.5 }
    },
    "data": {
      "family": "Inter",
      "weight": 700,
      "steps": { "xl": 16, "lg": 12, "md": 8, "sm": 5 }
    }
  },
  "spacing_scale": [4, 6, 8, 12, 16, 24]
}
```

**Type role rules (non-negotiable):**
- `display` — headlines and display text only
- `body` — captions, eyebrows, supporting text
- `data` — all numbers, measurements, stats values. Display and serif fonts are prohibited for numeric content.

#### variety_contract (new)

The variety contract exists in two forms:
- **In `creative-brief.md`** — prose form, written by the Creative Director. Declares the series-level design commitments in human-readable format.
- **In `project-slug.json`** — machine-readable form, written by the Technical Producer by translating the creative-brief.md variety contract section into structured JSON.

These are two representations of the same data — not duplication. The creative-brief.md version is the authoritative source; the JSON version is what the validator and Series Director check programmatically.

Written by the Creative Director. Validated by the Technical Producer. Enforced by the Series Director. Provides context to the Art Director per frame.

```json
"variety_contract": {
  "zone_max_usage_pct": 40,
  "shape_quota": {
    "min_per_n_frames": 3,
    "waiver": null
  },
  "overlay_strategies": ["gradient", "solid-bar"],
  "overlay_strategies_min": 2,
  "accent_color_frames": ["frame-03", "frame-06"],
  "accent_color_min": 2,
  "copy_tone_variety": true,
  "silence_map": [2, 4],
  "composition_patterns": {
    "frame-01": "editorial-anchor",
    "frame-02": "full-bleed",
    "frame-03": "data-callout",
    "frame-04": "full-bleed",
    "frame-05": "minimal-strip",
    "frame-06": "layered-depth",
    "frame-07": "editorial-anchor"
  }
}
```

#### frames — key changes

```json
{
  "id": "frame-01",
  "image_src": "wide-canyon-overview",
  "image_filename": "CC2A1369.jpg",
  "composition_pattern": "editorial-anchor",
  "layers": [ ... ]
}
```

`composition_pattern` is **required** on every frame. The Series Director validates that pattern distribution across the series is varied.

#### Layer changes

**Position model — single system (zone anchors only):**

The previous dual-mode system (zone mode vs. absolute %) is replaced with a single model. All layers use zone anchors with percentage offsets from the zone edge.

```json
"position": {
  "zone": "bottom-left",
  "offset_x_pct": 6,
  "offset_y_pct": -8
}
```

For absolute placement (rare), use `"zone": "absolute"` with `"x_pct"` and `"y_pct"`.

**Shape layer — role field (required):**

```json
{
  "type": "shape",
  "shape": "line",
  "role": "divider",
  ...
}
```

`role` is required on every shape layer. Forces intentional use — the AI must declare the compositional purpose. Valid values: `"divider"`, `"accent"`, `"anchor"`, `"badge"`, `"frame"`, `"silhouette"`, `"callout"`.

### 2.5 Seven Named Composition Patterns

Required field per frame. Defined in the AI manual and validated by the Series Director.

| Pattern | Description |
|---------|-------------|
| `editorial-anchor` | Text anchored to a geometric element — rule line, shape, solid block |
| `minimal-strip` | Tight text in a narrow zone. Image dominates. Almost silent. |
| `data-callout` | Number or stat as hero. Large, bold, anchored to a key visual area. |
| `full-bleed` | Image dominant. Zero overlay. Intentional silence — chosen, not defaulted. |
| `layered-depth` | Multiple overlapping elements. Depth through transparency and stacking. |
| `diagonal-tension` | Elements placed along a diagonal axis. Creates movement and energy. |
| `centered-monument` | Single centered element. Breathing space on all sides. Formal, precise. |

**Series-level distribution rule:** No single pattern may appear on more than 40% of frames in a series (except `full-bleed` / `minimal-strip` when silence is a deliberate editorial choice — must be documented in variety_contract).

### 2.6 Eliminated from Previous System

| Eliminated | Reason |
|-----------|--------|
| `concept-template.html` | Visual Designer output — duplicated the creative brief in HTML format |
| `concept-template.md` | Same — redundant with creative-brief.md |
| `frame-image-mapping.md` (AI-produced) | App knows the files; no AI should read thumbnails to determine filenames |
| Visual Designer role (Step 3) | Role existed solely to produce the eliminated documents |
| Dual position mode ambiguity | Replaced with single zone-anchor model |

---

## Part 3 — AI Pipeline Redesign

### 3.1 Root Cause of Flat Output (Diagnosis)

Analysis of the completed Tatacoa project (8 frames, 2026-03-29) revealed:

- **0 of 10+ shape types used** — shapes are described as optional; result is zero usage
- **5 of 8 frames use bottom-left text zone** — no cross-frame variety check existed
- **All 6 overlays use gradient to-bottom** — one strategy, narrow opacity band
- **Accent color never appeared** — reserved for shapes; shapes never used
- **Copy pattern identical across all text frames** — noun + descriptor + fact, no variation in register

The pipeline had 7 approval gates. Every gate asked "does this frame work?" **No gate asked "does this series work?"**

### 3.2 Redesigned Pipeline

| Step | Role | Input | Output |
|------|------|-------|--------|
| 1 | Concept Strategist | inputs/ | shared/narrative-brief.md |
| 2 | Creative Director | narrative-brief.md + image-sheet | shared/creative-brief.md (includes variety contract) |
| 3 | Color Advisor | creative-brief.md + image-sheet | shared/color-overrides.md (overrides only) |
| 4 | Technical Producer | all shared/ docs + image-map.md | project-slug.json (validated against variety contract) |
| **5** | **Series Director (NEW)** | **project-slug.json + image-sheet** | **Variety check — approves or rejects with specific requirements** |
| 6 | Art Director (×N) | JSON + series context from Series Director | Per-frame design + screenshots |
| 7 | Final Review | All screenshots | Approved series |

### 3.3 New Role: Series Director

The missing gate. Reads the completed JSON alongside the image-sheet (for visual cross-reference) after the Technical Producer submits. Checks the JSON's variety_contract and layer data before Art Director begins per-frame work. No screenshots exist yet at this stage — the Series Director validates the design plan, not the visual execution.

**Series Director checks:**

| Check | Rule | Action if failed |
|-------|------|-----------------|
| Zone distribution | No zone used on > 40% of text frames | Return to Technical Producer with specific zone reassignments |
| Shape quota | Minimum 1 shape per 3 frames (or documented waiver) | Return to Technical Producer with frame numbers requiring shapes |
| Overlay variety | At least 2 different overlay strategies in series | Return with specific frames requiring different strategy |
| Accent color | Accent color appears in ≥ 2 frames (or documented exclusion) | Return with frames where accent color should be applied |
| Pattern distribution | No composition pattern on > 40% of frames | Return with pattern reassignment requirements |
| Copy tone | Not all text frames use factual-label pattern | Flag to Art Director with tone variety requirements |
| Silence pacing | Silent frames match silence_map in variety_contract | Confirm or flag discrepancy |

**Output:** Either `SERIES APPROVED` with per-frame context notes for Art Director, or `SERIES REJECTED` with a numbered list of specific required changes.

### 3.4 Creative Director Changes

Now produces a **variety contract** as a mandatory section of `creative-brief.md`. The contract is not aspirational — it is a binding series-level commitment that downstream roles validate against.

The variety contract section in `creative-brief.md` must include:
- **Zone map**: which zone each text frame uses (no zone > 40%)
- **Silence map**: which frames are silent and why
- **Composition pattern per frame**: declared upfront, not decided during execution
- **Shape plan**: which frames use shapes and what role they serve
- **Overlay strategies**: minimum 2 strategies named and assigned to frames
- **Accent color plan**: which frames use the accent color
- **Copy tone rhythm**: how tone varies across the series

### 3.5 Technical Producer Changes

Adds a **variety contract validation pass** before submitting JSON:

```
Before outputting JSON, verify against variety_contract:
□ No zone used on > 40% of text frames
□ Shape quota satisfied (or waiver documented with reason)
□ At least 2 different overlay strategies present
□ Accent color appears on ≥ 2 frames (or exclusion documented)
□ composition_pattern field present and valid on every frame
□ Pattern distribution: no single pattern on > 40% of frames
□ silence_map frames have no text layers
□ image_filename present on every frame
```

If any check fails, the Technical Producer must fix the JSON before output — not flag and defer.

### 3.6 Art Director Changes

Now receives per-frame context from the Series Director:

```
Frame 3 context from Series Director:
- composition_pattern: data-callout (must use stat as hero)
- zone: top-right (bottom-left used on frames 1 and 2)
- shape required: role "divider" or "accent"
- overlay strategy: solid-bar (gradient already used on frames 1 and 2)
- accent color required: #B85530
```

Art Director cannot override Series Director context without explicit approval from the user.

### 3.7 AI Manual Redesign

The current manual (`ai-manual-content.js`, 35KB) is a **field reference** — it describes HOW to use every layer type but not WHEN or WHY. The redesigned manual is a **design vocabulary guide**.

**Redesigned manual structure:**

1. **Your Role** — what you are doing and for whom
2. **Reading the Image** — the 5-step image reading process (retained from current, works well)
3. **Composition Patterns** — the 7 named patterns with: description, when to use, what layers it requires, what makes it succeed or fail, example JSON fragment
4. **Design Vocabulary** — layer types with: what it does, when to use it (decision criteria), anti-patterns, examples
5. **Variety Rules** — the series-level constraints that are non-negotiable
6. **Typography Rules** — retained and improved from current
7. **Overlay Rules** — retained and improved, with duotone and solid-bar given equal weight to gradient
8. **Layout Rules** — retained from current (stacking math is correct and valuable)
9. **Pre-Output Checklist** — expanded with variety contract validation

---

## Part 4 — Browser App Architecture

### 4.1 Overview

One browser app (`post-composer`), pure HTML + Vanilla JS + ES modules. No build step, no Node, no npm. Live server and ready to go.

Two views with clean internal separation — same shell, different feature areas. Navigation between views is instantaneous (no page reload).

### 4.2 Directory Structure

```
post-composer/
├── index.html                 ← single entry point
├── app.js                     ← bootstrap: init core, mount router
│
├── core/
│   ├── router.js              ← view switching (manager ↔ editor)
│   ├── state.js               ← central AppState class — single source of truth
│   ├── events.js              ← event bus — all inter-module communication
│   └── storage.js             ← localStorage CRUD
│
├── manager/                   ← Project Manager view
│   ├── shell.js               ← view shell, toolbar, navigation
│   ├── projects.js            ← project CRUD + list
│   ├── brief-wizard.js        ← 5-step brief creation wizard
│   └── exporter.js            ← package export (image-sheet, image-map, project-brief)
│
├── editor/                    ← Editor view
│   ├── shell.js               ← view shell, toolbar, panels
│   ├── renderer.js            ← canvas rendering orchestrator
│   ├── layers.js              ← per-layer render functions
│   ├── frame-manager.js       ← frame state and selection
│   ├── layer-manager.js       ← layer state, selection, CRUD
│   ├── analysis.js            ← heatmap build + zone analysis + element advisor
│   ├── drag-resize.js         ← layer drag, resize, hit-testing
│   └── export.js              ← PNG export
│
├── shared/
│   ├── fonts.js               ← Google Fonts dynamic loader
│   ├── validator.js           ← JSON schema + variety contract validation
│   └── visual-analysis.js     ← pixel-level analysis (heatmap, zone, position finder)
│
├── ui/                        ← UI components (stateless, event-driven)
│   ├── filmstrip.js           ← frame thumbnail list
│   ├── layers-panel.js        ← floating layer list
│   ├── inspector.js           ← frame/layer properties + composition pattern
│   ├── toolbars/
│   │   ├── text-toolbar.js
│   │   ├── shape-toolbar.js
│   │   ├── image-toolbar.js
│   │   └── overlay-toolbar.js
│   ├── analysis-panels/
│   │   ├── balance-panel.js   ← zone analysis cards + element advisor
│   │   └── weight-panel.js    ← L/R · T/B weight split
│   ├── image-tray.js          ← draggable image asset grid
│   ├── color-picker.js
│   └── modals/
│       ├── project-select.js
│       ├── json-review.js
│       └── confirm.js
│
└── styles/
    ├── base.css               ← design tokens + resets
    ├── shell.css              ← layout + panels
    └── components.css         ← buttons, modals, cards
```

### 4.3 Core Architecture Principles

**Central state — no global variables:**

```js
// core/state.js
export class AppState {
  constructor() {
    this.view = 'manager';          // 'manager' | 'editor'
    this.project = null;
    this.images = new Map();        // key → HTMLImageElement
    this.activeFrameIndex = 0;
    this.selectedLayerId = null;
    this.analysisMode = null;       // null | 'heatmap' | 'zones' | 'advisor'
    this.prefs = { ... };
  }
}
```

All modules import and read from `AppState`. State mutations happen only through explicit methods — never direct property assignment from outside the class.

**Event bus — no imperative callbacks:**

```js
// core/events.js
export const events = new EventTarget();

// Emitting (in frame-manager.js):
events.dispatchEvent(new CustomEvent('frame:selected', { detail: { index } }));

// Listening (in filmstrip.js):
events.addEventListener('frame:selected', ({ detail }) => filmstrip.setActive(detail.index));
```

Modules never hold references to each other. They emit events and listen for events. This eliminates the tight coupling that made the current `app.js` impossible to decompose.

**Router — no page reloads:**

```js
// core/router.js
export function navigate(view) {
  state.view = view;
  document.getElementById('manager-view').hidden = (view !== 'manager');
  document.getElementById('editor-view').hidden = (view !== 'editor');
  events.dispatchEvent(new CustomEvent('view:changed', { detail: { view } }));
}
```

### 4.4 Project Manager View

**Features:**
- Project list — create, rename, delete, open
- Brief wizard — 5 steps: title & platform → story & tone → load images → review & arrange → export package
- Package export — generates `image-sheet.jpg`, `image-map.md`, `project-brief.txt` as a downloadable ZIP
- Open in Editor — loads JSON + images directly into Editor view

**Brief wizard steps:**

| Step | What user does |
|------|---------------|
| 1 — Title & Platform | Project name, platform selection (Instagram Portrait, A4 Print, etc.) |
| 2 — Story & Tone | Story description, tone direction, notes |
| 3 — Load Images | File picker + drag/drop. Thumbnails shown in grid. User arranges order. |
| 4 — Review & Arrange | Confirm sequence, assign descriptive labels to images (optional — app auto-generates slugs) |
| 5 — Export Package | Generates and downloads the three input files |

### 4.5 Editor View

**Layout:**
- Left: filmstrip (frame thumbnails, vertically scrollable) + image tray (below filmstrip)
- Center: canvas preview + context-sensitive toolbars
- Right: inspector (frame properties, layer properties, composition pattern, analysis readouts)
- Floating: layers panel (draggable, reorderable layers list)
- Floating: balance panel (zone analysis cards + element advisor)

**Features (full inventory from existing codebase + improvements):**

*Project:*
- Load JSON (with validation review modal)
- Load images (drag/drop or file picker)
- Auto-assign images by filename match
- Manual image assignment via drag from tray to filmstrip frame
- Multi-frame navigation
- Frame preview thumbnail in filmstrip

*Layer editing:*
- Add text / shape / overlay / image layers
- Select, drag, resize layers on canvas
- Copy / paste layers within and across frames
- Toggle layer visibility
- Delete layers
- Reorder layers via drag in layers panel
- Context-sensitive toolbars per layer type (text, shape, image, overlay)
- In-canvas text editing (click to edit)
- **Color picker** — native browser `<input type="color">` as the base (OOTB, no custom wheel to maintain). Extended with three layers above it:
  - **Project palette swatches** — the four `design_tokens.palette` colors (background, primary, accent, neutral) displayed as clickable swatches above the native picker. One click applies without opening the picker.
  - **Saved favorites** — user can save any color to a persistent per-project favorites row (stored in localStorage with the project). Click to apply, right-click or long-press to remove.
  - **Recent colors** — last 8 used colors shown automatically, no action required.

*Visual analysis:*

The analysis tools are organized around two real questions a photographer asks when manually tuning a composition.

**Question 1 — Where is it safe to place text? (Legibility)**

- **Contrast map overlay** — smooth per-pixel overlay on the canvas showing where text would be legible. Green = high local contrast = good for text. Red = low contrast = avoid. Based on local contrast (edge density + luminance variance), not raw luminance — a dark area with dark subject is not safe; a dark area with uniform tone is. Toggle on/off.
- **Click-to-probe** — single click anywhere on the canvas opens a small popover showing: RGB at that point, luminance %, estimated WCAG contrast ratio against the currently selected text layer's color, and a WCAG level badge (AAA / AA / fail). Replaces the clunky draw-rectangle zone UX — no drawing, no panel, instant answer.
- **Live WCAG badge in inspector** — when a text layer is selected, the inspector shows a live contrast ratio that updates as the layer is dragged. Tells you in real time whether the layer's current position is legible. No action required — always visible when a text layer is active.

**Question 2 — What does placing text here do to the composition? (Balance)**

- **Visual weight map** — smooth heatmap overlay at higher resolution than the current 16×16 grid. Shows where visual mass is concentrated. Cool (blue) = low weight, warm (red) = high weight. Toggle on/off.
- **Center of mass indicator** — a crosshair overlay showing the actual center of visual weight. If it's far from the geometric center of the canvas, the composition feels pulled to one side. Useful for deciding whether to add a counterweight element or shift an existing one.
- **Composition guides** — thirds, phi, golden spiral, diagonal, quadrants. Toggle any combination independently. (Retained from current — works well.)

**Layout overlays (always available):**

- **Safe zone overlay** — dashed border at the configured safe zone percentage. (Retained.)
- **Layer bounds overlay** — bounding box outlines for all layers in the active frame. (Retained.)

**Removed from previous system:**
- Weight readout panel (L/R · T/B %) — too abstract to act on. Replaced by center of mass indicator which shows the same information spatially.
- Element advisor "move here" button — too mechanical. The contrast map and center of mass together give the user the information to decide placement themselves.
- Draw-rectangle analysis zones — replaced by click-to-probe which gives the same data with a single click.

*Export:*
- Single frame PNG export
- All frames PNG export (batch)
- Configurable scale factor

**Composition pattern in inspector:**
The active frame's `composition_pattern` is displayed and editable in the inspector panel. Changing it emits an event that updates the JSON and re-validates the variety contract.

### 4.6 What Doesn't Change

Features that work well in the current app and carry forward unchanged:
- Canvas rendering engine (HTML5 Canvas API, no third-party libs)
- Google Fonts dynamic loading
- LocalStorage project persistence
- PNG export via `canvas.toBlob()`
- Zone anchor positioning system (cleaned up, not replaced)
- Image focal point (x_pct, y_pct) for cover fit
- White frame / mat feature
- All existing layer types (image, text, shape, overlay, stats_block, logo)

---

## Part 5 — Decisions Not Yet Made

These are deferred to the implementation phase when real code will clarify the right answer:

1. **Exact variety_contract validation error messages** — what the validator returns and how the UI surfaces contract violations
2. **Series Director UX in Claude Code** — how the series check presents to the user (inline vs. separate approval gate)
3. **Brief wizard image labeling** — whether the user manually assigns descriptive labels or the app auto-generates slugs with user confirmation
4. **Image tray vs. filmstrip sizing** — exact proportions deferred to UI implementation
5. **Event bus event taxonomy** — full list of events deferred to implementation

---

## Appendix — Key Metrics from Frameforge Analysis

Included for reference during implementation — what the redesign is measured against.

| Metric | Tatacoa (current) | Target (redesigned) |
|--------|------------------|---------------------|
| Shape types used | 0 of 10+ | ≥ 1 shape per 3 frames |
| Text zone variety | 1 dominant zone (62.5% of frames) | No zone > 40% |
| Overlay strategies | 1 (gradient to-bottom) | ≥ 2 per series |
| Accent color usage | 0 frames | ≥ 2 frames |
| Composition patterns used | 1 (implicit) | ≥ 3 distinct patterns |
| Copy tone variety | 0 (all factual labels) | ≥ 1 non-factual register |
| app.js lines | 1,976 | ~100 (bootstrap only) |
| Largest single file | 1,976 lines | ≤ 300 lines |
| Global variables | Many | 0 |
