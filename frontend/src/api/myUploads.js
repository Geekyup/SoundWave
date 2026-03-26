import { apiJson } from './client.js';

export async function listMyUploads(params = {}) {
  const search = new URLSearchParams(params);
  return apiJson(
    `/api/my-uploads/?${search.toString()}`,
    { method: 'GET' },
    'Failed to load your uploads',
  );
}
