import { exchange } from './http-core';
import type { SessionResponse } from './session';
import { parseSessionRestore } from './shared/session-parser';

export function restoreBrowserSession(): Promise<SessionResponse> {
  return exchange(
    '/api/v1/auth/session',
    { headers: { 'x-kingturf-session-intent': 'restore' } },
    parseSessionRestore,
  );
}
