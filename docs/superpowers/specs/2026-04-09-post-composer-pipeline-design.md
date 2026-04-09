# post-composer AI Pipeline Design
**Date:** 2026-04-09
**Status:** Approved

---

## Overview

This spec defines the AI Pipeline for post-composer — the 7-step Claude Code skill orchestration that produces natural, organic project JSON from photographer inputs. It replaces the frameforge pipeline with a redesigned system built on the post-composer shared contract (spec: `2026-04-08-post-composer-design.md`) and extended by the multi-image frames feature (spec: `2026-04-09-multi-image-frames-design.md`).

The root problem with frameforge's output was structural: every gate asked "does this frame work?" No gate asked "does this series work?" The result was technically valid JSON that looked flat and repetitive — same zone, same gradient, same copy register, across every frame.

This pipeline fixes that at every level: a variety contract committed upfront, a Series Director enforcer before any frame is touched, and an Art Director that reads the actual photograph with per-frame constraints from the series plan.

---

## Part 1 — Architecture

### 1.1 Skill locations

```
post-composer/.claude/skills/
├── post-composer-concept-strategist/SKILL.md
├── post-composer-creative-director/SKILL.md
├── post-composer-color-advisor/SKILL.md
├── post-composer-technical-producer/SKILL.md
├── post-composer-series-director/SKILL.md
├── post-composer-art-director/SKILL.md
└── post-composer-art-orchestrator/SKILL.md
```

### 1.2 Supporting files

```
post-composer/docs/
└── ai-manual.md              ← design vocabulary guide — all roles that touch JSON read this

post-composer/
└── agent-preview.html        ← standalone Playwright render target for Art Director
```

### 1.3 Project file system (communication medium)

Roles communicate through the file system only. No role re-states what a previous role established.

```
[project-slug]/
├── inputs/                   ← produced by the Project Manager app — AI never writes here
│   ├── project-brief.txt
│   ├── image-map.md
│   └── image-sheet.jpg
│
├── shared/                   ← AI-produced, one owner per file
│   ├── narrative-brief.md    ← Concept Strategist
│   ├── creative-brief.md     ← Creative Director (includes variety contract)
│   └── color-overrides.md   ← Color Advisor (overrides only)
│
├── project-slug.json         ← Technical Producer
└── screenshots/              ← Art Director (per-frame, per-version)
    ├── frame-01-v1.jpg
    └── ...
```

### 1.4 Eliminated vs frameforge

| Eliminated | Reason |
|---|---|
| Visual Designer role | Produced `concept-template.html` — eliminated from contract |
| `concept-template.html` / `.md` | Redundant with `creative-brief.md` |
| `frame-image-mapping.md` (AI-produced) | App produces `image-map.md`; AI reads it |
| Copy Reviewer role | Creative Director does internal copy review before output |
| Stage Manager role | post-composer Editor handles project loading natively |
| Dual position mode | Zone-anchor-only model in new contract |

---

## Part 2 — AI Manual

### 2.1 Location and purpose

`post-composer/docs/ai-manual.md`

Every role that generates or modifies JSON reads this before making any design decision. It is a **design vocabulary guide** — not a field reference. It answers WHEN and WHY, not just HOW. A role that knows only the field names will produce valid JSON that looks flat. A role that knows the design vocabulary will produce organic output that responds to the specific image and series.

### 2.2 Structure

#### Section 1 — Reading the Image

Five questions to answer before any design decision. Retained from frameforge — this process works.

1. Where does the eye go first?
2. Where is the quiet space the image offers for text or graphic elements?
3. What is the emotional register — intimate, monumental, tense, serene?
4. Where is the strongest zone — what must never be covered or competed with?
5. What does this image need text to complete, if anything? If nothing — silence is correct.

The design must come from this reading. Copy the JSON draft number last.

#### Section 2 — Composition Patterns

Seven named patterns. Every frame in the series must declare one. Each entry includes:
- Description + when to use
- Required layer types
- What makes it succeed / what kills it
- Example JSON fragment
- Multi-image note where the pattern benefits from `multi_image: true`

