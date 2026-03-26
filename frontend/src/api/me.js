import { apiFetch, getAccessToken } from './client.js';

let meCache = null;
let meCacheToken = '';
let meRequest = null;

function syncCacheToken() {
  const token = getAccessToken() || '';
  if (token !== meCacheToken) {
    meCache = null;
    meRequest = null;
    meCacheToken = token;
  }
  return token;
}

export function clearMeCache() {
  meCache = null;
  meRequest = null;
  meCacheToken = '';
}

export function primeMeCache(profile) {
  meCache = profile || null;
  meRequest = null;
  meCacheToken = getAccessToken() || '';
  return meCache;
}

export async function getMe(options = {}) {
  const { force = false } = options;
  const token = syncCacheToken();

  if (!token) {
    throw new Error('Failed to load profile');
  }

  if (!force && meCache) {
    return meCache;
  }

  if (!force && meRequest) {
    return meRequest;
  }

  meRequest = apiFetch('/api/me/', {
    method: 'GET',
  })
    .then(async response => {
      if (!response.ok) {
        clearMeCache();
        throw new Error('Failed to load profile');
      }

      const profile = await response.json();
      return primeMeCache(profile);
    })
    .finally(() => {
      meRequest = null;
    });

  return meRequest;
}

export async function updateMe(formData) {
  const response = await apiFetch('/api/me/', {
    method: 'PATCH',
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json();
    const message = data.username?.[0] || data.bio?.[0] || data.avatar?.[0] || data.detail;
    throw new Error(message || 'Failed to update profile');
  }
  const profile = await response.json();
  return primeMeCache(profile);
}
