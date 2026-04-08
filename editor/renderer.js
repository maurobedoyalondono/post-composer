// editor/renderer.js
import { renderLayer } from './layers.js';

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

    // Debug / guide overlays
    if (opts.showSafeZone) _drawSafeZone(ctx, w, h);
    if (opts.guideType)    _drawGuide(ctx, w, h, opts.guideType);
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
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(w * m, h * m, w * (1 - 2 * m), h * (1 - 2 * m));
  ctx.restore();
}

function _drawGuide(ctx, w, h, guideType) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
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
