export function patchSearchParams(searchParams, updates = {}) {
  const next = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
      return;
    }

    next.set(key, String(value));
  });

  return next;
}

export function removeSearchParams(searchParams, keys = [], updates = {}) {
  const next = new URLSearchParams(searchParams);
  keys.forEach(key => next.delete(key));
  return patchSearchParams(next, updates);
}
