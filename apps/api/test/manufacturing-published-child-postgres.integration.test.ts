import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrationsDirectory } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { insertBomLines, insertRoutingOperations } from '../src/manufacturing-version-contents.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// TD-MFG-014（MG2）：已发布版本的子行不可变。迁移 0036 的 protect_published_manufacturing_child
// 只在 UPDATE / DELETE 时触发，向已发布的工艺路线 / BOM 行项 / 替代料直接 INSERT 子行不会被拦下。
// 迁移 0078 给这个函数加上 INSERT 分支，并把三个冻结触发器改成 BEFORE INSERT OR UPDATE OR
// DELETE；UPDATE / DELETE 分支与 0036 逐字一致（packages/database/test/migrations.test.ts 机械比对）。
// 这里在真库上钉住：已发布版本拒插、草稿照常、既有写入口（创建即发布、续版复制子行）不受影响，
// 并用「装回 0036 的旧定义 → 放行 → 重放 0078 → 再拒绝」证明起作用的正是这次改动。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const migrationSql = (name: string) => readFile(join(migrationsDirectory, name), 'utf8');
const GUARD_0078 = '0078_manufacturing_published_child_insert_guard.sql';
const INSERT_MESSAGE =
  'published manufacturing versions are immutable, child rows cannot be added, continue with a new draft version instead';
const UPDATE_DELETE_MESSAGE = 'published manufacturing child rows are immutable';
const FROZEN_TRIGGERS = [
  ['manufacturing_bom_line_frozen', 'manufacturing_bom_lines'],
  ['manufacturing_bom_substitute_frozen', 'manufacturing_bom_substitutes'],
  ['manufacturing_routing_operation_frozen', 'manufacturing_routing_operations'],
] as const;
// 0036 里这个函数的原始定义（没有 INSERT 分支），用来证明旧行为确实放行。
const legacyGuard = async () => {
  const sql = await migrationSql('0036_manufacturing_master_data.sql');
  const definition =
    /CREATE FUNCTION protect_published_manufacturing_child\(\)[\s\S]*?END \$\$;/u.exec(sql)?.[0];
  if (!definition)
    throw new Error('0036 protect_published_manufacturing_child definition not found');
  const triggers = [
    ...sql.matchAll(
      /^CREATE TRIGGER manufacturing_(?:bom_line|bom_substitute|routing_operation)_frozen .*;$/gmu,
    ),
  ].map((match) => match[0]);
  if (triggers.length !== 3) throw new Error('0036 frozen trigger definitions not found');
  return {
    definition: definition.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'),
    triggers,
  };
};
const rollback = new Error('mg2 rollback sentinel');

