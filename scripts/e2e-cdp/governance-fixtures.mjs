// Synthetic local-only governance reads. Never log records or use a real API/account.
export const governancePermissions = [
  'organization:read',
  'employee:read',
  'authorization:read',
  'audit:read',
  'master-data:read',
  'number:read',
  'rule:read',
  'workflow:read',
  'notification:read',
  'business-object:read',
  'event:operate',
];
export const governanceSurfaces = [
  ['organizations', '组织架构'],
  ['employees', '员工与身份基础'],
  ['identity-access', '身份、角色与授权'],
  ['audit', '审计中心'],
  ['master-data', '主数据'],
  ['numbering', '编号规则'],
  ['rules', '业务规则'],
  ['workflow', '工作流与待办'],
  ['notifications', '通知中心'],
  ['registry', '业务对象与附件'],
  ['event-operations', '事件运行状态'],
];
const organizations = Array.from({ length: 12 }, (_, index) => ({
  id: `governance-org-${String(index + 1).padStart(2, '0')}`,
  code: `CDP-GOV-${String(index + 1).padStart(2, '0')}`,
  name: `CDP治理组织${String(index + 1).padStart(2, '0')}`,
  active: index !== 11,
  version: index + 1,
}));
const employees = [
  {
    id: 'gov-employee-a',
    employeeNumber: 'CDP-GOV-EMP-A',
    displayName: 'CDP治理员工甲',
    active: true,
  },
  {
    id: 'gov-employee-b',
    employeeNumber: 'CDP-GOV-EMP-B',
    displayName: 'CDP治理员工乙',
    active: false,
  },
];
const values = new Map([
  ['/api/v1/organizations', organizations],
  ['/api/v1/employees', employees],
  [
    '/api/v1/user-access-profiles',
    employees.map((employee, index) => ({
      employeeId: employee.id,
      identityId: `gov-identity-${String(index)}`,
      displayName: employee.displayName,
      loginName: `cdp-governance-${String(index)}`,
      employeeActive: employee.active,
      identityActive: employee.active,
      activeSessionCount: index === 0 ? 1 : 0,
      roles: [{ code: 'CDP-GOV-ROLE' }],
      capabilities: ['organization:read'],
      directScopes: [],
    })),
  ],
  [
    '/api/v1/roles',
    [
      { id: 'gov-role-a', code: 'CDP-GOV-ROLE-A', name: 'CDP治理只读角色甲' },
      { id: 'gov-role-b', code: 'CDP-GOV-ROLE-B', name: 'CDP治理只读角色乙' },
    ],
  ],
  [
    '/api/v1/permissions',
    [
      { id: 'gov-permission-a', capability: 'organization:read' },
      { id: 'gov-permission-b', capability: 'audit:read' },
    ],
  ],
  [
    '/api/v1/grants',
    [{ roleId: 'gov-role-a', permissionId: 'gov-permission-a', scopes: ['COMPANY'] }],
  ],
  ['/api/v1/assignments', [{ employeeId: 'gov-employee-a', roleId: 'gov-role-a', active: true }]],
  ['/api/v1/scope-grants', [{ id: 'gov-scope-a', employeeId: 'gov-employee-a', scope: 'SELF' }]],
  [
    '/api/v1/audit-events',
    Array.from({ length: 10 }, (_, index) => ({
      occurredAt: '2026-01-01T00:00:00.000Z',
      action: `CDP-GOV-ACTION-${String(index + 1).padStart(2, '0')}`,
      actorId: 'CDP-GOV-ACTOR',
      targetType: 'CDP-GOV-TARGET',
      targetId: `gov-target-${String(index + 1)}`,
      correlationId: `CDP-CORR-${String(index + 1).padStart(2, '0')}`,
      outcome: index % 2 === 0 ? 'FAILURE' : 'SUCCESS',
    })),
  ],
  [
    '/api/v1/master-data/categories',
    [{ id: 'gov-category-a', code: 'CDP-GOV-CATEGORY', name: 'CDP治理分类', version: 1 }],
  ],
  [
    '/api/v1/master-data/entries',
    [
      {
        id: 'gov-entry-a',
        code: 'CDP-GOV-ENTRY-A',
        label: 'CDP治理条目甲',
        active: true,
        version: 2,
      },
      {
        id: 'gov-entry-b',
        code: 'CDP-GOV-ENTRY-B',
        label: 'CDP治理条目乙',
        active: false,
        version: 3,
      },
    ],
  ],
  [
    '/api/v1/number-definitions',
    [{ id: 'gov-number-a', code: 'CDP-GOV-NUMBER', status: 'DRAFT', version: 1 }],
  ],
  ['/api/v1/rules', [{ id: 'gov-rule-a', code: 'CDP-GOV-RULE', status: 'DRAFT', version: 1 }]],
  [
    '/api/v1/workflows',
    [{ id: 'gov-workflow-a', code: 'CDP-GOV-WORKFLOW', status: 'PUBLISHED', version: 2 }],
  ],
  [
    '/api/v1/workflow-tasks',
    [
      { id: 'gov-task-a', stepKey: 'CDP-GOV-APPROVAL', state: 'PENDING', version: 3 },
      { id: 'gov-task-b', stepKey: 'CDP-GOV-COMPLETED', state: 'COMPLETED', version: 2 },
      { id: 'gov-task-c', stepKey: 'CDP-GOV-REJECTED', state: 'REJECTED', version: 4 },
    ],
  ],
  [
    '/api/v1/notifications',
    [
      { id: 'gov-notice-a', title: 'CDP治理通知甲', state: 'UNREAD', channel: 'IN_APP' },
      { id: 'gov-notice-b', title: 'CDP治理通知乙', state: 'READ', channel: 'EMAIL' },
    ],
  ],
  ['/api/v1/notifications/unread-count', { unreadCount: 3 }],
  [
    '/api/v1/notification-preferences',
    [
      { channel: 'EMAIL', enabled: false, version: 2 },
      { channel: 'FEISHU', enabled: true, version: 3 },
    ],
  ],
  [
    '/api/v1/business-objects',
    [{ id: 'gov-object-a', code: 'CDP-GOV-OBJECT', name: 'CDP治理对象', version: 1 }],
  ],
  [
    '/api/v1/operations/events',
    [
      {
        id: 'gov-event-a',
        eventType: 'CDP-GOV-EVENT',
        status: 'FAILED',
        attemptCount: 2,
        lastErrorCode: 'CDP-GOV-RETRY',
      },
    ],
  ],
]);
export const governancePaths = [...values.keys()];

export function withGovernanceView(router) {
  const counts = new Map();
  return {
    ...router,
    counts: () => ({ ...router.counts(), ...Object.fromEntries(counts) }),
    async respond(pathname, method, parameters = new URLSearchParams()) {
      if (values.has(pathname)) {
        if (method !== 'GET' || parameters.toString() !== '')
          throw new Error('unmapped synthetic governance request');
        if (pathname === '/api/v1/organizations')
          await router.respond(pathname, method, parameters);
        const key = `governance:${pathname}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return { completion: null, status: 200, value: values.get(pathname) };
      }
      const response = await router.respond(pathname, method, parameters);
      if (pathname === '/api/v1/auth/session' && response.status === 200)
        return {
          ...response,
          value: {
            ...response.value,
            permissions: [...new Set([...response.value.permissions, ...governancePermissions])],
          },
        };
      return response;
    },
  };
}
