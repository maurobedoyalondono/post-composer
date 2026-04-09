// editor/renderer.js
import { renderLayer, computeLayerBounds, computeTextSelectionBounds } from './layers.js';
import {
  computeContrastMap, computeWeightMap,
  computeCenterOfMass, drawCenterOfMass,
} from './analysis.js';

/**
 * Renders a full post-composer frame to an HTMLCanvasElement.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} frame — one entry from project.frames
   * @param {object} project — full project JSON (for design_tokens)
   * @param {Map<string, HTMLImageElement>} images — keyed by filename
   * @param {object} [opts]
   * @param {boolean} [opts.showSafeZone]
   * @param {string|null} [opts.guideType] — 'thirds', 'phi', 'cross', or null
   * @param {string|null} [opts.selectedLayerId] — id of the currently selected layer
   * @param {boolean} [opts.showLayerBounds] — draw bounding boxes for all visible layers
   * @param {string|null} [opts.analysisMode] — 'contrast', 'weight', or null
   */
  renderFrame(canvas, frame, project, images, opts = {}) {
    const ctx = canvas.getContext('2d');
    const w   = canvas.width;
    const h   = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background fill
    ctx.fillStyle = project.design_tokens?.palette?.background ?? '#000000';
    ctx.fillRect(0, 0, w, h);

    // Background photo (keyed by image_filename)
    const bg = images?.get(frame.image_filename);
    if (bg) _drawCoverImage(ctx, bg, w, h);

    // Layers in declaration order
    for (const layer of (frame.layers ?? [])) {
      renderLayer(ctx, layer, w, h, images);
    }

    // Layer-bounds overlay (all layers)
    if (opts.showLayerBounds) _drawAllBounds(ctx, frame.layers, w, h);

    // Selection overlay (selected layer)
    if (opts.selectedLayerId) {
      const sel = (frame.layers ?? []).find(l => l.id === opts.selectedLayerId);
      if (sel) _drawSelection(ctx, sel, w, h);
    }

    // Composition guides
    if (opts.showSafeZone) _drawSafeZone(ctx, w, h);
    if (opts.guideType)    _drawGuide(ctx, w, h, opts.guideType);

    // Analysis overlay — reads fully composed pixels, writes RGBA overlay
    if (opts.analysisMode) {
      const imageData = ctx.getImageData(0, 0, w, h);
      if (opts.analysisMode === 'contrast') {
        const overlay = computeContrastMap(imageData);
        ctx.putImageData(new ImageData(overlay, w, h), 0, 0);
      } else if (opts.analysisMode === 'weight') {
        const { weights, overlay } = computeWeightMap(imageData);
        ctx.putImageData(new ImageData(overlay, w, h), 0, 0);
        const { x, y } = computeCenterOfMass(weights, w, h);
        drawCenterOfMass(ctx, x, y);
      }
    }
  }
}

function _drawCoverImage(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = img.width  * scale;
  const sh = img.height * scale;
  const sx = (w - sw) / 2;
  const sy = (h - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);
}

function _drawSafeZone(ctx, w, h) {
  const m = 0.1;
  ctx.save();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(w * m, h * m, w * (1 - 2 * m), h * (1 - 2 * m));
  ctx.restore();
}

function _drawAllBounds(ctx, layers, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(100,160,255,0.35)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 3]);
  for (const layer of (layers ?? [])) {
    if (layer.hidden) continue;
    const b = computeLayerBounds(layer, w, h);
    if (b.width > 0 && b.height > 0) {
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    }
  }
  ctx.restore();
}

function _drawSelection(ctx, layer, w, h) {
  const b = layer.type === 'text'
    ? computeTextSelectionBounds(ctx, layer, w, h)
    : computeLayerBounds(layer, w, h);
  if (b.width === 0 && b.height === 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(100,160,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(b.x, b.y, b.width, b.height);
  // Corner handles
  const hs = 6;
  ctx.fillStyle = '#64a0ff';
  for (const [cx, cy] of [
    [b.x,           b.y],
    [b.x + b.width, b.y],
    [b.x,           b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ]) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
  }
  ctx.restore();
}

function _drawGuide(ctx, w, h, guideType) {
  ctx.save();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.85)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);

  const line = (x0, y0, x1, y1) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };

  switch (guideType) {
    case 'thirds':
      [1/3, 2/3].forEach(t => {
        line(w * t, 0, w * t, h);
        line(0, h * t, w, h * t);
      });
      break;
    case 'phi': {
      const phi = 1 / 1.618;
      line(w * phi, 0, w * phi, h);
      line(0, h * phi, w, h * phi);
      break;
    }
    case 'cross':
      line(w / 2, 0, w / 2, h);
      line(0, h / 2, w, h / 2);
      break;
  }
  ctx.restore();
}

export const renderer = new Renderer();
