import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies, type ApiResponse } from '../src/app.js';
import { projectedReply, routeReply, type RouteAttempts } from '../src/routes/dispatch/context.js';

const scenario = vi.hoisted(() => ({ attempts: (): RouteAttempts => [] }));
vi.mock('../src/routes/dispatch/manufacturing.ts', () => ({
  manufacturingAttempts: () => scenario.attempts(),
}));
const actor = {
  employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};
function fixture() {
  let laterReads = 0;
  const dependencies = {
    auth: { authenticate: () => Promise.resolve({ actor, permissions: new Map() }) },
    organizations: {},
    employees: {},
    manufacturing: {},
    get procurement() {
      laterReads++;
      return undefined;
    },
  };
  const app = buildApp(dependencies as unknown as ApiDependencies);
  return {
    dispatch: () =>
      app.dispatch({
        method: 'GET',
        pathname: '/api/v1/not-a-route',
        headers: { authorization: 'Bearer synthetic-only', 'x-correlation-id': actor.employeeId },
      }),
    reads: () => laterReads,
  };
}
beforeEach(() => {
  scenario.attempts = () => [];
});
describe('actual root consumes each original reply acceptance mode', () => {
  for (const mode of ['non-null', 'truthy'] as const)
    it(mode + ' resumes the same iterator on null', async () => {
      scenario.attempts = function* () {
        yield routeReply(Promise.resolve(null), mode);
        yield projectedReply(Promise.resolve(7), (value) => ({ statusCode: 201, body: value }));
      };
      const f = fixture();
      expect((await f.dispatch()).body).toBe(7);
      expect(f.reads()).toBe(0);
    });
  it('does not construct later attempts or domains after a terminal reply', async () => {
    let late = 0;
    scenario.attempts = function* () {
      yield projectedReply(Promise.resolve(7), (value) => ({ statusCode: 201, body: value }));
      late++;
      yield routeReply(Promise.resolve(null));
    };
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(late).toBe(0);
    expect(f.reads()).toBe(0);
  });
  it('keeps synchronous selection, rejected Promise and projector errors in the root catch', async () => {
    scenario.attempts = function () {
      throw new DomainError('forbidden', 'Selection denied');
    };
    expect((await fixture().dispatch()).statusCode).toBe(403);
    scenario.attempts = function* () {
      yield routeReply(Promise.reject(new DomainError('conflict', 'Rejected operation')));
    };
    expect((await fixture().dispatch()).statusCode).toBe(409);
    scenario.attempts = function* () {
      yield projectedReply(Promise.resolve(7), () => {
        throw new DomainError('not_found', 'Projection denied');
      });
    };
    expect((await fixture().dispatch()).statusCode).toBe(404);
  });
  it('preserves truthy versus non-null for a deliberately malformed internal provider', async () => {
    // Not user input: malformed providers distinguish the two preexisting continuation contracts.
    scenario.attempts = function* () {
      yield routeReply(Promise.resolve(undefined as unknown as ApiResponse), 'truthy');
      yield projectedReply(Promise.resolve(7), (value) => ({ statusCode: 201, body: value }));
    };
    expect((await fixture().dispatch()).body).toBe(7);
    scenario.attempts = function* () {
      yield routeReply(Promise.resolve(undefined as unknown as ApiResponse), 'non-null');
    };
    await expect(fixture().dispatch()).rejects.toBeInstanceOf(TypeError);
  });
  it('an unconditional return does not turn malformed null into a later-route fallback', async () => {
    scenario.attempts = function* () {
      yield projectedReply(Promise.resolve(7), () => null as unknown as ApiResponse);
    };
    const f = fixture();
    await expect(f.dispatch()).rejects.toBeInstanceOf(TypeError);
    expect(f.reads()).toBe(0);
  });
});
