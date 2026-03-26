import { apiFetch, apiJson } from './client.js';

export async function listSamples(params = {}) {
  const search = new URLSearchParams(params);
  return apiJson(
    `/api/samples/?${search.toString()}`,
    { method: 'GET', skipAuth: true },
    'Failed to load samples',
  );
}

export async function deleteSample(sampleId) {
  const response = await apiFetch(`/api/samples/${encodeURIComponent(sampleId)}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete sample');
  }
}
