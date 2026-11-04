import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate, migrationStatus, migrationsDirectory } from '@kingturf/database';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';
import { bounded, signal } from './fixtures/controlled-transaction.js';

async function legacyStock() {
  const directory = await mkdtemp(join(tmpdir(), 'kt-stock-v70-'));
  let owned: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  try {
    const files = (await readdir(migrationsDirectory)).filter(
      (name) => name.endsWith('.sql') && name < '0071_',
    );
    expect(files).toHaveLength(70);
    for (const file of files)
      await copyFile(join(migrationsDirectory, file), join(directory, file));
    owned = await ownedPostgres('stock_upgrade_pg', directory);
    const { db, context } = owned;
    const material = await new PostgresManufacturingRepository(db).createItem(
      {
        sku: 'LEGACY-STOCK',
        name: 'Legacy stock',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    );
    if (typeof material.id !== 'string') throw new Error('Legacy material missing');
    const repository = new PostgresProcurementRepository(db);
    const location = await repository.createLocation(
      { code: 'LEGACY-ONE', name: 'Legacy one', locationType: 'STORAGE' },
      context,
      randomUUID(),
    );
    if (typeof location.id !== 'string') throw new Error('Legacy location missing');
    const lot = randomUUID();
    await db.query(
      "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,'LEGACY-ONE',$3,'RELEASED')",
      [lot, context.actor.companyId, material.id],
    );
    const input = {
      movementType: 'ISSUE' as const,
      itemVersionId: material.id,
      lotId: lot,
      locationId: location.id,
      quantity: '7',
      occurredAt: '2026-10-26T00:00:00Z',
      sourceType: 'B3-UPGRADE',
      sourceId: randomUUID(),
    };
    await repository.move(
      { ...input, movementType: 'ADJUSTMENT_IN', quantity: '10' },
      context,
      randomUUID(),
    );
    const cleanup = owned.close;
    return {
      ...owned,
      repository,
      input,
      close: async () => {
        try {
          await cleanup();
        } finally {
          await rm(directory, { recursive: true, force: false });
        }
      },
    };
  } catch (error) {
    try {
      await owned?.close();
    } finally {
      await rm(directory, { recursive: true, force: false });
    }
    throw error;
  }
}

describe('0071 forward inventory compatibility', () => {
  it('upgrades real 0070 history without modifying ledger and keeps legacy SQL protected', async () => {
    const owned = await legacyStock();
    try {
      const before = (
        await owned.db.query(
          'SELECT id,canonical_hash,quantity_delta FROM inventory_movements ORDER BY sequence',
        )
      ).rows;
      expect(
        (await owned.db.query("SELECT to_regclass('inventory_stock_guards') value")).rows,
      ).toEqual([{ value: null }]);
      await migrate(owned.db);
      expect((await migrationStatus(owned.db)).every((row) => row.state === 'applied')).toBe(true);
      expect(
        (
          await owned.db.query(
            'SELECT id,canonical_hash,quantity_delta FROM inventory_movements ORDER BY sequence',
          )
        ).rows,
      ).toEqual(before);
      expect(
        (await owned.db.query('SELECT count(*)::int n FROM inventory_stock_guards')).rows,
      ).toEqual([{ n: 0 }]);
      // The old INSERT API is unchanged; the database now guards it.
      await owned.repository.move(owned.input, owned.context, randomUUID());
      await expect(
        owned.repository.move(
          { ...owned.input, sourceId: randomUUID() },
          owned.context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001' });
      expect(
        Number(
          (await owned.db.query<{ quantity: string }>('SELECT quantity FROM inventory_balances'))
            .rows[0]?.quantity,
        ),
      ).toBe(3);
    } finally {
      await owned.close();
    }
  });
  it('refuses preexisting negative stock and rolls back guard creation and migration registry', async () => {
    const owned = await legacyStock();
    try {
      const ready = signal<undefined>();
      let written = 0;
      const oldDb: ConstructorParameters<typeof PostgresProcurementRepository>[0] = {
        query: owned.db.query.bind(owned.db),
        transaction: (work) =>
          owned.db
            .transaction(async (tx) => {
              const result = await work(tx);
              written++;
              if (written === 2) ready.resolve(undefined);
              await bounded(ready.promise);
              return result;
            })
            .catch((error: unknown) => {
              ready.reject(error);
              throw error;
            }),
      };
      const repository = new PostgresProcurementRepository(oldDb);
      await Promise.all([
        repository.move(owned.input, owned.context, randomUUID()),
        repository.move({ ...owned.input, sourceId: randomUUID() }, owned.context, randomUUID()),
      ]);
      expect(
        Number(
          (await owned.db.query<{ quantity: string }>('SELECT quantity FROM inventory_balances'))
            .rows[0]?.quantity,
        ),
      ).toBe(-4);
      const before = (
        await owned.db.query(
          'SELECT id,canonical_hash,quantity_delta FROM inventory_movements ORDER BY sequence',
        )
      ).rows;
      await expect(migrate(owned.db)).rejects.toMatchObject({
        code: 'P0001',
        message: 'existing inventory balance is negative; reconcile before migration',
      });
      expect(
        (
          await owned.db.query(
            'SELECT id,canonical_hash,quantity_delta FROM inventory_movements ORDER BY sequence',
          )
        ).rows,
      ).toEqual(before);
      expect(
        (await owned.db.query("SELECT to_regclass('inventory_stock_guards') value")).rows,
      ).toEqual([{ value: null }]);
      expect(
        (
          await owned.db.query(
            "SELECT count(*)::int n FROM schema_migrations WHERE name LIKE '0071_%'",
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    } finally {
      await owned.close();
    }
  });
  it('rolls back newly created guard DDL if a later index creation fails', async () => {
    const owned = await legacyStock();
    try {
      await owned.db.query(
        'CREATE INDEX inventory_movements_stock_resource ON inventory_movements(tenant_id)',
      );
      const original = (
        await owned.db.query(
          "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='inventory_movements_stock_resource'",
        )
      ).rows;
      await expect(migrate(owned.db)).rejects.toMatchObject({ code: '42P07' });
      expect(
        (await owned.db.query("SELECT to_regclass('inventory_stock_guards') value")).rows,
      ).toEqual([{ value: null }]);
      expect(
        (
          await owned.db.query(
            "SELECT count(*)::int n FROM schema_migrations WHERE name LIKE '0071_%'",
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect(
        (
          await owned.db.query(
            "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='inventory_movements_stock_resource'",
          )
        ).rows,
      ).toEqual(original);
      expect(
        Number(
          (await owned.db.query<{ quantity: string }>('SELECT quantity FROM inventory_balances'))
            .rows[0]?.quantity,
        ),
      ).toBe(10);
    } finally {
      await owned.close();
    }
  });
});
