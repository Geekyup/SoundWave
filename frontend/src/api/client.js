const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch (_) {
    return null;
  }
}

function isAccessTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Small safety margin to avoid edge-case flicker around exact expiry time.
  return payload.exp <= nowSeconds + 10;
}

export function getAccessToken() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  if (isAccessTokenExpired(token)) {
    clearTokens();
    return null;
  }
  return token;
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
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (!options.skipAuth && response.status === 401) {
    clearTokens();
  }
  return response;
}
