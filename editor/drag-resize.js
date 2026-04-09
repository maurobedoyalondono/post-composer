import { computeLayerBounds } from './layers.js';

/**
 * Pure resize math — no DOM, fully testable.
 *
 * @param {'nw'|'ne'|'sw'|'se'} handle — which corner is being dragged
 * @param {{x: number, y: number, width: number, height: number}} origBounds — canvas px snapshot
 * @param {number} mx — current mouse x in canvas pixels
 * @param {number} my — current mouse y in canvas pixels
 * @param {number|null} aspectRatio — width/height ratio to lock; null = free resize
 * @param {number} minPx — minimum dimension in pixels
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function computeResizedBounds(handle, origBounds, mx, my, aspectRatio, minPx) {
  const { x, y, width, height } = origBounds;

  // Fixed corner = opposite of dragged handle
  const fixedX = (handle === 'nw' || handle === 'sw') ? x + width  : x;
  const fixedY = (handle === 'nw' || handle === 'ne') ? y + height : y;

  // Raw new dimensions from fixed corner to mouse
  let newW = Math.abs(mx - fixedX);
  let newH = Math.abs(my - fixedY);

  // Constrain to aspect ratio (height follows width)
  if (aspectRatio != null) newH = newW / aspectRatio;

  // Enforce minimum size
  newW = Math.max(newW, minPx);
  newH = Math.max(newH, minPx);

  // New top-left: if fixed corner is on the right/bottom, subtract new size from it
  const newX = (handle === 'nw' || handle === 'sw') ? fixedX - newW : fixedX;
  const newY = (handle === 'nw' || handle === 'ne') ? fixedY - newH : fixedY;

  return { x: newX, y: newY, width: newW, height: newH };
}

/**
 * Handles pointer-based layer selection and drag-to-reposition on an HTMLCanvasElement.
 *
 * Coordinate model:
 *   CSS mouse coords → canvas full-resolution coords via scaleX/scaleY.
 *   Delta is applied to the original position stored at pointerdown.
 *   During drag: position is mutated directly (no event) and onRepaint() is called.
 *   On pointerup: layerManager.emitChanged() fires layer:changed for inspector/panel to sync.
 */
export class DragResize {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/state.js').AppState} state
   * @param {import('./layer-manager.js').LayerManager} layerManager
   * @param {() => void} onRepaint — called after each position update during drag
   */
  constructor(canvas, state, layerManager, onRepaint) {
    this._canvas    = canvas;
    this._state     = state;
    this._lm        = layerManager;
    this._repaint   = onRepaint;
    this._dragging  = false;
    this._startX    = 0;
    this._startY    = 0;
    this._origPos   = null; // snapshot of layer.position at pointerdown

    canvas.addEventListener('pointerdown',   this._onDown.bind(this));
    canvas.addEventListener('pointermove',   this._onMove.bind(this));
    canvas.addEventListener('pointerup',     this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));
  }

  /** Convert a CSS-space pointer event to canvas pixel coordinates. */
  _toCanvas(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  /**
   * Find the top-most non-hidden layer whose bounding box contains (cx, cy).
   * Tests layers in reverse order (last layer = visually on top).
   */
  _hitTest(cx, cy) {
    const frame = this._state.activeFrame;
    if (!frame?.layers) return null;
    const w = this._canvas.width;
    const h = this._canvas.height;
    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      if (layer.hidden) continue;
      const b = computeLayerBounds(layer, w, h);
      if (cx >= b.x && cx <= b.x + b.width &&
          cy >= b.y && cy <= b.y + b.height) {
        return layer;
      }
    }
    return null;
  }

  _onDown(e) {
    const { x, y } = this._toCanvas(e);
    const layer = this._hitTest(x, y);
    if (layer) {
      this._lm.selectLayer(layer.id);
      this._dragging = true;
      this._startX   = x;
      this._startY   = y;
      // Deep-copy position so we always delta from the original
      this._origPos  = layer.position ? { ...layer.position } : null;
      this._canvas.setPointerCapture(e.pointerId);
    } else {
      this._lm.selectLayer(null);
    }
    e.preventDefault();
  }

  _onMove(e) {
    if (!this._dragging) return;
    const { x, y } = this._toCanvas(e);
    const dx = x - this._startX;
    const dy = y - this._startY;
    const w  = this._canvas.width;
    const h  = this._canvas.height;

    const layer = this._state.activeFrame?.layers?.find(
      l => l.id === this._state.selectedLayerId
    );
    if (!layer) return;

    const pos = this._origPos;
    if (!pos || pos.zone === 'absolute') {
      layer.position = {
        zone:  'absolute',
        x_pct: (pos?.x_pct ?? 0) + (dx / w * 100),
        y_pct: (pos?.y_pct ?? 0) + (dy / h * 100),
      };
    } else {
      layer.position = {
        ...pos,
        offset_x_pct: (pos.offset_x_pct ?? 0) + (dx / w * 100),
        offset_y_pct: (pos.offset_y_pct ?? 0) + (dy / h * 100),
      };
    }
    this._repaint();
  }

  _onUp(e) {
    if (this._dragging && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    }
    this._dragging = false;
    this._origPos  = null;
  }
}
