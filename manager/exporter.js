// manager/exporter.js

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

/**
 * Export each image individually, aspect-ratio preserved, ≤500 KB.
 * @param {Array<{filename: string, label: string, dataUrl: string|null}>} imageMeta
 * @returns {Promise<Array<{name: string, blob: Blob}>>}
 */
export async function generateIndividualImages(imageMeta) {
  if (!imageMeta || imageMeta.length === 0) return [];

  const MAX_SIDE = 1200;
  const pad = (n) => String(n).padStart(2, '0');

  const results = await Promise.all(
    imageMeta
      .map((entry, i) => ({ entry, i }))
      .filter(({ entry }) => entry.dataUrl)
      .map(({ entry, i }) =>
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
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0, dw, dh);

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

/**
 * Generate plain-text project brief.
 * @param {object} brief          — full brief object from storage.getBrief()
 *   Fields: id, title, platform, story, tone, imageMeta[], createdAt, updatedAt
 * @param {string} platformLabel  — human-readable platform name (e.g. 'Instagram Portrait')
 * @param {string} toneLabel      — human-readable tone name (e.g. 'Cinematic')
 * @returns {string} plain text
 */
export function generateProjectBrief(brief, platformLabel, toneLabel) {
  const imageCount = Array.isArray(brief.imageMeta) ? brief.imageMeta.length : 0;
  const created    = brief.createdAt ? new Date(brief.createdAt).toISOString() : 'Unknown';
  const updated    = brief.updatedAt ? new Date(brief.updatedAt).toISOString() : 'Unknown';

  return (
    'Post-Composer Project Brief\n' +
    '===========================\n' +
    `Title:    ${brief.title}\n` +
    `Platform: ${platformLabel}\n` +
    `Tone:     ${toneLabel}\n` +
    'Story:\n' +
    `  ${brief.story}\n` +
    '\n' +
    `Images: ${imageCount}\n` +
    `Created:  ${created}\n` +
    `Updated:  ${updated}\n`
  );
}

/**
 * Render image grid to a canvas and return as a Blob.
 * @param {Array<{filename: string, label: string, dataUrl: string}>} imageMeta
 * @returns {Promise<Blob|null>}
 */
export async function generateImageSheet(imageMeta) {
  if (!imageMeta || imageMeta.length === 0) {
    return null;
  }

  // Filter to entries that actually have a dataUrl
  const entries = imageMeta.filter(entry => entry.dataUrl);
  if (entries.length === 0) {
    return null;
  }

  const CELL      = 300;
  const MAX_COLS  = 4;
  const COLS      = Math.min(entries.length, MAX_COLS);
  const ROWS      = Math.ceil(entries.length / MAX_COLS);
  const canvas    = document.createElement('canvas');
  canvas.width    = COLS * CELL;
  canvas.height   = ROWS * CELL;
  const ctx       = canvas.getContext('2d');

  // Load all images (resolve even on error so we draw every cell)
  const images = await Promise.all(
    entries.map(
      (entry, index) =>
        new Promise(resolve => {
          const img = new Image();
          img.onload  = () => resolve({ img, index });
          img.onerror = () => resolve({ img: null, index });
          img.src = entry.dataUrl;
        })
    )
  );

  for (const { img, index } of images) {
    const col = index % MAX_COLS;
    const row = Math.floor(index / MAX_COLS);
    const x   = col * CELL;
    const y   = row * CELL;

    if (!img) {
      // Failed to load — fill with dark gray
      ctx.fillStyle = '#333333';
      ctx.fillRect(x, y, CELL, CELL);
      continue;
    }

    // Cover-crop: scale to fill the cell, centering the image
    const scale  = Math.max(CELL / img.naturalWidth, CELL / img.naturalHeight);
    const sw     = CELL / scale;           // source width  in image pixels
    const sh     = CELL / scale;           // source height in image pixels
    const sx     = (img.naturalWidth  - sw) / 2;
    const sy     = (img.naturalHeight - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, x, y, CELL, CELL);
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
  });
}

/**
 * Build and trigger download of the ZIP package.
 * @param {object} brief         — full brief from storage
 * @param {Array}  imageMeta     — same as above (with dataUrls)
 * @param {string} platformLabel
 * @param {string} toneLabel
 * @param {string} slug          — filename-safe project slug (no extension)
 * @returns {Promise<void>}
 */
export async function exportPackage(brief, imageMeta, platformLabel, toneLabel, slug) {
  if (!window.JSZip) throw new Error('JSZip not loaded');
  if (!brief) throw new Error('brief is required');

  const zip = new window.JSZip();

  // Add text files
  zip.file('image-map.md',       generateImageMap(imageMeta));
  zip.file('project-brief.txt',  generateProjectBrief(brief, platformLabel, toneLabel));

  // Optionally add the image sheet
  const imageBlob = await generateImageSheet(imageMeta);
  if (imageBlob !== null) {
    zip.file('image-sheet.jpg', imageBlob);
  }

  // Generate the ZIP blob and trigger download
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `${slug}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
