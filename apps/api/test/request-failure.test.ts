import { describe, expect, it, vi } from 'vitest';
import { recordRequestFailure } from '../src/request-failure.js';

const request = { method: 'GET', pathname: '/api/v1/purchase-orders/abc' };
const record = (write: ReturnType<typeof vi.fn>) =>
  write.mock.calls[0]?.[0] as {
    event: string;
    error: { name: string; code?: string; frames: readonly string[] };
  };

describe('recordRequestFailure (TD-API-004)', () => {
  it('writes one error record carrying the cause type, its frames, the request and the correlation id', () => {
    const write = vi.fn();
    const cause = new Error('private: column l.item_version_id does not exist');
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    expect(write).toHaveBeenCalledTimes(1);
    const entry = record(write);
    expect(entry).toMatchObject({
      level: 'error',
      event: 'http.request.failed',
      correlationId: 'corr-1',
      statusCode: 500,
      method: 'GET',
      pathname: '/api/v1/purchase-orders/abc',
      error: { name: 'Error' },
    });
    expect(entry.error.frames.length).toBeGreaterThan(0);
    for (const frame of entry.error.frames) expect(frame).toMatch(/^at /u);
  });

  // 日志不携带载荷是既定契约（foundation-api「without payload leakage」）。
  it('never writes the exception message, not even in the first stack line', () => {
    const write = vi.fn();
    const secret = 'do-not-log-this';
    const cause = new TypeError(`cannot read ${secret} of undefined`);
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    const serialized = JSON.stringify(write.mock.calls[0]?.[0]);
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain('"name":"TypeError"');
    expect(serialized).not.toContain('cannot read');
  });

  it('drops message lines of a multi-line exception from the frames', () => {
    const write = vi.fn();
    const cause = new Error('first line\nsecond line with payload\nthird line');
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    for (const frame of record(write).error.frames)
      expect(frame).not.toContain('line with payload');
  });

  it('keeps a system error code such as a SQLSTATE next to the type', () => {
    const write = vi.fn();
    const cause = Object.assign(new Error('relation does not exist'), { code: '42P01' });
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    expect(record(write).error).toMatchObject({ name: 'Error', code: '42P01' });
  });

  it('caps the number and length of frames', () => {
    const write = vi.fn();
    const cause = new Error('deep');
    cause.stack = `Error: deep\n${Array.from({ length: 40 }, () => `   at ${'x'.repeat(500)} (file.ts:1:1)`).join('\n')}`;
    recordRequestFailure({ write }, request, 'corr-1', 500, cause);
    const { frames } = record(write).error;
    expect(frames).toHaveLength(10);
    expect(Math.max(...frames.map((frame) => frame.length))).toBeLessThanOrEqual(240);
  });

  it('describes a thrown non-error by its type only', () => {
    const write = vi.fn();
    recordRequestFailure({ write }, request, 'corr-1', 503, 'dependency unavailable');
    expect(record(write).error).toEqual({ name: 'string', frames: [] });
    expect(JSON.stringify(write.mock.calls[0]?.[0])).not.toContain('dependency unavailable');
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
