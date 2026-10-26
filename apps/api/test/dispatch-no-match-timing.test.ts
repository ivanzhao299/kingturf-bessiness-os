import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';
import type { AuthorizationContext } from '@kingturf/domain';

describe('G5 D/B no-match dependency timing protection', () => {
  it('does not yield between an unavailable manufacturing domain and the procurement root', async () => {
    const context: AuthorizationContext = {
      actor: {
        employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      permissions: new Map([['supplier:read', { scopes: ['COMPANY'], fields: null }]]),
    };
    const original = { list: vi.fn().mockResolvedValue([{ id: 'original' }]) };
    const replacement = { list: vi.fn().mockResolvedValue([{ id: 'replacement' }]) };
    const dependencies = {
      auth: { authenticate: () => Promise.resolve(context) },
      organizations: {},
      employees: {},
      procurement: original,
      get manufacturing() {
        queueMicrotask(() => {
          dependencies.procurement = replacement;
        });
        return undefined;
      },
    };
    const app = buildApp(dependencies as unknown as ApiDependencies);
    const response = await app.dispatch({
      method: 'GET',
      pathname: '/api/v1/suppliers',
      headers: { authorization: 'Bearer mock-timing-only' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ items: [{ id: 'original' }] });
    expect(original.list).toHaveBeenCalledTimes(1);
    expect(replacement.list).not.toHaveBeenCalled();
  });
});
