// tests/manager/exporter.test.js
import { describe, it, assert, assertEqual, assertThrows } from '../test-helper.js';
import { generateImageMap, generateProjectBrief } from '../../manager/exporter.js';

// ---------------------------------------------------------------------------
// generateImageMap
// ---------------------------------------------------------------------------

describe('generateImageMap', () => {
  it('returns "no images" message for empty array', () => {
    const result = generateImageMap([]);
    assertEqual(result, 'No images in this project.\n');
  });

  it('returns "no images" message for null/undefined', () => {
    assertEqual(generateImageMap(null), 'No images in this project.\n');
    assertEqual(generateImageMap(undefined), 'No images in this project.\n');
  });

  it('returns a markdown table with header, separator, and row for one image', () => {
    const result = generateImageMap([{ filename: 'photo.jpg', label: 'Sunset' }]);
    assert(result.includes('| Filename | Label |'), 'should include table header');
    assert(result.includes('| -------- | ----- |'), 'should include table separator');
    assert(result.includes('photo.jpg'), 'should include filename in row');
    assert(result.includes('Sunset'), 'should include label in row');
  });

  it('returns one row per image', () => {
    const images = [
      { filename: 'a.jpg', label: 'Alpha' },
      { filename: 'b.jpg', label: 'Beta' },
      { filename: 'c.jpg', label: 'Gamma' },
    ];
    const result = generateImageMap(images);
    const lines = result.trim().split('\n');
    // header + separator + 3 rows = 5 lines
    assertEqual(lines.length, 5, 'should have header, separator, and one row per image');
    assert(lines[2].includes('a.jpg'), 'first row should include first filename');
    assert(lines[3].includes('b.jpg'), 'second row should include second filename');
    assert(lines[4].includes('c.jpg'), 'third row should include third filename');
  });

  it('escapes pipe characters in filename and label', () => {
    const result = generateImageMap([{ filename: 'a|b.jpg', label: 'c|d' }]);
    assert(result.includes('a\\|b.jpg'), 'should escape pipe in filename');
    assert(result.includes('c\\|d'), 'should escape pipe in label');
  });
});

// ---------------------------------------------------------------------------
// generateProjectBrief
// ---------------------------------------------------------------------------

describe('generateProjectBrief', () => {
  it('includes title, platform, tone in output', () => {
    const brief = {
      title: 'My Project',
      platform: 'instagram-portrait',
      tone: 'cinematic',
      story: 'A story.',
      imageMeta: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = generateProjectBrief(brief, 'Instagram Portrait', 'Cinematic');
    assert(result.includes('My Project'), 'should include title');
    assert(result.includes('Instagram Portrait'), 'should include platformLabel');
    assert(result.includes('Cinematic'), 'should include toneLabel');
  });

  it('includes story with two-space indent in output', () => {
    const brief = {
      title: 'T',
      story: 'Once upon a time in the mountains.',
      imageMeta: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = generateProjectBrief(brief, 'Platform', 'Tone');
    assert(result.includes('  Once upon a time in the mountains.'), 'should include indented story text');
  });

  it('includes image count', () => {
    const brief = {
      title: 'T',
      story: 'S',
      imageMeta: [
        { filename: 'a.jpg', label: 'A' },
        { filename: 'b.jpg', label: 'B' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = generateProjectBrief(brief, 'P', 'T');
    assert(result.includes('Images: 2'), 'should include image count of 2');
  });

  it('shows 0 images when imageMeta is missing or not an array', () => {
    const brief = { title: 'T', story: 'S', createdAt: Date.now(), updatedAt: Date.now() };
    assert(generateProjectBrief(brief, 'P', 'T').includes('Images: 0'), 'missing imageMeta should give count 0');
    const brief2 = { ...brief, imageMeta: null };
    assert(generateProjectBrief(brief2, 'P', 'T').includes('Images: 0'), 'null imageMeta should give count 0');
  });

  it('includes ISO date strings for createdAt and updatedAt', () => {
    const ts1 = new Date('2024-06-15T12:00:00.000Z').getTime();
    const ts2 = new Date('2024-07-20T08:30:00.000Z').getTime();
    const brief = { title: 'T', story: 'S', imageMeta: [], createdAt: ts1, updatedAt: ts2 };
    const result = generateProjectBrief(brief, 'P', 'T');
    assert(result.includes('2024-06-15T12:00:00.000Z'), 'should include createdAt ISO string');
    assert(result.includes('2024-07-20T08:30:00.000Z'), 'should include updatedAt ISO string');
  });

  it('uses "Unknown" when createdAt is missing', () => {
    const brief = { title: 'T', story: 'S', imageMeta: [], updatedAt: Date.now() };
    const result = generateProjectBrief(brief, 'P', 'T');
    assert(result.includes('Created:'), 'should include Created label');
    assert(result.includes('Unknown'), 'should show Unknown for missing createdAt');
  });

  it('uses "Unknown" when updatedAt is missing', () => {
    const brief = { title: 'T', story: 'S', imageMeta: [], createdAt: Date.now() };
    const result = generateProjectBrief(brief, 'P', 'T');
    assert(result.includes('Updated:'), 'should include Updated label');
    assert(result.includes('Unknown'), 'should show Unknown for missing updatedAt');
  });

  it('throws when brief is null', () => {
    assertThrows(() => generateProjectBrief(null, 'P', 'T'), 'should throw for null brief');
  });
});
