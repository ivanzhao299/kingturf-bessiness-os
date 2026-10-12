/* eslint-disable @typescript-eslint/require-await -- mocked async transaction boundary preserves ordering assertions. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PostgresBusinessObjectRepository } from '../src/business-object-repositories.js';

describe('business object repository SQL order', () => {
  it('creates definition, version, event, and audit in transaction order', async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const definitionId = randomUUID();
    const versionId = randomUUID();
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith('INSERT INTO business_object_definitions'))
        return {
          rows: [
            {
              id: definitionId,
              tenant_id: tenantId,
              code: 'CUSTOMER',
              name: 'Customer',
              version: 1,
            },
          ],
          rowCount: 1,
        };
      if (sql.startsWith('INSERT INTO business_object_versions'))
        return {
          rows: [
            {
              id: versionId,
              tenant_id: tenantId,
              definition_id: definitionId,
              version: 1,
              status: 'DRAFT',
              schema: { fields: [] },
              created_at: new Date(),
              published_at: null,
            },
          ],
          rowCount: 1,
        };
      return { rows: [{ id: randomUUID() }], rowCount: 1 };
    });
    const db = {
      transaction: (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }),
    };
    const result = await new PostgresBusinessObjectRepository(db as never).create(
      'CUSTOMER',
      'Customer',
      { fields: [] },
      { companyId: tenantId, employeeId: actorId },
      randomUUID(),
    );
    expect(result.id).toBe(definitionId);
    expect(calls[0]).toContain('INSERT INTO business_object_definitions');
    expect(calls[1]).toContain('INSERT INTO business_object_versions');
    expect(calls[2]).toContain('INSERT INTO domain_event_outbox');
    expect(calls[3]).toContain('INSERT INTO audit_events');
  });
});
