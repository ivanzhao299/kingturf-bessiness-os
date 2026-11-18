import type { AppRoute } from '../shared/navigation';
import { hasPermissionPrefix } from '../shared/permission-prefix';
export type GovernanceSurface = Readonly<{
  id: string;
  title: string;
  description: string;
  readPermission: string;
  managePermission?: string;
  route: AppRoute;
  paths: readonly string[];
  disposition: 'USER_FACING' | 'SUPPORTING' | 'INTERNAL_ONLY';
}>;

export const GOVERNANCE_SURFACES: readonly GovernanceSurface[] = [
  {
    id: 'organizations',
    title: '组织架构',
    description: '公司、区域、部门与团队',
    readPermission: 'organization:read',
    managePermission: 'organization:create',
    route: 'governance/organization',
    paths: ['/api/v1/organizations'],
    disposition: 'USER_FACING',
  },
  {
    id: 'employees',
    title: '员工与身份基础',
    description: '员工归属与任职状态',
    readPermission: 'employee:read',
    managePermission: 'employee:create',
    route: 'governance/organization',
    paths: ['/api/v1/employees'],
    disposition: 'USER_FACING',
  },
  {
    id: 'identity-access',
    title: '身份、角色与授权',
    description: '角色、权限与数据范围',
    readPermission: 'authorization:read',
    managePermission: 'authorization:manage',
    route: 'governance/identity',
    paths: [
      '/api/v1/user-access-profiles',
      '/api/v1/roles',
      '/api/v1/permissions',
      '/api/v1/grants',
      '/api/v1/assignments',
      '/api/v1/scope-grants',
    ],
    disposition: 'USER_FACING',
  },
  {
    id: 'audit',
    title: '审计中心',
    description: '人员、操作与业务审计记录',
    readPermission: 'audit:read',
    route: 'governance/audit',
    paths: ['/api/v1/audit-events'],
    disposition: 'USER_FACING',
  },
  {
    id: 'master-data',
    title: '主数据',
    description: '业务分类、条目与生效版本',
    readPermission: 'master-data:read',
    managePermission: 'master-data:create',
    route: 'governance/master-data',
    paths: ['/api/v1/master-data/categories', '/api/v1/master-data/entries'],
    disposition: 'USER_FACING',
  },
  {
    id: 'numbering',
    title: '编号规则',
    description: '业务编号、版本与分配规则',
    readPermission: 'number:read',
    managePermission: 'number:create',
    route: 'governance/numbering',
    paths: ['/api/v1/number-definitions'],
    disposition: 'USER_FACING',
  },
  {
    id: 'rules',
    title: '业务规则',
    description: '规则版本、发布与试算',
    readPermission: 'rule:read',
    managePermission: 'rule:create',
    route: 'governance/rules',
    paths: ['/api/v1/rules'],
    disposition: 'USER_FACING',
  },
  {
    id: 'workflow',
    title: '工作流与待办',
    description: '流程定义与审批待办',
    readPermission: 'workflow:read',
    managePermission: 'workflow:create',
    route: 'governance/workflow',
    paths: ['/api/v1/workflows', '/api/v1/workflow-tasks'],
    disposition: 'USER_FACING',
  },
  {
    id: 'notifications',
    title: '通知中心',
    description: '消息通知与个人偏好',
    readPermission: 'notification:read',
    managePermission: 'notification:manage',
    route: 'governance/notifications',
    paths: [
      '/api/v1/notifications',
      '/api/v1/notifications/unread-count',
      '/api/v1/notification-preferences',
    ],
    disposition: 'USER_FACING',
  },
  {
    id: 'registry',
    title: '业务对象与附件',
    description: '业务对象定义与附件关联',
    readPermission: 'business-object:read',
    managePermission: 'business-object:manage',
    route: 'governance/system',
    paths: ['/api/v1/business-objects'],
    disposition: 'USER_FACING',
  },
  {
    id: 'event-operations',
    title: '事件运行状态',
    description: '事件积压、失败与运行状态',
    readPermission: 'event:operate',
    route: 'governance/system',
    paths: ['/api/v1/operations/events'],
    disposition: 'SUPPORTING',
  },
] as const;

// B1 路由注册表：surface 定义不重写，仅以 route 字段映射为子路由清单（菜单/可见性并集）。
export const GOVERNANCE_ROUTE_ORDER: readonly AppRoute[] = [
  'governance/identity',
  'governance/organization',
  'governance/audit',
  'governance/master-data',
  'governance/numbering',
  'governance/rules',
  'governance/workflow',
  'governance/notifications',
  'governance/system',
];

export const visibleGovernanceSurfaces = (permissions: ReadonlySet<string>) =>
  GOVERNANCE_SURFACES.filter(
    (surface) =>
      permissions.has(surface.readPermission) ||
      (surface.id === 'identity-access' &&
        hasPermissionPrefix(permissions, [
          'identity:',
          'role:',
          'permission:',
          'role-assignment:',
          'data-scope:',
        ])) ||
      (surface.managePermission !== undefined && permissions.has(surface.managePermission)),
  );

export const governanceSurfacesForRoute = (
  surfaces: readonly GovernanceSurface[],
  route: AppRoute,
) => surfaces.filter((surface) => surface.route === route);

// 概览路由 + 可见 surface 覆盖的子路由（菜单与路由注册的并集来源）。
export const governanceRoutes = (permissions: ReadonlySet<string>): readonly AppRoute[] => {
  const surfaces = visibleGovernanceSurfaces(permissions);
  if (surfaces.length === 0) return [];
  return [
    'governance',
    ...GOVERNANCE_ROUTE_ORDER.filter((route) =>
      surfaces.some((surface) => surface.route === route),
    ),
  ];
};
