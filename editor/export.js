// editor/export.js

/**
 * Export the current canvas as a PNG download.
 * The canvas is already at full export resolution — no re-render needed.
 * @param {HTMLCanvasElement} canvas
 * @param {string} frameId
 */
export function exportFrame(canvas, frameId) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `frame-${frameId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Export all frames as individual PNG downloads.
 * Renders each frame into a temporary canvas at full export resolution.
 * Waits 100 ms between downloads to avoid browser popup blocking.
 *
 * @param {object[]} frames — project.frames array
 * @param {import('../core/state.js').AppState} state
 * @param {import('./renderer.js').Renderer} rendererInstance
 * @param {(i: number, total: number) => void} onProgress — called after each frame
 * @returns {Promise<{ skipped: number }>}
 */
export async function exportAllFrames(frames, state, rendererInstance, onProgress) {
  const total   = frames.length;
  let   skipped = 0;

  for (let i = 0; i < total; i++) {
    const frame = frames[i];

    if (!state.images.has(frame.image_filename)) {
      skipped++;
      onProgress(i + 1, total);
      continue;
    }

    const tempCanvas    = document.createElement('canvas');
    tempCanvas.width    = state.project.export.width_px;
    tempCanvas.height   = state.project.export.height_px;

    // Render clean — no overlays, no selection, no guides
    rendererInstance.renderFrame(tempCanvas, frame, state.project, state.images, {});

    await new Promise(resolve => {
      tempCanvas.toBlob(blob => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `frame-${frame.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });

    onProgress(i + 1, total);
    if (i < total - 1) await new Promise(r => setTimeout(r, 100));
  }

  return { skipped };
}
