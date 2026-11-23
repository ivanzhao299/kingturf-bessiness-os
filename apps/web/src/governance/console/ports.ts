import type { AppRoute } from '../../shared/navigation';
import type { GovernanceController, GovernanceView } from '../controller';
import { normalizePage } from '@kingturf/ui';

// UI-M2（governance 控制台）：三页 Preact 重写的端口层——控制器能力到组件Props 的
// 最小面（页面不直接依赖 GovernanceController，便于行为测试注入 double）。
export type ConsolePageData = Readonly<{ items: readonly unknown[]; nextCursor: string | null }>;
// GOV-UX：控制台通用记录形状（各页局部 Row 别名与此同构，新增模块统一引用）。
export type ConsoleRow = Readonly<Record<string, unknown>>;

export type ConsolePorts = Readonly<{
  route: AppRoute;
  permissions: ReadonlySet<string>;
  /** 已加载的治理视图清单（概览仪表盘按 path 聚合指标与异常）。 */
  views: () => readonly GovernanceView[];
  /** surface 是否已加载（区分「空列表」与「无权限未加载」，C4 提示用）。 */
  loaded: (path: string) => boolean;
  /** 该 path 首屏读取的失败消息（未加载/未失败为 undefined）——派生视图据此如实降级。 */
  viewError: (path: string) => string | undefined;
  initialView: (path: string) => ConsolePageData;
  fetchPage: (
    path: string,
    params?: Readonly<Record<string, string | undefined>>,
  ) => Promise<ConsolePageData>;
  /** 单记录读取（GOV-UX ④：主数据条目按生效时点取历史版本 GET …/entries/{id}?at=）。 */
  fetchRecord: (path: string, params?: Readonly<Record<string, string>>) => Promise<ConsoleRow>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ) => Promise<void>;
}>;

export const consolePorts = (controller: GovernanceController, route: AppRoute): ConsolePorts => ({
  route,
  permissions: controller.permissions,
  views: () => controller.views,
  loaded: (path) => controller.views.some((item) => item.path === path),
  viewError: (path) => controller.views.find((item) => item.path === path)?.error,
  initialView: (path) =>
    normalizePage(controller.views.find((item) => item.path === path)?.value ?? null),
  fetchPage: (path, params) => controller.fetchPage(path, params),
  fetchRecord: (path, params) => controller.fetchPage<ConsoleRow>(path, params),
  submit: (path, payload, method) => controller.submit(path, payload, method),
});

// 与 identity-actions.ts 同口径的权限门（legacy authorization:manage 全放行）。
export const mayManageIdentity = (permissions: ReadonlySet<string>): boolean =>
  permissions.has('authorization:manage') || permissions.has('identity:manage');
export const mayManageAssignments = (permissions: ReadonlySet<string>): boolean =>
  permissions.has('authorization:manage') || permissions.has('role-assignment:manage');

export const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
export const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value !== '' ? value : fallback;
