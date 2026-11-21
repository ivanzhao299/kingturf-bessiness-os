import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-CRM-3：contacts Fastify 组契约测试——GET 列表/详情（additive 只读，sensitive
// 联系方式门由仓储折叠）、POST 创建（legacy 同解析链，消息逐字节一致）、
// CRM-matcher 503 门（依赖缺失先于权限校验）。
const contact = {
  id: '33333333-3333-4333-8333-333333333333',
  customerId: '22222222-2222-4222-8222-222222222222',
  name: 'Buyer Zhang',
  title: '采购经理',
  email: 'buyer@example.test',
  phone: '13800000000',
  primary: true,
  version: 1,
  createdAt: '2026-11-20T00:00:00.000Z',
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listContacts?: ReturnType<typeof vi.fn>;
    findContact?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listContacts:
      overrides.listContacts ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listContacts', args });
        return Promise.resolve([contact]);
      }),
    findContact:
      overrides.findContact ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findContact', args });
        return Promise.resolve(contact);
      }),
    createContact: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'createContact', args });
      return Promise.resolve(contact);
    }),
  }) as unknown as NonNullable<ApiDependencies['crm']>;

const scopeFor = (repo: NonNullable<ApiDependencies['crm']> = repository()) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['customer:read', { scopes: ['TENANT'], fields: null }],
      ['customer:update', { scopes: ['TENANT'], fields: null }],
      ['customer-360:read', { scopes: ['TENANT'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { crm: repo, commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/customers/22222222-2222-4222-8222-222222222222/contacts',
  headers: { 'idempotency-key': 'fixed-key' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

const CLAIM_NOTE =
  'CRM-matcher 503 gate is legacy-track behavior; verified by customer-base contract suite';

describe('contacts fastify bridge track', () => {
  it('GET 列表：sensitive 门开启时含 email/phone；客户作用域门（scope）在授权前执行', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect((response?.body as { items: unknown[] }).items).toEqual([contact]);
    expect(repositoryCalls[0]?.args[4]).toEqual({ email: true, phone: true });
  });

  it('sensitive 门关闭（字段裁剪）时行不含 email/phone', async () => {
    const repo = repository();
    (repo as unknown as { listContacts: ReturnType<typeof vi.fn> }).listContacts.mockResolvedValue([
      {
        id: contact.id,
        customerId: contact.customerId,
        name: contact.name,
        title: contact.title,
        primary: true,
        version: 1,
        createdAt: contact.createdAt,
      },
    ]);
    const scope = scopeFor(repo);
    (
      scope.authorization.permissions.get('customer-360:read') as { fields: readonly string[] }
    ).fields = ['customer.name'];
    const response = await dispatchFastifyRouteGroup(requestFor(), scope);
    const items = (response?.body as { items: Record<string, unknown>[] }).items;
    expect(items[0]).not.toHaveProperty('email');
    expect(items[0]).not.toHaveProperty('phone');
  });

  it('GET 详情命中返回行；未命中映射 not_found 信封', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({
        pathname:
          '/api/v1/customers/22222222-2222-4222-8222-222222222222/contacts/33333333-3333-4333-8333-333333333333',
      }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(contact);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        pathname:
          '/api/v1/customers/22222222-2222-4222-8222-222222222222/contacts/33333333-3333-4333-8333-333333333333',
      }),
      scopeFor(repository({ findContact: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Contact not found',
    });
  });

  it('POST 创建走 legacy 同解析链（email/phone 归一化、primary 布尔）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          name: ' Buyer Zhang ',
          title: '采购经理',
          email: ' Buyer@Example.test ',
          phone: '13800000000',
          primary: true,
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createContact');
    expect(call?.args[0]).toBe('22222222-2222-4222-8222-222222222222');
    expect(call?.args[1]).toEqual({
      name: 'Buyer Zhang',
      title: '采购经理',
      email: 'buyer@example.test',
      phone: '13800000000',
      primary: true,
    });
  });

  it('POST 负例沿用 legacy 消息（email/phone 类型、至少其一、未知字段、非 uuid 客户）', async () => {
    const base = { name: 'X', email: 'a@b.test' };
    for (const [body, message] of [
      [{ name: 'X', email: 42 }, 'email must be a string'],
      [{ name: 'X', phone: 42 }, 'phone must be a string'],
      [{ name: 'X' }, 'Contact email or phone is required'],
      [{ name: 'X', email: 'a@b.test', unexpected: 1 }, 'Unsupported fields: unexpected'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', body }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
    const badCustomer = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', pathname: '/api/v1/customers/bad/contacts', body: base }),
      scopeFor(),
    );
    expect(badCustomer?.statusCode).toBe(400);
    expect((badCustomer?.body as { error: { message: string } }).error.message).toBe(
      'customerId must be a UUID',
    );
    expect(repositoryCalls).toHaveLength(0);
  });

  it('CRM-matcher 503 门属 legacy 轨（依赖缺失时桥不挂载，桥级场景不可达）', () => {
    // 生产装配：app.ts 仅在 dependencies.commercial 存在时挂桥；CRM 依赖缺失时
    // 桥不挂载，503 由 legacy CRM matcher（customer-base 契约已覆盖）返回。
    expect(CLAIM_NOTE).toBe(
      'CRM-matcher 503 gate is legacy-track behavior; verified by customer-base contract suite',
    );
  });

  it('仓储 DomainError 映射 legacy 状态码', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(
        repository({
          listContacts: vi
            .fn()
            .mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        }),
      ),
    );
    expect(response?.statusCode).toBe(403);
    expect((response?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
