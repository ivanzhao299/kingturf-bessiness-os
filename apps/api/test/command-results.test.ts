import { describe, expect, it, vi } from 'vitest';
import {
  lockCommercialCommand,
  replayCommercialCommand,
  replayCommercialCommandAfterLock,
  retainCommercialCommand,
} from '../src/command-results.js';

describe('command-results primitives', () => {
  const lockSql = 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))';
  const selectSql =
    'SELECT command_type,subject_id,actor_id,request_hash,payload FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2';
  const insertSql =
    'INSERT INTO commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)';
  it('exposes explicit lock and replay-after-lock stages', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const identity = { type: 'X', subjectId: 's', actorId: 'a', requestHash: 'h' };
    await lockCommercialCommand({ query }, 'tenant', 'key');
    await expect(
      replayCommercialCommandAfterLock({ query }, 'tenant', 'key', identity),
    ).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toBe(lockSql);
    expect(query.mock.calls[0]?.[1]).toEqual(['tenant:key']);
    expect(query.mock.calls[1]?.[0]).toBe(selectSql);
    expect(query.mock.calls[1]?.[1]).toEqual(['tenant', 'key']);
  });
  it('preserves lock, replay SQL, conflict identity and retain SQL', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const identity = { type: 'X', subjectId: 's', actorId: 'a', requestHash: 'h' };
    await expect(replayCommercialCommand({ query }, 'tenant', 'key', identity)).resolves.toBeNull();
    await retainCommercialCommand({ query }, 'tenant', 'key', identity, { ok: true });
    expect(query.mock.calls[0]?.[0]).toBe(lockSql);
    expect(query.mock.calls[1]?.[0]).toBe(selectSql);
    expect(query.mock.calls[2]?.[0]).toBe(insertSql);
    expect(query.mock.calls[0]?.[1]).toEqual(['tenant:key']);
    expect(query.mock.calls[1]?.[1]).toEqual(['tenant', 'key']);
    expect(query.mock.calls[2]?.[1]).toEqual(['tenant', 'key', 'X', 's', 'a', 'h', { ok: true }]);
  });
  it('returns prior payload and rejects each identity mismatch without retain', async () => {
    const identity = { type: 'X', subjectId: 's', actorId: 'a', requestHash: 'h' };
    const prior = {
      command_type: 'X',
      subject_id: 's',
      actor_id: 'a',
      request_hash: 'h',
      payload: { answer: 42 },
    };
    await expect(
      replayCommercialCommand(
        {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [prior] }),
        },
        'tenant',
        'key',
        identity,
      ),
    ).resolves.toEqual(prior.payload);
    for (const mismatch of ['type', 'subjectId', 'actorId', 'requestHash'] as const) {
      const bad = { ...identity, [mismatch]: `${identity[mismatch]}-bad` };
      const query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [prior] });
      await expect(replayCommercialCommand({ query }, 'tenant', 'key', bad)).rejects.toMatchObject({
        code: 'conflict',
      });
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0]?.[0]).toBe(lockSql);
      expect(query.mock.calls[1]?.[0]).toBe(selectSql);
    }
  });
});
