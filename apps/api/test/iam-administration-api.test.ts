import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';

const actor = { employeeId: randomUUID(), companyId: randomUUID() };
const base = (capabilities: readonly string[]) =>
  ({
    auth: {
      authenticate: vi.fn(() =>
        Promise.resolve({
          actor,
          permissions: new Map(
            capabilities.map((capability) => [capability, { scopes: ['COMPANY'], fields: null }]),
          ),
          scopeAnchors: new Map(),
        }),
      ),
      login: vi.fn(),
      logout: vi.fn(),
    },
    organizations: {},
    employees: {},
  }) as unknown as ApiDependencies;

describe('atomic IAM administration API', () => {
  it('returns consolidated user access profiles with identity read only', async () => {
    const listUserAccessProfiles = vi.fn(() =>
      Promise.resolve([{ employeeId: randomUUID(), roles: [], capabilities: [] }]),
    );
    const response = await buildApp({
      ...base(['identity:read']),
      authorization: { listUserAccessProfiles } as never,
    }).dispatch({
      method: 'GET',
      pathname: '/api/v1/user-access-profiles',
      headers: { authorization: 'Bearer token' },
    });
    expect(response.statusCode).toBe(200);
    expect(listUserAccessProfiles).toHaveBeenCalledWith(actor.companyId);
  });

  it('separates identity management from role management and validates state input', async () => {
    const setIdentityActive = vi.fn((...arguments_: unknown[]) => {
      void arguments_;
      return Promise.resolve();
    });
    const identityId = randomUUID();
    const denied = await buildApp({
      ...base(['role:manage']),
      authorization: { setIdentityActive } as never,
    }).dispatch({
      method: 'PATCH',
      pathname: `/api/v1/identities/${identityId}/state`,
      headers: { authorization: 'Bearer token' },
      body: { active: false, revokeSessions: true },
    });
    expect(denied.statusCode).toBe(403);
    const allowed = await buildApp({
      ...base(['identity:manage']),
      authorization: { setIdentityActive } as never,
    }).dispatch({
      method: 'PATCH',
      pathname: `/api/v1/identities/${identityId}/state`,
      headers: { authorization: 'Bearer token' },
      body: { active: false, revokeSessions: true },
    });
    expect(allowed.statusCode).toBe(204);
    expect(setIdentityActive.mock.calls[0]?.slice(0, 3)).toEqual([identityId, false, true]);
  });
});
