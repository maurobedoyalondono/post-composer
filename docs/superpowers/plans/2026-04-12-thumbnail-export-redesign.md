# Thumbnail Export & Image Annotation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken image-sheet export with per-frame individual JPEGs, add per-image annotation data (role, story, notes, stats) stored with the project, and enrich both `image-map.md` and `external-brief.md` for AI consumption.

**Architecture:** Extend `imageMeta` items with an `annotation` sub-object; fix `storage.saveBrief` to persist it; add a wizard annotation phase (with shared `ThumbnailStrip`) and a standalone `ImageAnnotator` panel; rewrite the exporter to produce individual images and richer text documents; update two agent skills.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas, IndexedDB (via `imageStore`), `localStorage` (via `storage`), JSZip (loaded globally as `window.JSZip`), browser-based test runner at `tests/runner.html`.

---

## File Map

| Action | File |
|--------|------|
| Modify | `manager/constants.js` — add `ROLES` export |
| Modify | `core/storage.js` — preserve `annotation` in `saveBrief` slim meta |
| Modify | `manager/exporter.js` — rewrite `generateImageMap`; add `generateIndividualImages`, `generateExternalBrief`; update `exportPackage`; remove `generateImageSheet` |
| Modify | `manager/brief-wizard.js` — annotation phase + strip host |
| Modify | `manager/projects.js` — add "Manage Images" button |
| Modify | `manager/shell.js` — create `ImageAnnotator`, wire `onManageImages` |
| Modify | `styles/components.css` — thumbnail strip + annotator styles |
| Modify | `tests/manager/exporter.test.js` — update tests for new format |
| Modify | `tests/runner.html` — register exporter tests |
| Modify | `.claude/skills/post-composer-concept-strategist/SKILL.md` |
| Modify | `.claude/skills/post-composer-color-advisor/SKILL.md` |
| Create | `manager/thumbnail-strip.js` — shared strip component |
| Create | `manager/image-annotator.js` — "Manage Images" panel |

---

## Task 1: Add ROLES constant + fix storage annotation loss

**Files:**
- Modify: `manager/constants.js`
- Modify: `core/storage.js`

- [ ] **Step 1: Add ROLES to constants.js**

In `manager/constants.js`, after the `TONES` array, add:

```js
export const ROLES = [
  { id: '',           label: '(none)' },
  { id: 'opening',    label: 'Opening' },
  { id: 'closing',    label: 'Closing' },
  { id: 'anchor',     label: 'Anchor' },
  { id: 'transition', label: 'Transition' },
  { id: 'silent',     label: 'Silent' },
];
```

- [ ] **Step 2: Fix storage.saveBrief to preserve annotation**

`core/storage.js` line 66 currently slims imageMeta to `{ filename, label }` only, silently dropping `annotation`. Change:

```js
// BEFORE (line 66):
const slimMeta = (imageMeta ?? []).map(({ filename, label }) => ({ filename, label }));

// AFTER:
const slimMeta = (imageMeta ?? []).map(({ filename, label, annotation }) => ({
  filename,
  label,
  ...(annotation ? { annotation } : {}),
}));
```

- [ ] **Step 3: Commit**

```bash
git add manager/constants.js core/storage.js
git commit -m "feat: add ROLES constant; fix storage to persist image annotation"
```

---

## Task 2: Rewrite exporter tests (TDD)

**Files:**
- Modify: `tests/manager/exporter.test.js`

The existing tests assert the old `generateImageMap` table format. Replace them entirely for the new section-based format. The old `generateImageSheet` is going away — remove its tests if any exist.

- [ ] **Step 1: Replace generateImageMap tests**

Replace the entire contents of `tests/manager/exporter.test.js` with:

