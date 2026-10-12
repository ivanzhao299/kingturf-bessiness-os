import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '@kingturf/domain';
import {
  writeAuditOutbox,
  writeCommercialEvidence,
  writeComplaintEvidence,
  writeCrmAuditEvent,
  writeFixedVersionOneEvidence,
  writeProductionNextVersionEvidence,
  writeQualityNextVersionEvidence,
  writeCollectionAudit,
  writeContractAudit,
} from '../src/audit-outbox.js';

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
  it('preserves each pilot domain adapter signature and CRM event aggregate', async () => {
    for (const [run, auditValues, outboxValues] of [
      [
        (q: ReturnType<typeof vi.fn>) =>
          writeCommercialEvidence(
            { query: q },
            'commercial.created',
            actor,
            'id-c',
            2,
            'corr-c',
            { ok: true },
            'custom',
          ),
        [
          'commercial.created',
          actor.employeeId,
          actor.companyId,
          'custom',
          'id-c',
          'corr-c',
          { ok: true },
        ],
        [
          actor.companyId,
          'commercial.created',
          'custom',
          'id-c',
          2,
          actor.employeeId,
          'corr-c',
          { ok: true },
        ],
      ],
      [
        (q: ReturnType<typeof vi.fn>) =>
          writeCrmAuditEvent(
            { query: q },
            'crm.created',
            actor,
            'lead',
            'id-r',
            'corr-r',
            3,
            { ok: true },
            { type: 'customer', id: 'id-a', version: 8 },
          ),
        ['crm.created', actor.employeeId, actor.companyId, 'lead', 'id-r', 'corr-r', { ok: true }],
        [
          actor.companyId,
          'crm.created',
          'customer',
          'id-a',
          8,
          actor.employeeId,
          'corr-r',
          { ok: true },
        ],
      ],
      [
        (q: ReturnType<typeof vi.fn>) =>
          writeComplaintEvidence(
            { query: q },
            'complaint.created',
            'ncr',
            'id-p',
            4,
            { ok: true },
            { actor },
            'corr-p',
          ),
        [
          'complaint.created',
          actor.employeeId,
          actor.companyId,
          'ncr',
          'id-p',
          'corr-p',
          { ok: true },
        ],
        [
          actor.companyId,
          'complaint.created',
          'ncr',
          'id-p',
          4,
          actor.employeeId,
          'corr-p',
          { ok: true },
        ],
      ],
    ]) {
      const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      await (run as (q: ReturnType<typeof vi.fn>) => Promise<void>)(query);
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO audit_events');
      expect(query.mock.calls[0]?.[1]).toEqual(auditValues);
      expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO domain_event_outbox');
      expect(query.mock.calls[1]?.[1]).toEqual(outboxValues);
    }
  });
  it('preserves fixed aggregate_version=1 for MRP and procurement', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await writeFixedVersionOneEvidence(
      { query },
      'mrp.computed',
      'mrp-run',
      'id-1',
      { actor },
      'corr-1',
      { ok: true },
    );
    expect(query.mock.calls[0]?.[1]).toEqual([
      'mrp.computed',
      actor.employeeId,
      actor.companyId,
      'mrp-run',
      'id-1',
      'corr-1',
      { ok: true },
    ]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      actor.companyId,
      'mrp.computed',
      'mrp-run',
      'id-1',
      1,
      actor.employeeId,
      'corr-1',
      { ok: true },
    ]);
  });
  it('preserves next-version SELECT semantics for production and quality', async () => {
    for (const [run, action, aggregateType, id] of [
      [
        writeProductionNextVersionEvidence,
        'production-order.created',
        'production-order',
        'prod-1',
      ],
      [
        writeQualityNextVersionEvidence,
        'quality-inspection.opened',
        'quality-inspection',
        'quality-1',
      ],
    ] as const) {
      const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      await run({ query }, action, id, { actor }, 'corr-next', { ok: true });
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO audit_events');
      expect(query.mock.calls[0]?.[1]).toEqual([
        action,
        actor.employeeId,
        actor.companyId,
        aggregateType,
        id,
        'corr-next',
        { ok: true },
      ]);
      expect(query.mock.calls[1]?.[0]).toContain('SELECT');
      expect(query.mock.calls[1]?.[0]).toContain('max(aggregate_version)');
      expect(query.mock.calls[1]?.[1]).toEqual([
        actor.companyId,
        action,
        aggregateType,
        id,
        actor.employeeId,
        'corr-next',
        { ok: true },
      ]);
    }
  });
  it('preserves collection and contract audit-only parameters', async () => {
    const collectionQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await writeCollectionAudit(
      { query: collectionQuery },
      'collection.created',
      'collection-case',
      'c-1',
      { actor },
      'corr-c',
      { ok: true },
    );
    expect(collectionQuery).toHaveBeenCalledTimes(1);
    expect(collectionQuery.mock.calls[0]?.[0]).toContain('INSERT INTO audit_events');
    expect(collectionQuery.mock.calls[0]?.[1]).toEqual([
      'collection.created',
      'SUCCESS',
      actor.employeeId,
      actor.companyId,
      'collection-case',
      'c-1',
      'corr-c',
      { ok: true },
    ]);
    const contractQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await writeContractAudit(
      { query: contractQuery },
      'contract.created',
      actor,
      'contract',
      'd-1',
      'corr-d',
      { ok: true },
    );
    expect(contractQuery).toHaveBeenCalledTimes(1);
    expect(contractQuery.mock.calls[0]?.[0]).toContain('INSERT INTO audit_events');
    expect(contractQuery.mock.calls[0]?.[1]).toEqual([
      'contract.created',
      'SUCCESS',
      actor.employeeId,
      actor.companyId,
      'contract',
      'd-1',
      'corr-d',
      { ok: true },
    ]);
  });
});
