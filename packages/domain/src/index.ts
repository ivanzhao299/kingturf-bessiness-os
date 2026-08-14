import type {
  DataScope,
  EmployeeDto,
  Identifier,
  JsonObject,
  JsonValue,
  OrganizationDto,
  PermissionKey,
  RuleExpression,
  BusinessObjectSchema,
  DomainEventEnvelope,
  CommercialRuleExpression,
  CostEngineInput,
  CostDecisionDto,
  CostRule,
  JsonPrimitive,
} from '@kingturf/types';

export const domainPackageVersion = 'identity-foundation' as const;

export class DomainError extends Error {
  public constructor(
    public readonly code: 'invalid_request' | 'conflict' | 'not_found' | 'forbidden',
    message: string,
  ) {
    super(message);
  }
}

export type IdempotencyContext = Readonly<{ key: string; correlationId: string }>;
export type EventTransaction = {
  // The generic models the selected event outbox projection of a parameterized query.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<Readonly<{ rows: T[]; rowCount: number | null }>>;
};
export type EventPublisher = {
  enqueue(
    transaction: EventTransaction,
    event: Omit<DomainEventEnvelope, 'eventId'>,
  ): Promise<string>;
};
export type ObjectStorage = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
};
export type ObjectAccessAuthorizer = {
  authorize(
    objectType: string,
    objectId: Identifier,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors?: readonly ScopeAnchor[],
  ): Promise<boolean>;
};
/** Resolves and authorizes a concrete instance for one registered business-object type. */
export type ObjectInstanceResolver = {
  authorizeInstance(
    objectId: Identifier,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors?: readonly ScopeAnchor[],
  ): Promise<boolean>;
};
export type Telemetry = {
  count(name: string, value?: number, labels?: Readonly<Record<string, string>>): void;
  timing(name: string, milliseconds: number, labels?: Readonly<Record<string, string>>): void;
};
export type OperationalLogger = {
  write(
    entry: Readonly<{
      level: 'info' | 'error';
      event: string;
      correlationId: string;
      statusCode: number;
      durationMs: number;
    }>,
  ): void;
};
export const NOOP_TELEMETRY: Telemetry = Object.freeze({
  count() {
    return undefined;
  },
  timing() {
    return undefined;
  },
});

const SAFE_FIELD_KEY = /^[a-z][a-zA-Z0-9_]{0,63}$/u;
const BUSINESS_FIELD_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'uuid',
  'json',
  'relationship',
]);
export function validateBusinessObjectSchema(value: unknown): BusinessObjectSchema {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainError('invalid_request', 'schema must be an object');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== 'fields') ||
    !Array.isArray(record.fields) ||
    record.fields.length > 100
  )
    throw new DomainError('invalid_request', 'schema requires at most 100 fields');
  const seen = new Set<string>();
  const fields = record.fields.map((candidate) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate))
      throw new DomainError('invalid_request', 'field must be an object');
    const field = candidate as Record<string, unknown>;
    const allowed = ['key', 'label', 'type', 'required', 'targetDefinitionId', 'cardinality'];
    if (
      Object.keys(field).some((key) => !allowed.includes(key)) ||
      typeof field.key !== 'string' ||
      !SAFE_FIELD_KEY.test(field.key) ||
      ['__proto__', 'prototype', 'constructor'].includes(field.key) ||
      seen.has(field.key) ||
      typeof field.label !== 'string' ||
      !field.label.trim() ||
      field.label.length > 128 ||
      typeof field.type !== 'string' ||
      !BUSINESS_FIELD_TYPES.has(field.type) ||
      typeof field.required !== 'boolean'
    )
      throw new DomainError('invalid_request', 'invalid business object field');
    seen.add(field.key);
    const relationship = field.type === 'relationship';
    if (
      relationship !== (typeof field.targetDefinitionId === 'string') ||
      (relationship && field.cardinality !== 'ONE' && field.cardinality !== 'MANY')
    )
      throw new DomainError(
        'invalid_request',
        'relationship target and cardinality are required only for relationship fields',
      );
    return {
      key: field.key,
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      ...(relationship
        ? {
            targetDefinitionId: field.targetDefinitionId as string,
            cardinality: field.cardinality as 'ONE' | 'MANY',
          }
        : {}),
    };
  });
  const schema = { fields } as BusinessObjectSchema;
  let encodedLength = 0;
  for (const character of JSON.stringify(schema)) {
    const point = character.codePointAt(0) ?? 0;
    encodedLength += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  if (encodedLength > 32_768) throw new DomainError('invalid_request', 'schema exceeds 32 KiB');
  return schema;
}

