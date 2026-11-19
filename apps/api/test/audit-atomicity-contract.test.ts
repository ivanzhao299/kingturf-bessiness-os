// A-F1（A1-P2-2）：四处审计双写与业务变更必须同事务（db.transaction 包裹契约）。
import { describe, expect, it, vi } from 'vitest';
import { PostgresBusinessDocumentRepository } from '../src/business-document-repositories.ts';
import { PostgresCommercialRepository } from '../src/commercial-repositories.ts';

type QueryCall = Readonly<{ text: string; values?: readonly unknown[]; outside?: boolean }>;

const fakeTx = (log: QueryCall[]) => ({
  query: vi.fn((text: string, values?: readonly unknown[]) => {
    log.push(values === undefined ? { text } : { text, values });
    return Promise.resolve({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          factorCode: 'F',
          factorName: 'F',
        },
      ],
      rowCount: 1,
    });
  }),
});

const fakeDb = (log: QueryCall[]) => {
  const tx = fakeTx(log);
  return {
    query: vi.fn((text: string, values?: readonly unknown[]) => {
      log.push({ text, ...(values === undefined ? {} : { values }), outside: true });
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    transaction: vi.fn(async (work: (t: unknown) => Promise<unknown>) => work(tx)),
    __tx: tx,
  };
};

const actor = { employeeId: 'actor', companyId: 'company' };
const correlationId = '11111111-1111-4111-8111-111111111111';
const scopes = ['COMPANY'] as const;

describe('A1-P2-2 audit writes share the business transaction', () => {
  it('updateBindings routes mutation and audit through one transaction', async () => {
    const log: QueryCall[] = [];
    const db = fakeDb(log);
    const repo = new PostgresBusinessDocumentRepository(db as never);
    await repo.updateBindings(
      '22222222-2222-4222-8222-222222222222',
      { customerId: null },
      { actor, scopes: ['SELF'] } as never,
      correlationId,
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const texts = log.map((c) => c.text);
    expect(texts.some((t) => t.includes('UPDATE business_documents'))).toBe(true);
    expect(texts.some((t) => t.includes('audit_events') || t.includes('domain_event_outbox'))).toBe(
      true,
    );
    expect(log.every((c) => !('outside' in c))).toBe(true);
  });

  it('createCostMatrix routes evidence through the same transaction', async () => {
    const log: QueryCall[] = [];
    const db = fakeDb(log);
    const repo = new PostgresCommercialRepository(db as never);
    await repo.createCostMatrix(
      { code: 'CM', name: 'CM', productSpecification: {}, currency: 'CNY', defaultTaxRate: '0' },
      actor,
      scopes,
      correlationId,
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const texts = log.map((c) => c.text);
    expect(
      texts.some((t) => t.includes('cost_specification_models') || t.includes('INSERT INTO cost')),
    ).toBe(true);
    expect(texts.some((t) => t.includes('audit_events') || t.includes('domain_event_outbox'))).toBe(
      true,
    );
    expect(log.every((c) => !('outside' in c))).toBe(true);
  });
});
