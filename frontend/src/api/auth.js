import { apiFetch, clearTokens, setTokens } from './client.js';
import { clearMeCache } from './me.js';

export async function login(username, password) {
  const response = await apiFetch('/api/auth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
    skipAuth: true,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Login failed');
  }
  setTokens({ access: data.access, refresh: data.refresh });
  clearMeCache();
  return data;
}

export async function register(username, password, password2) {
  const response = await apiFetch('/api/auth/register/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password, password2 }),
    skipAuth: true,
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.username?.[0] || data.password?.[0] || data.non_field_errors?.[0] || data.detail;
    throw new Error(message || 'Registration failed');
  }
  return data;
}

export function logout() {
  clearMeCache();
  clearTokens();
}
