import { expect, type Page } from '@playwright/test';

// Shape-only synthetic fixtures, never real server proofs or API authorization evidence.
export const syntheticGeneration = 'g'.repeat(43);
export const syntheticCsrf = `v1.s.${'a'.repeat(43)}.${'b'.repeat(43)}`;
const syntheticLoginCsrf = `v1.l.1.${'c'.repeat(43)}.${'d'.repeat(43)}`;

export function sessionResponse(session: Record<string, unknown>) {
  return { ...session, generation: syntheticGeneration, csrfToken: syntheticCsrf };
}

export async function seedSyntheticCookies(page: Page) {
  const domain = new URL(process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:4173').hostname;
  await page.context().addCookies([
    {
      name: '__Host-kingturf-session',
      value: 'synthetic-browser-fixture-only',
      domain,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: '__Host-kingturf-csrf',
      value: syntheticCsrf,
      domain,
      path: '/',
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function installSyntheticLogin(
  page: Page,
  session: Record<string, unknown>,
  options: { delayMs?: number; onLogin?: () => void } = {},
) {
  let authenticated = false;
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/login-context') {
      expect(route.request().headers()['x-kingturf-session-intent']).toBe('login');
      return route.fulfill({ json: { csrfToken: syntheticLoginCsrf } });
    }
    if (path === '/api/v1/auth/login') {
      options.onLogin?.();
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-kingturf-csrf']).toBe(syntheticLoginCsrf);
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      await seedSyntheticCookies(page);
      authenticated = true;
      return route.fulfill({
        json: {
          expiresAt: '2099-01-01T00:00:00.000Z',
          generation: syntheticGeneration,
          csrfToken: syntheticCsrf,
        },
      });
    }
    if (path === '/api/v1/auth/session') {
      expect(route.request().headers()['x-kingturf-session-intent']).toBe('restore');
      if (!authenticated)
        return route.fulfill({ status: 401, json: { error: { message: 'No synthetic session' } } });
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      return route.fulfill({ json: sessionResponse(session) });
    }
    // Never leak an unrecognised auth request to the real local API.
    return route.abort('blockedbyclient');
  });
}

export async function installSyntheticColdStart(page: Page) {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ status: 401, json: { error: { message: 'No synthetic session' } } }),
  );
  await page.route('**/api/v1/auth/login-context', (route) =>
    route.fulfill({ json: { csrfToken: syntheticLoginCsrf } }),
  );
}
