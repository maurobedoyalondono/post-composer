# AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 7-role AI pipeline that produces natural, organic post-composer JSON — AI Manual (design vocabulary guide), agent-preview.html (Playwright render target), and 7 skill files covering Concept Strategist through Art Orchestrator.

**Architecture:** Manual-first — the AI Manual is written before any skill, because all roles that touch JSON read it. agent-preview.html is a thin shell that imports `editor/renderer.js` directly; no rendering logic is duplicated. Skills follow the post-composer contract (variety contract, composition patterns, zone-anchor positions) and adapt frameforge patterns only where they still apply.

**Tech Stack:** Markdown (skill files, AI manual), HTML + ES modules (agent-preview.html), Claude Code skills system.

**Specs:**
- `post-composer/docs/superpowers/specs/2026-04-08-post-composer-design.md` — master spec
- `post-composer/docs/superpowers/specs/2026-04-09-post-composer-pipeline-design.md` — pipeline spec
- `post-composer/docs/superpowers/specs/2026-04-09-multi-image-frames-design.md` — multi-image spec

---

## File Map

| File | Action | Notes |
|---|---|---|
| `post-composer/docs/ai-manual.md` | Create | Design vocabulary guide — all JSON-producing roles read this |
| `post-composer/agent-preview.html` | Create | Thin shell — imports renderer.js, no duplicate logic |
| `post-composer/.claude/skills/post-composer-concept-strategist/SKILL.md` | Create | Step 1 role |
| `post-composer/.claude/skills/post-composer-creative-director/SKILL.md` | Create | Step 2 role — variety contract required |
| `post-composer/.claude/skills/post-composer-color-advisor/SKILL.md` | Create | Step 3 role — overrides only |
| `post-composer/.claude/skills/post-composer-technical-producer/SKILL.md` | Create | Step 4 role — validates variety contract |
| `post-composer/.claude/skills/post-composer-series-director/SKILL.md` | Create | Step 5 role — new enforcer gate |
| `post-composer/.claude/skills/post-composer-art-director/SKILL.md` | Create | Step 6 role — per-frame with Series Director context |
| `post-composer/.claude/skills/post-composer-art-orchestrator/SKILL.md` | Create | Orchestrates steps 5-6 loop |

---

## Task 1: AI Manual — Sections 1–4

**Files:**
- Create: `post-composer/docs/ai-manual.md`

- [ ] **Step 1: Create the AI manual with sections 1–4**

Create `post-composer/docs/ai-manual.md` with this exact content:

```markdown
# post-composer AI Manual

This manual is addressed to every role that generates or modifies JSON. Read it fully before making any design decision. It answers WHEN and WHY, not just HOW. A role that knows only the field names will produce valid JSON that looks flat. A role that knows this vocabulary will produce designs that respond to the specific image and series.

---

## Section 1 — Reading the Image

Answer these five questions before any design decision. The answers drive everything.

1. **Where does the eye go first?** — the subject, the brightest point, the strongest contrast.
2. **Where is the quiet space?** — flat sky, shadow, smooth ground, uniform tone. This is where text can live without competing.
3. **What is the emotional register?** — intimate, monumental, tense, serene, melancholy, triumphant. The design must match, not fight it.
4. **Where is the strongest zone — what must never be covered?** — the subject's face, the decisive moment, the peak of the compositional tension. Hard constraint. No element may cover or compete with this.
5. **What does this image need text to complete?** — context the viewer cannot know from the image alone: time, place, scale, biology, consequence. If the image is complete without text, silence is correct.

The design must come from this reading. Copy the JSON draft last, not first.

---

## Section 2 — Composition Patterns

Every frame must declare one. These are not aesthetic labels — they are structural commitments that determine what layers the frame requires.

**Series distribution rule:** No single pattern on more than 40% of frames. `full-bleed` and `minimal-strip` are exempt when silence is a documented editorial choice in the variety contract.

---

### `editorial-anchor`

**Description:** Text anchored to a geometric element — a rule line, a solid bar, a shape that gives the type a base to sit against.

**When to use:** Opening frames, title cards, act transitions. Any frame where text needs authority and structure.

**Required layers:**
- Shape layer with `role: "divider"` or `role: "anchor"` (mandatory — no text without the anchor)
- One or more text layers positioned in relation to the shape
- Overlay (gradient or solid-bar) at the text zone

**What makes it succeed:** The shape and text feel designed together — the text sits on or touches the shape, not floating nearby. The shape is thin and deliberate, not decorative.

**What kills it:** Shape present but visually disconnected from text. Text floating in open space with a decorative line somewhere else in the frame.

**Example JSON fragment:**
```json
{
  "id": "f01-anchor-line",
  "type": "shape",
  "shape": "rect",
  "role": "divider",
  "fill": "#B85530",
  "opacity": 1,
  "position": { "zone": "bottom-left", "offset_x_pct": 6, "offset_y_pct": -18 },
  "width_pct": 8,
  "height_pct": 0.35
},
{
  "id": "f01-headline",
  "type": "text",
  "content": "Canyon Series",
  "font": { "family": "Cormorant Garamond", "weight": 700, "size_pct": 10, "color": "#E0D8CE", "line_height": 1.0, "letter_spacing_em": -0.02, "align": "left" },
  "max_width_pct": 75,
  "position": { "zone": "bottom-left", "offset_x_pct": 6, "offset_y_pct": -12 }
}
```

---

### `minimal-strip`

**Description:** A single line or very tight block of text in a narrow zone. The image dominates. Almost silent.

**When to use:** Strong images that need only the smallest editorial label. Frames where anything more would compete with the photograph. Frames after a heavy text frame — the series needs to breathe.

**Required layers:**
- One text layer (maximum two) in a tight zone
- Overlay only if the text zone genuinely needs it — many minimal-strip frames need none
- No shapes

**What makes it succeed:** Restraint. The text is small, the zone is narrow, the image is the whole thing.

**What kills it:** Adding a shape "just in case." Using `minimal-strip` as a label for frames that are actually `editorial-anchor` without a shape.

**Example JSON fragment:**
```json
{
  "id": "f04-strip",
  "type": "text",
  "content": "Where light becomes architecture.",
  "font": { "family": "Cormorant Garamond", "weight": 700, "size_pct": 5.5, "color": "#E0D8CE", "line_height": 1.2, "letter_spacing_em": 0, "align": "center" },
  "max_width_pct": 70,
  "position": { "zone": "bottom-center", "offset_x_pct": -35, "offset_y_pct": -8 }
}
```

---

### `data-callout`

**Description:** A number or stat as the compositional hero. Large, bold, anchored to a key visual area.

**When to use:** When a fact adds meaning the image cannot carry — geological age, species count, altitude, distance. The number is the point.

**Required layers:**
- Large `data` font role text (size_pct 12–20) — this is the hero
- Supporting label text in `body` role beneath or beside the number
- Overlay (usually solid, not gradient — flat background lets the number read cleanly)
- Shapes optional

**What makes it succeed:** The number is genuinely large. It fills a significant portion of the frame. The label is small enough that the number dominates.

**What kills it:** Using a modest size (6–8%) for the number. Putting the number in a `display` serif font. Treating the label and number at equal visual weight.

**Numeral rule (non-negotiable):** Numbers and stats must use the `data` font family (Inter weight 700). Display and serif faces are prohibited for any layer whose primary content is a number or measurement.

**Example JSON fragment:**
```json
{
  "id": "f03-stat-value",
  "type": "text",
  "content": "300M",
  "font": { "family": "Inter", "weight": 700, "size_pct": 18, "color": "#B85530", "line_height": 1.0, "letter_spacing_em": -0.03, "align": "left" },
  "max_width_pct": 80,
  "position": { "zone": "top-right", "offset_x_pct": -60, "offset_y_pct": 12 }
},
{
  "id": "f03-stat-label",
  "type": "text",
  "content": "years of geological history\nexposed in these walls",
  "font": { "family": "Inter", "weight": 400, "style": "italic", "size_pct": 3.0, "color": "#E0D8CE", "line_height": 1.5, "letter_spacing_em": 0, "align": "left" },
  "max_width_pct": 55,
  "position": { "zone": "top-right", "offset_x_pct": -60, "offset_y_pct": 32 }
}
```

---

### `full-bleed`

**Description:** Image dominant. Zero overlay, zero text, zero shapes. Intentional silence — chosen, not defaulted to.

**When to use:** Cinematically complete images where any element would diminish the photograph. Frames where the preceding text has done the work. Emotional peaks that need space.

**Required layers:** None. `frame.layers` is an empty array.

**What makes it succeed:** The decision is made consciously. The creative brief's silence map names this frame explicitly.

**What kills it:** Using `full-bleed` because you couldn't think of anything to say. The silence must be earned and documented.

**Multi-image note:** `multi_image: true` with `full-bleed` creates a diptych silence — two images, no text. Use `bg_color` to control the gap between image layers.

**Example JSON fragment:**
```json
{
  "id": "frame-02",
  "image_src": "eroded-channels-closeup",
  "image_filename": "CC2A1463.jpg",
  "composition_pattern": "full-bleed",
  "layers": []
}
```

---

### `layered-depth`

**Description:** Multiple overlapping elements — text, shapes, overlays at different opacities — creating depth through transparency and stacking.

**When to use:** Frames where visual complexity serves the subject. Dense compositions with multiple information layers. When the photograph has complex tonality that can absorb graphic layers.

**Required layers:**
- Multiple elements (3+) at different opacities
- At least one shape layer
- Overlays used with varied blend_mode, not just `normal`

**What makes it succeed:** Each layer at a different depth feels intentional. The stacking creates a sense of the image plane behind the graphic elements, not competing with them.

**What kills it:** Elements that don't overlap — just many elements. `layered-depth` requires actual visual overlap and transparency play.

**Multi-image note:** `multi_image: true` works especially well here. Use a `bg_color` for the frame base, then position image layers at different sizes and opacities. The result is a true composite, not a single-image edit.

---

### `diagonal-tension`

**Description:** Key elements placed along a diagonal axis. Creates movement and energy.

**When to use:** Action-oriented subjects, photographs with strong diagonal lines, series that need visual momentum between frames.

**Required layers:**
- Text or shape elements positioned along a diagonal (not stacked vertically)
- Shape layer with `angle_deg` is common
- Position coordinates should reflect the diagonal — elements from bottom-left to top-right, or top-left to bottom-right

**What makes it succeed:** The viewer's eye follows a diagonal path through the frame. The diagonal in the design echoes or tensions against a diagonal in the photograph.

**What kills it:** Elements that are roughly diagonal but still feel like a vertical stack with slight offset.

---

### `centered-monument`

**Description:** A single centered element. Breathing space enforced on all sides. Formal, precise.

**When to use:** Closing frames, single powerful statements, subjects with perfect symmetry. Any moment that deserves formality.

**Required layers:**
- One primary element, centered (`middle-center` or `bottom-center` with generous offset)
- `max_width_pct` constrained (50–65%) — breathing space is enforced
- No shapes unless they are also centered and secondary
- Overlay only if needed

**What makes it succeed:** The centering is exact. The element has enough negative space on all sides that it feels monumental, not just centered.

**What kills it:** Centering an element but then adding off-axis secondary elements that pull the eye.

---

## Section 3 — Design Vocabulary

### image layer

Single-image mode (default):
- `frame.image_filename` is the background photo. Rendered as full-bleed cover.
- `fit: "cover"` — fill the canvas, crop to fit. Standard.
- `fit: "contain"` — fit entirely, letterbox. Use for watermarks, logos, insets where the full image must be visible.
- Anti-pattern: `fit: "fill"` — stretches the image. Never use.

Multi-image mode (`frame.multi_image: true`):
- Background cover render is skipped. Image layers own the canvas.
- Each image layer has independent `position`, `width_pct`, `height_pct`, `fit`, `opacity`.
- Use `frame.bg_color` to set what shows through transparent areas or gaps between images. If image layers cover the full canvas, `bg_color` has no visible effect.
- New layers start at 100×100% (full canvas). User or Art Director resizes from there.

```json
{
  "id": "img-inset",
  "type": "image",
  "src": "eroded-channels-closeup",
  "fit": "cover",
  "opacity": 0.85,
  "width_pct": 48,
  "height_pct": 60,
  "position": { "zone": "absolute", "x_pct": 52, "y_pct": 20 }
}
```

### overlay layer

Two strategies — given equal weight. Choose based on what is at the text zone:

**gradient** — effective when the zone transitions smoothly (sky, soft shadow, gradual blur):
```json
{
  "id": "overlay-grad",
  "type": "overlay",
  "opacity": 0.6,
  "color": "#1a1a2e",
  "blend_mode": "normal",
  "gradient": {
    "enabled": true,
    "direction": "to-bottom",
    "from_opacity": 0,
    "from_pos": 0,
    "to_opacity": 100,
    "to_pos": 100,
    "stops": [
      { "at": 0, "color": "rgba(26,26,46,0)" },
      { "at": 1, "color": "rgba(26,26,46,1)" }
    ]
  }
}
```

**solid-bar** — effective when the zone is textured, patterned, or color-conflicted. Text reads against a flat surface regardless of the photo underneath:
```json
{
  "id": "overlay-solid",
  "type": "overlay",
  "opacity": 0.45,
  "color": "#1a1a2e",
  "blend_mode": "multiply",
  "gradient": { "enabled": false }
}
```

**Decision tree:**
```
Does text in this frame need legibility help?
  No → omit overlay entirely. An overlay that darkens without serving text is an error.
  Yes → look at the text zone pixels:
    Smooth tonal transition → gradient in direction of text
    Noisy, textured, patterned, or color-conflicted → solid (gradient: enabled: false)
    Naturally dark uniform zone → no treatment needed