export type Actor = Readonly<{ employeeId: Identifier; companyId: Identifier }>;
export type AuthorizationContext = Readonly<{
  actor: Actor;
  permissions: ReadonlyMap<
    PermissionKey,
    Readonly<{ fields: readonly string[] | null; scopes: readonly DataScope[] }>
  >;
  scopeAnchors?: ReadonlyMap<
    PermissionKey,
    readonly Readonly<{ scope: DataScope; organizationId: Identifier | null }>[]
  >;
}>;

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const CONTACT_PHONE = /^\+?[0-9]{7,15}$/u;
const CONTACT_PHONE_INPUT = /^\+?[0-9\s().-]+$/u;

export function normalizeContactEmail(value: string): string {
  const normalized = normalizeEmail(value);
  if (!CONTACT_EMAIL.test(normalized))
    throw new DomainError('invalid_request', 'Contact email is malformed');
  return normalized;
}

export function normalizeContactPhone(value: string): string {
  const trimmed = value.trim();
  if (!CONTACT_PHONE_INPUT.test(trimmed))
    throw new DomainError('invalid_request', 'Contact phone is malformed');
  const normalized = `${trimmed.startsWith('+') ? '+' : ''}${trimmed.replace(/\D/gu, '')}`;
  if (!CONTACT_PHONE.test(normalized))
    throw new DomainError('invalid_request', 'Contact phone is malformed');
  return normalized;
}

export function normalizeCustomerIdentity(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

const CUSTOMER_TRANSITIONS = new Map([
  ['PROSPECT', new Set(['ACTIVE', 'ARCHIVED'])],
  ['ACTIVE', new Set(['INACTIVE', 'ARCHIVED'])],
  ['INACTIVE', new Set(['ACTIVE', 'ARCHIVED'])],
  ['ARCHIVED', new Set<string>()],
]);
const LEAD_TRANSITIONS = new Map([
  ['NEW', new Set(['POOL', 'CLAIMED', 'DISQUALIFIED'])],
  ['POOL', new Set(['CLAIMED', 'DISQUALIFIED'])],
  ['CLAIMED', new Set(['POOL', 'QUALIFIED', 'DISQUALIFIED'])],
  ['QUALIFIED', new Set(['CONVERTED', 'DISQUALIFIED'])],
  ['DISQUALIFIED', new Set<string>()],
  ['CONVERTED', new Set<string>()],
]);
export function assertCustomerTransition(from: string, to: string): void {
  if (!CUSTOMER_TRANSITIONS.get(from)?.has(to))
    throw new DomainError('conflict', `Illegal customer transition: ${from} -> ${to}`);
}
export function assertLeadTransition(from: string, to: string): void {
  if (!LEAD_TRANSITIONS.get(from)?.has(to))
    throw new DomainError('conflict', `Illegal lead transition: ${from} -> ${to}`);
}
export function assertLeadPoolClaim(from: string): void {
  if (from !== 'POOL')
    throw new DomainError('conflict', `Illegal lead transition: ${from} -> CLAIMED`);
  assertLeadTransition(from, 'CLAIMED');
}

const OPPORTUNITY_TRANSITIONS = new Map([
  ['OPEN', new Set(['QUALIFIED', 'LOST', 'CANCELLED'])],
  ['QUALIFIED', new Set(['PROPOSAL', 'LOST', 'CANCELLED'])],
  ['PROPOSAL', new Set(['WON', 'LOST', 'CANCELLED'])],
  ['WON', new Set<string>()],
  ['LOST', new Set<string>()],
  ['CANCELLED', new Set<string>()],
]);
export function assertOpportunityTransition(from: string, to: string): void {
  if (!OPPORTUNITY_TRANSITIONS.get(from)?.has(to))
    throw new DomainError('conflict', `Illegal opportunity transition: ${from} -> ${to}`);
}
export function assertExactVersionPin(reference: {
  id?: string;
  versionId?: string;
  version?: number;
}): void {
  if (
    !reference.id?.trim() ||
    !reference.versionId?.trim() ||
    !Number.isSafeInteger(reference.version) ||
    (reference.version ?? 0) < 1
  )
    throw new DomainError(
      'invalid_request',
      'An exact identity, version id, and positive version are required',
    );
}

const DECIMAL = /^-?(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,6})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const UNIT = /^[A-Z][A-Z0-9_]{0,15}$/u;
export function normalizeDecimal(value: string, scale = 6): string {
  if (!DECIMAL.test(value)) throw new DomainError('invalid_request', 'Invalid decimal');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const normalizedFraction = fraction.slice(0, scale).replace(/0+$/u, '');
  const result = `${negative ? '-' : ''}${whole ?? '0'}${normalizedFraction ? `.${normalizedFraction}` : ''}`;
  return result === '-0' ? '0' : result;
}
export function assertCurrency(value: string): string {
  if (!CURRENCY.test(value))
    throw new DomainError('invalid_request', 'Currency must be ISO 4217 uppercase');
  return value;
}
export function assertUnit(value: string): string {
  if (!UNIT.test(value)) throw new DomainError('invalid_request', 'Unit code is invalid');
  return value;
}
const SCALE = 1_000_000n;
const minor = (value: string): bigint => {
  const normalized = normalizeDecimal(value);
  const negative = normalized.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? normalized.slice(1) : normalized).split('.');
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  return negative ? -result : result;
};
const decimal = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const fraction = String(absolute % SCALE)
    .padStart(6, '0')
    .replace(/0+$/u, '');
  return `${negative ? '-' : ''}${String(absolute / SCALE)}${fraction ? `.${fraction}` : ''}`;
};
export const addDecimal = (left: string, right: string): string =>
  decimal(minor(left) + minor(right));
