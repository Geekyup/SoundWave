import { apiFetch, apiJson } from './client.js';

export async function listDrumKits(params = {}, options = {}) {
  const { skipAuth = true } = options;
  const search = new URLSearchParams(params);
  return apiJson(
    `/api/drum-kits/?${search.toString()}`,
    { method: 'GET', skipAuth },
    'Failed to load drum kits',
  );
}

export async function getDrumKit(slug, params = {}, options = {}) {
  const { skipAuth = true } = options;
  const search = new URLSearchParams(params);
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiJson(
    `/api/drum-kits/${encodeURIComponent(slug)}/${query}`,
    { method: 'GET', skipAuth },
    'Failed to load drum kit',
  );
}

export async function deleteDrumKit(slug) {
  const response = await apiFetch(`/api/drum-kits/${encodeURIComponent(slug)}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete drum kit');
  }
}
