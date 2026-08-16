import { describe, expect, it, vi } from 'vitest';
import type {
  AuthorizationContext,
  AuthorizationRepository,
  EmployeeRepository,
  OrganizationRepository,
} from '@kingturf/domain';
import { DomainError } from '@kingturf/domain';
import type {
  Customer360Dto,
  CustomerDto,
  DataScope,
  EmployeeDto,
  OrganizationDto,
} from '@kingturf/types';
import { buildApp } from '../src/app.js';
import type { PostgresCrmRepository } from '../src/crm-repositories.js';
import type { PostgresCommissionRepository } from '../src/commission-repositories.js';
import type { PostgresOrder360Repository } from '../src/order-360-repositories.js';
import type { PostgresRiskRepository } from '../src/risk-repositories.js';
import type { PostgresDashboardRepository } from '../src/dashboard-repositories.js';
import type { AuthenticationService } from '../src/security.js';

const employeeId = '10000000-0000-4000-8000-000000000001';
const companyId = '20000000-0000-4000-8000-000000000002';
const targetId = '30000000-0000-4000-8000-000000000003';
const organizationId = '40000000-0000-4000-8000-000000000004';
const context = (permissions: AuthorizationContext['permissions']): AuthorizationContext => ({
  actor: { employeeId, companyId },
  permissions,
});
const grant = (
  capability: `${string}:${string}`,
  scopes: readonly DataScope[] = ['COMPANY'],
  fields: null | readonly string[] = null,
): AuthorizationContext['permissions'] => new Map([[capability, { scopes, fields }]]);
const organization: OrganizationDto = {
  id: organizationId,
  ownerOrganizationId: companyId,
  parentId: null,
  code: 'OPS',
  name: 'Operations',
  locale: 'zh-CN',
  currency: 'CNY',
  active: true,
  version: 1,
};
const employee: EmployeeDto = {
  id: targetId,
  companyId,
  organizationId,
  employeeNumber: 'E-1',
  displayName: 'Employee',
  email: 'employee@example.test',
  active: true,
  version: 1,
};

