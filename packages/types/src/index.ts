export type HealthStatus = Readonly<{ status: 'ok' }>;

export const DATA_SCOPES = ['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const;
export type DataScope = (typeof DATA_SCOPES)[number];
export type Identifier = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = Readonly<{ [key: string]: JsonValue }>;
export type PageRequest = Readonly<{ limit?: number; cursor?: string }>;
export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export type VersionReference = Readonly<{ id: Identifier; version: number }>;
export type LifecycleStatus = 'DRAFT' | 'PUBLISHED' | 'DELETED';
export type EffectiveRange = Readonly<{ effectiveFrom: string; effectiveTo: string | null }>;
export type AuditEventDto = Readonly<{
  id: Identifier;
  occurredAt: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  actorId: Identifier | null;
  tenantId: Identifier | null;
  targetType: string | null;
  targetId: Identifier | null;
  correlationId: Identifier;
  metadata: JsonObject;
}>;
export type AuditEventFilter = PageRequest &
  Readonly<{
    actorId?: Identifier;
    action?: string;
    targetType?: string;
    targetId?: Identifier;
    correlationId?: Identifier;
    from?: string;
    to?: string;
  }>;
export type MasterCategoryDto = VersionReference &
  EffectiveRange &
  Readonly<{
    versionId: Identifier;
    code: string;
    name: string;
    description: string | null;
    deleted: boolean;
  }>;
export type MasterEntryDto = VersionReference &
  EffectiveRange &
  Readonly<{
    versionId: Identifier;
    categoryId: Identifier;
    code: string;
    label: string;
    value: JsonObject;
    deleted: boolean;
  }>;
export type ResetPeriod = 'NEVER' | 'DAILY' | 'MONTHLY' | 'YEARLY';
export type NumberDefinitionDto = VersionReference &
  Readonly<{
    versionId: Identifier;
    code: string;
    status: 'DRAFT' | 'PUBLISHED';
    prefix: string;
    suffix: string;
    padding: number;
    startingValue: number;
    increment: number;
    resetPeriod: ResetPeriod;
  }>;
export type NumberAllocationDto = Readonly<{
  id: Identifier;
  definitionVersionId: Identifier;
  period: string;
  sequence: number;
  value: string;
  requesterId: Identifier;
  correlationId: Identifier;
  issuedAt: string;
}>;
export type RuleExpression =
  | Readonly<{ op: 'literal'; value: JsonPrimitive }>
  | Readonly<{ op: 'input'; path: string }>
  | Readonly<{ op: 'not'; value: RuleExpression }>
  | Readonly<{ op: 'and' | 'or'; values: readonly RuleExpression[] }>
  | Readonly<{
      op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
      left: RuleExpression;
      right: RuleExpression;
    }>;
export type RuleEvaluationDto = Readonly<{
  id: Identifier;
  ruleVersionId: Identifier;
  inputHash: string;
  decision: boolean;
  trace: readonly JsonObject[];
  evaluatedAt: string;
  correlationId: Identifier;
}>;
export type PermissionKey = `${string}:${string}`;
export type ErrorCode =
  | 'authentication_required'
  | 'forbidden'
  | 'invalid_request'
  | 'conflict'
  | 'not_found'
  | 'internal_error';
export type ErrorEnvelope = Readonly<{
  error: Readonly<{
    code: ErrorCode;
    message: string;
    correlationId: string;
    details?: readonly string[];
  }>;
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
