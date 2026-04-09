// ui/color-picker.js

const MAX_RECENT    = 8;
const MAX_FAVORITES = 8;

/**
 * Create a color picker widget as an HTMLElement.
 *
 * @param {object} opts
 * @param {string}  opts.value      — initial color hex (e.g. '#ff0000')
 * @param {object}  opts.palette    — design_tokens.palette object (name → hex)
 * @param {string}  opts.projectId  — used as localStorage key prefix
 * @param {(color: string) => void} opts.onChange — called when user picks a color
 * @returns {HTMLElement}
 */
export function createColorPicker({ value = '#ffffff', palette = {}, projectId = 'default', onChange } = {}) {
  const el = document.createElement('div');
  el.className = 'color-picker';
  _renderAll(el, value, palette, projectId, onChange);
  return el;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function _renderAll(el, currentValue, palette, projectId, onChange) {
  const favorites = _loadFavorites(projectId);
  const recent    = _loadRecent(projectId);

  el.innerHTML = `
    <div class="cp-section-label">Palette</div>
    <div class="cp-swatches cp-palette">
      ${Object.entries(palette).map(([name, color]) =>
        `<button class="cp-swatch" data-color="${color}" title="${name}" style="background:${color}"></button>`
      ).join('')}
    </div>
    <div class="cp-section-label">Favorites</div>
    <div class="cp-swatches cp-favorites">
      ${_favHTML(favorites)}
    </div>
    <div class="cp-section-label">Recent</div>
    <div class="cp-swatches cp-recent">
      ${recent.map(c => `<button class="cp-swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`).join('')}
    </div>
    <input class="cp-native" type="color" value="${currentValue}">
  `;

  const native = el.querySelector('.cp-native');

  // Palette swatches — event delegation
  el.querySelector('.cp-palette').addEventListener('click', e => {
    const color = e.target.closest('.cp-swatch')?.dataset.color;
    if (color) _apply(el, native, color, projectId, onChange);
  });

  // Recent swatches — event delegation
  el.querySelector('.cp-recent').addEventListener('click', e => {
    const color = e.target.closest('.cp-swatch')?.dataset.color;
    if (color) _apply(el, native, color, projectId, onChange);
  });

  // Native color input
  native.addEventListener('input', () => _apply(el, native, native.value, projectId, onChange));

  _wireFavorites(el, native, projectId, onChange);
  _wireTonesExpansion(el, native, projectId, onChange);
}

function _favHTML(favorites) {
  return favorites.map(c =>
    `<button class="cp-swatch cp-fav" data-color="${c}" title="${c}" style="background:${c}"></button>`
  ).join('') + `<button class="cp-add-fav" title="Save current color as favorite">+</button>`;
}

function _wireFavorites(el, native, projectId, onChange) {
  const favRow = el.querySelector('.cp-favorites');

  favRow.querySelectorAll('.cp-fav').forEach(btn => {
    btn.addEventListener('click', () => _apply(el, native, btn.dataset.color, projectId, onChange));
    btn.addEventListener('contextmenu', e => {
      e.preventDefault();
      _removeFavorite(el, native, btn.dataset.color, projectId, onChange);
    });
  });

  favRow.querySelector('.cp-add-fav')?.addEventListener('click', () => {
    _addFavorite(el, native, native.value, projectId, onChange);
  });
}

function _wireTonesExpansion(el, native, projectId, onChange) {
  let expandedSwatch = null;
  let tonesRow = null;

  el.querySelector('.cp-palette').addEventListener('click', e => {
    const swatch = e.target.closest('.cp-swatch[data-color]');
    if (!swatch) return;

    // Collapse if same swatch clicked again
    if (swatch === expandedSwatch) {
      tonesRow?.remove();
      expandedSwatch = null;
      tonesRow = null;
      return;
    }

    // Remove existing tones row
    tonesRow?.remove();

    // Build tones row
    const tones = _getTones(swatch.dataset.color);
    tonesRow = document.createElement('div');
    tonesRow.className = 'cp-tones-row';
    tonesRow.innerHTML = tones.map((t, i) =>
      `<button class="cp-swatch cp-tone${i === 2 ? ' cp-tone-base' : ''}" data-color="${t}" title="${t}" style="background:${t}"></button>`
    ).join('');
    tonesRow.querySelectorAll('.cp-swatch').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _apply(el, native, btn.dataset.color, projectId, onChange);
        tonesRow?.remove();
        expandedSwatch = null;
        tonesRow = null;
      });
    });

    // Insert after the palette row
    const paletteRow = el.querySelector('.cp-palette');
    paletteRow.insertAdjacentElement('afterend', tonesRow);
    expandedSwatch = swatch;
  });
}

function _apply(el, native, color, projectId, onChange) {
  native.value = color;
  _addRecent(el, color, projectId);
  onChange?.(color);
}

function _addFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  favs.unshift(color);
  if (favs.length > MAX_FAVORITES) favs.pop();
  try { localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs)); } catch { /* storage full */ }
  _refreshFavRow(el, native, projectId, onChange);
}

function _removeFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  try { localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs)); } catch { /* storage full */ }
  _refreshFavRow(el, native, projectId, onChange);
}

function _refreshFavRow(el, native, projectId, onChange) {
  const favRow = el.querySelector('.cp-favorites');
  favRow.innerHTML = _favHTML(_loadFavorites(projectId));
  _wireFavorites(el, native, projectId, onChange);
}

function _addRecent(el, color, projectId) {
  const rec = _loadRecent(projectId).filter(c => c !== color);
  rec.unshift(color);
  if (rec.length > MAX_RECENT) rec.pop();
  try { localStorage.setItem(`cp-recent-${projectId}`, JSON.stringify(rec)); } catch { /* storage full */ }
  // Update recent row DOM — existing delegation listener on .cp-recent handles clicks
  const recentRow = el.querySelector('.cp-recent');
  if (recentRow) {
    recentRow.innerHTML = rec
      .map(c => `<button class="cp-swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`)
      .join('');
  }
}

function _loadFavorites(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-fav-${projectId}`) ?? '[]'); } catch { return []; }
}

function _loadRecent(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-recent-${projectId}`) ?? '[]'); } catch { return []; }
}

// ── Color math for tones ────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function _rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function _hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function _rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function _shiftLightness(hex, deltaL) {
  const hsl = _rgbToHsl(_hexToRgb(hex));
  hsl.l = Math.max(5, Math.min(95, hsl.l + deltaL));
  return _rgbToHex(_hslToRgb(hsl));
}

function _getTones(hex) {
  return [-40, -20, 0, +20, +40].map(d => _shiftLightness(hex, d));
}
