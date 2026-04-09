# Color Wheel Algorithm Redesign

**Date:** 2026-04-09
**Status:** Approved
**Scope:** `editor/color-wheel-analysis.js`, `ui/color-wheel-panel.js`

---

## Problem

The existing color harmony scoring algorithm produces inflated results — including 100% scores for visually poor combinations. Three compounding bugs cause this:

1. **Sector half-widths (±30°) are too wide.** Complementary covers 120° of the 360° wheel. With 360-rotation optimization, any image with loosely-grouped colors scores near 100%.
2. **No penalty for out-of-harmony colors.** Score = `inHarmony / totalChromatic` only rewards good pixels; it never penalizes bad ones.
3. **HSL hue is not perceptually uniform.** Equal angular distances in HSL do not correspond to equal perceptual differences, producing misleading sector fits.
4. **Neutral exclusion inflates landscape scores.** Landscape photos (mostly desaturated) are scored only on their small chromatic fraction, which trivially lands inside wide sectors.

---

## Goal

A professional-grade color harmony tool where:
- 100% is achievable only with intentional, precise color choices
- The score reflects the entire canvas (photos + background)
- Plain-language insights explain what is happening and why
- No color theory expertise required to interpret results

---

## Section 1: Color Analysis Pipeline (OKLCH)

Replace the HSL extraction pipeline with OKLCH throughout.

**Conversion chain:** sRGB → linear RGB → XYZ → OKLAB → OKLCH

**Neutral filter:** `C < 0.04` (OKLCH chroma) — replaces HSL `s < 10`. More accurate perceptual neutrality, especially for desaturated blues and grays common in landscape photography.

**K-means clustering:** Same k=8 default. Distance metric updated to use perceptual chroma-weighted hue distance in OKLCH space.

**Output per cluster:**
```js
{
  hex: '#rrggbb',
  oklch: { L, C, h },   // L: 0-1, C: 0-0.4, h: 0-360
  canvasPct: number,     // % of sampled pixels
  isNeutral: boolean     // C < 0.04
}
```

**Hue histogram:** 360 bins, populated from OKLCH `h` values. Because OKLCH hue is perceptually uniform, ±15° means the same perceptual distance everywhere on the wheel.

**No changes to `analysis.js`** — luminance, contrast, and weight algorithms are correct and unrelated.

---

## Section 2: Harmony Scoring (Strict + Penalty)

### Sector Half-Widths

| Harmony Type | Old Half-Width | New Half-Width | Total Coverage |
|---|---|---|---|
| Complementary | ±30° | ±15° | 60° (2 sectors) |
| Split-comp | ±30° | ±18° | 108° (3 sectors) |
| Analogous | ±45° | ±30° | 60° (1 sector) |
| Triad | ±30° | ±15° | 90° (3 sectors) |
| Double | ±30° | ±12° | 96° (4 sectors) |
| Square | ±30° | ±12° | 96° (4 sectors) |

### Scoring Formula

```
raw   = (inHarmony − 0.6 × outOfHarmony) / totalChromatic
score = max(0, round(raw × 100))
```

- Colors inside sectors add to the score (weighted by `canvasPct`)
- Colors outside sectors subtract at 60% weight
- Score floors at 0 — no negative display
- 100% requires virtually all chromatic pixels to sit inside tight sectors

The rotation optimizer (best of 360°) is retained, but tight sectors + penalty means a lucky rotation no longer inflates the score artificially.

---

## Section 3: Insights Engine

Generates 2–4 plain-language notes rendered below the color wheel. No color theory jargon.

### Insight 1 — Dominant Offender (always shown)
The single chromatic element with the highest `canvasPct` that falls outside the best harmony sectors.

> *"Your green background (38% of canvas) is the main source of conflict — it sits 94° away from the nearest harmony sector."*

Its dot on the wheel receives a pulsing red ring.

### Insight 2 — Harmony Identification (always shown)
Names the best-fit harmony type and characterizes the chromatic content.

> *"Best match: Complementary at 67%. Your photos lean warm (orange/gold), but the composition lacks a strong cool counterpart to complete the pair."*

### Insight 3 — Neutral Balance (conditional)
Shown when `neutralPct > 70%` or mean chroma `> 0.18`.

> *"82% of your canvas is neutral. Harmony is being scored on a small chromatic sample — results are approximate."*
> *"Very high chroma overall — strong colors are competing across the canvas."*

### Insight 4 — Actionable Suggestion (always shown)
One concrete recommendation. Never more than one.

> *"Try a dark neutral background (#1a1a1a or #2d2d2d) to let the warm tones in your photos lead the composition."*
> *"The blue-gray mountains in the lower photo are your strongest anchor — build the palette around that cool tone."*

**Rules:**
- Max 2 sentences per insight
- Plain language only
- Insight 4 never repeats Insight 1 — different angle

---

## Section 4: UI Changes

Only `color-wheel-panel.js` changes. The wheel geometry, hue ring, color dots, and affecting overlay are unchanged.

### Score Color Thresholds (updated)

| Score | Color | Label |
|---|---|---|
| ≥ 80% | Green `#4ade80` | Strong harmony |
| ≥ 55% | Yellow `#facc15` | Partial harmony |
| ≥ 30% | Orange `#fb923c` | Weak harmony |
| < 30% | Red `#f87171` | Poor harmony |

### Sector Arc Style
Sector arcs render with a dashed stroke when the best score is below 55%, signaling a weak fit even at best rotation.

### Insights Panel
Rendered directly below the wheel — no modal, no tabs.
- Thin separator line above
- Each insight: small-font label (muted) + normal-weight text
- Dominant offender's dot on the wheel gets a pulsing red ring

---

## Section 5: Error Handling & Edge Cases

| Condition | Behavior |
|---|---|
| `totalChromatic = 0` (all-neutral canvas) | Score shows `—`, insight: *"No significant color found. Add color to get harmony results."* |
| Single chromatic cluster | Score shown, insight flags trivial analogous win: *"Only one distinct color detected — add more elements for meaningful results."* |
| `chromaticPct < 5%` | Score prefixed with `~` (e.g., `~72%`), Insight 3 always shown |
| Invalid OKLCH hue (`C ≈ 0`) | Treat as neutral — same handling as `isNeutral: true` |

---

## Files Changed

| File | Change |
|---|---|
| `editor/color-wheel-analysis.js` | Full rewrite: OKLCH pipeline, new sector widths, penalty scoring, insights generation |
| `ui/color-wheel-panel.js` | Score threshold colors, dashed arcs below 55%, insights panel render |
| `tests/editor/color-wheel-analysis.test.js` | Update tests for new scoring formula, OKLCH output shape, insights output |

---

## Out of Scope

- `editor/analysis.js` — no changes (luminance/contrast/weight unaffected)
- `ui/color-picker.js` — no changes
- `manager/constants.js` — no changes
- Canvas background color selection UI — separate feature
