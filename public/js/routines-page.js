import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

export async function renderRoutines(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = '<div class="alert alert-error">Select a household first. <a href="#/dashboard">Go to Dashboard</a></div>';
    return;
  }

  container.innerHTML = '<p>Loading routines...</p>';

  try {
    const { data: routines } = await api.get(`/v1/${hId}/routines`);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Routines</h2>
        <button class="btn btn-primary" id="add-routine-btn">Add Routine</button>
      </div>

      <div id="routine-form" class="card hidden" style="margin-bottom:1rem">
        <form id="create-routine-form">
          <div class="form-group">
            <label>Name</label>
            <input class="form-input" name="name" maxlength="200" required>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select class="form-input" name="routineType">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="leaving">Leaving</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="form-group">
            <label><input type="checkbox" name="autoReset"> Auto-reset daily</label>
          </div>
          <button type="submit" class="btn btn-primary">Create</button>
          <button type="button" class="btn btn-outline" id="cancel-routine">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>

      ${routines.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No routines yet.</p></div>'
        : routines.map((r) => renderRoutineCard(r, hId)).join('')}
    `;

    container.querySelector('#add-routine-btn').addEventListener('click', () => {
      container.querySelector('#routine-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-routine')?.addEventListener('click', () => {
      container.querySelector('#routine-form').classList.add('hidden');
    });

    container.querySelector('#create-routine-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api.post(`/v1/${hId}/routines`, {
          name: fd.get('name'),
          routineType: fd.get('routineType'),
          autoReset: fd.get('autoReset') === 'on',
        });
        renderRoutines(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Step complete/uncomplete
    container.querySelectorAll('[data-complete-step]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const [routineId, stepId] = btn.dataset.completeStep.split(':');
        try {
          await api.put(`/v1/${hId}/routines/${routineId}/steps/${stepId}/complete`, {});
          renderRoutines(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    container.querySelectorAll('[data-uncomplete-step]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const [routineId, stepId] = btn.dataset.uncompleteStep.split(':');
        try {
          await api.put(`/v1/${hId}/routines/${routineId}/steps/${stepId}/uncomplete`, {});
          renderRoutines(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    // Add step
    container.querySelectorAll('[data-add-step]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const routineId = form.dataset.addStep;
        const input = form.querySelector('input');
        try {
          await api.post(`/v1/${hId}/routines/${routineId}/steps`, { title: input.value });
          renderRoutines(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    // Delete routine
    container.querySelectorAll('[data-delete-routine]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this routine?')) return;
        try {
          await api.delete(`/v1/${hId}/routines/${btn.dataset.deleteRoutine}`);
          renderRoutines(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderRoutineCard(r, hId) {
  const total = r.steps ? r.steps.length : 0;
  const completed = r.steps ? r.steps.filter((s) => s.is_complete).length : 0;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
        <div>
          <strong>${escapeHtml(r.name)}</strong>
          <span class="badge badge-info" style="margin-left:0.5rem">${escapeHtml(r.routine_type || 'custom')}</span>
          ${r.auto_reset ? '<span class="badge badge-debug" style="margin-left:0.25rem">Auto-reset</span>' : ''}
        </div>
        <button class="btn btn-sm btn-danger" data-delete-routine="${r.id}">Delete</button>
      </div>

      <div style="background:var(--border);border-radius:4px;height:6px;margin-bottom:0.75rem">
        <div style="background:var(--success);height:100%;border-radius:4px;width:${pct}%;transition:width 0.3s"></div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem">${completed}/${total} steps (${pct}%)</div>

      ${r.steps && r.steps.length > 0 ? r.steps.map((s) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">
          ${s.is_complete
            ? `<button class="btn btn-sm btn-outline" data-uncomplete-step="${r.id}:${s.id}" style="font-size:0.7rem;padding:0.15rem 0.4rem">&#10003;</button>`
            : `<button class="btn btn-sm btn-primary" data-complete-step="${r.id}:${s.id}" style="font-size:0.7rem;padding:0.15rem 0.4rem">&#9675;</button>`}
          <span style="${s.is_complete ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${escapeHtml(s.title)}</span>
        </div>
      `).join('') : ''}

      <form data-add-step="${r.id}" style="display:flex;gap:0.5rem;margin-top:0.5rem">
        <input class="form-input" placeholder="Add step..." required style="flex:1">
        <button type="submit" class="btn btn-sm btn-outline">Add</button>
      </form>
    </div>
  `;
}

function showAlert(container, message, type) {
  const area = container.querySelector('#alert-area');
  if (area) {
    area.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    setTimeout(() => { area.innerHTML = ''; }, 3000);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
