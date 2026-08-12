import { randomUUID } from 'node:crypto';
import {
  assertEffectiveRange,
  assertStableCode,
  DomainError,
  parseEffectiveTimestamp,
  type AuthorizationRepository,
  type EmployeeRepository,
  type OrganizationRepository,
  NOOP_TELEMETRY,
  type OperationalLogger,
  type Telemetry,
} from '@kingturf/domain';
import { DATA_SCOPES, type DataScope, type ErrorCode, type PermissionKey } from '@kingturf/types';
import { authorizeQuery } from './policy.ts';
import type { AuthenticationService } from './security.ts';
import type {
  PostgresAuditRepository,
  PostgresMasterDataRepository,
  PostgresNumberRepository,
  PostgresRuleRepository,
  PostgresWorkflowRepository,
} from './platform-repositories.ts';
import type {
  PostgresAttachmentRepository,
  PostgresBusinessObjectRepository,
  PostgresEventRepository,
  PostgresNotificationRepository,
} from './foundation-repositories.ts';

type Json = unknown;
export type ApiRequest = Readonly<{
  method: string;
  pathname: string;
  query?: Readonly<Record<string, string | undefined>>;
  headers?: Readonly<Record<string, string | undefined>>;
  body?: unknown;
}>;
export type ApiResponse = Readonly<{
  body: Json;
  statusCode: number;
  headers?: Readonly<Record<string, string>>;
}>;
export type ApiDependencies = Readonly<{
  auth: AuthenticationService;
  organizations: OrganizationRepository;
  employees: EmployeeRepository;
  authorization?: AuthorizationRepository;
  audit?: PostgresAuditRepository;
  masterData?: PostgresMasterDataRepository;
  numbers?: PostgresNumberRepository;
  rules?: PostgresRuleRepository;
  workflows?: PostgresWorkflowRepository;
  notifications?: PostgresNotificationRepository;
  attachments?: PostgresAttachmentRepository;
  events?: PostgresEventRepository;
  businessObjects?: PostgresBusinessObjectRepository;
  readiness?: () => Promise<boolean>;
  telemetry?: Telemetry;
  logger?: OperationalLogger;
}>;
export type ApiApplication = Readonly<{
  dispatch(request: ApiRequest): Promise<ApiResponse>;
  rejectOversized(correlationId?: string): ApiResponse;
}>;
const error = (
  statusCode: number,
  code: ErrorCode,
  message: string,
  correlationId: string,
  details?: readonly string[],
): ApiResponse => ({
  statusCode,
  body: { error: { code, message, correlationId, ...(details ? { details } : {}) } },
});
const objectBody = (body: unknown): Record<string, unknown> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new DomainError('invalid_request', 'A JSON object body is required');
  return body as Record<string, unknown>;
};
const string = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('invalid_request', `${name} is required`);
  return value.trim();
};
const bearer = (headers: Readonly<Record<string, string | undefined>>): string | null => {
  const value = headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CAPABILITY = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/u;
const correlation = (value: string | undefined): string =>
  value && UUID.test(value) ? value : randomUUID();
const uuid = (value: unknown, name: string): string => {
  const result = string(value, name);
  if (!UUID.test(result)) throw new DomainError('invalid_request', `${name} must be a UUID`);
  return result;
};
const allow = (body: Record<string, unknown>, fields: readonly string[]): void => {
  const unexpected = Object.keys(body).filter((key) => !fields.includes(key));
  if (unexpected.length)
    throw new DomainError('invalid_request', `Unsupported fields: ${unexpected.sort().join(', ')}`);
};
const version = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new DomainError('invalid_request', 'version must be a positive integer');
  return value;
};
const expectedVersion = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new DomainError('invalid_request', 'expectedVersion must be a non-negative integer');
  return value;
};
const strings = (value: unknown, name: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim()))
    throw new DomainError('invalid_request', `${name} must be an array of non-empty strings`);
  return [...new Set(value as string[])].sort();
};
const notificationChannel = (value: unknown): string => {
  const channel = string(value, 'channel');
  if (!['IN_APP', 'EMAIL', 'SMS', 'PUSH'].includes(channel))
    throw new DomainError('invalid_request', 'channel is unsupported');
  return channel;
};
const attachmentBytes = (value: unknown): Uint8Array => {
  const encoded = string(value, 'contentBase64');
  if (encoded.length > 34_952_536)
    throw new DomainError('invalid_request', 'Attachment transport exceeds 25 MiB');
  if (
    encoded.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
  )
    throw new DomainError('invalid_request', 'contentBase64 must be canonical base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength > 26_214_400)
    throw new DomainError('invalid_request', 'Attachment transport exceeds 25 MiB');
  return bytes;
};
const integer = (value: unknown, name: string, minimum: number, maximum: number): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new DomainError(
      'invalid_request',
      `${name} must be an integer between ${String(minimum)} and ${String(maximum)}`,
    );
  return value;
};
const effectiveRange = (body: Record<string, unknown>) => {
  const effectiveFrom = string(body.effectiveFrom, 'effectiveFrom');
  const effectiveTo =
    body.effectiveTo === null || body.effectiveTo === undefined
      ? null
      : string(body.effectiveTo, 'effectiveTo');
  assertEffectiveRange(effectiveFrom, effectiveTo);
  return { effectiveFrom, effectiveTo };
};
const scopes = (value: unknown): readonly DataScope[] => {
  const values = strings(value, 'scopes');
  if (values.length === 0 || values.some((v) => !DATA_SCOPES.includes(v as DataScope)))
    throw new DomainError('invalid_request', 'scopes contains an unsupported DataScope');
  return values as DataScope[];
};