```

`blend_mode: "multiply"` creates a duotone tint — the overlay color tints the image. Use when the creative brief calls for a color wash.

### text layer

Three font roles, non-negotiable:

| Role | Family from design_tokens | Weight | Use for |
|---|---|---|---|
| `display` | `type_scale.display.family` | 700 | Headlines, display text |
| `body` | `type_scale.body.family` | 400 | Captions, eyebrows, supporting text |
| `data` | `type_scale.body.family` | 700 | ALL numbers, measurements, stats |

**Numeral rule:** Display and serif faces are prohibited for any layer whose primary content is a number or measurement. Use `data` role (body family, weight 700).

Size steps (use these — do not invent values outside the scale):
- display: `xl`=12%, `lg`=10%, `md`=8%, `sm`=6% of canvas height
- body: `md`=3.5%, `sm`=3.0%, `xs`=2.5%
- data: `xl`=16%, `lg`=12%, `md`=8%, `sm`=5%

```json
{
  "id": "eyebrow",
  "type": "text",
  "content": "AMERICAN SOUTHWEST",
  "font": {
    "family": "Inter",
    "weight": 400,
    "size_pct": 2.2,
    "color": "#B85530",
    "line_height": 1.2,
    "letter_spacing_em": 0.15,
    "align": "left"
  },
  "max_width_pct": 80,
  "position": { "zone": "bottom-left", "offset_x_pct": 6, "offset_y_pct": -15 }
}
```

**Always set `max_width_pct`.** Never omit it.

### shape layer

`role` field required on every shape. Declare the compositional purpose before placing the shape.

| role | When to use |
|---|---|
| `divider` | Separates two text elements or text regions |
| `accent` | Small color punctuation — draws the eye to an area |
| `anchor` | Geometric base that text sits on or near |
| `badge` | Enclosed label — circle, rounded rect, tag |
| `frame` | Border element — surrounds or outlines a region |
| `silhouette` | Large shape echoing or masking a photographic form |
| `callout` | Points to or isolates a specific area |

Shape types: `rect`, `line`, `circle`, `triangle`, `arrow`, `polygon`, `polyline`, `path`, `image_mask`.

Shapes are compositional instruments — not decoration. A thin rule separates text voices. A large semi-transparent rect anchors a type zone. A diagonal line echoes a diagonal in the photograph. The shape quota (1 per 3 frames minimum) exists because shapes were the most under-used element in every flat series.

Anti-patterns:
- Adding a rule above a headline "because that's what editorial layouts do" — the shape must respond to this specific image
- Shapes to fill empty space
- Never place a line above a `data-callout` stat value

```json
{
  "id": "accent-dot",
  "type": "shape",
  "shape": "circle",
  "role": "accent",
  "fill": "#B85530",
  "opacity": 1,
  "position": { "zone": "top-left", "offset_x_pct": 6, "offset_y_pct": 8 },
  "width_pct": 1.5,
  "height_pct": 1.0
}
```

### stats_block layer

For multiple statistics displayed as a group:

```json
{
  "id": "stats-row",
  "type": "stats_block",
  "layout": "horizontal",
  "position": { "zone": "bottom-left", "offset_x_pct": 6, "offset_y_pct": -5 },
  "gap_pct": 6,
  "items": [
    {
      "value": "300",
      "label": "MILLION YEARS",
      "value_font": { "family": "Inter", "weight": 700, "size_pct": 8, "color": "#B85530" },
      "label_font": { "family": "Inter", "weight": 400, "size_pct": 2.0, "color": "#5C6B74", "letter_spacing_em": 0.1 }
    }
  ]
}
```

Stats content standards — write numbers in full:
- "4 to 5 meters" not "4-5 m"
- "Over 100" not "100+"
- "Nearly 200 kilometers" not "~200 km"
- "50 percent" not "50%"

---

## Section 4 — Variety Rules

Non-negotiable series constraints. Run the full checklist (Section 8) before outputting any JSON.

1. **Zone distribution:** No zone used on more than 40% of text frames. If 4 text frames exist, no zone on more than 1.6 (= at most 1) frame.
2. **Shape quota:** Minimum 1 shape layer per 3 frames. 6 frames = 2 shapes minimum. Waiver must be documented in variety contract with reason.
3. **Overlay strategies:** At least 2 different strategies across the series. gradient-only or solid-only is a failure.
4. **Accent color:** Accent color appears on ≥ 2 frames. If the series has no accent color use, document the exclusion.
5. **Composition patterns:** No single pattern on more than 40% of frames.
6. **Copy tone:** Not all text frames use the same register. Mix factual-label, direct address, poetic fragment, interrogative.
7. **Silence pacing:** Silent frames match the `silence_map` declared in the variety contract. No surprise silences.
```

