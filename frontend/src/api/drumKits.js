import { apiFetch } from './client.js';

export async function listDrumKits(params = {}) {
  const search = new URLSearchParams(params);
  const response = await apiFetch(`/api/drum-kits/?${search.toString()}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to load drum kits');
  }
  return response.json();
}

export async function getDrumKit(slug, params = {}) {
  const search = new URLSearchParams(params);
  const query = search.toString() ? `?${search.toString()}` : '';
  const response = await apiFetch(`/api/drum-kits/${encodeURIComponent(slug)}/${query}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to load drum kit');
  }
  return response.json();
}

export async function deleteDrumKit(slug) {
  const response = await apiFetch(`/api/drum-kits/${encodeURIComponent(slug)}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete drum kit');
  }
}
