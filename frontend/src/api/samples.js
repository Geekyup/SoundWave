import { apiFetch } from './client.js';

export async function listSamples(params = {}) {
  const search = new URLSearchParams(params);
  const response = await apiFetch(`/api/samples/?${search.toString()}`, {
    method: 'GET',
    skipAuth: true,
  });
  if (!response.ok) {
    throw new Error('Failed to load samples');
  }
  return response.json();
}
