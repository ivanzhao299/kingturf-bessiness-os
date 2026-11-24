import { randomUUID } from 'node:crypto';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.js';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// MFG-5：车间执行写路径的真库契约（TD-TEST-022：仓储替身执行不到 SQL，触发器与前置校验只有
// 在真库上才真正运行）。夹具经既有写路径建立成品 / 组件 / BOM / 工艺与一张进行中的工单。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
type MaterialInput = Parameters<PostgresProductionRepository['transactMaterial']>[1];
type Grant = Readonly<{ scopes: readonly string[]; fields: readonly string[] | null }>;
const BOM_CONFLICT = '该批次物料不属于工单 BOM';

describe('MFG-5 shop floor writes against real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresProductionRepository;
  let finished: JsonObject, yarn: JsonObject, backing: JsonObject, outsider: JsonObject;
  let routing: JsonObject;
  let location: string,
    yarnLot: string,
    backingLot: string,
    outsiderLot: string,
    finishedLot: string;
  let order: JsonObject;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const context = () => state().context;
  // 同一次请求关联下落库的行：库存移动 / 审计事件 / 领域事件 outbox。
  const written = async (correlation: string): Promise<unknown> =>
    (
      await state().db.query<{ movements: number; audit: number; outbox: number }>(
        'SELECT (SELECT count(*)::int FROM inventory_movements WHERE correlation_id=$1) movements,(SELECT count(*)::int FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::int FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  const reload = async (): Promise<JsonObject> => {
    const found = (await repository.list(context())).find((item) => item.id === order.id);
    if (!found) throw new Error('Production order missing after write');
    return found;
  };
  const material = (
    transactionType: 'ISSUE' | 'RETURN',
    itemVersionId: string,
    lotId: string,
    quantity: string,
    key: string = randomUUID(),
  ): MaterialInput => ({
    transactionType,
    itemVersionId,
    lotId,
    locationId: location,
    quantity,
    reason: 'MFG-5 real database contract',
    occurredAt: '2026-11-24T08:00:00Z',
    idempotencyKey: key,
  });
  const authorize = (...capabilities: readonly PermissionKey[]) =>
    ({
      actor: context().actor,
      permissions: new Map<PermissionKey, Grant>(
        capabilities.map((capability) => [capability, { scopes: ['COMPANY'], fields: null }]),
      ),
    }) as unknown as AuthorizationContext;
  // 夹具在 beforeAll 里才建立：授权上下文按需构造，不在 describe 作用域求值。
  const allAccess = () =>
    authorize(
      'production:read',
      'production:plan',
      'production:report',
      'production:material',
      'production:close',
      'bom:read',
    );
  const send = async (
    request: ApiRequest,
    authorization = allAccess(),
    correlationId = randomUUID(),
  ): Promise<{ statusCode: number; body: JsonObject }> => {
    const response = await dispatchFastifyRouteGroup(request, {
      authorization,
      dependencies: { production: repository, commercial: {} } as unknown as ApiDependencies,
      correlationId,
    });
    if (!response) throw new Error('Execution write not claimed by the bridge');
    return { statusCode: response.statusCode, body: response.body as JsonObject };
  };
  const materialsPath = () => `/api/v1/production-orders/${identifier(order)}/materials`;
  const seedLot = async (
    itemVersionId: string,
    lotNumber: string,
    qualityStatus: string,
    quantity: number,
  ): Promise<string> => {
    const lot = randomUUID();
    const { db, company } = state();
    await db.query(
      'INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,$5)',
      [lot, company, lotNumber, itemVersionId, qualityStatus],
    );
    await db.query(
      "INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,$5,now(),'TEST',$6,repeat('a',64),$7,$8)",
      [
        company,
        itemVersionId,
        lot,
        location,
        quantity,
        randomUUID(),
        context().actor.employeeId,
        randomUUID(),
      ],
    );
    return lot;
  };

  beforeAll(async () => {
    fixture = await ownedPostgres('production_exec_pg');
    const { db } = state();
    repository = new PostgresProductionRepository(db);
    const manufacturing = new PostgresManufacturingRepository(db);
    const item = (sku: string, name: string, itemType: string, baseUnitCode: string) =>
      manufacturing.createItem(
        {
          sku,
          name,
          itemType,
          baseUnitCode,
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        context(),
        randomUUID(),
      );
    finished = await item('FG-MFG5-50', '50mm 景观草', 'FINISHED_GOOD', 'M2');
    yarn = await item('RM-MFG5-YARN', '草纱', 'RAW_MATERIAL', 'KG');
    backing = await item('RM-MFG5-BACKING', 'PP 复合底布', 'RAW_MATERIAL', 'M2');
    // 不在任何 BOM 行里的原材料：领料时必须被拒（TD-MFG-010 的「选错批次」）。
    outsider = await item('RM-MFG5-OUTSIDER', '非 BOM 物料', 'RAW_MATERIAL', 'KG');
    await manufacturing.createBom(
      {
        code: 'BOM-MFG5-50',
        name: '50mm 景观草 BOM',
        productItemId: identifier(finished, 'itemId'),
        productItemVersionId: identifier(finished),
        outputQuantity: '1000',
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        lines: [
          {
            componentItemVersionId: identifier(yarn),
            quantity: '1250',
            scrapBasisPoints: 300,
            substitutes: [],
          },
          {
            componentItemVersionId: identifier(backing),
            quantity: '1000',
            scrapBasisPoints: 100,
            substitutes: [],
          },
        ],
      },
      context(),
      randomUUID(),
    );
    routing = await manufacturing.createRouting(
      {
        code: 'RT-MFG5-50',
        name: '50mm 景观草标准工艺',
        productItemId: identifier(finished, 'itemId'),
        productItemVersionId: identifier(finished),
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
          {
            operationCode: 'COAT',
            name: '背胶',
            workCenterCode: 'WC-COAT-01',
            sequence: 20,
            setupMinutes: '45',
            runMinutesPerUnit: '0.5',
            instructions: {},
          },
        ],
      },
      context(),
      randomUUID(),
    );
    location = randomUUID();
    await state().db.query(
      "INSERT INTO inventory_locations(id,tenant_id,code,name,location_type) VALUES($1,$2,'MFG5-FG-01','成品库一','PRODUCTION')",
      [location, state().company],
    );
    yarnLot = await seedLot(identifier(yarn), 'LOT-MFG5-YARN-1', 'RELEASED', 5000);
    backingLot = await seedLot(identifier(backing), 'LOT-MFG5-BACKING-1', 'RELEASED', 5000);
    outsiderLot = await seedLot(identifier(outsider), 'LOT-MFG5-OUTSIDER-1', 'RELEASED', 5000);
    // 成品自身的批次（待检）：主协调复现 TD-MFG-010 时选到的就是这一类。
    finishedLot = await seedLot(identifier(finished), 'LOT-MFG5-FG-1', 'QUARANTINE', 800);
    const created = await repository.create(
      {
        orderNumber: 'WO-MFG5-1',
        itemVersionId: identifier(finished),
        routingVersionId: identifier(routing),
        plannedQuantity: '1000',
        plannedStartAt: '2026-08-13',
        plannedDueAt: '2026-08-20',
        sourceReference: 'MFG5-REAL-PG-1',
      },
      context(),
      randomUUID(),
    );
    for (const target of ['RELEASED', 'IN_PROGRESS'] as const)
      await repository.transition(
        identifier(created),
        target,
        {
          reason: `MFG-5 fixture ${target}`,
          evidence: {},
          idempotencyKey: `WO-MFG5-1-${target}`,
        },
        context(),
        randomUUID(),
      );
    order = (await repository.list(context())).find((row) => row.id === created.id) ?? {};
  }, 60_000);
  afterAll(async () => {
    await fixture?.close();
  });

  describe('TD-MFG-010: issuing a batch outside the order BOM', () => {
    it('refuses a non-component batch with a business conflict before anything is written (non-BOM raw material and the finished good itself)', async () => {
      const before = await reload();
      for (const [label, itemVersionId, lotId] of [
        ['非 BOM 原材料', identifier(outsider), outsiderLot],
        ['工单成品自身的批次', identifier(finished), finishedLot],
      ] as const) {
        const correlation = randomUUID();
        const attempt = repository.transactMaterial(
          identifier(order),
          material('ISSUE', itemVersionId, lotId, '10'),
          context(),
          correlation,
        );
        await expect(attempt, label).rejects.toBeInstanceOf(DomainError);
        await expect(attempt, label).rejects.toMatchObject({
          code: 'conflict',
          message: BOM_CONFLICT,
        });
        expect(await written(correlation), label).toEqual({ movements: 0, audit: 0, outbox: 0 });
      }
      expect(await reload()).toEqual(before);
    });

    it('answers 409 with the trigger-independent message on the bridge track and on the legacy route', async () => {
      const body = material(
        'ISSUE',
        identifier(outsider),
        outsiderLot,
        '10',
        'WO-MFG5-OUTSIDER-ISSUE',
      );
      const request: ApiRequest = { method: 'POST', pathname: materialsPath(), body };
      const bridge = await send(request, allAccess(), '33333333-3333-4333-8333-333333333333');
      expect(bridge.statusCode).toBe(409);
      expect(bridge.body).toEqual({
        error: {
          code: 'conflict',
          message: BOM_CONFLICT,
          correlationId: '33333333-3333-4333-8333-333333333333',
        },
      });
      // 旧轨（不装 commercial → 不经过桥）：仓储层的业务错误由 app.dispatch 映射成同一个 409。
      const legacy = buildApp({
        auth: {
          authenticate: () => Promise.resolve(allAccess()),
        } as unknown as ApiDependencies['auth'],
        organizations: {} as ApiDependencies['organizations'],
        employees: {} as ApiDependencies['employees'],
        production: repository,
      });
      const response = await legacy.dispatch({
        ...request,
        headers: { authorization: 'Bearer fixture' },
      });
      expect(response.statusCode).toBe(409);
      expect((response.body as JsonObject).error).toMatchObject({
        code: 'conflict',
        message: BOM_CONFLICT,
      });
      expect(await written('33333333-3333-4333-8333-333333333333')).toEqual({
        movements: 0,
        audit: 0,
        outbox: 0,
      });
    });

    it.each([
      ['草纱', 'yarn', 'yarnLot', '12.5', 'WO-MFG5-YARN-ISSUE'],
      ['PP 复合底布（BOM 的第二个组件）', 'backing', 'backingLot', '9.75', 'WO-MFG5-BACKING-ISSUE'],
    ] as const)(
      'still issues a batch of a BOM component normally (201) and posts it to the ledger: %s',
      async (_label, item, lot, quantity, key) => {
        const before = (await reload()).materials as JsonObject[];
        const response = await send({
          method: 'POST',
          pathname: materialsPath(),
          body: material(
            'ISSUE',
            identifier({ yarn, backing }[item]),
            { yarnLot, backingLot }[lot],
            quantity,
            key,
          ),
        });
        expect(response.statusCode).toBe(201);
        expect(response.body).toMatchObject({
          productionOrderId: identifier(order),
          transactionType: 'ISSUE',
          itemVersionId: identifier({ yarn, backing }[item]),
          lotId: { yarnLot, backingLot }[lot],
          locationId: location,
          quantity,
          idempotencyKey: key,
        });
        expect(typeof response.body.inventoryMovementId).toBe('string');
        // 台账按 occurred_at 排序，两次领料的发生时间相同，先后不确定——按 id 找出新增的那一条。
        const after = (await reload()).materials as JsonObject[];
        expect(after).toHaveLength(before.length + 1);
        const known = new Set(before.map((entry) => identifier(entry)));
        const added = after.filter((entry) => !known.has(identifier(entry)));
        expect(added).toHaveLength(1);
        expect(added[0]).toMatchObject({
          transaction_type: 'ISSUE',
          item_version_id: identifier({ yarn, backing }[item]),
          lot_id: { yarnLot, backingLot }[lot],
          quantity: Number(quantity),
        });
      },
    );

    it('keeps the database trigger as the authority wherever the up-front check stays silent', async () => {
      // 退料：触发器按累计领用量把关（非 BOM 物料从未领出，退料被拒），前置校验不介入。
      await expect(
        repository.transactMaterial(
          identifier(order),
          material('RETURN', identifier(outsider), outsiderLot, '1'),
          context(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({
        code: 'P0001',
        // 仓储层直接抛出数据库的原始拒绝；中文提示只在 HTTP 端点这一层映射。
        message: 'production return exceeds cumulative issue for material resource',
      });
      // 工单不存在：维持原有路径（库存移动先写入，再由触发器拒绝，事务整体回滚）。
      const correlation = randomUUID();
      await expect(
        repository.transactMaterial(
          randomUUID(),
          material('ISSUE', identifier(yarn), yarnLot, '1'),
          context(),
          correlation,
        ),
      ).rejects.toMatchObject({ code: 'P0001' });
      expect(await written(correlation)).toEqual({ movements: 0, audit: 0, outbox: 0 });
      // 草稿工单 + 选错批次：触发器先查工单状态，主因提示仍由触发器给出，前置校验不抢答。
      const draft = await repository.create(
        {
          orderNumber: 'WO-MFG5-DRAFT',
          itemVersionId: identifier(finished),
          routingVersionId: identifier(routing),
          plannedQuantity: '10',
          plannedStartAt: '2026-09-01',
          plannedDueAt: '2026-09-08',
          sourceReference: 'MFG5-REAL-PG-DRAFT',
        },
        context(),
        randomUUID(),
      );
      const draftAttempt = repository.transactMaterial(
        identifier(draft),
        material('ISSUE', identifier(outsider), outsiderLot, '1'),
        context(),
        randomUUID(),
      );
      await expect(draftAttempt).rejects.not.toMatchObject({ message: BOM_CONFLICT });
      await expect(draftAttempt).rejects.toMatchObject({
        code: 'P0001',
        message: 'material posting requires a released or active order',
      });
      // 跨租户：不做 BOM 判断，也不会拿到这条业务提示。
      const foreign = await repository
        .transactMaterial(
          identifier(order),
          material('ISSUE', identifier(outsider), outsiderLot, '1'),
          state().otherContext,
          randomUUID(),
        )
        .catch((error: unknown) => error);
      expect(foreign).toBeInstanceOf(Error);
      expect((foreign as Error).message).not.toBe(BOM_CONFLICT);
    });

    it('keeps the company scope guard ahead of the BOM check', async () => {
      await expect(
        repository.transactMaterial(
          identifier(order),
          material('ISSUE', identifier(outsider), outsiderLot, '1'),
          { ...context(), scopes: ['TEAM'] },
          randomUUID(),
        ),
      ).rejects.toThrow('Production execution requires company scope');
    });
  });

  // TD-MFG-010：三个执行端点把数据库触发器的业务拒绝（RAISE EXCEPTION → P0001）映射为
  // 409 + 触发器提示文字。这里用真实库让真实触发器拒绝：领料一侧已在上文覆盖（409 / 201 /
  // 触发器仍权威），本组补报工与成品卷入库——合法提交 201、超计划报工与超报工良品入库
  // 得到带触发器文字的 409，且被拒绝的关联 ID 下什么都没写入。
  describe('trigger rejections surfaced as business conflicts on the bridge', () => {
    const reportsPath = () => `/api/v1/production-orders/${identifier(order)}/operation-reports`;
    const rollsPath = () => `/api/v1/production-orders/${identifier(order)}/finished-rolls`;
    const operation = (sequence: number): string => {
      const found = (order.operations as JsonObject[]).find((item) => item.sequence === sequence);
      if (!found) throw new Error(`Operation ${String(sequence)} missing`);
      return identifier(found);
    };
    const reportBody = (sequence: number, good: string, key: string): JsonObject => ({
      operationId: operation(sequence),
      goodQuantity: good,
      scrapQuantity: '0',
      laborMinutes: '12.5',
      machineMinutes: '20',
      startedAt: '2026-11-24T01:00:00Z',
      completedAt: '2026-11-24T02:30:00Z',
      notes: 'MFG-5 trigger mapping',
      idempotencyKey: key,
    });

    it('legal report returns 201 and the rejected over-plan report returns 409 with a Chinese hint', async () => {
      const correlation = randomUUID();
      const legal = await send(
        { method: 'POST', pathname: reportsPath(), body: reportBody(10, '10.25', 'WO-MFG5-RPT-1') },
        undefined,
        correlation,
      );
      expect(legal.statusCode).toBe(201);
      expect(legal.body).toMatchObject({
        productionOrderId: identifier(order),
        operationId: operation(10),
        goodQuantity: '10.25',
        laborMinutes: '12.5',
        idempotencyKey: 'WO-MFG5-RPT-1',
      });
      expect(await written(correlation)).toEqual({ movements: 0, audit: 1, outbox: 1 });
      // 工单计划 1000：再报 1000 使累计 1010.25 超过计划——触发器拒绝。
      const rejected = await send(
        { method: 'POST', pathname: reportsPath(), body: reportBody(10, '1000', 'WO-MFG5-RPT-2') },
        undefined,
        correlation,
      );
      expect(rejected.statusCode).toBe(409);
      expect(rejected.body).toEqual({
        error: {
          code: 'conflict',
          message: '累计良品数量超过工单的计划数量，请核对本次报工的良品数',
          correlationId: correlation,
        },
      });
      // 被拒绝的这一笔什么都没写入（成功那一笔的 audit/outbox 各一条已在上面断言）。
      expect(await written(correlation)).toEqual({ movements: 0, audit: 1, outbox: 1 });
      // 工序累计良品仍是 10.25（直接查台账，不经过被测的聚合代码）。
      const reported = await state().db.query<{ good: string }>(
        'SELECT coalesce(sum(good_quantity),0)::text good FROM production_operation_reports WHERE tenant_id=$1 AND production_order_operation_id=$2',
        [state().company, operation(10)],
      );
      // numeric(24,6) 定标返回 10.250000。
      expect(reported.rows[0]?.good).toBe('10.250000');
    });

    it('legal finished roll returns 201; a roll beyond the reported good returns 409 with a Chinese hint', async () => {
      const report = await send({
        method: 'POST',
        pathname: reportsPath(),
        body: reportBody(20, '8', 'WO-MFG5-RPT-3'),
      });
      expect(report.statusCode).toBe(201);
      const reportId = identifier(report.body);
      const correlation = randomUUID();
      const rollsBefore = (await reload()).rolls as JsonObject[];
      const legal = await send(
        {
          method: 'POST',
          pathname: rollsPath(),
          body: {
            operationReportId: reportId,
            itemVersionId: identifier(finished),
            rollNumber: 'ROLL-MFG5-A',
            lotNumber: 'LOT-MFG5-ROLL-A',
            locationId: location,
            quantity: '8',
            manufacturedAt: '2026-11-24',
          },
        },
        undefined,
        correlation,
      );
      expect(legal.statusCode).toBe(201);
      expect(legal.body).toMatchObject({
        productionOrderId: identifier(order),
        operationReportId: reportId,
        rollNumber: 'ROLL-MFG5-A',
        lotNumber: 'LOT-MFG5-ROLL-A',
        quantity: '8',
        qualityStatus: 'QUARANTINE',
      });
      expect(typeof legal.body.lotId).toBe('string');
      expect(typeof legal.body.inventoryMovementId).toBe('string');
      const rollsAfter = (await reload()).rolls as JsonObject[];
      expect(rollsAfter).toHaveLength(rollsBefore.length + 1);
      // 该报工良品 8、已入卷 8：再入 0.5 即超——触发器拒绝。
      const rejected = await send(
        {
          method: 'POST',
          pathname: rollsPath(),
          body: {
            operationReportId: reportId,
            itemVersionId: identifier(finished),
            rollNumber: 'ROLL-MFG5-B',
            lotNumber: 'LOT-MFG5-ROLL-B',
            locationId: location,
            quantity: '0.5',
            manufacturedAt: '2026-11-24',
          },
        },
        undefined,
        correlation,
      );
      expect(rejected.statusCode).toBe(409);
      expect(rejected.body).toEqual({
        error: {
          code: 'conflict',
          message: '成品卷与工单、报工或批次不匹配，请核对后重试',
          correlationId: correlation,
        },
      });
      expect((await reload()).rolls as JsonObject[]).toHaveLength(rollsBefore.length + 1);
    });

    it('status-gated trigger refusals surface with a Chinese hint (report on a draft order)', async () => {
      const draft = await repository.create(
        {
          orderNumber: 'WO-MFG5-DRAFT-2',
          itemVersionId: identifier(finished),
          routingVersionId: identifier(routing),
          plannedQuantity: '10',
          plannedStartAt: '2026-09-01',
          plannedDueAt: '2026-09-08',
          sourceReference: 'MFG5-REAL-PG-DRAFT-2',
        },
        context(),
        randomUUID(),
      );
      const draftOperation = (
        (await repository.list(context())).find((row) => row.id === draft.id)
          ?.operations as JsonObject[]
      )[0];
      const response = await send({
        method: 'POST',
        pathname: `/api/v1/production-orders/${identifier(draft)}/operation-reports`,
        body: {
          operationId: identifier(draftOperation ?? {}),
          goodQuantity: '1',
          scrapQuantity: '0',
          laborMinutes: '1',
          machineMinutes: '1',
          startedAt: '2026-11-24T01:00:00Z',
          completedAt: '2026-11-24T01:30:00Z',
          notes: 'draft gate',
          idempotencyKey: 'WO-MFG5-DRAFT-2-RPT-1',
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({
        error: {
          code: 'conflict',
          message: '工单尚未开工，不能报工',
          correlationId: expect.any(String) as string,
        },
      });
    });
  });
});
