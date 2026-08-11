import { assertPermission, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';

export type AuthorizedQuery = Readonly<{ context: AuthorizationContext; scopes: readonly DataScope[]; anchors: readonly Readonly<{scope:DataScope;organizationId:string|null}>[] }>;
export function authorizeQuery(context: AuthorizationContext | null, capability: PermissionKey, fields: readonly string[] = []): AuthorizedQuery {
  const authorized = assertPermission(context, capability, fields);
  return { context: authorized, scopes: authorized.permissions.get(capability)?.scopes ?? [], anchors: authorized.scopeAnchors?.get(capability) ?? [] };
}

export function dataScopeSql(scopes: readonly DataScope[], employeeAlias = 'e', startParameter = 1): Readonly<{ sql: string; values: readonly string[] }> {
  if (scopes.length === 0) return { sql: 'FALSE', values: [] };
  // Repositories retain their mandatory company predicate; GROUP only removes narrower filters.
  if (scopes.includes('GROUP')) return { sql: 'TRUE', values: [] };
  const clauses: string[] = [];
  const values: string[] = [];
  const add = (scope: DataScope, expression: (parameter:string)=>string, value:string): void => { if (scopes.includes(scope)) { clauses.push(expression(`$${String(startParameter+values.length)}`)); values.push(value); } };
  add('COMPANY', parameter=>`${employeeAlias}.company_id = ${parameter}`, 'companyId');
  add('SELF', parameter=>`${employeeAlias}.id = ${parameter}`, 'actorId');
  add('TEAM', parameter=>`EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id AND osr.depth <= 1)`, 'actorOrganizationId');
  add('DEPARTMENT', parameter=>`EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id)`, 'actorDepartmentId');
  add('REGION', parameter=>`EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id)`, 'actorRegionId');
  return { sql: clauses.length === 0 ? 'FALSE' : `(${clauses.join(' OR ')})`, values };
}
