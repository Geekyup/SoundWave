function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, fallback = '-') {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString() : fallback;
}

export function formatDateTime(value, fallback = '') {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleString() : fallback || value || '';
}
