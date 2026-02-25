const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem('accessToken', access);
  if (refresh) localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers,
  });
}
