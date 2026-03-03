import { apiFetch } from './client.js';

export async function listSamples(params = {}) {
  const search = new URLSearchParams(params);
  if (!search.has('include_waveform')) {
    search.set('include_waveform', '1');
  }
  const response = await apiFetch(`/api/samples/?${search.toString()}`, {
    method: 'GET',
    skipAuth: true,
  });
  if (!response.ok) {
    throw new Error('Failed to load samples');
  }
  return response.json();
}

export async function deleteSample(sampleId) {
  const response = await apiFetch(`/api/samples/${encodeURIComponent(sampleId)}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete sample');
  }
}
