import { api } from './api.js';
import { setCurrentHouseholdId } from './dashboard.js';

export async function renderHouseholds(container) {
  container.innerHTML = '<p>Loading households...</p>';

  try {
    const { data: households } = await api.get('/v1/households');

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Households</h2>
        <button class="btn btn-primary" id="create-btn">Create Household</button>
      </div>

      <div id="create-form" class="card hidden" style="margin-bottom:1rem">
        <form id="household-form">
          <div class="form-group">
            <label>Household Name</label>
            <input class="form-input" name="name" placeholder="e.g. Smith Family" maxlength="200" required>
          </div>
          <button type="submit" class="btn btn-primary">Create</button>
          <button type="button" class="btn btn-outline" id="cancel-create">Cancel</button>
        </form>
      </div>

      <div id="join-form" class="card hidden" style="margin-bottom:1rem">
        <form id="join-household-form">
          <div class="form-group">
            <label>Invite Token</label>
            <input class="form-input" name="token" placeholder="Paste invite token" required>
          </div>
          <button type="submit" class="btn btn-primary">Join</button>
          <button type="button" class="btn btn-outline" id="cancel-join">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>

      ${households.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No households yet. Create one or join with an invite token.</p><button class="btn btn-outline" id="join-btn-empty" style="margin-top:0.5rem">Join with Token</button></div>'
        : households.map((h) => `
          <div class="card household-card" data-id="${h.id}" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${escapeHtml(h.name)}</strong>
              <span class="badge badge-info">ID: ${h.id}</span>
            </div>
          </div>
        `).join('')}

      ${households.length > 0 ? '<button class="btn btn-outline" id="join-btn" style="margin-top:0.5rem">Join with Token</button>' : ''}
    `;

    // Create form toggle
    container.querySelector('#create-btn').addEventListener('click', () => {
      container.querySelector('#create-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-create')?.addEventListener('click', () => {
      container.querySelector('#create-form').classList.add('hidden');
    });

    // Join form toggle
    const joinBtn = container.querySelector('#join-btn') || container.querySelector('#join-btn-empty');
    joinBtn?.addEventListener('click', () => {
      container.querySelector('#join-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-join')?.addEventListener('click', () => {
      container.querySelector('#join-form').classList.add('hidden');
    });

    // Create household
    container.querySelector('#household-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try {
        const { data } = await api.post('/v1/households', { name });
        setCurrentHouseholdId(data.id);
        renderHouseholds(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Join household
    container.querySelector('#join-household-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = new FormData(e.target).get('token');
      try {
        await api.post('/v1/households/join', { token });
        renderHouseholds(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Household detail click
    container.querySelectorAll('.household-card').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/households/${el.dataset.id}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

export async function renderHouseholdDetail(container, householdId) {
  container.innerHTML = '<p>Loading household...</p>';

  try {
    const [{ data: household }, { data: members }] = await Promise.all([
      api.get(`/v1/households/${householdId}`),
      api.get(`/v1/households/${householdId}/members`),
    ]);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>${escapeHtml(household.name)}</h2>
        <a href="#/households" class="btn btn-outline btn-sm">Back</a>
      </div>

      <div id="alert-area"></div>

      <h3 style="margin-bottom:0.5rem">Members (${members.length})</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            ${members.map((m) => `
              <tr>
                <td>${escapeHtml(m.display_name || m.email || 'User #' + m.user_id)}</td>
                <td><span class="badge badge-info">${escapeHtml(m.role)}</span></td>
                <td>
                  <select class="form-input role-select" data-user-id="${m.user_id}" style="width:auto;display:inline-block;padding:0.2rem 0.4rem;font-size:0.8rem">
                    ${['parent', 'guardian', 'teen', 'kid', 'caregiver'].map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:1.5rem">
        <h3 style="margin-bottom:0.5rem">Invite Member</h3>
        <form id="invite-form" class="card">
          <div class="form-group">
            <label>Email (optional)</label>
            <input class="form-input" name="email" type="email" placeholder="member@example.com">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select class="form-input" name="role">
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="teen">Teen</option>
              <option value="kid">Kid</option>
              <option value="caregiver">Caregiver</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Generate Invite</button>
        </form>
        <div id="invite-result" class="hidden card" style="margin-top:0.5rem;word-break:break-all"></div>
      </div>

      <div style="margin-top:1.5rem">
        <button class="btn btn-primary" id="select-household-btn">Use This Household</button>
      </div>
    `;

    // Role change
    container.querySelectorAll('.role-select').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        try {
          await api.put(`/v1/households/${householdId}/members/${sel.dataset.userId}`, { role: e.target.value });
          showAlert(container, 'Role updated', 'success');
        } catch (err) {
          showAlert(container, err.message, 'error');
          renderHouseholdDetail(container, householdId);
        }
      });
    });

    // Invite
    container.querySelector('#invite-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const { data } = await api.post(`/v1/households/${householdId}/invite`, {
          email: fd.get('email') || undefined,
          role: fd.get('role'),
        });
        const resultDiv = container.querySelector('#invite-result');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<strong>Invite Token:</strong><br><code>${escapeHtml(data.token)}</code><br><small>Expires in 48 hours</small>`;
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Select household
    container.querySelector('#select-household-btn').addEventListener('click', () => {
      setCurrentHouseholdId(parseInt(householdId, 10));
      window.location.hash = '#/dashboard';
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
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
