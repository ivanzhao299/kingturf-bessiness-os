import {
  DomainError,
  type AuthorizationContext,
  type AuthorizationRepository,
} from '@kingturf/domain';
import { DATA_SCOPES, type DataScope, type PermissionKey } from '@kingturf/types';
import type { ApiRequest, ApiResponse } from '../app.ts';
import { defineRoute, dispatchRoutes, type RouteDefinition, type RouteMatch } from './types.ts';

type AuthorizationRouteContext = Readonly<{
  repository: AuthorizationRepository | undefined;
  authorization: AuthorizationContext;
  correlationId: string;
  authorizeOneOf: (preferred: PermissionKey, fallback: PermissionKey) => void;
  unavailable: () => ApiResponse;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    strings: (value: unknown, name: string) => readonly string[];
  }>;
}>;

const CAPABILITY = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/u;
const literal =
  (pathname: string) =>
  (candidate: string): RouteMatch | null =>
    candidate === pathname ? { params: [] } : null;

function authorizationRoutes(
  context: AuthorizationRouteContext,
  repository: AuthorizationRepository,
  body: Record<string, unknown>,
) {
  const p = context.parsers;
  const actor = context.authorization.actor;
  const correlationId = context.correlationId;
  const scopes = (value: unknown): readonly DataScope[] => {
    const values = p.strings(value, 'scopes');
    if (values.length === 0 || values.some((v) => !DATA_SCOPES.includes(v as DataScope)))
      throw new DomainError('invalid_request', 'scopes contains an unsupported DataScope');
    return values as DataScope[];
  };
  const validateGrantIds = () => {
    p.allow(body, ['roleId', 'permissionId', 'scopes', 'fields']);
    return {
      roleId: p.uuid(body.roleId, 'roleId'),
      permissionId: p.uuid(body.permissionId, 'permissionId'),
    };
  };
  const validateAssignmentIds = () => {
    p.allow(body, ['employeeId', 'roleId']);
    return {
      employeeId: p.uuid(body.employeeId, 'employeeId'),
      roleId: p.uuid(body.roleId, 'roleId'),
    };
  };
  // All captured request inputs are local constants; GET deliberately has no body validator.
  const routes: readonly RouteDefinition[] = [
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/roles'),
      validate: null,
      handler: async () => ({ statusCode: 200, body: await repository.listRoles(actor.companyId) }),
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/roles'),
      validate: () => {
        p.allow(body, ['code', 'name']);
        return { code: p.string(body.code, 'code'), name: p.string(body.name, 'name') };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await repository.createRole(input, actor, correlationId),
      }),
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/permissions'),
      validate: null,
      handler: async () => ({ statusCode: 200, body: await repository.listPermissions() }),
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/permissions'),
      validate: () => {
        p.allow(body, ['capability', 'description']);
        const value = p.string(body.capability, 'capability');
        if (!CAPABILITY.test(value))
          throw new DomainError('invalid_request', 'capability must use resource:action syntax');
        return {
          capability: value as PermissionKey,
          description: p.string(body.description, 'description'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await repository.createPermission(input, actor, correlationId),
      }),
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/grants'),
      validate: null,
      handler: async () => ({
        statusCode: 200,
        body: await repository.listGrants(actor.companyId),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/grants'),
      validate: () => {
        const ids = validateGrantIds();
        const fields =
          body.fields === null || body.fields === undefined
            ? null
            : p.strings(body.fields, 'fields');
        if (fields?.some((field) => !/^[A-Za-z][A-Za-z0-9]*$/u.test(field)))
          throw new DomainError('invalid_request', 'fields contains an unsupported field name');
        return { ...ids, scopes: scopes(body.scopes), fields };
      },
      handler: async (_request, _match, input) => {
        await repository.grant(input, actor, correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'DELETE',
      match: literal('/api/v1/grants'),
      validate: validateGrantIds,
      handler: async (_request, _match, input) => {
        await repository.revoke(input.roleId, input.permissionId, actor, correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/assignments'),
      validate: null,
      handler: async () => ({
        statusCode: 200,
        body: await repository.listAssignments(actor.companyId),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/assignments'),
      validate: validateAssignmentIds,
      handler: async (_request, _match, input) => {
        await repository.assign(input.employeeId, input.roleId, actor, correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'DELETE',
      match: literal('/api/v1/assignments'),
      validate: validateAssignmentIds,
      handler: async (_request, _match, input) => {
        await repository.unassign(input.employeeId, input.roleId, actor, correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/scope-grants'),
      validate: null,
      handler: async () => ({
        statusCode: 200,
        body: await repository.listScopeGrants(actor.companyId),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/scope-grants'),
      validate: () => {
        p.allow(body, ['employeeId', 'permissionId', 'scope', 'organizationId']);
        const selected = scopes([body.scope])[0];
        if (!selected) throw new DomainError('invalid_request', 'scope is required');
        const organizationId =
          body.organizationId === null || body.organizationId === undefined
            ? null
            : p.uuid(body.organizationId, 'organizationId');
        const typed = selected === 'TEAM' || selected === 'DEPARTMENT' || selected === 'REGION';
        if (typed !== Boolean(organizationId))
          throw new DomainError(
            'invalid_request',
            typed
              ? 'Typed scopes require organizationId'
              : 'SELF, COMPANY, and GROUP do not accept organizationId',
          );
        return {
          employeeId: p.uuid(body.employeeId, 'employeeId'),
          permissionId: p.uuid(body.permissionId, 'permissionId'),
          scope: selected,
          organizationId,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await repository.grantScope(input, actor, correlationId),
      }),
    }),
    defineRoute({
      method: 'DELETE',
      match: (pathname) => {
        const match = /^\/api\/v1\/scope-grants\/([0-9a-f-]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match) => {
        p.allow(body, []);
        return { scopeGrantId: p.uuid(match.params[0], 'scopeGrantId') };
      },
      handler: async (_request, _match, input) => {
        await repository.revokeScope(input.scopeGrantId, actor, correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
  ];
  return { routes, validateGrantIds, validateAssignmentIds };
}

export async function dispatchAuthorizationRoutes(
  context: AuthorizationRouteContext,
  request: ApiRequest,
): Promise<ApiResponse | null> {
  // This broad match owns the original common prechecks, including unsupported requests.
  const authorizationMatch =
    /^\/api\/v1\/(roles|permissions|grants|assignments|scope-grants)(?:\/([0-9a-f-]+))?$/u.exec(
      request.pathname,
    );
  if (!authorizationMatch) return null;
  const resource = authorizationMatch[1];
  const atomicCapability: PermissionKey =
    resource === 'permissions'
      ? `permission:${request.method === 'GET' ? 'read' : 'manage'}`
      : resource === 'assignments'
        ? `role-assignment:${request.method === 'GET' ? 'read' : 'manage'}`
        : resource === 'scope-grants'
          ? `data-scope:${request.method === 'GET' ? 'read' : 'manage'}`
          : `role:${request.method === 'GET' ? 'read' : 'manage'}`;
  context.authorizeOneOf(
    atomicCapability,
    `authorization:${request.method === 'GET' ? 'read' : 'manage'}`,
  );
  const repository = context.repository;
  if (!repository) return context.unavailable();
  const p = context.parsers;
  const itemId = authorizationMatch[2];
  const body =
    request.method === 'GET' || (request.method === 'DELETE' && Boolean(itemId))
      ? {}
      : p.objectBody(request.body);
  const { routes, validateGrantIds, validateAssignmentIds } = authorizationRoutes(
    context,
    repository,
    body,
  );
  const response = await dispatchRoutes(routes, request);
  if (response !== null) return response;
  // Compatibility for unsupported methods only; successful branches exist solely above.
  if (!itemId && request.method !== 'GET') {
    if (resource === 'grants') validateGrantIds();
    if (resource === 'assignments') validateAssignmentIds();
  }
  return null;
}
