// manager/shell.js
import { BriefWizard }  from './brief-wizard.js';
import { ProjectList }  from './projects.js';
import { exportPackage } from './exporter.js';
import { slugify, PLATFORMS, TONES } from './constants.js';
import { router }       from '../core/router.js';
import { storage }      from '../core/storage.js';

/**
 * Mount the Project Manager into #manager-view.
 * @param {import('../core/state.js').AppState} state
 */
export function mountManager(state) {
  const root = document.getElementById('manager-view');
  if (!root) throw new Error('#manager-view not found');
  root.innerHTML = _buildHTML();

  const listEl   = root.querySelector('.project-list');
  const wizardEl = root.querySelector('.wizard-host');

  // Forward-declare projectList so the wizard's save callback can call refresh().
  let projectList;

  const wizard = new BriefWizard(wizardEl, () => {
    projectList.refresh();
  });

  projectList = new ProjectList(listEl, {
    wizard,
    onOpenEditor: (briefId) => {
      state.activeBriefId = briefId;
      storage.savePrefs({ ...storage.getPrefs(), lastBriefId: briefId });
      router.navigate('editor');
    },
    onExport: async (brief) => {
      const platform = PLATFORMS.find(p => p.id === brief.platform);
      const tone     = TONES.find(t => t.id === brief.tone);
      const platformLabel = platform ? platform.label : brief.platform;
      const toneLabel     = tone ? tone.label : brief.tone;
      const slug = slugify(brief.title);
      try {
        await exportPackage(brief, brief.imageMeta ?? [], platformLabel, toneLabel, slug);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    },
    getCurrentProjectId: () => state.activeBriefId,
    onProjectDeleted: (deletedId) => {
      state.activeBriefId = null;
      state.setProject(null);
      storage.savePrefs({ ...storage.getPrefs(), lastBriefId: null });
    },
  });

  root.querySelector('#btn-new-project').addEventListener('click', () => wizard.open());
}

function _buildHTML() {
  return `
    <div class="manager-shell">
      <div class="manager-header">
        <h1 class="manager-title">Post-Composer</h1>
        <button id="btn-new-project" class="btn btn-primary">+ New Project</button>
      </div>
      <div class="manager-body">
        <div class="project-list"></div>
      </div>
      <div class="wizard-host"></div>
    </div>
  `;
}
