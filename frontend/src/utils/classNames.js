export function cx(...values) {
  return values.flat().filter(Boolean).join(' ');
}
