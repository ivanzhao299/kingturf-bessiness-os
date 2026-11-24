import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationsDirectory } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// TD-WF-003（WF-A）：「关闭询价」在真库上的回归。closeRfq 对已签发询价单的 UPDATE 自
// PROC-2 起一直被迁移 0038 的守卫 guard_rfq_update 拒绝（接口 500），这条写路径此前没有
// 任何真库测试。迁移 0076 只重定义这个触发器函数：已签发的询价单允许「仅状态」迁移到
// CANCELLED（主协调裁定：关闭即终止这张询价，不新增枚举值），内容仍不可变；草稿的规则、
// 行项冻结规则（protect_issued_rfq_line）不变。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const migrationSql = (name: string) => readFile(join(migrationsDirectory, name), 'utf8');
// 迁移 0038 里 guard_rfq_update 的原始定义（放宽之前的守卫），用来证明旧守卫确实拒绝关闭。
const legacyGuard = async () => {
  const sql = await migrationSql('0038_procurement_inventory_integrity.sql');
  const statement = /CREATE (?:OR REPLACE )?FUNCTION guard_rfq_update\(\)[\s\S]*?END \$\$;/u.exec(
    sql,
  )?.[0];
  if (!statement) throw new Error('0038 guard_rfq_update definition not found');
  return statement.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
};
const guard0076 = () => migrationSql('0076_rfq_close_transition.sql');

