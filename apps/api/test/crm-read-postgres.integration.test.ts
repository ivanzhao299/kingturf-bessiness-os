import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCrmRepository } from '../src/crm-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const id = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

// TD-TEST-022：U3-CRM-1..4 新增的八个加性只读方法此前只被仓储替身执行过，SQL 从未在真实
// schema 上运行（同一缺口在采购域放过了 TD-PROC-011 的 42703）。这里让它们全部执行。
describe('CRM additive reads on the real PostgreSQL schema', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresCrmRepository;

  beforeEach(async () => {
    fixture = await ownedPostgres('crm_read_pg');
    repository = new PostgresCrmRepository(fixture.db);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('reads a lead, its customer, a contact and an activity through every additive method', async () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    const { actor, scopes, anchors } = fixture.context;
    const customer = await repository.createCustomer(
      { name: 'Read-path customer', customerNumber: 'CUST-READ-1', tags: ['vip'] },
      actor,
      randomUUID(),
    );
    const customerId = id(customer.id);
    const lead = await repository.createLead(
      { title: 'Read-path lead', source: 'WEBSITE', customerId, pool: false },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const contact = await repository.createContact(
      customerId,
      {
        name: 'Read-path contact',
        title: null,
        email: 'reader@example.test',
        phone: null,
        primary: true,
      },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const activity = await repository.createActivity(
      customerId,
      {
        leadId: id(lead.id),
        type: 'CALL',
        occurredAt: '2026-01-02T03:04:05.000Z',
        summary: 'Discovery',
        details: {},
      },
      actor,
      randomUUID(),
      randomUUID(),
      scopes,
      anchors,
    );
    const sensitive = { email: true, phone: true } as const;
    const leadId = id(lead.id);
    const contactId = id(contact.id);
    const activityId = id(activity.id);

    expect(await repository.findLead(leadId, actor, scopes, anchors)).toMatchObject({
      id: leadId,
      title: 'Read-path lead',
    });
    const page = await repository.listLeadPage(actor, scopes, anchors, { limit: 10 });
    expect(page.items.map((row) => id(row.id))).toEqual([leadId]);
    expect(page.nextCursor).toBeNull();
    expect(
      await repository.listLeadPage(actor, scopes, anchors, { limit: 10, pool: true }),
    ).toMatchObject({ items: [], nextCursor: null });

    expect(await repository.listCustomers(actor, scopes, anchors)).toMatchObject([
      { id: customerId, name: 'Read-path customer' },
    ]);
    expect(await repository.findCustomer(customerId, actor, scopes, anchors)).toMatchObject({
      id: customerId,
      name: 'Read-path customer',
    });

    expect(
      await repository.listContacts(customerId, actor, scopes, anchors, sensitive),
    ).toMatchObject([{ id: contactId, name: 'Read-path contact' }]);
    expect(
      await repository.findContact(contactId, actor, scopes, anchors, sensitive),
    ).toMatchObject({ id: contactId, name: 'Read-path contact' });

    expect(await repository.listActivities(customerId, actor, scopes, anchors)).toMatchObject([
      { id: activityId, type: 'CALL' },
    ]);
    expect(
      await repository.findActivity(activityId, customerId, actor, scopes, anchors),
    ).toMatchObject({ id: activityId, type: 'CALL' });
  });
});
