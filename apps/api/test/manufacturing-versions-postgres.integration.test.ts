import { randomUUID } from 'node:crypto';
import type { SqlClient } from '@kingturf/database';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiDependencies, ApiRequest } from '../src/app.ts';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.ts';
import type { Db } from '../src/manufacturing-read-repositories.ts';
import { PostgresProductionRepository } from '../src/production-repositories.ts';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.ts';
import { ownedPostgres } from './fixtures/owned-postgres.ts';

const id = (row: JsonObject, key = 'id'): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};
const rows = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? (value as JsonObject[]) : [];
const kinds = ['item', 'bom', 'routing'] as const;
type Kind = (typeof kinds)[number];
const domains = { item: 'manufacturing-item', bom: 'bom', routing: 'routing' } as const;
const resources = {
  item: 'manufacturing-items',
  bom: 'manufacturing-boms',
  routing: 'manufacturing-routings',
} as const;
const date = '2026-04-01T00:00:00.000Z';
let pg: Awaited<ReturnType<typeof ownedPostgres>>;
let repo: PostgresManufacturingRepository;
let sequence = 0;
let close: (() => Promise<void>) | undefined;
const secondActor = randomUUID();

beforeAll(async () => {
  pg = await ownedPostgres('mfg_version');
  close = pg.close;
  repo = new PostgresManufacturingRepository(pg.db);
  await pg.db.query(
    "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'OWN-C','Owned C','c@owned.test')",
    [secondActor, pg.company, pg.team],
  );
}, 60_000);
afterAll(async () => {
  await close?.();
});

async function fixture(kind: Kind) {
  const tag = `CONT-${String(++sequence)}`;
  const item = (suffix: string, itemType: string) =>
    repo.createItem(
      {
        sku: `${tag}-${suffix}`,
        name: suffix,
        itemType,
        baseUnitCode: 'M2',
        effectiveAt: date,
        specification: { calibration: { offset: 1 }, grade: '001' },
        publish: true,
      },
      pg.context,
      randomUUID(),
    );
  const product = await item('FG', 'FINISHED_GOOD');
  if (kind === 'item') return product;
  const root = {
    code: tag,
    name: tag,
    productItemId: id(product, 'itemId'),
    productItemVersionId: id(product),
    effectiveAt: date,
    publish: true,
  };
  if (kind === 'bom') {
    const first = await item('RM1', 'RAW_MATERIAL');
    const second = await item('RM2', 'RAW_MATERIAL');
    return repo.createBom(
      {
        ...root,
        outputQuantity: '2.5',
        lines: [
          {
            componentItemVersionId: id(first),
            quantity: '999999999999999999.123456',
            scrapBasisPoints: 20,
            substitutes: [{ itemVersionId: id(second), priority: 4, conversionFactor: '0.875123' }],
          },
          {
            componentItemVersionId: id(second),
            quantity: '2.5',
            scrapBasisPoints: 0,
            substitutes: [],
          },
        ],
      },
      pg.context,
      randomUUID(),
    );
  }
  return repo.createRouting(
    {
      ...root,
      operations: [
        {
          operationCode: 'CUT',
          name: 'Cut',
          workCenterCode: 'LINE-A',
          sequence: 8,
          setupMinutes: '0',
          runMinutesPerUnit: '1.123456',
          instructions: { parameter: [1, '1'] },
        },
        {
          operationCode: 'PACK',
          name: 'Pack',
          workCenterCode: 'LINE-B',
          sequence: 24,
          setupMinutes: '2.345678',
          runMinutesPerUnit: '0',
          instructions: {},
        },
      ],
    },
    pg.context,
    randomUUID(),
  );
}

