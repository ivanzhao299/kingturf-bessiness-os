import type { DataScope, EmployeeDto, Identifier, OrganizationDto, PermissionKey } from '@kingturf/types';

export const domainPackageVersion = 'identity-foundation' as const;

export class DomainError extends Error {
  public constructor(
    public readonly code: 'invalid_request' | 'conflict' | 'not_found' | 'forbidden',
    message: string,
  ) {
    super(message);
  }
}

export type Actor = Readonly<{ employeeId: Identifier; companyId: Identifier }>;
export type AuthorizationContext = Readonly<{
  actor: Actor;
  permissions: ReadonlyMap<PermissionKey, Readonly<{ fields: readonly string[] | null; scopes: readonly DataScope[] }>>;
  scopeAnchors?: ReadonlyMap<PermissionKey, readonly Readonly<{ scope: DataScope; organizationId: Identifier | null }>[] >;
}>;

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function assertPermission(
  context: AuthorizationContext | null,
  permission: PermissionKey,
  requestedFields: readonly string[] = [],
): AuthorizationContext {
  if (context === null) throw new DomainError('forbidden', 'Authentication and authorization are required');
  const grant = context.permissions.get(permission);
  if (grant === undefined || grant.scopes.length === 0) throw new DomainError('forbidden', 'Permission denied');
  if (grant.fields !== null && requestedFields.some((field) => !grant.fields?.includes(field))) {
    throw new DomainError('forbidden', 'Field permission denied');
  }
  return context;
}

export type OrganizationRepository = {
  create(input: Omit<OrganizationDto, 'id' | 'version'>, actor: Actor, correlationId: string): Promise<OrganizationDto>;
  findById(id: Identifier, companyId: Identifier): Promise<OrganizationDto | null>;
  list(companyId: Identifier): Promise<readonly OrganizationDto[]>;
  update(id: Identifier, companyId: Identifier, patch: Partial<Pick<OrganizationDto, 'name' | 'parentId' | 'active' | 'locale' | 'currency'>>, version: number, actor: Actor, correlationId: string): Promise<OrganizationDto>;
};
export type ScopeAnchor = Readonly<{ scope: DataScope; organizationId: Identifier | null }>;
export type EmployeeRepository = {
  create(input: Omit<EmployeeDto, 'id' | 'version'>, actor: Actor, correlationId: string): Promise<EmployeeDto>;
  findById(id: Identifier, companyId: Identifier, scopes: readonly DataScope[], actorId: Identifier, anchors?: readonly ScopeAnchor[]): Promise<EmployeeDto | null>;
  list(companyId: Identifier, scopes: readonly DataScope[], actorId: Identifier, anchors?: readonly ScopeAnchor[]): Promise<readonly EmployeeDto[]>;
  update(id: Identifier, companyId: Identifier, patch: Partial<Pick<EmployeeDto, 'displayName' | 'email' | 'organizationId' | 'active'>>, version: number, actor: Actor, scopes: readonly DataScope[], anchors: readonly ScopeAnchor[] | undefined, correlationId: string): Promise<EmployeeDto>;
};

export type AuditEvent = Readonly<{
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  actorId: Identifier | null;
  organizationId: Identifier | null;
  targetType: string | null;
  targetId: Identifier | null;
  correlationId: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;
export type AuditSink = { record(event: AuditEvent): Promise<void> };

export type RoleRecord = Readonly<{ id:Identifier; organizationId:Identifier; code:string; name:string; version:number }>;
export type PermissionRecord = Readonly<{ id:Identifier; capability:PermissionKey; description:string }>;
export type RolePermissionGrantRecord = Readonly<{ roleId:Identifier; permissionId:Identifier; fields:readonly string[]|null; scopes:readonly DataScope[] }>;
export type RoleAssignmentRecord = Readonly<{ employeeId:Identifier; roleId:Identifier }>;
export type DirectScopeGrantRecord = Readonly<{ id:Identifier; employeeId:Identifier; permissionId:Identifier; scope:DataScope; organizationId:Identifier|null }>;
export type AuthorizationRepository = {
  listRoles(companyId:Identifier):Promise<readonly RoleRecord[]>;
  createRole(input:Readonly<{code:string;name:string}>,actor:Actor,correlationId:string):Promise<RoleRecord>;
  listPermissions():Promise<readonly PermissionRecord[]>;
  createPermission(input:Readonly<{capability:PermissionKey;description:string}>,actor:Actor,correlationId:string):Promise<PermissionRecord>;
  listGrants(companyId:Identifier):Promise<readonly RolePermissionGrantRecord[]>;
  grant(input:Readonly<{roleId:Identifier;permissionId:Identifier;scopes:readonly DataScope[];fields:readonly string[]|null}>,actor:Actor,correlationId:string):Promise<void>;
  revoke(roleId:Identifier,permissionId:Identifier,actor:Actor,correlationId:string):Promise<void>;
  listAssignments(companyId:Identifier):Promise<readonly RoleAssignmentRecord[]>;
  assign(employeeId:Identifier,roleId:Identifier,actor:Actor,correlationId:string):Promise<void>;
  unassign(employeeId:Identifier,roleId:Identifier,actor:Actor,correlationId:string):Promise<void>;
  listScopeGrants(companyId:Identifier):Promise<readonly DirectScopeGrantRecord[]>;
  grantScope(input:Readonly<{employeeId:Identifier;permissionId:Identifier;scope:DataScope;organizationId:Identifier|null}>,actor:Actor,correlationId:string):Promise<DirectScopeGrantRecord>;
  revokeScope(id:Identifier,actor:Actor,correlationId:string):Promise<void>;
};
