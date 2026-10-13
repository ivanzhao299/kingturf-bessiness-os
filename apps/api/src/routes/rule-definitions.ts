import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type Rules = NonNullable<ApiDependencies['rules']>;
type ListArgs = Parameters<Rules['list']>;
type CreateArgs = Parameters<Rules['create']>;
type PublishArgs = Parameters<Rules['publish']>;
type VersionArgs = Parameters<Rules['createVersion']>;
type ListInput = Readonly<{ companyId: ListArgs[0] }>;
type PublishInput = Readonly<{ id: PublishArgs[0]; version: PublishArgs[1] }>;
type VersionInput = Readonly<{ id: VersionArgs[0]; input: VersionArgs[1] }>;
type BodyParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
}>;
type ListContext = Readonly<{
  repository: Pick<Rules, 'list'>;
  actor: Readonly<{ companyId: ListArgs[0] }>;
}>;
type CreateContext = Readonly<{
  repository: Pick<Rules, 'create'>;
  actor: CreateArgs[1];
  correlationId: CreateArgs[2];
  parsers: BodyParsers &
    Readonly<{
      string: (value: unknown, name: string) => string;
      stableCode: (value: string) => string;
      strings: (value: unknown, name: string) => readonly string[];
    }>;
}>;
type PublishContext = Readonly<{
  repository: Pick<Rules, 'publish'>;
  actor: PublishArgs[2];
  correlationId: PublishArgs[3];
  parsers: BodyParsers &
    Readonly<{
      uuid: (value: unknown, name: string) => string;
      version: (value: unknown) => number;
    }>;
}>;
type VersionContext = Readonly<{
  repository: Pick<Rules, 'createVersion'>;
  actor: VersionArgs[2];
  correlationId: VersionArgs[3];
  parsers: BodyParsers &
    Readonly<{
      uuid: (value: unknown, name: string) => string;
      strings: (value: unknown, name: string) => readonly string[];
    }>;
}>;

function matchPublish(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/rules\/([0-9a-f-]+)\/publish$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

function matchVersion(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/rules\/([0-9a-f-]+)\/versions$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function ruleDefinitionListRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/rules' ? { params: [] } : null),
      validate: (): ListInput => ({ companyId: context.actor.companyId }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: { items: await context.repository.list(input.companyId) },
      }),
    }),
  ];
}

export function ruleDefinitionCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/rules' ? { params: [] } : null),
      validate: (request): CreateArgs[0] => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['code', 'ast', 'requiredInputs']);
        return {
          code: p.stableCode(p.string(b.code, 'code')),
          ast: b.ast,
          requiredInputs: p.strings(b.requiredInputs ?? [], 'requiredInputs'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.create(input, context.actor, context.correlationId),
      }),
    }),
  ];
}

export function ruleDefinitionPublishRoutes(context: PublishContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchPublish,
      validate: (request, match): PublishInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['version']);
        return {
          id: p.uuid(match.params[0], 'ruleId'),
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

export function ruleDefinitionVersionRoutes(context: VersionContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchVersion,
      validate: (request, match): VersionInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['ast', 'requiredInputs']);
        return {
          id: p.uuid(match.params[0], 'ruleId'),
          input: {
            ast: b.ast,
            requiredInputs: p.strings(b.requiredInputs ?? [], 'requiredInputs'),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createVersion(
          input.id,
          input.input,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}
