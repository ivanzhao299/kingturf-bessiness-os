import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type Numbers = NonNullable<ApiDependencies['numbers']>;
type ListArgs = Parameters<Numbers['list']>;
type CreateArgs = Parameters<Numbers['createDefinition']>;
type PublishArgs = Parameters<Numbers['publish']>;
type VersionArgs = Parameters<Numbers['createVersion']>;
type ListInput = Readonly<{ companyId: ListArgs[0] }>;
type PublishInput = Readonly<{ id: PublishArgs[0]; version: PublishArgs[1] }>;
type VersionInput = Readonly<{ id: VersionArgs[0]; input: VersionArgs[1] }>;
type BodyParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
}>;
type ConfigParsers = BodyParsers &
  Readonly<{
    string: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
  }>;
type ListContext = Readonly<{
  repository: Pick<Numbers, 'list'>;
  actor: Readonly<{ companyId: ListArgs[0] }>;
}>;
type CreateContext = Readonly<{
  repository: Pick<Numbers, 'createDefinition'>;
  actor: CreateArgs[1];
  correlationId: CreateArgs[2];
  parsers: ConfigParsers & Readonly<{ stableCode: (value: string) => string }>;
}>;
type PublishContext = Readonly<{
  repository: Pick<Numbers, 'publish'>;
  actor: PublishArgs[2];
  correlationId: PublishArgs[3];
  parsers: BodyParsers &
    Readonly<{
      uuid: (value: unknown, name: string) => string;
      version: (value: unknown) => number;
    }>;
}>;
type VersionContext = Readonly<{
  repository: Pick<Numbers, 'createVersion'>;
  actor: VersionArgs[2];
  correlationId: VersionArgs[3];
  parsers: ConfigParsers & Readonly<{ uuid: (value: unknown, name: string) => string }>;
}>;

function matchPublish(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/publish$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

function matchVersion(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/versions$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function numberDefinitionListRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/number-definitions' ? { params: [] } : null),
      validate: (): ListInput => ({ companyId: context.actor.companyId }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: { items: await context.repository.list(input.companyId) },
      }),
    }),
  ];
}

export function numberDefinitionCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/number-definitions' ? { params: [] } : null),
      validate: (request): CreateArgs[0] => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, [
          'code',
          'prefix',
          'suffix',
          'padding',
          'startingValue',
          'increment',
          'resetPeriod',
        ]);
        return {
          code: p.stableCode(p.string(b.code, 'code')),
          prefix: typeof b.prefix === 'string' ? b.prefix : '',
          suffix: typeof b.suffix === 'string' ? b.suffix : '',
          padding: p.integer(b.padding, 'padding', 1, 32),
          startingValue: p.integer(b.startingValue, 'startingValue', 0, Number.MAX_SAFE_INTEGER),
          increment: p.integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
          resetPeriod: p.string(b.resetPeriod, 'resetPeriod') as CreateArgs[0]['resetPeriod'],
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createDefinition(
          input,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function numberDefinitionPublishRoutes(context: PublishContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchPublish,
      validate: (request, match): PublishInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['version']);
        return {
          id: p.uuid(match.params[0], 'definitionId'),
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

export function numberDefinitionVersionRoutes(context: VersionContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchVersion,
      validate: (request, match): VersionInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['prefix', 'suffix', 'padding', 'startingValue', 'increment', 'resetPeriod']);
        return {
          id: p.uuid(match.params[0], 'definitionId'),
          input: {
            prefix: typeof b.prefix === 'string' ? b.prefix : '',
            suffix: typeof b.suffix === 'string' ? b.suffix : '',
            padding: p.integer(b.padding, 'padding', 1, 32),
            startingValue: p.integer(b.startingValue, 'startingValue', 0, Number.MAX_SAFE_INTEGER),
            increment: p.integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
            resetPeriod: p.string(b.resetPeriod, 'resetPeriod') as VersionArgs[1]['resetPeriod'],
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
