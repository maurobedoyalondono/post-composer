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