export const multiplyDecimal = (left: string, right: string): string =>
  decimal((minor(left) * minor(right)) / SCALE);
export function calculateBasisPoints(numerator: string, denominator: string): number {
  const divisor = minor(denominator);
  if (divisor <= 0n)
    throw new DomainError('invalid_request', 'Basis-point denominator must be positive');
  const result = (minor(numerator) * 10_000n) / divisor;
  if (result < -100_000n || result > 100_000n)
    throw new DomainError('invalid_request', 'Basis-point result is outside supported range');
  return Number(result);
}
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new DomainError('invalid_request', 'Canonical numeric inputs must be safe integers');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  throw new DomainError('invalid_request', 'Unsupported canonical value');
}

/** The single monetary representation used by the E11-E17 boundary. */
export type ScaledMoney = Readonly<{ amount: string; currency: string; scale: 6 }>;
export type CreditExposure = Readonly<{
  receivables: ScaledMoney;
  uninvoicedOrders: ScaledMoney;
  unappliedPayments: ScaledMoney;
  exposure: ScaledMoney;
}>;
export type CreditDecisionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type ContractStatus = 'DRAFT' | 'SIGNED' | 'VOID';
export type SalesOrderStatus = 'RELEASED' | 'CANCELLED';

export type ImmutableEvidence = Readonly<{
  id: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  canonicalInput: string;
  canonicalHash: string;
  createdAt: string;
}>;
export type CreditDecisionEvidence = ImmutableEvidence &
  Readonly<{
    version: number;
    snapshotId: string;
    status: CreditDecisionStatus;
    validUntil: string;
    calculationTrace: readonly Readonly<Record<string, string>>[];
  }>;
export type SignatureEvidence = ImmutableEvidence &
  Readonly<{ contractRevisionId: string; provider: string; signedAt: string }>;
export type AllocationInstruction = Readonly<{
  paymentId: string;
  openItemId: string;
  currency: string;
  amount: string;
  paymentReceivedAt?: string;
  dueAt?: string;
}>;

export function canonicalHash(value: unknown): string {
  const input = canonicalize(value);
  // Four independently seeded FNV-1a lanes provide a portable stable 256-bit identifier.
  return [0n, 1n, 2n, 3n]
    .map((lane) => {
      let hash = 0xcbf29ce484222325n ^ lane;
      for (const character of input) {
        hash ^= BigInt(character.codePointAt(0) ?? 0);
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
      }
      return hash.toString(16).padStart(16, '0');
    })
    .join('');
}

function moneySum(values: readonly string[]): string {
  return decimal(values.reduce((total, value) => total + minor(value), 0n));
}

