import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationRepository } from '@kingturf/domain';
import { dispatchAuthorizationRoutes } from '../src/routes/authorization.js';

function fixture() {
  const createRole = vi.fn(async (input: { code: string; name: string }) => {
    // Yield so another request can enter while this handler is pending.
    await Promise.resolve();
    return input;
  });
  const authorizeOneOf = vi.fn();
  const objectBody = vi.fn((body: unknown) => body as Record<string, unknown>);
  const unavailable = vi.fn(() => ({ statusCode: 503, body: {} }));
  const context: Parameters<typeof dispatchAuthorizationRoutes>[0] = {
    repository: { createRole } as unknown as AuthorizationRepository,
    authorization: {
      actor: { companyId: 'company', employeeId: 'employee' },
      permissions: new Map(),
    },
    correlationId: 'correlation',
    authorizeOneOf,
    unavailable,
    parsers: {
      objectBody,
      allow: vi.fn(),
      string: (value) => String(value),
      uuid: (value) => String(value),
      strings: () => [],
    },
  };
  return { context, createRole, authorizeOneOf, objectBody, unavailable };
}

describe('IAM domain wrapper boundaries', () => {
  it('returns null without common prechecks for paths outside the original broad regex', async () => {
    const f = fixture();
    for (const pathname of [
      '/api/v1/roles/',
      '/api/v1/roles/NOT-HEX',
      '/api/v1/user-access-profiles',
    ]) {
      expect(
        await dispatchAuthorizationRoutes(
          { ...f.context, repository: undefined },
          {
            method: 'POST',
            pathname,
            body: null,
          },
        ),
      ).toBeNull();
    }
    expect(f.authorizeOneOf).not.toHaveBeenCalled();
    expect(f.unavailable).not.toHaveBeenCalled();
    expect(f.objectBody).not.toHaveBeenCalled();
    expect(f.createRole).not.toHaveBeenCalled();
  });

  it('keeps concurrent requests body, actor and correlation inputs local', async () => {
    const f = fixture();
    const otherActor = { companyId: 'other-company', employeeId: 'other-employee' };
    const results = await Promise.all([
      dispatchAuthorizationRoutes(f.context, {
        method: 'POST',
        pathname: '/api/v1/roles',
        body: { code: 'first', name: 'First' },
      }),
      dispatchAuthorizationRoutes(
        {
          ...f.context,
          authorization: { ...f.context.authorization, actor: otherActor },
          correlationId: 'other-correlation',
        },
        {
          method: 'POST',
          pathname: '/api/v1/roles',
          body: { code: 'second', name: 'Second' },
        },
      ),
    ]);
    expect(results).toEqual([
      { statusCode: 201, body: { code: 'first', name: 'First' } },
      { statusCode: 201, body: { code: 'second', name: 'Second' } },
    ]);
    expect(f.createRole).toHaveBeenNthCalledWith(
      1,
      { code: 'first', name: 'First' },
      f.context.authorization.actor,
      'correlation',
    );
    expect(f.createRole).toHaveBeenNthCalledWith(
      2,
      { code: 'second', name: 'Second' },
      otherActor,
      'other-correlation',
    );
  });
});