```js
// tests/manager/exporter.test.js
import { describe, it, assert, assertEqual, assertThrows } from '../test-helper.js';
import { generateImageMap, generateProjectBrief } from '../../manager/exporter.js';

// ---------------------------------------------------------------------------
// generateImageMap (new section-based format)
// ---------------------------------------------------------------------------

describe('generateImageMap', () => {
  it('returns "no images" message for empty array', () => {
    assertEqual(generateImageMap([], 'Test'), 'No images in this project.\n');
  });

  it('returns "no images" for null/undefined', () => {
    assertEqual(generateImageMap(null, 'T'), 'No images in this project.\n');
    assertEqual(generateImageMap(undefined, 'T'), 'No images in this project.\n');
  });

  it('includes project title as h1', () => {
    const result = generateImageMap([{ filename: 'a.jpg', label: 'alpha' }], 'My Series');
    assert(result.startsWith('# Image Map — My Series'), 'should start with h1 title');
  });

  it('generates section header with zero-padded index and label', () => {
    const result = generateImageMap([{ filename: 'a.jpg', label: 'alpha' }], 'P');
    assert(result.includes('## 01 · alpha'), 'should include padded index and label');
  });

  it('includes File and Thumbnail lines', () => {
    const result = generateImageMap([{ filename: 'CC2A1369.jpg', label: 'wide-canyon' }], 'P');
    assert(result.includes('**File:** CC2A1369.jpg'), 'should include File field');
    assert(result.includes('**Thumbnail:** images/01-wide-canyon.jpg'), 'should include Thumbnail path');
  });

  it('omits annotation fields when annotation is absent', () => {
    const result = generateImageMap([{ filename: 'a.jpg', label: 'alpha' }], 'P');
    assert(!result.includes('**Role:**'), 'should omit Role when missing');
    assert(!result.includes('**Notes:**'), 'should omit Notes when missing');
    assert(!result.includes('**Story:**'), 'should omit Story when missing');
    assert(!result.includes('**Stats:**'), 'should omit Stats when missing');
  });

  it('omits annotation fields when values are empty strings', () => {
    const result = generateImageMap([{
      filename: 'a.jpg', label: 'alpha',
      annotation: { role: '', silent: false, notes: '', story: '', stats: '' }
    }], 'P');
    assert(!result.includes('**Role:**'), 'empty role should be omitted');
    assert(!result.includes('**Notes:**'), 'empty notes should be omitted');
  });

  it('includes populated annotation fields', () => {
    const result = generateImageMap([{
      filename: 'a.jpg', label: 'alpha',
      annotation: { role: 'opening', silent: false, notes: 'Great light', story: 'Dawn', stats: '3000m' }
    }], 'P');
    assert(result.includes('**Role:** opening'), 'should include Role');
    assert(result.includes('**Silent:** no'), 'should include Silent no');
    assert(result.includes('**Notes:** Great light'), 'should include Notes');
    assert(result.includes('**Story:** Dawn'), 'should include Story');
    assert(result.includes('**Stats:** 3000m'), 'should include Stats');
  });

  it('shows Silent: yes when silent is true', () => {
    const result = generateImageMap([{
      filename: 'a.jpg', label: 'alpha',
      annotation: { silent: true }
    }], 'P');
    assert(result.includes('**Silent:** yes'), 'should show Silent yes');
  });

  it('pads index to two digits for first and tenth image', () => {
    const images = Array.from({ length: 10 }, (_, i) => ({
      filename: `img${i}.jpg`, label: `img${i}`
    }));
    const result = generateImageMap(images, 'P');
    assert(result.includes('## 01 ·'), 'first image index should be 01');
    assert(result.includes('## 10 ·'), 'tenth image index should be 10');
  });

  it('separates multiple images with blank lines', () => {
    const images = [
      { filename: 'a.jpg', label: 'alpha' },
      { filename: 'b.jpg', label: 'beta' },
    ];
    const result = generateImageMap(images, 'P');
    assert(result.includes('## 01 · alpha'), 'first section');
    assert(result.includes('## 02 · beta'), 'second section');
  });
});

// ---------------------------------------------------------------------------
// generateProjectBrief (unchanged — keep existing tests)
// ---------------------------------------------------------------------------

describe('generateProjectBrief', () => {
  it('includes title, platform, tone in output', () => {
    const brief = {
      title: 'My Project', platform: 'instagram-portrait', tone: 'cinematic',
      story: 'A story.', imageMeta: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    const result = generateProjectBrief(brief, 'Instagram Portrait', 'Cinematic');
    assert(result.includes('My Project'), 'should include title');
    assert(result.includes('Instagram Portrait'), 'should include platformLabel');
    assert(result.includes('Cinematic'), 'should include toneLabel');
  });

  it('includes story with two-space indent', () => {
    const brief = { title: 'T', story: 'Once upon a time.', imageMeta: [], createdAt: Date.now(), updatedAt: Date.now() };
    assert(generateProjectBrief(brief, 'P', 'T').includes('  Once upon a time.'), 'should indent story');
  });

  it('includes image count', () => {
    const brief = { title: 'T', story: 'S', imageMeta: [{ filename: 'a.jpg', label: 'A' }, { filename: 'b.jpg', label: 'B' }], createdAt: Date.now(), updatedAt: Date.now() };
    assert(generateProjectBrief(brief, 'P', 'T').includes('Images: 2'), 'should include count 2');
  });

  it('shows 0 images when imageMeta is missing or null', () => {
    const brief = { title: 'T', story: 'S', createdAt: Date.now(), updatedAt: Date.now() };
    assert(generateProjectBrief(brief, 'P', 'T').includes('Images: 0'), 'missing → 0');
    assert(generateProjectBrief({ ...brief, imageMeta: null }, 'P', 'T').includes('Images: 0'), 'null → 0');
  });

  it('includes ISO dates', () => {
    const ts1 = new Date('2024-06-15T12:00:00.000Z').getTime();
    const ts2 = new Date('2024-07-20T08:30:00.000Z').getTime();
    const result = generateProjectBrief({ title: 'T', story: 'S', imageMeta: [], createdAt: ts1, updatedAt: ts2 }, 'P', 'T');
    assert(result.includes('2024-06-15T12:00:00.000Z'), 'createdAt ISO');
    assert(result.includes('2024-07-20T08:30:00.000Z'), 'updatedAt ISO');
  });

  it('uses "Unknown" when timestamps missing', () => {
    const brief = { title: 'T', story: 'S', imageMeta: [] };
    const result = generateProjectBrief(brief, 'P', 'T');
    const unknownCount = (result.match(/Unknown/g) ?? []).length;
    assertEqual(unknownCount, 2, 'should have two Unknown entries');
  });

  it('throws when brief is null', () => {
    assertThrows(() => generateProjectBrief(null, 'P', 'T'), 'should throw for null brief');
  });
});
```

- [ ] **Step 2: Open runner.html in browser and verify tests fail**

Open `tests/runner.html` in the browser. The `generateImageMap` tests should fail because the function still returns the old table format. Confirm the failure message mentions the missing `# Image Map` header.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/manager/exporter.test.js
git commit -m "test: update exporter tests for new section-based image-map format"
```

---

## Task 3: Rewrite generateImageMap

**Files:**
- Modify: `manager/exporter.js`

- [ ] **Step 1: Replace generateImageMap implementation**

In `manager/exporter.js`, replace the entire `generateImageMap` function:

```js
/**
 * Generate rich Markdown image map — one section per image.
 * @param {Array<{filename: string, label: string, annotation?: object}>} imageMeta
 * @param {string} projectTitle
 * @returns {string}
 */
