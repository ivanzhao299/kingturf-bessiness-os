// MFG-3B（TD-MFG-003）：制造主数据域子路由注册表。概览 #/manufacturing-master 之外，每个
// 控制台独占一条子路由；可见性取该控制台主数据源的读权限，与 readableCommercialSources
// 同口径，并与读端点实际使用的权限串一致（已核对：GET /api/v1/manufacturing-items 及其
// /:itemId 详情 ← manufacturing-item:read；manufacturing-boms 及 /:bomId ← bom:read；
// manufacturing-routings 及 /:routingId ← routing:read）。概览路由自身的前缀规则
// （manufacturing-item: / bom: / routing:）不变，且不连带放行子路由。
// 做法同 procurement-surfaces.ts（surface → route → readPermission）。
import type { AppRoute } from '../shared/navigation';

export type ManufacturingConsoleId = 'items' | 'boms' | 'routings';

export type ManufacturingSurface = Readonly<{
  id: ManufacturingConsoleId;
  route: AppRoute;
  readPermission: string;
}>;

export const MANUFACTURING_SURFACES: readonly ManufacturingSurface[] = [
  { id: 'items', route: 'manufacturing/items', readPermission: 'manufacturing-item:read' },
  { id: 'boms', route: 'manufacturing/boms', readPermission: 'bom:read' },
  { id: 'routings', route: 'manufacturing/routings', readPermission: 'routing:read' },
];

export const visibleManufacturingSurfaces = (
  permissions: ReadonlySet<string>,
): readonly ManufacturingSurface[] =>
  MANUFACTURING_SURFACES.filter((surface) => permissions.has(surface.readPermission));

// 菜单与路由注册的并集来源（概览路由自身的可见性仍由 bootstrap 的前缀规则决定）。
export const manufacturingSubRoutes = (permissions: ReadonlySet<string>): readonly AppRoute[] =>
  visibleManufacturingSurfaces(permissions).map((surface) => surface.route);
