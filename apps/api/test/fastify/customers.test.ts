import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// WF-A（TD-WF-013）：customers Fastify 组的 POST 创建在仓储拒绝时的契约。
// 客户表上两个唯一约束冲突 → 409 + 中文提示（此前是 500；主协调裁定两个一并映射）：
//   - 重复客户编号 customers_tenant_id_customer_number_key →「客户编号已存在」；
//   - 重复客户名称 customers_identity_active_unique       →「客户名称已存在」。
// 映射只做在这个端点、只认这两个约束，其余异常仍 500 且不回显原始消息。
// 解析链与 201 路径本身由 customer-base-route-contract / app 测试覆盖，这里只钉调用实参。
const tenant = '11111111-1111-4111-8111-111111111111';
const actor = { companyId: tenant, employeeId: 'e-1' };
const customer = {
  id: '22222222-2222-4222-8222-222222222222',
  tenantId: tenant,
  customerNumber: 'CUST-001',
  name: 'Synthetic customer',
  status: 'PROSPECT',
  ownerId: null,
  version: 1,
  createdAt: '2026-11-24T00:00:00.000Z',
  updatedAt: '2026-11-24T00:00:00.000Z',
};
type Grant = { scopes: string[]; fields: readonly string[] | null };
// pg 对唯一约束冲突给出的错误形状（消息带约束名，detail 带请求值）。
const uniqueViolation = (constraint: string, detail: string) =>
  Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: '23505',
    constraint,
    // pg 的原始错误带请求值；响应里绝不能出现它。
    detail,
  });
const duplicateNumber = () =>
  uniqueViolation(
    'customers_tenant_id_customer_number_key',
    `Key (tenant_id, customer_number)=(${tenant}, CUST-001) already exists.`,
  );
const duplicateName = () =>
  uniqueViolation(
    'customers_identity_active_unique',
    `Key (tenant_id, normalized_name)=(${tenant}, synthetic customer) already exists.`,
  );
const scopeFor = (
  createCustomer: ReturnType<typeof vi.fn>,
  grants: Readonly<Record<string, Grant>> = {
    'customer:create': { scopes: ['COMPANY'], fields: null },
    'customer:read': { scopes: ['COMPANY'], fields: null },
  },
) => ({
  authorization: {
    actor,
    permissions: new Map(Object.entries(grants)),
  } as unknown as AuthorizationContext,
  dependencies: { crm: { createCustomer }, commercial: {} } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});
const create = (
  scope: ReturnType<typeof scopeFor>,
  body: unknown = { name: 'Synthetic customer', customerNumber: 'CUST-001' },
) =>
  dispatchFastifyRouteGroup(
    {
      method: 'POST',
      pathname: '/api/v1/customers',
      headers: { 'x-correlation-id': 'corr-1' },
      body,
    },
    scope,
  );
// 响应体是 unknown；收窄成记录后再读字段（不用 any）。
const recordOf = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
};
const errorOf = (response: { body: unknown } | null) => recordOf(recordOf(response?.body).error);

