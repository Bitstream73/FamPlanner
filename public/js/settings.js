import { api } from './api.js';

export async function renderSettings(container) {
  container.innerHTML = '<p>Loading settings...</p>';

  try {
    const settings = await api.get('/settings');
    container.innerHTML = `
      <h2>Settings</h2>
      <div id="settings-alert"></div>
      <form id="settings-form" class="card">
        <div class="form-group">
          <label for="theme">Theme</label>
          <select id="theme" class="form-input">
            <option value="system" ${(!settings.theme || settings.theme === 'system') ? 'selected' : ''}>System</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    `;

    container.querySelector('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const alert = container.querySelector('#settings-alert');
      const theme = container.querySelector('#theme').value;
      try {
        await api.put('/settings', { theme });
        applyTheme(theme);
        alert.innerHTML = '<div class="alert alert-success">Settings saved.</div>';
      } catch (err) {
        alert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
