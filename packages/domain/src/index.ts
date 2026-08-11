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
  create(input: Omit<OrganizationDto, 'id' | 'version'>, actor: Actor): Promise<OrganizationDto>;
  findById(id: Identifier, companyId: Identifier): Promise<OrganizationDto | null>;
  list(companyId: Identifier): Promise<readonly OrganizationDto[]>;
  update(id: Identifier, companyId: Identifier, patch: Partial<Pick<OrganizationDto, 'name' | 'parentId' | 'active' | 'locale' | 'currency'>>, version: number, actor: Actor): Promise<OrganizationDto>;
};
export type EmployeeRepository = {
  create(input: Omit<EmployeeDto, 'id' | 'version'>, actor: Actor): Promise<EmployeeDto>;
  findById(id: Identifier, companyId: Identifier, scopes: readonly DataScope[], actorId: Identifier): Promise<EmployeeDto | null>;
  list(companyId: Identifier, scopes: readonly DataScope[], actorId: Identifier): Promise<readonly EmployeeDto[]>;
  update(id: Identifier, companyId: Identifier, patch: Partial<Pick<EmployeeDto, 'displayName' | 'email' | 'organizationId' | 'active'>>, version: number, actor: Actor, scopes: readonly DataScope[]): Promise<EmployeeDto>;
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
