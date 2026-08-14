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

export const CRM_CAPABILITIES = [
  'customer:read',
  'customer:create',
  'customer:update',
  'customer:lifecycle',
  'customer:deduplicate',
  'customer-ownership:read',
  'customer-ownership:assign',
  'customer-ownership:reassign',
  'customer-activity:read',
  'customer-activity:create',
  'customer-360:read',
  'lead:read',
  'lead:create',
  'lead:update',
  'lead:lifecycle',
  'lead-pool:read',
  'lead-pool:claim',
  'lead-pool:release',
  'lead:assign',
  'lead:reassign',
] as const satisfies readonly PermissionKey[];
export type CustomerStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type LeadStatus = 'NEW' | 'POOL' | 'CLAIMED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED';
export type CustomerDto = VersionReference &
  Readonly<{
    tenantId: Identifier;
    customerNumber: string;
    name: string;
    normalizedName: string;
    status: CustomerStatus;
    ownerId: Identifier | null;
    ownerOrganizationId: Identifier | null;
    tags: readonly string[];
    createdAt: string;
    updatedAt: string;
  }>;
export type ContactDto = VersionReference &
  Readonly<{
    customerId: Identifier;
    name: string;
    title: string | null;
    email?: string | null;
    phone?: string | null;
    primary: boolean;
    createdAt: string;
  }>;
export type OwnershipHistoryDto = Readonly<{
  id: Identifier;
  customerId: Identifier;
  ownerId: Identifier;
  organizationId: Identifier;
  assignedBy: Identifier;
  reason: string;
  startedAt: string;
  endedAt: string | null;
}>;
export type LeadDto = VersionReference &
  Readonly<{
    tenantId: Identifier;
    customerId: Identifier | null;
    title: string;
    source: string;
    status: LeadStatus;
    ownerId: Identifier | null;
    ownerOrganizationId: Identifier | null;
    createdAt: string;
    updatedAt: string;
  }>;
export type AssignmentDto = VersionReference &
  Readonly<{
    subjectType: 'CUSTOMER' | 'LEAD';
    subjectId: Identifier;
    assigneeId: Identifier;
    organizationId: Identifier;
    assignedBy: Identifier;
    reason: string;
    active: boolean;
    assignedAt: string;
    endedAt: string | null;
  }>;
export type ActivityDto = Readonly<{
  id: Identifier;
  customerId: Identifier;
  leadId: Identifier | null;
  type: string;
  occurredAt: string;
  actorId: Identifier;
  summary: string;
  details: JsonObject;
}>;
export type TransitionDto = Readonly<{
  id: Identifier;
  subjectId: Identifier;
  fromStatus: string;
  toStatus: string;
  actorId: Identifier;
  reason: string;
  occurredAt: string;
}>;
export type Customer360Dto = Readonly<{
  customer: CustomerDto;
  contacts: readonly ContactDto[];
  ownership: readonly OwnershipHistoryDto[];
  leads: readonly LeadDto[];
  activities: readonly ActivityDto[];
  unavailableSections: readonly ['orders', 'finance'];
}>;

/** Commercial amounts are transported as canonical decimal strings, never IEEE-754 numbers. */
export type Decimal = string;
export type CurrencyCode = string;
export type UnitCode = string;
export type Money = Readonly<{ amount: Decimal; currency: CurrencyCode }>;
export type Quantity = Readonly<{ value: Decimal; unit: UnitCode }>;
export type ExactRevisionReference = Readonly<{
  id: Identifier;
  revisionId: Identifier;
  revision: number;
}>;

export const COMMERCIAL_CAPABILITIES = [
  'opportunity:read',
  'opportunity:create',
  'opportunity:update',
  'opportunity:lifecycle',
  'ctr:read',
  'ctr:create',
  'ctr:update',
  'ctr:submit',
  'ctr:approve',
  'technical-solution:read',
  'technical-solution:create',
  'technical-solution:update',
  'cost-model:read',
  'cost-model:manage',
  'cost:evaluate',
  'cost:read',
  'sales-policy:read',
  'sales-policy:manage',
  'sales-policy:evaluate',
  'quote:read',
  'quote:create',
  'quote:update',
  'quote:approve',
  'quote:issue',
] as const satisfies readonly PermissionKey[];

