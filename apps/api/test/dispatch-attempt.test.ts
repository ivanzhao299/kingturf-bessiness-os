import { describe, expect, expectTypeOf, it } from 'vitest';
import { projectedReply, routeReply } from '../src/routes/dispatch/context.js';

describe('typed lazy reply pairing', () => {
  it('keeps the exact original promise and defers synchronous projection', async () => {
    let projected = 0;
    const original = Promise.resolve(7);
    const attempt = projectedReply(original, (value) => {
      projected++;
      return { statusCode: 200, body: value };
    });
    expectTypeOf(attempt.pending).toEqualTypeOf<Promise<number>>();
    expect(attempt.pending).toBe(original);
    expect(Object.isFrozen(attempt)).toBe(true);
    expect(projected).toBe(0);
    const value = await attempt.pending;
    expect(projected).toBe(0);
    expect(attempt.project(value)).toEqual({ statusCode: 200, body: 7 });
    expect(projected).toBe(1);
    expect(attempt.accept).toBe('always');
  });
  it('preserves identity, null and the explicit original continuation modes', () => {
    const response = { statusCode: 201, body: { id: 'synthetic' } };
    const attempt = routeReply(Promise.resolve(response));
    expect(attempt.project(response)).toBe(response);
    expect(attempt.project(null)).toBeNull();
    expect(attempt.accept).toBe('non-null');
    expect(routeReply(Promise.resolve(null), 'truthy').accept).toBe('truthy');
  });
  it('does not consume a rejection or swallow a synchronous projection error', async () => {
    const failure = new Error('Synthetic failure');
    const attempt = projectedReply(Promise.reject(failure), () => ({ statusCode: 200, body: {} }));
    await expect(attempt.pending).rejects.toBe(failure);
    const throws = projectedReply(Promise.resolve(1), () => {
      throw failure;
    });
    expect(() => throws.project(1)).toThrow(failure);
  });
});