describe('TD-MFG-014 published manufacturing versions reject inserted child rows', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresManufacturingRepository;
  let product: JsonObject, raw: JsonObject, alternate: JsonObject;
  let routingPublished: JsonObject, routingDraft: JsonObject;
  let bomPublished: JsonObject, bomDraft: JsonObject, publishedLine: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  /** 在总是回滚的事务里执行一条语句，返回它抛出的数据库错误（成功则为 null）。 */
  const attempt = async (sql: string, values: readonly unknown[]) => {
    let caught: { code?: unknown; message?: unknown } | null = null;
    await state()
      .db.transaction(async (tx) => {
        try {
          await tx.query(sql, values);
        } catch (error) {
          caught = error as { code?: unknown; message?: unknown };
        }
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
      });
    return caught;
  };
  const insertOperation = (routingVersionId: string) =>
    attempt(
      "INSERT INTO manufacturing_routing_operations(tenant_id,routing_version_id,sequence,operation_code,name,work_center_code,setup_minutes,run_minutes_per_unit,instructions) VALUES($1,$2,3,'EXTRA','Extra','WC-1',5,1,'{}')",
      [state().context.actor.companyId, routingVersionId],
    );
  const insertLine = (bomVersionId: string) =>
    attempt(
      'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity,scrap_basis_points) VALUES($1,$2,9,$3,1,0)',
      [state().context.actor.companyId, bomVersionId, identifier(raw)],
    );
  const insertSubstitute = (lineId: string) =>
    attempt(
      'INSERT INTO manufacturing_bom_substitutes(tenant_id,bom_line_id,substitute_item_version_id,priority,conversion_factor) VALUES($1,$2,$3,9,1)',
      [state().context.actor.companyId, lineId, identifier(product)],
    );
  const triggersOf = async (table: string) =>
    (
      await state().db.query<{ tgname: string; definition: string }>(
        'SELECT t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t WHERE t.tgrelid=$1::regclass AND NOT t.tgisinternal ORDER BY t.tgname',
        [table],
      )
    ).rows;

  beforeAll(async () => {
    fixture = await ownedPostgres('mfg_child_guard');
    repository = new PostgresManufacturingRepository(fixture.db);
    const { context } = fixture;
    const item = (sku: string, itemType = 'RAW_MATERIAL') =>
      repository.createItem(
        {
          sku,
          name: sku,
          itemType,
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        context,
        randomUUID(),
      );
    product = await item('FG-1', 'FINISHED_GOOD');
    raw = await item('RAW-1');
    alternate = await item('ALT-1');
    const routing = async (code: string, publish: boolean) =>
      repository.createRouting(
        {
          code,
          name: code,
          productItemId: identifier(product, 'itemId'),
          productItemVersionId: identifier(product),
          effectiveAt: '2026-01-01T00:00:00Z',
          operations: [
            {
              operationCode: 'TUFT',
              name: 'Tuft',
              workCenterCode: 'WC-1',
              sequence: 1,
              setupMinutes: '10',
              runMinutesPerUnit: '1.5',
              instructions: {},
            },
          ],
          publish,
        },
        context,
        randomUUID(),
      );
    routingPublished = await routing('RT-PUB', true);
    routingDraft = await routing('RT-DRAFT', false);
    const lines = [
      {
        componentItemVersionId: identifier(raw),
        quantity: '1.25',
        scrapBasisPoints: 0,
        substitutes: [{ itemVersionId: identifier(alternate), priority: 1, conversionFactor: '1' }],
      },
    ];
    const bom = async (code: string, publish: boolean) =>
      repository.createBom(
        {
          code,
          name: code,
          productItemId: identifier(product, 'itemId'),
          productItemVersionId: identifier(product),
          outputQuantity: '1',
          effectiveAt: '2026-01-01T00:00:00Z',
          lines,
          publish,
        },
        context,
        randomUUID(),
      );
    bomPublished = await bom('BM-PUB', true);
    bomDraft = await bom('BM-DRAFT', false);
    publishedLine =
      (
        await fixture.db.query<{ id: string }>(
          'SELECT id FROM manufacturing_bom_lines WHERE tenant_id=$1 AND bom_version_id=$2 ORDER BY line_number LIMIT 1',
          [context.actor.companyId, identifier(bomPublished)],
        )
      ).rows[0]?.id ?? '';
  }, 30_000);
  afterAll(async () => {
    await fixture?.close();
  });

  it('rejects a child row inserted under a published version on all three child tables', async () => {
    expect(await insertOperation(identifier(routingPublished))).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
    expect(await insertLine(identifier(bomPublished))).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
    expect(await insertSubstitute(publishedLine)).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
    expect(publishedLine).not.toBe('');
    expect(
      (
        await state().db.query<{ n: number }>(
          'SELECT (SELECT count(*)::int FROM manufacturing_routing_operations WHERE routing_version_id=$1)+(SELECT count(*)::int FROM manufacturing_bom_lines WHERE bom_version_id=$2)+(SELECT count(*)::int FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id WHERE l.bom_version_id=$2) n',
          [identifier(routingPublished), identifier(bomPublished)],
        )
      ).rows[0]?.n,
    ).toBe(3);
  });

  it('lets the shared child insert helpers write under a draft version only', async () => {
    const { db, context } = state();
    const companyId = context.actor.companyId;
    const lines = [
      {
        lineNumber: 2,
        componentItemVersionId: identifier(raw),
        quantity: '2',
        scrapBasisPoints: 0,
        substitutes: [{ itemVersionId: identifier(alternate), priority: 2, conversionFactor: '1' }],
      },
    ];
    const operations = [
      {
        operationCode: 'COAT',
        name: 'Coat',
        workCenterCode: 'WC-1',
        sequence: 2,
        setupMinutes: '5',
        runMinutesPerUnit: '1',
        instructions: {},
      },
    ];
    await expect(
      db.transaction(async (tx) => {
        await insertBomLines(tx, companyId, identifier(bomPublished), lines);
      }),
    ).rejects.toMatchObject({ code: 'P0001', message: INSERT_MESSAGE });
    await expect(
      db.transaction(async (tx) => {
        await insertRoutingOperations(tx, companyId, identifier(routingPublished), operations);
      }),
    ).rejects.toMatchObject({ code: 'P0001', message: INSERT_MESSAGE });
    await db.transaction(async (tx) => {
      await insertBomLines(tx, companyId, identifier(bomDraft), lines);
      await insertRoutingOperations(tx, companyId, identifier(routingDraft), operations);
    });
    expect(
      (
        await db.query<{ lines: number; operations: number }>(
          'SELECT (SELECT count(*)::int FROM manufacturing_bom_lines WHERE bom_version_id=$1) lines,(SELECT count(*)::int FROM manufacturing_routing_operations WHERE routing_version_id=$2) operations',
          [identifier(bomDraft), identifier(routingDraft)],
        )
      ).rows[0],
    ).toEqual({ lines: 2, operations: 2 });
  });

  it('keeps drafts open to plain inserts and keeps the 0036 update / delete wording', async () => {
    expect(await insertOperation(identifier(routingDraft))).toBeNull();
    expect(await insertLine(identifier(bomDraft))).toBeNull();
    const draftLine = (
      await state().db.query<{ id: string }>(
        'SELECT id FROM manufacturing_bom_lines WHERE tenant_id=$1 AND bom_version_id=$2 ORDER BY line_number LIMIT 1',
        [state().context.actor.companyId, identifier(bomDraft)],
      )
    ).rows[0]?.id;
    if (!draftLine) throw new Error('Draft BOM line missing');
    expect(await insertSubstitute(draftLine)).toBeNull();
    expect(
      await attempt(
        "UPDATE manufacturing_routing_operations SET name='Renamed' WHERE routing_version_id=$1",
        [identifier(routingPublished)],
      ),
    ).toMatchObject({ code: 'P0001', message: UPDATE_DELETE_MESSAGE });
    expect(
      await attempt('DELETE FROM manufacturing_bom_lines WHERE id=$1', [publishedLine]),
    ).toMatchObject({ code: 'P0001', message: UPDATE_DELETE_MESSAGE });
    expect(
      await attempt('DELETE FROM manufacturing_bom_substitutes WHERE bom_line_id=$1', [
        publishedLine,
      ]),
    ).toMatchObject({ code: 'P0001', message: UPDATE_DELETE_MESSAGE });
  });

  it('leaves foreign-key failures to the foreign key: a missing parent is not reported as the guard', async () => {
    expect(await insertLine(randomUUID())).toMatchObject({ code: '23503' });
    expect(await insertSubstitute(randomUUID())).toMatchObject({ code: '23503' });
  });

  it('does not disturb create-then-publish or continuing a published version into a new draft', async () => {
    const { context } = state();
    const bom = (code: string, quantity: string) =>
      repository.createBom(
        {
          code,
          name: code,
          productItemId: identifier(product, 'itemId'),
          productItemVersionId: identifier(product),
          outputQuantity: '1',
          effectiveAt: '2026-01-01T00:00:00Z',
          lines: [
            {
              componentItemVersionId: identifier(raw),
              quantity,
              scrapBasisPoints: 0,
              substitutes: [
                { itemVersionId: identifier(alternate), priority: 1, conversionFactor: '2' },
              ],
            },
          ],
          publish: true,
        },
        context,
        randomUUID(),
      );
    // 创建即发布：子行先落在新草稿下，再发布。
    expect((await bom('BM-CREATE-PUBLISH', '3')).status).toBe('PUBLISHED');
    // 续版：从已发布版本复制子行到新草稿，再把新草稿发布。来源在本用例内新建，不依赖其它用例。
    const source = await bom('BM-SOURCE', '3');
    const continued = await repository.createBomVersion(
      identifier(source, 'bomId'),
      { outputQuantity: '2' },
      randomUUID(),
      context,
      randomUUID(),
    );
    expect(continued.version).toBe(2);
    expect(continued.status).toBe('DRAFT');
    expect(
      (
        await state().db.query<{ lines: number; substitutes: number }>(
          'SELECT (SELECT count(*)::int FROM manufacturing_bom_lines WHERE bom_version_id=$1) lines,(SELECT count(*)::int FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id WHERE l.bom_version_id=$1) substitutes',
          [identifier(continued)],
        )
      ).rows[0],
    ).toEqual({ lines: 1, substitutes: 1 });
    await repository.publish('bom', identifier(continued), context, randomUUID());
    expect(
      (
        await state().db.query<{ status: string; lines: number }>(
          'SELECT v.status,(SELECT count(*)::int FROM manufacturing_bom_lines l WHERE l.bom_version_id=v.id) lines FROM manufacturing_bom_versions v WHERE v.id=$1',
          [identifier(continued)],
        )
      ).rows[0],
    ).toEqual({ status: 'PUBLISHED', lines: 1 });
    const sourceRouting = await repository.createRouting(
      {
        code: 'RT-SOURCE',
        name: 'RT-SOURCE',
        productItemId: identifier(product, 'itemId'),
        productItemVersionId: identifier(product),
        effectiveAt: '2026-01-01T00:00:00Z',
        operations: [
          {
            operationCode: 'TUFT',
            name: 'Tuft',
            workCenterCode: 'WC-1',
            sequence: 1,
            setupMinutes: '10',
            runMinutesPerUnit: '1.5',
            instructions: {},
          },
        ],
        publish: true,
      },
      context,
      randomUUID(),
    );
    const routed = await repository.createRoutingVersion(
      identifier(sourceRouting, 'routingId'),
      {},
      randomUUID(),
      context,
      randomUUID(),
    );
    await repository.publish('routing', identifier(routed), context, randomUUID());
    expect(
      (
        await state().db.query<{ status: string; operations: number }>(
          'SELECT v.status,(SELECT count(*)::int FROM manufacturing_routing_operations o WHERE o.routing_version_id=v.id) operations FROM manufacturing_routing_versions v WHERE v.id=$1',
          [identifier(routed)],
        )
      ).rows[0],
    ).toEqual({ status: 'PUBLISHED', operations: 1 });
  });

  it('is really the 0036 guard that let the insert through: the old definition admits it, 0078 rejects it again', async () => {
    const { db } = state();
    const legacy = await legacyGuard();
    await db.transaction(async (tx) => {
      await tx.query(legacy.definition);
      for (const [trigger, table] of FROZEN_TRIGGERS)
        await tx.query(`DROP TRIGGER ${trigger} ON ${table}`);
      for (const trigger of legacy.triggers) await tx.query(trigger);
    });
    // 旧定义 + 旧事件：向已发布版本插入子行成功（MFG-7 验收看到的旧行为）。
    expect(await insertOperation(identifier(routingPublished))).toBeNull();
    expect(await insertLine(identifier(bomPublished))).toBeNull();
    expect(await insertSubstitute(publishedLine)).toBeNull();
    await db.transaction(async (tx) => {
      await tx.query(await migrationSql(GUARD_0078));
    });
    expect(await insertOperation(identifier(routingPublished))).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
    expect(await insertLine(identifier(bomPublished))).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
    expect(await insertSubstitute(publishedLine)).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
  });

  it('re-applies 0078 twice inside one transaction as a no-op: same function, one trigger per table', async () => {
    const { db } = state();
    const file = await migrationSql(GUARD_0078);
    const definition = async () =>
      (
        await db.query<{ definition: string }>(
          'SELECT pg_get_functiondef($1::regproc) definition',
          ['protect_published_manufacturing_child'],
        )
      ).rows[0]?.definition;
    const before = await definition();
    // 整个迁移文件原样执行两遍，同一个事务（迁移运行器就是每文件一个事务）。
    await db.transaction(async (tx) => {
      await tx.query(file);
      await tx.query(file);
    });
    expect(await definition()).toBe(before);
    for (const [trigger, table] of FROZEN_TRIGGERS) {
      const rows = await triggersOf(table);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tgname).toBe(trigger);
      // owned 夹具建在独立 schema 里，定义中的 schema 名不写死。
      expect(rows[0]?.definition).toMatch(
        new RegExp(
          `^CREATE TRIGGER ${trigger} BEFORE INSERT OR DELETE OR UPDATE ON \\S+\\.${table} FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child\\(\\)$`,
          'u',
        ),
      );
    }
    expect(await insertLine(identifier(bomPublished))).toMatchObject({
      code: 'P0001',
      message: INSERT_MESSAGE,
    });
  });
});
