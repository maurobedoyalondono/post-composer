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
