// PROC-2（TD-PROC-010）：采购域子路由注册表。概览 #/procurement 之外，每个控制台独占一条
// 子路由；可见性取该控制台主数据源的读权限（与 readableCommercialSources 同口径：
// suppliers ← supplier:read；rfqs / purchase-orders / goods-receipts ← procurement:read），
// 不随概览路由的前缀规则一并放行。做法同 governance/surfaces.ts（surface → route → readPermission）。
import type { AppRoute } from '../shared/navigation';

export type ProcurementConsoleId = 'suppliers' | 'rfqs' | 'purchase-orders' | 'goods-receipts';

export type ProcurementSurface = Readonly<{
  id: ProcurementConsoleId;
  route: AppRoute;
  readPermission: string;
}>;

export const PROCUREMENT_SURFACES: readonly ProcurementSurface[] = [
  { id: 'suppliers', route: 'procurement/suppliers', readPermission: 'supplier:read' },
  { id: 'rfqs', route: 'procurement/rfqs', readPermission: 'procurement:read' },
  {
    id: 'purchase-orders',
    route: 'procurement/purchase-orders',
    readPermission: 'procurement:read',
  },
  { id: 'goods-receipts', route: 'procurement/goods-receipts', readPermission: 'procurement:read' },
];

export const visibleProcurementSurfaces = (
  permissions: ReadonlySet<string>,
): readonly ProcurementSurface[] =>
  PROCUREMENT_SURFACES.filter((surface) => permissions.has(surface.readPermission));

// 菜单与路由注册的并集来源（概览路由自身的可见性仍由 bootstrap 的前缀规则决定）。
export const procurementSubRoutes = (permissions: ReadonlySet<string>): readonly AppRoute[] =>
  visibleProcurementSurfaces(permissions).map((surface) => surface.route);
