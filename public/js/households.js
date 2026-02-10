import { api } from './api.js';
import { setCurrentHouseholdId } from './dashboard.js';

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showAlert(container, message, type) {
  const area = container.querySelector('#alert-area');
  if (area) {
    area.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    setTimeout(() => { area.innerHTML = ''; }, 3000);
  }
}

export async function renderHouseholds(container) {
  container.innerHTML = '<div class="text-center text-muted mt-3">Loading households...</div>';

  try {
    const { data: households } = await api.get('/v1/households');

    const householdCards = households.length ? households.map(h => {
      const initial = (h.name || 'H').charAt(0).toUpperCase();
      return `
        <div class="card card-interactive household-card fade-in" data-id="${h.id}">
          <div style="display:flex;align-items:center;gap:1rem">
            <div class="member-avatar" style="width:48px;height:48px;font-size:1.2rem;background:linear-gradient(135deg, var(--primary-light), var(--primary-dark))">${initial}</div>
            <div style="flex:1;min-width:0">
              <div style="font-family:'Poppins',sans-serif;font-weight:600;font-size:1rem">${escapeHtml(h.name)}</div>
              <div class="text-xs text-muted">Household #${h.id}</div>
            </div>
            <span style="color:var(--text-muted);font-size:1.2rem">&#x276F;</span>
          </div>
        </div>`;
    }).join('') : `
      <div class="empty-state">
        <div class="empty-icon">&#x1F3E0;</div>
        <div class="empty-title">No households yet</div>
        <div class="empty-text">Create a household or join one with an invite token.</div>
        <button class="btn btn-outline" id="join-btn-empty" style="margin-top:0.5rem">&#x1F517; Join with Token</button>
      </div>`;

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">Households</h1>
          <p class="page-subtitle">Manage your family groups</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" id="join-btn">&#x1F517; Join</button>
          <button class="btn btn-primary" id="create-btn">&#x2795; Create</button>
        </div>
      </div>

      <div id="create-form" class="card hidden mb-2 fade-in">
        <form id="household-form">
          <div class="form-group">
            <label>Household Name</label>
            <input class="form-input" name="name" placeholder="e.g. Smith Family" maxlength="200" required>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">Create Household</button>
            <button type="button" class="btn btn-ghost" id="cancel-create">Cancel</button>
          </div>
        </form>
      </div>

      <div id="join-form" class="card hidden mb-2 fade-in">
        <form id="join-household-form">
          <div class="form-group">
            <label>Invite Token</label>
            <input class="form-input" name="token" placeholder="Paste your invite token here" required>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">Join Household</button>
            <button type="button" class="btn btn-ghost" id="cancel-join">Cancel</button>
          </div>
        </form>
      </div>

      <div id="alert-area"></div>

      <div id="households-list">${householdCards}</div>
    `;

    // Create form toggle
    container.querySelector('#create-btn').addEventListener('click', () => {
      container.querySelector('#create-form')?.classList.toggle('hidden');
      container.querySelector('#join-form')?.classList.add('hidden');
    });
    container.querySelector('#cancel-create')?.addEventListener('click', () => {
      container.querySelector('#create-form')?.classList.add('hidden');
    });

    // Join form toggle
    const joinBtn = container.querySelector('#join-btn') || container.querySelector('#join-btn-empty');
    joinBtn?.addEventListener('click', () => {
      container.querySelector('#join-form')?.classList.toggle('hidden');
      container.querySelector('#create-form')?.classList.add('hidden');
    });
    container.querySelector('#cancel-join')?.addEventListener('click', () => {
      container.querySelector('#join-form')?.classList.add('hidden');
    });

    // Create household
    container.querySelector('#household-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try {
        const { data } = await api.post('/v1/households', { name });
        setCurrentHouseholdId(data.id);
        await renderHouseholds(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    // Join household
    container.querySelector('#join-household-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = new FormData(e.target).get('token');
      try {
        await api.post('/v1/households/join', { token });
        await renderHouseholds(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    // Household detail click
    container.querySelectorAll('.household-card').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = `#/households/${el.dataset.id}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

export async function renderHouseholdDetail(container, householdId) {
  container.innerHTML = '<div class="text-center text-muted mt-3">Loading household...</div>';

  try {
    const [{ data: household }, { data: members }] = await Promise.all([
      api.get(`/v1/households/${householdId}`),
      api.get(`/v1/households/${householdId}/members`),
    ]);

    const memberRows = members.map(m => {
      const initial = (m.display_name || m.email || 'U').charAt(0).toUpperCase();
      return `
        <div class="member-row">
          <div class="member-avatar">${initial}</div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(m.display_name || m.email || 'User #' + m.user_id)}</div>
            ${m.email ? `<div class="member-email">${escapeHtml(m.email)}</div>` : ''}
          </div>
          <select class="member-role-select role-select" data-user-id="${m.user_id}">
            ${['parent', 'guardian', 'teen', 'kid', 'caregiver'].map(r =>
              `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
            ).join('')}
          </select>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">${escapeHtml(household.name)}</h1>
          <p class="page-subtitle">${members.length} member${members.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="page-header-actions">
          <a href="#/households" class="btn btn-outline">&#x2190; Back</a>
          <button class="btn btn-primary" id="select-household-btn">&#x2713; Use This Household</button>
        </div>
      </div>

      <div id="alert-area"></div>

      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">Members</h3>
        </div>
        <div style="padding:0">${memberRows}</div>
      </div>

      <div class="card fade-in" style="margin-top:1rem">
        <div class="card-header">
          <h3 class="card-title">Invite Member</h3>
        </div>
        <form id="invite-form">
          <div class="form-row">
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
          </div>
          <button type="submit" class="btn btn-primary">Generate Invite Link</button>
        </form>
        <div id="invite-result" class="hidden" style="margin-top:1rem;padding:1rem;background:var(--primary-subtle);border-radius:var(--radius-sm);word-break:break-all"></div>
      </div>
    `;

    // Role change
    container.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        try {
          await api.put(`/v1/households/${householdId}/members/${sel.dataset.userId}`, { role: e.target.value });
          showAlert(container, 'Role updated', 'success');
        } catch (err) {
          showAlert(container, err.message, 'error');
          await renderHouseholdDetail(container, householdId);
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
        resultDiv.innerHTML = `<strong>&#x1F517; Invite Token:</strong><br><code style="font-size:0.85rem;color:var(--primary-dark)">${escapeHtml(data.token)}</code><br><span class="text-xs text-muted">Expires in 48 hours</span>`;
      } catch (err) { showAlert(container, err.message, 'error'); }
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