describe('customers fastify bridge track: duplicate customer number / name (TD-WF-013)', () => {
  it('POST 创建：重复客户编号 → 409，提示「客户编号已存在」，不回显数据库原始消息', async () => {
    const response = await create(scopeFor(vi.fn().mockRejectedValue(duplicateNumber())));
    expect(response?.statusCode).toBe(409);
    expect(errorOf(response)).toEqual({
      code: 'conflict',
      message: '客户编号已存在',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(response?.body)).not.toMatch(/duplicate key|Key \(tenant_id|CUST-001/u);
  });

  it('POST 创建：重复客户名称（规范化名称唯一索引）→ 409，提示「客户名称已存在」，不回显数据库原始消息', async () => {
    const response = await create(scopeFor(vi.fn().mockRejectedValue(duplicateName())));
    expect(response?.statusCode).toBe(409);
    expect(errorOf(response)).toEqual({
      code: 'conflict',
      message: '客户名称已存在',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(response?.body)).not.toMatch(
      /duplicate key|Key \(tenant_id|normalized_name|synthetic customer/u,
    );
  });

  it('POST 创建：成功路径不受影响——调用实参正确，201 + 载荷', async () => {
    const createCustomer = vi.fn().mockResolvedValue(customer);
    const response = await create(
      scopeFor(createCustomer, {
        'customer:create': { scopes: ['COMPANY'], fields: null },
        'customer:read': { scopes: ['COMPANY'], fields: ['customerNumber', 'name'] },
      }),
      { name: 'Synthetic customer', customerNumber: 'CUST-001', tags: ['vip'] },
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({
      id: customer.id,
      customerNumber: 'CUST-001',
      name: 'Synthetic customer',
    });
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(createCustomer.mock.calls[0]).toEqual([
      { name: 'Synthetic customer', customerNumber: 'CUST-001', tags: ['vip'] },
      actor,
      'corr-1',
    ]);
  });

  it('POST 创建：其它数据库错误保持 500 且响应不含原始消息（不做全局映射）', async () => {
    // 客户表主键/唯一键（id 与 tenant_id）与本次两个业务唯一约束不同名：不映射。
    const idKey = Object.assign(
      new Error('duplicate key value violates unique constraint "customers_id_tenant_id_key"'),
      { code: '23505', constraint: 'customers_id_tenant_id_key' },
    );
    const notNull = Object.assign(
      new Error('null value in column "name" violates not-null constraint'),
      {
        code: '23502',
      },
    );
    const missingTable = Object.assign(new Error('relation "customers" does not exist'), {
      code: '42P01',
    });
    for (const failure of [idKey, notNull, missingTable]) {
      const response = await create(scopeFor(vi.fn().mockRejectedValue(failure)));
      expect(response?.statusCode).toBe(500);
      expect(response?.body).toEqual({
        error: {
          code: 'internal_error',
          message: 'Internal server error',
          correlationId: 'corr-1',
        },
      });
    }
    // 约束名对但 SQLSTATE 不对（不是唯一约束冲突）也不映射。
    const wrongState = Object.assign(new Error('deadlock detected'), {
      code: '40P01',
      constraint: 'customers_tenant_id_customer_number_key',
    });
    const response = await create(scopeFor(vi.fn().mockRejectedValue(wrongState)));
    expect(response?.statusCode).toBe(500);
  });

  it('POST 创建：解析链与授权负例的消息保持不变（映射只包住仓储调用）', async () => {
    const createCustomer = vi.fn().mockResolvedValue(customer);
    // 解析消息逐字取自 app-values.ts（string / strings），用来证明映射没有改动解析链。
    for (const [body, message] of [
      [
        { name: 'Synthetic customer', customerNumber: 'CUST-001', extra: 1 },
        'Unsupported fields: extra',
      ],
      [{ customerNumber: 'CUST-001' }, 'name is required'],
      [{ name: 'Synthetic customer' }, 'customerNumber is required'],
      [
        { name: 'Synthetic customer', customerNumber: 'CUST-001', tags: 'vip' },
        'tags must be an array of non-empty strings',
      ],
    ] as const) {
      const response = await create(scopeFor(createCustomer), body);
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).message).toBe(message);
    }
    expect(createCustomer).not.toHaveBeenCalled();
    const denied = await create(
      scopeFor(createCustomer, { 'customer:read': { scopes: ['COMPANY'], fields: null } }),
    );
    expect(denied?.statusCode).toBe(403);
    expect(errorOf(denied).message).toBe('Permission denied');
  });

  it('POST 创建：CRM 依赖缺失 503', async () => {
    const response = await dispatchFastifyRouteGroup(
      {
        method: 'POST',
        pathname: '/api/v1/customers',
        headers: { 'x-correlation-id': 'corr-1' },
        body: { name: 'Synthetic customer', customerNumber: 'CUST-001' },
      },
      {
        authorization: {
          actor,
          permissions: new Map([['customer:create', { scopes: ['COMPANY'], fields: null }]]),
        } as unknown as AuthorizationContext,
        dependencies: { commercial: {} } as unknown as ApiDependencies,
        correlationId: 'corr-1',
      },
    );
    expect(response?.statusCode).toBe(503);
  });
});
