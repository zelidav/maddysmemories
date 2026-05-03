import { Role } from './types';

const ADMIN_KEY = 'mm.admin_token';
const FAMILY_KEY = 'mm.family_token';
const NAME_KEY = 'mm.commenter_name';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_KEY);
}
export function getFamilyToken(): string | null {
  return localStorage.getItem(FAMILY_KEY);
}
export function setAdminToken(t: string) { localStorage.setItem(ADMIN_KEY, t); }
export function setFamilyToken(t: string) { localStorage.setItem(FAMILY_KEY, t); }
export function clearAdmin() { localStorage.removeItem(ADMIN_KEY); }
export function clearFamily() { localStorage.removeItem(FAMILY_KEY); }
export function clearAll() { clearAdmin(); clearFamily(); localStorage.removeItem(NAME_KEY); }

export function getCommenterName(): string {
  return localStorage.getItem(NAME_KEY) || '';
}
export function setCommenterName(n: string) {
  localStorage.setItem(NAME_KEY, n);
}

export function role(): Role {
  if (getAdminToken()) return 'admin';
  if (getFamilyToken()) return 'family';
  return 'guest';
}

export function authHeader(): Record<string, string> {
  const t = getAdminToken() || getFamilyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