export function generateImageMap(imageMeta, projectTitle = 'Project') {
  if (!imageMeta || imageMeta.length === 0) {
    return 'No images in this project.\n';
  }

  const pad = (n) => String(n).padStart(2, '0');

  const sections = imageMeta.map((entry, i) => {
    const idx = pad(i + 1);
    const { filename, label, annotation = {} } = entry;
    const { role = '', silent, notes = '', story = '', stats = '' } = annotation;

    const lines = [
      `## ${idx} · ${label}`,
      `**File:** ${filename}`,
      `**Thumbnail:** images/${idx}-${label}.jpg`,
    ];
    if (role)                         lines.push(`**Role:** ${role}`);
    if (typeof silent === 'boolean')  lines.push(`**Silent:** ${silent ? 'yes' : 'no'}`);
    if (notes)                        lines.push(`**Notes:** ${notes}`);
    if (story)                        lines.push(`**Story:** ${story}`);
    if (stats)                        lines.push(`**Stats:** ${stats}`);

    return lines.join('\n');
  });

  return `# Image Map — ${projectTitle}\n\n${sections.join('\n\n')}\n`;
}
```

- [ ] **Step 2: Open runner.html and verify generateImageMap tests now pass**

All `generateImageMap` tests should be green. The `generateProjectBrief` tests should also still pass.

- [ ] **Step 3: Commit**

```bash
git add manager/exporter.js
git commit -m "feat: rewrite generateImageMap to rich per-image section format"
```

---

## Task 4: Add generateIndividualImages

**Files:**
- Modify: `manager/exporter.js`

- [ ] **Step 1: Add generateIndividualImages after generateImageMap**

```js
/**
 * Export each image individually, aspect-ratio preserved, ≤500 KB.
 * @param {Array<{filename: string, label: string, dataUrl: string|null}>} imageMeta
 * @returns {Promise<Array<{name: string, blob: Blob}>>}
 */
export async function generateIndividualImages(imageMeta) {
  if (!imageMeta || imageMeta.length === 0) return [];

  const MAX_SIDE = 1200;
  const pad = (n) => String(n).padStart(2, '0');
  const entries = imageMeta.filter(e => e.dataUrl);

  const results = await Promise.all(
    entries.map((entry, i) =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = async () => {
          const { naturalWidth: w, naturalHeight: h } = img;
          const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          const dw = Math.round(w * scale);
          const dh = Math.round(h * scale);

          const canvas = document.createElement('canvas');
          canvas.width  = dw;
          canvas.height = dh;
          canvas.getContext('2d').drawImage(img, 0, 0, dw, dh);

          const tryBlob = (q) => new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
          let blob = await tryBlob(0.75);
          if (blob && blob.size > 500_000) blob = await tryBlob(0.65);

          const idx  = pad(i + 1);
          const name = `images/${idx}-${entry.label}.jpg`;
          resolve(blob ? { name, blob } : null);
        };
        img.onerror = () => resolve(null);
        img.src = entry.dataUrl;
      })
    )
  );

  return results.filter(Boolean);
}
```

- [ ] **Step 2: Manual verification note**

`generateIndividualImages` requires a browser canvas — it cannot be tested in the existing test runner. Manual verification happens in Task 5 when the full export is exercised.

- [ ] **Step 3: Commit**

```bash
git add manager/exporter.js
git commit -m "feat: add generateIndividualImages with aspect-ratio-preserving canvas export"
```

---

## Task 5: Add generateExternalBrief + update exportPackage

**Files:**
- Modify: `manager/exporter.js`

- [ ] **Step 1: Add generateExternalBrief after generateIndividualImages**

```js
/**
 * Generate self-contained external brief for external AI models.
 * Fetches docs/ai-manual.md via HTTP (app must be served via live-server).
 * @param {object} brief
 * @param {Array}  imageMeta — with annotation fields
 * @param {string} platformLabel
 * @param {string} toneLabel
 * @returns {Promise<string>}
 */
export async function generateExternalBrief(brief, imageMeta, platformLabel, toneLabel) {
  const imageMapContent = generateImageMap(imageMeta, brief.title);

  let manualContent = '[ai-manual.md could not be loaded — attach manually]';
  try {
    const res = await fetch('../docs/ai-manual.md');
    if (res.ok) manualContent = await res.text();
  } catch { /* silent — fallback message is already set */ }

  return (
    `# External Brief — ${brief.title}\n\n` +
    `## Project\n` +
    `- **Title:** ${brief.title}\n` +
    `- **Platform:** ${platformLabel}\n` +
    `- **Tone:** ${toneLabel}\n` +
    `- **Story:** ${brief.story ?? ''}\n\n` +
    `---\n\n` +
    `## Image Map\n\n` +
    `${imageMapContent}\n` +
    `---\n\n` +
    `## AI Design Manual\n\n` +
    `${manualContent}\n`
  );
}
```

- [ ] **Step 2: Replace exportPackage**

Replace the entire `exportPackage` function:

```js
/**
 * Build and trigger download of the ZIP package.
 * @param {object} brief
 * @param {Array}  imageMeta — with dataUrls hydrated from IndexedDB
 * @param {string} platformLabel
 * @param {string} toneLabel
 * @param {string} slug
 * @returns {Promise<void>}
 */
