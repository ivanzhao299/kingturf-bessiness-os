export type SessionDto = Readonly<{
  employeeId: string;
  companyId: string;
  displayName: string | null;
  employeeNumber: string | null;
  permissions: readonly string[];
}>;

/** Match the request's session so a delayed 401 cannot sign out a newer login. */
export function expireSession(
  token: string,
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>,
  reload: () => void,
): boolean {
  if (!token || storage.getItem('kingturf.session') !== token) return false;
  storage.removeItem('kingturf.session');
  storage.setItem('kingturf.sessionExpired', '1');
  reload();
  return true;
}
