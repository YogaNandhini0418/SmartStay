// Shared account email policy: used by inline forms and backend validation.
// Account identities are independent of roll numbers, employee IDs and roles.
export const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (normalized.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) return false;
  const local = normalized.slice(0, normalized.indexOf('@'));
  return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}
export const isValidAccountEmail = isValidEmail;