export function calculateCreditExposure(
  input: Readonly<{
    currency: string;
    receivables: readonly string[];
    uninvoicedOrders?: readonly string[];
    unappliedPayments?: readonly string[];
  }>,
): CreditExposure {
  const currency = assertCurrency(input.currency);
  const receivables = moneySum(input.receivables);
  const uninvoicedOrders = moneySum(input.uninvoicedOrders ?? []);
  const unappliedPayments = moneySum(input.unappliedPayments ?? []);
  if ([receivables, uninvoicedOrders, unappliedPayments].some((value) => minor(value) < 0n))
    throw new DomainError('invalid_request', 'Exposure facts cannot be negative');
  const amount = decimal(minor(receivables) + minor(uninvoicedOrders) - minor(unappliedPayments));
  const monetary = (value: string): ScaledMoney => ({ amount: value, currency, scale: 6 });
  return {
    receivables: monetary(receivables),
    uninvoicedOrders: monetary(uninvoicedOrders),
    unappliedPayments: monetary(unappliedPayments),
    exposure: monetary(minor(amount) < 0n ? '0' : amount),
  };
}

export function evaluateCreditEligibility(
  input: Readonly<{
    limit: ScaledMoney;
    exposure: ScaledMoney;
    requested: ScaledMoney;
  }>,
): Readonly<{ eligible: boolean; remaining: ScaledMoney }> {
  const currencies = [input.limit.currency, input.exposure.currency, input.requested.currency];
  if (new Set(currencies).size !== 1) throw new DomainError('conflict', 'Currency mismatch');
  if (
    minor(input.limit.amount) < 0n ||
    minor(input.exposure.amount) < 0n ||
    minor(input.requested.amount) < 0n
  )
    throw new DomainError('invalid_request', 'Credit amounts cannot be negative');
  const remaining = minor(input.limit.amount) - minor(input.exposure.amount);
  return {
    eligible: remaining >= minor(input.requested.amount),
    remaining: {
      amount: decimal(remaining > 0n ? remaining : 0n),
      currency: input.limit.currency,
      scale: 6,
    },
  };
}

export function assertCreditDecisionUsable(
  decision: Readonly<{ status: CreditDecisionStatus; validUntil: string; quoteRevisionId: string }>,
  expectedQuoteRevisionId: string,
  now = new Date(),
): void {
  if (decision.quoteRevisionId !== expectedQuoteRevisionId)
    throw new DomainError('conflict', 'Credit decision does not pin the exact quote revision');
  if (decision.status !== 'APPROVED')
    throw new DomainError('conflict', 'Credit decision is not approved');
  if (
    !Number.isFinite(Date.parse(decision.validUntil)) ||
    Date.parse(decision.validUntil) <= now.getTime()
  )
    throw new DomainError('conflict', 'Credit decision is expired');
}

