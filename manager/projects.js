// manager/projects.js
import { storage } from '../core/storage.js';
import { showDeleteConfirmModal } from '../ui/modals/delete-confirm-modal.js';
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
   * @param {Function}    deps.onOpenEditor         — called with briefId when user clicks "Open in Editor"
   * @param {Function}    deps.onExport             — called with brief when user clicks "Export Package"
   * @param {Function}    [deps.getCurrentProjectId] — returns the currently open project ID (or null)
   * @param {Function}    [deps.onProjectDeleted]   — called with the deleted project ID
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

      // Show corrupt state if project data is missing or unreadable
      let projectOk = false;
      try { projectOk = !!storage.getProject(brief.id); } catch { /* corrupt */ }
      if (!projectOk) {
        const warn = document.createElement('div');
        warn.style.cssText = 'font-size:11px;color:#f87171;padding:4px 0 0;';
        warn.textContent = '⚠ Project data missing or corrupt';
        card.querySelector('.project-card-details').appendChild(warn);
      }
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
        const brief = storage.getBrief(id);
        if (!brief) return;

        let projectData = null;
        try { projectData = storage.getProject(id); } catch { /* corrupt, still allow delete */ }
        const frameCount = projectData?.frames?.length ?? 0;
        const imageCount = brief.imageCount ?? 0;

        showDeleteConfirmModal(
          { title: brief.title, frameCount, imageCount, updatedAt: brief.updatedAt },
          () => {
            // If this project is currently open in editor, clear state
            if (this.deps.getCurrentProjectId?.() === id) {
              this.deps.onProjectDeleted?.(id);
            }
            storage.deleteProject(id);
            storage.deleteBrief(id); // also calls storage.deleteImages(id)
            this.refresh();
          }
        );
      }
    };

    this.container.addEventListener('click', this._handleClick);
  }
}
