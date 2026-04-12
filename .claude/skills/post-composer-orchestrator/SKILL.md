---
name: post-composer-orchestrator
description: Use to start a new post-composer project — dispatches the full 5-step pipeline (Concept Strategist → Creative Director → Color Advisor → Technical Producer → Art Orchestrator) with approval gates between every step.
---

# post-composer Orchestrator

This skill dispatches the complete post-composer AI pipeline for a photography series. Each step has one role, declared inputs, and a formal deliverable. The orchestrator holds all approval gates — roles execute and return; the human approves before the next step begins.

**Project slug:** [PROJECT_SLUG]
**Project root:** `post-composer/projects/[PROJECT_SLUG]/`

---

## Execution mode — identify before starting

| Mode | Steps |
|------|-------|
| **Claude Code + Playwright MCP** | Full pipeline — Steps 1–5. Art direction uses `agent-preview.html` with Playwright. |
| **Claude Code (no Playwright)** | Steps 1–4 only. For Step 5: tell the user to open `agent-preview.html` manually, share screenshots, and iterate in chat. |

---

## Prerequisites — confirm before Step 1

| File | Location | Required |
|------|----------|---------|
| `project-brief.txt` | `post-composer/projects/[PROJECT_SLUG]/inputs/` | Yes — photographer's intent, tone, platform |
| `image-map.md` | `post-composer/projects/[PROJECT_SLUG]/inputs/` | Yes — authoritative frame sequence and filenames |
| `image-sheet.jpg` | `post-composer/projects/[PROJECT_SLUG]/inputs/` | Yes — thumbnail grid for all AI image reading |
| Raw photos | `post-composer/projects/[PROJECT_SLUG]/images/` | Playwright only — never sent to AI |

The `inputs/` folder is produced by the Project Manager app (**Export Package**). If any of the three required files is missing, stop and ask the user to export the package before continuing.

---

## Directory layout

```
post-composer/projects/[PROJECT_SLUG]/
├── inputs/                   ← Project Manager export — AI never writes here
│   ├── project-brief.txt
│   ├── image-map.md
│   └── image-sheet.jpg
│
├── images/                   ← Raw photos — Playwright only
│
├── shared/                   ← AI-produced, one owner per file
│   ├── narrative-brief.md    ← Step 1: Concept Strategist
│   ├── creative-brief.md     ← Step 2: Creative Director (includes variety contract)
│   └── color-overrides.md   ← Step 3: Color Advisor (overrides only)
│
├── [PROJECT_SLUG].json       ← Step 4: Technical Producer
└── screenshots/              ← Step 5: Art Director (per-frame, per-version)
    ├── frame-01-v1.jpg
    └── ...
```

Create `post-composer/projects/[PROJECT_SLUG]/shared/` and `post-composer/projects/[PROJECT_SLUG]/screenshots/` if they don't exist before dispatching Step 1.

---

## Step 1 — Concept Strategist

> Reads the inputs package produced by the Project Manager app and writes `narrative-brief.md`. Does not interview the user about image selection — the brief and arrangement are already decided.

**Reads:** `inputs/project-brief.txt`, `inputs/image-map.md`, `inputs/image-sheet.jpg`
**Writes:** `shared/narrative-brief.md`

Dispatch `post-composer-concept-strategist` with:

| Placeholder | Value |
|-------------|-------|
| `[PROJECT_SLUG]` | `[PROJECT_SLUG]` |
| `[INPUTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/inputs/` |
| `[NARRATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/narrative-brief.md` |

**Approval gate:** The Concept Strategist will present its output and ask for explicit approval. Do not dispatch Step 2 until the user has given explicit approval (a clear "approved", "yes, proceed", or equivalent). Positive feedback about a specific element is NOT approval. If the user requests changes, re-dispatch the Concept Strategist with the specific revision request.

---

## Step 2 — Creative Director

> Develops the full editorial concept: design tokens, variety contract (7 fields), per-frame briefs with internally reviewed copy, and saves `creative-brief.md`.

**Reads:** `shared/narrative-brief.md`, `inputs/image-sheet.jpg`, `post-composer/docs/ai-manual.md` (Sections 2 and 4)
**Writes:** `shared/creative-brief.md`

Dispatch `post-composer-creative-director` with:

