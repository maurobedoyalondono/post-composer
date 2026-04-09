# Project Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Project Manager view — project list with CRUD, 5-step brief wizard, and inputs package export (image-sheet.jpg + image-map.md + project-brief.txt downloaded as ZIP).

**Architecture:** `manager/shell.js` mounts into `#manager-view`. Project briefs are stored in localStorage under `pc_brief_*` keys (separate from full editor project JSONs). The brief wizard is a modal overlay on the manager view — not a separate route. Package export uses JSZip loaded via CDN script tag. All code is pure Vanilla JS ES modules with no build step.

**Tech Stack:** HTML5, Vanilla JS ES modules, HTML5 Canvas API (image-sheet generation), localStorage, JSZip 3.10.1 via unpkg CDN

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `manager/constants.js` | **Create** | PLATFORMS array, TONES array, `slugify()`, `autoLabel()` |
| `core/storage.js` | **Modify** | Add brief CRUD: `saveBrief`, `getBrief`, `listBriefs`, `deleteBrief` |
| `index.html` | **Modify** | Add JSZip CDN `<script>` tag before `app.js` |
| `app.js` | **Modify** | Import and call `mountManager(state)` on `view:changed` → manager |
| `manager/shell.js` | **Create** | `mountManager(state)` — view HTML, wires ProjectList + BriefWizard |
| `manager/exporter.js` | **Create** | `generateImageMap`, `generateProjectBrief`, `generateImageSheet`, `exportPackage` |
| `manager/brief-wizard.js` | **Create** | `BriefWizard` class — modal overlay, all 5 wizard steps |
| `manager/projects.js` | **Create** | `ProjectList` class — renders project cards, handles edit/delete/open |
| `styles/shell.css` | **Modify** | Manager layout: `.manager-shell`, header, body, project list grid |
| `styles/components.css` | **Modify** | Project cards, wizard modal, step bar, image grid, review list |
| `tests/core/storage-briefs.test.js` | **Create** | Unit tests for brief CRUD in storage.js |
| `tests/manager/exporter.test.js` | **Create** | Unit tests for `generateImageMap`, `generateProjectBrief`, `slugify`, `autoLabel` |
| `tests/manager/runner.html` | **Create** | Browser test runner for manager tests |
| `tests/runner.html` | **Modify** | Add import for `./core/storage-briefs.test.js` |

---

## Task 1: `manager/constants.js` — Platforms, tones, utilities

**Files:**
- Create: `manager/constants.js`

- [ ] **Step 1: Create `manager/constants.js`**

```js
// manager/constants.js
export const PLATFORMS = [
  { id: 'instagram-portrait',  label: 'Instagram Portrait',   width: 1080, height: 1350 },
  { id: 'instagram-square',    label: 'Instagram Square',     width: 1080, height: 1080 },
  { id: 'instagram-landscape', label: 'Instagram Landscape',  width: 1080, height:  566 },
  { id: 'a4-portrait',         label: 'A4 Portrait (Print)',  width: 2480, height: 3508 },
  { id: 'a4-landscape',        label: 'A4 Landscape (Print)', width: 3508, height: 2480 },
  { id: 'linkedin-banner',     label: 'LinkedIn Banner',      width: 1584, height:  396 },
  { id: 'facebook-post',       label: 'Facebook Post',        width: 1200, height:  628 },
];

export const TONES = [
  { id: 'cinematic',   label: 'Cinematic' },
  { id: 'editorial',   label: 'Editorial' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'minimal',     label: 'Minimal' },
  { id: 'ai-decides',  label: 'AI decides' },
];

/**
 * Convert a project title to a URL-safe slug.
 * 'Canyon Series 2026' → 'canyon-series-2026'
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'project';
}

/**
 * Auto-generate a descriptive label from an image filename.
 * 'CC2A1369.jpg' → 'cc2a1369'
 * 'My Photo 001.JPG' → 'my-photo-001'
 */
export function autoLabel(filename) {
  return String(filename)
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}
```

- [ ] **Step 2: Commit**

```bash
git add manager/constants.js
git commit -m "feat(manager): add constants — PLATFORMS, TONES, slugify, autoLabel"
```

---

## Task 2: Brief CRUD in `core/storage.js`

**Files:**
- Modify: `core/storage.js`

Context: `storage.js` exports the `storage` singleton with `saveProject`, `getProject`, `listProjects`, `deleteProject`, `savePrefs`, `getPrefs`, and `_readIndex`. Brief CRUD uses separate localStorage keys (`pc_brief_*` and `pc_briefs` index) so brief data never conflicts with full project JSON.

- [ ] **Step 1: Read `core/storage.js` to see current end of file**

The file currently ends at line 50 (`};`). The new methods go inside the `storage` object, before the closing `};`.

- [ ] **Step 2: Add brief CRUD methods to `core/storage.js`**

Add the following methods inside the `storage = { ... }` object, after the `_readIndex()` method (before the final `};`):

```js
  // ── Brief CRUD (Project Manager inputs — separate from editor project JSON) ──

  /** Save a project brief. Updates the brief index automatically. */
  saveBrief(brief) {
    brief.updatedAt = Date.now();
    const { id, title } = brief;
    localStorage.setItem(`pc_brief_${id}`, JSON.stringify(brief));
    const index = this._readBriefIndex();
    const existing = index.findIndex(b => b.id === id);
    const entry = { id, title, updatedAt: brief.updatedAt };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem('pc_briefs', JSON.stringify(index));
  },

  /** Returns full brief object or null. */
  getBrief(id) {
    const raw = localStorage.getItem(`pc_brief_${id}`);
    return raw ? JSON.parse(raw) : null;
  },

  /** Returns array of index entries [{id, title, updatedAt}] sorted newest first. */
  listBriefs() {
    return this._readBriefIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Removes brief from storage and index. */
  deleteBrief(id) {
    localStorage.removeItem(`pc_brief_${id}`);
    const index = this._readBriefIndex().filter(b => b.id !== id);
    localStorage.setItem('pc_briefs', JSON.stringify(index));
  },

  _readBriefIndex() {
    const raw = localStorage.getItem('pc_briefs');
    return raw ? JSON.parse(raw) : [];
  },
```

The full `storage.js` after edits should look like:

