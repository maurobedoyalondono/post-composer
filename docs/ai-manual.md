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
