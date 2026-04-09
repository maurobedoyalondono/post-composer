// ui/color-wheel-panel.js
import { events }                    from '../core/events.js';
import {
  extractDominantColors,
  computeAllHarmonyScores,
  computeAffectingOverlay,
  generateInsights,
} from '../editor/color-wheel-analysis.js';

const ANALYSIS_EVENTS = ['project:loaded', 'frame:changed', 'layer:changed', 'layers:reordered', 'layer:deleted'];

// Returns score badge color — 4-level scale matching professional thresholds
function _scoreColor(score) {
  if (score >= 80) return '#4ade80';
  if (score >= 55) return '#facc15';
  if (score >= 30) return '#fb923c';
  return '#f87171';
}

// Pre-built hue ring colors for SVG (12 segments at 0°, 30°, …, 330°)
const HUE_RING_COLORS = [
  '#ff0000','#ff8000','#ffff00','#80ff00',
  '#00ff00','#00ff80','#00ffff','#0080ff',
  '#0000ff','#8000ff','#ff00ff','#ff0080',
];

export class ColorWheelPanel {
  /**
   * @param {HTMLElement} container — .color-wheel-panel element appended to body by shell
   * @param {import('../core/state.js').AppState} state
   */
  constructor(container, state) {
    this._el    = container;
    this._state = state;
    this._timer = null;
    this._results = null;       // HarmonyResult[] from last analysis
    this._activeIdx = 0;        // index into this._results
    this._overlayOn = false;
    this._neutralColors  = [];    // DominantColor[] from last extractDominantColors
    this._insights       = null;  // insight[] from last generateInsights call
    this._allNeutral     = false; // true when chromaticPct === 0
    this._lowConfidence  = false; // true when chromaticPct < 5%

    this._handlers = {};
    for (const ev of ANALYSIS_EVENTS) {
      this._handlers[ev] = () => this._scheduleAnalysis();
      events.addEventListener(ev, this._handlers[ev]);
    }

    this._el.addEventListener('click', e => this._onClick(e));
    this._initDrag();
  }

