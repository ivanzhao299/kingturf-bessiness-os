import { SessionState, type SessionContext, type SessionResponse } from '../session';

export function sessionResponse(marker = 'a'): SessionResponse {
  return {
    employeeId: 'employee',
    companyId: 'company',
    displayName: null,
    employeeNumber: null,
    permissions: [],
    generation: marker.repeat(43),
    csrfToken: `v1.s.${marker.repeat(43)}.${marker.repeat(43)}`,
  };
}
export function sessionFixture(marker = 'a'): SessionContext {
  const state = new SessionState();
  const context = state.install(sessionResponse(marker), state.begin());
  if (!context) throw new Error('Test session missing');
  return context;
}
