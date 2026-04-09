import { computeLayerBounds } from './layers.js';

/** Hit radius in canvas pixels for corner handle detection. Must match rendered handle visual size. */
const HANDLE_RADIUS = 8;

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

  // Enforce minimum width first, then constrain height to ratio (or floor independently)
  newW = Math.max(newW, minPx);
  newH = (aspectRatio != null) ? newW / aspectRatio : Math.max(newH, minPx);

  // New top-left: if fixed corner is on the right/bottom, subtract new size from it
  const newX = (handle === 'nw' || handle === 'sw') ? fixedX - newW : fixedX;
  const newY = (handle === 'nw' || handle === 'ne') ? fixedY - newH : fixedY;

  return { x: newX, y: newY, width: newW, height: newH };
}

/**
 * Rotate a point (px, py) around center (cx, cy) by angleDeg degrees (clockwise in canvas space).
 * @param {number} px @param {number} py
 * @param {number} cx @param {number} cy
 * @param {number} angleDeg
 * @returns {{ x: number, y: number }}
 */
export function rotatePoint(px, py, cx, cy, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx  = px - cx;
  const dy  = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Compute the canvas position of the rotation handle circle for an image layer.
 * The handle sits 24px above the top-center of the (possibly rotated) bounding box.
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @param {number} angleDeg
 * @returns {{ x: number, y: number }}
 */
export function computeRotationHandlePoint(bounds, angleDeg) {
  const cx = bounds.x + bounds.width  / 2;
  const cy = bounds.y + bounds.height / 2;
  // Unrotated handle: 24px above the top-center of the bounding box
  return rotatePoint(cx, bounds.y - 24, cx, cy, angleDeg);
}

export class DragResize {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/state.js').AppState} state
   * @param {import('./layer-manager.js').LayerManager} layerManager
   * @param {() => void} onRepaint
   */
  constructor(canvas, state, layerManager, onRepaint) {
    this._canvas   = canvas;
    this._state    = state;
    this._lm       = layerManager;
    this._repaint  = onRepaint;

    // Drag state
    this._dragging = false;
    this._startX   = 0;
    this._startY   = 0;
    this._origPos  = null;

    // Resize state
    this._resizing     = false;
    this._resizeHandle = null;  // 'nw' | 'ne' | 'sw' | 'se'
    this._origBounds   = null;  // { x, y, width, height } in canvas px at pointerdown
    this._aspectRatio  = null;  // natural image ratio, null = free

    // Rotate state
    this._rotating            = false;
    this._rotateCenter        = null;  // { x, y } canvas px center of layer
    this._rotateStartAngle    = 0;     // angle (deg) from center to mouse at pointerdown
    this._rotateLayerStartDeg = 0;     // layer.rotation_deg at pointerdown

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
   * Test whether (cx, cy) is within `radius` px of a corner of `bounds`.
   * Returns the handle name ('nw','ne','sw','se') or null.
   */
  _hitHandle(cx, cy, bounds, radius) {
    const { x, y, width, height } = bounds;
    const corners = {
      nw: [x,         y         ],
      ne: [x + width, y         ],
      sw: [x,         y + height],
      se: [x + width, y + height],
    };
    for (const [handle, [hx, hy]] of Object.entries(corners)) {
      if (Math.abs(cx - hx) <= radius && Math.abs(cy - hy) <= radius) return handle;
    }
    return null;
  }

  /** Find the top-most non-hidden layer whose bounding box contains (cx, cy). */
  _hitTest(cx, cy) {
    const frame = this._state.activeFrame;
    if (!frame?.layers) return null;
    const w = this._canvas.width;
    const h = this._canvas.height;
    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      if (layer.hidden) continue;
      const b = computeLayerBounds(layer, w, h);
      let tx = cx, ty = cy;
      const angleDeg = layer.rotation_deg ?? 0;
      if (angleDeg !== 0) {
        const lx = b.x + b.width  / 2;
        const ly = b.y + b.height / 2;
        const u  = rotatePoint(tx, ty, lx, ly, -angleDeg);
        tx = u.x;
        ty = u.y;
      }
      if (tx >= b.x && tx <= b.x + b.width &&
          ty >= b.y && ty <= b.y + b.height) {
        return layer;
      }
    }
    return null;
  }

  _onDown(e) {
    const { x, y } = this._toCanvas(e);
    const w = this._canvas.width;
    const h = this._canvas.height;

    const selId = this._state.selectedLayerId;
    if (selId) {
      const selLayer = this._state.activeFrame?.layers?.find(l => l.id === selId);
      if (selLayer) {
        const bounds  = computeLayerBounds(selLayer, w, h);
        const rotDeg  = selLayer.rotation_deg ?? 0;
        const isImage = selLayer.type === 'image' || selLayer.type === 'logo';

        // ── Rotation handle check (image/logo only, before resize handles) ──
        if (isImage) {
          const hp = computeRotationHandlePoint(bounds, rotDeg);
          if (Math.hypot(x - hp.x, y - hp.y) <= 10) {
            const bCx = bounds.x + bounds.width  / 2;
            const bCy = bounds.y + bounds.height / 2;
            this._rotating            = true;
            this._rotateCenter        = { x: bCx, y: bCy };
            this._rotateStartAngle    = Math.atan2(y - bCy, x - bCx) * 180 / Math.PI;
            this._rotateLayerStartDeg = rotDeg;
            this._canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
          }
        }

        // ── Resize handle check — inverse-rotate mouse first ──
        let mx = x, my = y;
        if (rotDeg !== 0) {
          const bCx = bounds.x + bounds.width  / 2;
          const bCy = bounds.y + bounds.height / 2;
          const u   = rotatePoint(mx, my, bCx, bCy, -rotDeg);
          mx = u.x;
          my = u.y;
        }
        const handle = this._hitHandle(mx, my, bounds, HANDLE_RADIUS);
        if (handle) {
          this._resizing     = true;
          this._resizeHandle = handle;
          this._origBounds   = { ...bounds };

          if (isImage) {
            const img = this._state.images?.get(selLayer.src);
            this._aspectRatio = (img && img.naturalWidth > 0)
              ? img.naturalWidth / img.naturalHeight
              : (selLayer.aspect_ratio ?? null);
          } else {
            this._aspectRatio = null;
          }

          this._canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }
    }

    // Fall through to drag (selection + move)
    const layer = this._hitTest(x, y);
    if (layer) {
      this._lm.selectLayer(layer.id);
      this._dragging = true;
      this._startX   = x;
      this._startY   = y;
      this._origPos  = layer.position ? { ...layer.position } : null;
      this._canvas.setPointerCapture(e.pointerId);
    } else {
      this._lm.selectLayer(null);
    }
    e.preventDefault();
  }

  _onMove(e) {
    const { x, y } = this._toCanvas(e);
    const w = this._canvas.width;
    const h = this._canvas.height;

    // ── Rotate branch ──────────────────────────────────────────────────────
    if (this._rotating) {
      const layer = this._state.activeFrame?.layers?.find(
        l => l.id === this._state.selectedLayerId
      );
      if (!layer) return;
      const { x: cx, y: cy } = this._rotateCenter;
      const currentAngle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
      layer.rotation_deg = this._rotateLayerStartDeg + (currentAngle - this._rotateStartAngle);
      this._repaint();
      return;
    }

    // ── Resize branch ──────────────────────────────────────────────────────
    if (this._resizing) {
      const layer = this._state.activeFrame?.layers?.find(
        l => l.id === this._state.selectedLayerId
      );
      if (!layer) return;

      const minPx = Math.min(w, h) * 0.04;

      // Un-rotate mouse before computing resize — keeps width/height in layer-local space
      let mx = x, my = y;
      const rotDeg = layer.rotation_deg ?? 0;
      if (rotDeg !== 0) {
        const cx = this._origBounds.x + this._origBounds.width  / 2;
        const cy = this._origBounds.y + this._origBounds.height / 2;
        const u  = rotatePoint(mx, my, cx, cy, -rotDeg);
        mx = u.x;
        my = u.y;
      }

      const { x: nx, y: ny, width: nw, height: nh } = computeResizedBounds(
        this._resizeHandle, this._origBounds, mx, my, this._aspectRatio, minPx
      );

      layer.position   = { zone: 'absolute', x_pct: nx / w * 100, y_pct: ny / h * 100 };
      layer.width_pct  = nw / w * 100;
      layer.height_pct = nh / h * 100;
      this._repaint();
      return;
    }

    // ── Drag branch ────────────────────────────────────────────────────────
    if (this._dragging) {
      const dx = x - this._startX;
      const dy = y - this._startY;

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
      return;
    }

    // ── Cursor feedback (no active operation) ──────────────────────────────
    const selId = this._state.selectedLayerId;
    if (selId) {
      const selLayer = this._state.activeFrame?.layers?.find(l => l.id === selId);
      if (selLayer) {
        const bounds  = computeLayerBounds(selLayer, w, h);
        const rotDeg  = selLayer.rotation_deg ?? 0;
        const isImage = selLayer.type === 'image' || selLayer.type === 'logo';

        // Rotation handle cursor
        if (isImage) {
          const hp = computeRotationHandlePoint(bounds, rotDeg);
          if (Math.hypot(x - hp.x, y - hp.y) <= 10) {
            this._canvas.style.cursor = 'grab';
            return;
          }
        }

        // Resize handle cursor (inverse-rotate mouse first)
        let mx = x, my = y;
        if (rotDeg !== 0) {
          const bCx = bounds.x + bounds.width  / 2;
          const bCy = bounds.y + bounds.height / 2;
          const u   = rotatePoint(mx, my, bCx, bCy, -rotDeg);
          mx = u.x;
          my = u.y;
        }
        const handle = this._hitHandle(mx, my, bounds, HANDLE_RADIUS);
        if (handle) {
          this._canvas.style.cursor = (handle === 'nw' || handle === 'se') ? 'nw-resize' : 'ne-resize';
          return;
        }
      }
    }

    const hovered = this._hitTest(x, y);
    this._canvas.style.cursor = hovered ? 'move' : 'default';
  }

  _onUp(e) {
    this._canvas.style.cursor = 'default';
    if (this._rotating && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    } else if (this._resizing && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    } else if (this._dragging && this._state.selectedLayerId != null) {
      this._lm.emitChanged(this._state.activeFrameIndex, this._state.selectedLayerId);
    }
    this._dragging            = false;
    this._resizing            = false;
    this._rotating            = false;
    this._resizeHandle        = null;
    this._origBounds          = null;
    this._aspectRatio         = null;
    this._origPos             = null;
    this._rotateCenter        = null;
    this._rotateStartAngle    = 0;
    this._rotateLayerStartDeg = 0;
  }
}
