import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';
import {
  bounded,
  controlledTransaction,
  outcome,
  waitForBlocking,
} from './fixtures/controlled-transaction.js';

// TD-MFG-014：父版本的发布 UPDATE 持 NO KEY UPDATE；外键只有 KEY SHARE，二者兼容。
// 新 INSERT 守卫必须取父版本 FOR SHARE，把「读状态→插子行」与发布串行化。
// 两连接真实竞争，用 pg_blocking_pids + pg_locks 确认等待点，不靠 sleep 安排先后。
const kinds = ['line', 'substitute', 'operation'] as const;
type Kind = (typeof kinds)[number];
const id = (row: JsonObject, key = 'id'): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};
let owned: Awaited<ReturnType<typeof ownedPostgres>>;
let repository: PostgresManufacturingRepository;
let product: JsonObject, raw: JsonObject, alternate: JsonObject;
beforeAll(async () => {
  owned = await ownedPostgres('mfg_child_concurrency');
  repository = new PostgresManufacturingRepository(owned.db);
  const item = (sku: string) =>
    repository.createItem(
      {
        sku,
        name: sku,
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      owned.context,
      randomUUID(),
    );
  product = await item('LOCK-FG');
  raw = await item('LOCK-RAW');
  alternate = await item('LOCK-ALT');
}, 30_000);
afterAll(async () => {
  await owned.close();
});

async function draft(kind: Kind) {
  const common = {
    code: `LOCK-${randomUUID()}`,
    name: kind,
    productItemId: id(product, 'itemId'),
    productItemVersionId: id(product),
    effectiveAt: '2026-01-01T00:00:00Z',
    publish: false,
  };
  if (kind === 'operation') {
    const created = await repository.createRouting(
      {
        ...common,
        operations: [
          {
            sequence: 1,
            operationCode: 'BASE',
            name: 'Base',
            workCenterCode: 'WC-1',
            setupMinutes: '0',
            runMinutesPerUnit: '1',
            instructions: {},
          },
        ],
      },
      owned.context,
      randomUUID(),
    );
    return {
      parent: id(created),
      publish:
        "UPDATE manufacturing_routing_versions SET status='PUBLISHED',published_at=now() WHERE id=$1",
      insert:
        "INSERT INTO manufacturing_routing_operations(tenant_id,routing_version_id,sequence,operation_code,name,work_center_code,setup_minutes,run_minutes_per_unit,instructions) VALUES($1,$2,2,'EXTRA','Extra','WC-1',0,1,'{}')",
      values: [owned.company, id(created)],
      count:
        'SELECT count(*)::int n FROM manufacturing_routing_operations WHERE routing_version_id=$1',
    };
  }
  const created = await repository.createBom(
    {
      ...common,
      outputQuantity: '1',
      lines: [
        { componentItemVersionId: id(raw), quantity: '1', scrapBasisPoints: 0, substitutes: [] },
      ],
    },
    owned.context,
    randomUUID(),
  );
  const line = (
    await owned.db.query<{ id: string }>(
      'SELECT id FROM manufacturing_bom_lines WHERE bom_version_id=$1',
      [id(created)],
    )
  ).rows[0]?.id;
  if (!line) throw new Error('BOM line missing');
  return {
    parent: id(created),
    publish:
      "UPDATE manufacturing_bom_versions SET status='PUBLISHED',published_at=now() WHERE id=$1",
    insert:
      kind === 'line'
        ? 'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity) VALUES($1,$2,2,$3,1)'
        : 'INSERT INTO manufacturing_bom_substitutes(tenant_id,bom_line_id,substitute_item_version_id,priority,conversion_factor) VALUES($1,$2,$3,1,1)',
    values: [owned.company, kind === 'line' ? id(created) : line, id(alternate)],
    count:
      kind === 'line'
        ? 'SELECT count(*)::int n FROM manufacturing_bom_lines WHERE bom_version_id=$1'
        : 'SELECT count(*)::int n FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id WHERE l.bom_version_id=$1',
  };
}

async function assertWaiting(waiter: number, blocker: number) {
  await waitForBlocking(owned.db, waiter, blocker);
  const locks = await owned.db.query<{ locktype: string; mode: string; granted: boolean }>(
    'SELECT locktype,mode,granted FROM pg_locks WHERE pid=$1 AND NOT granted',
    [waiter],
  );
  expect(locks.rows).toContainEqual({
    locktype: 'transactionid',
    mode: 'ShareLock',
    granted: false,
  });
  expect(
    (
      await owned.db.query<{ blocked: boolean }>(
        'SELECT $2::int=ANY(pg_blocking_pids($1::int)) blocked',
        [waiter, blocker],
      )
    ).rows[0]?.blocked,
  ).toBe(true);
}

describe.each(kinds)('TD-MFG-014 %s insertion versus publication on two connections', (kind) => {
  it('waits for an earlier publication and then rejects the insert against its committed status', async () => {
    const subject = await draft(kind);
    const publisher = controlledTransaction(owned.db, true);
    const inserter = controlledTransaction(owned.db);
    const publish = outcome(
      publisher.db.transaction((tx) => tx.query(subject.publish, [subject.parent])),
    );
    let insert: ReturnType<typeof outcome> | undefined;
    try {
      await bounded(publisher.written);
      insert = outcome(inserter.db.transaction((tx) => tx.query(subject.insert, subject.values)));
      await assertWaiting(await bounded(inserter.started), await bounded(publisher.started));
      publisher.release();
      expect((await bounded(publish)).ok).toBe(true);
      expect(await bounded(insert)).toMatchObject({
        ok: false,
        error: {
          code: 'P0001',
          message:
            'published manufacturing versions are immutable, child rows cannot be added, continue with a new draft version instead',
        },
      });
      expect(
        (await owned.db.query<{ n: number }>(subject.count, [subject.parent])).rows[0]?.n,
      ).toBe(kind === 'substitute' ? 0 : 1);
    } finally {
      publisher.release();
      await Promise.allSettled([publish, ...(insert ? [insert] : [])]);
    }
  }, 15_000);

  it('holds the draft parent until the earlier insert commits, then lets publication finish', async () => {
    const subject = await draft(kind);
    const inserter = controlledTransaction(owned.db, true);
    const publisher = controlledTransaction(owned.db);
    const insert = outcome(
      inserter.db.transaction((tx) => tx.query(subject.insert, subject.values)),
    );
    let publish: ReturnType<typeof outcome> | undefined;
    try {
      await bounded(inserter.written);
      publish = outcome(
        publisher.db.transaction((tx) => tx.query(subject.publish, [subject.parent])),
      );
      await assertWaiting(await bounded(publisher.started), await bounded(inserter.started));
      inserter.release();
      expect((await bounded(insert)).ok).toBe(true);
      expect((await bounded(publish)).ok).toBe(true);
      expect(
        (await owned.db.query<{ n: number }>(subject.count, [subject.parent])).rows[0]?.n,
      ).toBe(kind === 'substitute' ? 1 : 2);
    } finally {
      inserter.release();
      await Promise.allSettled([insert, ...(publish ? [publish] : [])]);
    }
  }, 15_000);
});