| Pattern | Core constraint | Multi-image note |
|---|---|---|
| `editorial-anchor` | Text anchored to a geometric element — shape required | — |
| `minimal-strip` | Tight zone, near-silence, image dominant | — |
| `data-callout` | Stat as hero — `data` font role, large, zone-locked | — |
| `full-bleed` | Zero overlay — intentional silence, never a default | `multi_image` useful for diptych silence |
| `layered-depth` | Multiple overlapping elements — depth through transparency | Best with `multi_image: true`; use `bg_color` for controlled base |
| `diagonal-tension` | Elements along a diagonal axis — creates movement | — |
| `centered-monument` | Single centered element — breathing space enforced | — |

**Series distribution rule:** No single pattern on more than 40% of frames. `full-bleed` / `minimal-strip` exempt when silence is a documented editorial choice in the variety contract.

#### Section 3 — Design Vocabulary

Per layer type: what it does, when to use it, decision criteria, anti-patterns, JSON example.

**image**
- Single-image mode: `frame.image_filename` is the background. `fit: cover` is standard.
- Multi-image mode: `frame.multi_image: true`. Multiple image layers with independent `position`, `width_pct`, `height_pct`. Use `frame.bg_color` to control what shows through transparent areas or gaps. The background cover render is skipped — image layers own the canvas.
- `fit: contain` for watermarks, logos, insets where the full image must be visible.
- Anti-pattern: using `fit: fill` — stretches the image, always wrong.

**overlay**
- Two strategies, given equal weight — choose based on what is actually at the text zone:
  - **gradient**: effective when the zone transitions smoothly (sky, soft shadow, gradual blur). Set `from_opacity: 0` at the safe end, `to_opacity` at the minimum the text requires. Look at the image — do not copy the draft number.
  - **solid-bar**: effective when the zone is textured, patterned, or color-conflicted. A solid rectangle eliminates the readability problem entirely — text reads against a flat surface regardless of what the photo is doing underneath.
- Anti-pattern: defaulting to gradient-to-bottom on every frame. Read the zone first.
- `blend_mode: multiply` for duotone effects — use intentionally, not as a default.

**text**
Three roles, non-negotiable:
- `display` family — headlines and display text only
- `body` family — captions, eyebrows, supporting text
- `data` family — all numbers, measurements, stats values. Display and serif faces prohibited for numeric content.

`size_pct` uses the named steps from `design_tokens.type_scale` — `xl`, `lg`, `md`, `sm` for display; `md`, `sm`, `xs` for body; `xl`, `lg`, `md`, `sm` for data. Do not invent sizes outside the scale.

**shape**
`role` field required on every shape layer. Forces intentional use — declare the compositional purpose.

| Role | When to use |
|---|---|
| `divider` | Separates two text elements or regions |
| `accent` | Color punctuation — small, deliberate, draws the eye |
| `anchor` | Geometric base that text sits on or near |
| `badge` | Enclosed label — circle, rounded rect, tag |
| `frame` | Border element — surrounds or outlines a region |
| `silhouette` | Large shape that echoes or masks a photographic form |
| `callout` | Points to or isolates a specific area |

Anti-pattern: omitting shapes because they feel optional. The Series Director enforces shape quota. Shapes are compositional instruments — a thin rule separates text voices; a solid rect anchors a type zone; a diagonal line echoes a diagonal in the photograph.

#### Section 4 — Variety Rules

Non-negotiable series constraints. The Technical Producer validates these before output. The Series Director enforces them after.

1. No zone used on > 40% of text frames
2. Shape quota: minimum 1 shape per 3 frames (or documented waiver in variety contract)
3. At least 2 different overlay strategies per series
4. Accent color appears on ≥ 2 frames (or documented exclusion)
5. No composition pattern on > 40% of frames
6. Not all text frames use the same copy tone
7. Silent frames match the `silence_map` declared in the variety contract

#### Section 5 — Typography Rules

