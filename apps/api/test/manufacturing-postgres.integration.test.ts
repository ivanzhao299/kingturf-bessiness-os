import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

describe('manufacturing master repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresManufacturingRepository;
  let product: JsonObject, material: JsonObject, alternate: JsonObject, secondAlternate: JsonObject;
  let draft: JsonObject, foreign: JsonObject;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const item = (
    sku: string,
    publish = true,
    context: Parameters<PostgresManufacturingRepository['createItem']>[1] = state().context,
    itemType = 'RAW_MATERIAL',
  ) =>
    repository.createItem(
      {
        sku,
        name: sku,
        itemType,
        baseUnitCode: 'KG',
        specification: { grade: 'A' },
        effectiveAt: '2026-01-01T00:00:00Z',
        publish,
      },
      context,
      randomUUID(),
    );
  const bomInput = (code: string) => ({
    code,
    name: code,
    productItemId: identifier(product, 'itemId'),
    productItemVersionId: identifier(product),
    outputQuantity: '1',
    effectiveAt: '2026-01-01T00:00:00Z',
    publish: false,
    lines: [
      {
        componentItemVersionId: identifier(material),
        quantity: '1.25',
        scrapBasisPoints: 500,
        substitutes: [
          { itemVersionId: identifier(secondAlternate), priority: 2, conversionFactor: '1.2' },
          { itemVersionId: identifier(alternate), priority: 1, conversionFactor: '1.1' },
        ],
      },
    ],
  });
  const evidenceCounts = async (correlation: string) => {
    const { db } = state();
    return (
      await db.query<{ audit: string; outbox: string }>(
        'SELECT (SELECT count(*)::text FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::text FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  };

  beforeAll(async () => {
    fixture = await ownedPostgres('manufacturing_pg');
    repository = new PostgresManufacturingRepository(fixture.db);
    product = await item('FG-1', true, fixture.context, 'FINISHED_GOOD');
    material = await item('RAW-1');
    alternate = await item('ALT-1');
    secondAlternate = await item('ALT-2');
    draft = await item('DRAFT-1', false);
    foreign = await item('FOREIGN-1', true, fixture.otherContext);
  }, 30_000);
  afterAll(async () => {
    await fixture?.close();
  });

  it('rejects unsafe or truncatable fixture schema prefixes before database allocation', async () => {
    for (const prefix of ['a'.repeat(31), 'bad-prefix', 'bad;drop schema'])
      await expect(ownedPostgres(prefix)).rejects.toThrow('Invalid owned schema prefix');
    const { db, schema } = state();
    expect(schema.length).toBeLessThanOrEqual(63);
    expect(
      (await db.query<{ schema: string }>('SELECT current_schema() AS schema')).rows[0]?.schema,
    ).toBe(schema);
  });

  it('persists BOM substitutes and ordered routing operations with paired evidence', async () => {
    const { context } = state();
    const created = randomUUID(),
      published = randomUUID(),
      routed = randomUUID();
    const bom = await repository.createBom(bomInput('BOM-1'), context, created);
    expect(bom).toMatchObject({ version: 1, status: 'DRAFT' });
    expect(await evidenceCounts(created)).toEqual({ audit: '1', outbox: '1' });
    expect(await repository.publish('bom', identifier(bom), context, published)).toMatchObject({
      status: 'PUBLISHED',
      version: 1,
    });
    expect(await evidenceCounts(published)).toEqual({ audit: '1', outbox: '1' });
    const boms = await repository.list('boms', context);
    expect(boms).toHaveLength(1);
    expect(boms[0]).toMatchObject({
      id: identifier(bom),
      status: 'PUBLISHED',
      output_quantity: 1,
      lines: [
        {
          line_number: 1,
          quantity: 1.25,
          scrap_basis_points: 500,
          component: { sku: 'RAW-1', version: 1 },
          substitutes: [
            { sku: 'ALT-1', priority: 1, conversion_factor: 1.1 },
            { sku: 'ALT-2', priority: 2, conversion_factor: 1.2 },
          ],
        },
      ],
    });
    const routing = await repository.createRouting(
      {
        code: 'ROUTING-1',
        name: 'Routing',
        productItemId: identifier(product, 'itemId'),
        productItemVersionId: identifier(product),
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        operations: [20, 10].map((sequence) => ({
          sequence,
          operationCode: `OP-${String(sequence)}`,
          name: 'Operation',
          workCenterCode: 'WC-1',
          setupMinutes: '1',
          runMinutesPerUnit: '0.5',
          instructions: { checkpoint: true },
        })),
      },
      context,
      routed,
    );
    expect(routing).toMatchObject({ status: 'PUBLISHED', version: 1 });
    expect(await evidenceCounts(routed)).toEqual({ audit: '1', outbox: '1' });
    const routings = await repository.list('routings', context);
    expect(routings).toHaveLength(1);
    expect(routings[0]).toMatchObject({
      operations: [
        { sequence: 10, operation_code: 'OP-10', instructions: { checkpoint: true } },
        { sequence: 20, operation_code: 'OP-20', instructions: { checkpoint: true } },
      ],
    });
    for (const [correlation, action, aggregateType, aggregateId] of [
      [created, 'bom.created', 'bom', identifier(bom, 'bomId')],
      [published, 'bom.published', 'bom', identifier(bom)],
      [routed, 'routing.created', 'routing', identifier(routing, 'routingId')],
    ] as const) {
      const result = await state().db.query(
        'SELECT a.action,a.target_type,a.target_id,o.event_type,o.aggregate_type,o.aggregate_id,o.aggregate_version FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id WHERE a.correlation_id=$1',
        [correlation],
      );
      expect(result.rows).toEqual([
        {
          action,
          target_type: aggregateType,
          target_id: aggregateId,
          event_type: action,
          aggregate_type: aggregateType,
          aggregate_id: aggregateId,
          aggregate_version: 1,
        },
      ]);
    }
    await expect(
      repository.publish('routing', identifier(routing), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('enforces company scope and keeps GROUP queries inside actor tenant', async () => {
    const { context, otherContext } = state();
    for (const scopes of [[], ['SELF'], ['TEAM']] as const) {
      await expect(repository.list('items', { ...context, scopes })).rejects.toMatchObject({
        code: 'forbidden',
      });
      await expect(item('DENIED', true, { ...context, scopes })).rejects.toMatchObject({
        code: 'forbidden',
      });
    }
    const own = await repository.list('items', context);
    expect(own.some((row) => row.sku === 'FOREIGN-1')).toBe(false);
    expect(own.some((row) => row.sku === 'DENIED')).toBe(false);
    const group = await repository.list('items', { ...otherContext, scopes: ['GROUP'] });
    expect(group.map((row) => row.sku)).toEqual(['FOREIGN-1']);
    await expect(
      repository.publish('item', identifier(draft), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      repository.createBom(
        { ...bomInput('WRONG-ROOT'), productItemVersionId: identifier(foreign) },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rolls back inserted BOM parents and children on tenant FK and substitute uniqueness failures', async () => {
    const { db, context } = state();
    for (const input of [
      {
        ...bomInput('FOREIGN-COMPONENT'),
        lines: [
          {
            componentItemVersionId: identifier(foreign),
            quantity: '1',
            scrapBasisPoints: 0,
            substitutes: [],
          },
        ],
      },
      {
        ...bomInput('DUPLICATE-PRIORITY'),
        lines: [
          {
            ...bomInput('unused').lines[0],
            componentItemVersionId: identifier(material),
            quantity: '1',
            scrapBasisPoints: 0,
            substitutes: [
              { itemVersionId: identifier(alternate), priority: 1, conversionFactor: '1' },
              { itemVersionId: identifier(secondAlternate), priority: 1, conversionFactor: '1' },
            ],
          },
        ],
      },
    ]) {
      const correlation = randomUUID();
      const childCounts = () =>
        db.query<{ versions: string; lines: string; substitutes: string }>(
          'SELECT (SELECT count(*)::text FROM manufacturing_bom_versions) versions,(SELECT count(*)::text FROM manufacturing_bom_lines) lines,(SELECT count(*)::text FROM manufacturing_bom_substitutes) substitutes',
        );
      const before = (await childCounts()).rows[0];
      await expect(repository.createBom(input, context, correlation)).rejects.toMatchObject({
        code: input.code === 'FOREIGN-COMPONENT' ? '23503' : '23505',
      });
      expect(
        (
          await db.query<{ count: string }>(
            'SELECT count(*)::text count FROM manufacturing_boms WHERE tenant_id=$1 AND code=$2',
            [context.actor.companyId, input.code],
          )
        ).rows[0]?.count,
      ).toBe('0');
      expect((await childCounts()).rows[0]).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
  });

  it('rejects unpublished substitutes and empty published routings atomically', async () => {
    const { context, db } = state();
    const correlation = randomUUID();
    const input = bomInput('DRAFT-SUBSTITUTE');
    input.publish = true;
    input.lines[0]?.substitutes.push({
      itemVersionId: identifier(draft),
      priority: 3,
      conversionFactor: '1',
    });
    await expect(repository.createBom(input, context, correlation)).rejects.toThrow(
      /BOM publication requires/u,
    );
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM manufacturing_boms WHERE code='DRAFT-SUBSTITUTE'",
        )
      ).rows[0]?.count,
    ).toBe('0');
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    await expect(
      repository.createRouting(
        {
          code: 'EMPTY-ROUTING',
          name: 'Empty',
          productItemId: identifier(product, 'itemId'),
          productItemVersionId: identifier(product),
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
          operations: [],
        },
        context,
        correlation,
      ),
    ).rejects.toThrow(/routing publication requires/u);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM manufacturing_routings WHERE code='EMPTY-ROUTING'",
        )
      ).rows[0]?.count,
    ).toBe('0');
  });

  it('rolls back publication and audit if the outbox insert fails after the audit write', async () => {
    const { db, context } = state();
    await db.query(
      "INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,'item.published',1,'item',$2,1,now(),$3,$4,'{}')",
      [context.actor.companyId, identifier(draft), context.actor.employeeId, randomUUID()],
    );
    const correlation = randomUUID();
    await expect(
      repository.publish('item', identifier(draft), context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      (
        await db.query<{ status: string }>(
          'SELECT status FROM manufacturing_item_versions WHERE id=$1',
          [identifier(draft)],
        )
      ).rows[0]?.status,
    ).toBe('DRAFT');
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM domain_event_outbox WHERE event_type='item.published' AND aggregate_id=$1",
          [identifier(draft)],
        )
      ).rows[0]?.count,
    ).toBe('1');
  });
});

// U3-MFG-1（ADR-0015）：物料分页/详情 additive 只读仓储的真实 PG 契约——独立 owned
// schema（不依赖上方 e91b078 契约块的共享状态）。
describe('U3-MFG-1 manufacturing item page and detail real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresManufacturingRepository;
  const created: JsonObject[] = [];
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const item = async (
    sku: string,
    name: string,
    itemType: string,
    specification: JsonObject,
    publish = true,
    context = state().context,
  ) => {
    const version = await repository.createItem(
      {
        sku,
        name,
        itemType,
        baseUnitCode: 'KG',
        specification,
        effectiveAt: '2026-01-01T00:00:00Z',
        publish,
      },
      context,
      randomUUID(),
    );
    created.push(version);
    return version;
  };
  const id = (value: JsonObject, key = 'id'): string => {
    const found = value[key];
    if (typeof found !== 'string') throw new Error('Fixture identifier missing');
    return found;
  };
  const skus = (page: { items: readonly JsonObject[] }) => page.items.map((row) => id(row, 'sku'));

  beforeAll(async () => {
    fixture = await ownedPostgres('manufacturing_items_pg');
    repository = new PostgresManufacturingRepository(fixture.db);
    // SKU 升序：FG-PRO-50 < FG-PRO-60 < PK-BOX < RM-BACKING-PP < RM-YARN-11000 < RM-YARN-12000 < SF-TUFT-50。
    const yarn = await item('RM-YARN-12000', '12000D 直丝草纱', 'RAW_MATERIAL', {
      dtex: 12000,
      color: '双色绿',
    });
    const alternate = await item('RM-YARN-11000', '11000D 替代草纱', 'RAW_MATERIAL', {
      dtex: 11000,
    });
    const backing = await item('RM-BACKING-PP', 'PP 复合底布', 'RAW_MATERIAL', { layers: 2 });
    const finished = await item('FG-PRO-50', '50mm 景观草', 'FINISHED_GOOD', {
      pileHeightMm: 50,
      gauge: '3/8',
    });
    await item('FG-PRO-60', '60mm 景观草（草稿）', 'FINISHED_GOOD', { pileHeightMm: 60 }, false);
    await item('PK-BOX', '出口纸箱', 'PACKAGING', {});
    await item('SF-TUFT-50', '簇绒半成品', 'SEMI_FINISHED', { pileHeightMm: 50 }, false);
    await item('FG-FOREIGN', '外租户物料', 'FINISHED_GOOD', {}, true, fixture.otherContext);
    await repository.createBom(
      {
        code: 'BOM-PRO-50',
        name: '50mm 景观草标准 BOM',
        productItemId: id(finished, 'itemId'),
        productItemVersionId: id(finished),
        outputQuantity: '1',
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        lines: [
          {
            componentItemVersionId: id(yarn),
            quantity: '1.25',
            scrapBasisPoints: 300,
            substitutes: [{ itemVersionId: id(alternate), priority: 1, conversionFactor: '1.05' }],
          },
          {
            componentItemVersionId: id(backing),
            quantity: '1',
            scrapBasisPoints: 0,
            substitutes: [],
          },
        ],
      },
      fixture.context,
      randomUUID(),
    );
    await repository.createBom(
      {
        code: 'BOM-PRO-60',
        name: '60mm 景观草草稿 BOM',
        productItemId: id(finished, 'itemId'),
        productItemVersionId: id(finished),
        outputQuantity: '1',
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: false,
        lines: [
          {
            componentItemVersionId: id(yarn),
            quantity: '1.5',
            scrapBasisPoints: 0,
            substitutes: [],
          },
        ],
      },
      fixture.context,
      randomUUID(),
    );
    const routing = await repository.createRouting(
      {
        code: 'RT-PRO-50',
        name: '50mm 景观草标准工艺',
        productItemId: id(finished, 'itemId'),
        productItemVersionId: id(finished),
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        operations: [
          {
            operationCode: 'TUFT',
            name: '簇绒',
            workCenterCode: 'WC-TUFT-01',
            sequence: 10,
            setupMinutes: '60',
            runMinutesPerUnit: '0.8',
            instructions: {},
          },
        ],
      },
      fixture.context,
      randomUUID(),
    );
    await new PostgresProductionRepository(fixture.db).create(
      {
        orderNumber: 'WO-PRO-50-1',
        itemVersionId: id(finished),
        routingVersionId: id(routing),
        plannedQuantity: '1000',
        plannedStartAt: '2026-12-01',
        plannedDueAt: '2026-12-15',
        sourceReference: 'manual:WO-PRO-50-1',
      },
      fixture.context,
      randomUUID(),
    );
  }, 60_000);
  afterAll(async () => {
    await fixture?.close();
  });

  it('listItemPage with no filter is byte-identical to the legacy list and emits no cursor', async () => {
    const { context } = state();
    const page = await repository.listItemPage(context, {});
    expect(page).toEqual({ items: await repository.list('items', context), nextCursor: null });
    expect(skus(page)).toEqual([
      'FG-PRO-50',
      'FG-PRO-60',
      'PK-BOX',
      'RM-BACKING-PP',
      'RM-YARN-11000',
      'RM-YARN-12000',
      'SF-TUFT-50',
    ]);
    expect(page.items.map((row) => row.id).sort()).toEqual(
      created
        .slice(0, 7)
        .map((row) => row.id)
        .sort(),
    );
  });

  it('listItemPage filters by item type, version status and a literal case-insensitive keyword', async () => {
    const { context } = state();
    expect(skus(await repository.listItemPage(context, { itemType: 'RAW_MATERIAL' }))).toEqual([
      'RM-BACKING-PP',
      'RM-YARN-11000',
      'RM-YARN-12000',
    ]);
    expect(skus(await repository.listItemPage(context, { status: 'DRAFT' }))).toEqual([
      'FG-PRO-60',
      'SF-TUFT-50',
    ]);
    expect(skus(await repository.listItemPage(context, { query: '景观草' }))).toEqual([
      'FG-PRO-50',
      'FG-PRO-60',
    ]);
    // % 与 _ 不作通配符：strpos 字面子串语义（LIKE 通配下 pro_5 会命中 FG-PRO-50）。
    expect(skus(await repository.listItemPage(context, { query: 'pro_5' }))).toEqual([]);
    expect(skus(await repository.listItemPage(context, { query: 'PRO-5' }))).toEqual(['FG-PRO-50']);
    expect(skus(await repository.listItemPage(context, { query: '%mm' }))).toEqual([]);
    expect(
      skus(
        await repository.listItemPage(context, {
          itemType: 'FINISHED_GOOD',
          status: 'DRAFT',
          query: '60',
        }),
      ),
    ).toEqual(['FG-PRO-60']);
  });

  it('listItemPage keyset cursor walks the full ordered list exactly once across pages', async () => {
    const { context } = state();
    const full = await repository.listItemPage(context, {});
    const walked: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await repository.listItemPage(context, {
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });
      pages += 1;
      expect(page.items.length).toBeLessThanOrEqual(2);
      walked.push(...page.items.map((row) => id(row)));
      if (page.nextCursor === null) break;
      expect(page.items).toHaveLength(2);
      cursor = page.nextCursor;
      expect(pages).toBeLessThan(6);
    }
    expect(pages).toBe(4);
    expect(walked).toEqual(full.items.map((row) => id(row)));
    // 同 SKU 多版本：游标在同一物料内按版本倒序前进。
    const secondVersion = await fixture?.db.query(
      `INSERT INTO manufacturing_item_versions(tenant_id,item_id,version,specification,effective_at,canonical_hash,created_by)
       SELECT tenant_id,item_id,2,specification,now(),repeat('c',64),created_by FROM manufacturing_item_versions WHERE id=$1
       RETURNING id`,
      [id(full.items[0] ?? {})],
    );
    expect(secondVersion?.rowCount).toBe(1);
    const versions = await repository.listItemPage(context, { query: '50mm' });
    expect(versions.items.map((row) => row.version)).toEqual([2, 1]);
    const first = await repository.listItemPage(context, { query: '50mm', limit: 1 });
    expect(first.items.map((row) => row.version)).toEqual([2]);
    const second = await repository.listItemPage(context, {
      query: '50mm',
      limit: 1,
      ...(first.nextCursor ? { cursor: first.nextCursor } : {}),
    });
    expect(second.items.map((row) => row.version)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });

  it('listItemPage rejects malformed cursors and non-company scopes; tenants stay isolated', async () => {
    const { context, otherContext } = state();
    await expect(
      repository.listItemPage(context, { cursor: 'not-a-cursor' }),
    ).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(
      repository.listItemPage({ ...context, scopes: ['TEAM'] }, {}),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const foreign = await repository.listItemPage(otherContext, {});
    expect(skus(foreign)).toEqual(['FG-FOREIGN']);
  });

  it('findItem returns the root, version history and permission-gated aggregates', async () => {
    const { context } = state();
    const finished = created[3] ?? {};
    const yarn = created[0] ?? {};
    const alternate = created[1] ?? {};
    const bare = await repository.findItem(id(finished, 'itemId'), context);
    expect(bare).toMatchObject({
      id: id(finished, 'itemId'),
      sku: 'FG-PRO-50',
      name: '50mm 景观草',
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'KG',
    });
    expect(Object.keys(bare ?? {}).sort()).toEqual(
      ['baseUnitCode', 'created_at', 'id', 'itemType', 'name', 'sku', 'versions'].sort(),
    );
    expect(bare?.versions).toEqual(
      (await repository.listItemPage(context, { query: '50mm' })).items,
    );
    const parts = { boms: true, routings: true, productionOrders: true };
    const detail = await repository.findItem(id(finished, 'itemId'), context, parts);
    expect(detail?.boms).toMatchObject([
      { code: 'BOM-PRO-50', versions: [{ version: 1, status: 'PUBLISHED' }] },
      { code: 'BOM-PRO-60', versions: [{ version: 1, status: 'DRAFT' }] },
    ]);
    expect(detail?.routings).toMatchObject([
      { code: 'RT-PRO-50', versions: [{ version: 1, status: 'PUBLISHED' }] },
    ]);
    expect(detail?.productionOrders).toMatchObject([
      { orderNumber: 'WO-PRO-50-1', state: 'DRAFT', plannedQuantity: 1000, itemVersion: 1 },
    ]);
    expect(detail?.usedIn).toEqual([]);
    const used = await repository.findItem(id(yarn, 'itemId'), context, parts);
    expect(used?.boms).toEqual([]);
    expect(used?.usedIn).toMatchObject([
      { code: 'BOM-PRO-50', version: 1, role: 'COMPONENT', lineNumber: 1, quantity: 1.25 },
      { code: 'BOM-PRO-60', version: 1, role: 'COMPONENT', lineNumber: 1 },
    ]);
    const substitute = await repository.findItem(id(alternate, 'itemId'), context, {
      boms: true,
      routings: false,
      productionOrders: false,
    });
    expect(substitute?.usedIn).toMatchObject([
      { code: 'BOM-PRO-50', role: 'SUBSTITUTE', lineNumber: 1, priority: 1 },
    ]);
    expect(substitute).not.toHaveProperty('routings');
    expect(substitute).not.toHaveProperty('productionOrders');
  });

  it('findItem hides other tenants, unknown ids and unauthorized aggregates', async () => {
    const { context, otherContext } = state();
    const finished = created[3] ?? {};
    expect(await repository.findItem(randomUUID(), context)).toBeNull();
    expect(
      await repository.findItem(id(finished, 'itemId'), otherContext, {
        boms: true,
        routings: true,
        productionOrders: true,
      }),
    ).toBeNull();
    await expect(
      repository.findItem(id(finished, 'itemId'), { ...context, scopes: ['SELF'] }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