const dispatch = (
  kind: Kind,
  rootId: string,
  options: Readonly<{
    method?: 'GET' | 'POST';
    key?: string | null;
    body?: JsonObject;
    manage?: boolean;
    fields?: readonly string[];
    narrow?: boolean;
    other?: boolean;
    anotherEmployee?: boolean;
    repository?: PostgresManufacturingRepository;
  }> = {},
) => {
  const scope = options.narrow ? (['SELF'] as const) : (['COMPANY'] as const);
  const domain = domains[kind];
  const grants = new Map<
    PermissionKey,
    { scopes: typeof scope; fields: readonly string[] | null }
  >();
  grants.set(`${domain}:read`, { fields: null, scopes: scope });
  if (options.manage !== false)
    grants.set(`${domain}:manage`, { fields: options.fields ?? null, scopes: scope });
  const correlationId = randomUUID();
  const get = options.method === 'GET';
  const request: ApiRequest = {
    method: get ? 'GET' : 'POST',
    pathname: `/api/v1/${resources[kind]}/${rootId}${get ? '' : '/versions'}`,
    headers: options.key === null ? {} : { 'idempotency-key': options.key ?? randomUUID() },
    ...(get ? {} : { body: options.body ?? {} }),
  };
  return dispatchFastifyRouteGroup(request, {
    authorization: {
      actor: options.other
        ? pg.otherContext.actor
        : { ...pg.context.actor, employeeId: options.anotherEmployee ? secondActor : pg.employee },
      permissions: grants,
    },
    dependencies: { commercial: {}, manufacturing: options.repository ?? repo } as ApiDependencies,
    correlationId,
  });
};
const bodyOf = (response: Awaited<ReturnType<typeof dispatch>>): JsonObject =>
  response?.body as JsonObject;
const versionsOf = async (kind: Kind, rootId: string) =>
  rows(bodyOf(await dispatch(kind, rootId, { method: 'GET' })).versions);

async function retained(kind: Kind, rootId: string) {
  const action = `${domains[kind]}.version-created`;
  return (
    await pg.db.query<{ receipts: number; audits: number; events: number }>(
      `SELECT (SELECT count(*)::int FROM commercial_command_results WHERE tenant_id=$1 AND command_type=$2 AND subject_id=$3) receipts,
            (SELECT count(*)::int FROM audit_events WHERE organization_id=$1 AND action=$2 AND target_id=$3) audits,
            (SELECT count(*)::int FROM domain_event_outbox WHERE tenant_id=$1 AND event_type=$2 AND aggregate_id=$3) events`,
      [pg.company, action, rootId],
    )
  ).rows[0];
}

// Hold both real transactions after their version-number SELECTs. Each request then
// attempts the same version number, leaving PostgreSQL to arbitrate the unique constraint.
function racingRepository() {
  let arrivals = 0;
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const intercept = (tx: SqlClient): SqlClient => ({
    // Keep the intercepted query's typed projection while waiting at the race barrier.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    query: async <T extends Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[],
    ): Promise<Readonly<{ rows: T[]; rowCount: number | null }>> => {
      const result = await tx.query<T>(sql, values);
      if (sql.includes('next_version')) {
        arrivals += 1;
        if (arrivals === 2) release();
        await ready;
      }
      return result;
    },
  });
  const db: Db = {
    query: pg.db.query.bind(pg.db),
    transaction: (operation) => pg.db.transaction((tx) => operation(intercept(tx))),
  };
  return new PostgresManufacturingRepository(db);
}

const withoutIdentity = (value: JsonObject) => {
  const { id: _id, routing_version_id: _version, ...rest } = value;
  void _id;
  void _version;
  return rest;
};

