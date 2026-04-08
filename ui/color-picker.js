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

function _apply(el, native, color, projectId, onChange) {
  native.value = color;
  _addRecent(el, color, projectId);
  onChange?.(color);
}

function _addFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  favs.unshift(color);
  if (favs.length > MAX_FAVORITES) favs.pop();
  localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs));
  _refreshFavRow(el, native, projectId, onChange);
}

function _removeFavorite(el, native, color, projectId, onChange) {
  const favs = _loadFavorites(projectId).filter(c => c !== color);
  localStorage.setItem(`cp-fav-${projectId}`, JSON.stringify(favs));
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
  localStorage.setItem(`cp-recent-${projectId}`, JSON.stringify(rec));
  // Update recent row DOM
  const recentRow = el.querySelector('.cp-recent');
  if (recentRow) {
    recentRow.innerHTML = rec
      .map(c => `<button class="cp-swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`)
      .join('');
    // Re-wire click handler for newly rendered swatches
    recentRow.addEventListener('click', e => {
      const c = e.target.closest('.cp-swatch')?.dataset.color;
      const native = el.querySelector('.cp-native');
      if (c && native) {
        native.value = c;
        // Note: not calling _apply here to avoid infinite loop — onChange already wired on native input
      }
    });
  }
}

function _loadFavorites(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-fav-${projectId}`) ?? '[]'); } catch { return []; }
}

function _loadRecent(projectId) {
  try { return JSON.parse(localStorage.getItem(`cp-recent-${projectId}`) ?? '[]'); } catch { return []; }
}