export async function exportPackage(brief, imageMeta, platformLabel, toneLabel, slug) {
  if (!window.JSZip) throw new Error('JSZip not loaded');
  if (!brief) throw new Error('brief is required');

  const zip = new window.JSZip();

  zip.file('project-brief.txt', generateProjectBrief(brief, platformLabel, toneLabel));
  zip.file('image-map.md',      generateImageMap(imageMeta, brief.title));

  const [externalBrief, individualImages] = await Promise.all([
    generateExternalBrief(brief, imageMeta, platformLabel, toneLabel),
    generateIndividualImages(imageMeta),
  ]);

  zip.file('external-brief.md', externalBrief);
  for (const { name, blob } of individualImages) {
    zip.file(name, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href     = url;
  a.download = `${slug}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

- [ ] **Step 3: Remove generateImageSheet**

Delete the `generateImageSheet` function from `exporter.js` entirely (it's replaced by `generateIndividualImages`).

- [ ] **Step 4: Manual smoke test**

Open the app in a browser. Open an existing project with images. Click "Export Package". Verify the downloaded ZIP contains:
- `project-brief.txt` ✓
- `image-map.md` with `## 01 ·` sections ✓
- `external-brief.md` with project info + image map + AI manual content ✓
- `images/01-*.jpg`, `images/02-*.jpg` … with correct aspect ratios ✓
- No `image-sheet.jpg` ✓

- [ ] **Step 5: Commit**

```bash
git add manager/exporter.js
git commit -m "feat: add generateExternalBrief; update exportPackage with individual images and external brief"
```

---

## Task 6: ThumbnailStrip component + styles

**Files:**
- Create: `manager/thumbnail-strip.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Create manager/thumbnail-strip.js**

```js
// manager/thumbnail-strip.js

/**
 * Horizontally scrollable thumbnail strip. Shared by BriefWizard and ImageAnnotator.
 *
 * Usage:
 *   const strip = new ThumbnailStrip(imageMeta, (index) => { ... });
 *   container.appendChild(strip.el);
 *   strip.select(2); // jump to third image
 */
export class ThumbnailStrip {
  /**
   * @param {Array<{label: string, dataUrl: string|null}>} images
   * @param {Function} onSelect — called with (index: number) when a thumbnail is clicked
   */
  constructor(images, onSelect) {
    this._images   = images;
    this._onSelect = onSelect;
    this._current  = 0;

    this.el = document.createElement('div');
    this.el.className = 'thumbnail-strip';
    this._render();
  }

  _render() {
    this.el.innerHTML = '';
    this._images.forEach((img, i) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-strip-item' + (i === this._current ? ' is-active' : '');
      item.dataset.index = i;

      if (img.dataUrl) {
        const image = document.createElement('img');
        image.src = img.dataUrl;
        image.alt = img.label ?? '';
        item.appendChild(image);
      } else {
        item.textContent = String(i + 1);
      }

      item.addEventListener('click', () => {
        this._onSelect(i);
        this.select(i);
      });
      this.el.appendChild(item);
    });
  }

  /**
   * Highlight the thumbnail at the given index and scroll it into view.
   * Does NOT call onSelect — use this for programmatic navigation.
   * @param {number} index
   */
  select(index) {
    this._current = index;
    this.el.querySelectorAll('.thumbnail-strip-item').forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
    });
    const active = this.el.querySelector('.thumbnail-strip-item.is-active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
```

- [ ] **Step 2: Add thumbnail strip styles to styles/components.css**

Append to end of `styles/components.css`:

```css
/* ── Thumbnail Strip (wizard + annotator) ── */
.thumbnail-strip {
  display: flex;
  flex-direction: row;
  gap: 4px;
  overflow-x: auto;
  padding: 8px 18px;
  border-bottom: 1px solid var(--color-border);
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.thumbnail-strip-item {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  overflow: hidden;
  cursor: pointer;
  background: var(--color-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text-muted);
  transition: border-color 0.1s;
}

.thumbnail-strip-item:hover {
  border-color: var(--color-accent-2);
}

.thumbnail-strip-item.is-active {
  border-color: var(--color-accent);
}

.thumbnail-strip-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 3: Commit**

```bash
git add manager/thumbnail-strip.js styles/components.css
git commit -m "feat: add ThumbnailStrip component with styles"
```

---

## Task 7: Wizard annotation phase

**Files:**
- Modify: `manager/brief-wizard.js`

- [ ] **Step 1: Add imports at top of brief-wizard.js**

Add these two imports after the existing imports:

```js
import { ROLES } from './constants.js';
import { ThumbnailStrip } from './thumbnail-strip.js';
```

- [ ] **Step 2: Add annotation state + strip host to constructor**

In the `BriefWizard` constructor, after the existing dialog HTML assignment, add the strip host element and annotation state. The constructor currently sets `this._dialog.innerHTML = \`...\``. Add a `.wizard-strip-host` div between header and body by modifying the innerHTML template:

```js
this._dialog.innerHTML = `
  <div class="wizard-header">
    <span class="wizard-step-indicator">Step 1 of 5</span>
    <button class="wizard-close" aria-label="Close">&#x2715;</button>
  </div>
  <div class="wizard-strip-host" hidden></div>
  <div class="wizard-body"></div>
  <div class="wizard-footer">
    <button class="wizard-back">Back</button>
    <button class="wizard-next">Next</button>
  </div>
`;
```

Then after the existing `this._closeBtn` cache line, add:

```js
this._stripHostEl   = this._dialog.querySelector('.wizard-strip-host');
this._annotating    = false;
this._annotationIndex = 0;
this._strip         = null;
```

- [ ] **Step 3: Modify _renderStep to delegate to _renderAnnotation**

At the top of `_renderStep()`, add the annotation guard before the existing switch:

```js
_renderStep() {
  if (this._annotating) {
    this._renderAnnotation();
    return;
  }
  this._indicatorEl.textContent = `Step ${this._step} of 5`;
  this._backBtn.hidden = (this._step === 1);
  this._nextBtn.textContent = (this._step === 5) ? 'Next' : 'Next';

  switch (this._step) {
    case 1: this._renderStep1(); break;
    case 2: this._renderStep2(); break;
    case 3: this._renderStep3(); break;
    case 4: this._renderStep4(); break;
    case 5: this._renderStep5(); break;
  }
}
```

Note: step 5 Next text stays "Next" — it transitions to annotation mode rather than saving directly (for new briefs). Edit mode (openEdit) never reaches annotation.

- [ ] **Step 4: Modify _goNext to handle annotation mode**

Replace the entire `_goNext` method:

```js
async _goNext() {
  // ── Annotation mode ──────────────────────────────────────────────────
  if (this._annotating) {
    this._captureAnnotation();

    if (this._annotationIndex < this._data.imageMeta.length - 1) {
      this._annotationIndex++;
      this._strip.select(this._annotationIndex);
      this._renderAnnotation();
    } else {
      // All images annotated — save
      this._nextBtn.disabled = true;
      try {
        await this._save();
      } catch (err) {
        const errorEl = document.createElement('div');
        errorEl.className = 'wizard-error';
        errorEl.textContent = `Save failed: ${err.message}`;
        this._bodyEl.appendChild(errorEl);
      } finally {
        this._nextBtn.disabled = false;
      }
    }
    return;
  }

  // ── Normal wizard steps ───────────────────────────────────────────────
  if (!this._validateStep()) return;
  this._captureStep();

  if (this._step === 5) {
    this._nextBtn.disabled = true;
    try {
      await this._transitionToAnnotation();
    } catch (err) {
      const errorEl = this._bodyEl.querySelector('.wizard-error');
      if (errorEl) { errorEl.textContent = `Error: ${err.message}`; errorEl.hidden = false; }
    } finally {
      this._nextBtn.disabled = false;
    }
  } else {
    this._step += 1;
    this._renderStep();
  }
}
```

- [ ] **Step 5: Modify _goBack to handle annotation mode**

Replace the entire `_goBack` method:

```js
_goBack() {
  if (this._annotating) {
    if (this._annotationIndex > 0) {
      this._captureAnnotation();
      this._annotationIndex--;
      this._strip.select(this._annotationIndex);
      this._renderAnnotation();
    }
    return;
  }
  if (this._step <= 1) return;
  this._captureStep();
  this._step -= 1;
  this._renderStep();
}
```

- [ ] **Step 6: Add _transitionToAnnotation method**

Add after `_goBack`:

```js
async _transitionToAnnotation() {
  const fileInput = this._bodyEl.querySelector('input[type="file"]');
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    this._data.imageMeta = await readFiles(fileInput.files);
  }

  const images = this._data.imageMeta ?? [];
  if (images.length === 0) {
    // No images — save directly (edit scenario or no files chosen)
    await this._save();
    return;
  }

  // Enter annotation mode
  this._annotating     = true;
  this._annotationIndex = 0;

  this._strip = new ThumbnailStrip(images, (i) => {
    this._captureAnnotation();
    this._annotationIndex = i;
    this._renderAnnotation();
  });

  this._stripHostEl.innerHTML = '';
  this._stripHostEl.appendChild(this._strip.el);
  this._stripHostEl.hidden = false;

  this._renderAnnotation();
}
```

- [ ] **Step 7: Add _renderAnnotation method**

Add after `_transitionToAnnotation`:

```js
_renderAnnotation() {
  const images = this._data.imageMeta ?? [];
  const total  = images.length;
  const entry  = images[this._annotationIndex] ?? {};
  const ann    = entry.annotation ?? {};

  this._indicatorEl.textContent = `Image ${this._annotationIndex + 1} of ${total}`;
  this._backBtn.hidden = false;
  this._nextBtn.textContent = (this._annotationIndex === total - 1) ? 'Save' : 'Next';

  const roleOptions = ROLES.map(r =>
    `<option value="${r.id}" ${ann.role === r.id ? 'selected' : ''}>${r.label}</option>`
  ).join('');

  this._bodyEl.innerHTML = `
    <div class="wizard-annotation-meta">${entry.filename ?? ''} · ${entry.label ?? ''}</div>
    ${entry.dataUrl
      ? `<img class="wizard-annotation-preview" src="${entry.dataUrl}" alt="${entry.label ?? ''}">`
      : ''}
    <div class="wizard-annotation-fields">
      <div class="wizard-annotation-row">
        <label class="wizard-annotation-label">Role
          <select class="ann-role">${roleOptions}</select>
        </label>
        <label class="wizard-annotation-silent">
          <input type="checkbox" class="ann-silent" ${ann.silent ? 'checked' : ''}>
          Silent (no text overlay)
        </label>
      </div>
      <label class="wizard-annotation-label">Notes
        <textarea class="wizard-textarea ann-notes" rows="2" placeholder="Why this image matters, photographer intent...">${ann.notes ?? ''}</textarea>
      </label>
      <label class="wizard-annotation-label">Story
        <textarea class="wizard-textarea ann-story" rows="2" placeholder="How/when captured, context...">${ann.story ?? ''}</textarea>
      </label>
      <label class="wizard-annotation-label">Stats
        <input type="text" class="wizard-input ann-stats" placeholder="Any data or numbers to feature..." value="${ann.stats ?? ''}">
      </label>
    </div>
  `;

  // Auto-check silent when role = 'silent'
  const roleEl   = this._bodyEl.querySelector('.ann-role');
  const silentEl = this._bodyEl.querySelector('.ann-silent');
  roleEl.addEventListener('change', () => {
    if (roleEl.value === 'silent') silentEl.checked = true;
  });
}
```

- [ ] **Step 8: Add _captureAnnotation method**

Add after `_renderAnnotation`:

```js
_captureAnnotation() {
  const images = this._data.imageMeta ?? [];
  const entry  = images[this._annotationIndex];
  if (!entry) return;

  entry.annotation = {
    role:   this._bodyEl.querySelector('.ann-role')?.value   ?? '',
    silent: this._bodyEl.querySelector('.ann-silent')?.checked ?? false,
    notes:  this._bodyEl.querySelector('.ann-notes')?.value  ?? '',
    story:  this._bodyEl.querySelector('.ann-story')?.value  ?? '',
    stats:  this._bodyEl.querySelector('.ann-stats')?.value  ?? '',
  };
}
```

- [ ] **Step 9: Reset annotation state in open() and openEdit()**

In `open()`, add after `this._data = {}`:
```js
this._annotating      = false;
this._annotationIndex = 0;
this._strip           = null;
this._stripHostEl.hidden = true;
```

In `openEdit()`, add after `this._data = { ... }`:
```js
this._annotating      = false;
this._annotationIndex = 0;
this._strip           = null;
this._stripHostEl.hidden = true;
```

- [ ] **Step 10: Add wizard annotation styles to styles/components.css**

Append to end of `styles/components.css`:

```css
/* ── Wizard Annotation Phase ── */
.wizard-strip-host {
  border-bottom: 1px solid var(--color-border);
}

.wizard-annotation-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.wizard-annotation-preview {
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  display: block;
  margin-bottom: 8px;
}

.wizard-annotation-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-annotation-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.wizard-annotation-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  flex: 1;
}

.wizard-annotation-label select {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 5px 8px;
}

.wizard-annotation-silent {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.wizard-annotation-silent input[type="checkbox"] {
  accent-color: var(--color-accent);
  cursor: pointer;
}
```

- [ ] **Step 11: Manual smoke test**

Open the app. Create a new project with 2–3 images. Verify:
- After step 5 Next, the thumbnail strip appears with all images
- Clicking a thumbnail jumps to that image's annotation screen
- Filling in Role/Notes/Story/Stats and clicking Next moves to next image
- On the last image, clicking Save saves the project and closes
- Re-opening the project in editor shows images loaded correctly

- [ ] **Step 12: Commit**

```bash
git add manager/brief-wizard.js styles/components.css
git commit -m "feat: add per-image annotation phase to BriefWizard with ThumbnailStrip"
```

---

## Task 8: ImageAnnotator panel

**Files:**
- Create: `manager/image-annotator.js`
- Modify: `styles/components.css`

- [ ] **Step 1: Create manager/image-annotator.js**

```js
// manager/image-annotator.js
import { storage }    from '../core/storage.js';
import { imageStore } from '../core/image-store.js';
import { ROLES }      from './constants.js';
import { ThumbnailStrip } from './thumbnail-strip.js';

/**
 * Modal panel for editing per-image annotations after a project is created.
 * Opened via the "Manage Images" button on a project card.
 * Changes persist to storage on every field change (auto-save).
 */
export class ImageAnnotator {
  /** @param {HTMLElement} container — element to append the <dialog> to */
  constructor(container) {
    this._briefId      = null;
    this._imageMeta    = [];
    this._currentIndex = 0;
    this._strip        = null;

    this._dialog = document.createElement('dialog');
    this._dialog.className = 'image-annotator';
    this._dialog.innerHTML = `
      <div class="annotator-header">
        <span class="annotator-title">Manage Images</span>
        <button class="annotator-close" aria-label="Close">&#x2715;</button>
      </div>
      <div class="annotator-strip-host"></div>
      <div class="annotator-body"></div>
    `;
    container.appendChild(this._dialog);

    this._titleEl    = this._dialog.querySelector('.annotator-title');
    this._stripHost  = this._dialog.querySelector('.annotator-strip-host');
    this._bodyEl     = this._dialog.querySelector('.annotator-body');

    this._dialog.querySelector('.annotator-close')
      .addEventListener('click', () => this._dialog.close());
  }

  /**
   * Open the panel for a given project.
   * @param {string} briefId
   */
  async open(briefId) {
    this._briefId = briefId;
    const brief   = storage.getBrief(briefId);
    if (!brief || !brief.imageMeta || brief.imageMeta.length === 0) return;

    this._titleEl.textContent = `Manage Images — ${brief.title}`;

    const stored = await imageStore.load(briefId);
    this._imageMeta = brief.imageMeta.map(m => ({
      ...m,
      dataUrl: stored[m.filename] ?? null,
    }));

    this._currentIndex = 0;

    this._strip = new ThumbnailStrip(this._imageMeta, (i) => {
      this._saveCurrentAnnotation();
      this._currentIndex = i;
      this._render();
    });

    this._stripHost.innerHTML = '';
    this._stripHost.appendChild(this._strip.el);

    this._render();
    this._dialog.showModal();
  }

  _render() {
    const entry = this._imageMeta[this._currentIndex];
    if (!entry) return;

    const ann = entry.annotation ?? {};
    const roleOptions = ROLES.map(r =>
      `<option value="${r.id}" ${ann.role === r.id ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    this._bodyEl.innerHTML = `
      <div class="annotator-image-meta">${entry.filename} · ${entry.label}</div>
      ${entry.dataUrl
        ? `<img class="annotator-preview" src="${entry.dataUrl}" alt="${entry.label}">`
        : '<div class="annotator-no-preview">No preview available</div>'}
      <div class="annotator-fields">
        <div class="annotator-row">
          <label class="annotator-field-label">Role
            <select class="ann-role">${roleOptions}</select>
          </label>
          <label class="annotator-silent-label">
            <input type="checkbox" class="ann-silent" ${ann.silent ? 'checked' : ''}>
            Silent (no text overlay)
          </label>
        </div>
        <label class="annotator-field-label">Notes
          <textarea class="annotator-textarea ann-notes" rows="3" placeholder="Why this image matters, photographer intent...">${ann.notes ?? ''}</textarea>
        </label>
        <label class="annotator-field-label">Story
          <textarea class="annotator-textarea ann-story" rows="3" placeholder="How/when captured, context...">${ann.story ?? ''}</textarea>
        </label>
        <label class="annotator-field-label">Stats
          <input type="text" class="annotator-input ann-stats" placeholder="Any data or numbers to feature..." value="${ann.stats ?? ''}">
        </label>
      </div>
    `;

    const roleEl   = this._bodyEl.querySelector('.ann-role');
    const silentEl = this._bodyEl.querySelector('.ann-silent');

    roleEl.addEventListener('change', () => {
      if (roleEl.value === 'silent') silentEl.checked = true;
      this._saveCurrentAnnotation();
    });

    silentEl.addEventListener('change', () => this._saveCurrentAnnotation());

    this._bodyEl.querySelectorAll('.ann-notes, .ann-story, .ann-stats').forEach(el => {
      el.addEventListener('change', () => this._saveCurrentAnnotation());
    });
  }

  _saveCurrentAnnotation() {
    const entry = this._imageMeta[this._currentIndex];
    if (!entry) return;

    entry.annotation = {
      role:   this._bodyEl.querySelector('.ann-role')?.value   ?? '',
      silent: this._bodyEl.querySelector('.ann-silent')?.checked ?? false,
      notes:  this._bodyEl.querySelector('.ann-notes')?.value  ?? '',
      story:  this._bodyEl.querySelector('.ann-story')?.value  ?? '',
      stats:  this._bodyEl.querySelector('.ann-stats')?.value  ?? '',
    };

    const brief = storage.getBrief(this._briefId);
    if (!brief) return;

    // Strip dataUrl before saving to localStorage
    brief.imageMeta = this._imageMeta.map(({ dataUrl: _omit, ...rest }) => rest);
    storage.saveBrief(brief);
  }
}
```

- [ ] **Step 2: Add ImageAnnotator styles to styles/components.css**

Append to end of `styles/components.css`:

```css
/* ── Image Annotator Panel ── */
.image-annotator {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0;
  max-width: 560px;
  width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
  font-family: var(--font-sans);
}

.image-annotator::backdrop {
  background: rgba(0, 0, 0, 0.65);
}

.annotator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 1;
}

.annotator-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.annotator-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: color 0.1s, background 0.1s;
}

.annotator-close:hover {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.annotator-strip-host {
  border-bottom: 1px solid var(--color-border);
}

.annotator-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.annotator-image-meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.annotator-preview {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  display: block;
}

.annotator-no-preview {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-surface-2);
  border-radius: var(--radius-sm);
}

.annotator-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.annotator-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.annotator-field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  flex: 1;
}