```js
// core/storage.js
const KEYS = {
  index: 'pc_projects_index',
  project: id => `pc_project_${id}`,
  prefs: 'pc_prefs',
};

export const storage = {
  saveProject(project) {
    const { id, title } = project;
    localStorage.setItem(KEYS.project(id), JSON.stringify(project));
    const index = this._readIndex();
    const existing = index.findIndex(p => p.id === id);
    const entry = { id, title, updatedAt: Date.now() };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  getProject(id) {
    const raw = localStorage.getItem(KEYS.project(id));
    return raw ? JSON.parse(raw) : null;
  },

  listProjects() {
    return this._readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  deleteProject(id) {
    localStorage.removeItem(KEYS.project(id));
    const index = this._readIndex().filter(p => p.id !== id);
    localStorage.setItem(KEYS.index, JSON.stringify(index));
  },

  savePrefs(prefs) { localStorage.setItem(KEYS.prefs, JSON.stringify(prefs)); },

  getPrefs() {
    const raw = localStorage.getItem(KEYS.prefs);
    return raw ? JSON.parse(raw) : {};
  },

  _readIndex() {
    const raw = localStorage.getItem(KEYS.index);
    return raw ? JSON.parse(raw) : [];
  },

  // ── Brief CRUD ──

  saveBrief(brief) {
    brief.updatedAt = Date.now();
    const { id, title } = brief;
    localStorage.setItem(`pc_brief_${id}`, JSON.stringify(brief));
    const index = this._readBriefIndex();
    const existing = index.findIndex(b => b.id === id);
    const entry = { id, title, updatedAt: brief.updatedAt };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem('pc_briefs', JSON.stringify(index));
  },

  getBrief(id) {
    const raw = localStorage.getItem(`pc_brief_${id}`);
    return raw ? JSON.parse(raw) : null;
  },

  listBriefs() {
    return this._readBriefIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  deleteBrief(id) {
    localStorage.removeItem(`pc_brief_${id}`);
    const index = this._readBriefIndex().filter(b => b.id !== id);
    localStorage.setItem('pc_briefs', JSON.stringify(index));
  },

  _readBriefIndex() {
    const raw = localStorage.getItem('pc_briefs');
    return raw ? JSON.parse(raw) : [];
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add core/storage.js
git commit -m "feat(storage): add brief CRUD — saveBrief, getBrief, listBriefs, deleteBrief"
```

---

## Task 3: Storage brief tests

**Files:**
- Create: `tests/core/storage-briefs.test.js`
- Modify: `tests/runner.html`

Context: Tests use the project's custom browser test helper (`tests/test-helper.js`) — `describe`, `it`, `assert`, `assertEqual`. Each test saves data to real localStorage and cleans up at the end. Pattern follows `tests/core/storage.test.js`.

- [ ] **Step 1: Create `tests/core/storage-briefs.test.js`**

```js
// tests/core/storage-briefs.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { storage } from '../../core/storage.js';

const T = '__brief_test__';

function makeBrief(id = T, title = 'Test Brief') {
  return {
    id,
    title,
    platform: 'instagram-portrait',
    story: 'A test story.',
    tone: 'cinematic',
    imageMeta: [],
    createdAt: Date.now(),
  };
}

describe('storage.saveBrief / getBrief', () => {
  it('round-trips all fields', () => {
    const b = makeBrief();
    storage.saveBrief(b);
    const got = storage.getBrief(T);
    assertEqual(got.title, 'Test Brief');
    assertEqual(got.platform, 'instagram-portrait');
    assertEqual(got.tone, 'cinematic');
    assert(got.updatedAt > 0, 'updatedAt should be set');
    storage.deleteBrief(T);
  });

  it('getBrief returns null for unknown id', () => {
    assert(storage.getBrief('__nonexistent_brief__') === null);
  });

  it('saveBrief sets updatedAt automatically', () => {
    const before = Date.now();
    storage.saveBrief(makeBrief());
    const got = storage.getBrief(T);
    assert(got.updatedAt >= before, 'updatedAt should be >= time before save');
    storage.deleteBrief(T);
  });
});

describe('storage.listBriefs', () => {
  it('includes saved brief', () => {
    storage.saveBrief(makeBrief('__bl1__', 'List Test 1'));
    const list = storage.listBriefs();
    assert(list.some(b => b.id === '__bl1__'), 'list should contain saved brief');
    storage.deleteBrief('__bl1__');
  });

  it('does not include deleted brief', () => {
    storage.saveBrief(makeBrief('__bl2__', 'Delete Test'));
    storage.deleteBrief('__bl2__');
    const list = storage.listBriefs();
    assert(!list.some(b => b.id === '__bl2__'), 'list should not contain deleted brief');
  });

  it('updates existing entry on re-save (no duplicates in index)', () => {
    storage.saveBrief(makeBrief('__bl3__', 'Original'));
    storage.saveBrief({ ...makeBrief('__bl3__', 'Updated'), createdAt: Date.now() });
    const list = storage.listBriefs();
    const matches = list.filter(b => b.id === '__bl3__');
    assertEqual(matches.length, 1, 'should have exactly one entry after re-save');
    assertEqual(matches[0].title, 'Updated');
    storage.deleteBrief('__bl3__');
  });
});

describe('storage.deleteBrief', () => {
  it('removes brief from storage and index', () => {
    storage.saveBrief(makeBrief('__bd1__', 'To Delete'));
    storage.deleteBrief('__bd1__');
    assert(storage.getBrief('__bd1__') === null, 'getBrief should return null after delete');
    assert(!storage.listBriefs().some(b => b.id === '__bd1__'), 'listBriefs should not list deleted');
  });

  it('deleteBrief on nonexistent id is a no-op', () => {
    // Should not throw
    storage.deleteBrief('__nonexistent_delete__');
    assert(true, 'no throw on delete of nonexistent id');
  });
});
```

- [ ] **Step 2: Add import to `tests/runner.html`**

In `tests/runner.html`, add this import line after `'./core/storage.test.js'`:

```html
    import './core/storage-briefs.test.js';
```

The updated `<script type="module">` block in `tests/runner.html` should look like:

```html
  <script type="module">
    import { summary } from './test-helper.js';
    import './core/state.test.js';
    import './core/events.test.js';
    import './core/router.test.js';
    import './core/storage.test.js';
    import './core/storage-briefs.test.js';
    import './shared/validator.test.js';
    import './editor/frame-manager.test.js';
    import './editor/layers.test.js';
    import './editor/layers-bounds.test.js';
    import './editor/layer-manager.test.js';
    import './editor/analysis.test.js';
    summary();
  </script>
```

- [ ] **Step 3: Verify tests pass**

Open `tests/runner.html` in browser (via live server). Confirm all tests pass (green). The new `storage.saveBrief / getBrief` and `storage.listBriefs` and `storage.deleteBrief` suites should appear with all green.

- [ ] **Step 4: Commit**

```bash
git add tests/core/storage-briefs.test.js tests/runner.html
git commit -m "test(storage): add brief CRUD unit tests"
```

---

## Task 4: `manager/exporter.js` — Pure export functions

**Files:**
- Create: `manager/exporter.js`

Context: Three pure (or nearly pure) functions that generate the inputs package content, plus `exportPackage` which orchestrates the ZIP download using `window.JSZip` (loaded via CDN). `generateImageMap` and `generateProjectBrief` are pure string functions. `generateImageSheet` uses Canvas API. `exportPackage` uses JSZip.

