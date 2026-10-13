import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type DefinitionRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listDefinitions' | 'createDefinition' | 'createDefinitionVersion'
>;
type DefinitionContext = Readonly<{
  repository: DefinitionRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    array: (value: unknown, name: string) => readonly unknown[];
  }>;
}>;
const definitions = [
  { segment: 'cost-models', kind: 'cost', read: 'cost-model:read', manage: 'cost-model:manage' },
  {
    segment: 'sales-policies',
    kind: 'policy',
    read: 'sales-policy:read',
    manage: 'sales-policy:manage',
  },
] as const;

function readRoutes(context: DefinitionContext): readonly RouteDefinition[] {
  return definitions.map((definition) =>
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === `/api/v1/${definition.segment}` ? { params: [] } : null),
      validate: () => context.authorize(definition.read),
      handler: async (_request, _match, grant) => ({
        statusCode: 200,
        body: {
          items: await context.repository.listDefinitions(
            definition.kind,
            context.authorization.actor,
            grant.scopes,
          ),
        },
      }),
    }),
  );
}

function creationRoutes(context: DefinitionContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return definitions.map((definition) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === `/api/v1/${definition.segment}` ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        const cost = definition.kind === 'cost';
        p.allow(
          body,
          cost
            ? ['code', 'name', 'currency', 'rules', 'publish']
            : ['code', 'name', 'rules', 'publish'],
        );
        const grant = context.authorize(definition.manage, Object.keys(body));
        return {
          grant,
          input: {
            code: p.string(body.code, 'code'),
            name: p.string(body.name, 'name'),
            ...(cost ? { currency: p.currency(body.currency) } : {}),
            rules: p.array(body.rules, 'rules'),
            publish: body.publish === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createDefinition(
          definition.kind,
          input.input,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
  );
}

function versionRoutes(context: DefinitionContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return definitions.map((definition) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/(cost-models|sales-policies)\/([0-9a-f-]+)\/versions$/u.exec(
          pathname,
        );
        return match?.[1] === definition.segment ? { params: match.slice(2) } : null;
      },
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        const cost = definition.kind === 'cost';
        p.allow(body, cost ? ['currency', 'rules', 'publish'] : ['rules', 'publish']);
        const grant = context.authorize(definition.manage, Object.keys(body));
        return {
          grant,
          definitionId: p.uuid(match.params[0], 'definitionId'),
          input: {
            ...(cost ? { currency: p.currency(body.currency) } : {}),
            rules: p.array(body.rules, 'rules'),
            publish: body.publish === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createDefinitionVersion(
          definition.kind,
          input.definitionId,
          input.input,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
  );
}

export function commercialDefinitionRoutes(context: DefinitionContext): readonly RouteDefinition[] {
  return [...readRoutes(context), ...creationRoutes(context), ...versionRoutes(context)];
}
