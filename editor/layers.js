// editor/layers.js
import { buildFontString } from '../shared/fonts.js';

const TEXT_LINE_ESTIMATE = 2;

const ZONE_ANCHORS = {
  'top-left':      (w, h) => ({ x: 0,   y: 0   }),
  'top-center':    (w, h) => ({ x: w/2, y: 0   }),
  'top-right':     (w, h) => ({ x: w,   y: 0   }),
  'middle-left':   (w, h) => ({ x: 0,   y: h/2 }),
  'middle-center': (w, h) => ({ x: w/2, y: h/2 }),
  'middle-right':  (w, h) => ({ x: w,   y: h/2 }),
  'bottom-left':   (w, h) => ({ x: 0,   y: h   }),
  'bottom-center': (w, h) => ({ x: w/2, y: h   }),
  'bottom-right':  (w, h) => ({ x: w,   y: h   }),
};

/**
 * Resolve a layer position object to canvas {x, y} coordinates.
 * @param {object|null} pos
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ x: number, y: number }}
 */
export function resolvePosition(pos, w, h) {
  if (!pos) return { x: 0, y: 0 };
  if (pos.zone === 'absolute') {
    return {
      x: (pos.x_pct ?? 0) / 100 * w,
      y: (pos.y_pct ?? 0) / 100 * h,
    };
  }
  const anchorFn = ZONE_ANCHORS[pos.zone] ?? ZONE_ANCHORS['top-left'];
  const base = anchorFn(w, h);
  return {
    x: base.x + (pos.offset_x_pct ?? 0) / 100 * w,
    y: base.y + (pos.offset_y_pct ?? 0) / 100 * h,
  };
}

/**
 * Compute the bounding box a text layer would occupy when rendered.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ width: number, height: number }}
 */
export function computeTextBounds(ctx, layer, w, h) {
  const sizePx = (layer.font?.size_pct ?? 5) / 100 * h;
  ctx.font = buildFontString(layer.font ?? {}, sizePx);
  const maxW  = (layer.max_width_pct ?? 80) / 100 * w;
  const lines = _wrapText(ctx, layer.content ?? '', maxW);
  const lineH = sizePx * (layer.font?.line_height ?? 1.25);
  return { width: maxW, height: lines.length * lineH };
}

/**
 * Compute tight selection bounds for a text layer by measuring actual rendered text.
 * Width reflects the widest line; height reflects the true line count.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeTextSelectionBounds(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx  = (layer.font?.size_pct ?? 5) / 100 * h;
  const maxW    = (layer.max_width_pct ?? 80) / 100 * w;
  const spacing = (layer.font?.letter_spacing_em ?? 0) * sizePx;
  ctx.save();
  ctx.font = buildFontString(layer.font ?? {}, sizePx);
  const lines = _wrapText(ctx, layer.content ?? '', maxW);
  const lineH = sizePx * (layer.font?.line_height ?? 1.25);
  let actualW = 0;
  for (const line of lines) {
    const lw = ctx.measureText(line).width + Math.max(0, line.length - 1) * spacing;
    if (lw > actualW) actualW = lw;
  }
  ctx.restore();
  return {
    x,
    y,
    width:  Math.min(actualW || maxW, maxW),
    height: Math.max(lines.length, 1) * lineH,
  };
}

/**
 * Compute the bounding box of a layer in canvas coordinates.
 * Does not require a canvas context — text height is approximated as 2 lines.
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeLayerBounds(layer, w, h) {
  if (layer.type === 'overlay') {
    return { x: 0, y: 0, width: w, height: h };
  }
  const { x, y } = resolvePosition(layer.position, w, h);
  switch (layer.type) {
    case 'text': {
      const maxW   = (layer.max_width_pct ?? 80) / 100 * w;
      const sizePx = (layer.font?.size_pct ?? 5) / 100 * h;
      const lineH  = sizePx * (layer.font?.line_height ?? 1.25);
      return { x, y, width: maxW, height: lineH * TEXT_LINE_ESTIMATE };
    }
    case 'stats_block': {
      const sizePx = (layer.font?.size_pct ?? 4) / 100 * h;
      const lineH  = sizePx * 1.6;
      return { x, y, width: w * 0.4, height: lineH * (layer.stats?.length ?? 1) };
    }
    case 'image': {
      const bw = (layer.width_pct  ?? 100) / 100 * w;
      const bh = (layer.height_pct ?? 100) / 100 * h;
      return { x, y, width: bw, height: bh };
    }
    case 'logo': {
      const bw = (layer.width_pct  ?? 10) / 100 * w;
      const bh = (layer.height_pct ?? 10) / 100 * h;
      return { x, y, width: bw, height: bh };
    }
    case 'shape': {
      const bw = (layer.width_pct  ?? 20) / 100 * w;
      const bh = (layer.height_pct ??  5) / 100 * h;
      return { x, y, width: bw, height: bh };
    }
    default:
      return { x, y, width: 0, height: 0 };
  }
}

/**
 * Render a single layer onto the canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @param {Map<string, HTMLImageElement>} images — keyed by filename
 */
export function renderLayer(ctx, layer, w, h, images) {
  switch (layer.type) {
    case 'image':       _renderImageLayer(ctx, layer, w, h, images);  break;
    case 'overlay':     _renderOverlayLayer(ctx, layer, w, h);        break;
    case 'text':        _renderTextLayer(ctx, layer, w, h);           break;
    case 'shape':       _renderShapeLayer(ctx, layer, w, h);          break;
    case 'stats_block': _renderStatsBlock(ctx, layer, w, h);          break;
    case 'logo':        _renderLogoLayer(ctx, layer, w, h, images);   break;
  }
}

// ── Private render functions ──────────────────────────────────────────────────

