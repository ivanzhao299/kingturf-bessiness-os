import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCrmRepository } from '../src/crm-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const id = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const idOf = (value: { id: string }): string => id(value.id);

// TD-CRM-003（TD-TEST-022 同类缺口）：线索列表的加性键 lastActivityAt 由 listLeadPage 的一条
// 参数化聚合 SQL 产生。这里让它在真实 PostgreSQL schema 上执行，钉定四件事：
// ① 取该线索名下活动的最大 occurred_at（多条取最新；挂在别的线索或只挂客户的活动不计）；
// ② 既有 11 个键与 legacy listLeads 逐字节相同（键序 + 取值），legacy 行不含加性键；
// 03 无 customer-activity:read 授权 → 不聚合，字段恒为 null；
// ④ 数据范围：看不到的线索不出现在结果里；活动读授权范围内看不到其客户的线索，字段为 null。
describe('lead lastActivityAt aggregate on the real PostgreSQL schema (TD-CRM-003)', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresCrmRepository;

  beforeEach(async () => {
    fixture = await ownedPostgres('crm_lead_activity');
    repository = new PostgresCrmRepository(fixture.db);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  const activity = (customerId: string, leadId: string | null, occurredAt: string) => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    const { actor, scopes, anchors } = fixture.context;
    return repository.createActivity(
      customerId,
      { leadId, type: 'CALL', occurredAt, summary: `Call at ${occurredAt}`, details: {} },
      actor,
      randomUUID(),
      randomUUID(),
      scopes,
      anchors,
    );
  };

  it('aggregates the latest activity of each lead; existing keys stay byte-identical to legacy', async () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    const { actor, scopes, anchors } = fixture.context;
    const customerA = await repository.createCustomer(
      { name: 'Activity customer A', customerNumber: 'CUST-LA-1', tags: [] },
      actor,
      randomUUID(),
    );
    const customerB = await repository.createCustomer(
      { name: 'Activity customer B', customerNumber: 'CUST-LA-2', tags: [] },
      actor,
      randomUUID(),
    );
    const customerAId = idOf(customerA);
    const customerBId = idOf(customerB);
    const lead1 = await repository.createLead(
      { title: 'Two activities', source: 'WEBSITE', customerId: customerAId, pool: false },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const lead2 = await repository.createLead(
      { title: 'One activity', source: 'EXPO', customerId: customerBId, pool: false },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const lead3 = await repository.createLead(
      { title: 'No activity', source: 'REFERRAL', customerId: customerAId, pool: false },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const pooled = await repository.createLead(
      { title: 'Pool lead without customer', source: 'WEBSITE', customerId: null, pool: true },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    const lead1Id = idOf(lead1);
    const lead2Id = idOf(lead2);
    const lead3Id = idOf(lead3);
    // 同一线索两条：较早一条不得盖过较新一条。
    await activity(customerAId, lead1Id, '2026-01-02T03:04:05.000Z');
    await activity(customerAId, lead1Id, '2026-03-04T05:06:07.000Z');
    await activity(customerBId, lead2Id, '2026-02-02T03:04:05.000Z');
    // 只挂客户、不挂线索的活动（时间最晚）不得计入该客户名下的任何线索。
    await activity(customerAId, null, '2026-12-31T23:59:59.000Z');

    const grant = { scopes, anchors };
    const page = await repository.listLeadPage(actor, scopes, anchors, { limit: 100 }, grant);
    const lastOf = new Map(page.items.map((row) => [row.id, row.lastActivityAt]));
    expect(lastOf.get(lead1Id)).toBe('2026-03-04T05:06:07.000Z');
    expect(lastOf.get(lead2Id)).toBe('2026-02-02T03:04:05.000Z');
    expect(lastOf.get(lead3Id)).toBeNull();
    expect(lastOf.get(idOf(pooled))).toBeNull();
    expect(page.nextCursor).toBeNull();

    // ② 既有键逐字节守恒：加性项去掉末尾的 lastActivityAt 键后，JSON 字节序列等于 legacy 行。
    //（legacy listLeads 不带 pool 时同样返回公海线索，故四条逐一比对。）
    const legacyById = new Map(
      (await repository.listLeads(actor, scopes, anchors)).map((row) => [row.id, row]),
    );
    expect(page.items).toHaveLength(4);
    for (const item of page.items) {
      const legacy = legacyById.get(item.id);
      if (!legacy) throw new Error('Legacy row missing for a listed lead');
      expect('lastActivityAt' in legacy).toBe(false);
      const { lastActivityAt, ...existing } = item;
      expect(JSON.stringify(existing)).toBe(JSON.stringify(legacy));
      expect(lastActivityAt).toBe(lastOf.get(item.id));
    }
    const pool = await repository.listLeadPage(
      actor,
      scopes,
      anchors,
      { limit: 100, pool: true },
      grant,
    );
    expect(pool.items.map((row) => row.id)).toEqual([idOf(pooled)]);
    const pooledLegacy = (await repository.listLeads(actor, scopes, anchors, true)).find(
      (row) => row.id === idOf(pooled),
    );
    const pooledRow = pool.items[0];
    if (!pooledRow || !pooledLegacy) throw new Error('Pool lead row missing');
    const { lastActivityAt: pooledLast, ...pooledExisting } = pooledRow;
    expect(pooledLast).toBeNull();
    expect(JSON.stringify(pooledExisting)).toBe(JSON.stringify(pooledLegacy));
  });

  it('does not aggregate without the activity read grant', async () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    const { actor, scopes, anchors } = fixture.context;
    const customer = await repository.createCustomer(
      { name: 'Grant customer', customerNumber: 'CUST-LA-G', tags: [] },
      actor,
      randomUUID(),
    );
    const customerId = idOf(customer);
    const lead = await repository.createLead(
      { title: 'Granted lead', source: 'WEBSITE', customerId, pool: false },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    await activity(customerId, idOf(lead), '2026-01-02T03:04:05.000Z');
    const implicit = await repository.listLeadPage(actor, scopes, anchors, { limit: 10 });
    expect(implicit.items.map((row) => row.lastActivityAt)).toEqual([null]);
    const explicit = await repository.listLeadPage(
      actor,
      scopes,
      anchors,
      { limit: 10 },
      { scopes: [], anchors },
    );
    expect(explicit.items.map((row) => row.lastActivityAt)).toEqual([null]);
  });

  it('is bound by the lead DataScope and by the activity grant’s customer visibility', async () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    const { db, company } = fixture;
    const { actor, scopes, anchors } = fixture.context;
    const { otherContext } = fixture;
    const peerTeam = randomUUID();
    const peer = randomUUID();
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'PEER','Peer','TEAM')",
      [peerTeam, company],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'PEER','Peer','peer@owned.test')",
      [peer, company, peerTeam],
    );
    const peerActor = { companyId: company, employeeId: peer };
    const customer = await repository.createCustomer(
      { name: 'Scoped customer', customerNumber: 'CUST-LA-S', tags: [] },
      actor,
      randomUUID(),
    );
    const customerId = idOf(customer);
    const mine = await repository.createLead(
      { title: 'Owned by fixture actor', source: 'WEBSITE', customerId, pool: true },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    // 两条线索都从公海创建后各认领给本人，数据范围按负责人区分。
    await repository.claimLead(
      idOf(mine),
      mine.version,
      actor,
      randomUUID(),
      randomUUID(),
      ['SELF'],
      [],
    );
    // peer 的线索：由 fixture actor 以 COMPANY 范围创建，再认领给 peer。
    const theirs = await repository.createLead(
      { title: 'Owned by peer', source: 'WEBSITE', customerId, pool: true },
      actor,
      randomUUID(),
      scopes,
      anchors,
    );
    await repository.claimLead(
      idOf(theirs),
      theirs.version,
      peerActor,
      randomUUID(),
      randomUUID(),
      ['SELF'],
      [],
    );
    await activity(customerId, idOf(mine), '2026-01-02T03:04:05.000Z');
    await activity(customerId, idOf(theirs), '2026-02-02T03:04:05.000Z');

    // 数据范围受限的账号（peer，仅本人）：看不到 fixture actor 的线索，自然也拿不到它的活动时间。
    const selfScopes = ['SELF'] as const;
    const selfPage = await repository.listLeadPage(
      peerActor,
      selfScopes,
      [],
      { limit: 100 },
      { scopes: ['COMPANY'], anchors: [] },
    );
    expect(selfPage.items.map((row) => row.id)).toEqual([idOf(theirs)]);
    expect(selfPage.items[0]?.lastActivityAt).toBe('2026-02-02T03:04:05.000Z');

    // 活动读授权同样只到本人：活动的客户此刻归 fixture actor（无负责人→不可见），线索可见但时间为 null。
    const narrowActivity = await repository.listLeadPage(
      peerActor,
      selfScopes,
      [],
      { limit: 100 },
      { scopes: selfScopes, anchors: [] },
    );
    expect(narrowActivity.items.map((row) => [row.id, row.lastActivityAt])).toEqual([
      [idOf(theirs), null],
    ]);
    // 客户负责人改为 peer 后，同一授权下时间出现——线索读权限没有放宽活动的可见面。
    await repository.assign(
      'CUSTOMER',
      customerId,
      peer,
      customer.version,
      'peer takes over',
      actor,
      randomUUID(),
      false,
      scopes,
      anchors,
    );
    const afterOwnership = await repository.listLeadPage(
      peerActor,
      selfScopes,
      [],
      { limit: 100 },
      { scopes: selfScopes, anchors: [] },
    );
    expect(afterOwnership.items.map((row) => [row.id, row.lastActivityAt])).toEqual([
      [idOf(theirs), '2026-02-02T03:04:05.000Z'],
    ]);

    // 活动读授权范围比线索读授权宽时，时间仍只跟随已列出的线索（fixture actor 看不到 peer 的线索）。
    const actorSelf = await repository.listLeadPage(
      actor,
      selfScopes,
      [],
      { limit: 100 },
      { scopes: ['COMPANY'], anchors: [] },
    );
    expect(actorSelf.items.map((row) => [row.id, row.lastActivityAt])).toEqual([
      [idOf(mine), '2026-01-02T03:04:05.000Z'],
    ]);

    // 租户隔离：另一家公司读不到任何线索。
    const foreign = await repository.listLeadPage(
      otherContext.actor,
      ['COMPANY'],
      [],
      { limit: 100 },
      { scopes: ['COMPANY'], anchors: [] },
    );
    expect(foreign.items).toEqual([]);
  });
});