**Brief object shape** used throughout exporter:
```js
{
  id: 'canyon-series',           // slug
  title: 'Canyon Series',
  platform: 'instagram-portrait',
  story: 'A journey...',
  tone: 'cinematic',
  imageMeta: [                   // ordered
    { filename: 'CC2A1369.jpg', label: 'wide-canyon-overview' }
  ]
}
```

- [ ] **Step 1: Create `manager/exporter.js`**

```js
// manager/exporter.js
import { PLATFORMS } from './constants.js';

const AI_MANUAL_STUB = `---
# post-composer AI Generation Manual
Version: 1.0
See the post-composer repository (docs/ai-manual.md) for the complete manual.

## Composition Patterns (required on every frame)

| Pattern | Description |
|---------|-------------|
| editorial-anchor | Text anchored to a geometric element — rule line, shape, solid block |
| minimal-strip | Tight text in a narrow zone. Image dominates. Almost silent. |
| data-callout | Number or stat as hero. Large, bold, anchored to a key visual area. |
| full-bleed | Image dominant. Zero overlay. Intentional silence — chosen, not defaulted. |
| layered-depth | Multiple overlapping elements. Depth through transparency and stacking. |
| diagonal-tension | Elements placed along a diagonal axis. Creates movement and energy. |
| centered-monument | Single centered element. Breathing space on all sides. Formal, precise. |

## Variety Rules (non-negotiable)

- No zone used on > 40% of text frames
- Minimum 1 shape per 3 frames (or document waiver with reason)
- At least 2 different overlay strategies per series
- Accent color on >= 2 frames (or document exclusion)
- No composition pattern on > 40% of frames`;

/**
 * Generate image-map.md content.
 * @param {Array<{filename: string, label: string}>} imageMeta
 * @returns {string}
 */
export function generateImageMap(imageMeta) {
  const header =
    `| frame     | raw_filename        | descriptive_label          |\n` +
    `|-----------|---------------------|----------------------------|\n`;
  const rows = imageMeta.map((img, i) => {
    const frame = `frame-${String(i + 1).padStart(2, '0')}`;
    const fn    = img.filename.slice(0, 19).padEnd(19);
    const label = img.label.slice(0, 26).padEnd(26);
    return `| ${frame.padEnd(9)} | ${fn} | ${label} |`;
  });
  return header + rows.join('\n') + (rows.length ? '\n' : '');
}

/**
 * Generate project-brief.txt content.
 * @param {{id, title, platform, story, tone, imageMeta}} brief
 * @returns {string}
 */
export function generateProjectBrief(brief) {
  const platform = PLATFORMS.find(p => p.id === brief.platform);
  const platformStr = platform
    ? `${platform.label} (${platform.width}×${platform.height}px)`
    : brief.platform;
  const date = new Date().toISOString().slice(0, 10);

  return [
    `# post-composer Project Brief`,
    `Generated: ${date}`,
    ``,
    `## Project`,
    `- Title: ${brief.title}`,
    `- Project ID: ${brief.id}`,
    `- Platform: ${platformStr}`,
    `- Total images: ${brief.imageMeta.length}`,
    ``,
    `## Story & Direction`,
    brief.story || '(no story provided)',
    ``,
    `Tone: ${brief.tone}`,
    ``,
    `## Images`,
    `${brief.imageMeta.length} image${brief.imageMeta.length === 1 ? '' : 's'} provided alongside this brief.`,
    `See image-map.md for the full frame → filename → label mapping.`,
    ``,
    AI_MANUAL_STUB,
  ].join('\n');
}

/**
 * Generate image-sheet.jpg as a Blob.
 * Draws a 4-column thumbnail grid with filenames below each image.
 * @param {Array<{filename: string}>} imageMeta
 * @param {Map<string, File>} files  filename → File
 * @returns {Promise<Blob>}
 */
export async function generateImageSheet(imageMeta, files) {
  const COLS    = 4;
  const THUMB_W = 260;
  const THUMB_H = 195;
  const PAD     = 8;
  const LABEL_H = 18;
  const CELL_W  = THUMB_W + PAD;
  const CELL_H  = THUMB_H + LABEL_H + PAD;
  const rows    = Math.max(1, Math.ceil(imageMeta.length / COLS));

  const canvas  = document.createElement('canvas');
  canvas.width  = COLS * CELL_W + PAD;
  canvas.height = rows * CELL_H + PAD;
  const ctx     = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < imageMeta.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x   = PAD + col * CELL_W;
    const y   = PAD + row * CELL_H;

    const file = files.get(imageMeta[i].filename);
    if (file) {
      try {
        const img = await _loadImageFromFile(file);
        const scale = Math.max(THUMB_W / img.naturalWidth, THUMB_H / img.naturalHeight);
        const sw    = THUMB_W / scale;
        const sh    = THUMB_H / scale;
        const sx    = (img.naturalWidth  - sw) / 2;
        const sy    = (img.naturalHeight - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, THUMB_W, THUMB_H);
      } catch (_) {
        _drawMissingPlaceholder(ctx, x, y, THUMB_W, THUMB_H);
      }
    } else {
      _drawMissingPlaceholder(ctx, x, y, THUMB_W, THUMB_H);
    }

    // Filename label below thumbnail
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '11px monospace';
    ctx.fillText(imageMeta[i].filename, x + 2, y + THUMB_H + LABEL_H - 3);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('canvas.toBlob produced null'))),
      'image/jpeg',
      0.85
    )
  );
}

/**
 * Build and download the inputs package as a ZIP.
 * Requires window.JSZip (loaded via CDN script tag in index.html).
 * @param {{id, title, platform, story, tone, imageMeta}} brief
 * @param {Map<string, File>} files
 * @returns {Promise<void>}
 */
export async function exportPackage(brief, files) {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip not loaded — check the <script> tag in index.html');
  }

  const zip    = new window.JSZip();
  const folder = zip.folder(`${brief.id}/inputs`);

  folder.file('image-map.md',      generateImageMap(brief.imageMeta));
  folder.file('project-brief.txt', generateProjectBrief(brief));

  if (brief.imageMeta.length > 0) {
    const sheetBlob = await generateImageSheet(brief.imageMeta, files);
    folder.file('image-sheet.jpg', sheetBlob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url     = URL.createObjectURL(zipBlob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `${brief.id}-inputs.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to load ${file.name}`)); };
    img.src     = url;
  });
}

