import { describe, expect, it, vi } from 'vitest';
import { replayCommercialCommand, retainCommercialCommand } from '../src/command-results.js';

describe('command-results primitives', () => {
  it('preserves lock, replay SQL, conflict identity and retain SQL', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const identity = { type: 'X', subjectId: 's', actorId: 'a', requestHash: 'h' };
    await expect(replayCommercialCommand({ query }, 'tenant', 'key', identity)).resolves.toBeNull();
    await retainCommercialCommand({ query }, 'tenant', 'key', identity, { ok: true });
    expect(query.mock.calls[0]?.[1]).toEqual(['tenant:key']);
    expect(query.mock.calls[1]?.[1]).toEqual(['tenant', 'key']);
    expect(query.mock.calls[2]?.[1]).toEqual(['tenant', 'key', 'X', 's', 'a', 'h', { ok: true }]);
  });
});