- `display` face for headlines — never for numbers or measurements
- `body` face for captions, eyebrows, supporting text
- `data` face for all numeric content — bold, high contrast, legible at distance
- `letter_spacing_em`: display text benefits from slight tightening (-0.02 to -0.03); body text from slight loosening (0 to 0.1); eyebrows from wide spacing (0.1 to 0.2)
- `line_height`: display 0.95–1.1; body 1.4–1.6
- `align`: match the frame's compositional axis — left for edge-anchored designs, center for monument/centered patterns

#### Section 6 — Overlay Rules

Decision tree — run before setting any overlay value:

```
Does any text in this frame need legibility help?
  No → omit the overlay entirely. An overlay that darkens without serving text is an error.
  Yes → look at the text zone:
    Smooth tonal transition (sky, soft blur, gradual shadow) → gradient in direction of text
    Noisy, textured, patterned, or color-conflicted → solid bar
    High-contrast dark zone (naturally dark, no competing hues) → no treatment needed
```

Gradient opacity: set to the minimum the image requires. Look at the actual pixels.

`blend_mode: multiply` creates a duotone effect — the overlay color tints the image. Use when the creative brief calls for a tonal color wash, not as a darkening default.

#### Section 7 — Layout Rules

**Zone anchor system:**
All positions use zone anchors + percentage offsets from the zone edge.

```json
"position": {
  "zone": "bottom-left",
  "offset_x_pct": 6,
  "offset_y_pct": -12
}
```

Zones: `top-left`, `top-center`, `top-right`, `middle-left`, `middle-center`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`. Negative offsets move toward the canvas center from that edge.

For rare absolute placement: `"zone": "absolute"` with `"x_pct"` and `"y_pct"` from top-left.

**Stacking math:**
For a text stack (eyebrow → headline → caption), space elements using `size_pct × line_height` to compute how much vertical space each occupies. Stack tightly — generous line height within each element, minimal gap between elements.

**Safe zone:** Keep all text and graphic elements within the inner 80% of the canvas unless the design explicitly breaks this boundary for effect.

#### Section 8 — Pre-Output Checklist

Run before outputting any JSON. Fix failures — never flag and defer.

```
□ composition_pattern field present and valid on every frame
□ No zone used on > 40% of text frames
□ Shape quota satisfied — 1 shape per 3 frames minimum, or waiver documented
□ At least 2 different overlay strategies present
□ Accent color appears on ≥ 2 frames, or exclusion documented
□ Pattern distribution: no single pattern on > 40% of frames
□ silence_map frames have no text layers, no overlays, no shapes
□ image_filename present on every frame
□ data font role used for all numeric content — no display/serif for numbers
□ role field present on every shape layer
□ All positions use zone-anchor model (no bare x_pct/y_pct except zone: absolute)
□ multi_image frames: bg_color set if image layers don't cover the full canvas
```

---

## Part 3 — The Roles

### 3.1 Concept Strategist

**Reads:** `inputs/project-brief.txt`, `inputs/image-map.md`, `inputs/image-sheet.jpg`
**Writes:** `shared/narrative-brief.md`
**Returns:** `STATUS: NARRATIVE BRIEF COMPLETE`

**Key difference from frameforge:** The curation is user-driven, not AI-driven. The project-brief.txt contains the story, tone, and platform already. The Concept Strategist does not run a 5-question interview — it reads the brief, studies the image sheet for visual content understanding, and writes the narrative brief directly. Clarifying questions only if something in the brief is genuinely ambiguous.

**Output format:** Same structure as frameforge — confirmed answers, narrative structure table, viewer journey (250–350 words prose), approved frame sequence, confirmed facts.

**Frame sequence:** Derived from `image-map.md` order (which reflects the user's arrangement in the Project Manager app) unless the narrative brief clearly argues for a different sequence. The AI may propose reordering — user must approve.

---

### 3.2 Creative Director

**Reads:** `shared/narrative-brief.md`, `inputs/image-sheet.jpg`
**Writes:** `shared/creative-brief.md`
**Returns:** `STATUS: CONCEPT APPROVED`

**Key difference from frameforge:** Must produce a **variety contract** as a mandatory, non-optional section. This is the binding series-level commitment — not aspirational direction. Also: internal copy review before presenting to user (no external Copy Reviewer role).

**Variety contract section — required fields:**

| Field | Description |
|---|---|
| Zone map | Which zone each text frame uses. No zone may appear on > 40% of text frames. |
| Silence map | Which frames are silent and why. |
| Composition pattern per frame | Declared upfront for every frame. |
| Shape plan | Which frames use shapes, what role they serve. |
| Overlay strategies | Minimum 2 strategies named and assigned to frames. |
| Accent color plan | Which frames use the accent color. |
| Copy tone rhythm | How tone varies across the series — not all frames the same register. |

**Design token output:** Palette (4 colors: background, primary, accent, neutral) + type system (display + body faces, both valid Google Fonts names). The Concept Strategist confirmed the story; the Creative Director sets the visual language that serves it.

**Internal copy review:** After all per-frame briefs are written, review every string for grammar, completeness, register, precision, redundancy, factual accuracy. Fix — do not flag. Only present reviewed copy to the user.

**Return block format:**
```
CONCEPT SUMMARY
Project: [name]
Design tokens:
  background: [hex]
  primary: [hex]
  accent: [hex]
  neutral: [hex]
  display: [Google Fonts family]
  body: [Google Fonts family]