function _drawMissingPlaceholder(ctx, x, y, w, h) {
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#555';
  ctx.font = '13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('no image', x + w / 2, y + h / 2 + 5);
  ctx.textAlign = 'left';
}
```

- [ ] **Step 2: Commit**

```bash
git add manager/exporter.js
git commit -m "feat(manager): add exporter — generateImageMap, generateProjectBrief, generateImageSheet, exportPackage"
```

---

## Task 5: Exporter unit tests

**Files:**
- Create: `tests/manager/exporter.test.js`
- Create: `tests/manager/runner.html`

Context: `generateImageMap` and `generateProjectBrief` are pure string functions testable in the browser. `slugify` and `autoLabel` are imported from `manager/constants.js`.

- [ ] **Step 1: Create `tests/manager/exporter.test.js`**

```js
// tests/manager/exporter.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { generateImageMap, generateProjectBrief } from '../../manager/exporter.js';
import { slugify, autoLabel } from '../../manager/constants.js';

// ── slugify ────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    assertEqual(slugify('Canyon Series 2026'), 'canyon-series-2026');
  });

  it('collapses multiple spaces/punctuation into one hyphen', () => {
    assertEqual(slugify('Hello   World!!'), 'hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    assertEqual(slugify('  Hello World  '), 'hello-world');
  });

  it('empty string returns "project"', () => {
    assertEqual(slugify(''), 'project');
  });

  it('already-slug string is unchanged', () => {
    assertEqual(slugify('my-project'), 'my-project');
  });
});

// ── autoLabel ─────────────────────────────────────────────────────────────

describe('autoLabel', () => {
  it('removes file extension and slugifies', () => {
    assertEqual(autoLabel('CC2A1369.jpg'), 'cc2a1369');
  });

  it('handles uppercase extension', () => {
    assertEqual(autoLabel('IMG_0042.JPG'), 'img-0042');
  });

  it('handles spaces in filename', () => {
    assertEqual(autoLabel('My Photo 001.jpg'), 'my-photo-001');
  });

  it('already-slug filename stays slug', () => {
    assertEqual(autoLabel('canyon-view.jpg'), 'canyon-view');
  });

  it('empty base name returns "image"', () => {
    assertEqual(autoLabel('.jpg'), 'image');
  });
});

// ── generateImageMap ──────────────────────────────────────────────────────

describe('generateImageMap', () => {
  const meta2 = [
    { filename: 'CC2A1369.jpg', label: 'wide-canyon-overview' },
    { filename: 'CC2A1463.jpg', label: 'eroded-channels' },
  ];

  it('includes header row', () => {
    const result = generateImageMap(meta2);
    assert(result.includes('| frame     |'), 'missing frame header column');
    assert(result.includes('| raw_filename'), 'missing raw_filename header column');
    assert(result.includes('| descriptive_label'), 'missing descriptive_label header column');
  });

  it('includes separator row', () => {
    assert(generateImageMap(meta2).includes('|-----------|'), 'missing separator row');
  });

  it('assigns frame-01 and frame-02 sequentially', () => {
    const result = generateImageMap(meta2);
    assert(result.includes('frame-01'), 'missing frame-01');
    assert(result.includes('frame-02'), 'missing frame-02');
  });

  it('includes filenames and labels in rows', () => {
    const result = generateImageMap(meta2);
    assert(result.includes('CC2A1369.jpg'), 'missing first filename');
    assert(result.includes('wide-canyon-overview'), 'missing first label');
    assert(result.includes('CC2A1463.jpg'), 'missing second filename');
    assert(result.includes('eroded-channels'), 'missing second label');
  });

  it('empty imageMeta produces header + separator only', () => {
    const result = generateImageMap([]);
    assert(result.includes('| frame     |'), 'header present');
    assert(!result.includes('frame-01'), 'no frame rows for empty input');
  });

  it('single image produces exactly one data row', () => {
    const result = generateImageMap([{ filename: 'a.jpg', label: 'alpha' }]);
    const dataRows = result.split('\n').filter(l => l.startsWith('| frame-'));
    assertEqual(dataRows.length, 1, 'should have exactly one data row');
  });
});

// ── generateProjectBrief ──────────────────────────────────────────────────