export function buildApp(dependencies?: ApiDependencies): ApiApplication {
  const telemetry = dependencies?.telemetry ?? NOOP_TELEMETRY;
  const application: Pick<ApiApplication, 'dispatch'> = {
    async dispatch(request) {
      const correlationId = correlation(request.headers?.['x-correlation-id']);
      try {
        if (request.method === 'GET' && request.pathname === '/health')
          return { statusCode: 200, body: { status: 'ok' } };
        if (request.method === 'GET' && request.pathname === '/ready') {
          const ready = dependencies?.readiness ? await dependencies.readiness() : false;
          return ready
            ? { statusCode: 200, body: { status: 'ready' } }
            : error(503, 'internal_error', 'Dependency unavailable', correlationId);
        }
        if (!dependencies)
          return error(
            503,
            'internal_error',
            'Application dependencies are unavailable',
            correlationId,
          );
        if (request.method === 'POST' && request.pathname === '/api/v1/auth/login') {
          const body = objectBody(request.body);
          const result = await dependencies.auth.login(
            string(body.login, 'login'),
            string(body.password, 'password'),
            correlationId,
          );
          return result
            ? { statusCode: 200, body: result }
            : {
                statusCode: 401,
                body: {
                  error: {
                    code: 'authentication_required',
                    message: 'Invalid credentials',
                    correlationId,
                  },
                },
              };
        }
        const token = bearer(request.headers ?? {});
        const context = token ? await dependencies.auth.authenticate(token) : null;
        if (context === null)
          return error(
            401,
            'authentication_required',
            'A valid session is required',
            correlationId,
          );
        if (token === null)
          return error(
            401,
            'authentication_required',
            'A valid session is required',
            correlationId,
          );
        if (request.method === 'POST' && request.pathname === '/api/v1/auth/logout') {
          await dependencies.auth.logout(token, context, correlationId);
          return { statusCode: 204, body: {} };
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/auth/session')
          return {
            statusCode: 200,
            body: { employeeId: context.actor.employeeId, companyId: context.actor.companyId },
          };
        if (request.method === 'PUT' && request.pathname === '/api/v1/auth/credential') {
          const body = objectBody(request.body);
          await dependencies.auth.changePassword(
            context,
            string(body.password, 'password'),
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const organizationMatch = /^\/api\/v1\/organizations(?:\/([0-9a-f-]+))?$/u.exec(
          request.pathname,
        );
        if (organizationMatch) {
          const id = organizationMatch[1];
          if (request.method === 'GET' && !id) {
            authorizeQuery(context, 'organization:read');
            return {
              statusCode: 200,
              body: await dependencies.organizations.list(context.actor.companyId),
            };
          }
          if (request.method === 'GET' && id) {
            authorizeQuery(context, 'organization:read');
            const found = await dependencies.organizations.findById(
              uuid(id, 'organizationId'),
              context.actor.companyId,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Organization not found', correlationId);
          }
          if (request.method === 'POST' && !id) {
            authorizeQuery(context, 'organization:create');
            const b = objectBody(request.body);
            allow(b, ['parentId', 'code', 'name', 'locale', 'currency']);
            const created = await dependencies.organizations.create(
              {
                ownerOrganizationId: context.actor.companyId,
                parentId:
                  b.parentId === null || b.parentId === undefined
                    ? null
                    : uuid(b.parentId, 'parentId'),
                code: string(b.code, 'code'),
                name: string(b.name, 'name'),
                locale: typeof b.locale === 'string' ? b.locale : 'zh-CN',
                currency: typeof b.currency === 'string' ? b.currency : 'CNY',
                active: true,
              },
              context.actor,
              correlationId,
            );
            return { statusCode: 201, body: created };
          }
          if (request.method === 'PATCH' && id) {
            const b = objectBody(request.body);
            allow(b, ['name', 'parentId', 'active', 'locale', 'currency', 'version']);
            const fields = Object.keys(b).filter((k) => k !== 'version');
            authorizeQuery(context, 'organization:update', fields);
            const patch = {
              ...(typeof b.name === 'string' ? { name: string(b.name, 'name') } : {}),
              ...(Object.hasOwn(b, 'parentId')
                ? { parentId: b.parentId === null ? null : uuid(b.parentId, 'parentId') }
                : {}),
              ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
              ...(typeof b.locale === 'string' ? { locale: string(b.locale, 'locale') } : {}),
              ...(typeof b.currency === 'string'
                ? { currency: string(b.currency, 'currency') }
                : {}),
            };
            const updated = await dependencies.organizations.update(
              uuid(id, 'organizationId'),
              context.actor.companyId,
              patch,
              version(b.version),
              context.actor,
              correlationId,
            );
            return { statusCode: 200, body: updated };
          }
        }
        const employeeMatch = /^\/api\/v1\/employees(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
        if (employeeMatch) {
          const id = employeeMatch[1];
          if (request.method === 'GET' && !id) {
            const grant = authorizeQuery(context, 'employee:read');
            return {
              statusCode: 200,
              body: await dependencies.employees.list(
                context.actor.companyId,
                grant.scopes,
                context.actor.employeeId,
                grant.anchors,
              ),
            };
          }
          if (request.method === 'GET' && id) {
            const grant = authorizeQuery(context, 'employee:read');
            const found = await dependencies.employees.findById(
              uuid(id, 'employeeId'),
              context.actor.companyId,
              grant.scopes,
              context.actor.employeeId,
              grant.anchors,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Employee not found', correlationId);
          }
          if (request.method === 'POST' && !id) {
            authorizeQuery(context, 'employee:create');
            const b = objectBody(request.body);
            allow(b, ['organizationId', 'employeeNumber', 'displayName', 'email']);
            const created = await dependencies.employees.create(
              {
                companyId: context.actor.companyId,
                organizationId: uuid(b.organizationId, 'organizationId'),
                employeeNumber: string(b.employeeNumber, 'employeeNumber'),
                displayName: string(b.displayName, 'displayName'),
                email: string(b.email, 'email'),
                active: true,
              },
              context.actor,
              correlationId,
            );
            return { statusCode: 201, body: created };
          }
          if (request.method === 'PATCH' && id) {
            const b = objectBody(request.body);
            allow(b, ['displayName', 'email', 'organizationId', 'active', 'version']);
            const fields = Object.keys(b).filter((k) => k !== 'version');
            const grant = authorizeQuery(context, 'employee:update', fields);
            const patch = {
              ...(typeof b.displayName === 'string'
                ? { displayName: string(b.displayName, 'displayName') }
                : {}),
              ...(typeof b.email === 'string' ? { email: string(b.email, 'email') } : {}),
              ...(typeof b.organizationId === 'string'
                ? { organizationId: uuid(b.organizationId, 'organizationId') }
                : {}),
              ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
            };
            const updated = await dependencies.employees.update(
              uuid(id, 'employeeId'),
              context.actor.companyId,
              patch,
              version(b.version),
              context.actor,
              grant.scopes,
              grant.anchors,
              correlationId,
            );
            return { statusCode: 200, body: updated };
          }
        }
        const authorizationMatch =
          /^\/api\/v1\/(roles|permissions|grants|assignments|scope-grants)(?:\/([0-9a-f-]+))?$/u.exec(
            request.pathname,
          );
        if (authorizationMatch) {
          const capability: PermissionKey = `authorization:${request.method === 'GET' ? 'read' : 'manage'}`;
          authorizeQuery(context, capability);
          const repository = dependencies.authorization;
          if (!repository)
            return error(
              503,
              'internal_error',
              'Authorization repository is unavailable',
              correlationId,
            );
          const resource = authorizationMatch[1];
          const b =
            request.method === 'GET' ||
            (request.method === 'DELETE' && Boolean(authorizationMatch[2]))
              ? {}
              : objectBody(request.body);
          const itemId = authorizationMatch[2];
          if (resource === 'roles' && !itemId) {
            if (request.method === 'GET')
              return { statusCode: 200, body: await repository.listRoles(context.actor.companyId) };
            if (request.method === 'POST') {
              allow(b, ['code', 'name']);
              return {
                statusCode: 201,
                body: await repository.createRole(
                  { code: string(b.code, 'code'), name: string(b.name, 'name') },
                  context.actor,
                  correlationId,
                ),
              };
            }
          }
          if (resource === 'permissions' && !itemId) {
            if (request.method === 'GET')
              return { statusCode: 200, body: await repository.listPermissions() };
            if (request.method === 'POST') {
              allow(b, ['capability', 'description']);
              const value = string(b.capability, 'capability');
              if (!CAPABILITY.test(value))
                throw new DomainError(
                  'invalid_request',
                  'capability must use resource:action syntax',
                );
              return {
                statusCode: 201,
                body: await repository.createPermission(
                  {
                    capability: value as PermissionKey,
                    description: string(b.description, 'description'),
                  },
                  context.actor,
                  correlationId,
                ),
              };
            }
          }
          if (resource === 'grants' && !itemId) {
            if (request.method === 'GET')
              return {
                statusCode: 200,
                body: await repository.listGrants(context.actor.companyId),
              };
            allow(b, ['roleId', 'permissionId', 'scopes', 'fields']);
            const roleId = uuid(b.roleId, 'roleId'),
              permissionId = uuid(b.permissionId, 'permissionId');
            if (request.method === 'POST') {
              const fields =
                b.fields === null || b.fields === undefined ? null : strings(b.fields, 'fields');
              if (fields?.some((field) => !/^[A-Za-z][A-Za-z0-9]*$/u.test(field)))
                throw new DomainError(
                  'invalid_request',
                  'fields contains an unsupported field name',
                );
              await repository.grant(
                { roleId, permissionId, scopes: scopes(b.scopes), fields },
                context.actor,
                correlationId,
              );
              return { statusCode: 204, body: {} };
            }
            if (request.method === 'DELETE') {
              await repository.revoke(roleId, permissionId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
          }
          if (resource === 'assignments' && !itemId) {
            if (request.method === 'GET')
              return {
                statusCode: 200,
                body: await repository.listAssignments(context.actor.companyId),
              };
            allow(b, ['employeeId', 'roleId']);
            const employeeId = uuid(b.employeeId, 'employeeId'),
              roleId = uuid(b.roleId, 'roleId');
            if (request.method === 'POST') {
              await repository.assign(employeeId, roleId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
            if (request.method === 'DELETE') {
              await repository.unassign(employeeId, roleId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
          }
          if (resource === 'scope-grants') {
            if (request.method === 'GET' && !itemId)
              return {
                statusCode: 200,
                body: await repository.listScopeGrants(context.actor.companyId),
              };
            if (request.method === 'POST' && !itemId) {
              allow(b, ['employeeId', 'permissionId', 'scope', 'organizationId']);
              const selected = scopes([b.scope])[0];
              if (!selected) throw new DomainError('invalid_request', 'scope is required');
              const organizationId =
                b.organizationId === null || b.organizationId === undefined
                  ? null
                  : uuid(b.organizationId, 'organizationId');
              const typed =
                selected === 'TEAM' || selected === 'DEPARTMENT' || selected === 'REGION';
              if (typed !== Boolean(organizationId))
                throw new DomainError(
                  'invalid_request',
                  typed
                    ? 'Typed scopes require organizationId'
                    : 'SELF, COMPANY, and GROUP do not accept organizationId',
                );
              return {
                statusCode: 201,
                body: await repository.grantScope(
                  {
                    employeeId: uuid(b.employeeId, 'employeeId'),
                    permissionId: uuid(b.permissionId, 'permissionId'),
                    scope: selected,
                    organizationId,
                  },
                  context.actor,
                  correlationId,
                ),
              };
            }
            if (request.method === 'DELETE' && itemId) {
              allow(b, []);
              await repository.revokeScope(
                uuid(itemId, 'scopeGrantId'),
                context.actor,
                correlationId,
              );
              return { statusCode: 204, body: {} };
            }
          }
        }
        const auditMatch = /^\/api\/v1\/audit-events(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
        if (auditMatch && request.method === 'GET') {
          const auditGrant = authorizeQuery(context, 'audit:read');
          if (!dependencies.audit)
            return error(503, 'internal_error', 'Audit repository unavailable', correlationId);
          const id = auditMatch[1];
          if (id) {
            const found = await dependencies.audit.find(
              uuid(id, 'auditEventId'),
              context.actor.companyId,
              auditGrant.scopes,
              context.actor.employeeId,
              auditGrant.anchors,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Audit event not found', correlationId);
          }
          const q = request.query ?? {};
          return {
            statusCode: 200,
            body: await dependencies.audit.list(
              context.actor.companyId,
              {
                ...(q.actorId ? { actorId: uuid(q.actorId, 'actorId') } : {}),
                ...(q.action ? { action: q.action } : {}),
                ...(q.targetType ? { targetType: q.targetType } : {}),
                ...(q.targetId ? { targetId: uuid(q.targetId, 'targetId') } : {}),
                ...(q.correlationId
                  ? { correlationId: uuid(q.correlationId, 'correlationId') }
                  : {}),
                ...(q.from ? { from: q.from } : {}),
                ...(q.to ? { to: q.to } : {}),
                ...(q.cursor ? { cursor: uuid(q.cursor, 'cursor') } : {}),
                ...(q.limit ? { limit: Number(q.limit) } : {}),
              },
              auditGrant.scopes,
              context.actor.employeeId,
              auditGrant.anchors,
            ),
          };
        }
        if (request.pathname === '/api/v1/master-data/categories' && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.masterData.listCategories(
              context.actor.companyId,
              request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
            ),
          };
        }
        if (request.pathname === '/api/v1/master-data/categories' && request.method === 'POST') {
          authorizeQuery(context, 'master-data:create');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['code', 'name', 'description', 'effectiveFrom', 'effectiveTo']);
          const range = effectiveRange(b);
          return {
            statusCode: 201,
            body: await dependencies.masterData.createCategory(
              {
                code: assertStableCode(string(b.code, 'code')),
                name: string(b.name, 'name'),
                description:
                  b.description === null || b.description === undefined
                    ? null
                    : string(b.description, 'description'),
                ...range,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const category = /^\/api\/v1\/master-data\/categories\/([0-9a-f-]+)$/u.exec(
          request.pathname,
        );
        if (category && request.method === 'PATCH') {
          authorizeQuery(context, 'master-data:update');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['name', 'description', 'effectiveFrom', 'effectiveTo', 'version']);
          const range = effectiveRange(b);
          return {
            statusCode: 200,
            body: await dependencies.masterData.updateCategory(
              uuid(category[1], 'categoryId'),
              {
                name: string(b.name, 'name'),
                description:
                  b.description === null || b.description === undefined
                    ? null
                    : string(b.description, 'description'),
                ...range,
                version: version(b.version),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        if (category && request.method === 'DELETE') {
          authorizeQuery(context, 'master-data:delete');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          await dependencies.masterData.deleteCategory(
            uuid(category[1], 'categoryId'),
            version(Number(request.query?.version)),
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (request.pathname === '/api/v1/master-data/entries' && request.method === 'POST') {
          authorizeQuery(context, 'master-data:create');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['categoryId', 'code', 'label', 'value', 'effectiveFrom', 'effectiveTo']);
          const range = effectiveRange(b);
          return {
            statusCode: 201,
            body: await dependencies.masterData.createEntry(
              {
                categoryId: uuid(b.categoryId, 'categoryId'),
                code: assertStableCode(string(b.code, 'code')),
                label: string(b.label, 'label'),
                value: objectBody(b.value) as never,
                ...range,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/number-definitions' && request.method === 'POST') {
          authorizeQuery(context, 'number:create');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, [
            'code',
            'prefix',
            'suffix',
            'padding',
            'startingValue',
            'increment',
            'resetPeriod',
          ]);
          return {
            statusCode: 201,
            body: await dependencies.numbers.createDefinition(
              {
                code: assertStableCode(string(b.code, 'code')),
                prefix: typeof b.prefix === 'string' ? b.prefix : '',
                suffix: typeof b.suffix === 'string' ? b.suffix : '',
                padding: integer(b.padding, 'padding', 1, 32),
                startingValue: integer(
                  b.startingValue,
                  'startingValue',
                  0,
                  Number.MAX_SAFE_INTEGER,
                ),
                increment: integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
                resetPeriod: string(b.resetPeriod, 'resetPeriod') as never,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const publishNumber = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (publishNumber && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.numbers.publish(
              uuid(publishNumber[1], 'definitionId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const allocate = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/allocate$/u.exec(
          request.pathname,
        );
        if (allocate && request.method === 'POST') {
          authorizeQuery(context, 'number:allocate');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          return {
            statusCode: 201,
            body: await dependencies.numbers.allocate(
              uuid(allocate[1], 'definitionId'),
              key,
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/rules' && request.method === 'POST') {
          authorizeQuery(context, 'rule:create');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'ast', 'requiredInputs']);
          return {
            statusCode: 201,
            body: await dependencies.rules.create(
              {
                code: assertStableCode(string(b.code, 'code')),
                ast: b.ast,
                requiredInputs: strings(b.requiredInputs ?? [], 'requiredInputs'),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const publishRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
        if (publishRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.rules.publish(
              uuid(publishRule[1], 'ruleId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const evaluateRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/evaluate$/u.exec(request.pathname);
        if (evaluateRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:evaluate');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['input']);
          return {
            statusCode: 200,
            body: await dependencies.rules.evaluate(
              uuid(evaluateRule[1], 'ruleId'),
              objectBody(b.input) as never,
              key,
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/master-data/entries' && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.masterData.listEntries(
              context.actor.companyId,
              request.query?.categoryId ? uuid(request.query.categoryId, 'categoryId') : null,
              request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
            ),
          };
        }
        const entry = /^\/api\/v1\/master-data\/entries\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (entry && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const found = await dependencies.masterData.findEntry(
            uuid(entry[1], 'entryId'),
            context.actor.companyId,
            request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Master-data entry not found', correlationId);
        }
        if (entry && request.method === 'PATCH') {
          authorizeQuery(context, 'master-data:update');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['label', 'value', 'effectiveFrom', 'effectiveTo', 'version']);
          const range = effectiveRange(b);
          return {
            statusCode: 200,
            body: await dependencies.masterData.updateEntry(
              uuid(entry[1], 'entryId'),
              {
                label: string(b.label, 'label'),
                value: objectBody(b.value) as never,
                ...range,
                version: version(b.version),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        if (entry && request.method === 'DELETE') {
          authorizeQuery(context, 'master-data:delete');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          await dependencies.masterData.deleteEntry(
            uuid(entry[1], 'entryId'),
            version(Number(request.query?.version)),
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const numberVersion = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (numberVersion && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['prefix', 'suffix', 'padding', 'startingValue', 'increment', 'resetPeriod']);
          return {
            statusCode: 201,
            body: await dependencies.numbers.createVersion(
              uuid(numberVersion[1], 'definitionId'),
              {
                prefix: typeof b.prefix === 'string' ? b.prefix : '',
                suffix: typeof b.suffix === 'string' ? b.suffix : '',
                padding: integer(b.padding, 'padding', 1, 32),
                startingValue: integer(
                  b.startingValue,
                  'startingValue',
                  0,
                  Number.MAX_SAFE_INTEGER,
                ),
                increment: integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
                resetPeriod: string(b.resetPeriod, 'resetPeriod') as never,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const ruleVersion = /^\/api\/v1\/rules\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
        if (ruleVersion && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['ast', 'requiredInputs']);
          return {
            statusCode: 201,
            body: await dependencies.rules.createVersion(
              uuid(ruleVersion[1], 'ruleId'),
              { ast: b.ast, requiredInputs: strings(b.requiredInputs ?? [], 'requiredInputs') },
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/workflows' && request.method === 'POST') {
          authorizeQuery(context, 'workflow:create');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'spec']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.create(
              { code: assertStableCode(string(b.code, 'code')), spec: objectBody(b.spec) as never },
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowVersion = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (workflowVersion && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['spec']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.createVersion(
              uuid(workflowVersion[1], 'workflowId'),
              objectBody(b.spec) as never,
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowPublish = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (workflowPublish && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.workflows.publish(
              uuid(workflowPublish[1], 'workflowId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowStart = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/instances$/u.exec(
          request.pathname,
        );
        if (workflowStart && request.method === 'POST') {
          authorizeQuery(context, 'workflow:start');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['subjectType', 'subjectId']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.start(
              uuid(workflowStart[1], 'workflowId'),
              string(b.subjectType, 'subjectType'),
              uuid(b.subjectId, 'subjectId'),
              key,
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/workflow-tasks' && request.method === 'GET') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          return { statusCode: 200, body: await dependencies.workflows.listTasks(context.actor) };
        }
        const decide = /^\/api\/v1\/workflow-tasks\/([0-9a-f-]+)\/decisions$/u.exec(
          request.pathname,
        );
        if (decide && request.method === 'POST') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['decision', 'comment', 'version']);
          return {
            statusCode: 200,
            body: await dependencies.workflows.decide(
              uuid(decide[1], 'taskId'),
              string(b.decision, 'decision'),
              b.comment == null ? null : string(b.comment, 'comment'),
              key,
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/notifications' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.notifications.list(
              context.actor,
              request.query?.unread === 'true',
            ),
          };
        }
        if (request.pathname === '/api/v1/notifications/unread-count' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: { count: await dependencies.notifications.unread(context.actor) },
          };
        }
        const notification = /^\/api\/v1\/notifications\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (notification && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const found = await dependencies.notifications.find(
            uuid(notification[1], 'notificationId'),
            context.actor,
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Notification not found', correlationId);
        }
        const readState = /^\/api\/v1\/notifications\/([0-9a-f-]+)\/(read|unread)$/u.exec(
          request.pathname,
        );
        if (readState && request.method === 'PUT') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          await dependencies.notifications.setRead(
            uuid(readState[1], 'notificationId'),
            readState[2] === 'read',
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (request.pathname === '/api/v1/notification-preferences' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.notifications.preferences(context.actor),
          };
        }
        if (request.pathname === '/api/v1/notification-preferences' && request.method === 'PUT') {
          authorizeQuery(context, 'notification:manage');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['channel', 'enabled', 'expectedVersion']);
          if (typeof b.enabled !== 'boolean')
            throw new DomainError('invalid_request', 'enabled must be boolean');
          if (b.expectedVersion === undefined)
            throw new DomainError('invalid_request', 'expectedVersion is required');
          return {
            statusCode: 200,
            body: await dependencies.notifications.setPreference(
              notificationChannel(b.channel),
              b.enabled,
              expectedVersion(b.expectedVersion),
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/internal/notifications' && request.method === 'POST') {
          const authorized = authorizeQuery(context, 'notification:manage');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['kind', 'title', 'message', 'recipients', 'subjectType', 'subjectId']);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          return {
            statusCode: 201,
            body: await dependencies.notifications.create(
              {
                kind: string(b.kind, 'kind'),
                title: string(b.title, 'title'),
                message: string(b.message, 'message'),
                recipients: strings(b.recipients, 'recipients').map((recipient) =>
                  uuid(recipient, 'recipient'),
                ),
                ...(b.subjectType ? { subjectType: string(b.subjectType, 'subjectType') } : {}),
                ...(b.subjectId ? { subjectId: uuid(b.subjectId, 'subjectId') } : {}),
                idempotencyKey: key,
              },
              context.actor,
              correlationId,
              authorized.scopes,
              authorized.anchors,
            ),
          };
        }
        if (request.pathname === '/api/v1/attachments' && request.method === 'POST') {
          authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['name', 'mimeType', 'size', 'checksum']);
          return {
            statusCode: 201,
            body: await dependencies.attachments.create(
              {
                name: string(b.name, 'name'),
                mimeType: string(b.mimeType, 'mimeType'),
                size: integer(b.size, 'size', 1, 26_214_400),
                checksum: string(b.checksum, 'checksum'),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const attachmentUpload = /^\/api\/v1\/attachments\/([0-9a-f-]+)\/content$/u.exec(
          request.pathname,
        );
        if (attachmentUpload && request.method === 'PUT') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['contentBase64']);
          return {
            statusCode: 200,
            body: await dependencies.attachments.upload(
              uuid(attachmentUpload[1], 'attachmentId'),
              attachmentBytes(b.contentBase64),
              context.actor,
              grant.scopes,
              grant.anchors,
              correlationId,
            ),
          };
        }
        const attachmentBind = /^\/api\/v1\/attachments\/([0-9a-f-]+)\/bindings$/u.exec(
          request.pathname,
        );
        if (attachmentBind && request.method === 'POST') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['objectType', 'objectId']);
          await dependencies.attachments.bind(
            uuid(attachmentBind[1], 'attachmentId'),
            string(b.objectType, 'objectType'),
            uuid(b.objectId, 'objectId'),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (attachmentBind && request.method === 'DELETE') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['objectType', 'objectId']);
          await dependencies.attachments.unbind(
            uuid(attachmentBind[1], 'attachmentId'),
            string(b.objectType, 'objectType'),
            uuid(b.objectId, 'objectId'),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const attachment = /^\/api\/v1\/attachments\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (attachment && request.method === 'GET') {
          const grant = authorizeQuery(context, 'attachment:read');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const found = await dependencies.attachments.download(
            uuid(attachment[1], 'attachmentId'),
            context.actor,
            grant.scopes,
            grant.anchors,
          );
          return found
            ? {
                statusCode: 200,
                body: {
                  metadata: found.metadata,
                  contentBase64: Buffer.from(found.bytes).toString('base64'),
                },
              }
            : error(404, 'not_found', 'Attachment not found', correlationId);
        }
        if (attachment && request.method === 'DELETE') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          await dependencies.attachments.remove(
            uuid(attachment[1], 'attachmentId'),
            version(b.version),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (request.pathname === '/api/v1/business-objects' && request.method === 'GET') {
          authorizeQuery(context, 'business-object:read');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.businessObjects.list(context.actor.companyId),
          };
        }
        if (request.pathname === '/api/v1/business-objects' && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'name', 'schema']);
          return {
            statusCode: 201,
            body: await dependencies.businessObjects.create(
              string(b.code, 'code'),
              string(b.name, 'name'),
              b.schema,
              context.actor,
              correlationId,
            ),
          };
        }
        const objectVersion = /^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (objectVersion && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['schema']);
          return {
            statusCode: 201,
            body: await dependencies.businessObjects.addVersion(
              uuid(objectVersion[1], 'definitionId'),
              b.schema,
              context.actor,
              correlationId,
            ),
          };
        }
        const objectPublish =
          /^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions\/(\d+)\/publish$/u.exec(
            request.pathname,
          );
        if (objectPublish && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.businessObjects.publish(
              uuid(objectPublish[1], 'definitionId'),
              Number(objectPublish[2]),
              context.actor,
              correlationId,
            ),
          };
        }
        const object = /^\/api\/v1\/business-objects\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (object && request.method === 'GET') {
          authorizeQuery(context, 'business-object:read');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const found = await dependencies.businessObjects.find(
            uuid(object[1], 'definitionId'),
            context.actor.companyId,
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Business object not found', correlationId);
        }
        if (request.pathname === '/api/v1/operations/events' && request.method === 'GET') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.events.counts(context.actor.companyId),
          };
        }
        if (request.pathname === '/api/v1/operations/events/claims' && request.method === 'POST') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['consumer', 'worker', 'limit', 'leaseSeconds']);
          return {
            statusCode: 200,
            body: await dependencies.events.claim(
              context.actor,
              string(b.consumer, 'consumer'),
              string(b.worker, 'worker'),
              b.limit === undefined ? undefined : integer(b.limit, 'limit', 1, 100),
              b.leaseSeconds === undefined
                ? undefined
                : integer(b.leaseSeconds, 'leaseSeconds', 5, 300),
            ),
          };
        }
        const eventDelivery =
          /^\/api\/v1\/operations\/events\/([0-9a-f-]+)\/(complete|retry|dead-letter)$/u.exec(
            request.pathname,
          );
        if (eventDelivery && request.method === 'POST') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          const b = objectBody(request.body);
          const action = eventDelivery[2];
          allow(
            b,
            action === 'complete'
              ? ['consumer', 'claimToken']
              : ['consumer', 'claimToken', 'errorCode', 'maxAttempts'],
          );
          const eventId = uuid(eventDelivery[1], 'eventId');
          const consumer = string(b.consumer, 'consumer');
          const claimToken = uuid(b.claimToken, 'claimToken');
          if (action === 'complete')
            await dependencies.events.complete(eventId, context.actor, consumer, claimToken);
          else
            await dependencies.events.fail(
              eventId,
              context.actor,
              consumer,
              claimToken,
              string(b.errorCode, 'errorCode'),
              action === 'dead-letter'
                ? 1
                : b.maxAttempts === undefined
                  ? undefined
                  : integer(b.maxAttempts, 'maxAttempts', 2, 100),
            );
          return { statusCode: 204, body: {} };
        }
        return error(404, 'not_found', 'Route not found', correlationId);
      } catch (cause) {
        if (cause instanceof DomainError) {
          const status =
            cause.code === 'forbidden'
              ? 403
              : cause.code === 'not_found'
                ? 404
                : cause.code === 'conflict'
                  ? 409
                  : 400;
          return error(status, cause.code, cause.message, correlationId);
        }
        return error(500, 'internal_error', 'Internal server error', correlationId);
      }
    },
  };
  const complete = (
    request: ApiRequest,
    correlationId: string,
    response: ApiResponse,
    started: number,
  ) => {
    const durationMs = Math.max(0, performance.now() - started);
    const route = request.pathname.startsWith('/api/')
      ? 'api'
      : request.pathname === '/health'
        ? 'health'
        : request.pathname === '/ready'
          ? 'ready'
          : 'other';
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ? request.method
      : 'OTHER';
    telemetry.count('http_requests_total', 1, {
      method,
      route,
      status: String(response.statusCode),
    });
    telemetry.timing('http_request_duration_ms', durationMs, { method, route });
    dependencies?.logger?.write({
      level: response.statusCode >= 500 ? 'error' : 'info',
      event: 'http.request.completed',
      correlationId,
      statusCode: response.statusCode,
      durationMs,
    });
    return { ...response, headers: { ...response.headers, 'x-correlation-id': correlationId } };
  };
  return {
    rejectOversized(incomingCorrelationId) {
      const correlationId = correlation(incomingCorrelationId);
      return complete(
        { method: 'OTHER', pathname: '/transport/request-body' },
        correlationId,
        error(413, 'invalid_request', 'Request body too large', correlationId),
        performance.now(),
      );
    },
    async dispatch(request) {
      const correlationId = correlation(request.headers?.['x-correlation-id']);
      const started = performance.now();
      const response = await application.dispatch({
        ...request,
        headers: { ...request.headers, 'x-correlation-id': correlationId },
      });
      return complete(request, correlationId, response, started);
    },
  };
}
