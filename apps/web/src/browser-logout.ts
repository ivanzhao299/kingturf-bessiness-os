import { json } from './http';
import type { SessionContext } from './session';
export function logoutBrowserSession(context: SessionContext): Promise<void> {
  return json('/api/v1/auth/logout', context, { method: 'POST' });
}
