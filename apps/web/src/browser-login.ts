import { json } from './http';
import type { LoginProof } from './session';
import { parseLoginProof, parseLoginResponse } from './shared/login-parser';
import { LoginCoordinator, type LoginProgress } from './login-flow';

export function submitBrowserLogin(
  login: string,
  password: string,
  authenticated: () => void,
  initialize: () => Promise<void>,
  progress: (value: LoginProgress) => void,
): Promise<boolean> {
  const coordinator = new LoginCoordinator(async () => {
    await authenticateBrowser(login, password);
    authenticated();
  }, initialize);
  return coordinator.submit(login, password, progress);
}

/** Needed only after the user submits credentials, not by the initial login screen. */
export async function authenticateBrowser(login: string, password: string): Promise<void> {
  const proof = await json<LoginProof>(
    '/api/v1/auth/login-context',
    null,
    { headers: { 'x-kingturf-session-intent': 'login' } },
    parseLoginProof,
  );
  await json(
    '/api/v1/auth/login',
    proof,
    { method: 'POST', body: JSON.stringify({ login, password }) },
    parseLoginResponse,
  );
}