Variety contract:
  [all 7 fields, structured]
Per-frame briefs:
  frame-01: [image_src label]
    pattern: [composition_pattern]
    zone: [text zone]
    overlay: [gradient direction | solid-bar | none]
    shape: [role and description | none]
    accent: [yes | no]
    [silent] | eyebrow: "..." | headline: "..." | caption: "..."
  [repeat for all frames]
```

---

### 3.3 Color Advisor

**Reads:** `shared/creative-brief.md`, `inputs/image-sheet.jpg`
**Writes:** `shared/color-overrides.md`
**Returns:** `STATUS: COLOR OVERRIDES COMPLETE`

**Key difference from frameforge:** Produces **overrides only** — no full palette (that is in `creative-brief.md`). If a palette color is safe at a frame's text zone: no entry for that frame. The document is short by design — it only contains corrections.

**Per-frame analysis:** Study the text zone thumbnail for each text frame. Assess luminance, dominant hues, zone character (uniform vs busy). For each text role, evaluate the creative-brief palette color at that zone: safe → no entry. Fails → override entry with specific hex and one-line reason.

**Output format:**
```markdown
# Color Overrides — [Project Title]

## frame-03 · golden-hour-canyon-walls
Zone: top-right — warm ochre, medium luminance, smooth
| Role | Override | Reason |
|---|---|---|
| stat-label | #FFFFFF | accent #B85530 disappears against warm ochre at this luminance |

## frame-05 · ...
[only frames with actual overrides]
```

Silent frames and frames where all palette colors are safe: no entry.

---

### 3.4 Technical Producer

**Reads:** `shared/narrative-brief.md`, `shared/creative-brief.md`, `shared/color-overrides.md`, `inputs/image-map.md`, `post-composer/docs/ai-manual.md`
**Writes:** `[project-slug].json`
**Returns:** `STATUS: JSON COMPLETE`

**Key differences from frameforge:**

1. **New JSON structure** — uses `design_tokens`, `variety_contract`, `composition_pattern` per frame, zone-anchor-only positions, `role` on every shape layer. Reads `ai-manual.md` fully before generating.

2. **Variety contract validation pass** — run the Section 8 checklist from `ai-manual.md` before output. Fix every failure before writing the file. No exceptions.

3. **`image_filename` from `image-map.md`** — the image map is the authoritative filename source. No frame-image-mapping.md produced — the app handles this.

4. **Multi-image support** — if the creative brief calls for a `layered-depth` pattern that benefits from multiple images, set `multi_image: true` on the frame and include multiple image layers. Set `bg_color` when image layers won't cover the full canvas.

5. **No `image_src` inference** — `image_src` comes from the `label` column of `image-map.md`. Copy exactly.

**JSON structure validation:** Every frame must have `composition_pattern`, `image_filename`, `image_src`. Every text layer must use the correct font role. Every shape layer must have `role`. Every position must use zone-anchor model.

---

### 3.5 Series Director (New Role)

**Reads:** `[project-slug].json`, `inputs/image-sheet.jpg`
**Writes:** nothing — returns `SERIES APPROVED` or `SERIES REJECTED`

**The missing gate.** Validates the design plan — not visual execution — before Art Director touches any frame. No screenshots exist at this stage.

**Seven checks:**

| Check | Rule | Action if failed |
|---|---|---|
| Zone distribution | No zone on > 40% of text frames | Return to Technical Producer with specific zone reassignments |
| Shape quota | Min 1 shape per 3 frames (or waiver) | Return with frame numbers requiring shapes |
| Overlay variety | ≥ 2 different overlay strategies | Return with frames requiring different strategy |
| Accent color | Accent appears on ≥ 2 frames (or documented exclusion) | Return with frames where accent should apply |
| Pattern distribution | No pattern on > 40% of frames | Return with pattern reassignment requirements |
| Copy tone | Not all text frames same register | Flag to Art Director with tone variety requirements |
| Silence pacing | Silent frames match `silence_map` | Confirm or flag discrepancy |

**If approved — per-frame context block for Art Director:**

```
SERIES APPROVED

