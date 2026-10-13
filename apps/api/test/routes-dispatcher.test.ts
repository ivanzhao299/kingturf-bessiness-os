import { describe, expect, it } from 'vitest';
import { defineRoute, dispatchRoutes } from '../src/routes/types.js';

describe('declarative route dispatcher', () => {
  it('matches method and parameterized path, validates, and dispatches once', async () => {
    const calls: string[] = [];
    const routes = [
      defineRoute({
        method: 'POST',
        match: (pathname) =>
          /^\/api\/v1\/sample\/([0-9]+)$/u.test(pathname)
            ? { params: [/^\/api\/v1\/sample\/([0-9]+)$/u.exec(pathname)?.[1] ?? ''] }
            : null,
        validate: (request, match) => {
          const param = match.params[0] ?? 'missing';
          calls.push(`${request.method}:${param}`);
          return { value: param };
        },
        handler: (_request, _match, input) => ({
          statusCode: 201,
          body: input,
        }),
      }),
    ];
    await expect(
      dispatchRoutes(routes, { method: 'POST', pathname: '/api/v1/sample/42', body: {} }),
    ).resolves.toEqual({ statusCode: 201, body: { value: '42' } });
    expect(calls).toEqual(['POST:42']);
    await expect(
      dispatchRoutes(routes, { method: 'GET', pathname: '/api/v1/sample/42' }),
    ).resolves.toBeNull();
  });

  it('supports explicit null validation for bodyless routes', async () => {
    const route = defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/health' ? { params: [] } : null),
      validate: null,
      handler: (_request, _match, input) => ({ statusCode: 204, body: input }),
    });
    await expect(dispatchRoutes([route], { method: 'GET', pathname: '/health' })).resolves.toEqual({
      statusCode: 204,
      body: undefined,
    });
  });
});
