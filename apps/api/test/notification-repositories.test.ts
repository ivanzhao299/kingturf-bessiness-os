import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PostgresNotificationRepository } from '../src/notification-repositories.js';

describe('notification repository SQL order', () => {
  it('authorizes before lock/replay and retains the original write sequence', async () => {
    const actor = { companyId: randomUUID(), employeeId: randomUUID() };
    const recipient = randomUUID();
    const eventId = randomUUID();
    const notificationId = randomUUID();
    const row = {
      id: notificationId,
      tenant_id: actor.companyId,
      kind: 'generic',
      title: 'Title',
      message: 'Message',
      subject_type: null,
      subject_id: null,
      idempotency_key: 'notice-1',
      event_id: eventId,
      created_by: actor.employeeId,
      created_at: new Date(),
      normalized_recipients: [recipient],
      semantic_payload: {
        kind: 'generic',
        title: 'Title',
        message: 'Message',
        subjectType: null,
        subjectId: null,
      },
      read_at: null,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: eventId }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const tx = { query };
    const db = {
      transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    };
    const result = await new PostgresNotificationRepository(db as never).create(
      {
        kind: 'generic',
        title: 'Title',
        message: 'Message',
        recipients: [recipient],
        idempotencyKey: 'notice-1',
      },
      actor,
      randomUUID(),
      ['COMPANY'],
    );
    expect(result.id).toBe(notificationId);
    const calls = query.mock.calls as unknown as readonly (readonly [
      string,
      readonly unknown[] | undefined,
    ])[];
    expect(calls.map(([sql]) => sql)).toEqual([
      expect.stringContaining('SELECT count(*)::text count FROM employees'),
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      expect.stringContaining('SELECT n.*,NULL::timestamptz read_at'),
      expect.stringContaining('INSERT INTO domain_event_outbox'),
      expect.stringContaining('INSERT INTO notifications('),
      expect.stringContaining('INSERT INTO notification_recipients'),
      expect.stringContaining('INSERT INTO notification_delivery_attempts'),
      expect.stringContaining('INSERT INTO audit_events'),
    ]);
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining([actor.companyId, [recipient], actor.employeeId]),
    );
    expect(calls[1]?.[1]).toEqual([`${actor.companyId}:notice-1`]);
    expect(calls[2]?.[1]?.slice(0, 2)).toEqual([actor.companyId, 'notice-1']);
  });
});