| Placeholder | Value |
|-------------|-------|
| `[PROJECT_SLUG]` | `[PROJECT_SLUG]` |
| `[NARRATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/narrative-brief.md` |
| `[INPUTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/inputs/` |
| `[CREATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/creative-brief.md` |

**Approval gate:** The Creative Director will present its output and ask for explicit approval. Do not dispatch Step 3 until the user has given explicit approval (a clear "approved", "yes, proceed", or equivalent). Positive feedback about a specific element is NOT approval. Iterate until the user explicitly approves the full concept.

---

## Step 3 — Color Advisor

> Reads each frame's text zone in the thumbnail grid and writes `color-overrides.md` — only frames where the palette color fails. Silent frames and safe frames produce no entry.

**Reads:** `shared/creative-brief.md`, `inputs/image-sheet.jpg`
**Writes:** `shared/color-overrides.md`

Dispatch `post-composer-color-advisor` with:

| Placeholder | Value |
|-------------|-------|
| `[PROJECT_SLUG]` | `[PROJECT_SLUG]` |
| `[CREATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/creative-brief.md` |
| `[INPUTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/inputs/` |
| `[COLOR_OVERRIDES_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/color-overrides.md` |

**Approval gate:** The Color Advisor will present its output and ask for explicit approval. Do not dispatch Step 4 until the user has given explicit approval. This gate is typically brief — but the user must still confirm before the pipeline continues.

---

## Step 4 — Technical Producer

> Generates the complete project JSON. Reads the AI manual fully, applies color overrides, and runs the full pre-output checklist before writing the file.

**Reads:** `post-composer/docs/ai-manual.md`, `shared/creative-brief.md`, `shared/color-overrides.md`, `inputs/image-map.md`
**Writes:** `[PROJECT_SLUG]/[PROJECT_SLUG].json`

Dispatch `post-composer-technical-producer` with:

| Placeholder | Value |
|-------------|-------|
| `[PROJECT_SLUG]` | `[PROJECT_SLUG]` |
| `[CREATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/creative-brief.md` |
| `[COLOR_OVERRIDES_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/color-overrides.md` |
| `[INPUTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/inputs/` |
| `[PROJECT_JSON_PATH]` | `post-composer/projects/[PROJECT_SLUG]/[PROJECT_SLUG].json` |

**Approval gate:** The Technical Producer will present its output and ask for explicit approval. Do not dispatch Step 5 until the user has given explicit approval. Spot-check: frame count, sequence matches the approved narrative brief, variety contract fields present, every `image_filename` sourced from `image-map.md`.

---

## Step 5 — Art Orchestrator

> Dispatches the Series Director (validates variety contract), manages rejection loops back to the Technical Producer, then runs the per-frame Art Director loop with human approval gates.

**Reads:** `[PROJECT_SLUG]/[PROJECT_SLUG].json`, `inputs/image-sheet.jpg`, `shared/color-overrides.md`
**Writes:** `screenshots/frame-NN-vN.jpg` per frame

Dispatch `post-composer-art-orchestrator` with:

| Placeholder | Value |
|-------------|-------|
| `[PROJECT_SLUG]` | `[PROJECT_SLUG]` |
| `[PROJECT_JSON_PATH]` | `post-composer/projects/[PROJECT_SLUG]/[PROJECT_SLUG].json` |
| `[PROJECT_JSON_URL]` | `projects/[PROJECT_SLUG]/[PROJECT_SLUG].json` |
| `[CREATIVE_BRIEF_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/creative-brief.md` |
| `[COLOR_OVERRIDES_PATH]` | `post-composer/projects/[PROJECT_SLUG]/shared/color-overrides.md` |
| `[INPUTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/inputs/` |
| `[SCREENSHOTS_PATH]` | `post-composer/projects/[PROJECT_SLUG]/screenshots/` |

The Art Orchestrator runs the Series Director first. If the Series Director rejects the JSON, it loops back to the Technical Producer for fixes before any Art Director work begins. Once approved, Art Director dispatches happen one frame at a time — each frame gets a human approval gate before the next begins.

**agent-preview URL:** `http://127.0.0.1:5500/post-composer/agent-preview.html`

---

## Final review gate

Once all frames have a clean approved version:

- Present all final screenshots to the user
- Note what changed from v1 → vN on any iterated frames
- Ask: **"All frames approved — ready to commit?"**

Do not commit until the user approves.
