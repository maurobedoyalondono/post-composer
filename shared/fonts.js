// shared/fonts.js
// Loads Google Fonts by family name. Caches loaded families to avoid duplicate requests.

/**
 * Build a CSS font string from a layer font object and a resolved pixel size.
 * @param {object} font — { family, weight, style }; all fields optional
 * @param {number} sizePx — resolved pixel size (caller computes from size_pct)
 * @returns {string} — e.g. "italic 700 24px Inter"
 */
export function buildFontString(font, sizePx) {
  const style  = font?.style  ?? 'normal';
  const weight = font?.weight ?? 400;
  const family = font?.family ?? 'sans-serif';
  return `${style} ${weight} ${sizePx}px ${family}`;
}

const loaded = new Set();

/**
 * Loads a Google Fonts family if not already loaded.
 * @param {string} family — e.g. "Inter", "Cormorant Garamond"
 * @param {number[]} weights — e.g. [400, 700]
 * @returns {Promise<void>}
 */
export async function loadFont(family, weights = [400, 700]) {
  const key = `${family}:${weights.join(',')}`;
  if (loaded.has(key)) return;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(';')}&display=swap`;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  await new Promise((resolve, reject) => {
    link.onload  = resolve;
    link.onerror = () => reject(new Error(`Failed to load font: ${family}`));
    document.head.appendChild(link);
  });
  loaded.add(key);
  // Wait for font to be available in FontFaceSet
  await document.fonts.ready;
}

/**
 * Load all fonts referenced in a project's design_tokens.
 * @param {object} designTokens — project.design_tokens
 */
export async function loadProjectFonts(designTokens) {
  const { type_scale } = designTokens ?? {};
  if (!type_scale) return;
  const loads = [];
  for (const role of Object.values(type_scale)) {
    if (role?.family) {
      loads.push(loadFont(role.family, [role.weight ?? 400, 700]).catch(
        () => console.warn(`Font not found: ${role.family}`)
      ));
    }
  }
  await Promise.all(loads);
}