function dependencies(authContext: AuthorizationContext | null) {
  const logout = vi.fn(() => Promise.resolve());
  const auth = {
    authenticate: vi.fn(() => Promise.resolve(authContext)),
    login: vi.fn(() => Promise.resolve({ token: 'opaque', expiresAt: new Date().toISOString() })),
    logout,
    changePassword: vi.fn(() => Promise.resolve()),
  } as unknown as AuthenticationService;
  const organizations = {
    create: vi.fn(() => Promise.resolve(organization)),
    findById: vi.fn(() => Promise.resolve(organization)),
    list: vi.fn(() => Promise.resolve([organization])),
    update: vi.fn(() => Promise.resolve(organization)),
  } satisfies OrganizationRepository;
  const employees = {
    create: vi.fn(() => Promise.resolve(employee)),
    findById: vi.fn(() => Promise.resolve(employee)),
    list: vi.fn(() => Promise.resolve([employee])),
    update: vi.fn(() => Promise.resolve(employee)),
  } satisfies EmployeeRepository;
  const assign = vi.fn(() => Promise.resolve());
  const grantPermission = vi.fn(() => Promise.resolve());
  const grantScope = vi.fn(() =>
    Promise.resolve({
      id: targetId,
      employeeId,
      permissionId: organizationId,
      scope: 'TEAM' as const,
      organizationId,
    }),
  );
  const authorization = {
    listRoles: vi.fn(() => Promise.resolve([])),
    createRole: vi.fn(() =>
      Promise.resolve({
        id: targetId,
        organizationId: companyId,
        code: 'ADMIN',
        name: 'Admin',
        version: 1,
      }),
    ),
    listPermissions: vi.fn(() => Promise.resolve([])),
    createPermission: vi.fn(),
    listGrants: vi.fn(() => Promise.resolve([])),
    grant: grantPermission,
    revoke: vi.fn(() => Promise.resolve()),
    listAssignments: vi.fn(() => Promise.resolve([])),
    assign,
    unassign: vi.fn(() => Promise.resolve()),
    listScopeGrants: vi.fn(() => Promise.resolve([])),
    grantScope,
    revokeScope: vi.fn(() => Promise.resolve()),
  } as unknown as AuthorizationRepository;
  const crmAssign = vi.fn(() => Promise.resolve({ id: targetId }));
  const crmCustomer360 = vi.fn<() => Promise<Customer360Dto>>(() =>
    Promise.resolve({
      customer: {
        id: targetId,
        tenantId: companyId,
        customerNumber: 'C-1',
        name: 'Customer',
        normalizedName: 'customer',
        status: 'ACTIVE',
        ownerId: null,
        ownerOrganizationId: null,
        tags: [],
        version: 1,
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
      contacts: [],
      ownership: [],
      leads: [],
      activities: [],
      unavailableSections: ['orders', 'finance'],
    }),
  );
  const crmClaimLead = vi.fn<() => Promise<Record<string, unknown>>>(() =>
    Promise.resolve({ id: targetId, status: 'CLAIMED' }),
  );
  const crmTransitionLead = vi.fn(() => Promise.resolve({ id: targetId }));
  const crmListCustomers = vi.fn(() => Promise.resolve<CustomerDto[]>([]));
  const crmCreateActivity = vi.fn(() => Promise.resolve({ id: targetId }));
  const crmCreateContact = vi.fn(() => Promise.resolve({ id: targetId }));
  const crm = {
    listCustomers: crmListCustomers,
    findCustomer: vi.fn(() => Promise.resolve({ id: targetId, name: 'Customer' })),
    createCustomer: vi.fn(() => Promise.resolve({ id: targetId })),
    transitionCustomer: vi.fn(() => Promise.resolve({ id: targetId })),
    createContact: crmCreateContact,
    listLeads: vi.fn(() => Promise.resolve([])),
    createLead: vi.fn(() => Promise.resolve({ id: targetId })),
    claimLead: crmClaimLead,
    transitionLead: crmTransitionLead,
    assign: crmAssign,
    createActivity: crmCreateActivity,
    customer360: crmCustomer360,
  } as unknown as PostgresCrmRepository;
  const commissionAccrue = vi.fn(() =>
    Promise.resolve({ id: targetId, effectiveState: 'FROZEN', commissionAmount: '300' }),
  );
  const commissionTransition = vi.fn(() =>
    Promise.resolve({ id: targetId, state: 'RELEASED', amount: '0' }),
  );
  const commissions = {
    listPolicies: vi.fn(() => Promise.resolve([])),
    createPolicy: vi.fn(() => Promise.resolve({ id: targetId, status: 'PUBLISHED' })),
    createPolicyVersion: vi.fn(() => Promise.resolve({ id: targetId, status: 'DRAFT' })),
    publishPolicyVersion: vi.fn(() => Promise.resolve({ id: targetId, status: 'PUBLISHED' })),
    listCases: vi.fn(() => Promise.resolve([])),
    accrue: commissionAccrue,
    transition: commissionTransition,
  } as unknown as PostgresCommissionRepository;
  const order360Get = vi.fn(() =>
    Promise.resolve({
      order: { id: targetId, order_number: 'SO-1', total: '950000', canonical_hash: 'secret' },
      customer: { id: organizationId, name: 'Customer' },
      quote: { id: employeeId, quoteNumber: 'Q-1' },
      receivables: [{ id: targetId, remaining_amount: '0' }],
      anomalies: [],
      timeline: [
        { type: 'ORDER_RELEASED', label: 'SO-1' },
        { type: 'QUOTE_ISSUED', label: 'Q-1' },
      ],
    }),
  );
  const order360 = { get: order360Get } as unknown as PostgresOrder360Repository;
  const riskEvaluate = vi.fn(() =>
    Promise.resolve({ id: targetId, severity: 'HIGH', score: 45, taskId: organizationId }),
  );
  const riskTransition = vi.fn(() =>
    Promise.resolve({ taskId: targetId, state: 'CLOSED', eventId: organizationId }),
  );
  const risks = {
    listPolicies: vi.fn(() => Promise.resolve([])),
    listEvaluations: vi.fn(() => Promise.resolve([])),
    createPolicy: vi.fn(() => Promise.resolve({ id: targetId, status: 'PUBLISHED' })),
    createPolicyVersion: vi.fn(() => Promise.resolve({ id: targetId, status: 'DRAFT' })),
    publishPolicyVersion: vi.fn(() => Promise.resolve({ id: targetId, status: 'PUBLISHED' })),
    evaluate: riskEvaluate,
    transitionTask: riskTransition,
  } as unknown as PostgresRiskRepository;
  const dashboardGet = vi.fn(() =>
    Promise.resolve({
      filters: { from: '2026-01-01', to: '2027-01-01', currency: 'CNY' },
      refreshedAt: '2026-08-16T00:00:00.000Z',
      metrics: {
        bookedRevenue: { value: '950000', source: 'sales_orders' },
        openReceivable: { value: '0', source: 'ar_open_item_balances' },
        activeRisks: { value: 1, source: 'risk_evaluations' },
      },
      drilldowns: { orders: [{ id: targetId }], overdue: [], risks: [{ id: organizationId }] },
    }),
  );
  const dashboard = { get: dashboardGet } as unknown as PostgresDashboardRepository;
  return {
    auth,
    organizations,
    employees,
    authorization,
    crm,
    commissions,
    order360,
    risks,
    dashboard,
    dashboardGet,
    riskEvaluate,
    riskTransition,
    order360Get,
    commissionAccrue,
    commissionTransition,
    crmAssign,
    crmCustomer360,
    crmClaimLead,
    crmTransitionLead,
    crmListCustomers,
    crmCreateActivity,
    crmCreateContact,
    assign,
    grantPermission,
    grantScope,
    logout,
  };
}
const dispatch = (
  deps: ReturnType<typeof dependencies>,
  method: string,
  pathname: string,
  body?: unknown,
  correlationId?: string,
  idempotencyKey?: string,
) =>
  buildApp(deps).dispatch({
    method,
    pathname,
    headers: {
      authorization: 'Bearer opaque',
      'x-correlation-id': correlationId,
      'idempotency-key': idempotencyKey,
    },
    body,
  });

describe('authentication and protected API contracts', () => {
  it('supports login, session validation, and logout', async () => {
    const deps = dependencies(context(new Map()));
    expect(
      (
        await buildApp(deps).dispatch({
          method: 'POST',
          pathname: '/api/v1/auth/login',
          body: { login: 'admin', password: 'correct-password' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await dispatch(deps, 'GET', '/api/v1/auth/session')).body).toEqual({
      employeeId,
      companyId,
      permissions: [],
    });
    expect((await dispatch(deps, 'POST', '/api/v1/auth/logout')).statusCode).toBe(204);
    expect(deps.logout).toHaveBeenCalledWith(
      'opaque',
      expect.anything(),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
  });
  it('rejects missing/invalid sessions and defaults to deny', async () => {
    const missing = dependencies(null);
    expect(
      (await buildApp(missing).dispatch({ method: 'GET', pathname: '/api/v1/employees' }))
        .statusCode,
    ).toBe(401);
    const denied = dependencies(context(new Map()));
    expect((await dispatch(denied, 'GET', '/api/v1/employees')).statusCode).toBe(403);
    expect(denied.employees.list).not.toHaveBeenCalled();
  });
});

describe('CRM HTTP contracts', () => {
  it('rejects blank and malformed contact identities before persistence', async () => {
    const deps = dependencies(context(grant('customer:update', ['COMPANY'], ['contacts'])));
    for (const body of [
      { name: 'Blank', email: '   ', phone: null },
      { name: 'Bad email', email: 'not-an-email', phone: null },
      { name: 'Bad phone', email: null, phone: '++--' },
      { name: 'Phone letters', email: null, phone: 'call 1234567' },
      { name: 'Missing', email: null, phone: null },
      { name: 'Wrong type', email: 42, phone: '+12025550100' },
    ])
      expect(
        (await dispatch(deps, 'POST', `/api/v1/customers/${targetId}/contacts`, body)).statusCode,
      ).toBe(400);
    expect(deps.crmCreateContact).not.toHaveBeenCalled();

    const valid = await dispatch(deps, 'POST', `/api/v1/customers/${targetId}/contacts`, {
      name: 'Buyer',
      email: ' Buyer@Example.TEST ',
      phone: '+86 138-0013-8000',
    });
    expect(valid.statusCode).toBe(201);
    expect(deps.crmCreateContact).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({ email: 'buyer@example.test', phone: '+8613800138000' }),
      expect.anything(),
      expect.anything(),
      ['COMPANY'],
      [],
    );
  });
  it('requires the distinct customer reassignment capability', async () => {
    const assignOnly = dependencies(context(grant('customer-ownership:assign')));
    const request = {
      assigneeId: targetId,
      expectedVersion: 1,
      reason: 'territory change',
      reassignment: true,
    };
    expect(
      (await dispatch(assignOnly, 'POST', `/api/v1/customers/${targetId}/ownership`, request))
        .statusCode,
    ).toBe(403);
    expect(assignOnly.crmAssign).not.toHaveBeenCalled();

    const reassign = dependencies(context(grant('customer-ownership:reassign', ['TEAM'])));
    expect(
      (await dispatch(reassign, 'POST', `/api/v1/customers/${targetId}/ownership`, request))
        .statusCode,
    ).toBe(200);
    expect(reassign.crmAssign).toHaveBeenCalledWith(
      'CUSTOMER',
      targetId,
      targetId,
      1,
      'territory change',
      expect.anything(),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      true,
      ['TEAM'],
      [],
    );
  });

  it('passes independent read grants and DataScopes into Customer 360 sections', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['customer:read', { scopes: ['COMPANY'], fields: null }],
      ['customer-360:read', { scopes: ['COMPANY'], fields: null }],
      ['customer-ownership:read', { scopes: ['SELF'], fields: null }],
      ['lead:read', { scopes: ['TEAM'], fields: null }],
    ]);
    const deps = dependencies(context(permissions));
    expect((await dispatch(deps, 'GET', `/api/v1/customers/${targetId}/360`)).statusCode).toBe(200);
    expect(deps.crmCustomer360).toHaveBeenCalledWith(
      targetId,
      expect.anything(),
      ['COMPANY'],
      [],
      { email: true, phone: true },
      {
        ownership: { scopes: ['SELF'], anchors: [] },
        leads: { scopes: ['TEAM'], anchors: [] },
      },
    );
  });

  it('intersects Customer 360 identity fields with the base customer read grant', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['customer:read', { scopes: ['COMPANY'], fields: ['name'] }],
      ['customer-360:read', { scopes: ['COMPANY'], fields: null }],
    ]);
    const deps = dependencies(context(permissions));
    deps.crmCustomer360.mockResolvedValue({
      customer: {
        id: targetId,
        tenantId: companyId,
        name: 'Customer',
        normalizedName: 'customer',
        customerNumber: 'C-SECRET',
        status: 'ACTIVE',
        ownerId: employeeId,
        ownerOrganizationId: organizationId,
        tags: [],
        version: 1,
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
      contacts: [],
      ownership: [],
      leads: [],
      activities: [],
      unavailableSections: ['orders', 'finance'],
    });
    const response = await dispatch(deps, 'GET', `/api/v1/customers/${targetId}/360`);
    expect(response.statusCode).toBe(200);
    expect((response.body as { customer: unknown }).customer).toEqual({
      id: targetId,
      name: 'Customer',
    });
  });

  it('rejects malformed activity timestamps at the HTTP boundary', async () => {
    const deps = dependencies(context(grant('customer-activity:create')));
    const response = await buildApp(deps).dispatch({
      method: 'POST',
      pathname: `/api/v1/customers/${targetId}/activities`,
      headers: {
        authorization: 'Bearer opaque',
        'idempotency-key': 'invalid-activity-time',
      },
      body: {
        leadId: null,
        type: 'CALL',
        occurredAt: 'not-a-timestamp',
        summary: 'Call',
        details: {},
      },
    });
    expect(response.statusCode).toBe(400);
    expect(deps.crmCreateActivity).not.toHaveBeenCalled();
  });

  it('validates pool claims and forwards the idempotency contract', async () => {
    const deps = dependencies(context(grant('lead-pool:claim', ['SELF'])));
    expect(
      (
        await dispatch(deps, 'POST', `/api/v1/leads/${targetId}/claim`, {
          expectedVersion: 1,
        })
      ).statusCode,
    ).toBe(400);
    expect(deps.crmClaimLead).not.toHaveBeenCalled();
    const response = await buildApp(deps).dispatch({
      method: 'POST',
      pathname: `/api/v1/leads/${targetId}/claim`,
      headers: { authorization: 'Bearer opaque', 'idempotency-key': 'claim-1' },
      body: { expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.crmClaimLead).toHaveBeenCalledWith(
      targetId,
      1,
      expect.anything(),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      'claim-1',
      ['SELF'],
      [],
    );
  });

  it('restricts pool release to claimed leads at the repository boundary', async () => {
    const deps = dependencies(context(grant('lead-pool:release', ['TEAM'])));
    const response = await dispatch(deps, 'POST', `/api/v1/leads/${targetId}/release`, {
      expectedVersion: 2,
      reason: 'Return to pool',
    });
    expect(response.statusCode).toBe(200);
    expect(deps.crmTransitionLead).toHaveBeenCalledWith(
      targetId,
      'POOL',
      2,
      'Return to pool',
      expect.anything(),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      ['TEAM'],
      [],
      'CLAIMED',
    );
  });

  it('projects allowed fields and maps repository conflicts to HTTP 409', async () => {
    const projected = dependencies(context(grant('customer:read', ['COMPANY'], ['name'])));
    projected.crmListCustomers.mockResolvedValue([
      {
        id: targetId,
        tenantId: companyId,
        customerNumber: 'C-1',
        name: 'Visible name',
        normalizedName: 'visible name',
        status: 'PROSPECT',
        ownerId: null,
        ownerOrganizationId: null,
        tags: [],
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const list = await dispatch(projected, 'GET', '/api/v1/customers');
    expect(list.statusCode).toBe(200);
    expect(list.body).toEqual({
      items: [{ id: targetId, name: 'Visible name' }],
      nextCursor: null,
    });

    const conflict = dependencies(context(grant('customer-ownership:assign')));
    conflict.crmAssign.mockRejectedValue(
      new DomainError('conflict', 'Subject is already assigned'),
    );
    const response = await dispatch(conflict, 'POST', `/api/v1/customers/${targetId}/ownership`, {
      assigneeId: targetId,
      expectedVersion: 1,
      reason: 'duplicate',
      reassignment: false,
    });
    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({ error: { code: 'conflict' } });
  });

  it('returns only command identity when an action grant has no read grant', async () => {
    const deps = dependencies(context(grant('lead-pool:claim', ['SELF'])));
    deps.crmClaimLead.mockResolvedValue({
      id: targetId,
      tenantId: companyId,
      customerId: null,
      title: 'Secret lead',
      source: 'private campaign',
      status: 'CLAIMED',
      ownerId: employeeId,
      ownerOrganizationId: organizationId,
      version: 2,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    });
    const response = await buildApp(deps).dispatch({
      method: 'POST',
      pathname: `/api/v1/leads/${targetId}/claim`,
      headers: { authorization: 'Bearer opaque', 'idempotency-key': 'claim-projected' },
      body: { expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: targetId, version: 2 });
  });

  it('projects create responses when write grants have no matching read grant', async () => {
    const customerDeps = dependencies(context(grant('customer:create')));
    const customer = await dispatch(customerDeps, 'POST', '/api/v1/customers', {
      name: 'Secret customer',
      customerNumber: 'C-PRIVATE',
      tags: ['restricted'],
    });
    expect(customer.statusCode).toBe(201);
    expect(customer.body).toEqual({ id: targetId });

    const leadDeps = dependencies(context(grant('lead:create')));
    const lead = await dispatch(leadDeps, 'POST', '/api/v1/leads', {
      title: 'Secret lead',
      source: 'private',
      customerId: null,
      pool: true,
    });
    expect(lead.statusCode).toBe(201);
    expect(lead.body).toEqual({ id: targetId });
  });
});

describe('organization and employee tenant boundaries', () => {
  it('exercises organization create and tenant-qualified read', async () => {
    const createDeps = dependencies(context(grant('organization:create')));
    expect(
      (
        await dispatch(createDeps, 'POST', '/api/v1/organizations', {
          code: 'OPS',
          name: 'Operations',
        })
      ).statusCode,
    ).toBe(201);
    expect(createDeps.organizations.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerOrganizationId: companyId, currency: 'CNY', locale: 'zh-CN' }),
      expect.objectContaining({ companyId }),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
    const readDeps = dependencies(context(grant('organization:read')));
    await dispatch(readDeps, 'GET', `/api/v1/organizations/${organizationId}`);
    expect(readDeps.organizations.findById).toHaveBeenCalledWith(organizationId, companyId);
  });
  it('passes update DataScope through and enforces field allowlists', async () => {
    const deps = dependencies(context(grant('employee:update', ['SELF'], ['displayName'])));
    expect(
      (
        await dispatch(deps, 'PATCH', `/api/v1/employees/${targetId}`, {
          displayName: 'New name',
          version: 1,
        })
      ).statusCode,
    ).toBe(200);
    expect(deps.employees.update).toHaveBeenCalledWith(
      targetId,
      companyId,
      expect.anything(),
      1,
      expect.anything(),
      ['SELF'],
      [],
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
    expect(
      (
        await dispatch(deps, 'PATCH', `/api/v1/employees/${targetId}`, {
          organizationId,
          version: 1,
        })
      ).statusCode,
    ).toBe(403);
  });
  it.each([{}, { version: '1' }, { version: 0 }, { version: 1.2 }])(
    'returns 400 for an invalid PATCH version %#',
    async (body) => {
      const deps = dependencies(context(grant('employee:update')));
      expect(
        (await dispatch(deps, 'PATCH', `/api/v1/employees/${targetId}`, body)).statusCode,
      ).toBe(400);
      expect(deps.employees.update).not.toHaveBeenCalled();
    },
  );
  it('replaces a malformed caller correlation ID with an audit-safe UUID', async () => {
    const deps = dependencies(context(new Map()));
    const response = await dispatch(deps, 'GET', '/api/v1/employees', undefined, 'not-a-uuid');
    expect(response.statusCode).toBe(403);
    expect((response.body as { error: { correlationId: string } }).error.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/u,
    );
    expect((response.body as { error: { correlationId: string } }).error.correlationId).not.toBe(
      'not-a-uuid',
    );
  });
});

describe('authorization management API', () => {
  it('defaults role assignment management to deny', async () => {
    const deps = dependencies(context(new Map()));
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/assignments', {
          employeeId,
          targetId,
          roleId: organizationId,
        })
      ).statusCode,
    ).toBe(403);
    expect(deps.assign).not.toHaveBeenCalled();
  });
  it('secures and correlates role grants and assignments', async () => {
    const deps = dependencies(context(grant('authorization:manage')));
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/grants', {
          roleId: organizationId,
          permissionId: targetId,
          scopes: ['SELF'],
        })
      ).statusCode,
    ).toBe(204);
    expect(deps.grantPermission).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: organizationId, permissionId: targetId, scopes: ['SELF'] }),
      expect.objectContaining({ companyId }),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/assignments', {
          employeeId: targetId,
          roleId: organizationId,
        })
      ).statusCode,
    ).toBe(204);
    expect(deps.assign).toHaveBeenCalledWith(
      targetId,
      organizationId,
      expect.objectContaining({ companyId }),
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
  });
  it('validates and secures direct typed scope grants', async () => {
    const deps = dependencies(context(grant('authorization:manage')));
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/scope-grants', {
          employeeId,
          permissionId: organizationId,
          scope: 'TEAM',
          organizationId,
        })
      ).statusCode,
    ).toBe(201);
    expect(deps.grantScope).toHaveBeenCalledWith(
      { employeeId, permissionId: organizationId, scope: 'TEAM', organizationId },
      expect.objectContaining({ companyId }),
      expect.any(String),
    );
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/scope-grants', {
          employeeId,
          permissionId: organizationId,
          scope: 'TEAM',
        })
      ).statusCode,
    ).toBe(400);
  });
  it('rejects malformed UUIDs and unexpected administration fields', async () => {
    const deps = dependencies(context(grant('authorization:manage')));
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/assignments', {
          employeeId: 'not-a-uuid',
          roleId: organizationId,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await dispatch(deps, 'POST', '/api/v1/roles', {
          code: 'ADMIN',
          name: 'Admin',
          organizationId: companyId,
        })
      ).statusCode,
    ).toBe(400);
  });
  it('authorizes server-derived commission accrual and ledger transitions', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['commission:accrue', { scopes: ['COMPANY'] as const, fields: null }],
      ['commission:read', { scopes: ['COMPANY'] as const, fields: null }],
      ['commission:manage', { scopes: ['COMPANY'] as const, fields: null }],
    ]);
    const deps = dependencies(context(permissions));
    const accrued = await dispatch(
      deps,
      'POST',
      '/api/v1/commissions/accrue',
      {
        salesOrderId: targetId,
        beneficiaryEmployeeId: employeeId,
        policyVersionId: organizationId,
        accountingPeriod: '2026-08',
      },
      undefined,
      'commission-accrue',
    );
    expect(accrued.statusCode).toBe(201);
    expect(deps.commissionAccrue).toHaveBeenCalledWith(
      {
        salesOrderId: targetId,
        beneficiaryEmployeeId: employeeId,
        policyVersionId: organizationId,
        accountingPeriod: '2026-08',
      },
      expect.any(String),
      expect.any(Object),
      expect.any(String),
    );
    const released = await dispatch(
      deps,
      'POST',
      `/api/v1/commissions/${targetId}/release`,
      { reason: 'Collection threshold reached' },
      undefined,
      'commission-release',
    );
    expect(released.statusCode).toBe(201);
    expect(deps.commissionTransition).toHaveBeenCalledWith(
      targetId,
      { state: 'RELEASED', reason: 'Collection threshold reached', externalReference: null },
      expect.any(String),
      expect.any(Object),
      expect.any(String),
    );
    expect(
      (
        await dispatch(
          dependencies(context(grant('commission:read'))),
          'POST',
          '/api/v1/commissions/accrue',
          {
            salesOrderId: targetId,
            beneficiaryEmployeeId: employeeId,
            policyVersionId: organizationId,
            accountingPeriod: '2026-08',
          },
          undefined,
          'commission-denied',
        )
      ).statusCode,
    ).toBe(403);
  });
  it('keeps Order 360 sections and fields bounded by their source permissions', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['order-360:read', { scopes: ['COMPANY'] as const, fields: null }],
      ['sales-order:read', { scopes: ['SELF'] as const, fields: ['order_number', 'total'] }],
      ['quote:read', { scopes: ['COMPANY'] as const, fields: ['quoteNumber'] }],
    ]);
    const deps = dependencies(context(permissions));
    const response = await dispatch(deps, 'GET', `/api/v1/sales-orders/${targetId}/360`, undefined);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      order: { id: targetId, order_number: 'SO-1', total: '950000' },
      quote: { id: employeeId, quoteNumber: 'Q-1' },
      timeline: [
        { type: 'ORDER_RELEASED', label: 'SO-1' },
        { type: 'QUOTE_ISSUED', label: 'Q-1' },
      ],
    });
    expect(response.body).not.toHaveProperty('customer');
    expect(response.body).not.toHaveProperty('receivables');
    expect((response.body as { order: Record<string, unknown> }).order).not.toHaveProperty(
      'canonical_hash',
    );
    expect(deps.order360Get).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({ scopes: ['SELF'] }),
    );
  });
  it('authorizes server-derived risk evaluation and evidence-backed task closure', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['risk:evaluate', { scopes: ['TEAM'] as const, fields: null }],
      ['risk:manage', { scopes: ['TEAM'] as const, fields: null }],
      ['risk:read', { scopes: ['TEAM'] as const, fields: null }],
    ]);
    const deps = dependencies(context(permissions));
    const evaluated = await dispatch(
      deps,
      'POST',
      '/api/v1/risk-evaluations',
      {
        salesOrderId: targetId,
        policyVersionId: organizationId,
        assigneeEmployeeId: employeeId,
        validUntil: '2026-09-16T00:00:00.000Z',
        dueAt: '2026-08-20T00:00:00.000Z',
      },
      undefined,
      'risk-evaluate',
    );
    expect(evaluated.statusCode).toBe(201);
    expect(deps.riskEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ salesOrderId: targetId, policyVersionId: organizationId }),
      expect.any(String),
      expect.objectContaining({ scopes: ['TEAM'] }),
      expect.any(String),
    );
    const closed = await dispatch(
      deps,
      'POST',
      `/api/v1/risk-tasks/${targetId}/close`,
      { reason: 'Approved exception archived', evidence: { ticket: 'RISK-1' } },
      undefined,
      'risk-close',
    );
    expect(closed.statusCode).toBe(201);
    expect(deps.riskTransition).toHaveBeenCalledWith(
      targetId,
      { state: 'CLOSED', reason: 'Approved exception archived', evidence: { ticket: 'RISK-1' } },
      expect.any(String),
      expect.objectContaining({ scopes: ['TEAM'] }),
      expect.any(String),
    );
    expect(
      (
        await dispatch(
          dependencies(context(grant('risk:read'))),
          'POST',
          '/api/v1/risk-evaluations',
          {
            salesOrderId: targetId,
            policyVersionId: organizationId,
            assigneeEmployeeId: employeeId,
            validUntil: '2026-09-16T00:00:00.000Z',
            dueAt: '2026-08-20T00:00:00.000Z',
          },
          undefined,
          'risk-denied',
        )
      ).statusCode,
    ).toBe(403);
  });
  it('keeps executive metrics and drilldowns bounded by source permissions', async () => {
    const permissions: AuthorizationContext['permissions'] = new Map([
      ['executive-dashboard:read', { scopes: ['TEAM'] as const, fields: null }],
      ['sales-order:read', { scopes: ['COMPANY'] as const, fields: null }],
      ['risk:read', { scopes: ['COMPANY'] as const, fields: null }],
    ]);
    const deps = dependencies(context(permissions));
    const response = await buildApp(deps).dispatch({
      method: 'GET',
      pathname: '/api/v1/executive-dashboard',
      query: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2027-01-01T00:00:00.000Z',
        currency: 'CNY',
      },
      headers: { authorization: 'Bearer opaque' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      metrics: { bookedRevenue: { value: '950000' }, activeRisks: { value: 1 } },
      drilldowns: { orders: [{ id: targetId }], risks: [{ id: organizationId }] },
    });
    expect(response.body).not.toHaveProperty('metrics.openReceivable');
    expect(response.body).not.toHaveProperty('drilldowns.overdue');
    expect(deps.dashboardGet).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'CNY' }),
      expect.objectContaining({ scopes: ['TEAM'] }),
    );
  });
});
