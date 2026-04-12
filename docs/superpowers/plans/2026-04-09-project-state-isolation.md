# Project State Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the editor retaining the previous project's state when a different project is opened from the manager.

**Architecture:** Add a `loadedBriefId` field to `AppState` to track which brief's project is currently in state. In `_applyActiveBrief()`, detect when `activeBriefId` differs from `loadedBriefId`, flush the old save, clear state, show a loading indicator, then load the new project.

**Tech Stack:** Vanilla JS ES modules, browser-based test runner (`tests/runner.html`), custom `tests/test-helper.js` with `describe`/`it`/`assert`/`assertEqual`.

**Spec:** `docs/superpowers/specs/2026-04-09-project-state-isolation-design.md`

---

## Files Changed

| File | Change |
|------|--------|
| `core/state.js` | Add `loadedBriefId = null`; reset to `null` in `setProject(null)` |
| `tests/core/state.test.js` | Add 3 tests covering `loadedBriefId` |
| `editor/shell.js` | Add switch-detection block at top of `_applyActiveBrief()`; set `loadedBriefId` after load |

---

## Task 1: Add `loadedBriefId` to `AppState`

**Files:**
- Modify: `tests/core/state.test.js`
- Modify: `core/state.js`

- [ ] **Step 1: Write the failing tests**

Open `tests/core/state.test.js`. After the last `it(...)` block (line 63), before the closing `});` of `describe`, add:

```js
  it('initialises loadedBriefId as null', () => {
    const s = new AppState();
    assert(s.loadedBriefId === null);
  });

  it('setProject(null) resets loadedBriefId to null', () => {
    const s = new AppState();
    s.loadedBriefId = 'brief-1';
    s.setProject(null);
    assert(s.loadedBriefId === null);
  });

  it('setProject(non-null) does not change loadedBriefId', () => {
    const s = new AppState();
    s.loadedBriefId = 'brief-1';
    s.setProject({ id: 'p', frames: [] });
    assertEqual(s.loadedBriefId, 'brief-1');
  });
```

- [ ] **Step 2: Open the test runner and verify the 3 new tests fail**

Open `tests/runner.html` in a browser. You should see 3 red failures:
- `✗ initialises loadedBriefId as null`
- `✗ setProject(null) resets loadedBriefId to null`
- `✗ setProject(non-null) does not change loadedBriefId`

All other existing tests should still be green.

- [ ] **Step 3: Implement `loadedBriefId` in `AppState`**

In `core/state.js`, make two edits:

**Edit 1** — add field to constructor (after `this.activeBriefId = null;` on line 14):

```js
    this.loadedBriefId    = null;       // brief id whose project is currently in state
```

**Edit 2** — reset it in `setProject()`. Replace the existing `setProject` method (lines 23–29):

```js
  /** @param {object|null} project */
  setProject(project) {
    this.project          = project;
    this.activeFrameIndex = 0;
    this.selectedLayerId  = null;
    if (project === null) {
      this.images.clear();
      this.loadedBriefId = null;
    }
  }
```

- [ ] **Step 4: Open the test runner and verify all tests pass**

Refresh `tests/runner.html`. All 3 new tests should now be green. No existing tests should have changed colour.

- [ ] **Step 5: Commit**

```bash
git add core/state.js tests/core/state.test.js
git commit -m "feat: add loadedBriefId to AppState for project switch detection"
```

---

## Task 2: Detect project switch in `_applyActiveBrief()` and reload

**Files:**
- Modify: `editor/shell.js`

- [ ] **Step 1: Add the switch-detection block to `_applyActiveBrief()`**

In `editor/shell.js`, locate `_applyActiveBrief()` (line 120). The function currently starts:

```js
  async function _applyActiveBrief() {
    if (!state.activeBriefId) return;
    const brief = storage.getBrief(state.activeBriefId);
    if (!brief) return;

    // ── Restore saved project if none is loaded ──
    if (!state.project) {
```

Replace that opening with:

```js
  async function _applyActiveBrief() {
    if (!state.activeBriefId) return;
    const brief = storage.getBrief(state.activeBriefId);
    if (!brief) return;

    // ── Unload previous project when switching to a different brief ──
    if (state.project && state.loadedBriefId !== state.activeBriefId) {
      await projectStore.flush();
      state.setProject(null);
      nameEl.textContent = 'Loading\u2026';
      nameEl.classList.add('no-project');
    }

    // ── Restore saved project if none is loaded ──
    if (!state.project) {
```

- [ ] **Step 2: Set `loadedBriefId` after successful project setup**

Still in `_applyActiveBrief()`, find the end of the `if (!state.project)` block. It closes just before the image-loading comment on line 160:

```js
    }

    // ── Load images not already in state ──
```

Insert the assignment between those two lines:

```js
    }

    // Record which brief is now loaded (skip if we bailed early due to corrupt project)
    state.loadedBriefId = state.activeBriefId;

    // ── Load images not already in state ──
```

- [ ] **Step 3: Manually verify — first launch is unchanged**

1. Open the app fresh (clear localStorage or use a private window).
2. Open a project from the manager.
3. Confirm the editor loads the project normally — no blank state, no "Loading…" flash.
4. Open browser console — no errors.

- [ ] **Step 4: Manually verify — switching projects works**

1. Open Project A from the manager. Confirm it loads.
2. Click "← Projects" to return to the manager.
3. Open Project B (a different brief). Confirm:
   - The header briefly shows "Loading…"
   - Project B's frames and title appear — NOT Project A's
   - The canvas renders Project B's first frame
4. Edit a layer in Project B. Click "← Projects". Open Project A again. Confirm Project A loads correctly and does not show Project B content.

- [ ] **Step 5: Manually verify — re-opening the same project skips reload**

1. Open Project A. Make a note of the active frame.
2. Navigate back and open Project A again.
3. Confirm the editor loads Project A without a "Loading…" flash (switch-detection block does not trigger because `loadedBriefId === activeBriefId`).

- [ ] **Step 6: Commit**

```bash
git add editor/shell.js
git commit -m "fix: clear project state and flush save when switching to a different brief"
```
