import { apiFetch } from './client.js';

export async function listLoops(params = {}) {
  const search = new URLSearchParams(params);
  const response = await apiFetch(`/api/loops/?${search.toString()}`, {
    method: 'GET',
    skipAuth: true,
  });
  if (!response.ok) {
    throw new Error('Failed to load loops');
  }
  return response.json();
}
