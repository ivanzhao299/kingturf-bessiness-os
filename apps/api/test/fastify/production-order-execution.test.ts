import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../../src/app.js';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-MFG-5：工单车间执行写端点（Fastify 桥轨）契约测试——载荷对拍（trim / UUID 归一小写 /
// decimal 去尾零 / 时间归一 UTC / stableCode）、负例消息与 legacy 路由逐字一致、鉴权与字段
// 授权实参透传、写响应按 production:read 字段裁剪、幂等键只取请求体且每次都转发仓储、依赖
// 缺失 503、未认领方法落回 null。守恒组把同一请求分别经 legacy app.dispatch（不装 commercial
// 依赖即不经过桥轨，与旧轨契约测试同一手法）与桥轨各跑一遍，断言状态码、响应体与仓储实参
// 逐字节一致——负例的状态码与消息也取自真实旧轨，而不是在测试里复刻它的映射。
const tenant = '11111111-1111-4111-8111-111111111111';
const orderId = '44444444-4444-4444-8444-444444444444';
const operationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: tenant, employeeId: 'e-1' };
const anchors = [{ scope: 'TEAM', organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }];
const writeScopes: readonly DataScope[] = ['TEAM'];
const scopeContext = { actor, scopes: writeScopes, anchors };
const WRITE_CAPABILITIES = [
  'production:report',
  'production:material',
  'production:plan',
  'production:close',
] as const;
type Repository = NonNullable<ApiDependencies['production']>;
type Grant = Readonly<{ scopes: readonly DataScope[]; fields: readonly string[] | null }>;
type ScopeOptions = Readonly<{
  readFields?: readonly string[] | null;
  writeFields?: readonly string[] | null;
  without?: readonly PermissionKey[];
}>;
type ErrorEnvelope = Readonly<{ code: string; message: string; correlationId: string }>;
type Tracked = Readonly<{ statusCode: number; body: unknown }>;

// 仓储替身只带被测端点用到的方法；其余成员不参与（生产装配恒为完整的 Postgres 仓储）。
const productionOf = (methods: object): Repository => methods as unknown as Repository;
const dependencyScope = (production: Repository | null): ApiDependencies =>
  ({ production, commercial: {} }) as unknown as ApiDependencies;
