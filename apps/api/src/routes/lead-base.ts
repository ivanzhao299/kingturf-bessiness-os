import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type LeadReadRepository = Pick<NonNullable<ApiDependencies['crm']>, 'listLeads'>;
type LeadCreateRepository = Pick<NonNullable<ApiDependencies['crm']>, 'createLead'>;
type CreateInput = Parameters<LeadCreateRepository['createLead']>[0];
type ValidatedList = Readonly<{ grant: AuthorizedQuery; fields: readonly string[] | null }>;
type ValidatedCreate = Readonly<{ grant: AuthorizedQuery; input: CreateInput }>;
type LeadReadContext = Readonly<{
  repository: LeadReadRepository;
  authorization: AuthorizationContext;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;
type LeadCreateContext = Readonly<{
  repository: LeadCreateRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
  }>;
}>;

export function leadListRoutes(context: LeadReadContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/leads' ? { params: [] } : null),
      validate: (): ValidatedList => {
        const grant = context.authorize('lead:read');
        const fields = context.authorization.permissions.get('lead:read')?.fields ?? null;
        return { grant, fields };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listLeads(
              context.authorization.actor,
              input.grant.scopes,
              input.grant.anchors,
            )
          ).map((item) => context.permittedDto(item, input.fields)),
          nextCursor: null,
        },
      }),
    }),
  ];
}

export function leadCreateRoutes(context: LeadCreateContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/leads' ? { params: [] } : null),
      validate: (request): ValidatedCreate => {
        const grant = context.authorize('lead:create', ['title', 'source', 'customerId', 'pool']);
        const body = p.objectBody(request.body);
        p.allow(body, ['title', 'source', 'customerId', 'pool']);
        return {
          grant,
          input: {
            title: p.string(body.title, 'title'),
            source: p.string(body.source, 'source'),
            customerId:
              body.customerId === null || body.customerId === undefined
                ? null
                : p.uuid(body.customerId, 'customerId'),
            pool: body.pool === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createLead(
            input.input,
            context.authorization.actor,
            context.correlationId,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}

export function leadPoolRoutes(context: LeadReadContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/leads/pool' ? { params: [] } : null),
      validate: (): ValidatedList => {
        const grant = context.authorize('lead-pool:read');
        const fields = context.authorization.permissions.get('lead-pool:read')?.fields ?? null;
        return { grant, fields };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listLeads(
              context.authorization.actor,
              input.grant.scopes,
              input.grant.anchors,
              true,
            )
          ).map((item) => context.permittedDto(item, input.fields)),
          nextCursor: null,
        },
      }),
    }),
  ];
}
