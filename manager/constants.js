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

export const ROLES = [
  { id: '',           label: '(none)' },
  { id: 'opening',    label: 'Opening' },
  { id: 'closing',    label: 'Closing' },
  { id: 'anchor',     label: 'Anchor' },
  { id: 'transition', label: 'Transition' },
  { id: 'silent',     label: 'Silent' },
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
    .slice(0, 64).replace(/-+$/, '') || 'project';
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
