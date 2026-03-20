import { apiJson } from './client.js';

export async function listMyDownloads(params = {}) {
  const search = new URLSearchParams(params);
  return apiJson(
    `/api/my-downloads/?${search.toString()}`,
    { method: 'GET' },
    'Failed to load your downloads',
  );
}
