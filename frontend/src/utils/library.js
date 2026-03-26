export function getProfileHref(author) {
  const username = (author || '').trim();
  if (!username) return null;
  return `/profile/${encodeURIComponent(username)}`;
}

export function extractKeywordTags(value, max = 5) {
  const raw = (value || '').trim();
  if (!raw) return [];

  const byDelimiter = raw.split(/[,;|]+/).map(item => item.trim()).filter(Boolean);
  const tokens = byDelimiter.length > 1
    ? byDelimiter
    : raw.split(/\s+/).map(item => item.trim()).filter(Boolean);

  const seen = new Set();
  const result = [];
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(token);
    if (result.length >= max) break;
  }
  return result;
}
