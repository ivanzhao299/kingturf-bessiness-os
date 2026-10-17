/** Read only presence booleans; never interpret, log or exchange the old bearer value. */
export function clearLegacySession(storage: Pick<Storage, 'getItem' | 'removeItem'>): boolean {
  const legacy = storage.getItem('kingturf.session') !== null;
  const expired = storage.getItem('kingturf.sessionExpired') !== null;
  storage.removeItem('kingturf.session');
  storage.removeItem('kingturf.sessionExpired');
  return legacy || expired;
}
