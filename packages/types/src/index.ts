export type HealthStatus = Readonly<{ status: 'ok' }>;

export const DATA_SCOPES = ['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const;
export type DataScope = (typeof DATA_SCOPES)[number];
export type Identifier = string;
export type PermissionKey = `${string}:${string}`;
export type ErrorCode =
  | 'authentication_required'
  | 'forbidden'
  | 'invalid_request'
  | 'conflict'
  | 'not_found'
  | 'internal_error';
export type ErrorEnvelope = Readonly<{
  error: Readonly<{ code: ErrorCode; message: string; correlationId: string; details?: readonly string[] }>;
}>;
export type OrganizationDto = Readonly<{
  id: Identifier;
  ownerOrganizationId: Identifier;
  parentId: Identifier | null;
  code: string;
  name: string;
  locale: string;
  currency: string;
  active: boolean;
  version: number;
}>;
export type EmployeeDto = Readonly<{
  id: Identifier;
  companyId: Identifier;
  organizationId: Identifier;
  employeeNumber: string;
  displayName: string;
  email: string;
  active: boolean;
  version: number;
}>;
