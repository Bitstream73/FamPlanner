import { api } from './api.js';

let currentFilters = { page: 1, limit: 50 };

export async function renderLogs(container) {
  container.innerHTML = '<p>Loading logs...</p>';
  currentFilters = { page: 1, limit: 50 };
  await loadLogs(container);
}

async function loadLogs(container) {
  try {
    const [logsData, stats] = await Promise.all([
      api.get(buildQueryString()),
      api.get('/logs/stats'),
    ]);

    container.innerHTML = `
      <h2>Application Logs</h2>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.errorCount24h}</div>
          <div class="stat-label">Errors (24h)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.warningCount24h}</div>
          <div class="stat-label">Warnings (24h)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.requestsPerHour}</div>
          <div class="stat-label">Requests/Hour</div>
        </div>
      </div>

      <div class="filters">
        <button class="filter-btn ${!currentFilters.level ? 'active' : ''}" data-level="">All</button>
        <button class="filter-btn ${currentFilters.level === 'error' ? 'active' : ''}" data-level="error">Error</button>
        <button class="filter-btn ${currentFilters.level === 'warn' ? 'active' : ''}" data-level="warn">Warn</button>
        <button class="filter-btn ${currentFilters.level === 'info' ? 'active' : ''}" data-level="info">Info</button>
        <button class="filter-btn ${currentFilters.level === 'debug' ? 'active' : ''}" data-level="debug">Debug</button>
        <input type="text" id="log-search" class="form-input" placeholder="Search logs..."
          style="max-width:200px" value="${currentFilters.search || ''}">
        <button id="export-btn" class="btn btn-sm btn-outline">Export CSV</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Category</th>
              <th>Action</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody id="logs-body">
            ${logsData.logs.map((log) => `
              <tr data-log='${escapeAttr(JSON.stringify(log))}' style="cursor:pointer">
                <td>${formatTime(log.timestamp)}</td>
                <td><span class="badge badge-${log.level}">${log.level}</span></td>
                <td>${escapeHtml(log.category)}</td>
                <td>${escapeHtml(log.action)}</td>
                <td>${log.duration !== null ? `${log.duration}ms` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="pagination">
        ${logsData.page > 1 ? '<button class="btn btn-sm btn-outline" id="prev-page">Prev</button>' : ''}
        <span style="padding:0.25rem 0.5rem">${logsData.page} / ${logsData.totalPages}</span>
        ${logsData.page < logsData.totalPages ? '<button class="btn btn-sm btn-outline" id="next-page">Next</button>' : ''}
      </div>
    `;

    bindEvents(container);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function bindEvents(container) {
  container.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilters.level = btn.dataset.level || undefined;
      currentFilters.page = 1;
      loadLogs(container);
    });
  });

  let debounceTimer;
  const searchInput = container.querySelector('#log-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilters.search = searchInput.value || undefined;
        currentFilters.page = 1;
        loadLogs(container);
      }, 300);
    });
  }

  const prevBtn = container.querySelector('#prev-page');
  const nextBtn = container.querySelector('#next-page');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentFilters.page--; loadLogs(container); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentFilters.page++; loadLogs(container); });

  container.querySelector('#export-btn')?.addEventListener('click', async () => {
    const blob = await api.get('/logs/export');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelectorAll('#logs-body tr').forEach((row) => {
    row.addEventListener('click', () => {
      const log = JSON.parse(row.dataset.log);
      showLogDetail(log);
    });
  });
}

function showLogDetail(log) {
  const modal = document.getElementById('modal-content');
  const overlay = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <h3 style="margin-bottom:1rem">${escapeHtml(log.action)}</h3>
    <table style="width:100%">
      <tr><td style="font-weight:600">Timestamp</td><td>${log.timestamp}</td></tr>
      <tr><td style="font-weight:600">Level</td><td><span class="badge badge-${log.level}">${log.level}</span></td></tr>
      <tr><td style="font-weight:600">Category</td><td>${escapeHtml(log.category)}</td></tr>
      <tr><td style="font-weight:600">Request ID</td><td>${log.request_id || '-'}</td></tr>
      <tr><td style="font-weight:600">IP</td><td>${log.ip_address || '-'}</td></tr>
      <tr><td style="font-weight:600">Duration</td><td>${log.duration !== null ? `${log.duration}ms` : '-'}</td></tr>
      ${log.error ? `<tr><td style="font-weight:600">Error</td><td style="color:var(--error)">${escapeHtml(log.error)}</td></tr>` : ''}
      <tr><td style="font-weight:600">Details</td><td><pre style="white-space:pre-wrap;font-size:0.8rem">${escapeHtml(log.details || '{}')}</pre></td></tr>
    </table>
  `;
  overlay.classList.remove('hidden');
}

function buildQueryString() {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentFilters)) {
    if (v !== undefined) params.set(k, v);
  }
  return `/logs?${params.toString()}`;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
