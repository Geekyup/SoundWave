import { apiFetch } from './client.js';

export async function getMe() {
  const response = await apiFetch('/api/me/', {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('Failed to load profile');
  }
  return response.json();
}

export async function updateMe(formData) {
  const response = await apiFetch('/api/me/', {
    method: 'PATCH',
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json();
    const message = data.username?.[0] || data.bio?.[0] || data.avatar?.[0] || data.detail;
    throw new Error(message || 'Failed to update profile');
  }
  return response.json();
}