.annotator-field-label select {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 5px 8px;
}

.annotator-textarea {
  width: 100%;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 6px 8px;
  resize: vertical;
  min-height: 70px;
  transition: border-color 0.1s;
}

.annotator-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.annotator-input {
  width: 100%;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 6px 8px;
  transition: border-color 0.1s;
}

.annotator-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.annotator-silent-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
  padding-bottom: 2px;
}

.annotator-silent-label input[type="checkbox"] {
  accent-color: var(--color-accent);
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add manager/image-annotator.js styles/components.css
git commit -m "feat: add ImageAnnotator panel with auto-save and thumbnail strip"
```

---

## Task 9: Wire ImageAnnotator to projects.js + shell.js

**Files:**
- Modify: `manager/projects.js`
- Modify: `manager/shell.js`

- [ ] **Step 1: Add "Manage Images" button to project card in projects.js**

In the `card.innerHTML` template in `projects.js`, add the button to `.project-card-actions`:

```js
// BEFORE:
`<div class="project-card-actions">
  <button class="btn btn-primary btn-open"   data-id="${escHtml(brief.id)}">Open in Editor</button>
  <button class="btn btn-secondary btn-edit"   data-id="${escHtml(brief.id)}">Edit Brief</button>
  <button class="btn btn-secondary btn-export" data-id="${escHtml(brief.id)}">Export Package</button>
  <button class="btn btn-danger btn-delete"  data-id="${escHtml(brief.id)}">Delete</button>
</div>`

// AFTER:
`<div class="project-card-actions">
  <button class="btn btn-primary btn-open"     data-id="${escHtml(brief.id)}">Open in Editor</button>
  <button class="btn btn-secondary btn-edit"   data-id="${escHtml(brief.id)}">Edit Brief</button>
  <button class="btn btn-secondary btn-manage" data-id="${escHtml(brief.id)}">Manage Images</button>
  <button class="btn btn-secondary btn-export" data-id="${escHtml(brief.id)}">Export Package</button>
  <button class="btn btn-danger btn-delete"    data-id="${escHtml(brief.id)}">Delete</button>
</div>`
```

- [ ] **Step 2: Add btn-manage handler in projects.js click delegation**

In the `_handleClick` event delegation block in `projects.js`, add after the `btn-edit` block:

```js
} else if (btn.classList.contains('btn-manage')) {
  if (this.deps.onManageImages) {
    this.deps.onManageImages(id);
  }
```

- [ ] **Step 3: Update ProjectList constructor JSDoc in projects.js**

In the `@param {object} deps` JSDoc block, add:
```js
 * @param {Function}    [deps.onManageImages]         — called with briefId when user clicks "Manage Images"
```

- [ ] **Step 4: Import and wire ImageAnnotator in shell.js**

Add import at top of `manager/shell.js`:
```js
import { ImageAnnotator } from './image-annotator.js';
```

In `mountManager`, after the `let projectList;` forward-declaration, create the annotator:

```js
const annotatorHost = document.createElement('div');
root.appendChild(annotatorHost);
const annotator = new ImageAnnotator(annotatorHost);
```

Then in the `ProjectList` constructor call, add `onManageImages`:

```js
projectList = new ProjectList(listEl, {
  wizard,
  onOpenEditor: (briefId) => { ... },
  onManageImages: (briefId) => {
    annotator.open(briefId);
  },
  onExport: async (brief) => { ... },
  getCurrentProjectId: () => state.activeBriefId,
  onProjectDeleted: (deletedId) => { ... },
});
```

- [ ] **Step 5: Manual smoke test**

Open the app. Open an existing project with images. Click "Manage Images". Verify:
- Panel opens with thumbnail strip showing all images
- Clicking a thumbnail switches to that image's form
- Filling in fields and clicking away (blur/change) saves immediately
- Closing and reopening the panel shows saved annotations
- Exporting the project includes annotations in `image-map.md`

- [ ] **Step 6: Commit**

```bash
git add manager/projects.js manager/shell.js
git commit -m "feat: wire ImageAnnotator to project cards via Manage Images button"
```

---

## Task 10: Register exporter tests in runner.html

**Files:**
- Modify: `tests/runner.html`

- [ ] **Step 1: Add exporter import to runner.html**

In `tests/runner.html`, add before the `summary()` call:

```html
import './manager/exporter.test.js';
```

The full script block should look like:
```html
<script type="module">
  import { summary } from './test-helper.js';
  import './core/state.test.js';
  import './core/events.test.js';
  import './core/router.test.js';
  import './core/storage.test.js';
  import './core/storage-briefs.test.js';
  import './core/project-store.test.js';
  import './shared/validator.test.js';
  import './editor/frame-manager.test.js';
  import './editor/frame-manager-diff.test.js';
  import './editor/layers.test.js';
  import './editor/layers-bounds.test.js';
  import './editor/layer-manager.test.js';
  import './editor/analysis.test.js';
  import './editor/drag-resize.test.js';
  import './editor/color-wheel-analysis.test.js';
  import './manager/exporter.test.js';
  summary();
</script>
```

- [ ] **Step 2: Open runner.html and verify all tests pass**

Open `tests/runner.html` in the browser. All tests including the new `generateImageMap` and `generateProjectBrief` tests should be green.

- [ ] **Step 3: Commit**

```bash
git add tests/runner.html
git commit -m "test: register exporter tests in runner.html"
```

---

## Task 11: Update Concept Strategist skill

**Files:**
- Modify: `.claude/skills/post-composer-concept-strategist/SKILL.md`

- [ ] **Step 1: Replace image read instructions**

In `.claude/skills/post-composer-concept-strategist/SKILL.md`, find the "Read before anything else" section and replace:

```markdown
## Read before anything else

In this order:

1. **`[INPUTS_PATH]/project-brief.txt`** — the photographer's story, tone, platform, and any notes. This is your primary source. Do not invent any detail not present here.
2. **`[INPUTS_PATH]/image-map.md`** — the table of `frame | raw_filename | descriptive_label`. This is the authoritative frame sequence in the order the photographer arranged it.
3. **`[INPUTS_PATH]/image-sheet.jpg`** — the thumbnail grid. Study each frame's visual content: subject, composition, mood, what the photograph communicates.

Confirm all three are read before continuing.
```

With:

```markdown
## Read before anything else

In this order:

1. **`[INPUTS_PATH]/project-brief.txt`** — the photographer's story, tone, platform, and any notes. This is your primary source. Do not invent any detail not present here.
2. **`[INPUTS_PATH]/image-map.md`** — rich per-image sections. Each section contains the filename, label, thumbnail path, and optional annotation fields: role, silent flag, notes (photographer's intent), story (capture context), and stats (data to feature). This is the authoritative frame sequence in the order the photographer arranged it.
3. **`[INPUTS_PATH]/images/`** — individual image files named `NN-label.jpg`. Read them in sequence to study each frame's visual content: subject, composition, mood, what the photograph communicates.

Confirm all three are read before continuing.
```

- [ ] **Step 2: Update annotation guidance in "Your role" section**

After the existing "Your role" paragraph, add:

```markdown
### Using image annotations

The `image-map.md` may contain per-image annotations from the photographer. Use these as **guidance, not constraints** — they reflect photographer intent but you are free to propose improvements:

- **role** (opening/closing/anchor/transition/silent) — suggests narrative position; a `silent` role is a strong candidate for the silence map
- **silent flag** — strong signal this frame should carry no text overlay
- **notes** — photographer's stated intent for this image; use this to strengthen your viewer journey prose
- **story** — capture context (time, conditions, circumstance); include as "confirmed facts" if verifiable
- **stats** — data or numbers the photographer wants to feature; treat as confirmed facts

If annotations are absent or sparse, proceed as normal — the images and brief are sufficient.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/post-composer-concept-strategist/SKILL.md
git commit -m "feat: update Concept Strategist to read individual images and rich image-map"
```

---

## Task 12: Update Color Advisor skill

**Files:**
- Modify: `.claude/skills/post-composer-color-advisor/SKILL.md`

- [ ] **Step 1: Replace image read instruction**

In `.claude/skills/post-composer-color-advisor/SKILL.md`, find the "Read before anything else" section and replace:

```markdown
## Read before anything else

1. **`[CREATIVE_BRIEF_PATH]`** — palette hex codes and roles, per-frame zone and text layer specs, silence map.
2. **`[INPUTS_PATH]/image-sheet.jpg`** — the thumbnail grid. You will assess text zones from these thumbnails.
```

With:

```markdown
## Read before anything else

1. **`[CREATIVE_BRIEF_PATH]`** — palette hex codes and roles, per-frame zone and text layer specs, silence map.
2. **`[INPUTS_PATH]/image-map.md`** — read to get the filename label for each frame (e.g. `01-wide-canyon.jpg`).
3. **Per-frame individual images** — for each text frame you assess, read `[INPUTS_PATH]/images/NN-label.jpg` directly. Individual files give accurate zone assessment without the distortion of a cropped grid cell.
```

- [ ] **Step 2: Update per-frame analysis instruction**

In the "Per-frame analysis" section, find:

```markdown
1. Locate the frame's thumbnail in `image-sheet.jpg`
```

Replace with:

```markdown
1. Read the frame's individual image from `[INPUTS_PATH]/images/NN-label.jpg` (use `image-map.md` to look up the correct filename for this frame)
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/post-composer-color-advisor/SKILL.md
git commit -m "feat: update Color Advisor to read individual frame images instead of image-sheet"
```

---

## Final verification

- [ ] Open `tests/runner.html` — all tests green
- [ ] Create a new project with 3+ images — wizard flows through annotation screens, strip is jumpable
- [ ] Open "Manage Images" on the project card — panel opens, annotations editable, auto-saves
- [ ] Export the project — ZIP contains `image-map.md` with sections, `external-brief.md` with manual, `images/` folder with individual JPEGs, no `image-sheet.jpg`
- [ ] Check image aspect ratios in the exported thumbnails — no square cropping