/** Validates and canonically orders allocations for byte-identical replay. */
export function reconcileAllocations(
  allocations: readonly AllocationInstruction[],
  paymentBalances: Readonly<Record<string, ScaledMoney>>,
  openBalances: Readonly<Record<string, ScaledMoney>>,
): Readonly<{ allocations: readonly AllocationInstruction[]; canonicalHash: string }> {
  const ordered = [...allocations].sort((a, b) =>
    [a.paymentReceivedAt ?? '', a.paymentId, a.dueAt ?? '', a.openItemId]
      .join('\0')
      .localeCompare(
        [b.paymentReceivedAt ?? '', b.paymentId, b.dueAt ?? '', b.openItemId].join('\0'),
      ),
  );
  const payments = new Map(
    Object.entries(paymentBalances).map(([id, value]) => [id, minor(value.amount)]),
  );
  const items = new Map(
    Object.entries(openBalances).map(([id, value]) => [id, minor(value.amount)]),
  );
  for (const allocation of ordered) {
    const payment = paymentBalances[allocation.paymentId],
      item = openBalances[allocation.openItemId];
    if (!payment || !item) throw new DomainError('not_found', 'Allocation balance was not found');
    if (payment.currency !== allocation.currency || item.currency !== allocation.currency)
      throw new DomainError('conflict', 'Allocation currency mismatch');
    const amount = minor(allocation.amount);
    if (amount <= 0n) throw new DomainError('invalid_request', 'Allocation must be positive');
    const paymentRemaining = payments.get(allocation.paymentId) ?? 0n;
    const itemRemaining = items.get(allocation.openItemId) ?? 0n;
    if (amount > paymentRemaining || amount > itemRemaining)
      throw new DomainError('conflict', 'Allocation exceeds remaining balance');
    payments.set(allocation.paymentId, paymentRemaining - amount);
    items.set(allocation.openItemId, itemRemaining - amount);
  }
  return { allocations: ordered, canonicalHash: canonicalHash(ordered) };
}
const inputAt = (input: unknown, path: string): unknown => {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){0,7}$/u.test(path))
    throw new DomainError('invalid_request', 'Invalid rule input path');
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        typeof current === 'object' && current !== null && !Array.isArray(current)
          ? (current as Record<string, unknown>)[key]
          : undefined,
      input,
    );
};
export function evaluateCommercialRule(
  expression: CommercialRuleExpression,
  input: unknown,
  depth = 0,
): JsonPrimitive {
  if (depth > 20) throw new DomainError('invalid_request', 'Rule exceeds maximum depth');
  if (expression.op === 'literal') return expression.value;
  if (expression.op === 'input') {
    const value = inputAt(input, expression.path);
    return value === null || ['string', 'number', 'boolean'].includes(typeof value)
      ? (value as JsonPrimitive)
      : null;
  }
  if (expression.op === 'not') return !evaluateCommercialRule(expression.value, input, depth + 1);
  if (expression.op === 'and' || expression.op === 'or') {
    if (expression.values.length === 0 || expression.values.length > 50)
      throw new DomainError('invalid_request', 'Rule group size is invalid');
    const values = expression.values.map((item) =>
      Boolean(evaluateCommercialRule(item, input, depth + 1)),
    );
    return expression.op === 'and' ? values.every(Boolean) : values.some(Boolean);
  }
  const comparison = expression as Extract<
    CommercialRuleExpression,
    { left: CommercialRuleExpression }
  >;
  const left = evaluateCommercialRule(comparison.left, input, depth + 1);
  const right = evaluateCommercialRule(comparison.right, input, depth + 1);
  if (expression.op === 'eq') return canonicalize(left) === canonicalize(right);
  if (expression.op === 'ne') return canonicalize(left) !== canonicalize(right);
  if (expression.op === 'in')
    return typeof right === 'string' && right.split(',').includes(String(left));
  const compare =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
  return expression.op === 'gt'
    ? compare > 0
    : expression.op === 'gte'
      ? compare >= 0
      : expression.op === 'lt'
        ? compare < 0
        : compare <= 0;
}
export function calculateCost(
  input: CostEngineInput,
  rules: readonly CostRule[],
  id = 'pending',
): CostDecisionDto {
  assertCurrency(input.currency);
  let subtotal = '0';
  const lines = input.lines.map((line) => {
    assertUnit(line.quantity.unit);
    if (assertCurrency(line.unitCost.currency) !== input.currency)
      throw new DomainError('invalid_request', 'Mixed currencies are not supported');
    const total = multiplyDecimal(line.quantity.value, line.unitCost.amount);
    subtotal = addDecimal(subtotal, total);
    return {
      key: line.key,
      quantity: line.quantity,
      unitCost: line.unitCost,
      total: { amount: total, currency: input.currency },
    };
  });
  let total = subtotal;
  const trace: Record<string, JsonPrimitive>[] = [];
  rules.forEach((rule, index) => {
    const matched = Boolean(evaluateCommercialRule(rule.when, input));
    if (matched)
      total =
        rule.adjustment.kind === 'ADD'
          ? addDecimal(total, rule.adjustment.value)
          : multiplyDecimal(total, rule.adjustment.value);
    trace.push({ rule: index, matched, reason: rule.reason });
  });
  return {
    id,
    modelVersionId: input.modelVersionId,
    inputHash: canonicalize(input),
    currency: input.currency,
    subtotal,
    total,
    lines,
    trace,
    evaluatedAt: new Date(0).toISOString(),
  };
}
export function assertSeparationOfDuties(
  actorId: string,
  assigneeId: string,
  reassignment: boolean,
): void {
  if (reassignment && actorId === assigneeId)
    throw new DomainError('forbidden', 'Reassignment requires an actor other than the assignee');
}

export function assertPermission(
  context: AuthorizationContext | null,
  permission: PermissionKey,
  requestedFields: readonly string[] = [],
): AuthorizationContext {
  if (context === null)
    throw new DomainError('forbidden', 'Authentication and authorization are required');
  const grant = context.permissions.get(permission);
  if (grant === undefined || grant.scopes.length === 0)
    throw new DomainError('forbidden', 'Permission denied');
  if (grant.fields !== null && requestedFields.some((field) => !grant.fields?.includes(field))) {
    throw new DomainError('forbidden', 'Field permission denied');
  }
  return context;
}