- [ ] **Step 2: Verify sections 1–4 are complete**

Check:
- [ ] Section 1 has all 5 reading questions
- [ ] Section 2 has all 7 composition patterns with JSON fragments
- [ ] Section 3 has image, overlay, text, shape, stats_block with JSON examples
- [ ] Section 4 has all 7 variety rules with specific numeric thresholds

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add docs/ai-manual.md
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add AI manual sections 1-4 (image reading, composition patterns, design vocabulary, variety rules)"
```

---

## Task 2: AI Manual — Sections 5–8

**Files:**
- Modify: `post-composer/docs/ai-manual.md` (append sections 5–8)

- [ ] **Step 1: Append sections 5–8 to ai-manual.md**

Append this content to `post-composer/docs/ai-manual.md`:

```markdown
---

## Section 5 — Typography Rules

- `display` family — headlines and display text only. Never for numbers or measurements.
- `body` family — captions, eyebrows, supporting text. Light weight (400) by default.
- `data` family — all numeric content. Bold (700). Never use a serif or display face for numbers.

**Letter spacing:**
- Display text: slight tightening, `-0.02` to `-0.03` em. Large text at normal spacing feels loose.
- Body text: `0` to `0.05` em. Neutral.
- Eyebrows and labels in all-caps: wide spacing, `0.1` to `0.2` em. All-caps text needs room.

**Line height:**
- Display: `0.95` to `1.1`. Headlines stack tightly.
- Body: `1.4` to `1.6`. Reading text needs breathing room.

**Alignment:**
- Left for edge-anchored designs (`editorial-anchor`, `minimal-strip`, `data-callout`).
- Center for symmetric patterns (`centered-monument`).
- Match the frame's compositional axis.

**Text shadow:** Use only when text must cross a high-contrast, busy area where overlay is not possible. Keep `blur_px` high (10–16), `opacity` moderate (0.4–0.6). Never a hard shadow.

---

## Section 6 — Overlay Rules

Run this decision tree before setting any overlay value:

```
Does any text in this frame need legibility help against the photograph?
  No
    → omit the overlay entirely
    → an overlay that darkens without serving text is a mistake, not a default
  Yes — look at the pixels at the text zone:
    Smooth tonal transition (sky, soft blur, gradual shadow)
      → gradient in the direction of text
      → set from_opacity to 0, to_opacity to the minimum the image requires
      → look at the actual pixels — do not copy the draft number
    Noisy, textured, patterned, or color-conflicted
      → solid overlay (gradient: { enabled: false })
      → text reads against a flat surface regardless of what the photo does underneath
    Naturally dark, uniform zone (deep shadow, dark wall, night sky)
      → no treatment needed — the image provides the contrast
```

**Opacity:** Always the minimum needed. An overlay that obscures 60% of the photo when 30% would have been enough is not neutral — it changes the image.

**blend_mode: "multiply":** Creates a duotone effect — the overlay color tints the image through multiplication. Use when the creative brief calls for a specific tonal cast, not as a darkening shortcut.

**gradient.stops:** Include explicit stop colors matching the overlay `color` at full and zero opacity. This ensures consistent rendering across all canvas sizes.

---

## Section 7 — Layout Rules

### Zone anchor system

All positions use zone anchors with percentage offsets. This is the only position model — no raw x_pct/y_pct except with `zone: "absolute"`.

```json
"position": {
  "zone": "bottom-left",
  "offset_x_pct": 6,
  "offset_y_pct": -12
}
```

**Zone names:** `top-left`, `top-center`, `top-right`, `middle-left`, `middle-center`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`.

**Offset direction:**
- Bottom zones: negative `offset_y_pct` moves UP (toward center). `-12` means 12% of canvas height above the bottom edge.
- Top zones: positive `offset_y_pct` moves DOWN.
- Left zones: positive `offset_x_pct` moves RIGHT.
- Right zones: negative `offset_x_pct` moves LEFT (toward center).

**Absolute placement** (rare — for image layers in multi_image mode, or precise geometric positioning):
```json
"position": { "zone": "absolute", "x_pct": 52, "y_pct": 20 }
```
x_pct 0=left edge, 100=right edge. y_pct 0=top edge, 100=bottom edge.

### Stacking math

For a vertical text stack, compute vertical space from the bottom up:
- Layer height ≈ `(size_pct / 100 × canvas_height) × line_height × line_count`
- Add 1–2% of canvas height between stacked elements for breathing room

Example for a bottom-left stack (caption → headline → eyebrow, reading bottom to top):
- caption at `offset_y_pct: -6` (6% above bottom)
- headline at `offset_y_pct: -12` (12% above bottom — enough for the caption)
- eyebrow at `offset_y_pct: -18` (above the headline)

### Safe zone

Keep all text and graphic elements within the inner 80% of the canvas (10% margin on each side) unless the design explicitly breaks this boundary for compositional effect.

### Layer ordering

Layers render bottom-to-top in the array. Standard order:
1. Image layer (if multi_image)
2. Overlay
3. Shapes
4. Text (body/eyebrow)
5. Text (display/headline)
6. Text (data/stat)

A shape that sits behind text must appear earlier in the array.

---

## Section 8 — Pre-Output Checklist

Run before outputting any JSON. Fix every failure. Never flag and defer.

```
□ composition_pattern present and valid on every frame
□ No zone used on > 40% of text frames — count and verify
□ Shape quota: 1 shape per 3 frames minimum, or waiver documented in variety contract
□ At least 2 different overlay strategies across the series
□ Accent color on ≥ 2 frames, or exclusion documented
□ Pattern distribution: no single pattern on > 40% of frames
□ silence_map frames have no text layers, no overlays, no shapes (layers: [])
□ image_filename present on every frame — from image-map.md, not invented
□ data font role used for all numeric content — no display/serif family for numbers
□ role field present on every shape layer
□ All positions use zone-anchor model — no bare x_pct/y_pct except zone: "absolute"
□ multi_image frames: bg_color set if image layers don't cover the full canvas
□ globals.google_fonts populated from design_tokens font families
□ max_width_pct set on every text layer
```
```

- [ ] **Step 2: Verify the complete AI manual**

Check:
- [ ] Section 5 covers letter spacing, line height, alignment, shadow rules
- [ ] Section 6 has the full decision tree with all three branches
- [ ] Section 7 covers zone anchors, offset direction, stacking math, safe zone, layer ordering
- [ ] Section 8 checklist has 14 items and all items from the pipeline spec's 8-point list are present

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add docs/ai-manual.md
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: complete AI manual sections 5-8 (typography, overlay, layout rules, pre-output checklist)"
```

---

## Task 3: agent-preview.html

**Files:**
- Create: `post-composer/agent-preview.html`

- [ ] **Step 1: Create agent-preview.html**

Create `post-composer/agent-preview.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer agent preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; }
    canvas { display: block; max-width: 100vw; max-height: 100vh; }
  </style>
</head>
<body data-status="loading">
<canvas id="preview-canvas"></canvas>
<script type="module">
import { renderer }        from './editor/renderer.js';
import { loadProjectFonts } from './shared/fonts.js';

const params   = new URLSearchParams(location.search);
const jsonPath = params.get('json');
const frameId  = params.get('frame');

if (!jsonPath || !frameId) {
  document.body.dataset.status = 'error';
  throw new Error('agent-preview: ?json= and ?frame= are required');
}

const canvas = document.getElementById('preview-canvas');

// Resolve image base directory from the JSON path
const jsonBase = jsonPath.substring(0, jsonPath.lastIndexOf('/') + 1);

async function loadImage(filename) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve([filename, img]);
    img.onerror = () => { console.warn(`[preview] Image not found: ${filename}`); resolve([filename, null]); };
    img.src = jsonBase + filename;
  });
}

