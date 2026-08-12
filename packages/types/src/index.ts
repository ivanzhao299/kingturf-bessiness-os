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

export const FOUNDATION_CAPABILITIES = [
  'notification:read',
  'notification:manage',
  'attachment:read',
  'attachment:manage',
  'event:operate',
  'business-object:read',
  'business-object:manage',
] as const satisfies readonly PermissionKey[];
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
export type NotificationDto = Readonly<{
  id: Identifier;
  tenantId: Identifier;
  kind: string;
  title: string;
  message: string;
  subjectType: string | null;
  subjectId: Identifier | null;
  readAt: string | null;
  createdAt: string;
}>;
export type NotificationPreferenceDto = Readonly<{
  channel: NotificationChannel;
  enabled: boolean;
  version: number;
}>;
export type AttachmentState = 'PENDING' | 'AVAILABLE' | 'DELETED';
export type AttachmentDto = Readonly<{
  id: Identifier;
  tenantId: Identifier;
  originalName: string;
  mimeType: string;
  size: number | null;
  checksum: string | null;
  state: AttachmentState;
  version: number;
  createdAt: string;
}>;
export type DomainEventEnvelope = Readonly<{
  eventId: Identifier;
  eventType: string;
  eventVersion: number;
  tenantId: Identifier;
  aggregateType: string;
  aggregateId: Identifier;
  aggregateVersion: number;
  occurredAt: string;
  actorId: Identifier | null;
  correlationId: Identifier;
  causationId: Identifier | null;
  payload: JsonObject;
}>;
export type EventOutboxState = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'DEAD_LETTER';
export type BusinessFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'json'
  | 'relationship';
export type BusinessObjectField = Readonly<{
  key: string;
  label: string;
  type: BusinessFieldType;
  required: boolean;
  targetDefinitionId?: Identifier;
  cardinality?: 'ONE' | 'MANY';
}>;
export type BusinessObjectSchema = Readonly<{ fields: readonly BusinessObjectField[] }>;
export type BusinessObjectVersionDto = Readonly<{
  id: Identifier;
  definitionId: Identifier;
  tenantId: Identifier;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  schema: BusinessObjectSchema;
  createdAt: string;
  publishedAt: string | null;
}>;
export type BusinessObjectDefinitionDto = Readonly<{
  id: Identifier;
  tenantId: Identifier;
  code: string;
  name: string;
  version: number;
  versions?: readonly BusinessObjectVersionDto[];
}>;

export const FOUNDATION_LIMITS = Object.freeze({
  eventPayloadBytes: 16_384,
  schemaBytes: 32_768,
  attachmentBytes: 26_214_400,
  attachmentName: 255,
  notificationTitle: 200,
  notificationMessage: 4_000,
  idempotencyKey: 128,
});
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
