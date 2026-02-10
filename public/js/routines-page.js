import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export async function renderRoutines(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">&#x1F504;</div>
        <div class="empty-title">No household selected</div>
        <div class="empty-text">Select a household to view routines.</div>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="text-center text-muted mt-3">Loading routines...</div>';

  try {
    const { data: routines } = await api.get(`/v1/${hId}/routines`);

    const typeColors = { morning: 'badge-warning', evening: 'badge-info', leaving: 'badge-accent', custom: 'badge-neutral' };
    const typeIcons = { morning: '&#x1F305;', evening: '&#x1F31C;', leaving: '&#x1F6B6;', custom: '&#x2699;&#xFE0F;' };

    const routineCards = routines.length ? routines.map(r => {
      const total = r.steps?.length || 0;
      const done = r.steps?.filter(s => s.completedAt).length || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const badgeClass = typeColors[r.routineType] || 'badge-neutral';
      const icon = typeIcons[r.routineType] || '&#x2699;&#xFE0F;';

      const stepsHtml = (r.steps || []).map(s => `
        <div class="routine-step">
          <button class="step-check ${s.completedAt ? 'done' : ''}" data-routine="${r.id}" data-step="${s.id}" data-done="${s.completedAt ? '1' : '0'}">&#x2713;</button>
          <span class="step-name ${s.completedAt ? 'done' : ''}">${escapeHtml(s.name)}</span>
        </div>`).join('');

      return `
        <div class="routine-card fade-in">
          <div class="routine-header">
            <div>
              <span class="routine-name">${escapeHtml(r.name)}</span>
              <span class="badge ${badgeClass}" style="margin-left:0.5rem">${icon} ${escapeHtml(r.routineType)}</span>
            </div>
            <div style="display:flex;gap:0.35rem;align-items:center">
              <span class="text-xs text-muted">${done}/${total}</span>
              <button class="btn btn-ghost btn-xs" data-delete-routine="${r.id}" title="Delete">&#x1F5D1;</button>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="routine-steps">${stepsHtml}</div>
          <div style="margin-top:0.75rem">
            <form class="form-inline add-step-form" data-routine="${r.id}">
              <div class="form-group">
                <input class="form-input" name="stepName" placeholder="Add a step..." required style="font-size:0.82rem">
              </div>
              <button type="submit" class="btn btn-sm btn-outline">Add</button>
            </form>
          </div>
        </div>`;
    }).join('') : `
      <div class="empty-state">
        <div class="empty-icon">&#x1F504;</div>
        <div class="empty-title">No routines yet</div>
        <div class="empty-text">Create a morning, evening, or custom routine to get started.</div>
      </div>`;

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">Routines</h1>
          <p class="page-subtitle">Daily habits for your family</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="new-routine-btn">&#x2795; New Routine</button>
        </div>
      </div>

      <div id="routine-form" class="card hidden mb-2 fade-in">
        <form id="create-routine-form">
          <div class="form-row">
            <div class="form-group">
              <label>Routine Name</label>
              <input class="form-input" name="name" placeholder="e.g. Morning Checklist" required>
            </div>
            <div class="form-group">
              <label>Type</label>
              <select class="form-input" name="routineType">
                <option value="morning">&#x1F305; Morning</option>
                <option value="evening">&#x1F31C; Evening</option>
                <option value="leaving">&#x1F6B6; Leaving</option>
                <option value="custom">&#x2699;&#xFE0F; Custom</option>
              </select>
            </div>
          </div>
          <label class="form-checkbox mb-2">
            <input type="checkbox" name="autoReset"> Auto-reset daily
          </label>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">Create Routine</button>
            <button type="button" class="btn btn-ghost" id="cancel-routine">Cancel</button>
          </div>
        </form>
      </div>

      <div id="routine-list">${routineCards}</div>
    `;

    // Toggle form
    container.querySelector('#new-routine-btn')?.addEventListener('click', () => {
      container.querySelector('#routine-form')?.classList.toggle('hidden');
    });
    container.querySelector('#cancel-routine')?.addEventListener('click', () => {
      container.querySelector('#routine-form')?.classList.add('hidden');
    });

    // Create routine
    container.querySelector('#create-routine-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api.post(`/v1/${hId}/routines`, {
        name: fd.get('name'),
        routineType: fd.get('routineType'),
        autoReset: fd.get('autoReset') === 'on',
      });
      await renderRoutines(container);
    });

    // Step complete/uncomplete
    container.querySelectorAll('.step-check').forEach(btn => {
      btn.addEventListener('click', async () => {
        const rId = btn.dataset.routine;
        const sId = btn.dataset.step;
        const isDone = btn.dataset.done === '1';
        const action = isDone ? 'uncomplete' : 'complete';
        await api.put(`/v1/${hId}/routines/${rId}/steps/${sId}/${action}`);
        await renderRoutines(container);
      });
    });

    // Add step
    container.querySelectorAll('.add-step-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rId = form.dataset.routine;
        const name = new FormData(form).get('stepName');
        await api.post(`/v1/${hId}/routines/${rId}/steps`, { name });
        await renderRoutines(container);
      });
    });

    // Delete routine
    container.querySelectorAll('[data-delete-routine]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this routine?')) return;
        await api.delete(`/v1/${hId}/routines/${btn.dataset.deleteRoutine}`);
        await renderRoutines(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