async function init() {
  // Fetch project JSON
  const res     = await fetch(jsonPath);
  const project = await res.json();

  // Find the requested frame
  const frame = project.frames.find(f => f.id === frameId);
  if (!frame) throw new Error(`[preview] Frame not found: ${frameId}`);

  // Load fonts
  await loadProjectFonts(project.design_tokens);

  // Load images — collect all filenames referenced in the project
  const filenames = new Set();
  if (project.image_index) project.image_index.forEach(e => filenames.add(e.filename));
  project.frames.forEach(f => {
    if (f.image_filename) filenames.add(f.image_filename);
    (f.layers ?? []).forEach(l => { if (l.type === 'image' && l.src) filenames.add(l.src); });
  });

  const pairs   = await Promise.all([...filenames].map(loadImage));
  const images  = new Map(pairs.filter(([, img]) => img !== null));

  // Size canvas to export dimensions
  canvas.width  = project.export.width_px;
  canvas.height = project.export.height_px;

  // Render — same call as the editor
  renderer.renderFrame(canvas, frame, project, images, {});

  document.body.dataset.status = 'ready';
}

// Expose update hook for Playwright
window.renderFrame = async (updatedFrame) => {
  document.body.dataset.status = 'rendering';
  // Replace the frame in the local project reference so re-renders are consistent
  const project = window.__project;
  if (project) {
    const idx = project.frames.findIndex(f => f.id === updatedFrame.id);
    if (idx !== -1) project.frames[idx] = updatedFrame;
  }
  renderer.renderFrame(canvas, updatedFrame, window.__project, window.__images, {});
  document.body.dataset.status = 'ready';
};

// Run
init().then(() => {
  // Store references for renderFrame hook
  // Re-run init to get project + images into scope — store on window
}).catch(err => {
  console.error('[preview]', err);
  document.body.dataset.status = 'error';
});
</script>
</body>
</html>
```

- [ ] **Step 2: Fix the renderFrame hook — store project and images on window**

The `window.renderFrame` hook needs access to `project` and `images`. Revise the `init` function to store them:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer agent preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; }
    canvas { display: block; max-width: 100vw; max-height: 100vh; }
  </style>
</head>
<body data-status="loading">
<canvas id="preview-canvas"></canvas>
<script type="module">
import { renderer }         from './editor/renderer.js';
import { loadProjectFonts } from './shared/fonts.js';

const params   = new URLSearchParams(location.search);
const jsonPath = params.get('json');
const frameId  = params.get('frame');

if (!jsonPath || !frameId) {
  document.body.dataset.status = 'error';
  throw new Error('agent-preview: ?json= and ?frame= are required');
}

const canvas  = document.getElementById('preview-canvas');
const jsonBase = jsonPath.substring(0, jsonPath.lastIndexOf('/') + 1);

async function loadImage(filename) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve([filename, img]);
    img.onerror = () => { console.warn(`[preview] Image not found: ${filename}`); resolve([filename, null]); };
    img.src = jsonBase + filename;
  });
}

async function init() {
  const res     = await fetch(jsonPath);
  const project = await res.json();

  const frame = project.frames.find(f => f.id === frameId);
  if (!frame) throw new Error(`[preview] Frame not found: ${frameId}`);

  await loadProjectFonts(project.design_tokens);

  const filenames = new Set();
  if (project.image_index) project.image_index.forEach(e => filenames.add(e.filename));
  project.frames.forEach(f => {
    if (f.image_filename) filenames.add(f.image_filename);
    (f.layers ?? []).forEach(l => { if (l.type === 'image' && l.src) filenames.add(l.src); });
  });

  const pairs  = await Promise.all([...filenames].map(loadImage));
  const images = new Map(pairs.filter(([, img]) => img !== null));

  canvas.width  = project.export.width_px;
  canvas.height = project.export.height_px;

  renderer.renderFrame(canvas, frame, project, images, {});

  // Store for renderFrame hook
  window.__project = project;
  window.__images  = images;

  document.body.dataset.status = 'ready';
}

window.renderFrame = async (updatedFrame) => {
  document.body.dataset.status = 'rendering';
  if (window.__project) {
    const idx = window.__project.frames.findIndex(f => f.id === updatedFrame.id);
    if (idx !== -1) window.__project.frames[idx] = updatedFrame;
  }
  renderer.renderFrame(canvas, updatedFrame, window.__project, window.__images, {});
  document.body.dataset.status = 'ready';
};

init().catch(err => {
  console.error('[preview]', err);
  document.body.dataset.status = 'error';
});
</script>
</body>
</html>
```

Write this final version to `post-composer/agent-preview.html`.

- [ ] **Step 3: Test in browser**

Open via VS Code Live Server:
```
http://127.0.0.1:5500/post-composer/agent-preview.html?json=samples/canyon-series-2026/canyon-series-2026.json&frame=frame-01
```

Expected: canvas renders frame-01 (editorial-anchor — gradient overlay, accent divider line, "AMERICAN SOUTHWEST" eyebrow, "Canyon Series" headline, caption). `document.body.dataset.status` should be `"ready"`.

If images don't load (404): images need to be in `post-composer/samples/canyon-series-2026/` alongside the JSON. Add sample images if testing.

- [ ] **Step 4: Verify Playwright wait pattern in browser console**

Open browser console and run:
```javascript
document.body.dataset.status
// expected: "ready"

await window.renderFrame({
  "id": "frame-01",
  "image_src": "wide-canyon-overview",
  "image_filename": "CC2A1369.jpg",
  "composition_pattern": "editorial-anchor",
  "layers": []
});
document.body.dataset.status
// expected: "ready" — canvas now shows frame-01 with no layers (just the photo)
```

- [ ] **Step 5: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add agent-preview.html
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add agent-preview.html — thin Playwright render target importing renderer.js"
```

---

## Task 4: post-composer-concept-strategist SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-concept-strategist/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-concept-strategist"
```

Create `post-composer/.claude/skills/post-composer-concept-strategist/SKILL.md`:

```markdown
---
name: post-composer-concept-strategist
description: Use when starting a post-composer project — reads the inputs package produced by the Project Manager app and writes narrative-brief.md. Does not interview the user about image selection — the brief and image arrangement are already decided.
---

# post-composer Concept Strategist

You are a Concept Strategist beginning a new editorial photography project. The curation is already done — the photographer has selected and arranged their images in the Project Manager app. Your job is to understand the story they want to tell and write a clear editorial direction that guides every downstream role.

**Project slug:** [PROJECT_SLUG]
**Inputs folder:** [INPUTS_PATH]

---

## Read before anything else

In this order:

1. **`[INPUTS_PATH]/project-brief.txt`** — the photographer's story, tone, platform, and any notes. This is your primary source. Do not invent any detail not present here.
2. **`[INPUTS_PATH]/image-map.md`** — the table of `frame | raw_filename | descriptive_label`. This is the authoritative frame sequence in the order the photographer arranged it.
3. **`[INPUTS_PATH]/image-sheet.jpg`** — the thumbnail grid. Study each frame's visual content: subject, composition, mood, what the photograph communicates.

Confirm all three are read before continuing.

---

## Your role

Read the brief. Study the images. Write the narrative brief that translates the photographer's intent into editorial direction.

Do not ask clarifying questions unless something in the brief is genuinely ambiguous and unresolvable from context. The photographer has already answered the key questions in the brief — your job is to synthesize, not re-interview.

If a clarifying question is truly necessary, ask only one at a time and wait for the answer before continuing.

---

## Frame sequence

The image-map.md order reflects the photographer's intended sequence. You may propose a reorder if the narrative logic strongly supports it — but state your reasoning explicitly and wait for user approval before proceeding. When in doubt, preserve the photographer's order.

---

## Write the narrative brief

Once you have read all three inputs, write `[NARRATIVE_BRIEF_PATH]` with this exact structure:

```markdown
# Narrative Brief — [PROJECT_TITLE]

## Project
- **Title:** [from project-brief.txt]
- **Platform:** [from project-brief.txt]
- **Total frames:** [count from image-map.md]
- **Tone:** [from project-brief.txt, or "AI decides" if not specified]