describe('generateProjectBrief', () => {
  const brief = {
    id: 'canyon-series',
    title: 'Canyon Series',
    platform: 'instagram-portrait',
    story: 'A journey through the canyon.',
    tone: 'cinematic',
    imageMeta: [
      { filename: 'CC2A1369.jpg', label: 'wide-canyon' },
      { filename: 'CC2A1463.jpg', label: 'eroded-channels' },
    ],
  };

  it('contains the project title', () => {
    assert(generateProjectBrief(brief).includes('Canyon Series'), 'missing title');
  });

  it('contains the platform label (not the ID)', () => {
    assert(generateProjectBrief(brief).includes('Instagram Portrait'), 'missing platform label');
  });

  it('contains platform dimensions', () => {
    assert(generateProjectBrief(brief).includes('1080×1350px'), 'missing dimensions');
  });

  it('contains the story text', () => {
    assert(generateProjectBrief(brief).includes('A journey through the canyon.'), 'missing story');
  });

  it('contains the tone', () => {
    assert(generateProjectBrief(brief).includes('cinematic'), 'missing tone');
  });

  it('contains correct image count', () => {
    assert(generateProjectBrief(brief).includes('2 images'), 'missing image count');
  });

  it('contains AI manual stub', () => {
    assert(generateProjectBrief(brief).includes('post-composer AI Generation Manual'), 'missing AI manual stub');
  });

  it('contains the project ID', () => {
    assert(generateProjectBrief(brief).includes('canyon-series'), 'missing project ID');
  });
});
```

- [ ] **Step 2: Create `tests/manager/runner.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>post-composer manager tests</title>
  <style>
    body { background:#0d0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1   { color:#a5b4fc; margin-bottom:8px; }
    p    { color:#6b7280; margin-bottom:24px; font-size:13px; }
  </style>
</head>
<body>
  <h1>post-composer — manager tests</h1>
  <p>Verify by opening in browser via live server. Refresh to re-run.</p>
  <div id="results"></div>
  <script type="module">
    import { summary } from '../test-helper.js';
    import './exporter.test.js';
    summary();
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify tests pass**

Open `tests/manager/runner.html` in browser via live server. All `slugify`, `autoLabel`, `generateImageMap`, and `generateProjectBrief` suites should be green.

Expected: green all — no red rows.

- [ ] **Step 4: Commit**

```bash
git add tests/manager/exporter.test.js tests/manager/runner.html
git commit -m "test(manager): add exporter + constants unit tests"
```

---

## Task 6: `manager/brief-wizard.js` — 5-step modal wizard

**Files:**
- Create: `manager/brief-wizard.js`

Context: The wizard is a modal overlay appended to the manager root element. It manages a working `brief` object in memory. On step 5 ("Export & Save"), it saves the brief to localStorage and calls `exportPackage`. In edit mode (opening an existing brief), image Files are not restored (Files can't be serialized) — step 3 shows empty file picker and the user can add/update images.

- [ ] **Step 1: Create `manager/brief-wizard.js`**

```js
// manager/brief-wizard.js
import { storage }        from '../core/storage.js';
import { events }         from '../core/events.js';
import { PLATFORMS, TONES, slugify, autoLabel } from './constants.js';
import { exportPackage }  from './exporter.js';

const STEP_LABELS = [
  'Title & Platform',
  'Story & Tone',
  'Load Images',
  'Review & Arrange',
  'Export Package',
];

export class BriefWizard {
  /**
   * @param {HTMLElement} rootEl — the manager root element (wizard overlay appends here)
   */
  constructor(rootEl) {
    this._root      = rootEl;
    this._brief     = null;   // working brief object
    this._files     = new Map(); // filename → File (for current session)
    this._step      = 1;
    this._overlayEl = null;
    this._isNew     = true;
  }

  /**
   * Open the wizard.
   * @param {object|null} brief — existing brief to edit, or null for new
   */
  open(brief) {
    this._isNew = !brief;
    this._brief = brief
      ? { ...brief, imageMeta: (brief.imageMeta || []).map(m => ({ ...m })) }
      : {
          id: '',
          title: '',
          platform: 'instagram-portrait',
          story: '',
          tone: 'cinematic',
          imageMeta: [],
          createdAt: Date.now(),
        };
    this._files = new Map();
    this._step  = 1;
    this._mount();
    this._renderStep();
  }

  close() {
    if (this._overlayEl) {
      this._overlayEl.remove();
      this._overlayEl = null;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _mount() {
    this.close(); // close any existing overlay first
    const el = document.createElement('div');
    el.className = 'wizard-overlay';
    el.innerHTML = `
      <div class="wizard-modal" role="dialog" aria-modal="true" aria-label="${this._isNew ? 'New Project' : 'Edit Brief'}">
        <div class="wizard-header">
          <span class="wizard-title">${this._isNew ? 'New Project' : 'Edit Brief'}</span>
          <button class="wizard-close" aria-label="Close wizard">×</button>
        </div>
        <div class="wizard-steps-bar"></div>
        <div class="wizard-body"></div>
        <div class="wizard-footer">
          <button class="btn btn-secondary wizard-btn-back">Back</button>
          <button class="btn btn-primary wizard-btn-next">Next</button>
        </div>
      </div>`;
    this._root.appendChild(el);
    this._overlayEl = el;

    el.querySelector('.wizard-close').addEventListener('click', () => this.close());
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    el.querySelector('.wizard-btn-back').addEventListener('click', () => this._goBack());
    el.querySelector('.wizard-btn-next').addEventListener('click', () => this._goNext());
  }

  _renderStep() {
    this._renderStepsBar();
    const body    = this._overlayEl.querySelector('.wizard-body');
    const backBtn = this._overlayEl.querySelector('.wizard-btn-back');
    const nextBtn = this._overlayEl.querySelector('.wizard-btn-next');

    backBtn.disabled    = (this._step === 1);
    nextBtn.textContent = (this._step === 5) ? 'Export & Save' : 'Next';

    switch (this._step) {
      case 1: body.innerHTML = this._step1HTML(); this._wireStep1(); break;
      case 2: body.innerHTML = this._step2HTML(); this._wireStep2(); break;
      case 3: body.innerHTML = this._step3HTML(); this._wireStep3(); break;
      case 4: body.innerHTML = this._step4HTML(); this._wireStep4(); break;
      case 5: body.innerHTML = this._step5HTML(); break;
    }
  }

  _renderStepsBar() {
    const bar = this._overlayEl.querySelector('.wizard-steps-bar');
    bar.innerHTML = STEP_LABELS.map((label, i) => {
      const n   = i + 1;
      const cls = n < this._step ? 'done' : n === this._step ? 'active' : '';
      return `<span class="wizard-step ${cls}">${n}. ${label}</span>`;
    }).join('');
  }

  _goBack() {
    this._saveCurrentStep();
    if (this._step > 1) { this._step--; this._renderStep(); }
  }

  async _goNext() {
    if (!this._validateStep()) return;
    this._saveCurrentStep();
    if (this._step < 5) {
      this._step++;
      this._renderStep();
    } else {
      await this._doExportAndSave();
    }
  }

  _validateStep() {
    if (this._step === 1) {
      const titleInput = this._overlayEl.querySelector('#wiz-title');
      if (!titleInput?.value.trim()) {
        alert('Please enter a project title.');
        titleInput?.focus();
        return false;
      }
    }
    return true;
  }

  _saveCurrentStep() {
    const el = this._overlayEl;
    if (this._step === 1) {
      this._brief.title    = el.querySelector('#wiz-title')?.value.trim()    || this._brief.title;
      this._brief.platform = el.querySelector('#wiz-platform')?.value        || this._brief.platform;
      if (!this._brief.id) this._brief.id = slugify(this._brief.title);
    }
    if (this._step === 2) {
      this._brief.story = el.querySelector('#wiz-story')?.value.trim() || this._brief.story;
      this._brief.tone  = el.querySelector('#wiz-tone')?.value         || this._brief.tone;
    }
    if (this._step === 4) {
      // Flush any unsaved label edits
      el.querySelectorAll('.wiz-row-label').forEach(input => {
        const meta = this._brief.imageMeta.find(m => m.filename === input.dataset.filename);
        if (meta) meta.label = input.value.trim() || autoLabel(meta.filename);
      });
    }
  }

  // ── Step 1: Title & Platform ───────────────────────────────────────────────

  _step1HTML() {
    return `
      <div class="wiz-field">
        <label class="wiz-label" for="wiz-title">Project Title</label>
        <input id="wiz-title" type="text" class="wiz-input"
               placeholder="e.g. Canyon Series 2026"
               value="${_esc(this._brief.title)}">
      </div>
      <div class="wiz-field">
        <label class="wiz-label" for="wiz-platform">Platform</label>
        <select id="wiz-platform" class="wiz-select">
          ${PLATFORMS.map(p =>
            `<option value="${p.id}"${this._brief.platform === p.id ? ' selected' : ''}>
              ${_esc(p.label)} — ${p.width}×${p.height}px
            </option>`
          ).join('')}
        </select>
      </div>`;
  }

  _wireStep1() {
    this._overlayEl.querySelector('#wiz-title')?.focus();
    // Allow pressing Enter to advance
    this._overlayEl.querySelector('#wiz-title')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._goNext();
    });
  }

  // ── Step 2: Story & Tone ──────────────────────────────────────────────────

  _step2HTML() {
    return `
      <div class="wiz-field">
        <label class="wiz-label" for="wiz-story">Story & Direction</label>
        <textarea id="wiz-story" class="wiz-textarea" rows="6"
                  placeholder="Describe the series — subject, narrative arc, mood, what makes it unique...">${_esc(this._brief.story)}</textarea>
      </div>
      <div class="wiz-field">
        <label class="wiz-label" for="wiz-tone">Tone</label>
        <select id="wiz-tone" class="wiz-select">
          ${TONES.map(t =>
            `<option value="${t.id}"${this._brief.tone === t.id ? ' selected' : ''}>${_esc(t.label)}</option>`
          ).join('')}
        </select>
      </div>`;
  }

  _wireStep2() {
    this._overlayEl.querySelector('#wiz-story')?.focus();
  }

  // ── Step 3: Load Images ──────────────────────────────────────────────────

  _step3HTML() {
    const count   = this._files.size;
    const hasEdit = !this._isNew && this._brief.imageMeta.length > 0;
    return `
      <div class="wiz-drop-zone" id="wiz-drop-zone">
        <p class="wiz-drop-hint">Drag &amp; drop images here, or</p>
        <label class="btn btn-secondary" for="wiz-file-input">Choose Files</label>
        <input id="wiz-file-input" type="file" accept="image/*" multiple class="file-input-hidden">
        ${count > 0
          ? `<p class="wiz-count">${count} image${count === 1 ? '' : 's'} loaded this session</p>`
          : hasEdit
            ? `<p class="wiz-count">${this._brief.imageMeta.length} image${this._brief.imageMeta.length === 1 ? '' : 's'} from previous save (add new files to update)</p>`
            : ''}
      </div>
      <div class="wiz-image-grid" id="wiz-image-grid">
        ${this._brief.imageMeta.map(img => this._thumbHTML(img)).join('')}
      </div>`;
  }

  _wireStep3() {
    const el       = this._overlayEl;
    const input    = el.querySelector('#wiz-file-input');
    const dropZone = el.querySelector('#wiz-drop-zone');

    input.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length) this._addFiles(files);
      input.value = ''; // reset so same files can be re-selected
    });

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) this._addFiles(files);
    });

    // Render thumbnails for any already-loaded files
    this._renderThumbsForLoadedFiles();
  }

  _addFiles(files) {
    for (const f of files) {
      this._files.set(f.name, f);
      if (!this._brief.imageMeta.find(m => m.filename === f.name)) {
        this._brief.imageMeta.push({ filename: f.name, label: autoLabel(f.name) });
      }
    }
    // Re-render step 3
    const body = this._overlayEl.querySelector('.wizard-body');
    body.innerHTML = this._step3HTML();
    this._wireStep3();
  }

  _thumbHTML(img) {
    const safeId = img.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `
      <div class="wiz-thumb" data-filename="${_esc(img.filename)}">
        <div class="wiz-thumb-img" id="wt-${safeId}">
          <span class="wiz-thumb-placeholder">📷</span>
        </div>
        <div class="wiz-thumb-name" title="${_esc(img.filename)}">${_esc(img.filename)}</div>
      </div>`;
  }

  _renderThumbsForLoadedFiles() {
    for (const [filename, file] of this._files) {
      const safeId  = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
      const thumbEl = this._overlayEl.querySelector(`#wt-${safeId}`);
      if (!thumbEl) continue;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.className = 'wiz-thumb-actual';
      img.onload = () => {
        URL.revokeObjectURL(url);
        thumbEl.innerHTML = '';
        thumbEl.appendChild(img);
      };
      img.src = url;
    }
  }

  // ── Step 4: Review & Arrange ──────────────────────────────────────────────

  _step4HTML() {
    if (this._brief.imageMeta.length === 0) {
      return `<p class="wiz-hint" style="margin-top:24px;">No images loaded. Go back to step 3 to add images.</p>`;
    }
    return `
      <p class="wiz-hint">Drag rows to reorder frames. Edit the label (slug-style, no spaces).</p>
      <div class="wiz-review-list" id="wiz-review-list">
        ${this._brief.imageMeta.map((img, i) => `
          <div class="wiz-review-row" draggable="true" data-index="${i}">
            <span class="wiz-row-handle" aria-hidden="true">⣿</span>
            <span class="wiz-row-frame">frame-${String(i + 1).padStart(2, '0')}</span>
            <span class="wiz-row-filename" title="${_esc(img.filename)}">${_esc(img.filename)}</span>
            <input class="wiz-row-label wiz-input" type="text"
                   value="${_esc(img.label)}"
                   data-filename="${_esc(img.filename)}"
                   placeholder="${_esc(autoLabel(img.filename))}">
          </div>`
        ).join('')}
      </div>`;
  }

  _wireStep4() {
    const list = this._overlayEl.querySelector('#wiz-review-list');
    if (!list) return;

    // Save label on input (not just change, for reliability)
    list.querySelectorAll('.wiz-row-label').forEach(input => {
      input.addEventListener('input', e => {
        const meta = this._brief.imageMeta.find(m => m.filename === e.target.dataset.filename);
        if (meta) meta.label = e.target.value.trim() || autoLabel(meta.filename);
      });
    });

    // Drag-to-reorder rows
    let dragSrc = null;
    list.querySelectorAll('.wiz-review-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrc = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        dragSrc = null;
      });
      row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === row) return;
        const from = Number(dragSrc.dataset.index);
        const to   = Number(row.dataset.index);
        const [item] = this._brief.imageMeta.splice(from, 1);
        this._brief.imageMeta.splice(to, 0, item);
        // Re-render to update frame numbers
        const body = this._overlayEl.querySelector('.wizard-body');
        body.innerHTML = this._step4HTML();
        this._wireStep4();
      });
    });
  }

  // ── Step 5: Export Package ────────────────────────────────────────────────

  _step5HTML() {
    const platform = PLATFORMS.find(p => p.id === this._brief.platform);
    const count    = this._brief.imageMeta.length;
    return `
      <div class="wiz-summary">
        <div class="wiz-summary-row"><span class="wiz-summary-label">Title</span><span>${_esc(this._brief.title)}</span></div>
        <div class="wiz-summary-row"><span class="wiz-summary-label">Platform</span><span>${_esc(platform?.label ?? this._brief.platform)}</span></div>
        <div class="wiz-summary-row"><span class="wiz-summary-label">Images</span><span>${count}</span></div>
        <div class="wiz-summary-row"><span class="wiz-summary-label">Tone</span><span>${_esc(this._brief.tone)}</span></div>
      </div>
      <p class="wiz-hint" style="margin-top:16px;">Clicking <em>Export &amp; Save</em> will:</p>
      <ul class="wiz-export-list">
        <li>Save this project brief to your browser</li>
        <li>Download <code>${_esc(this._brief.id)}-inputs.zip</code> containing:
          <ul>
            <li><code>image-sheet.jpg</code> — thumbnail grid</li>
            <li><code>image-map.md</code> — frame → filename → label table</li>
            <li><code>project-brief.txt</code> — brief + AI manual</li>
          </ul>
        </li>
      </ul>
      ${count === 0 ? '<p class="wiz-hint" style="color:var(--color-warning);">⚠ No images loaded — image-sheet.jpg will not be included.</p>' : ''}`;
  }

  async _doExportAndSave() {
    const nextBtn = this._overlayEl.querySelector('.wizard-btn-next');
    nextBtn.disabled    = true;
    nextBtn.textContent = 'Exporting…';

    try {
      // Generate ID from title if not set (edit mode already has id)
      if (!this._brief.id) this._brief.id = slugify(this._brief.title);

      storage.saveBrief({ ...this._brief });
      events.dispatchEvent(new CustomEvent('brief:saved', { detail: { id: this._brief.id } }));

      if (this._brief.imageMeta.length > 0) {
        await exportPackage(this._brief, this._files);
      }

      this.close();
    } catch (err) {
      alert(`Export failed: ${err.message}`);
      console.error('Export error:', err);
      nextBtn.disabled    = false;
      nextBtn.textContent = 'Export & Save';
    }
  }
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add manager/brief-wizard.js
git commit -m "feat(manager): add BriefWizard — 5-step modal wizard"
```

---

## Task 7: `manager/projects.js` — Project list component

**Files:**
- Create: `manager/projects.js`

Context: `ProjectList` renders project cards from brief index entries. Each card has Edit Brief (opens wizard in edit mode), Open Editor (navigates to editor view), and Delete buttons. On delete, confirms before calling `storage.deleteBrief`.

- [ ] **Step 1: Create `manager/projects.js`**

```js
// manager/projects.js
import { storage }   from '../core/storage.js';
import { router }    from '../core/router.js';
import { PLATFORMS } from './constants.js';

