# Creative Brief — Santander

**Language:** Spanish

## Design Tokens

| Token | Hex | Role |
|-------|-----|------|
| `background` | `#1C1410` | Deep warm brown-black — earthy shadow tone of colonial stone |
| `primary` | `#E8DDD0` | Warm cream — main text and graphic color; references whitewashed colonial walls |
| `accent` | `#C4562A` | Terracotta/rust — punctuation color; references ochre stone walls and clay rooftiles |
| `neutral` | `#8C7B6E` | Muted warm grey — secondary text, supporting elements |

**Display face:** `Cormorant Garamond`
**Body/Data face:** `Inter`

---

## Confirmed Facts (updated)

- Frame-01: canyon is the Cañón del Chicamocha — approximately 2.000 m deep at its deepest point
- Frame-02: Girón, Santander — founded 1631
- Frame-10: waterfalls are Cascadas de La Lajita, Zapatoca
- Frame-12: parrot was photographed on the Camino Ancestral (Barichara–Guane), a pre-Columbian stone path approximately 1.000 years old, built by the Guane people

---

## Variety Contract

### Zone map (10 text frames — 40% max per zone = 4 frames)
| Zone | Frames | Count |
|------|--------|-------|
| bottom-center | 01, 14 | 2 (20%) |
| bottom-left | 02, 06, 10 | 3 (30%) |
| top-right | 03 | 1 (10%) |
| bottom-right | 04, 07, 13 | 3 (30%) |
| top-left | 12 | 1 (10%) |

### Silence map
- **frame-05** — church doorway silhouette: cinematically complete; any element competes with perfect light/figure/arch balance
- **frame-08** — market man portrait: face is the whole frame; name/location unconfirmed
- **frame-09** — walking man: image is complete; subject anonymous, location unconfirmed
- **frame-11** — B&W waterfall: designated full pause; B&W treatment signals silence

### Composition patterns
| Frame | Pattern |
|-------|---------|
| frame-01 | layered-depth |
| frame-02 | editorial-anchor |
| frame-03 | minimal-strip |
| frame-04 | minimal-strip |
| frame-05 | full-bleed |
| frame-06 | diagonal-tension |
| frame-07 | minimal-strip |
| frame-08 | full-bleed |
| frame-09 | full-bleed |
| frame-10 | editorial-anchor |
| frame-11 | full-bleed |
| frame-12 | data-callout |
| frame-13 | minimal-strip |
| frame-14 | centered-monument |

Distribution: editorial-anchor 2 (14%), minimal-strip 4 (29%), full-bleed 4 (29%), layered-depth 1 (7%), diagonal-tension 1 (7%), data-callout 1 (7%), centered-monument 1 (7%). No pattern exceeds 40%. ✓

### Shape plan
| Frame | Shape | Role | Description |
|-------|-------|------|-------------|
| frame-01 | rect | divider | Thin horizontal rule above eyebrow text at bottom-center |
| frame-02 | rect | anchor | Thin rule above eyebrow, accent color |
| frame-06 | line | accent | Diagonal line at ~20° echoing rock formation angle, accent color |
| frame-10 | rect | anchor | Thin horizontal rule above eyebrow, accent color |
| frame-14 | line | divider | Thin centered rule above caption, accent color |

5 shapes across 14 frames (minimum 4 required). ✓

### Overlay strategies
- **gradient:** frames 01 (to-top), 03 (to-bottom), 06 (to-top), 12 (solid — flat surface needed for large number), 13 (to-top), 14 (to-top)
- **solid-bar:** frames 02, 04, 07, 10, 12

Both strategies present. ✓

### Accent color frames
frames 02, 06, 10, 14 — 4 frames (minimum 2 required). ✓

### Copy tone rhythm
- **geographic-anchor:** frame-01 — series title + geological stat
- **factual-label:** frames 02, 03, 06, 10 — location, time, confirmed facts
- **editorial-statement:** frames 04, 07 — observational
- **historical-stat:** frame-12 — pre-Columbian path age
- **directional-transition:** frame-13 — signals pastoral close
- **cultural-observation:** frame-13 — specific pattern visible across Santander towns
- **journey-close:** frame-14 — directly references the preceding frame, closes the arc

---

## Per-Frame Briefs

### frame-01 · cc2a3282 + cc2a2823 *(multi-image — canyon + cloudscape)*
- **pattern:** layered-depth
- **compositing strategy:** split-panel — canyon (cc2a3282) top panel, cloudscape (cc2a2823) bottom panel, stacked vertically. Equal editorial weight — together they declare the scale and atmosphere of Santander.
- **bg_color:** `#1C1410` (palette.background — visible in margins and gap between panels)
- **border treatment:** `border.enabled: true`, `border.color: #E8DDD0` — frames each panel as a discrete image against the dark background
- **zone:** bottom-center (series title) + top-right (canyon stat)
- **overlay:** none — both text zones land in bg_color margin areas; dark `#1C1410` provides backing without any overlay
- **text zone placement:**
  - bottom-center eyebrow + shape: lower bg_color margin, below cloudscape panel — on `#1C1410`, safe for all palette colors
  - top-right stat: upper bg_color margin, above canyon panel — on `#1C1410`, safe for all palette colors
- **shape:** rect / divider — thin horizontal rule above eyebrow text, accent color `#C4562A`
- **accent:** yes
- **eyebrow:** `"SANTANDER · COLOMBIA"` *(bottom-center, lower margin)*
- **stat value:** `"2.000 m"` *(top-right, data role — upper margin)*
- **stat label:** `"profundidad del Cañón del Chicamocha"` *(below stat value, top-right upper margin)*