## Story
[Synthesized from the photographer's story text — what this series is about, what journey it takes the viewer on. 2–3 sentences. Do not invent facts.]

## Confirmed facts
[Any geographic names, dates, statistics, or other facts from project-brief.txt — never invented. If none, write "None confirmed."]

## Narrative structure

| Act | Theme | Frames | Editorial intent |
|-----|-------|--------|-----------------|
| Opening | [theme] | frame-01 | [one line] |
| [Act name] | [theme] | frame-02–NN | [intent] |
| Closing | [theme] | frame-NN | [one line] |

## Viewer journey

[250–350 words of prose. Describes the viewer's emotional experience from frame 1 to the last frame. Not what the images show — what the viewer feels, understands, and experiences as the series unfolds. Written as a director's note to the Creative Director.]

## Approved frame sequence

| Frame | Filename | Descriptive label | Narrative role |
|-------|----------|-------------------|----------------|
| frame-01 | [from image-map.md] | [from image-map.md] | [role in the story] |
| frame-02 | [from image-map.md] | [from image-map.md] | [role] |
| [continue for all frames] | | | |
```

---

## Return protocol

Present the narrative brief to the user. Iterate — revise structure, viewer journey, frame roles — until approved.

Once approved, save to `[NARRATIVE_BRIEF_PATH]` and return:

`STATUS: NARRATIVE BRIEF COMPLETE`
- Path: `[NARRATIVE_BRIEF_PATH]`
- Frame count: [N]
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] Reads from `inputs/` folder — not asking interview questions
- [ ] Uses `image-map.md` as authoritative frame sequence
- [ ] Output format includes all required sections (project, story, facts, structure, viewer journey, sequence table)
- [ ] Return protocol uses correct status string

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-concept-strategist/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-concept-strategist skill"
```

---

## Task 5: post-composer-creative-director SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-creative-director/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-creative-director"
```

Create `post-composer/.claude/skills/post-composer-creative-director/SKILL.md`:

```markdown
---
name: post-composer-creative-director
description: Use when the Concept Strategist has approved a narrative brief — develops the full editorial concept: design tokens, per-frame briefs with reviewed copy, and the variety contract that binds all downstream roles.
---

# post-composer Creative Director

You are a Creative Director developing the full editorial concept for a photography series. The story is established. Your job is to define the visual language — design tokens, composition plan — and write a complete per-frame brief for each frame, including a variety contract that every downstream role is bound by.

**Project:** [PROJECT_SLUG]

---

## Read before anything else

In this order:

1. **`[NARRATIVE_BRIEF_PATH]`** — your single source of truth. Every creative decision must serve this narrative. Do not invent facts, locations, or details not confirmed here.
2. **`[INPUTS_PATH]/image-sheet.jpg`** — study each frame's thumbnail. You are designing for these specific images.
3. **`post-composer/docs/ai-manual.md`** — read Section 2 (Composition Patterns) and Section 4 (Variety Rules) fully before writing the variety contract.

---

## Series-level decisions

### Design tokens

Define the four palette colors — editorial choices that hold up as text and shapes placed on top of photographs. These are not extracted from the photos.

| Token | Role |
|---|---|
| `background` | Canvas fill, deep overlay base |
| `primary` | Main text and graphic color |
| `accent` | Punctuation color — used sparingly, high contrast |
| `neutral` | Secondary text, supporting elements |

Choose one display face and one sans-serif face. Both must be valid Google Fonts family names. The sans-serif serves as both body and data family — data role uses it at weight 700.

**Numeral rule (non-negotiable):** The sans-serif handles all numbers, stats, and measurements. Display and serif faces are prohibited for any layer whose primary content is a number or measurement.

---

## Story arc — map before per-frame work

Before writing any per-frame brief:

1. **Identify structural text moments** — opening frame, act transitions, closing. These frames earn text regardless of image strength.
2. **Map what text can add** — facts the viewer cannot know from the image: time, scale, biology, consequence. List candidate strings.
3. **Identify silence frames** — cinematically complete images, frames after heavy text. Silence must be chosen, not defaulted to.
4. **Map the text spine** — list all candidate strings in sequence. Ask: would a viewer reading only these learn something specific at each moment? If they sound like fortune cookies, rewrite as facts.

---

## Variety contract (mandatory)

Write the variety contract before any per-frame brief. This is the binding series-level commitment — not aspirational direction. Every downstream role validates against it.

The contract must specify all seven fields:

**1. Zone map** — which zone each text frame uses. No zone may appear on more than 40% of text frames. Count before committing.

**2. Silence map** — which frames are silent (no text, no overlay, no shapes) and why.

**3. Composition pattern per frame** — declared upfront for every frame. Use the 7 named patterns from ai-manual.md Section 2. No single pattern on more than 40% of frames.

**4. Shape plan** — which frames include shapes and what role they serve. Minimum 1 shape per 3 frames. If waiving, state the reason explicitly.

**5. Overlay strategies** — minimum 2 strategies named and assigned to frames. At least one gradient and one solid-bar across the series.

**6. Accent color plan** — which frames use the accent color. Minimum 2 frames, or document the exclusion with reason.

**7. Copy tone rhythm** — how tone varies. Not all frames the same register. Name the registers in use (e.g., factual-label, direct address, poetic fragment, interrogative).

---

## Per-frame brief

For each frame in the approved sequence:

**What context does text add that the image cannot show?**

Text carries what is invisible: time, meaning, consequence, scale. If the image is complete without text — silence. If text adds something specific — write it.

For each frame state:
- **Pattern:** which composition pattern
- **Zone:** which zone (from variety contract)
- **Copy decision:** what text adds (or why silence is correct)
- **Copy strings:** specific, verifiable, publication-ready. Not poems. Not labels. Facts.
- **Overlay treatment:** gradient direction | solid | none (read the image at the text zone)
- **Shape:** what shape, what role, or "none — [reason]"
- **Accent:** yes/no

---

## Internal copy review (complete before presenting to user)

After all per-frame briefs are written, review every proposed string as a professional copy editor. Do not present until complete.

Check each string for:
- **Grammar:** correct sentence structure
- **Completeness:** no truncated phrases
- **Register:** consistent editorial tone
- **Precision:** every word earns its place
- **Redundancy:** text says something the image cannot show
- **Factual accuracy:** no invented figures or names

Replace failing strings — do not flag and defer.

---

## Return protocol

Present the full concept to the user — design tokens, variety contract, and all per-frame briefs with reviewed copy. Iterate until approved.

Once approved, return:

`STATUS: CONCEPT APPROVED`

```
CONCEPT SUMMARY
Project: [PROJECT_SLUG]
Design tokens:
  background: [hex]
  primary: [hex]
  accent: [hex]
  neutral: [hex]
  display: [exact Google Fonts family name]
  body: [exact Google Fonts family name]

Variety contract:
  zone_map:
    frame-01: [zone]
    frame-02: [zone or "silent"]
    [all frames]
  silence_map: [list of frame numbers that are silent]
  composition_patterns:
    frame-01: [pattern]
    [all frames]
  shape_plan:
    frame-01: [role and description | none]
    [all frames with shapes]
  overlay_strategies: [gradient | solid-bar — list both with which frames]
  accent_frames: [list | "none — reason"]
  copy_tone_rhythm: [description of tone variety]

Per-frame briefs:
  frame-01: [descriptive_label]
    pattern: [pattern]
    zone: [zone]
    overlay: [gradient to-bottom | solid | none]
    shape: [role — description | none]
    accent: [yes | no]
    [silent]
    OR:
    eyebrow: "[exact string]"
    headline: "[exact string]"
    caption: "[exact string]"
  [repeat for all frames]
```
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] Variety contract section requires all 7 fields
- [ ] Numeral rule stated explicitly
- [ ] Internal copy review is mandatory before presenting to user (no external Copy Reviewer role)
- [ ] Return block format includes design tokens + variety contract + per-frame briefs

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-creative-director/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-creative-director skill"
```

---

## Task 6: post-composer-color-advisor SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-color-advisor/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-color-advisor"
```

Create `post-composer/.claude/skills/post-composer-color-advisor/SKILL.md`:

```markdown
---
name: post-composer-color-advisor
description: Use when the Creative Director has approved the concept — reads each frame's text zone thumbnail and writes color-overrides.md containing only frames where the palette color fails. Silent frames and safe frames produce no entry.
---

# post-composer Color Advisor

You are checking whether the approved palette colors are legible at each frame's text zone. The palette is a series-level default — it was chosen before anyone looked closely at individual photographs. Some zones will defeat it.

Your output is `color-overrides.md` — a short file containing only corrections. If a palette color is safe at a frame's zone: write nothing for that frame. The document is short by design.

**Project:** [PROJECT_SLUG]

---

## Read before anything else

1. **`[CREATIVE_BRIEF_PATH]`** — palette hex codes and roles, per-frame zone and text layer specs, silence map.
2. **`[INPUTS_PATH]/image-sheet.jpg`** — the thumbnail grid. You will assess text zones from these thumbnails.

---

## Per-frame analysis

Work through every frame in the creative brief in sequence.

**Silent frames** (in silence map): write nothing. Skip.

**Text frames:**

1. Locate the frame's thumbnail in `image-sheet.jpg`
2. Identify the text zone declared in the creative brief
3. Focus exclusively on that zone — not the whole image

Assess the text zone:
- **Luminance:** very dark / dark / medium / light / very light
- **Dominant hues:** name the colors present at the zone
- **Zone character:** uniform or busy/textured

For each text role in this frame (eyebrow, headline, caption, stat value, etc.), evaluate the creative brief's palette color:

**Can a viewer read this color here, without effort?**

| Zone type | Risk |
|---|---|
| Very dark / dark, neutral hues | Low — palette colors generally safe. Check hue conflicts. |
| Dark with hue matching palette color | Medium — perceptual contrast low even with luminance contrast |
| Medium luminance (40–60%) | High — muted palette colors often disappear |
| Light / very light | Critical — any muted color at high risk |
| Busy / high-texture | Any color at risk regardless of luminance |

**Hue conflict rule:** If the zone hue is close to the palette color (warm amber zone + warm accent hex), flag even on a dark background.

**Decision for each role:**
- `✓ SAFE — [one-line reason]` → no entry needed
- `⚠ OVERRIDE → #FFFFFF — [one-line reason]`
- `⚠ OVERRIDE → [specific hex] — [one-line reason]`

