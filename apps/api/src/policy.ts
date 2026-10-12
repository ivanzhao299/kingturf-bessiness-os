import { assertPermission, type AuthorizationContext } from '@kingturf/domain';
import { type DataScope, type PermissionKey } from '@kingturf/types';

export type AuthorizedQuery = Readonly<{
  context: AuthorizationContext;
  scopes: readonly DataScope[];
  anchors: readonly Readonly<{ scope: DataScope; organizationId: string | null }>[];
}>;
export function authorizeQuery(
  context: AuthorizationContext | null,
  capability: PermissionKey,
  fields: readonly string[] = [],
): AuthorizedQuery {
  const authorized = assertPermission(context, capability, fields);
  return {
    context: authorized,
    scopes: authorized.permissions.get(capability)?.scopes ?? [],
    anchors: authorized.scopeAnchors?.get(capability) ?? [],
  };
}
// 数据范围 SQL 谓词已收敛至 ./scope-sql.ts（批次 1a，TD-DUP-001）。