describe.each(kinds)('%s version continuation over the real bridge and PostgreSQL', (kind) => {
  it('enforces manage scope, request fields, source root, idempotency header and strict schema', async () => {
    const original = await fixture(kind);
    const rootId = id(original, `${kind}Id`);
    const otherRoot = await fixture(kind);
    expect((await dispatch(kind, rootId, { manage: false }))?.statusCode).toBe(403);
    expect((await dispatch(kind, rootId, { narrow: true }))?.statusCode).toBe(403);
    expect(
      (await dispatch(kind, rootId, { fields: [], body: { effectiveAt: date } }))?.statusCode,
    ).toBe(403);
    expect((await dispatch(kind, rootId, { other: true }))?.statusCode).toBe(404);
    expect((await dispatch(kind, rootId, { key: null }))?.statusCode).toBe(400);
    expect((await dispatch(kind, rootId, { body: { publish: true } }))?.statusCode).toBe(400);
    expect(
      (await dispatch(kind, rootId, { body: { copyFromVersionId: id(otherRoot) } }))?.statusCode,
    ).toBe(404);
    expect(await retained(kind, rootId)).toEqual({ receipts: 0, audits: 0, events: 0 });
  });

  it('copies exact contents, records one audit and outbox, and replays simultaneous identical keys', async () => {
    const original = await fixture(kind);
    const rootId = id(original, `${kind}Id`);
    const [source] = await versionsOf(kind, rootId);
    const key = randomUUID();
    const pair = await Promise.all([
      dispatch(kind, rootId, { key }),
      dispatch(kind, rootId, { key }),
    ]);
    expect(pair.map((result) => result?.statusCode)).toEqual([201, 201]);
    const result = bodyOf(pair[0] ?? null);
    expect(result).toEqual(bodyOf(pair[1] ?? null));
    expect(result).toMatchObject({
      version: 2,
      status: 'DRAFT',
      published_at: null,
      effective_at: source?.effective_at,
    });
    expect((await versionsOf(kind, rootId))[0]).toEqual(result);
    if (kind === 'item') expect(result.specification).toEqual(source?.specification);
    if (kind === 'bom') {
      expect(result.outputQuantity).toBe(source?.outputQuantity);
      expect(result.lines).toEqual(source?.lines);
      expect(rows(result.lines)[0]?.quantityText).toBe('999999999999999999.123456');
    }
    if (kind === 'routing')
      expect(rows(result.operations).map(withoutIdentity)).toEqual(
        rows(source?.operations).map(withoutIdentity),
      );
    expect(await retained(kind, rootId)).toEqual({ receipts: 1, audits: 1, events: 1 });
    expect(
      (await dispatch(kind, rootId, { key, body: { effectiveAt: '2026-04-02' } }))?.statusCode,
    ).toBe(409);
    expect((await dispatch(kind, rootId, { key, anotherEmployee: true }))?.statusCode).toBe(409);
    const secondRoot = id(await fixture(kind), `${kind}Id`);
    expect((await dispatch(kind, secondRoot, { key }))?.statusCode).toBe(409);
    const patch =
      kind === 'item'
        ? { specification: { updated: true, offset: 0.01 } }
        : { effectiveAt: '2026-04-03' };
    const edited = await dispatch(kind, rootId, {
      body: { ...patch, copyFromVersionId: id(original) },
    });
    expect(edited?.statusCode).toBe(201);
    expect(bodyOf(edited)).toMatchObject({ version: 3, status: 'DRAFT' });
    if (kind === 'item')
      expect(bodyOf(edited).specification).toEqual({ updated: true, offset: 0.01 });
    const latest = await dispatch(kind, rootId);
    expect(bodyOf(latest)).toMatchObject({ version: 4, effective_at: bodyOf(edited).effective_at });
    if (kind === 'item')
      expect(bodyOf(latest).specification).toEqual({ updated: true, offset: 0.01 });
    expect((await versionsOf(kind, rootId)).at(-1)).toEqual(source);
  });

  it('maps different-key same-number conflicts to Chinese 409 and rolls back all evidence', async () => {
    const original = await fixture(kind);
    const rootId = id(original, `${kind}Id`);
    const repository = racingRepository();
    const outcomes = await Promise.all([
      dispatch(kind, rootId, { repository }),
      dispatch(kind, rootId, { repository }),
    ]);
    expect(outcomes.map((result) => result?.statusCode).sort()).toEqual([201, 409]);
    const rejected = outcomes.find((result) => result?.statusCode === 409);
    expect(rejected?.body).toMatchObject({
      error: { code: 'conflict', message: '其他操作已新建此版本，请刷新后重试' },
    });
    expect(await retained(kind, rootId)).toEqual({ receipts: 1, audits: 1, events: 1 });
    expect((await versionsOf(kind, rootId)).map((row) => row.version)).toEqual([2, 1]);
  });
});