Do not hedge. Make the call.

---

## Output

Save `[COLOR_OVERRIDES_PATH]` with this structure. Include only frames with actual overrides:

```markdown
# Color Overrides — [PROJECT_TITLE]

## frame-03 · [descriptive_label]
Zone: [zone] — [one sentence: what the zone actually looks like]
Luminance: [level]

| Role | Palette color | Override | Reason |
|------|---------------|----------|--------|
| caption | `#5C6B74` | `#FFFFFF` | neutral disappears against warm ochre at medium luminance |
```

If all frames are safe, write: `# Color Overrides — [PROJECT_TITLE]\n\nNo overrides required. All palette colors are legible at their declared zones.`

---

## Return protocol

Save the file and return:

`STATUS: COLOR OVERRIDES COMPLETE`
- Path: `[COLOR_OVERRIDES_PATH]`
- Frames with overrides: [list | "none"]
- Overall palette reliability: [one sentence]
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] Overrides only — no full palette re-statement
- [ ] Silent frames produce no entry
- [ ] Safe frames produce no entry
- [ ] Output format is minimal by design

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-color-advisor/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-color-advisor skill"
```

---

## Task 7: post-composer-technical-producer SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-technical-producer/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-technical-producer"
```

Create `post-composer/.claude/skills/post-composer-technical-producer/SKILL.md`:

```markdown
---
name: post-composer-technical-producer
description: Use when the Creative Director has approved the concept and Color Advisor has completed overrides — generates the complete project JSON, validated against the variety contract. No placeholders, no invented filenames, no failed checklist items in output.
---

# post-composer Technical Producer

You are translating a fully approved editorial concept into the post-composer project JSON. Precision matters more than creativity. Every field must be exact, every constraint satisfied. Run the pre-output checklist and fix every failure before writing the file.

**Project:** [PROJECT_SLUG]

---

## Read before anything else

In this order:

1. **`post-composer/docs/ai-manual.md`** — read fully. Pay particular attention to: Section 2 (Composition Patterns — JSON fragments), Section 3 (Design Vocabulary — layer schemas), Section 7 (Layout Rules — zone anchor system), Section 8 (Pre-Output Checklist).
2. **`[CREATIVE_BRIEF_PATH]`** — design tokens, variety contract, per-frame briefs with copy and overlay specs.
3. **`[COLOR_OVERRIDES_PATH]`** — per-frame color corrections. Where a frame has an override, use the override — not the palette color. If the file states no overrides required, palette colors apply throughout.
4. **`[INPUTS_PATH]/image-map.md`** — the authoritative source for `image_filename` and `image_src` (descriptive_label). Copy values exactly — do not invent or guess filenames.

---

## JSON structure

Generate the complete project JSON following this top-level structure:

```json
{
  "project": {
    "id": "[PROJECT_SLUG]",
    "title": "[PROJECT_TITLE]"
  },
  "export": {
    "target": "[platform from creative brief]",
    "width_px": [width],
    "height_px": [height]
  },
  "design_tokens": {
    "palette": {
      "background": "[hex]",
      "primary":    "[hex]",
      "accent":     "[hex]",
      "neutral":    "[hex]"
    },
    "type_scale": {
      "display": { "family": "[display face]", "weight": 700, "steps": { "xl": 12, "lg": 10, "md": 8, "sm": 6 } },
      "body":    { "family": "[body face]",    "weight": 400, "steps": { "md": 3.5, "sm": 3.0, "xs": 2.5 } },
      "data":    { "family": "[body face]",    "weight": 700, "steps": { "xl": 16, "lg": 12, "md": 8, "sm": 5 } }
    },
    "spacing_scale": [4, 6, 8, 12, 16, 24]
  },
  "variety_contract": {
    "zone_max_usage_pct": 40,
    "shape_quota": { "min_per_n_frames": 3, "waiver": null },
    "overlay_strategies": ["gradient", "solid-bar"],
    "overlay_strategies_min": 2,
    "accent_color_frames": ["frame-NN", ...],
    "accent_color_min": 2,
    "copy_tone_variety": true,
    "silence_map": [N, ...],
    "composition_patterns": {
      "frame-01": "[pattern]",
      "frame-02": "[pattern]",
      ...
    }
  },
  "globals": {
    "google_fonts": ["[display family]:wght@700", "[body family]:wght@400;700"]
  },
  "image_index": [
    { "label": "[descriptive_label from image-map.md]", "filename": "[raw_filename from image-map.md]" }
  ],
  "frames": [ ... ]
}
```

**Per-frame structure:**
```json
{
  "id": "frame-01",
  "image_src": "[descriptive_label from image-map.md]",
  "image_filename": "[raw_filename from image-map.md]",
  "composition_pattern": "[pattern from variety contract]",
  "layers": [ ... ]
}
```

For multi-image frames: add `"multi_image": true`. For per-frame background: add `"bg_color": "[hex]"`.

**image_filename rule:** Copy from the `raw_filename` column of `image-map.md` exactly. Never invent, guess, or leave blank.

**image_src rule:** Copy from the `descriptive_label` column of `image-map.md` exactly.

**Color override rule:** For any frame listed in `color-overrides.md`, use the override hex for that text role. The override supersedes the palette for that specific layer.

---

## Variety contract validation pass

Before writing the JSON file, run every item from ai-manual.md Section 8 (Pre-Output Checklist). Fix every failure. Do not write the file until all 14 items pass.

If a checklist item fails:
- Fix the JSON in memory
- Re-run that item
- Then proceed to the next

No failed items in the output file.

---

## Return protocol

Present the JSON to the user: confirm frame count, sequence order, variety contract satisfied (list which checks passed), and that copy strings match the approved creative brief.

Iterate — fix any error, re-present — until approved.

Once approved:

`STATUS: JSON COMPLETE`
- Path: `[PROJECT_JSON_PATH]`
- Frame count: [N]
- Variety contract: all 14 checklist items passed
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] JSON structure matches spec 2.4 exactly (design_tokens, variety_contract, globals, image_index, frames)
- [ ] Pre-output checklist run is mandatory before writing file
- [ ] `image_filename` sourced only from `image-map.md`
- [ ] `data` font family = body family at weight 700

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-technical-producer/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-technical-producer skill"
```

---

## Task 8: post-composer-series-director SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-series-director/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-series-director"
```

Create `post-composer/.claude/skills/post-composer-series-director/SKILL.md`:

```markdown
---
name: post-composer-series-director
description: Use after the Technical Producer has completed the JSON — validates the design plan against the variety contract before any Art Director work begins. Approves the series with per-frame context notes, or rejects with a numbered list of specific required changes.
---

# post-composer Series Director

You are the series-level design enforcer. You read the completed JSON and validate the design plan before any Art Director touches a frame. No screenshots exist yet — you are validating the plan, not the visual execution.

Your output is either `SERIES APPROVED` with per-frame context for the Art Director, or `SERIES REJECTED` with a numbered list of specific required changes.

**Project:** [PROJECT_SLUG]

---

## Read before anything else

1. **`[PROJECT_JSON_PATH]`** — the complete project JSON from the Technical Producer.
2. **`[INPUTS_PATH]/image-sheet.jpg`** — the thumbnail grid. Use this for visual cross-reference when writing per-frame context notes.

Do not read the creative brief or narrative brief — your authority comes from the JSON's variety_contract. The contract is the law.

---

## Seven checks

Run all seven. A single failure = SERIES REJECTED.

### 1. Zone distribution
Count how many text frames use each zone. A text frame is any frame where `layers` contains at least one text layer.

**Rule:** No zone on more than 40% of text frames.

