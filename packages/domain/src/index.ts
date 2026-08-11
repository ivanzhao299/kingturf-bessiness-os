import type {
  DataScope,
  EmployeeDto,
  Identifier,
  JsonObject,
  JsonValue,
  OrganizationDto,
  PermissionKey,
  RuleExpression,
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
