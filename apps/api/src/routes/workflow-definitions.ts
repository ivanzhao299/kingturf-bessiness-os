import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type Workflows = NonNullable<ApiDependencies['workflows']>;
type ListArgs = Parameters<Workflows['list']>;
type CreateArgs = Parameters<Workflows['create']>;
type VersionArgs = Parameters<Workflows['createVersion']>;
type PublishArgs = Parameters<Workflows['publish']>;
type ListInput = Readonly<{ companyId: ListArgs[0] }>;
type VersionInput = Readonly<{ id: VersionArgs[0]; spec: VersionArgs[1] }>;
type PublishInput = Readonly<{ id: PublishArgs[0]; version: PublishArgs[1] }>;
type BodyParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
}>;
type ListContext = Readonly<{
  repository: Pick<Workflows, 'list'>;
  actor: Readonly<{ companyId: ListArgs[0] }>;
}>;
type CreateContext = Readonly<{
  repository: Pick<Workflows, 'create'>;
  actor: CreateArgs[1];
  correlationId: CreateArgs[2];
  parsers: BodyParsers &
    Readonly<{
      string: (value: unknown, name: string) => string;
      stableCode: (value: string) => string;
    }>;
}>;
type VersionContext = Readonly<{
  repository: Pick<Workflows, 'createVersion'>;
  actor: VersionArgs[2];
  correlationId: VersionArgs[3];
  parsers: BodyParsers & Readonly<{ uuid: (value: unknown, name: string) => string }>;
}>;
type PublishContext = Readonly<{
  repository: Pick<Workflows, 'publish'>;
  actor: PublishArgs[2];
  correlationId: PublishArgs[3];
  parsers: BodyParsers &
    Readonly<{
      uuid: (value: unknown, name: string) => string;
      version: (value: unknown) => number;
    }>;
}>;

function matchVersion(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/versions$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

function matchPublish(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/publish$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function workflowDefinitionListRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/workflows' ? { params: [] } : null),
      validate: (): ListInput => ({ companyId: context.actor.companyId }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: { items: await context.repository.list(input.companyId) },
      }),
    }),
  ];
}

export function workflowDefinitionCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/workflows' ? { params: [] } : null),
      validate: (request): CreateArgs[0] => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['code', 'spec']);
        return {
          code: p.stableCode(p.string(b.code, 'code')),
          spec: p.objectBody(b.spec) as unknown as CreateArgs[0]['spec'],
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.create(input, context.actor, context.correlationId),
      }),
    }),
  ];
}

export function workflowDefinitionVersionRoutes(
  context: VersionContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchVersion,
      validate: (request, match): VersionInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['spec']);
        return {
          id: p.uuid(match.params[0], 'workflowId'),
          spec: p.objectBody(b.spec) as unknown as VersionArgs[1],
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createVersion(
          input.id,
          input.spec,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function workflowDefinitionPublishRoutes(
  context: PublishContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchPublish,
      validate: (request, match): PublishInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['version']);
        return {
          id: p.uuid(match.params[0], 'workflowId'),
          version: p.version(b.version),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.publish(
          input.id,
          input.version,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}
