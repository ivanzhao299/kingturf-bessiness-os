import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@kingturf/database';
import { PostgresShipmentRepository } from '../src/shipment-repositories.js';

describe('shipment repository segregation', () => {
  it('returns a governed forbidden error before the database backstop for self approval', async () => {
    const actor = {
      companyId: '20000000-0000-4000-8000-000000000002',
      employeeId: '10000000-0000-4000-8000-000000000001',
    };
    const query = vi.fn(() =>
      Promise.resolve({ rows: [{ sequence: 1, created_by: actor.employeeId }], rowCount: 1 }),
    );
    const database = {
      transaction: async <T>(work: (tx: { query: typeof query }) => Promise<T>) => work({ query }),
    } as unknown as Database;
    const repository = new PostgresShipmentRepository(database);
    await expect(
      repository.transition(
        '30000000-0000-4000-8000-000000000003',
        'APPROVED',
        { reason: 'self approval', evidence: {}, idempotencyKey: 'SELF-APPROVAL' },
        { actor, scopes: ['COMPANY'], anchors: [] },
        '40000000-0000-4000-8000-000000000004',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