Frame 1 context (frame-01):
- composition_pattern: editorial-anchor
- zone: bottom-left
- shape required: role "divider"
- overlay: gradient to-bottom
- accent color: no
- copy tone: authoritative

Frame 2 context (frame-02):
- composition_pattern: full-bleed
- SILENT

Frame 3 context (frame-03):
- composition_pattern: data-callout
- zone: top-right
- shape required: none
- overlay: solid-bar
- accent color: yes (#B85530)
- copy tone: factual-stat

[... all frames]
```

**If rejected:**
```
SERIES REJECTED

Required changes:
1. Zone distribution: bottom-left used on 3 of 4 text frames (75%). Move frame-03 to top-right, frame-04 to bottom-center.
2. Shape quota: 4 frames, 0 shapes. Add shape to frame-01 (role: divider) and frame-03 (role: accent).
3. Overlay variety: all text frames use gradient. Change frame-04 to solid-bar.
```

Returns to Art Orchestrator with the rejection block. Orchestrator dispatches Technical Producer to fix. Series Director re-checks the corrected JSON.

---

### 3.6 Art Director

**Reads:** `[project-slug].json`, `inputs/image-map.md`, `shared/creative-brief.md`, `shared/color-overrides.md`, `post-composer/docs/ai-manual.md`
**Receives:** per-frame context block from Series Director
**Writes:** updated frame JSON + `screenshots/frame-NN-vN.jpg`

**Key differences from frameforge:**

1. **Series Director context is a constraint.** Zone, pattern, shape requirement, overlay strategy, accent color — these cannot be overridden without explicit user approval. The Art Director has full creative authority over how to execute these constraints, not whether to satisfy them.

2. **Reads `ai-manual.md` for composition pattern guidance.** The pattern assigned to this frame tells the Art Director what layer types are required and what makes the pattern succeed. The manual has the full pattern specification.

3. **Uses `agent-preview.html` for iteration** — Playwright target, see Section 4.

4. **No Copy Reviewer gate.** Art Director proposes and writes copy directly. Internal copy standard matches creative-brief.md tone and register.

5. **Multi-image frames:** If the frame has `multi_image: true`, the Art Director works with image layers instead of the background cover image. Uses `bg_color` to control what shows through gaps.

**Iteration loop:**
```
look at the photograph → read Series Director context → read ai-manual.md pattern spec
→ design → update JSON → navigate agent-preview → wait for ready → screenshot → evaluate
→ repeat until all 4 standard questions pass
```

**The four standard questions (from frameforge — retained):**
1. Does the text feel designed for this photograph, or dropped onto it?
2. Does the eye move naturally through the frame?
3. Does every element have a reason to exist specific to this image?
4. Would a viewer stop scrolling for this?

**Deliver:** Updated JSON for this frame + screenshot path + what changed from the draft and why + Series Director constraints satisfied (explicit confirmation).

---

### 3.7 Art Orchestrator

**Orchestrates:** Series Director → (rejection loop) → Art Director per frame → user approval gate

**Pre-flight check:** Confirm JSON path, image-map path, screenshots folder, agent-preview URL, Series Director context block.

**Loop:**

```
1. Dispatch Series Director
   → SERIES REJECTED → dispatch Technical Producer with rejection block → repeat from 1
   → SERIES APPROVED → proceed

2. For each frame in sequence:
   a. Dispatch Art Director with frame ID + Series Director context for this frame
   b. Receive updated JSON + screenshot
   c. Present screenshot to user — FULL STOP
   d. User approves → next frame
   e. User requests changes → increment version, re-dispatch Art Director for this frame
```

**One frame at a time.** Never batch art direction. Each frame gets its full cycle before the next begins.

**Screenshot format:** `screenshots/frame-01-v1.jpg`, `screenshots/frame-01-v2.jpg` on revision. Playwright: canvas element only — `browser_take_screenshot` with `element: "canvas"`, `type: "jpeg"`.

---

## Part 4 — agent-preview.html

Standalone HTML page at `post-composer/agent-preview.html`. Playwright-targetable by Art Director.

**Query params:** `?json=PATH&frame=FRAME_ID`

**Architecture:** Thin shell only — approximately 50 lines. Imports `editor/renderer.js`, `editor/layers.js`, `shared/fonts.js` directly. Calls `renderer.renderFrame()` with the same signature as the Editor. No duplicate rendering logic. Any change to the renderer is automatically reflected here.

**Behavior:**
1. Parse `json` and `frame` from query string
2. Fetch JSON at `json` path
3. Load fonts via `loadProjectFonts(design_tokens)`
4. Load images: resolve filenames from `image_index`, fetch from same directory as JSON
5. Find frame matching `frame` param
6. Size canvas to `export.width_px` × `export.height_px`
7. Call `renderer.renderFrame(canvas, frame, project, images, {})`
8. Set `document.body.dataset.status = 'ready'`

**Playwright update hook:**
```javascript
window.renderFrame = async (updatedFrame) => {
  document.body.dataset.status = 'rendering';
  // merge updatedFrame into project.frames
  renderer.renderFrame(canvas, updatedFrame, project, images, {});
  document.body.dataset.status = 'ready';
};
```

**No UI chrome.** Canvas only, fills the viewport. This page is never opened by a human.

---

## Part 5 — Key Differences Summary

| Dimension | frameforge | post-composer |
|---|---|---|
| Inputs | AI-guided image selection interview | Reads `inputs/` produced by app |
| Concept template | HTML + MD produced by Visual Designer | Eliminated — `creative-brief.md` is the design doc |
| Variety enforcement | None | Creative Director commits → Technical Producer validates → Series Director enforces |
| Copy review | Separate Copy Reviewer role | Internal to Creative Director |
| Frame-image mapping | AI-produced `frame-image-mapping.md` | App-produced `image-map.md`; AI reads it |
| Position model | Dual mode (zone + absolute %) | Zone-anchor only |
| Composition patterns | Implicit (no named patterns) | 7 named patterns, required per frame |
| Multi-image | Not supported | `multi_image: true` + `bg_color` |
| AI Manual | Field reference (how) | Design vocabulary guide (when + why) |
| Art Director context | Creative brief + color notes | + Series Director per-frame constraints |

---

## Part 6 — Decisions Not Made

1. **Orchestrator skill vs. user-run pipeline** — whether the full 7-step pipeline runs as a single orchestrator skill or whether the user invokes each role manually. Deferred to implementation.
2. **Series Director rejection limit** — how many rejection cycles before escalating to user. Deferred.
3. **`multi_image` in variety contract** — whether multi-image frame count factors into variety checks. Deferred (noted in multi-image spec).
4. **Agent-preview image loading in Playwright** — whether images are fetched from disk paths or require the live server to be running. Deferred to implementation.
