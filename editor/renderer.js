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

    // Background fill — frame bg_color overrides project palette
    ctx.fillStyle = frame.bg_color ?? project.design_tokens?.palette?.background ?? '#000000';
    ctx.fillRect(0, 0, w, h);

    // Background photo — skipped in multi_image mode (image layers render themselves)
    if (!frame.multi_image) {
      const bg = images?.get(frame.image_filename);
      if (bg) _drawCoverImage(ctx, bg, w, h);
    }

    // Layers in declaration order — skip hidden layers
    const globals = project.globals ?? {};
    for (const layer of (frame.layers ?? [])) {
      if (layer.hidden) continue;
      renderLayer(ctx, layer, w, h, images, globals);
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

    // Color wheel affecting-pixels overlay — stacks on top of analysis overlay
    if (opts.colorWheelOverlay) {
      ctx.putImageData(new ImageData(opts.colorWheelOverlay, w, h), 0, 0);
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

const ROTATION_HANDLE_RADIUS = 7;
const ROTATION_HANDLE_OFFSET = 24;

function _drawSelection(ctx, layer, w, h) {
  const b = layer.type === 'text'
    ? computeTextSelectionBounds(ctx, layer, w, h)
    : computeLayerBounds(layer, w, h);
  if (b.width === 0 && b.height === 0) return;

  const isImageType = (layer.type === 'image' || layer.type === 'logo');
  const rotDeg = isImageType ? (layer.rotation_deg ?? 0) : 0;
  const bcx = b.x + b.width  / 2;
  const bcy = b.y + b.height / 2;

  ctx.save();

  if (rotDeg !== 0) {
    ctx.translate(bcx, bcy);
    ctx.rotate(rotDeg * Math.PI / 180);
    ctx.translate(-bcx, -bcy);
  }

  // Selection box
  ctx.strokeStyle = 'rgba(100,160,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(b.x, b.y, b.width, b.height);

  // Corner handles
  const hs = 6;
  ctx.fillStyle = '#64a0ff';
  for (const [hx, hy] of [
    [b.x,           b.y],
    [b.x + b.width, b.y],
    [b.x,           b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }

  // Rotation handle — image/logo layers only (drawn in rotated space)
  if (isImageType) {
    const handleX = b.x + b.width / 2;
    const handleY = b.y - ROTATION_HANDLE_OFFSET;

    // Connector line
    ctx.strokeStyle = 'rgba(100,160,255,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(handleX, b.y);
    ctx.lineTo(handleX, handleY + ROTATION_HANDLE_RADIUS);
    ctx.stroke();

    // Handle circle
    ctx.strokeStyle = 'rgba(100,160,255,0.9)';
    ctx.lineWidth   = 2;
    ctx.fillStyle   = '#1a2a4a';
    ctx.beginPath();
    ctx.arc(handleX, handleY, ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotation arc icon inside circle
    ctx.strokeStyle = '#64a0ff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 3.5, 0.3, Math.PI * 1.7);
    ctx.stroke();
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