export type OpportunityStatus = 'OPEN' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST' | 'CANCELLED';
export type CtrStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type TechnicalSolutionStatus = 'DRAFT' | 'FINAL';
export type QuoteStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ISSUED'
  | 'EXPIRED'
  | 'REJECTED';
export type ApprovalDecision = 'APPROVED' | 'REJECTED';
export type OpportunityDto = VersionReference &
  Readonly<{
    tenantId: Identifier;
    customerId: Identifier | null;
    leadId: Identifier | null;
    name: string;
    status: OpportunityStatus;
    ownerId: Identifier;
    ownerOrganizationId: Identifier;
    value: Money;
    probabilityBasisPoints: number;
    expectedCloseDate: string;
    createdAt: string;
    updatedAt: string;
  }>;
export type CtrVersionDto = Readonly<{
  id: Identifier;
  ctrId: Identifier;
  version: number;
  status: CtrStatus;
  title: string;
  requirements: JsonObject;
  submittedAt: string | null;
  snapshotHash: string | null;
  createdAt: string;
}>;
export type TechnicalSolutionRevisionDto = Readonly<{
  id: Identifier;
  technicalSolutionId: Identifier;
  revision: number;
  status: TechnicalSolutionStatus;
  ctrVersion: Readonly<{ ctrId: Identifier; versionId: Identifier; version: number }>;
  specification: JsonObject;
  assumptions: readonly string[];
  createdAt: string;
}>;
export type CostRule = Readonly<{
  when: CommercialRuleExpression;
  adjustment: Readonly<{ kind: 'ADD' | 'MULTIPLY'; value: Decimal }>;
  reason: string;
}>;
export type CommercialRuleExpression =
  | Readonly<{ op: 'literal'; value: JsonPrimitive }>
  | Readonly<{ op: 'input'; path: string }>
  | Readonly<{ op: 'not'; value: CommercialRuleExpression }>
  | Readonly<{ op: 'and' | 'or'; values: readonly CommercialRuleExpression[] }>
  | Readonly<{
      op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
      left: CommercialRuleExpression;
      right: CommercialRuleExpression;
    }>;
export type CostEngineLineInput = Readonly<{
  key: string;
  description: string;
  quantity: Quantity;
  unitCost: Money;
}>;
export type CostEngineInput = Readonly<{
  modelVersionId: Identifier;
  currency: CurrencyCode;
  lines: readonly CostEngineLineInput[];
  context: JsonObject;
}>;
export type CostDecisionDto = Readonly<{
  id: Identifier;
  modelVersionId: Identifier;
  inputHash: string;
  currency: CurrencyCode;
  subtotal: Decimal;
  total: Decimal;
  lines: readonly Readonly<{ key: string; quantity: Quantity; unitCost: Money; total: Money }>[];
  trace: readonly JsonObject[];
  evaluatedAt: string;
}>;
export type SalesPolicyOutcome = Readonly<{
  passed: boolean;
  approvalRequired: boolean;
  minimumMarginBasisPoints: number | null;
  maximumDiscountBasisPoints: number | null;
  reasons: readonly string[];
  trace: readonly JsonObject[];
}>;
export type SalesPolicyEvaluationDto = SalesPolicyOutcome &
  Readonly<{
    id: Identifier;
    policyVersionId: Identifier;
    inputHash: string;
    evaluatedAt: string;
  }>;
export type QuoteRevisionDto = Readonly<{
  id: Identifier;
  quoteId: Identifier;
  revision: number;
  status: QuoteStatus;
  opportunity: VersionReference;
  ctrVersionId: Identifier;
  technicalSolutionRevisionId: Identifier;
  costDecisionId: Identifier;
  policyVersionId: Identifier;
  policyEvaluationId: Identifier;
  currency: CurrencyCode;
  subtotal: Decimal;
  discount: Decimal;
  total: Decimal;
  costTotal: Decimal;
  margin: Decimal;
  marginBasisPoints: number;
  validUntil: string;
  issuedAt: string | null;
  createdAt: string;
}>;