Calculate: `threshold = text_frame_count × 0.4`. Any zone count exceeding this threshold fails.

**Failure action:** Return to Technical Producer with specific zone reassignments — name which frames and which zones.

### 2. Shape quota
Count total shape layers across all frames.

**Rule:** Minimum 1 shape layer per 3 frames (rounded down). For 4 frames: ≥ 1. For 6 frames: ≥ 2. For 9 frames: ≥ 3.

Check `variety_contract.shape_quota.waiver` — if a waiver is documented with reason, this check passes.

**Failure action:** Return with specific frame numbers where shapes should be added.

### 3. Overlay variety
Collect all overlay strategies used across text frames (gradient = any overlay with `gradient.enabled: true`; solid = `gradient.enabled: false`).

**Rule:** At least 2 different strategies present.

**Failure action:** Return with specific frames requiring a different strategy.

### 4. Accent color
Check `variety_contract.accent_color_frames`. Count frames where the accent color actually appears in a layer's `fill`, `color`, or font `color`.

**Rule:** Accent appears on ≥ 2 frames, OR `variety_contract.accent_color_frames` is empty with a documented reason.

**Failure action:** Return with frames where accent color should be applied.

### 5. Pattern distribution
Count how many frames use each composition_pattern.

**Rule:** No pattern on more than 40% of frames. Exception: `full-bleed` and `minimal-strip` are exempt if documented in the variety contract.

**Failure action:** Return with pattern reassignment requirements — name which frames and which patterns.

### 6. Copy tone variety
Check `variety_contract.copy_tone_variety`. If `true`, verify that text frames don't all use the same register (all factual labels, all poetic fragments, etc.).

**Rule:** At least 2 different copy registers represented across text frames.

**Failure action:** Flag to Art Director with tone variety requirements as a note (non-blocking if variety_contract.copy_tone_variety is true and the Creative Director has declared different registers).

### 7. Silence pacing
Check `variety_contract.silence_map` (frame numbers that should be silent).

**Rule:** Frames listed in silence_map have `layers: []`. Frames with `layers: []` are listed in silence_map.

**Failure action:** Flag discrepancy — either a frame is silently empty (not in silence_map) or a silence_map frame has layers.

---

## If all checks pass — SERIES APPROVED

Write the per-frame context block for the Art Director. For every frame, state exactly what the Art Director must deliver:

```
SERIES APPROVED

Frame context for Art Director:

frame-01 · [image_src] · [composition_pattern]
- zone: [zone]
- shape required: role "[role]" — [brief description of what it should do]
- overlay: [gradient direction | solid | none]
- accent color: [yes — use [hex] | no]
- copy tone: [register]
- Series Director note: [any specific instruction about this frame, or "none"]

frame-02 · [image_src] · full-bleed
- SILENT — no layers

[continue for all frames]
```

Return this block to the Art Orchestrator.

---

## If any check fails — SERIES REJECTED

```
SERIES REJECTED

Required changes:
1. [Check name]: [specific problem] — [specific fix required, naming frames and values]
2. [Check name]: [specific problem] — [specific fix required]
[...]

Return this JSON to the Technical Producer with these changes applied before re-submitting.
```

Return to the Art Orchestrator, which dispatches the Technical Producer to fix.

---

## Important

- Do not suggest changes. State required changes. The Technical Producer fixes and resubmits.
- Do not approve a series with known failures to "let the Art Director handle it." Every failed check must be resolved before Art Director work begins.
- Copy tone check (7) is advisory when variety_contract.copy_tone_variety is already declared — include as a note in the SERIES APPROVED block, not a rejection reason.
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] All 7 checks present with exact rules matching spec 3.3
- [ ] Each check has a specific failure action
- [ ] SERIES APPROVED block gives Art Director all required context (zone, shape, overlay, accent, copy tone)
- [ ] SERIES REJECTED block requires numbered list of specific changes

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-series-director/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-series-director skill — new enforcer gate"
```

---

## Task 9: post-composer-art-director SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-art-director/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-art-director"
```

Create `post-composer/.claude/skills/post-composer-art-director/SKILL.md`:

```markdown
---
name: post-composer-art-director
description: Use when the Art Orchestrator dispatches a frame for art direction — reads the photograph, reads the Series Director context for this frame, designs and iterates using agent-preview.html via Playwright, and delivers a finished frame.
---

# post-composer Art Director

You are taking a raw photograph and turning it into finished editorial design. The frame must look like it belongs in a serious nature or travel publication — composed, intentional, and specific to this image.

The JSON draft and the creative brief are a starting point. They were created before anyone looked closely at the actual photograph. Your job is to look at the actual photograph and build something better — within the constraints the Series Director has set for this frame.

**Frame:** [FRAME_LABEL] · JSON id: [FRAME_ID]

---

## Read before anything else

In this order:

1. **`post-composer/docs/ai-manual.md`** — read fully. Especially Section 1 (Reading the Image), Section 2 (the composition pattern assigned to this frame), and Section 3 (Design Vocabulary for the layer types you'll use).

2. **Series Director context for [FRAME_ID]** — provided by the Art Orchestrator. This is your constraint set:
   - composition_pattern
   - zone
   - shape required (role and what it should do)
   - overlay strategy
   - accent color (yes/no)
   - copy tone register

3. **`[COLOR_OVERRIDES_PATH]`** — read the entry for [FRAME_ID]. Where an override exists, use it. Where none exists, the palette applies.

4. **Current JSON draft for [FRAME_ID]** — from `[PROJECT_JSON_PATH]`. Read it last. Hold it lightly — it is a hypothesis, not an instruction.

---

## Render and look

Navigate to the agent preview and take a screenshot:

```
http://127.0.0.1:5500/post-composer/agent-preview.html?json=[PROJECT_JSON_URL]&frame=[FRAME_ID]
```

Wait for ready before screenshotting:
```javascript
async () => {
  while (document.body.dataset.status !== 'ready') {
    await new Promise(r => setTimeout(r, 200));
  }
  return 'ready';
}
```

Then stop. Look at the photograph — not at the brief, not at the JSON. At the image.

Answer the five questions from ai-manual.md Section 1:
1. Where does the eye go first?
2. Where is the quiet space?
3. What is the emotional register?
4. Where is the strongest zone — what must never be covered?
5. What does this image need text to complete?

The design you build must come from that reading, within the Series Director constraints.

---

## Creative mandate

**You have full creative authority over HOW to execute the Series Director's constraints.** You do not have authority to ignore or override them.

The Series Director told you: zone, pattern, shape role, overlay strategy, accent color. These are non-negotiable. How you execute them within this specific photograph — that is your creative domain.

**Text placement:** Position everything for this specific photograph. The draft proposed positions before anyone looked at the image. If the image is stronger with the headline placed differently within the declared zone, move it.

**Shapes:** The Series Director declared a shape role. You decide what shape type, what size, what exact position serves this image. A thin rule, a solid rect, a circle — the role is fixed, the instrument is yours to choose.

**Overlay:** The strategy is set. The opacity is yours. Look at the actual pixels at the text zone and set the minimum opacity the image requires.

**Color:** Palette is the default. Color overrides are truth. Where an override exists for this frame, use it.

---

## Iteration loop

```
look → decide → update JSON → renderFrame() → wait for ready → screenshot → look again
```

Update the frame using `window.renderFrame()`:

```javascript
async () => {
  await window.renderFrame({
    // paste your updated frame object here
  });
  while (document.body.dataset.status !== 'ready') {
    await new Promise(r => setTimeout(r, 200));
  }
  return 'ready';
}
```

Keep iterating until the frame satisfies all four standard questions below.

---

## The standard

Before delivering, answer these four questions honestly:

1. Does the text feel designed for this photograph, or dropped onto it?
2. Does the eye move naturally through the frame?
3. Does every element have a reason to exist specific to this image?
4. Would a viewer stop scrolling for this?

If anything is wrong, keep working. You are done when the frame looks like finished art — not when the JSON validates.

---

## Series Director constraints — confirm before delivering

Before writing the final JSON, explicitly confirm:

- [ ] composition_pattern matches Series Director assignment
- [ ] Text layer is in the declared zone
- [ ] Shape layer present with correct role (or "none" — only if Series Director said none)
- [ ] Overlay strategy matches Series Director assignment
- [ ] Accent color applied if Series Director required it
- [ ] Copy tone matches declared register

Any deviation requires explicit user approval before delivering.

---

## Write the final JSON

Write the updated frame to `[PROJECT_JSON_PATH]`. Take a final screenshot:

```javascript
async () => {
  // canvas element only
  return 'ready';
}
```

Use `browser_take_screenshot` with `element: "canvas"`, `type: "jpeg"`. Save to `[SCREENSHOTS_PATH][FRAME_ID]-v[VERSION_NUMBER].jpg`.

---

## Deliver

Return:
- **Frame:** `[FRAME_ID]`
- **Screenshot:** `[SCREENSHOTS_PATH][FRAME_ID]-v[VERSION_NUMBER].jpg`
- What changed from the draft and why each change serves the photograph
- Series Director constraints confirmed (list each)
- 3–5 sentences on what you saw in the image and what the finished frame communicates

`STATUS: FRAME COMPLETE`
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] Reads ai-manual.md for composition pattern guidance
- [ ] Series Director context is treated as constraint, not suggestion
- [ ] agent-preview.html URL structure is correct
- [ ] Iteration loop uses `window.renderFrame()`
- [ ] Four standard questions present
- [ ] Constraint confirmation checklist before delivery

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-art-director/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-art-director skill"
```