export type OrganizationRepository = {
  create(
    input: Omit<OrganizationDto, 'id' | 'version'>,
    actor: Actor,
    correlationId: string,
  ): Promise<OrganizationDto>;
  findById(id: Identifier, companyId: Identifier): Promise<OrganizationDto | null>;
  list(companyId: Identifier): Promise<readonly OrganizationDto[]>;
  update(
    id: Identifier,
    companyId: Identifier,
    patch: Partial<Pick<OrganizationDto, 'name' | 'parentId' | 'active' | 'locale' | 'currency'>>,
    version: number,
    actor: Actor,
    correlationId: string,
  ): Promise<OrganizationDto>;
};
export type ScopeAnchor = Readonly<{ scope: DataScope; organizationId: Identifier | null }>;
export type EmployeeRepository = {
  create(
    input: Omit<EmployeeDto, 'id' | 'version'>,
    actor: Actor,
    correlationId: string,
  ): Promise<EmployeeDto>;
  findById(
    id: Identifier,
    companyId: Identifier,
    scopes: readonly DataScope[],
    actorId: Identifier,
    anchors?: readonly ScopeAnchor[],
  ): Promise<EmployeeDto | null>;
  list(
    companyId: Identifier,
    scopes: readonly DataScope[],
    actorId: Identifier,
    anchors?: readonly ScopeAnchor[],
  ): Promise<readonly EmployeeDto[]>;
  update(
    id: Identifier,
    companyId: Identifier,
    patch: Partial<Pick<EmployeeDto, 'displayName' | 'email' | 'organizationId' | 'active'>>,
    version: number,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] | undefined,
    correlationId: string,
  ): Promise<EmployeeDto>;
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

const FORBIDDEN_METADATA = /password|secret|credential|token|authorization|cookie|private.?key/iu;
export function sanitizeAuditMetadata(value: unknown, allowedKeys: readonly string[]): JsonObject {
  const walk = (item: unknown, depth: number): JsonValue => {
    if (depth > 5) throw new DomainError('invalid_request', 'Audit metadata exceeds maximum depth');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (Array.isArray(item)) {
      if (item.length > 50)
        throw new DomainError('invalid_request', 'Audit metadata list is too large');
      return item.map((v) => walk(v, depth + 1));
    }
    if (typeof item === 'object') {
      const result: Record<string, JsonValue> = {};
      for (const [key, child] of Object.entries(item)) {
        if (FORBIDDEN_METADATA.test(key))
          throw new DomainError('invalid_request', 'Audit metadata contains a sensitive field');
        result[key] = walk(child, depth + 1);
      }
      return result;
    }
    throw new DomainError('invalid_request', 'Audit metadata contains an unsupported value');
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainError('invalid_request', 'Audit metadata must be an object');
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter((k) => !allowedKeys.includes(k));
  if (unknown.length)
    throw new DomainError(
      'invalid_request',
      `Audit metadata fields are not allowed: ${unknown.sort().join(', ')}`,
    );
  const result = walk(record, 0) as JsonObject;
  let encodedLength = 0;
  for (const character of JSON.stringify(result)) {
    const point = character.codePointAt(0) ?? 0;
    encodedLength += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  if (encodedLength > 8192)
    throw new DomainError('invalid_request', 'Audit metadata exceeds 8 KiB');
  return result;
}

export function assertEffectiveRange(from: string, to: string | null): void {
  const start = Date.parse(from),
    end = to === null ? null : Date.parse(to);
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end)))
    throw new DomainError('invalid_request', 'Effective dates must be ISO timestamps');
  if (end !== null && end <= start)
    throw new DomainError('invalid_request', 'effectiveTo must be after effectiveFrom');
}
export function parseEffectiveTimestamp(value: string, name = 'at'): Date {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new DomainError('invalid_request', `${name} must be an ISO timestamp`);
  return new Date(timestamp);
}
export function assertStableCode(value: string): string {
  const code = value.trim();
  if (!/^[A-Z][A-Z0-9_-]{0,63}$/u.test(code))
    throw new DomainError(
      'invalid_request',
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    );
  return code;
}

