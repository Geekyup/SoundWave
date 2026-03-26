import { apiFetch, apiJson } from './client.js';

export async function listLoops(params = {}) {
  const search = new URLSearchParams(params);
  return apiJson(
    `/api/loops/?${search.toString()}`,
    { method: 'GET', skipAuth: true },
    'Failed to load loops',
  );
}

export async function deleteLoop(loopId) {
  const response = await apiFetch(`/api/loops/${encodeURIComponent(loopId)}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete loop');
  }
}
