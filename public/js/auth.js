import { api } from './api.js';

function checkPasswordStrength(password) {
  if (!password || password.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (hasUpper && hasNumber && hasSpecial && password.length >= 12) return 'strong';
  if (hasUpper && hasNumber) return 'medium';
  return 'weak';
}

let pendingEmail = '';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card fade-in">
        <div class="auth-logo">
          <div class="auth-logo-icon">&#x1F3E0;</div>
        </div>
        <h1 class="auth-title">Welcome Back</h1>
        <p class="auth-subtitle">Sign in to your family hub</p>
        <div id="auth-alert"></div>
        <form id="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" class="form-input" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Enter your password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Sign In</button>
        </form>
        <p class="auth-switch">Don't have an account? <a href="#/register">Create one</a></p>
      </div>
    </div>
  `;

  container.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alert = container.querySelector('#auth-alert');
    const email = container.querySelector('#email').value;
    const password = container.querySelector('#password').value;
    try {
      alert.innerHTML = '';
      const data = await api.post('/auth/login', { email, password });
      if (data.requiresTwoFactor) {
        pendingEmail = email;
        window.location.hash = '#/verify-2fa';
      }
    } catch (err) {
      alert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

export function renderRegister(container) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card fade-in">
        <div class="auth-logo">
          <div class="auth-logo-icon">&#x1F46A;</div>
        </div>
        <h1 class="auth-title">Join the Family</h1>
        <p class="auth-subtitle">Create your FamPlanner account</p>
        <div id="auth-alert"></div>
        <form id="register-form">
          <div class="form-group">
            <label for="displayName">Display Name</label>
            <input type="text" id="displayName" class="form-input" placeholder="Your name" autocomplete="name">
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" class="form-input" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Create a strong password" required autocomplete="new-password">
            <div id="password-strength" class="password-strength"></div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Create Account</button>
        </form>
        <p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
      </div>
    </div>
  `;

  const pwInput = container.querySelector('#password');
  const strengthBar = container.querySelector('#password-strength');
  pwInput.addEventListener('input', () => {
    const strength = checkPasswordStrength(pwInput.value);
    strengthBar.className = `password-strength strength-${strength}`;
  });

  container.querySelector('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alert = container.querySelector('#auth-alert');
    const email = container.querySelector('#email').value;
    const password = container.querySelector('#password').value;
    const displayName = container.querySelector('#displayName').value;
    try {
      alert.innerHTML = '';
      await api.post('/auth/register', { email, password, displayName });
      pendingEmail = email;
      window.location.hash = '#/verify-2fa';
    } catch (err) {
      alert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

export function renderVerify2FA(container) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card fade-in">
        <div class="auth-logo">
          <div class="auth-logo-icon">&#x1F512;</div>
        </div>
        <h1 class="auth-title">Verify Email</h1>
        <p class="auth-subtitle">Enter the 6-digit code sent to ${pendingEmail || 'your email'}</p>
        <div id="auth-alert"></div>
        <form id="verify-form">
          <div class="form-group">
            <label for="code">Verification Code</label>
            <input type="text" id="code" class="form-input" maxlength="6" pattern="[0-9]{6}"
              placeholder="000000" required autocomplete="one-time-code"
              style="text-align:center; font-size:1.5rem; letter-spacing:0.5rem; font-family: 'Poppins', sans-serif; font-weight: 700;">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Verify</button>
        </form>
      </div>
    </div>
  `;

  container.querySelector('#verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alert = container.querySelector('#auth-alert');
    const code = container.querySelector('#code').value;
    try {
      alert.innerHTML = '';
      await api.post('/auth/verify-2fa', { email: pendingEmail, code });
      pendingEmail = '';
      window.location.hash = '#/';
    } catch (err) {
      alert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore errors during logout
  }
  window.location.hash = '#/login';
}
