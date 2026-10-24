import { describe, expect, it } from 'vitest';
import { defineRoute, dispatchRoutes } from '../src/routes/types.js';
import { DomainError } from '@kingturf/domain';

describe('declarative route dispatcher', () => {
  it('runs preflight only after method/path match and before validate/handler', async () => {
    const calls: string[] = [];
    const route = defineRoute({
      method: 'PUT',
      match: (pathname) => (pathname === '/identity' ? { params: [] } : null),
      preflight: () => {
        calls.push('preflight');
        return null;
      },
      validate: () => {
        calls.push('validate');
        return { value: 1 };
      },
      handler: (_request, _match, input) => {
        calls.push('handler');
        return { statusCode: 200, body: input };
      },
    });
    expect(await dispatchRoutes([route], { method: 'GET', pathname: '/identity' })).toBeNull();
    expect(await dispatchRoutes([route], { method: 'PUT', pathname: '/other' })).toBeNull();
    expect(calls).toEqual([]);
    expect(await dispatchRoutes([route], { method: 'PUT', pathname: '/identity' })).toEqual({
      statusCode: 200,
      body: { value: 1 },
    });
    expect(calls).toEqual(['preflight', 'validate', 'handler']);
  });
  it('short-circuits returned responses and thrown preflight failures without validation', async () => {
    const calls: string[] = [];
    const definition = {
      method: 'PUT',
      match: () => ({ params: [] }),
      validate: () => {
        calls.push('validate');
        return undefined;
      },
      handler: () => {
        calls.push('handler');
        return { statusCode: 204, body: {} };
      },
    };
    const unavailable = defineRoute({
      ...definition,
      preflight: () => Promise.resolve({ statusCode: 503, body: {} }),
    });
    expect(await dispatchRoutes([unavailable], { method: 'PUT', pathname: '/x' })).toEqual({
      statusCode: 503,
      body: {},
    });
    const denied = defineRoute({
      ...definition,
      preflight: () => {
        throw new DomainError('forbidden', 'denied');
      },
    });
    await expect(dispatchRoutes([denied], { method: 'PUT', pathname: '/x' })).rejects.toMatchObject(
      { code: 'forbidden' },
    );
    expect(calls).toEqual([]);
  });
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
