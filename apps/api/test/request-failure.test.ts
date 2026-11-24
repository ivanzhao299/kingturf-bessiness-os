import { describe, expect, it, vi } from 'vitest';
import { recordRequestFailure } from '../src/request-failure.js';

const request = { method: 'GET', pathname: '/api/v1/purchase-orders/abc' };

describe('recordRequestFailure (TD-API-004)', () => {
  it('writes one error record carrying the cause, the request and the correlation id', () => {
    const write = vi.fn();
    const cause = new Error('column l.item_version_id does not exist');
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toEqual({
      level: 'error',
      event: 'http.request.failed',
      correlationId: 'corr-1',
      statusCode: 500,
      method: 'GET',
      pathname: '/api/v1/purchase-orders/abc',
      error: { name: 'Error', message: cause.message, stack: cause.stack },
    });
  });

  it('describes a thrown non-error without inventing a stack', () => {
    const write = vi.fn();
    recordRequestFailure({ write }, request, 'corr-1', 503, 'dependency unavailable');
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      statusCode: 503,
      error: { name: 'string', message: 'dependency unavailable' },
    });
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('error.stack');
  });

  it('is a no-op without a logger', () => {
    expect(() => {
      recordRequestFailure(undefined, request, 'corr-1', 500, new Error('x'));
    }).not.toThrow();
  });

  it('never lets a broken logging channel mask the original failure', () => {
    const write = vi.fn(() => {
      throw new Error('log pipe closed');
    });
    expect(() => {
      recordRequestFailure({ write }, request, 'corr-1', 500, new Error('original'));
    }).not.toThrow();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
