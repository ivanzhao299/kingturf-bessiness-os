import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '@kingturf/domain';
import { writeAuditOutbox } from '../src/audit-outbox.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};

describe('writeAuditOutbox', () => {
  it('writes audit then outbox in the caller transaction with preserved argument order', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await writeAuditOutbox({ query }, 'qtc.created', 'quote', 'id-1', 4, actor, 'corr-1', {
      ok: true,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO audit_events');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'qtc.created',
      actor.employeeId,
      actor.companyId,
      'quote',
      'id-1',
      'corr-1',
      { ok: true },
    ]);
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO domain_event_outbox');
    expect(query.mock.calls[1]?.[1]).toEqual([
      actor.companyId,
      'qtc.created',
      'quote',
      'id-1',
      4,
      actor.employeeId,
      'corr-1',
      { ok: true },
    ]);
  });
});