const scopeFor = (
  production: Repository | null = null,
  options: ScopeOptions = {},
): Readonly<{
  authorization: AuthorizationContext;
  dependencies: ApiDependencies;
  correlationId: string;
}> => {
  const permissions = new Map<PermissionKey, Grant>();
  for (const capability of WRITE_CAPABILITIES)
    if (!options.without?.includes(capability))
      permissions.set(capability, { scopes: writeScopes, fields: options.writeFields ?? null });
  if (!options.without?.includes('production:read'))
    permissions.set('production:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  return {
    authorization: {
      actor,
      permissions,
      scopeAnchors: new Map(WRITE_CAPABILITIES.map((capability) => [capability, anchors])),
    } as unknown as AuthorizationContext,
    // commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
    dependencies: dependencyScope(production),
    correlationId,
  };
};
const requestFor = (overrides: Partial<ApiRequest> = {}): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/production-orders',
  headers: { 'x-correlation-id': correlationId },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null | undefined): ErrorEnvelope => {
  const error = (response?.body as { error?: ErrorEnvelope } | undefined)?.error;
  if (!error) throw new Error(`expected an error envelope, got ${JSON.stringify(response?.body)}`);
  return error;
};
// legacy 轨：经 buildApp.dispatch（认证桩 + 不装 commercial → 桥轨不介入），拿到旧路由
// 真实的响应信封（含 DomainError → 状态码的映射）。
const legacyDispatch = async (
  request: ApiRequest,
  authorization: AuthorizationContext,
  production: Repository,
): Promise<Tracked> => {
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(authorization),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    production,
  });
  const response = await app.dispatch({
    ...request,
    headers: { authorization: 'Bearer fixture', 'x-correlation-id': correlationId },
  });
  return { statusCode: response.statusCode, body: response.body };
};
const bridged = async (
  request: ApiRequest,
  scope: ReturnType<typeof scopeFor>,
): Promise<Tracked | null> => {
  const response = await dispatchFastifyRouteGroup(request, scope);
  return response ? { statusCode: response.statusCode, body: response.body } : null;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('production order execution fastify bridge track: operation reports', () => {
  const path = `/api/v1/production-orders/${orderId}/operation-reports`;
  const body = {
    operationId: ` ${operationId.toUpperCase()} `,
    goodQuantity: ' 10.250000 ',
    scrapQuantity: '0',
    laborMinutes: '12.5',
    machineMinutes: '20',
    startedAt: '2026-11-24T01:00:00+08:00',
    completedAt: '2026-11-24T02:30:00+08:00',
    notes: ' 班组记录 ',
    idempotencyKey: ' WO-KT-2026-001-RPT-20261124090000-A1B2 ',
  };
  const input = {
    operationId,
    goodQuantity: '10.25',
    scrapQuantity: '0',
    laborMinutes: '12.5',
    machineMinutes: '20',
    startedAt: '2026-11-23T17:00:00.000Z',
    completedAt: '2026-11-23T18:30:00.000Z',
    notes: '班组记录',
    idempotencyKey: 'WO-KT-2026-001-RPT-20261124090000-A1B2',
  };
  const reported = { id: 'report-1', version: 3, productionOrderId: orderId, ...input };
  const post = (payload: unknown = body, scope = scopeFor()) =>
    bridged(requestFor({ method: 'POST', pathname: path, body: payload }), scope);
  const productionWith = () => {
    const reportOperation = vi.fn<Repository['reportOperation']>().mockResolvedValue(reported);
    return { production: productionOf({ reportOperation }), reportOperation };
  };

  it('POST 报工走 legacy 同解析链（trim / UUID 归一小写 / decimal 去尾零 / 时间归一 UTC / stableCode）→ 201 + mutation 投影', async () => {
    const { production, reportOperation } = productionWith();
    const response = await post(body, scopeFor(production));
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(reported);
    // 四个实参、顺序与接收者与 legacy reportOperation.call(repository, id, input, scope, correlationId) 一致。
    expect(reportOperation.mock.calls).toEqual([[orderId, input, scopeContext, correlationId]]);
    expect(reportOperation.mock.calls[0]).toHaveLength(4);
    expect(reportOperation.mock.contexts).toEqual([production]);
    expect(Object.keys(reportOperation.mock.calls[0]?.[1] as object)).toEqual([
      'operationId',
      'goodQuantity',
      'scrapQuantity',
      'laborMinutes',
      'machineMinutes',
      'startedAt',
      'completedAt',
      'notes',
      'idempotencyKey',
    ]);
  });

  it('POST 报工零值、废品大于良品与时间倒置按原文转发仓储（业务门禁在数据库触发器）；notes 缺省或留空被拒', async () => {
    const { production, reportOperation } = productionWith();
    const loose = {
      ...body,
      goodQuantity: '0',
      scrapQuantity: '999',
      laborMinutes: '0',
      startedAt: body.completedAt,
      completedAt: body.startedAt,
    };
    expect((await post(loose, scopeFor(production)))?.statusCode).toBe(201);
    expect(reportOperation.mock.calls[0]?.[1]).toEqual({
      ...input,
      goodQuantity: '0',
      scrapQuantity: '999',
      laborMinutes: '0',
      startedAt: input.completedAt,
      completedAt: input.startedAt,
    });
    // notes 缺省与留空在解析链里同值（'' → notes is required）：legacy 同此，留空不能提交。
    for (const notes of ['', '   ', undefined]) {
      const blank = productionWith();
      const response = await post({ ...body, notes }, scopeFor(blank.production));
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).message).toBe('notes is required');
      expect(blank.reportOperation).not.toHaveBeenCalled();
    }
  });

  it('POST 报工负例沿用 legacy 消息（请求体形状/未知字段/缺字段/UUID/数值/时间/编码/工单 UUID）', async () => {
    for (const [payload, message] of [
      [null, 'A JSON object body is required'],
      [[], 'A JSON object body is required'],
      [{ ...body, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...body, goodQuantity: undefined }, 'goodQuantity is required'],
      [{ ...body, operationId: 'not-a-uuid' }, 'operationId must be a UUID'],
      [{ ...body, goodQuantity: '-1' }, 'goodQuantity must be non-negative'],
      [{ ...body, laborMinutes: '1.1234567' }, 'Invalid decimal'],
      [{ ...body, startedAt: '2026-13-01' }, 'startedAt must be a valid timestamp'],
      [{ ...body, notes: null }, 'notes is required'],
      [
        { ...body, idempotencyKey: 'report key' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
    ] as const) {
      const { production, reportOperation } = productionWith();
      const response = await post(payload, scopeFor(production));
      expect(response?.statusCode, message).toBe(400);
      expect(errorOf(response), message).toEqual({
        code: 'invalid_request',
        message,
        correlationId,
      });
      expect(reportOperation, message).not.toHaveBeenCalled();
    }
    const { production, reportOperation } = productionWith();
    // 路径 id 须是十六进制形状才会被认领；不合法的 UUID 在认领后由解析链回 400。
    const malformed = await bridged(
      requestFor({
        method: 'POST',
        pathname: '/api/v1/production-orders/a/operation-reports',
        body,
      }),
      scopeFor(production),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('productionOrderId must be a UUID');
    expect(reportOperation).not.toHaveBeenCalled();
  });

  it('POST 报工响应按 production:read 字段投影；无读权限时回退 id/version（mutationDto 同口径）', async () => {
    const full = productionWith();
    expect((await post(body, scopeFor(full.production)))?.body).toEqual(reported);
    const masked = productionWith();
    const limited = await post(
      body,
      scopeFor(masked.production, { readFields: ['productionOrderId', 'goodQuantity'] }),
    );
    expect(limited?.body).toEqual({
      id: 'report-1',
      productionOrderId: orderId,
      goodQuantity: '10.25',
    });
    expect(limited?.body).not.toBe(reported);
    const bare = productionWith();
    const unreadable = await post(
      body,
      scopeFor(bare.production, { without: ['production:read'] }),
    );
    expect(unreadable?.statusCode).toBe(201);
    expect(unreadable?.body).toEqual({ id: 'report-1', version: 3 });
  });

  it('POST 报工幂等键只取请求体：同一请求每次都转发仓储（不在桥轨去重），请求头 idempotency-key 被忽略', async () => {
    const { production, reportOperation } = productionWith();
    const scope = scopeFor(production);
    const headers = { 'idempotency-key': 'HEADER-KEY', 'x-correlation-id': correlationId };
    const request = requestFor({ method: 'POST', pathname: path, body, headers });
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    const changed = requestFor({
      method: 'POST',
      pathname: path,
      body: { ...body, goodQuantity: '2' },
      headers,
    });
    expect((await bridged(changed, scope))?.statusCode).toBe(201);
    expect(reportOperation).toHaveBeenCalledTimes(3);
    expect(reportOperation.mock.calls.map((call) => call[1].idempotencyKey)).toEqual([
      input.idempotencyKey,
      input.idempotencyKey,
      input.idempotencyKey,
    ]);
    const missing = await bridged(
      requestFor({
        method: 'POST',
        pathname: path,
        body: { ...body, idempotencyKey: undefined },
        headers,
      }),
      scope,
    );
    expect(errorOf(missing).message).toBe('idempotencyKey is required');
    expect(reportOperation).toHaveBeenCalledTimes(3);
  });

  it('POST 报工鉴权：无 production:report → 403；字段授权不足 → Field permission denied；依赖缺失 503；均不触碰仓储', async () => {
    const { production, reportOperation } = productionWith();
    const denied = await post(body, scopeFor(production, { without: ['production:report'] }));
    expect(denied?.statusCode).toBe(403);
    expect(errorOf(denied).message).toBe('Permission denied');
    const narrow = productionWith();
    const fieldDenied = await post(
      body,
      scopeFor(narrow.production, { writeFields: ['operationId'] }),
    );
    expect(fieldDenied?.statusCode).toBe(403);
    expect(errorOf(fieldDenied).message).toBe('Field permission denied');
    // 字段授权覆盖请求里的全部字段时放行。
    const granted = productionWith();
    expect(
      (await post(body, scopeFor(granted.production, { writeFields: Object.keys(body) })))
        ?.statusCode,
    ).toBe(201);
    const unavailable = await post(body, scopeFor(null, { without: ['production:report'] }));
    expect(unavailable?.statusCode).toBe(503);
    expect(errorOf(unavailable).code).toBe('internal_error');
    for (const stub of [reportOperation, narrow.reportOperation])
      expect(stub).not.toHaveBeenCalled();
  });

  it('POST 报工仓储 DomainError 映射与 legacy 相同；其它异常回 500 且不外泄内部细节', async () => {
    for (const [code, status] of [
      ['conflict', 409],
      ['forbidden', 403],
      ['not_found', 404],
      ['invalid_request', 400],
    ] as const) {
      const reportOperation = vi
        .fn<Repository['reportOperation']>()
        .mockRejectedValue(new DomainError(code, 'original repository error'));
      const response = await post(body, scopeFor(productionOf({ reportOperation })));
      expect(response?.statusCode).toBe(status);
      expect(errorOf(response)).toEqual({
        code,
        message: 'original repository error',
        correlationId,
      });
    }
    const leaked = vi
      .fn<Repository['reportOperation']>()
      .mockRejectedValue(new Error('select * from secret'));
    const broken = await post(body, scopeFor(productionOf({ reportOperation: leaked })));
    expect(broken?.statusCode).toBe(500);
    expect(errorOf(broken)).toEqual({
      code: 'internal_error',
      message: 'Internal server error',
      correlationId,
    });
  });

  it('未认领的邻近路径与方法落回 legacy 轨（null）', async () => {
    const scope = scopeFor(productionWith().production);
    for (const request of [
      requestFor({ method: 'GET', pathname: path }),
      requestFor({ method: 'PUT', pathname: path, body }),
      requestFor({ method: 'DELETE', pathname: path }),
      requestFor({ method: 'POST', pathname: `${path}/` }),
      requestFor({ method: 'POST', pathname: `${path}/extra` }),
      requestFor({
        method: 'POST',
        pathname: path.replace('operation-reports', 'Operation-reports'),
      }),
      requestFor({
        method: 'POST',
        // 大写十六进制不在认领清单的 [0-9a-f-] 内（legacy match 同样不认），落回 legacy 轨。
        pathname: `/api/v1/production-orders/ABCDABCD-1234-4ABC-8ABC-ABCDEFABCDEF/operation-reports`,
        body,
      }),
    ])
      expect(await bridged(request, scope)).toBeNull();
  });
});

// 守恒组通用跑法：同一请求分别经 legacy app.dispatch 与桥轨，两轨各挂各的仓储替身。
type ExecutionMethod = 'reportOperation' | 'createOutput' | 'transactMaterial';
const stubOf = (method: ExecutionMethod, result: unknown) => {
  const mock = vi.fn(() => Promise.resolve(result));
  return { mock, production: productionOf({ [method]: mock }) };
};
const parityOf = async (
  request: ApiRequest,
  method: ExecutionMethod,
  result: unknown,
  options: ScopeOptions,
) => {
  const legacy = stubOf(method, result);
  const bridge = stubOf(method, result);
  const legacyScope = scopeFor(legacy.production, options);
  const [legacyResponse, bridgeResponse] = await Promise.all([
    legacyDispatch(request, legacyScope.authorization, legacy.production),
    bridged(request, { ...legacyScope, dependencies: dependencyScope(bridge.production) }),
  ]);
  return { legacy, bridge, legacyResponse, bridgeResponse };
};
const expectParity = (
  run: Awaited<ReturnType<typeof parityOf>>,
  label: string,
): { statusCode: number; body: unknown } => {
  // 旧轨经 app.dispatch 返回的对象在 HTTP 层还要过一次 JSON；桥轨的响应体已是解析后的 JSON。
  expect(run.bridgeResponse, label).toEqual(JSON.parse(JSON.stringify(run.legacyResponse)));
  expect(run.bridge.mock.mock.calls, label).toEqual(run.legacy.mock.mock.calls);
  // 两轨的接收者都是各自的仓储对象（legacy .call(repository, …) ↔ 桥轨方法调用）。
  expect(run.legacy.mock.mock.contexts, label).toEqual(
    run.legacy.mock.mock.calls.length > 0 ? [run.legacy.production] : [],
  );
  expect(run.bridge.mock.mock.contexts, label).toEqual(
    run.bridge.mock.mock.calls.length > 0 ? [run.bridge.production] : [],
  );
  return run.legacyResponse;
};
const expectOutcomeMix = (
  outcomes: readonly Tracked[],
  expected: readonly [created: number, fieldDenied: number, rejected: number],
): void => {
  const count = (status: number): number =>
    outcomes.filter((outcome) => outcome.statusCode === status).length;
  // 元断言：成功 201、字段授权拒绝 403、解析拒绝 400 三类结果都真的出现过。
  expect([count(201), count(403), count(400), outcomes.length]).toEqual([
    ...expected,
    expected.reduce((sum, value) => sum + value, 0),
  ]);
};
const sortedKeys = (outcome: { body: unknown }): readonly string[] =>
  Object.keys(outcome.body as object).sort();

describe('fastify bridge 行为守恒（operation-reports 对比 legacy）', () => {
  const path = `/api/v1/production-orders/${orderId}/operation-reports`;
  const valid = {
    operationId: ` ${operationId.toUpperCase()} `,
    goodQuantity: ' 10.250000 ',
    scrapQuantity: '0',
    laborMinutes: '12.5',
    machineMinutes: '20',
    startedAt: '2026-11-24T01:00:00+08:00',
    completedAt: '2026-11-24T02:30:00+08:00',
    notes: ' 班组记录 ',
    idempotencyKey: ' WO-KT-2026-001-RPT-20261124090000-A1B2 ',
  };
  const reported = {
    id: 'report-1',
    version: 3,
    productionOrderId: orderId,
    operationId,
    goodQuantity: '10.25',
    scrapQuantity: '0',
    laborMinutes: '12.5',
    machineMinutes: '20',
    startedAt: '2026-11-23T17:00:00.000Z',
    completedAt: '2026-11-23T18:30:00.000Z',
    notes: '班组记录',
    idempotencyKey: 'WO-KT-2026-001-RPT-20261124090000-A1B2',
  };
  const cases: readonly { name: string; body: unknown }[] = [
    { name: '规范输入', body: valid },
    {
      name: '零值与时间倒置',
      body: { ...valid, goodQuantity: '0', scrapQuantity: '999', laborMinutes: '0' },
    },
    { name: 'notes 留空（服务端要求非空）', body: { ...valid, notes: '' } },
    { name: '未知字段', body: { ...valid, unexpected: 1 } },
    { name: '缺字段', body: { ...valid, goodQuantity: undefined } },
    { name: '非对象请求体', body: null },
    { name: '非法 UUID', body: { ...valid, operationId: 'not-a-uuid' } },
    { name: '负数', body: { ...valid, goodQuantity: '-1' } },
    { name: '非法时间', body: { ...valid, startedAt: '2026-13-01' } },
    { name: '非法幂等键', body: { ...valid, idempotencyKey: 'report key' } },
  ];

  it('POST /api/v1/production-orders/:id/operation-reports：新旧轨状态码、响应与仓储实参逐字节一致（含读写字段遮蔽与负例）', async () => {
    const outcomes: Tracked[] = [];
    for (const readFields of [null, ['productionOrderId', 'goodQuantity']] as const) {
      for (const writeFields of [null, ['operationId', 'notes']] as const) {
        for (const item of cases) {
          const label = `${item.name} / read=${String(readFields)} / write=${String(writeFields)}`;
          outcomes.push(
            expectParity(
              await parityOf(
                requestFor({ method: 'POST', pathname: path, body: item.body }),
                'reportOperation',
                reported,
                { readFields, writeFields },
              ),
              label,
            ),
          );
        }
      }
    }
    // 2 种读遮蔽 × 2 种写授权 × 10 个用例 = 40 个请求。
    expectOutcomeMix(outcomes, [4, 16, 20]);
    // 读遮蔽生效的两次成功确实被裁成了更小的响应体（外层循环先走读字段不限的两次）。
    const full = Object.keys(reported).sort();
    const masked = ['goodQuantity', 'id', 'productionOrderId'];
    expect(outcomes.filter((outcome) => outcome.statusCode === 201).map(sortedKeys)).toEqual([
      full,
      full,
      masked,
      masked,
    ]);
  });
});

describe('production order execution fastify bridge track: finished rolls', () => {
  const path = `/api/v1/production-orders/${orderId}/finished-rolls`;
  const reportId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const body = {
    operationReportId: ` ${reportId.toUpperCase()} `,
    itemVersionId: ` ${operationId.toUpperCase()} `,
    rollNumber: ' ROLL-1 ',
    lotNumber: ' LOT-1 ',
    locationId: ' bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb ',
    quantity: ' 1.230000 ',
    manufacturedAt: ' 2026-10-14 ',
  };
  const input = {
    operationReportId: reportId,
    itemVersionId: operationId,
    rollNumber: 'ROLL-1',
    lotNumber: 'LOT-1',
    locationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity: '1.23',
    manufacturedAt: '2026-10-14',
  };
  const received = {
    id: 'roll-1',
    version: 5,
    productionOrderId: orderId,
    qualityStatus: 'QUARANTINE',
    ...input,
  };
  const post = (payload: unknown = body, scope = scopeFor()) =>
    bridged(requestFor({ method: 'POST', pathname: path, body: payload }), scope);
  const productionWith = () => {
    const createOutput = vi.fn<Repository['createOutput']>().mockResolvedValue(received);
    return { production: productionOf({ createOutput }), createOutput };
  };

  it('POST 成品卷入库走 legacy 同解析链（trim / UUID 归一小写 / stableCode / decimal 去尾零 / 日历日期原文）→ 201 + mutation 投影', async () => {
    const { production, createOutput } = productionWith();
    const response = await post(body, scopeFor(production));
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(received);
    expect(createOutput.mock.calls).toEqual([[orderId, input, scopeContext, correlationId]]);
    expect(createOutput.mock.calls[0]).toHaveLength(4);
    expect(createOutput.mock.contexts).toEqual([production]);
    expect(Object.keys(createOutput.mock.calls[0]?.[1] as object)).toEqual([
      'operationReportId',
      'itemVersionId',
      'rollNumber',
      'lotNumber',
      'locationId',
      'quantity',
      'manufacturedAt',
    ]);
  });

  it('POST 成品卷入库负例沿用 legacy 消息（请求体形状/未知字段含幂等键/缺字段/UUID/编码/数值/日历日期/工单 UUID）', async () => {
    for (const [payload, message] of [
      [null, 'A JSON object body is required'],
      [[], 'A JSON object body is required'],
      [{ ...body, idempotencyKey: 'KEY' }, 'Unsupported fields: idempotencyKey'],
      [{ ...body, quantity: undefined }, 'quantity is required'],
      [{ ...body, operationReportId: 'not-a-uuid' }, 'operationReportId must be a UUID'],
      [
        { ...body, rollNumber: 'roll-1' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        { ...body, lotNumber: 'LOT 1' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...body, quantity: '-1' }, 'quantity must be non-negative'],
      [{ ...body, manufacturedAt: '2026-02-30' }, 'manufacturedAt must be a valid YYYY-MM-DD date'],
      [
        { ...body, manufacturedAt: '2026-10-14T00:00:00Z' },
        'manufacturedAt must be a valid YYYY-MM-DD date',
      ],
    ] as const) {
      const { production, createOutput } = productionWith();
      const response = await post(payload, scopeFor(production));
      expect(response?.statusCode, message).toBe(400);
      expect(errorOf(response), message).toEqual({
        code: 'invalid_request',
        message,
        correlationId,
      });
      expect(createOutput, message).not.toHaveBeenCalled();
    }
    const { production, createOutput } = productionWith();
    const malformed = await post(
      body,
      scopeFor(production, { writeFields: ['operationReportId'] }),
    );
    expect(errorOf(malformed).message).toBe('Field permission denied');
    expect(createOutput).not.toHaveBeenCalled();
  });

  it('POST 成品卷入库没有幂等键字段：请求头 idempotency-key 被忽略，同一请求每次都转发仓储', async () => {
    const { production, createOutput } = productionWith();
    const scope = scopeFor(production);
    const request = requestFor({
      method: 'POST',
      pathname: path,
      body,
      headers: { 'idempotency-key': 'HEADER-KEY', 'x-correlation-id': correlationId },
    });
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    expect(createOutput).toHaveBeenCalledTimes(2);
    expect(Object.hasOwn(createOutput.mock.calls[0]?.[1] as object, 'idempotencyKey')).toBe(false);
    expect(createOutput.mock.calls[1]).toEqual(createOutput.mock.calls[0]);
  });

  it('POST 成品卷入库响应按 production:read 字段投影；无读权限时回退 id/version；鉴权与依赖缺失同报工端点', async () => {
    const masked = productionWith();
    const limited = await post(
      body,
      scopeFor(masked.production, { readFields: ['rollNumber', 'quantity'] }),
    );
    expect(limited?.body).toEqual({ id: 'roll-1', rollNumber: 'ROLL-1', quantity: '1.23' });
    const bare = productionWith();
    const unreadable = await post(
      body,
      scopeFor(bare.production, { without: ['production:read'] }),
    );
    expect(unreadable?.body).toEqual({ id: 'roll-1', version: 5 });
    const denied = productionWith();
    const forbidden = await post(
      body,
      scopeFor(denied.production, { without: ['production:report'] }),
    );
    expect(errorOf(forbidden)).toEqual({
      code: 'forbidden',
      message: 'Permission denied',
      correlationId,
    });
    expect((await post(body, scopeFor(null)))?.statusCode).toBe(503);
    // 成功的两次各调用一次；被拒绝的那次不触碰仓储。
    expect(masked.createOutput).toHaveBeenCalledTimes(1);
    expect(bare.createOutput).toHaveBeenCalledTimes(1);
    expect(denied.createOutput).not.toHaveBeenCalled();
  });

  it('POST 成品卷入库仓储异常映射同报工端点（DomainError 409 / 其它 500 不外泄）；未认领路径落回 null', async () => {
    const conflict = vi
      .fn<Repository['createOutput']>()
      .mockRejectedValue(new DomainError('conflict', 'finished roll must match its report'));
    const response = await post(body, scopeFor(productionOf({ createOutput: conflict })));
    expect(response?.statusCode).toBe(409);
    expect(errorOf(response).message).toBe('finished roll must match its report');
    const leaked = vi
      .fn<Repository['createOutput']>()
      .mockRejectedValue(new Error('insert into inventory_lots'));
    expect(
      errorOf(await post(body, scopeFor(productionOf({ createOutput: leaked })))).message,
    ).toBe('Internal server error');
    const scope = scopeFor(productionWith().production);
    for (const request of [
      requestFor({ method: 'GET', pathname: path }),
      requestFor({ method: 'PUT', pathname: path, body }),
      requestFor({ method: 'POST', pathname: `${path}/` }),
      requestFor({ method: 'POST', pathname: path.replace('finished-rolls', 'Finished-rolls') }),
      requestFor({
        method: 'POST',
        pathname: `/api/v1/production-orders/ABCDABCD-1234-4ABC-8ABC-ABCDEFABCDEF/finished-rolls`,
        body,
      }),
    ])
      expect(await bridged(request, scope)).toBeNull();
  });
});

describe('fastify bridge 行为守恒（finished-rolls 对比 legacy）', () => {
  const path = `/api/v1/production-orders/${orderId}/finished-rolls`;
  const valid = {
    operationReportId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    itemVersionId: ` ${operationId.toUpperCase()} `,
    rollNumber: ' ROLL-1 ',
    lotNumber: ' LOT-1 ',
    locationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity: ' 1.230000 ',
    manufacturedAt: ' 2024-02-29 ',
  };
  const received = {
    id: 'roll-1',
    version: 5,
    productionOrderId: orderId,
    operationReportId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    itemVersionId: operationId,
    rollNumber: 'ROLL-1',
    lotNumber: 'LOT-1',
    locationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity: '1.23',
    manufacturedAt: '2024-02-29',
  };
  const cases: readonly { name: string; body: unknown }[] = [
    { name: '规范输入（闰日）', body: valid },
    { name: '未知字段（幂等键）', body: { ...valid, idempotencyKey: 'KEY' } },
    { name: '缺字段', body: { ...valid, quantity: undefined } },
    { name: '非对象请求体', body: [] },
    { name: '非法 UUID', body: { ...valid, itemVersionId: 'not-a-uuid' } },
    { name: '小写卷号', body: { ...valid, rollNumber: 'roll-1' } },
    { name: '溢出日期', body: { ...valid, manufacturedAt: '2026-02-30' } },
    { name: '负数', body: { ...valid, quantity: '-1' } },
  ];

  it('POST /api/v1/production-orders/:id/finished-rolls：新旧轨状态码、响应与仓储实参逐字节一致（含读写字段遮蔽与负例）', async () => {
    const outcomes: Tracked[] = [];
    for (const readFields of [null, ['rollNumber', 'quantity']] as const) {
      for (const writeFields of [null, ['rollNumber']] as const) {
        for (const item of cases) {
          const label = `${item.name} / read=${String(readFields)} / write=${String(writeFields)}`;
          outcomes.push(
            expectParity(
              await parityOf(
                requestFor({ method: 'POST', pathname: path, body: item.body }),
                'createOutput',
                received,
                { readFields, writeFields },
              ),
              label,
            ),
          );
        }
      }
    }
    // 2 种读遮蔽 × 2 种写授权 × 8 个用例 = 32 个请求；只有「规范输入」在写授权不限时成功，
    // 所以成功 2、字段授权拒绝 12、解析拒绝 18。
    expectOutcomeMix(outcomes, [2, 12, 18]);
    const full = Object.keys(received).sort();
    const masked = ['id', 'quantity', 'rollNumber'];
    expect(outcomes.filter((outcome) => outcome.statusCode === 201).map(sortedKeys)).toEqual([
      full,
      masked,
    ]);
  });
});

describe('production order execution fastify bridge track: materials', () => {
  const path = `/api/v1/production-orders/${orderId}/materials`;
  const lotId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const locationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const body = {
    transactionType: ' ISSUE ',
    itemVersionId: ` ${operationId.toUpperCase()} `,
    lotId,
    locationId: ` ${locationId.toUpperCase()} `,
    quantity: ' 2.250000 ',
    reason: ' 领退料原因 ',
    occurredAt: '2026-11-24T08:00:00+08:00',
    idempotencyKey: ' WO-KT-2026-001-MAT-20261124080000-C3D4 ',
  };
  const input = {
    transactionType: 'ISSUE',
    itemVersionId: operationId,
    lotId,
    locationId,
    quantity: '2.25',
    reason: '领退料原因',
    occurredAt: '2026-11-24T00:00:00.000Z',
    idempotencyKey: 'WO-KT-2026-001-MAT-20261124080000-C3D4',
  };
  const posted = {
    id: 'material-1',
    version: 2,
    productionOrderId: orderId,
    inventoryMovementId: lotId,
    ...input,
  };
  const post = (payload: unknown = body, scope = scopeFor()) =>
    bridged(requestFor({ method: 'POST', pathname: path, body: payload }), scope);
  const productionWith = () => {
    const transactMaterial = vi.fn<Repository['transactMaterial']>().mockResolvedValue(posted);
    return { production: productionOf({ transactMaterial }), transactMaterial };
  };

  it.each(['ISSUE', 'RETURN'] as const)(
    'POST 领退料（%s）走 legacy 同解析链（trim / UUID 归一小写 / decimal 去尾零 / 时间归一 UTC / stableCode）→ 201 + mutation 投影',
    async (transactionType) => {
      const { production, transactMaterial } = productionWith();
      const payload = { ...body, transactionType: ` ${transactionType} ` };
      const response = await post(payload, scopeFor(production));
      expect(response?.statusCode).toBe(201);
      // 替身仓储对两种业务类型返回同一行；请求类型体现在仓储实参上。
      expect(response?.body).toEqual(posted);
      expect(transactMaterial.mock.calls).toEqual([
        [orderId, { ...input, transactionType }, scopeContext, correlationId],
      ]);
      expect(transactMaterial.mock.calls[0]).toHaveLength(4);
      expect(transactMaterial.mock.contexts).toEqual([production]);
      expect(Object.keys(transactMaterial.mock.calls[0]?.[1] as object)).toEqual([
        'transactionType',
        'itemVersionId',
        'lotId',
        'locationId',
        'quantity',
        'reason',
        'occurredAt',
        'idempotencyKey',
      ]);
    },
  );

  it('POST 领退料负例沿用 legacy 消息（请求体形状/未知字段/缺字段/业务类型/UUID/数值/时间/原因/编码/工单 UUID）', async () => {
    for (const [payload, message] of [
      [null, 'A JSON object body is required'],
      [[], 'A JSON object body is required'],
      [{ ...body, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...body, quantity: undefined }, 'quantity is required'],
      [{ ...body, transactionType: '' }, 'transactionType is required'],
      [{ ...body, transactionType: 'issue' }, 'transactionType is unsupported'],
      [{ ...body, transactionType: 'TRANSFER' }, 'transactionType is unsupported'],
      [{ ...body, lotId: 'not-a-uuid' }, 'lotId must be a UUID'],
      [{ ...body, quantity: '-1' }, 'quantity must be non-negative'],
      [{ ...body, occurredAt: '2026-13-01' }, 'occurredAt must be a valid timestamp'],
      [{ ...body, reason: null }, 'reason is required'],
      [
        { ...body, idempotencyKey: 'material key' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
    ] as const) {
      const { production, transactMaterial } = productionWith();
      const response = await post(payload, scopeFor(production));
      expect(response?.statusCode, message).toBe(400);
      expect(errorOf(response), message).toEqual({
        code: 'invalid_request',
        message,
        correlationId,
      });
      expect(transactMaterial, message).not.toHaveBeenCalled();
    }
    const { production, transactMaterial } = productionWith();
    const malformed = await bridged(
      requestFor({ method: 'POST', pathname: '/api/v1/production-orders/a/materials', body }),
      scopeFor(production),
    );
    expect(errorOf(malformed).message).toBe('productionOrderId must be a UUID');
    expect(transactMaterial).not.toHaveBeenCalled();
  });

  it('POST 领退料鉴权先于业务类型枚举：无 production:material → 403；字段授权不足 → Field permission denied；依赖缺失 503', async () => {
    const denied = productionWith();
    // 业务类型非法也先由授权拒绝（legacy：authorizeQuery 先于 transactionType 枚举）。
    const forbidden = await post(
      { ...body, transactionType: 'BAD' },
      scopeFor(denied.production, { without: ['production:material'] }),
    );
    expect(errorOf(forbidden)).toEqual({
      code: 'forbidden',
      message: 'Permission denied',
      correlationId,
    });
    const narrow = productionWith();
    const fieldDenied = await post(
      body,
      scopeFor(narrow.production, { writeFields: ['transactionType'] }),
    );
    expect(errorOf(fieldDenied).message).toBe('Field permission denied');
    // 报工能力键不能代替领料能力键。
    const reportOnly = productionWith();
    const swapped = await post(
      body,
      scopeFor(reportOnly.production, { without: ['production:material'] }),
    );
    expect(errorOf(swapped).message).toBe('Permission denied');
    const granted = productionWith();
    expect(
      (await post(body, scopeFor(granted.production, { writeFields: Object.keys(body) })))
        ?.statusCode,
    ).toBe(201);
    expect((await post(body, scopeFor(null)))?.statusCode).toBe(503);
    for (const stub of [
      denied.transactMaterial,
      narrow.transactMaterial,
      reportOnly.transactMaterial,
    ])
      expect(stub).not.toHaveBeenCalled();
    expect(granted.transactMaterial).toHaveBeenCalledTimes(1);
  });

  it('POST 领退料幂等键只取请求体：同一请求每次都转发仓储，请求头被忽略；缺键回 400', async () => {
    const { production, transactMaterial } = productionWith();
    const scope = scopeFor(production);
    const headers = { 'idempotency-key': 'HEADER-KEY', 'x-correlation-id': correlationId };
    const request = requestFor({ method: 'POST', pathname: path, body, headers });
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    expect((await bridged(request, scope))?.statusCode).toBe(201);
    expect(
      (
        await bridged(
          requestFor({
            method: 'POST',
            pathname: path,
            body: { ...body, transactionType: 'RETURN', quantity: '0.5' },
            headers,
          }),
          scope,
        )
      )?.statusCode,
    ).toBe(201);
    expect(transactMaterial).toHaveBeenCalledTimes(3);
    expect(transactMaterial.mock.calls.map((call) => call[1].idempotencyKey)).toEqual([
      input.idempotencyKey,
      input.idempotencyKey,
      input.idempotencyKey,
    ]);
    expect(transactMaterial.mock.calls[2]?.[1]).toMatchObject({
      transactionType: 'RETURN',
      quantity: '0.5',
    });
    const missing = await bridged(
      requestFor({
        method: 'POST',
        pathname: path,
        body: { ...body, idempotencyKey: undefined },
        headers,
      }),
      scope,
    );
    expect(errorOf(missing).message).toBe('idempotencyKey is required');
    expect(transactMaterial).toHaveBeenCalledTimes(3);
  });

  it('POST 领退料响应按 production:read 字段投影；无读权限时回退 id/version', async () => {
    const masked = productionWith();
    const limited = await post(
      body,
      scopeFor(masked.production, { readFields: ['transactionType', 'quantity'] }),
    );
    expect(limited?.body).toEqual({
      id: 'material-1',
      transactionType: 'ISSUE',
      quantity: '2.25',
    });
    const bare = productionWith();
    expect(
      (await post(body, scopeFor(bare.production, { without: ['production:read'] })))?.body,
    ).toEqual({ id: 'material-1', version: 2 });
  });

  it('POST 领退料仓储异常映射同报工端点（DomainError 409 / 其它 500 不外泄）；未认领路径落回 null', async () => {
    const conflict = vi
      .fn<Repository['transactMaterial']>()
      .mockRejectedValue(new DomainError('conflict', '该批次物料不属于工单 BOM'));
    const response = await post(body, scopeFor(productionOf({ transactMaterial: conflict })));
    expect(response?.statusCode).toBe(409);
    expect(errorOf(response).message).toBe('该批次物料不属于工单 BOM');
    const leaked = vi
      .fn<Repository['transactMaterial']>()
      .mockRejectedValue(new Error('insert into inventory_movements'));
    expect(
      errorOf(await post(body, scopeFor(productionOf({ transactMaterial: leaked })))).message,
    ).toBe('Internal server error');
    const scope = scopeFor(productionWith().production);
    for (const request of [
      requestFor({ method: 'GET', pathname: path }),
      requestFor({ method: 'PUT', pathname: path, body }),
      requestFor({ method: 'POST', pathname: `${path}/` }),
      requestFor({ method: 'POST', pathname: path.replace('materials', 'Materials') }),
      requestFor({
        method: 'POST',
        pathname: `/api/v1/production-orders/ABCDABCD-1234-4ABC-8ABC-ABCDEFABCDEF/materials`,
        body,
      }),
    ])
      expect(await bridged(request, scope)).toBeNull();
  });
});

describe('fastify bridge 行为守恒（materials 对比 legacy）', () => {
  const path = `/api/v1/production-orders/${orderId}/materials`;
  const valid = {
    transactionType: ' ISSUE ',
    itemVersionId: ` ${operationId.toUpperCase()} `,
    lotId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    locationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity: ' 2.250000 ',
    reason: ' 领退料原因 ',
    occurredAt: '2026-11-24T08:00:00+08:00',
    idempotencyKey: ' WO-KT-2026-001-MAT-20261124080000-C3D4 ',
  };
  const posted = {
    id: 'material-1',
    version: 2,
    productionOrderId: orderId,
    transactionType: 'ISSUE',
    itemVersionId: operationId,
    lotId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    locationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity: '2.25',
    reason: '领退料原因',
    occurredAt: '2026-11-24T00:00:00.000Z',
    idempotencyKey: 'WO-KT-2026-001-MAT-20261124080000-C3D4',
  };
  const cases: readonly { name: string; body: unknown }[] = [
    { name: '规范输入（领料）', body: valid },
    { name: '规范输入（退料）', body: { ...valid, transactionType: 'RETURN' } },
    { name: '业务类型小写', body: { ...valid, transactionType: 'issue' } },
    { name: '缺字段', body: { ...valid, reason: undefined } },
    { name: '非对象请求体', body: [] },
    { name: '非法 UUID', body: { ...valid, lotId: 'not-a-uuid' } },
    { name: '负数', body: { ...valid, quantity: '-1' } },
    { name: '非法时间', body: { ...valid, occurredAt: '2026-13-01' } },
    { name: '非法幂等键', body: { ...valid, idempotencyKey: 'material key' } },
  ];

  it('POST /api/v1/production-orders/:id/materials：新旧轨状态码、响应与仓储实参逐字节一致（含读写字段遮蔽与负例）', async () => {
    const outcomes: Tracked[] = [];
    for (const readFields of [null, ['transactionType', 'quantity']] as const) {
      for (const writeFields of [null, ['transactionType']] as const) {
        for (const item of cases) {
          const label = `${item.name} / read=${String(readFields)} / write=${String(writeFields)}`;
          outcomes.push(
            expectParity(
              await parityOf(
                requestFor({ method: 'POST', pathname: path, body: item.body }),
                'transactMaterial',
                posted,
                { readFields, writeFields },
              ),
              label,
            ),
          );
        }
      }
    }
    // 2 种读遮蔽 × 2 种写授权 × 9 个用例 = 36 个请求：两个规范输入各成功 2 次 → 4；写授权
    // 只放行 transactionType 时，其余七个字段一并被字段授权拒绝（授权先于枚举）→ 8 个
    // 用例 × 2 = 16；其余 16 为解析拒绝。
    expectOutcomeMix(outcomes, [4, 16, 16]);
    const full = Object.keys(posted).sort();
    const masked = ['id', 'quantity', 'transactionType'];
    expect(outcomes.filter((outcome) => outcome.statusCode === 201).map(sortedKeys)).toEqual([
      full,
      full,
      masked,
      masked,
    ]);
  });
});