describe('TD-WF-003 RFQ close against the real guard trigger', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresProcurementRepository;
  let material: JsonObject, draft: JsonObject, issued: JsonObject;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const rowOf = async (id: string) => {
    const row = (
      await state().db.query<{ status: string; issued_at: Date | null; response_due_at: Date }>(
        'SELECT status,issued_at,response_due_at FROM procurement_rfqs WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!row) throw new Error('RFQ row missing');
    return row;
  };
  const closedEvidence = async (correlation: string) =>
    (
      await state().db.query(
        'SELECT a.action,a.target_id,a.metadata,o.event_type,o.aggregate_id,o.payload FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id AND o.aggregate_id=a.target_id WHERE a.correlation_id=$1',
        [correlation],
      )
    ).rows;
  const rfqInput = (rfqNumber: string, itemVersionId: string, issue: boolean) => ({
    rfqNumber,
    responseDueAt: '2026-01-10T00:00:00Z',
    currency: 'CNY',
    issue,
    lines: [{ itemVersionId, quantity: '10', requiredAt: '2026-02-01' }],
  });

  beforeEach(async () => {
    fixture = await ownedPostgres('rfq_close_pg');
    repository = new PostgresProcurementRepository(fixture.db);
    material = await new PostgresManufacturingRepository(fixture.db).createItem(
      {
        sku: 'RAW-1',
        name: 'RAW-1',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      fixture.context,
      randomUUID(),
    );
    draft = await repository.createRfq(
      rfqInput('RFQ-DRAFT', identifier(material), false),
      fixture.context,
      randomUUID(),
    );
    issued = await repository.createRfq(
      rfqInput('RFQ-ISSUED', identifier(material), true),
      fixture.context,
      randomUUID(),
    );
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('closes a draft and an issued RFQ as CANCELLED; issued_at and content stay; the rfq.closed evidence carries the status', async () => {
    const { context } = state();
    const issuedBefore = await rowOf(identifier(issued));
    expect(issuedBefore.status).toBe('ISSUED');
    expect(issuedBefore.issued_at).not.toBeNull();
    const issuedCorrelation = randomUUID();
    const closedIssued = await repository.closeRfq(identifier(issued), context, issuedCorrelation);
    expect(closedIssued).toEqual({ id: identifier(issued), status: 'CANCELLED' });
    const issuedAfter = await rowOf(identifier(issued));
    expect(issuedAfter.status).toBe('CANCELLED');
    // 「已签发 → 已取消」只改 status：issued_at 不要求变化，必须保持原值。
    expect(issuedAfter.issued_at).toEqual(issuedBefore.issued_at);
    expect(issuedAfter.response_due_at).toEqual(issuedBefore.response_due_at);

    const draftCorrelation = randomUUID();
    const closedDraft = await repository.closeRfq(identifier(draft), context, draftCorrelation);
    expect(closedDraft).toEqual({ id: identifier(draft), status: 'CANCELLED' });
    expect((await rowOf(identifier(draft))).status).toBe('CANCELLED');

    for (const [id, correlation] of [
      [identifier(issued), issuedCorrelation],
      [identifier(draft), draftCorrelation],
    ] as const) {
      expect(await closedEvidence(correlation)).toEqual([
        {
          action: 'rfq.closed',
          target_id: id,
          metadata: { id, status: 'CANCELLED' },
          event_type: 'rfq.closed',
          aggregate_id: id,
          payload: { id, status: 'CANCELLED' },
        },
      ]);
    }
  });

  it('is really the 0038 guard that rejected closing an issued RFQ: the old function fails, 0076 lifts exactly that', async () => {
    const { db, context } = state();
    await db.query(await legacyGuard());
    const correlation = randomUUID();
    await expect(
      repository.closeRfq(identifier(issued), context, correlation),
    ).rejects.toMatchObject({ code: 'P0001', message: 'issued RFQ is immutable' });
    expect((await rowOf(identifier(issued))).status).toBe('ISSUED');
    expect(await closedEvidence(correlation)).toEqual([]);
    await db.query(await guard0076());
    expect(await repository.closeRfq(identifier(issued), context, correlation)).toEqual({
      id: identifier(issued),
      status: 'CANCELLED',
    });
  });

  it('keeps issued RFQ content immutable: every column except status, issued_at included', async () => {
    const { db } = state();
    const id = identifier(issued);
    for (const [sql, message] of [
      [
        "UPDATE procurement_rfqs SET response_due_at=response_due_at+interval '1 day' WHERE id=$1",
        'issued RFQ content is immutable',
      ],
      [
        "UPDATE procurement_rfqs SET status='CANCELLED',issued_at=issued_at+interval '1 second' WHERE id=$1",
        'issued RFQ content is immutable',
      ],
      [
        "UPDATE procurement_rfqs SET rfq_number=rfq_number||'-X' WHERE id=$1",
        'issued RFQ content is immutable',
      ],
      ["UPDATE procurement_rfqs SET currency='USD' WHERE id=$1", 'issued RFQ content is immutable'],
      [
        "UPDATE procurement_rfqs SET status='DRAFT' WHERE id=$1",
        'issued RFQ can only be cancelled',
      ],
      // 什么都没改的空更新同样被拒（已签发的单子不允许无意义地重写）。
      [
        "UPDATE procurement_rfqs SET status='ISSUED' WHERE id=$1",
        'issued RFQ can only be cancelled',
      ],
    ] as const) {
      await expect(db.query(sql, [id])).rejects.toMatchObject({ code: 'P0001', message });
      expect((await rowOf(id)).status).toBe('ISSUED');
    }
  });

  it('keeps a cancelled RFQ immutable and out of reach of close/issue', async () => {
    const { db, context } = state();
    const id = identifier(issued);
    await repository.closeRfq(id, context, randomUUID());
    for (const sql of [
      "UPDATE procurement_rfqs SET status='ISSUED' WHERE id=$1",
      "UPDATE procurement_rfqs SET status='DRAFT' WHERE id=$1",
      "UPDATE procurement_rfqs SET response_due_at=response_due_at+interval '1 day' WHERE id=$1",
    ])
      await expect(db.query(sql, [id])).rejects.toMatchObject({
        code: 'P0001',
        message: 'cancelled RFQ is immutable',
      });
    const correlation = randomUUID();
    await expect(repository.closeRfq(id, context, correlation)).rejects.toMatchObject({
      code: 'not_found',
      message: 'Open RFQ not found',
    });
    await expect(repository.issueRfq(id, context, correlation)).rejects.toMatchObject({
      code: 'not_found',
      message: 'Draft rfq not found',
    });
    expect(await closedEvidence(correlation)).toEqual([]);
    expect((await rowOf(id)).status).toBe('CANCELLED');
  });

  it('keeps the lines of a non-draft RFQ frozen (protect_issued_rfq_line unchanged); draft lines stay editable', async () => {
    const { db, context } = state();
    for (const id of [identifier(issued)]) {
      for (const sql of [
        'UPDATE procurement_rfq_lines SET quantity=quantity+1 WHERE rfq_id=$1',
        'DELETE FROM procurement_rfq_lines WHERE rfq_id=$1',
      ])
        await expect(db.query(sql, [id])).rejects.toMatchObject({
          code: 'P0001',
          message: 'issued RFQ lines are immutable',
        });
    }
    await repository.closeRfq(identifier(issued), context, randomUUID());
    await expect(
      db.query('UPDATE procurement_rfq_lines SET quantity=quantity+1 WHERE rfq_id=$1', [
        identifier(issued),
      ]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'issued RFQ lines are immutable' });
    await db.query('UPDATE procurement_rfq_lines SET quantity=quantity+1 WHERE rfq_id=$1', [
      identifier(draft),
    ]);
    expect(
      (
        await db.query<{ quantity: string }>(
          'SELECT quantity FROM procurement_rfq_lines WHERE rfq_id=$1',
          [identifier(draft)],
        )
      ).rows,
    ).toEqual([{ quantity: '11.000000' }]);
  });

  it('leaves every draft rule as it was in 0038, and issuing still works', async () => {
    const { db, context } = state();
    const id = identifier(draft);
    for (const [sql, message] of [
      // 目标状态非法与内容被改，按 0038 的顺序先报状态、再报内容。
      [
        "UPDATE procurement_rfqs SET status='PARTIALLY_RECEIVED' WHERE id=$1",
        'draft RFQ can only be issued or cancelled',
      ],
      [
        "UPDATE procurement_rfqs SET response_due_at=response_due_at+interval '1 day' WHERE id=$1",
        'draft RFQ can only be issued or cancelled',
      ],
      [
        "UPDATE procurement_rfqs SET status='ISSUED',issued_at=now(),response_due_at=response_due_at+interval '1 day' WHERE id=$1",
        'RFQ issue cannot alter content',
      ],
      [
        "UPDATE procurement_rfqs SET status='CANCELLED',rfq_number=rfq_number||'-X' WHERE id=$1",
        'RFQ issue cannot alter content',
      ],
    ] as const) {
      await expect(db.query(sql, [id])).rejects.toMatchObject({ code: 'P0001', message });
      expect((await rowOf(id)).status).toBe('DRAFT');
    }
    expect(await repository.issueRfq(id, context, randomUUID())).toEqual({ id, status: 'ISSUED' });
    expect((await rowOf(id)).issued_at).not.toBeNull();
    await expect(
      repository.createRfq(
        { ...rfqInput('RFQ-EMPTY', identifier(material), true), lines: [] },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'RFQ issue requires timestamp and lines',
    });
  });

  it('re-applying 0076 twice inside one transaction is a no-op, and no type or trigger is touched', async () => {
    const { db, context } = state();
    const file = await guard0076();
    // 静态断言只看语句本身：注释里会出现对这些关键字的说明文字。
    const statements = file
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .trimStart();
    expect(statements).not.toMatch(
      /ALTER\s+TYPE|ADD\s+VALUE|CREATE\s+TYPE|DROP\s|ALTER\s+TABLE|UPDATE\s|DELETE\s/iu,
    );
    expect(statements).toMatch(/^CREATE OR REPLACE FUNCTION guard_rfq_update\(\)/u);
    const definition = async () =>
      (
        await db.query<{ definition: string }>(
          'SELECT pg_get_functiondef($1::regproc) definition',
          ['guard_rfq_update'],
        )
      ).rows[0]?.definition;
    const before = await definition();
    // 整个迁移文件原样执行两遍，同一个事务（迁移运行器就是每文件一个事务）。
    await db.transaction(async (tx) => {
      await tx.query(file);
      await tx.query(file);
    });
    expect(await definition()).toBe(before);
    // 枚举类型没被改动：仍是 0037 定义的五个值（pg 不解析枚举数组，转成 text[] 再比）。
    expect(
      (
        await db.query<{ range: string[] }>(
          'SELECT ARRAY(SELECT unnest(enum_range(NULL::procurement_document_status))::text) range',
        )
      ).rows,
    ).toEqual([{ range: ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] }]);
    expect(
      (
        await db.query<{ tgname: string }>(
          "SELECT tgname FROM pg_trigger WHERE tgrelid='procurement_rfqs'::regclass AND NOT tgisinternal ORDER BY tgname",
        )
      ).rows.map((row) => row.tgname),
    ).toEqual(['procurement_rfq_update_guard']);
    expect(await repository.closeRfq(identifier(issued), context, randomUUID())).toEqual({
      id: identifier(issued),
      status: 'CANCELLED',
    });
  });

  it('stays tenant-bounded: another company cannot close the RFQ', async () => {
    await expect(
      repository.closeRfq(identifier(issued), state().otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Open RFQ not found' });
    expect((await rowOf(identifier(issued))).status).toBe('ISSUED');
  });
});