export class ProjectList {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/state.js').AppState} state
   * @param {import('./brief-wizard.js').BriefWizard} wizard
   */
  constructor(container, state, wizard) {
    this._el     = container;
    this._state  = state;
    this._wizard = wizard;
    this.render();
  }

  render() {
    const entries = storage.listBriefs();
    if (entries.length === 0) {
      this._el.innerHTML = `
        <div class="manager-empty">
          <p>No projects yet.</p>
          <p>Click <strong>+ New Project</strong> to get started.</p>
        </div>`;
      return;
    }

    this._el.innerHTML = `
      <div class="project-grid">
        ${entries.map(entry => this._cardHTML(entry)).join('')}
      </div>`;

    this._wireButtons(entries);
  }

  _cardHTML(entry) {
    const brief    = storage.getBrief(entry.id);
    const platform = PLATFORMS.find(p => p.id === brief?.platform);
    const date     = new Date(entry.updatedAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const count = brief?.imageMeta?.length ?? 0;

    return `
      <div class="project-card" data-id="${_esc(entry.id)}">
        <div class="project-card-title">${_esc(entry.title)}</div>
        <div class="project-card-meta">
          ${platform ? _esc(platform.label) : '—'}
          · ${count} image${count === 1 ? '' : 's'}
          · ${date}
        </div>
        <div class="project-card-actions">
          <button class="btn btn-sm btn-card-edit"   data-id="${_esc(entry.id)}">Edit Brief</button>
          <button class="btn btn-sm btn-card-open"   data-id="${_esc(entry.id)}">Open Editor</button>
          <button class="btn btn-sm btn-card-delete" data-id="${_esc(entry.id)}">Delete</button>
        </div>
      </div>`;
  }

  _wireButtons(entries) {
    this._el.querySelectorAll('.btn-card-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const brief = storage.getBrief(btn.dataset.id);
        if (brief) this._wizard.open(brief);
      });
    });

    this._el.querySelectorAll('.btn-card-open').forEach(btn => {
      btn.addEventListener('click', () => {
        // Navigate to editor — user loads JSON + images there via the editor's file inputs
        router.navigate('editor');
      });
    });

    this._el.querySelectorAll('.btn-card-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const card  = btn.closest('.project-card');
        const title = card.querySelector('.project-card-title').textContent;
        if (confirm(`Delete project "${title}"?\n\nThis cannot be undone.`)) {
          storage.deleteBrief(btn.dataset.id);
          this.render();
        }
      });
    });
  }
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add manager/projects.js
git commit -m "feat(manager): add ProjectList component"
```

---

## Task 8: `manager/shell.js` — mountManager + app.js + index.html

**Files:**
- Create: `manager/shell.js`
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Create `manager/shell.js`**

```js
// manager/shell.js
import { events }      from '../core/events.js';
import { ProjectList } from './projects.js';
import { BriefWizard } from './brief-wizard.js';