it('TD-WEB-017 keeps the published BOM tree root when a newer, different draft coexists', async () => {
  const first = await fixture('bom');
  const rootId = id(first, 'bomId');
  const detailBefore = bodyOf(await dispatch('bom', rootId, { method: 'GET' }));
  const firstLine = rows(first.lines)[0];
  if (!firstLine) throw new Error('missing fixture BOM line');
  const created = await dispatch('bom', rootId, {
    body: {
      lines: [{ componentItemVersionId: id(firstLine, 'componentItemVersionId'), quantity: '7.5' }],
    },
  });
  expect(created?.statusCode).toBe(201);
  const detail = bodyOf(await dispatch('bom', rootId, { method: 'GET' }));
  expect(rows(detail.versions).map((r) => [r.version, r.status])).toEqual([
    [2, 'DRAFT'],
    [1, 'PUBLISHED'],
  ]);
  expect(detail.tree).toEqual(detailBefore.tree);
  await repo.publish('bom', id(bodyOf(created)), pg.context, randomUUID());
  const after = bodyOf(await dispatch('bom', rootId, { method: 'GET' }));
  expect(rows(after.versions).map((r) => r.status)).toEqual(['PUBLISHED', 'PUBLISHED']);
  expect(after.tree).not.toEqual(detailBefore.tree);
  expect(after.tree).toMatchObject([
    { version: 2, bomVersionId: bodyOf(created).id, lines: [{ quantity: 7.5 }] },
  ]);
});

it('keeps the original item and routing version IDs on an existing work order after publication', async () => {
  const routing = await fixture('routing');
  const itemRoot = id(routing, 'productItemId');
  const itemVersion = id(routing, 'productItemVersionId');
  const production = new PostgresProductionRepository(pg.db);
  const order = await production.create(
    {
      orderNumber: 'MFG7-EXISTING-ORDER',
      itemVersionId: itemVersion,
      routingVersionId: id(routing),
      plannedQuantity: '2',
      plannedStartAt: '2026-04-24',
      plannedDueAt: '2026-04-27',
      sourceReference: 'MFG7-OLD-ORDER',
    },
    pg.context,
    randomUUID(),
  );
  const policyId = randomUUID();
  await pg.db.query(
    "INSERT INTO mrp_planning_policies(id,tenant_id,item_version_id,make_or_buy,effective_at,created_by,canonical_hash) VALUES($1,$2,$3,'MAKE',$4,$5,$6)",
    [policyId, pg.company, itemVersion, date, pg.employee, 'a'.repeat(64)],
  );
  const nextItem = bodyOf(
    await dispatch('item', itemRoot, { body: { specification: { newGrade: 1 } } }),
  );
  await repo.publish('item', id(nextItem), pg.context, randomUUID());
  const nextRouting = bodyOf(
    await dispatch('routing', id(routing, 'routingId'), {
      body: { productItemVersionId: id(nextItem) },
    }),
  );
  await repo.publish('routing', id(nextRouting), pg.context, randomUUID());
  const current = await pg.db.query(
    'SELECT item_version_id, routing_version_id FROM production_orders WHERE tenant_id=$1 AND id=$2',
    [pg.company, order.id],
  );
  expect(current.rows[0]).toEqual({ item_version_id: itemVersion, routing_version_id: routing.id });
  expect(
    (
      await pg.db.query(
        'SELECT item_version_id FROM mrp_planning_policies WHERE tenant_id=$1 AND id=$2',
        [pg.company, policyId],
      )
    ).rows,
  ).toEqual([{ item_version_id: itemVersion }]);
  for (const [kind, root] of [
    ['item', itemRoot],
    ['routing', id(routing, 'routingId')],
  ] as const) {
    expect((await versionsOf(kind, root)).map((row) => row.status)).toEqual([
      'PUBLISHED',
      'PUBLISHED',
    ]);
  }
});
