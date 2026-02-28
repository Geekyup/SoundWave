import { apiFetch } from './client.js';

export async function listDrumKits(params = {}) {
  const search = new URLSearchParams(params);
  const response = await apiFetch(`/api/drum-kits/?${search.toString()}`, {
    method: 'GET',
    skipAuth: true,
  });
  if (!response.ok) {
    throw new Error('Failed to load drum kits');
  }
  return response.json();
}

export async function getDrumKit(slug, params = {}) {
  const search = new URLSearchParams(params);
  const query = search.toString() ? `?${search.toString()}` : '';
  const response = await apiFetch(`/api/drum-kits/${encodeURIComponent(slug)}/${query}`, {
    method: 'GET',
    skipAuth: true,
  });
  if (!response.ok) {
    throw new Error('Failed to load drum kit');
  }
  return response.json();
}
