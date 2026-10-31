import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SqlClient } from '@kingturf/database';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';
import {
  bounded,
  controlledTransaction,
  outcome,
  signal,
  waitForBlocking,
} from './fixtures/controlled-transaction.js';

describe('TD-INV-001 cross-connection inventory resource integrity', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresProcurementRepository;
  let item: string, lot: string, location: string, secondLot: string, secondLocation: string;
  let foreignItem: string, foreignLot: string, foreignLocation: string;
  const state = () => {
    if (!fixture) throw new Error('Owned inventory fixture missing');
    return fixture;
  };
  const id = (row: Record<string, unknown>) => {
    if (typeof row.id !== 'string') throw new Error('Synthetic ID missing');
    return row.id;
  };
  const input = (
    quantity: string,
    overrides: Partial<Parameters<typeof repository.move>[0]> = {},
  ) => ({
    movementType: 'ISSUE' as const,
    itemVersionId: item,
    lotId: lot,
    locationId: location,
    quantity,
    occurredAt: '2026-10-26T00:00:00Z',
    sourceType: 'B3-INVENTORY',
    sourceId: randomUUID(),
    ...overrides,
  });
  const balance = async (
    stockLot = lot,
    stockLocation = location,
    tenant = state().context.actor.companyId,
  ) =>
    Number(
      (
        await state().db.query<{ quantity: string }>(
          'SELECT coalesce(sum(quantity_delta),0)::text quantity FROM inventory_movements WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
          [tenant, stockLot, stockLocation],
        )
      ).rows[0]?.quantity,
    );
  const counts = async (correlation: string) =>
    (
      await state().db.query<{ movements: number; audit: number; outbox: number }>(
        'SELECT (SELECT count(*)::int FROM inventory_movements WHERE correlation_id=$1) movements,(SELECT count(*)::int FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::int FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  const revision = async () =>
    (
      await state().db.query<{ revision: string }>(
        'SELECT revision::text FROM inventory_stock_guards WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
        [state().context.actor.companyId, lot, location],
      )
    ).rows;
  beforeEach(async () => {
    fixture = await ownedPostgres('stock_resource_pg');
    const { context, otherContext, db } = fixture;
    repository = new PostgresProcurementRepository(db);
    const manufacturing = new PostgresManufacturingRepository(db);
    const createItem = (sku: string, scope = context) =>
      manufacturing.createItem(
        {
          sku,
          name: sku,
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        scope,
        randomUUID(),
      );
    item = id(await createItem('B3-STOCK'));
    foreignItem = id(await createItem('B3-FOREIGN', otherContext));
    location = id(
      await repository.createLocation(
        { code: 'B3-ONE', name: 'One', locationType: 'STORAGE' },
        context,
        randomUUID(),
      ),
    );
    secondLocation = id(
      await repository.createLocation(
        { code: 'B3-TWO', name: 'Two', locationType: 'STORAGE' },
        context,
        randomUUID(),
      ),
    );
    foreignLocation = id(
      await repository.createLocation(
        { code: 'B3-FOREIGN', name: 'Foreign', locationType: 'STORAGE' },
        otherContext,
        randomUUID(),
      ),
    );
    lot = randomUUID();
    secondLot = randomUUID();
    foreignLot = randomUUID();
    await db.query(
      "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,'B3-ONE',$3,'RELEASED'),($4,$2,'B3-TWO',$3,'RELEASED'),($5,$6,'B3-FOREIGN',$7,'RELEASED')",
      [
        lot,
        context.actor.companyId,
        item,
        secondLot,
        foreignLot,
        otherContext.actor.companyId,
        foreignItem,
      ],
    );
    await repository.move(input('10', { movementType: 'ADJUSTMENT_IN' }), context, randomUUID());
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  async function competed(
    firstInput: Parameters<typeof repository.move>[0],
    secondInput: Parameters<typeof repository.move>[0],
  ) {
    const { db, context } = state(),
      firstGate = controlledTransaction(db, true),
      secondGate = controlledTransaction(db);
    const firstCorrelation = randomUUID(),
      secondCorrelation = randomUUID();
    const first = outcome(
      new PostgresProcurementRepository(firstGate.db).move(firstInput, context, firstCorrelation),
    );
    let second: ReturnType<typeof outcome> | undefined;
    try {
      await firstGate.written;
      second = outcome(
        new PostgresProcurementRepository(secondGate.db).move(
          secondInput,
          context,
          secondCorrelation,
        ),
      );
      await waitForBlocking(db, await secondGate.started, await firstGate.started);
      firstGate.release();
      return { first: await first, second: await second, firstCorrelation, secondCorrelation };
    } finally {
      firstGate.release();
      secondGate.release();
      await first;
      await second;
    }
  }
  it('serializes 7+7 at a lazily created guard while retaining old ledger quantities', async () => {
    // Emulate a migrated legacy resource whose guard has not yet been materialized.
    await state().db.query(
      'DELETE FROM inventory_stock_guards WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
      [state().context.actor.companyId, lot, location],
    );
    const result = await competed(input('7'), input('7'));
    expect(result.first.ok).toBe(true);
    expect(result.second).toMatchObject({ ok: false, error: { code: 'P0001' } });
    expect(await balance()).toBe(3);
    expect(await counts(result.firstCorrelation)).toEqual({ movements: 1, audit: 1, outbox: 1 });
    expect(await counts(result.secondCorrelation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
    expect(await revision()).toEqual([{ revision: '1' }]);
  });
  it('exhausts exactly ten, preserves an empty zero balance projection and rejects shortage atomically', async () => {
    await repository.move(input('10'), state().context, randomUUID());
    expect(await balance()).toBe(0);
    expect(
      (
        await state().db.query(
          'SELECT * FROM inventory_balances WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
          [state().context.actor.companyId, lot, location],
        )
      ).rows,
    ).toEqual([]);
    const before = await revision(),
      correlation = randomUUID();
    await expect(repository.move(input('1'), state().context, correlation)).rejects.toMatchObject({
      code: 'P0001',
      message: 'inventory movement cannot create negative lot balance',
    });
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
    expect(await revision()).toEqual(before);
    expect(await balance()).toBe(0);
  });
  it('keeps duplicate source retries unique including truly competing requests', async () => {
    const request = input('2'),
      result = await competed(request, request);
    expect(result.first.ok).toBe(true);
    expect(result.second).toMatchObject({ ok: false, error: { code: '23505' } });
    expect(await counts(result.secondCorrelation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
    expect(await balance()).toBe(8);
    const before = await revision(),
      correlation = randomUUID();
    await expect(repository.move(request, state().context, correlation)).rejects.toMatchObject({
      code: '23505',
    });
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
    expect(await revision()).toEqual(before);
  });
  it.each([
    { first: 'ISSUE', q1: '7', second: 'RETURN', q2: '4', remaining: 7 },
    { first: 'RETURN', q1: '4', second: 'ISSUE', q2: '11', remaining: 3 },
  ] as const)('uses the post-wait balance for $first then $second', async (row) => {
    const result = await competed(
      input(row.q1, { movementType: row.first }),
      input(row.q2, { movementType: row.second }),
    );
    expect(result.first.ok).toBe(true);
    expect(result.second.ok).toBe(true);
    expect(await balance()).toBe(row.remaining);
    expect(await counts(result.firstCorrelation)).toEqual({ movements: 1, audit: 1, outbox: 1 });
    expect(await counts(result.secondCorrelation)).toEqual({ movements: 1, audit: 1, outbox: 1 });
  });
  it.each(['REPEATABLE READ', 'SERIALIZABLE'] as const)(
    'fails stale $0 snapshots rather than creating negative stock',
    async (isolation) => {
      const { db, context } = state(),
        ready = signal<undefined>(),
        go = signal<undefined>(),
        correlation = randomUUID();
      const stale = outcome(
        db
          .transaction(async (tx) => {
            await tx.query(
              isolation === 'REPEATABLE READ'
                ? 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
                : 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
            );
            await tx.query('SELECT sum(quantity_delta) FROM inventory_movements WHERE lot_id=$1', [
              lot,
            ]);
            ready.resolve(undefined);
            await go.promise;
            const nested: ConstructorParameters<typeof PostgresProcurementRepository>[0] = {
              query: tx.query.bind(tx),
              transaction: (work) => work(tx),
            };
            return new PostgresProcurementRepository(nested).move(input('7'), context, correlation);
          })
          .catch((error: unknown) => {
            ready.reject(error);
            throw error;
          }),
      );
      try {
        await bounded(ready.promise);
        await repository.move(input('7'), context, randomUUID());
        go.resolve(undefined);
        expect(await stale).toMatchObject({ ok: false, error: { code: '40001' } });
      } finally {
        go.resolve(undefined);
        await stale;
      }
      expect(await balance()).toBe(3);
      expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
      await expect(repository.move(input('7'), context, randomUUID())).rejects.toMatchObject({
        code: 'P0001',
      });
      expect((await db.query('SELECT 1 ok')).rows).toEqual([{ ok: 1 }]);
    },
  );
  it('also rejects a stale RR snapshot when the shared guard is initially absent', async () => {
    const { db, context } = state();
    await db.query(
      'DELETE FROM inventory_stock_guards WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
      [context.actor.companyId, lot, location],
    );
    const ready = signal<undefined>(),
      go = signal<undefined>(),
      correlation = randomUUID();
    const stale = outcome(
      db
        .transaction(async (tx) => {
          await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
          await tx.query('SELECT sum(quantity_delta) FROM inventory_movements WHERE lot_id=$1', [
            lot,
          ]);
          ready.resolve(undefined);
          await go.promise;
          return new PostgresProcurementRepository({
            query: tx.query.bind(tx),
            transaction: (work) => work(tx),
          }).move(input('7'), context, correlation);
        })
        .catch((error: unknown) => {
          ready.reject(error);
          throw error;
        }),
    );
    try {
      await bounded(ready.promise);
      await repository.move(input('7'), context, randomUUID());
      go.resolve(undefined);
      expect(await stale).toMatchObject({ ok: false, error: { code: '40001' } });
    } finally {
      go.resolve(undefined);
      await stale;
    }
    expect(await balance()).toBe(3);
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
  });
  it('coordinates first zero-balance concurrent inbound operations on a previously unused resource', async () => {
    const result = await competed(
      input('4', { movementType: 'RETURN', lotId: secondLot }),
      input('6', { movementType: 'RETURN', lotId: secondLot }),
    );
    expect(result.first.ok).toBe(true);
    expect(result.second.ok).toBe(true);
    expect(await balance(secondLot)).toBe(10);
  });
  it('does not serialize unrelated locations, lots, materials or companies', async () => {
    const { db, context, otherContext } = state();
    const otherMaterial = id(
      await new PostgresManufacturingRepository(db).createItem(
        {
          sku: 'B3-DIFFERENT-MATERIAL',
          name: 'Another material',
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        context,
        randomUUID(),
      ),
    );
    const otherMaterialLot = randomUUID();
    await db.query(
      "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,'B3-OTHER-MATERIAL',$3,'RELEASED')",
      [otherMaterialLot, context.actor.companyId, otherMaterial],
    );
    const variants = [
      { lotId: lot, locationId: secondLocation, itemVersionId: item, scope: context },
      { lotId: secondLot, locationId: location, itemVersionId: item, scope: context },
      {
        lotId: otherMaterialLot,
        locationId: location,
        itemVersionId: otherMaterial,
        scope: context,
      },
      {
        lotId: foreignLot,
        locationId: foreignLocation,
        itemVersionId: foreignItem,
        scope: otherContext,
      },
    ];
    for (const { scope, ...resource } of variants) {
      await repository.move(
        input('10', { ...resource, movementType: 'ADJUSTMENT_IN' }),
        scope,
        randomUUID(),
      );
      const gate = controlledTransaction(db, true),
        pending = outcome(
          new PostgresProcurementRepository(gate.db).move(input('1'), context, randomUUID()),
        );
      let otherPending: ReturnType<typeof outcome> | undefined;
      try {
        await gate.written;
        otherPending = outcome(repository.move(input('1', resource), scope, randomUUID()));
        expect((await bounded(otherPending)).ok).toBe(true);
        expect(await balance(resource.lotId, resource.locationId, scope.actor.companyId)).toBe(9);
      } finally {
        gate.release();
        await pending;
        await otherPending;
      }
    }
  });
  it('rejects foreign resources and mismatched material without guard or evidence residue', async () => {
    for (const override of [
      { lotId: foreignLot, itemVersionId: foreignItem },
      { locationId: foreignLocation },
      { itemVersionId: foreignItem },
    ]) {
      const before = await revision(),
        correlation = randomUUID();
      await expect(
        repository.move(input('1', override), state().context, correlation),
      ).rejects.toThrow();
      expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
      expect(await revision()).toEqual(before);
    }
    expect(await balance()).toBe(10);
  });
  it('rolls back earlier writes of a failing multi-statement transaction including guard and paired evidence', async () => {
    const { db, context } = state(),
      first = randomUUID(),
      second = randomUUID(),
      before = await revision();
    await expect(
      db.transaction(async (tx) => {
        const moves = new PostgresProcurementRepository({
          query: tx.query.bind(tx),
          transaction: (work) => work(tx),
        });
        await moves.move(input('7'), context, first);
        await moves.move(input('7'), context, second);
      }),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect(await balance()).toBe(10);
    expect(await revision()).toEqual(before);
    for (const correlation of [first, second])
      expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
  });
  const rawInsert = (tx: SqlClient, stockLot: string, stockLocation: string, correlation: string) =>
    tx.query(
      "INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,'ISSUE',$2,$3,$4,-7,now(),'B3-RAW',$5,repeat('a',64),$6,$7),($1,'ISSUE',$2,$3,$4,-7,now(),'B3-RAW',$8,repeat('a',64),$6,$7)",
      [
        state().context.actor.companyId,
        item,
        stockLot,
        stockLocation,
        randomUUID(),
        state().context.actor.employeeId,
        correlation,
        randomUUID(),
      ],
    );
  it('protects direct same-statement multi-row inserts and restores the guard on rejection', async () => {
    const before = await revision(),
      correlation = randomUUID();
    await expect(rawInsert(state().db, lot, location, correlation)).rejects.toMatchObject({
      code: 'P0001',
    });
    expect(await balance()).toBe(10);
    expect(await revision()).toEqual(before);
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
  });
  it('rolls inventory and guard back when a later production order/quality guard fails', async () => {
    const before = await revision(),
      correlation = randomUUID();
    await expect(
      new PostgresProductionRepository(state().db).transactMaterial(
        randomUUID(),
        {
          transactionType: 'ISSUE',
          itemVersionId: item,
          lotId: lot,
          locationId: location,
          quantity: '1',
          reason: 'Synthetic late production guard failure',
          occurredAt: '2026-10-26T00:00:00Z',
          idempotencyKey: randomUUID(),
        },
        state().context,
        correlation,
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'production issue requires released BOM material',
    });
    expect(await balance()).toBe(10);
    expect(await revision()).toEqual(before);
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
  });
  it('aborts an unsorted two-resource deadlock victim with no partial inventory or success evidence', async () => {
    const { db, context } = state();
    await repository.move(
      input('10', { lotId: secondLot, movementType: 'ADJUSTMENT_IN' }),
      context,
      randomUUID(),
    );
    const firstReady = signal<undefined>(),
      secondReady = signal<undefined>(),
      correlations = [randomUUID(), randomUUID()] as const;
    const run = (reverse: boolean, correlation: string) =>
      outcome(
        db
          .transaction(async (tx) => {
            const moves = new PostgresProcurementRepository({
              query: tx.query.bind(tx),
              transaction: (work) => work(tx),
            });
            await moves.move(
              input('1', { lotId: reverse ? secondLot : lot }),
              context,
              correlation,
            );
            (reverse ? secondReady : firstReady).resolve(undefined);
            await bounded((reverse ? firstReady : secondReady).promise);
            await moves.move(
              input('1', { lotId: reverse ? lot : secondLot }),
              context,
              correlation,
            );
          })
          .catch((error: unknown) => {
            firstReady.reject(error);
            secondReady.reject(error);
            throw error;
          }),
      );
    const results = await Promise.all([run(false, correlations[0]), run(true, correlations[1])]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, error: { code: '40P01' } });
    expect(await balance()).toBe(9);
    expect(await balance(secondLot)).toBe(9);
    for (const [index, result] of results.entries())
      expect(await counts(correlations[index] ?? '')).toEqual(
        result.ok ? { movements: 2, audit: 2, outbox: 2 } : { movements: 0, audit: 0, outbox: 0 },
      );
    expect((await db.query('SELECT 1 ok')).rows).toEqual([{ ok: 1 }]);
  });
  it('uses a stable resource order for concurrent commands touching two existing resources', async () => {
    const { db, context } = state();
    await repository.move(
      input('10', { lotId: secondLot, movementType: 'ADJUSTMENT_IN' }),
      context,
      randomUUID(),
    );
    const order = [lot, secondLot].sort(),
      gate = controlledTransaction(db, true),
      other = controlledTransaction(db);
    const command = (
      connection: ConstructorParameters<typeof PostgresProcurementRepository>[0],
      reverse: boolean,
    ) =>
      connection.transaction(async (tx) => {
        for (const stockLot of order)
          await tx.query(
            'INSERT INTO inventory_stock_guards AS g(tenant_id,lot_id,location_id,revision) VALUES($1,$2,$3,1) ON CONFLICT(tenant_id,lot_id,location_id) DO UPDATE SET revision=g.revision+1',
            [context.actor.companyId, stockLot, location],
          );
        const moves = new PostgresProcurementRepository({
          query: tx.query.bind(tx),
          transaction: (work) => work(tx),
        });
        for (const stockLot of reverse ? [...order].reverse() : order)
          await moves.move(input('1', { lotId: stockLot }), context, randomUUID());
      });
    const first = outcome(command(gate.db, false));
    let second: ReturnType<typeof outcome> | undefined;
    try {
      await gate.written;
      second = outcome(command(other.db, true));
      await waitForBlocking(db, await other.started, await gate.started);
      gate.release();
      expect((await first).ok).toBe(true);
      expect((await second).ok).toBe(true);
    } finally {
      gate.release();
      other.release();
      await first;
      await second;
    }
    expect(await balance()).toBe(8);
    expect(await balance(secondLot)).toBe(8);
  });
  it('propagates an early SQL failure to waiting checkpoints and releases the connection', async () => {
    const gate = controlledTransaction(state().db, true),
      correlation = randomUUID();
    const pending = outcome(
      new PostgresProcurementRepository(gate.db).move(input('11'), state().context, correlation),
    );
    try {
      await expect(bounded(gate.written)).rejects.toMatchObject({ code: 'P0001' });
      expect(await pending).toMatchObject({ ok: false, error: { code: 'P0001' } });
    } finally {
      gate.release();
      await pending;
    }
    expect(await counts(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
    expect(await balance()).toBe(10);
    await repository.move(input('1'), state().context, randomUUID());
    expect(await balance()).toBe(9);
  });
});
