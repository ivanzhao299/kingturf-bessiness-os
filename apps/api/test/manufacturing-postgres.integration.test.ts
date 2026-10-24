import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
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
