// manager/projects.js
import { storage } from '../core/storage.js';
import { PLATFORMS, TONES } from './constants.js';

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts) {
  if (!ts) return 'Unknown';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export class ProjectList {
  /**
   * @param {HTMLElement} container   — element to render the list into
   * @param {object}      deps        — injected dependencies
   * @param {BriefWizard} deps.wizard — the BriefWizard instance
   * @param {Function}    deps.onOpenEditor — called with briefId when user clicks "Open in Editor"
   * @param {Function}    deps.onExport     — called with brief when user clicks "Export Package"
   */
  constructor(container, deps) {
    this.container = container;
    this.deps = deps;
    this.refresh();
  }

  /** Re-render the list from storage. */
  refresh() {
    // Remove any existing delegated listener before rendering (handles empty-state early-return).
    if (this._handleClick) {
      this.container.removeEventListener('click', this._handleClick);
      this._handleClick = null;
    }

    const entries = storage.listBriefs();
    this.container.innerHTML = '';

    if (entries.length === 0) {
      this.container.innerHTML = `
        <div class="project-list-empty">
          <p>No projects yet.</p>
          <p>Click <strong>New Project</strong> to get started.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const brief of entries) {
      const platformEntry = PLATFORMS.find(p => p.id === brief.platform);
      const toneEntry = TONES.find(t => t.id === brief.tone);
      const platformLabel = platformEntry ? platformEntry.label : (brief.platform || '—');
      const toneLabel = toneEntry ? toneEntry.label : (brief.tone || '—');
      const imageCount = brief.imageCount ?? 0;

      const card = document.createElement('div');
      card.className = 'project-card';
      card.dataset.id = brief.id;
      card.innerHTML = `
        <div class="project-card-header">
          <h3 class="project-card-title">${escHtml(brief.title)}</h3>
          <span class="project-card-meta">${escHtml(platformLabel)} &middot; ${escHtml(toneLabel)}</span>
        </div>
        <div class="project-card-details">
          <span>${imageCount} ${imageCount === 1 ? 'image' : 'images'}</span>
          <span>Updated ${formatDate(brief.updatedAt)}</span>
        </div>
        <div class="project-card-actions">
          <button class="btn btn-primary btn-open"   data-id="${escHtml(brief.id)}">Open in Editor</button>
          <button class="btn btn-secondary btn-edit"   data-id="${escHtml(brief.id)}">Edit Brief</button>
          <button class="btn btn-secondary btn-export" data-id="${escHtml(brief.id)}">Export Package</button>
          <button class="btn btn-danger btn-delete"  data-id="${escHtml(brief.id)}">Delete</button>
        </div>`;

      fragment.appendChild(card);
    }

    this.container.appendChild(fragment);

    // Wire button clicks via event delegation on the container.
    this._handleClick = (e) => {
      const btn = e.target.closest('button[data-id]');
      if (!btn) return;

      const id = btn.dataset.id;

      if (btn.classList.contains('btn-open')) {
        this.deps.onOpenEditor(id);

      } else if (btn.classList.contains('btn-edit')) {
        const fullBrief = storage.getBrief(id);
        if (fullBrief) {
          this.deps.wizard.openEdit(fullBrief);
        }

      } else if (btn.classList.contains('btn-export')) {
        const fullBrief = storage.getBrief(id);
        if (fullBrief) {
          this.deps.onExport(fullBrief);
        }

      } else if (btn.classList.contains('btn-delete')) {
        const briefForDelete = storage.getBrief(id);
        const title = briefForDelete ? briefForDelete.title : id;
        if (confirm(`Delete project "${title}"? This cannot be undone.`)) {
          storage.deleteBrief(id);
          this.refresh();
        }
      }
    };

    this.container.addEventListener('click', this._handleClick);
  }
}