/**
 * Mount the Project Manager view into #manager-view.
 * Call once after DOM is ready.
 * @param {import('../core/state.js').AppState} state
 */
export function mountManager(state) {
  const root = document.getElementById('manager-view');
  if (!root) throw new Error('#manager-view not found');
  root.innerHTML = _buildHTML();

  const listEl  = root.querySelector('.manager-project-list');
  const wizard  = new BriefWizard(root);
  const projects = new ProjectList(listEl, state, wizard);

  root.querySelector('#btn-new-project').addEventListener('click', () => {
    wizard.open(null);
  });

  // Refresh project list whenever a brief is saved
  events.addEventListener('brief:saved', () => projects.render());
}

function _buildHTML() {
  return `
    <div class="manager-shell">
      <div class="manager-header">
        <span class="manager-brand">post-composer</span>
        <button id="btn-new-project" class="btn btn-primary">+ New Project</button>
      </div>
      <div class="manager-body">
        <div class="manager-project-list"></div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Update `app.js` to import and call `mountManager`**

Replace the current contents of `app.js` with:

```js
// app.js
import { AppState }    from './core/state.js';
import { router }      from './core/router.js';
import { events }      from './core/events.js';
import { mountEditor } from './editor/shell.js';
import { mountManager } from './manager/shell.js';

const state = new AppState();
let editorMounted  = false;
let managerMounted = false;

async function init() {
  router.init(state);

  events.addEventListener('view:changed', e => {
    if (e.detail.view === 'manager' && !managerMounted) {
      mountManager(state);
      managerMounted = true;
    }
    if (e.detail.view === 'editor' && !editorMounted) {
      mountEditor(state);
      editorMounted = true;
    }
  });

  router.navigate('manager');
  console.info('post-composer ready');
}

init().catch(err => console.error('Bootstrap failed:', err));
```

- [ ] **Step 3: Add JSZip CDN to `index.html`**

In `index.html`, add the JSZip script tag before the `app.js` module script:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>post-composer</title>
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/shell.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <div id="app">
    <div id="manager-view" hidden></div>
    <div id="editor-view"  hidden></div>
  </div>
  <script src="https://unpkg.com/jszip@3.10.1/dist/jszip.min.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify app loads**

Open the app in browser via live server. Confirm:
- Page loads without JS errors in console
- Manager view appears (not blank white screen)
- "+ New Project" button is visible
- Empty state message shows: "No projects yet."

- [ ] **Step 5: Commit**

```bash
git add manager/shell.js app.js index.html
git commit -m "feat(manager): mount manager view — shell, app wiring, JSZip CDN"
```

---

## Task 9: CSS — Manager layout + wizard + cards

**Files:**
- Modify: `styles/shell.css`
- Modify: `styles/components.css`

- [ ] **Step 1: Append manager layout to `styles/shell.css`**

Add the following at the end of `styles/shell.css`:

```css
/* ── Manager view ─────────────────────────────── */

.manager-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.manager-brand {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.manager-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px;
}

.manager-empty {
  text-align: center;
  padding: 64px 24px;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 2;
}

/* ── Project grid ─────────────────────────────── */

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s;
}

