import { apiJson } from './client.js';

export async function getProfileSummary(params = {}, options = {}) {
  const { skipAuth = false } = options;
  const search = new URLSearchParams(params);
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiJson(
    `/api/profile-summary/${query}`,
    { method: 'GET', skipAuth },
    'Failed to load profile summary',
  );
}