const BAD_PATH = new Set(['__proto__', 'prototype', 'constructor']);
export function validateRuleExpression(value: unknown, maxDepth = 12): RuleExpression {
  const visit = (node: unknown, depth: number): RuleExpression => {
    if (depth > maxDepth || typeof node !== 'object' || node === null || Array.isArray(node))
      throw new DomainError('invalid_request', 'Invalid or excessively nested rule expression');
    const r = node as Record<string, unknown>;
    if (typeof r.op !== 'string')
      throw new DomainError('invalid_request', 'Rule operator is required');
    const exact = (keys: readonly string[]): void => {
      if (Object.keys(r).some((k) => !keys.includes(k)))
        throw new DomainError('invalid_request', 'Unknown rule expression field');
    };
    if (r.op === 'literal') {
      exact(['op', 'value']);
      if (
        (r.value !== null && !['string', 'number', 'boolean'].includes(typeof r.value)) ||
        (typeof r.value === 'number' && !Number.isFinite(r.value))
      )
        throw new DomainError('invalid_request', 'Invalid rule literal');
      return { op: 'literal', value: r.value as string | number | boolean | null };
    }
    if (r.op === 'input') {
      exact(['op', 'path']);
      if (
        typeof r.path !== 'string' ||
        !r.path ||
        r.path.length > 256 ||
        r.path.split('.').some((p) => !p || BAD_PATH.has(p))
      )
        throw new DomainError('invalid_request', 'Invalid input path');
      return { op: 'input', path: r.path };
    }
    if (r.op === 'not') {
      exact(['op', 'value']);
      return { op: 'not', value: visit(r.value, depth + 1) };
    }
    if (r.op === 'and' || r.op === 'or') {
      exact(['op', 'values']);
      if (!Array.isArray(r.values) || r.values.length < 1 || r.values.length > 50)
        throw new DomainError('invalid_request', 'Boolean expression requires 1-50 values');
      return { op: r.op, values: r.values.map((v) => visit(v, depth + 1)) };
    }
    if (['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'].includes(r.op)) {
      exact(['op', 'left', 'right']);
      return { op: r.op as 'eq', left: visit(r.left, depth + 1), right: visit(r.right, depth + 1) };
    }
    throw new DomainError('invalid_request', 'Unsupported rule operator');
  };
  return visit(value, 0);
}
export function evaluateRule(
  expression: RuleExpression,
  input: JsonObject,
): Readonly<{ decision: boolean; trace: readonly JsonObject[] }> {
  const trace: JsonObject[] = [];
  const read = (path: string): JsonValue => {
    let current: JsonValue = input;
    for (const part of path.split('.')) {
      if (
        typeof current !== 'object' ||
        current === null ||
        Array.isArray(current) ||
        !Object.hasOwn(current, part)
      )
        throw new DomainError('invalid_request', `Missing required input: ${path}`);
      current = (current as JsonObject)[part] as JsonValue;
    }
    return current;
  };
  const ev = (node: RuleExpression): JsonValue => {
    let result: JsonValue;
    switch (node.op) {
      case 'literal':
        result = node.value;
        break;
      case 'input':
        result = read(node.path);
        break;
      case 'not':
        result = !ev(node.value);
        break;
      case 'and':
        result = node.values.every((v) => Boolean(ev(v)));
        break;
      case 'or':
        result = node.values.some((v) => Boolean(ev(v)));
        break;
      default: {
        const l = ev(node.left),
          r = ev(node.right);
        switch (node.op) {
          case 'eq':
            result = JSON.stringify(l) === JSON.stringify(r);
            break;
          case 'ne':
            result = JSON.stringify(l) !== JSON.stringify(r);
            break;
          case 'gt':
            result = typeof l === 'number' && typeof r === 'number' && l > r;
            break;
          case 'gte':
            result = typeof l === 'number' && typeof r === 'number' && l >= r;
            break;
          case 'lt':
            result = typeof l === 'number' && typeof r === 'number' && l < r;
            break;
          case 'lte':
            result = typeof l === 'number' && typeof r === 'number' && l <= r;
            break;
          case 'in':
            result = Array.isArray(r) && r.some((v) => JSON.stringify(v) === JSON.stringify(l));
            break;
        }
      }
    }
    if (trace.length < 100)
      trace.push({ op: node.op, result: typeof result === 'object' ? '[structured]' : result });
    return result;
  };
  try {
    return { decision: ev(expression) === true, trace };
  } catch {
    return { decision: false, trace: [...trace, { op: 'default-deny', result: false }] };
  }
}