.project-card:hover {
  border-color: var(--color-accent);
}

.project-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-meta {
  font-size: 12px;
  color: var(--color-text-muted);
}

.project-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

/* ── Wizard overlay ───────────────────────────── */

.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.wizard-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.wizard-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.wizard-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: var(--radius-sm);
}

.wizard-close:hover { color: var(--color-text); background: var(--color-surface-2); }

/* ── Wizard step indicator ────────────────────── */

.wizard-steps-bar {
  display: flex;
  gap: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.wizard-step {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 10px 12px;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.wizard-step.active {
  color: var(--color-accent-2);
  border-bottom-color: var(--color-accent);
}

.wizard-step.done {
  color: var(--color-success);
}

/* ── Wizard body ──────────────────────────────── */

.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ── Wizard footer ────────────────────────────── */

.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.wizard-btn-back:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Wizard form elements ─────────────────────── */

.wiz-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.wiz-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wiz-input,
.wiz-select,
.wiz-textarea {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-sans);
  padding: 8px 10px;
  width: 100%;
  outline: none;
  transition: border-color 0.1s;
}

.wiz-input:focus,
.wiz-select:focus,
.wiz-textarea:focus {
  border-color: var(--color-accent);
}

.wiz-textarea { resize: vertical; min-height: 100px; }

.wiz-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.wiz-count {
  font-size: 12px;
  color: var(--color-success);
  margin-top: 8px;
}

/* ── Drop zone ────────────────────────────────── */

.wiz-drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  margin-bottom: 16px;
  transition: border-color 0.15s, background 0.15s;
}

.wiz-drop-zone.drag-over {
  border-color: var(--color-accent);
  background: rgba(99, 102, 241, 0.06);
}

.wiz-drop-hint { margin-bottom: 10px; }

/* ── Image thumbnail grid (step 3) ───────────── */

.wiz-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.wiz-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.wiz-thumb-img {
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wiz-thumb-actual {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wiz-thumb-placeholder {
  font-size: 24px;
  opacity: 0.4;
}

.wiz-thumb-name {
  font-size: 10px;
  color: var(--color-text-muted);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* ── Review list (step 4) ────────────────────── */

.wiz-review-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wiz-review-row {
  display: grid;
  grid-template-columns: 24px 72px minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: grab;
}

.wiz-review-row.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.wiz-row-handle {
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: grab;
}

.wiz-row-frame {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-accent-2);
}

.wiz-row-filename {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wiz-row-label {
  padding: 4px 6px;
  font-size: 11px;
}

/* ── Step 5 summary ──────────────────────────── */

.wiz-summary {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wiz-summary-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.wiz-summary-label {
  color: var(--color-text-muted);
  min-width: 70px;
}

.wiz-export-list {
  font-size: 12px;
  color: var(--color-text-muted);
  padding-left: 20px;
  line-height: 2;
}

.wiz-export-list code {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-accent-2);
}
```

- [ ] **Step 2: Add small button variant to `styles/components.css`**

Append to `styles/components.css`:

```css
/* ── Small button variant ────────────────────── */
.btn.btn-sm {
  font-size: 11px;
  padding: 3px 8px;
}

/* ── Secondary button variant ────────────────── */
.btn.btn-secondary {
  background: var(--color-surface-2);
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn.btn-secondary:hover {
  background: var(--color-surface);
  border-color: var(--color-accent);
}
```

Note: `.file-input-hidden` already exists elsewhere — verify before adding. If missing, add:
```css
.file-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 3: Smoke test the UI**

Open the app in browser. Verify:
1. Manager view loads with "+ New Project" button
2. Clicking "+ New Project" opens the wizard modal
3. Step 1 has title input and platform dropdown (7 options)
4. Entering a title and clicking Next advances to step 2
5. Step 2 has story textarea and tone dropdown
6. Step 3 has drag-drop zone and file picker
7. Loading images shows thumbnails in the grid
8. Step 4 shows a list of files with label inputs; drag to reorder
9. Step 5 shows a summary
10. Clicking Export & Save shows download prompt (or alert if JSZip not loaded)
11. After closing, the project appears in the list
12. Clicking Edit Brief re-opens wizard with saved values
13. Clicking Delete with confirmation removes the card

- [ ] **Step 4: Commit**

```bash
git add styles/shell.css styles/components.css
git commit -m "feat(manager): add manager + wizard CSS"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Project list — create | "+ New Project" button + wizard + `storage.saveBrief` |
| Project list — rename | "Edit Brief" button opens wizard in edit mode |
| Project list — delete | "Delete" button + confirm dialog + `storage.deleteBrief` |
| Project list — open | "Open Editor" button → `router.navigate('editor')` |
| Brief wizard step 1 — title + platform | `_step1HTML` / `_wireStep1` |
| Brief wizard step 2 — story + tone | `_step2HTML` / `_wireStep2` |
| Brief wizard step 3 — load images + drag/drop | `_step3HTML` / `_wireStep3` / `_addFiles` |
| Brief wizard step 4 — review + arrange + labels | `_step4HTML` / `_wireStep4` (drag-to-reorder) |
| Brief wizard step 5 — export package | `_step5HTML` / `_doExportAndSave` |
| image-sheet.jpg generation | `generateImageSheet` in `manager/exporter.js` |
| image-map.md generation | `generateImageMap` in `manager/exporter.js` |
| project-brief.txt generation | `generateProjectBrief` in `manager/exporter.js` |
| Downloadable ZIP | `exportPackage` via JSZip CDN |
| AI manual embedded in brief | `AI_MANUAL_STUB` in `manager/exporter.js` |

**Placeholder scan:** None found.

**Type consistency:** `BriefWizard.open(brief)` receives `null` (new) or `{id, title, platform, story, tone, imageMeta[], createdAt}` (edit). `ProjectList` passes the result of `storage.getBrief(id)` to `wizard.open()`. `exportPackage(brief, files)` receives the same brief shape + a `Map<filename, File>`. Consistent throughout.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-08-project-manager.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