function _renderImageLayer(ctx, layer, w, h, images) {
  const img = images?.get(layer.src);
  if (!img) return;
  const { x, y } = resolvePosition(layer.position, w, h);
  const iw = (layer.width_pct  ?? 100) / 100 * w;
  const ih = (layer.height_pct ?? 100) / 100 * h;
  const fit = layer.fit ?? 'fill';
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  if (fit === 'fill') {
    ctx.drawImage(img, x, y, iw, ih);
  } else if (fit === 'cover') {
    const scale = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (iw - dw) / 2;
    const dy = y + (ih - dh) / 2;
    ctx.beginPath();
    ctx.rect(x, y, iw, ih);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
  } else { // contain
    const scale = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (iw - dw) / 2;
    const dy = y + (ih - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  ctx.restore();
}

const BLEND_MAP = {
  'normal':     'source-over',
  'multiply':   'multiply',
  'screen':     'screen',
  'overlay':    'overlay',
  'soft-light': 'soft-light',
};

function _renderOverlayLayer(ctx, layer, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = BLEND_MAP[layer.blend_mode] ?? 'source-over';
  ctx.globalAlpha = layer.opacity ?? 0.6;
  if (layer.gradient?.enabled) {
    const grad = _buildGradient(ctx, layer.gradient, w, h);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = layer.color ?? '#000000';
  }
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function _buildGradient(ctx, gradient, w, h) {
  const dir = gradient.direction ?? 'to-bottom';
  const coords = {
    'to-bottom': [0, 0, 0, h],
    'to-top':    [0, h, 0, 0],
    'to-right':  [0, 0, w, 0],
    'to-left':   [w, 0, 0, 0],
  };
  const [x0, y0, x1, y1] = coords[dir] ?? coords['to-bottom'];
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  (gradient.stops ?? []).forEach(s => grad.addColorStop(s.at, s.color));
  return grad;
}

function _renderTextLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx   = (layer.font?.size_pct ?? 5) / 100 * h;
  const maxW     = (layer.max_width_pct ?? 80) / 100 * w;
  ctx.save();
  // Shadow — compose color+opacity into a single rgba value
  if (layer.shadow?.enabled) {
    const sc = _hexToRgba(layer.shadow.color ?? '#000000', layer.shadow.opacity ?? 0.6);
    ctx.shadowColor   = sc;
    ctx.shadowBlur    = layer.shadow.blur_px ?? 8;
    ctx.shadowOffsetX = layer.shadow.offset_x ?? 2;
    ctx.shadowOffsetY = layer.shadow.offset_y ?? 2;
  }
  ctx.globalAlpha  = layer.opacity ?? 1;
  ctx.fillStyle    = layer.font?.color ?? '#ffffff';
  ctx.font         = buildFontString(layer.font ?? {}, sizePx);
  ctx.textBaseline = 'top';
  ctx.textAlign    = layer.font?.align ?? 'left';
  const lines  = _wrapText(ctx, layer.content ?? '', maxW);
  const lineH  = sizePx * (layer.font?.line_height ?? 1.25);
  const spacing = (layer.font?.letter_spacing_em ?? 0) * sizePx;
  lines.forEach((line, i) => {
    _drawTextWithSpacing(ctx, line, x, y + i * lineH, spacing);
  });
  ctx.restore();
}

function _wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxW) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function _drawTextWithSpacing(ctx, text, x, y, spacing) {
  if (!spacing) { ctx.fillText(text, x, y); return; }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function _renderShapeLayer(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sw = (layer.width_pct  ?? 20) / 100 * w;
  const sh = (layer.height_pct ??  5) / 100 * h;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.fillStyle   = layer.fill   ?? 'transparent';
  ctx.strokeStyle = layer.stroke ?? 'transparent';
  ctx.lineWidth   = (layer.stroke_width ?? 1);
  switch (layer.shape) {
    case 'circle': {
      const r = Math.min(sw, sh) / 2;
      ctx.beginPath();
      ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
      if (layer.fill)   ctx.fill();
      if (layer.stroke) ctx.stroke();
      break;
    }
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sw, y + sh);
      ctx.stroke();
      break;
    default: // rectangle
      if (layer.fill)   ctx.fillRect(x, y, sw, sh);
      if (layer.stroke) ctx.strokeRect(x, y, sw, sh);
  }
  ctx.restore();
}

function _renderStatsBlock(ctx, layer, w, h) {
  const { x, y } = resolvePosition(layer.position, w, h);
  const sizePx = (layer.font?.size_pct ?? 4) / 100 * h;
  const lineH  = sizePx * 1.6;
  ctx.save();
  ctx.globalAlpha  = layer.opacity ?? 1;
  ctx.font         = buildFontString(layer.font ?? {}, sizePx);
  ctx.textBaseline = 'top';
  (layer.stats ?? []).forEach((stat, i) => {
    const labelColor = layer.font?.color_label ?? '#aaaaaa';
    const valueColor = layer.font?.color_value ?? '#ffffff';
    ctx.fillStyle = labelColor;
    ctx.fillText(stat.label, x, y + i * lineH);
    const labelW = ctx.measureText(stat.label + ' ').width;
    ctx.fillStyle = valueColor;
    ctx.fillText(stat.value, x + labelW, y + i * lineH);
  });
  ctx.restore();
}

function _renderLogoLayer(ctx, layer, w, h, images) {
  const img = images?.get(layer.src);
  if (!img) return;
  const { x, y } = resolvePosition(layer.position, w, h);
  const lw = (layer.width_pct  ?? 10) / 100 * w;
  const lh = (layer.height_pct ?? 10) / 100 * h;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.drawImage(img, x, y, lw, lh);
  ctx.restore();
}

function _hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