export type WorkflowSpec = Readonly<{
  states: readonly string[];
  initialState: string;
  terminalStates: readonly string[];
  transitions: readonly Readonly<{ from: string; to: string; decision: string }>[];
  steps: readonly Readonly<{
    key: string;
    order: number;
    eligibleRoles: readonly string[];
    eligibleActors: readonly Identifier[];
    quorum: number;
    separateFromRequester: boolean;
  }>[];
}>;
export function validateWorkflowSpec(value: WorkflowSpec): WorkflowSpec {
  const states = new Set(value.states);
  if (
    value.states.some((state) => !state.trim()) ||
    value.terminalStates.some((state) => !state.trim()) ||
    states.size !== value.states.length ||
    states.size < 2 ||
    !states.has(value.initialState) ||
    value.terminalStates.length < 1 ||
    value.terminalStates.some((s) => !states.has(s))
  )
    throw new DomainError(
      'invalid_request',
      'Workflow states or initial/terminal state are invalid',
    );
  if (
    value.transitions.length < 1 ||
    value.transitions.some(
      (t) => !t.decision.trim() || !states.has(t.from) || !states.has(t.to) || t.from === t.to,
    ) ||
    value.steps.length < 1 ||
    value.steps.some(
      (s, i) =>
        !s.key.trim() ||
        s.eligibleActors.some((candidate) => !candidate.trim()) ||
        s.eligibleRoles.some((candidate) => !candidate.trim()) ||
        s.order !== i + 1 ||
        s.quorum !== 1 ||
        s.eligibleActors.length + s.eligibleRoles.length === 0,
    )
  )
    throw new DomainError(
      'invalid_request',
      'Workflow transitions or steps are invalid; foundation workflows require quorum 1',
    );
  return value;
}

export type RoleRecord = Readonly<{
  id: Identifier;
  organizationId: Identifier;
  code: string;
  name: string;
  version: number;
}>;
export type PermissionRecord = Readonly<{
  id: Identifier;
  capability: PermissionKey;
  description: string;
}>;
export type RolePermissionGrantRecord = Readonly<{
  roleId: Identifier;
  permissionId: Identifier;
  fields: readonly string[] | null;
  scopes: readonly DataScope[];
}>;
export type RoleAssignmentRecord = Readonly<{ employeeId: Identifier; roleId: Identifier }>;
export type DirectScopeGrantRecord = Readonly<{
  id: Identifier;
  employeeId: Identifier;
  permissionId: Identifier;
  scope: DataScope;
  organizationId: Identifier | null;
}>;
export type AuthorizationRepository = {
  listRoles(companyId: Identifier): Promise<readonly RoleRecord[]>;
  createRole(
    input: Readonly<{ code: string; name: string }>,
    actor: Actor,
    correlationId: string,
  ): Promise<RoleRecord>;
  listPermissions(): Promise<readonly PermissionRecord[]>;
  createPermission(
    input: Readonly<{ capability: PermissionKey; description: string }>,
    actor: Actor,
    correlationId: string,
  ): Promise<PermissionRecord>;
  listGrants(companyId: Identifier): Promise<readonly RolePermissionGrantRecord[]>;
  grant(
    input: Readonly<{
      roleId: Identifier;
      permissionId: Identifier;
      scopes: readonly DataScope[];
      fields: readonly string[] | null;
    }>,
    actor: Actor,
    correlationId: string,
  ): Promise<void>;
  revoke(
    roleId: Identifier,
    permissionId: Identifier,
    actor: Actor,
    correlationId: string,
  ): Promise<void>;
  listAssignments(companyId: Identifier): Promise<readonly RoleAssignmentRecord[]>;
  assign(
    employeeId: Identifier,
    roleId: Identifier,
    actor: Actor,
    correlationId: string,
  ): Promise<void>;
  unassign(
    employeeId: Identifier,
    roleId: Identifier,
    actor: Actor,
    correlationId: string,
  ): Promise<void>;
  listScopeGrants(companyId: Identifier): Promise<readonly DirectScopeGrantRecord[]>;
  grantScope(
    input: Readonly<{
      employeeId: Identifier;
      permissionId: Identifier;
      scope: DataScope;
      organizationId: Identifier | null;
    }>,
    actor: Actor,
    correlationId: string,
  ): Promise<DirectScopeGrantRecord>;
  revokeScope(id: Identifier, actor: Actor, correlationId: string): Promise<void>;
};