  show()   { this._el.classList.add('open');    if (!this._results) this._runAnalysis(); return true; }
  hide()   {
    this._el.classList.remove('open');
    if (this._overlayOn) this._setOverlay(false);
    return false;
  }
  toggle() {
    const isOpen = this._el.classList.toggle('open');
    if (isOpen && !this._results) this._runAnalysis();
    if (!isOpen && this._overlayOn) this._setOverlay(false);
    return isOpen;
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  _scheduleAnalysis() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._runAnalysis(), 400);
  }

  _runAnalysis() {
    this._timer = null;
    const canvas = document.getElementById('editor-canvas');
    if (!canvas || !this._state.project) return;
    try {
      const ctx       = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dominant  = extractDominantColors(imageData);
      this._neutralColors = dominant.filter(c => c.isNeutral);
      this._results   = computeAllHarmonyScores(dominant);
      this._insights  = generateInsights(this._results, dominant);
      const chromaticPct = dominant.filter(c => !c.isNeutral).reduce((s, c) => s + c.canvasPct, 0);
      this._allNeutral    = chromaticPct === 0;
      this._lowConfidence = chromaticPct > 0 && chromaticPct < 5;
      // Clamp active index in case result set changed
      this._activeIdx = Math.min(this._activeIdx, this._results.length - 1);
      this._render();
      if (this._overlayOn) this._applyOverlay(imageData);
    } catch (e) {
      console.warn('[ColorWheelPanel] analysis failed:', e);
    }
  }

  _setOverlay(on) {
    this._overlayOn = on;
    if (!on) {
      this._state.colorWheelOverlay = null;
      events.dispatchEvent(new CustomEvent('color-wheel:overlay-changed'));
      return;
    }
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    const ctx       = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this._applyOverlay(imageData);
  }

  _applyOverlay(imageData) {
    if (!this._results) return;
    const active  = this._results[this._activeIdx];
    const overlay = computeAffectingOverlay(imageData, active.sectors);
    this._state.colorWheelOverlay = overlay;
    events.dispatchEvent(new CustomEvent('color-wheel:overlay-changed'));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _render() {
    if (!this._results) {
      this._el.innerHTML = `
        <div class="layers-panel-header" style="display:flex;justify-content:space-between;">
          <span>Color Wheel</span>
        </div>
        <div class="layers-panel-empty">No project loaded</div>`;
      this._initDrag();
      return;
    }

    const active       = this._results[this._activeIdx];
    const neutralColors = this._neutralColors ?? [];

    this._el.innerHTML = `
      <div class="layers-panel-header" style="display:flex;align-items:center;justify-content:space-between;cursor:move;">
        <span>Color Wheel</span>
        <button data-action="refresh" title="Re-analyse" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:14px;padding:0 4px;">⟳</button>
      </div>

      <div style="padding:8px 10px 4px;border-bottom:1px solid var(--color-border);">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:5px;">HARMONY MODE</div>
        ${this._results.map((r, i) => this._harmonyRow(r, i)).join('')}
      </div>

      <div style="padding:8px 10px 4px;display:flex;justify-content:center;">
        ${this._buildWheel(active)}
      </div>

      <div style="padding:0 10px 10px;">
        ${this._colorSection('IN HARMONY', active.inHarmony, false)}
        ${active.affecting.length ? this._colorSection(`AFFECTING — ${active.affecting.reduce((s,c) => s+c.canvasPct,0)}%`, active.affecting, true) : ''}
        ${neutralColors.length ? this._colorSection(`NEUTRAL — ${neutralColors.reduce((s,c) => s+c.canvasPct,0)}%`, neutralColors, false, '#6b7280') : ''}
      </div>

      ${this._renderInsights(this._insights)}

      <div style="padding:6px 10px 10px;border-top:1px solid var(--color-border);">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--color-text-muted);">
          <input type="checkbox" data-action="toggle-overlay" ${this._overlayOn ? 'checked' : ''}>
          Show affecting on canvas
        </label>
      </div>
    `;
    this._initDrag();
  }

  _harmonyRow(result, idx) {
    const isActive   = idx === this._activeIdx;
    const scoreColor = _scoreColor(result.score);
    const label      = result.type.charAt(0).toUpperCase() + result.type.slice(1);
    const barPct     = result.score;
    const scoreLabel = this._allNeutral    ? '—'
                     : this._lowConfidence ? `~${result.score}%`
                     :                      `${result.score}%`;
    const bg = isActive
      ? 'background:var(--color-surface-2);border-left:2px solid var(--color-accent);'
      : 'background:none;border-left:2px solid transparent;';
    return `
      <div data-action="set-harmony" data-idx="${idx}" style="${bg}display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:3px;margin-bottom:2px;">
        <span style="flex:1;font-size:11px;color:${isActive ? 'var(--color-text)' : 'var(--color-text-muted)'};">${label}</span>
        <span style="font-size:11px;font-weight:700;color:${scoreColor};width:36px;text-align:right;">${scoreLabel}</span>
        <div style="width:36px;background:var(--color-border);border-radius:2px;height:4px;overflow:hidden;">
          <div style="width:${barPct}%;background:${scoreColor};height:100%;border-radius:2px;"></div>
        </div>
      </div>`;
  }

  _buildWheel(active) {
    const CX = 90, CY = 90, OR = 82, IR = 58, MR = 70;

    // Dominant offender: highest canvasPct in affecting (gets pulsing ring)
    const offender = active.affecting.length
      ? active.affecting.reduce((a, b) => a.canvasPct >= b.canvasPct ? a : b)
      : null;

    // 12 hue ring segments (unchanged)
    const segments = HUE_RING_COLORS.map((color, i) => {
      const startDeg = i * 30 - 15 - 90;
      const endDeg   = i * 30 + 15 - 90;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 0,1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 0,0 ${ix1},${iy1} Z" fill="${color}" opacity="0.75"/>`;
    }).join('');

    const centerFill = `<circle cx="${CX}" cy="${CY}" r="${IR - 1}" fill="var(--color-surface,#1a1a1a)"/>`;

    // Harmony sectors — dashed stroke when score < 55 (weak fit signal)
    const isDashed = active.score < 55;
    const sectorPaths = active.sectors.map(({ centerHue, halfWidth }) => {
      const startDeg = centerHue - halfWidth - 90;
      const endDeg   = centerHue + halfWidth - 90;
      const largeArc = halfWidth * 2 > 180 ? 1 : 0;
      const [ox1,oy1] = _polar(CX, CY, OR, startDeg);
      const [ox2,oy2] = _polar(CX, CY, OR, endDeg);
      const [ix1,iy1] = _polar(CX, CY, IR, startDeg);
      const [ix2,iy2] = _polar(CX, CY, IR, endDeg);
      const dashattr = isDashed ? 'stroke-dasharray="4,3"' : '';
      return `<path d="M${ox1},${oy1} A${OR},${OR} 0 ${largeArc},1 ${ox2},${oy2} L${ix2},${iy2} A${IR},${IR} 0 ${largeArc},0 ${ix1},${iy1} Z" fill="rgba(96,165,250,0.18)" stroke="rgba(96,165,250,0.65)" stroke-width="1.5" ${dashattr}/>`;
    }).join('');

    // Color dots — angle from OKLCH hue, pulsing ring for dominant offender
    const allChromatic = [...active.inHarmony, ...active.affecting];
    let pulsingRings = '';
    const dots = allChromatic.map(c => {
      const angle = c.oklch.h - 90;
      const [x, y] = _polar(CX, CY, MR, angle);
      const r          = Math.min(10, 4 + Math.round(c.canvasPct / 8));
      const isAffecting = active.affecting.some(a => a.hex === c.hex);
      const stroke      = isAffecting ? '#ef4444' : '#ffffff';
      const dashattr    = isAffecting ? 'stroke-dasharray="3,2"' : '';

      if (offender && c.hex === offender.hex) {
        pulsingRings += `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="#ef4444" stroke-width="1.5">
          <animate attributeName="r" values="${r + 3};${r + 7};${r + 3}" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.5s" repeatCount="indefinite"/>
        </circle>`;
      }

      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.hex}" stroke="${stroke}" stroke-width="2" ${dashattr}/>`;
    }).join('');

    const typeLabel    = active.type.charAt(0).toUpperCase() + active.type.slice(1);
    const scoreDisplay = this._allNeutral    ? '—'
                       : this._lowConfidence ? `~${active.score}%`
                       :                      `${active.score}%`;
    const center = `
      <text x="${CX}" y="${CY - 6}" text-anchor="middle" fill="var(--color-text-muted,#9ca3af)" font-size="11" font-family="var(--font-sans,sans-serif)">${typeLabel}</text>
      <text x="${CX}" y="${CY + 10}" text-anchor="middle" fill="${_scoreColor(active.score)}" font-size="15" font-weight="bold" font-family="var(--font-sans,sans-serif)">${scoreDisplay}</text>`;

    return `<svg width="180" height="180" viewBox="0 0 180 180" style="display:block;overflow:visible;">${segments}${centerFill}${sectorPaths}${pulsingRings}${dots}${center}</svg>`;
  }

  _colorSection(label, colors, isAffecting, labelColor) {
    if (!colors.length) return '';
    const lc = labelColor ?? (isAffecting ? '#f87171' : '#4ade80');
    const rows = colors.map(c => {
      const suffix = isAffecting && c.degreesOff != null
        ? `<span style="font-size:8px;color:#f87171;margin-left:4px;">+${c.degreesOff}°</span>`
        : '';
      const border = isAffecting ? 'border:1.5px solid #f87171;' : '';
      return `
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
          <div style="width:12px;height:12px;background:${c.hex};border-radius:2px;flex-shrink:0;${border}"></div>
          <div style="flex:1;background:var(--color-border,#2a2a2a);border-radius:2px;height:4px;overflow:hidden;">
            <div style="width:${c.canvasPct}%;background:${c.hex};height:100%;border-radius:2px;"></div>
          </div>
          <span style="font-size:9px;color:${isAffecting ? '#f87171' : 'var(--color-text)'};width:24px;text-align:right;">${c.canvasPct}%</span>
          <span style="font-size:8px;color:var(--color-text-muted);font-family:var(--font-mono,monospace);">${c.hex}</span>
          ${suffix}
        </div>`;
    }).join('');
    return `
      <div style="margin-top:8px;">
        <div style="font-size:9px;color:${lc};letter-spacing:1px;margin-bottom:4px;">${label}</div>
        ${rows}
      </div>`;
  }

  _renderInsights(insights) {
    if (!insights || !insights.length) return '';
    const items = insights.map(ins => `
      <div style="margin-bottom:8px;">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:2px;">${ins.label.toUpperCase()}</div>
        <div style="font-size:11px;color:var(--color-text);line-height:1.5;">${ins.text}</div>
      </div>`).join('');
    return `
      <div style="padding:8px 10px 10px;border-top:1px solid var(--color-border);">
        <div style="font-size:9px;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px;">INSIGHTS</div>
        ${items}
      </div>`;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _onClick(e) {
    if (e.target.closest('[data-action="refresh"]')) {
      this._runAnalysis();
      return;
    }
    const harmonyRow = e.target.closest('[data-action="set-harmony"]');
    if (harmonyRow) {
      this._activeIdx = parseInt(harmonyRow.dataset.idx, 10);
      this._render();
      if (this._overlayOn) {
        const canvas = document.getElementById('editor-canvas');
        if (!canvas) return;
        const ctx       = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this._applyOverlay(imageData);
      }
      return;
    }
    const overlayToggle = e.target.closest('[data-action="toggle-overlay"]');
    if (overlayToggle) {
      this._setOverlay(overlayToggle.checked);
    }
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  _initDrag() {
    const header = this._el.querySelector('.layers-panel-header');
    if (!header) return;
    let startX, startY, origLeft, origTop;
    const onMove = e => {
      this._el.style.left   = `${origLeft + e.clientX - startX}px`;
      this._el.style.top    = `${origTop  + e.clientY - startY}px`;
      this._el.style.bottom = 'auto';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    header.addEventListener('mousedown', e => {
      const rect = this._el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origLeft = rect.left; origTop = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      e.preventDefault();
    });
  }

  destroy() {
    clearTimeout(this._timer);
    for (const [ev, fn] of Object.entries(this._handlers)) {
      events.removeEventListener(ev, fn);
    }
    this._el.remove();
  }
}

// ─── SVG helper ──────────────────────────────────────────────────────────────

function _polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return [
    (cx + r * Math.cos(rad)).toFixed(1),
    (cy + r * Math.sin(rad)).toFixed(1),
  ];
}