---

### frame-02 · cc2a2767 (Girón white church)
- **pattern:** editorial-anchor
- **zone:** bottom-left
- **overlay:** solid-bar — church base is brilliant white colonial plaster; solid required
- **shape:** rect / anchor — thin rule above eyebrow, accent color `#C4562A`
- **accent:** yes
- **eyebrow:** `"GIRÓN, SANTANDER"`
- **headline:** `"Santander y sus iglesias."`
- **caption:** `"Fundada en 1631."`

---

### frame-03 · dji-fly-20260403-060238 (aerial church at dawn)
- **pattern:** minimal-strip
- **zone:** top-right
- **overlay:** gradient to-bottom — dawn sky transitions from warm haze
- **shape:** none — minimal-strip
- **accent:** no
- **caption:** `"Amanecer sobre los altiplanos coloniales."`

---

### frame-04 · dji-fly-20260405-065102 (golden cathedral aerial)
- **pattern:** minimal-strip
- **zone:** bottom-right
- **overlay:** solid-bar — terracotta rooftiles and walls are textured
- **shape:** none — minimal-strip
- **accent:** no
- **caption:** `"Piedra y terracota — los pueblos altos de Santander."`

---

### frame-05 · cc2a3008 (church doorway silhouette)
- **pattern:** full-bleed
- **zone:** silent
- **overlay:** none
- **shape:** none
- **accent:** no
- **copy:** NONE — la imagen más cinematográfica de la serie. El equilibrio entre la oscuridad, el arco, la figura y el patio iluminado es completo. Cualquier texto compite con una composición ya perfecta.

---

### frame-06 · cc2a2769 (Renault 4 monument)
- **pattern:** diagonal-tension
- **zone:** bottom-left
- **overlay:** gradient to-top — lower-left has clean blue sky grading into rock base
- **shape:** line / accent — diagonal line at ~20°, echoing rock formation angle, accent color `#C4562A`
- **accent:** yes
- **eyebrow:** `"CAMINO A ZAPATOCA"`
- **caption:** `"Un monumento al carro más querido de Colombia."`

---

### frame-07 · cc2a3050 (colonial street + bougainvillea)
- **pattern:** minimal-strip
- **zone:** bottom-right
- **overlay:** solid-bar — lower wall is bright white colonial plaster
- **shape:** none — minimal-strip
- **accent:** no
- **caption:** `"Las calles coloniales de Santander."`

---

### frame-08 · cc2a3111 (market man portrait)
- **pattern:** full-bleed
- **zone:** silent
- **overlay:** none
- **shape:** none
- **accent:** no
- **copy:** NONE — el retrato es completo. La presencia del hombre, el cigarrillo, la mirada que pasa más allá de la cámara. Nombre y ubicación no confirmados.

---

### frame-09 · cc2a3136 (walking man, ochre wall)
- **pattern:** full-bleed
- **zone:** silent
- **overlay:** none
- **shape:** none
- **accent:** no
- **copy:** NONE — la imagen es completa. La pared ocre, el sombrero, el paso, las bolsas del día. Nada que añadir.

---

### frame-10 · cc2a2913 (multi-tiered waterfall)
- **pattern:** editorial-anchor
- **zone:** bottom-left
- **overlay:** solid-bar — waterfall base has turbulent white water and wet rocks
- **shape:** rect / anchor — thin horizontal rule above eyebrow, accent color `#C4562A`
- **accent:** yes
- **eyebrow:** `"CASCADAS DE LA LAJITA"`
- **caption:** `"Zapatoca, Santander."`

---

### frame-11 · cc2a2954 (B&W waterfall abstraction)
- **pattern:** full-bleed
- **zone:** silent
- **overlay:** none
- **shape:** none
- **accent:** no
- **copy:** NONE — la pausa completa. El tratamiento en blanco y negro despoja la imagen a textura pura y sonido. Silencio absoluto.

---

### frame-12 · cc2a3220 (parrot portrait — Camino Ancestral)
- **pattern:** data-callout
- **zone:** top-left
- **overlay:** solid-bar — upper-left bokeh background needs flat surface for large number legibility
- **shape:** none — the large number is the compositional hero
- **accent:** no
- **stat value:** `"1.000"` *(large, data role, top-left — hero of the frame)*
- **stat label:** `"años tiene el Camino Ancestral"`
- **caption:** `"Barichara–Guane, Santander."`

---

### frame-13 · img-2851 (traditional house, flowers on wall, church tower, cobblestone street)
- **pattern:** minimal-strip
- **zone:** bottom-right
- **overlay:** gradient to-top — warm afternoon cobblestone; gentle fade anchors text
- **shape:** none — minimal-strip
- **accent:** no
- **caption:** `"Flores en la fachada, adoquines en la calle."`
- **copy rationale:** The flowers on exterior walls and cobblestone streets are a defining cultural feature of these Santander towns — present on nearly every house and street. Text names the observation the viewer is already seeing but may not register as a pattern.

---

### frame-14 · img-2914 (donkey in campo)
- **pattern:** centered-monument
- **zone:** bottom-center
- **overlay:** gradient to-top — campo grass at base; fades from bottom
- **shape:** line / divider — thin centered rule above caption, accent color `#C4562A`
- **accent:** yes
- **caption:** `"Donde terminan los adoquines, empieza esto."`
- **copy rationale:** Directly connects to frame-13 (cobblestones). The towns are behind us; the open land is what remains. Specific to this journey, not a universal closing statement.