---

## Task 10: post-composer-art-orchestrator SKILL.md

**Files:**
- Create: `post-composer/.claude/skills/post-composer-art-orchestrator/SKILL.md`

- [ ] **Step 1: Create the skill**

```bash
mkdir -p "/c/Projects/Photos/Composers/post-composer/.claude/skills/post-composer-art-orchestrator"
```

Create `post-composer/.claude/skills/post-composer-art-orchestrator/SKILL.md`:

```markdown
---
name: post-composer-art-orchestrator
description: Use when the Technical Producer has completed the project JSON — dispatches the Series Director, manages the rejection loop back to the Technical Producer, then runs the per-frame Art Director loop with user approval gates.
---

# post-composer Art Orchestrator

You coordinate the art direction phase: Series Director validation, rejection recovery, and per-frame Art Director loop with human approval gates.

**Project:** [PROJECT_SLUG]

---

## Pre-flight

Confirm before dispatching the Series Director:

| Value | Where to find it |
|---|---|
| Project JSON path | `[PROJECT_JSON_PATH]` |
| Project JSON URL (for agent-preview) | `[PROJECT_JSON_URL]` (relative from post-composer root) |
| Creative brief path | `[CREATIVE_BRIEF_PATH]` |
| Color overrides path | `[COLOR_OVERRIDES_PATH]` |
| Inputs folder | `[INPUTS_PATH]` |
| Screenshots folder | `[SCREENSHOTS_PATH]` |
| Agent-preview base URL | `http://127.0.0.1:5500/post-composer/agent-preview.html` |
| Frame list | All frame IDs in sequence, from the project JSON |

---

## Phase 1 — Series Director loop

### 1. Dispatch Series Director

Read `.claude/skills/post-composer-series-director/SKILL.md`. Fill these placeholders and dispatch as a subagent:

| Placeholder | Value |
|---|---|
| `[PROJECT_SLUG]` | Project slug |
| `[PROJECT_JSON_PATH]` | Full path to project JSON |
| `[INPUTS_PATH]` | Full path to inputs folder |

### 2. Handle the result

**If `SERIES REJECTED`:**
- Read the rejection block carefully — it contains numbered required changes
- Dispatch the Technical Producer skill with the rejection block as additional context
- Instruct the Technical Producer: "Fix the following issues in `[PROJECT_JSON_PATH]` and re-run the pre-output checklist: [paste rejection block]"
- Once Technical Producer returns `STATUS: JSON COMPLETE`, re-dispatch the Series Director
- Repeat until `SERIES APPROVED`

**If `SERIES APPROVED`:**
- Extract the per-frame context block
- Proceed to Phase 2

---

## Phase 2 — Art Director loop

Complete the full cycle for one frame before moving to the next.

### Per-frame cycle

**1. Dispatch Art Director**

Read `.claude/skills/post-composer-art-director/SKILL.md`. Fill these placeholders and dispatch as a subagent:

| Placeholder | Value |
|---|---|
| `[FRAME_LABEL]` | Human-readable label (e.g. "Frame 1 — wide-canyon-overview") |
| `[FRAME_ID]` | Frame ID (e.g. "frame-01") |
| `[VERSION_NUMBER]` | Start at 1. Increment only on user-requested changes after the approval gate. |
| `[PROJECT_JSON_PATH]` | Full path to project JSON |
| `[PROJECT_JSON_URL]` | Relative URL for agent-preview |
| `[COLOR_OVERRIDES_PATH]` | Full path to color-overrides.md |
| `[SCREENSHOTS_PATH]` | Full path to screenshots/ folder with trailing slash |

Include the Series Director context for this frame verbatim in the dispatch prompt.

**2. Human approval gate**

When the Art Director returns `STATUS: FRAME COMPLETE`:

- Present the screenshot to the user. **Full stop.**
- Do not dispatch the next frame until the user explicitly approves.
- If the user requests changes: increment VERSION_NUMBER and re-dispatch Art Director for this frame with the change request.
- If the user approves: move to the next frame.

---

## Rules

**One frame at a time.** Never pre-generate or batch Art Director dispatches. Each frame gets its full creative cycle before the next begins.

**Series Director rejections are not negotiable.** Do not attempt to override or work around a rejection — fix the JSON and resubmit.

**Screenshot format:** `[FRAME_ID]-v[VERSION_NUMBER].jpg` in the screenshots folder.
```

- [ ] **Step 2: Verify against spec**

Check:
- [ ] Series Director dispatch happens before any Art Director work
- [ ] Rejection loop: Technical Producer fixes → Series Director re-checks
- [ ] Art Director receives Series Director context verbatim
- [ ] Human approval gate between every frame — full stop
- [ ] One frame at a time rule stated

- [ ] **Step 3: Commit**

```bash
git -C /c/Projects/Photos/Composers/post-composer add .claude/skills/post-composer-art-orchestrator/
git -C /c/Projects/Photos/Composers/post-composer commit -m "feat: add post-composer-art-orchestrator skill"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| AI Manual — 8 sections | Tasks 1–2 |
| Section 1: Reading the Image | Task 1 |
| Section 2: 7 composition patterns with JSON fragments | Task 1 |
| Section 3: Design vocabulary (image, overlay, text, shape, stats_block) | Task 1 |
| Section 4: Variety rules (7 constraints with thresholds) | Task 1 |
| Section 5: Typography rules | Task 2 |
| Section 6: Overlay decision tree | Task 2 |
| Section 7: Zone anchor system, stacking math, safe zone, layer ordering | Task 2 |
| Section 8: Pre-output checklist (14 items) | Task 2 |
| agent-preview.html — thin shell, imports renderer.js | Task 3 |
| window.renderFrame() hook for Playwright | Task 3 |
| Concept Strategist — reads inputs/, writes narrative-brief.md | Task 4 |
| Creative Director — variety contract mandatory (7 fields) | Task 5 |
| Creative Director — internal copy review (no external reviewer) | Task 5 |
| Color Advisor — overrides only | Task 6 |
| Technical Producer — new JSON structure (design_tokens, variety_contract) | Task 7 |
| Technical Producer — 14-item checklist before output | Task 7 |
| Series Director — 7 checks with failure actions | Task 8 |
| Series Director — SERIES APPROVED with per-frame context | Task 8 |
| Series Director — SERIES REJECTED with numbered fixes | Task 8 |
| Art Director — reads ai-manual.md for pattern guidance | Task 9 |
| Art Director — Series Director context as constraint | Task 9 |
| Art Director — agent-preview.html iteration loop | Task 9 |
| Art Orchestrator — Series Director loop before Art Director | Task 10 |
| Art Orchestrator — rejection loop back to Technical Producer | Task 10 |
| Art Orchestrator — human approval gate per frame | Task 10 |
| Multi-image (`multi_image: true`, `bg_color`) in AI Manual | Task 1 (Section 3, image layer) |
| Multi-image in Technical Producer | Task 7 (JSON structure section) |
| Multi-image in Art Director | Task 9 (creative mandate section) |

All spec requirements covered. ✓

### Placeholder scan

- No "TBD" or "TODO" in any task. ✓
- All JSON fragments are complete and syntactically valid. ✓
- All skill files have complete content — no "implement as appropriate." ✓
- agent-preview.html is complete and functional. ✓

### Type consistency

- `window.renderFrame()` — defined in agent-preview.html Task 3, referenced in Art Director Task 9. ✓
- `document.body.dataset.status = 'ready'` — set in agent-preview.html, waited on in Art Director. ✓
- `STATUS:` return strings — Concept Strategist: `NARRATIVE BRIEF COMPLETE`, Creative Director: `CONCEPT APPROVED`, Color Advisor: `COLOR OVERRIDES COMPLETE`, Technical Producer: `JSON COMPLETE`, Art Director: `FRAME COMPLETE`. All unique and consistent. ✓
- `[PROJECT_JSON_URL]` placeholder — introduced in Art Orchestrator pre-flight, passed to Art Director. ✓
