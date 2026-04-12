// manager/thumbnail-strip.js

/**
 * Horizontally scrollable thumbnail strip. Shared by BriefWizard and ImageAnnotator.
 *
 * Usage:
 *   const strip = new ThumbnailStrip(imageMeta, (index) => { ... });
 *   container.appendChild(strip.el);
 *   strip.select(2); // jump to third image
 */
export class ThumbnailStrip {
  /**
   * @param {Array<{label: string, dataUrl: string|null}>} images
   * @param {Function} onSelect — called with (index: number) when a thumbnail is clicked
   */
  constructor(images, onSelect) {
    this._images   = images;
    this._onSelect = onSelect;
    this._current  = 0;

    this.el = document.createElement('div');
    this.el.className = 'thumbnail-strip';
    this._render();
  }

  _render() {
    this.el.innerHTML = '';
    this._images.forEach((img, i) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-strip-item' + (i === this._current ? ' is-active' : '');
      item.dataset.index = i;

      if (img.dataUrl) {
        const image = document.createElement('img');
        image.src = img.dataUrl;
        image.alt = img.label ?? '';
        item.appendChild(image);
      } else {
        item.textContent = String(i + 1);
      }

      item.addEventListener('click', () => {
        this._onSelect(i);
        this.select(i);
      });
      this.el.appendChild(item);
    });
  }

  /**
   * Highlight the thumbnail at the given index and scroll it into view.
   * Does NOT call onSelect — use this for programmatic navigation.
   * @param {number} index
   */
  select(index) {
    this._current = index;
    this.el.querySelectorAll('.thumbnail-strip-item').forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
    });
    const active = this.el.querySelector('.thumbnail-strip-item.is-active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
