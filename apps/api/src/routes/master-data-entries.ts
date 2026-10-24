import type { ApiDependencies, ApiResponse } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type MasterData = NonNullable<ApiDependencies['masterData']>;
type CreateArgs = Parameters<MasterData['createEntry']>;
type ListArgs = Parameters<MasterData['listEntries']>;
type FindArgs = Parameters<MasterData['findEntry']>;
type UpdateArgs = Parameters<MasterData['updateEntry']>;
type DeleteArgs = Parameters<MasterData['deleteEntry']>;
type ListInput = Readonly<{
  companyId: ListArgs[0];
  categoryId: ListArgs[1];
  at: NonNullable<ListArgs[2]>;
}>;
type DetailInput = Readonly<{
  id: FindArgs[0];
  companyId: FindArgs[1];
  at: NonNullable<FindArgs[2]>;
}>;
type UpdateInput = Readonly<{ id: UpdateArgs[0]; input: UpdateArgs[1] }>;
type DeleteInput = Readonly<{ id: DeleteArgs[0]; version: DeleteArgs[1] }>;
type BodyParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
  effectiveRange: (
    body: Record<string, unknown>,
  ) => Pick<CreateArgs[0], 'effectiveFrom' | 'effectiveTo'>;
  uuid: (value: unknown, name: string) => string;
  string: (value: unknown, name: string) => string;
}>;
type WriteContext = Readonly<{ actor: CreateArgs[1]; correlationId: CreateArgs[2] }>;
type CreateContext = WriteContext &
  Readonly<{
    repository: Pick<MasterData, 'createEntry'>;
    parsers: BodyParsers & Readonly<{ stableCode: (value: string) => string }>;
  }>;
type ReadContext = Readonly<{
  actor: Readonly<{ companyId: ListArgs[0] }>;
  uuid: (value: unknown, name: string) => string;
  parseEffectiveTimestamp: (value: string) => Date;
}>;
type ListContext = ReadContext & Readonly<{ repository: Pick<MasterData, 'listEntries'> }>;
type DetailContext = ReadContext &
  Readonly<{
    repository: Pick<MasterData, 'findEntry'>;
    notFound: () => ApiResponse;
  }>;
type UpdateContext = WriteContext &
  Readonly<{
    repository: Pick<MasterData, 'updateEntry'>;
    parsers: BodyParsers & Readonly<{ version: (value: unknown) => number }>;
  }>;
type DeleteContext = Readonly<{
  repository: Pick<MasterData, 'deleteEntry'>;
  actor: DeleteArgs[2];
  correlationId: DeleteArgs[3];
  uuid: (value: unknown, name: string) => string;
  version: (value: unknown) => number;
}>;

function matchEntry(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/master-data\/entries\/([0-9a-f-]+)$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function masterEntryCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/master-data/entries' ? { params: [] } : null),
      validate: (request): CreateArgs[0] => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['categoryId', 'code', 'label', 'value', 'effectiveFrom', 'effectiveTo']);
        const range = p.effectiveRange(b);
        return {
          categoryId: p.uuid(b.categoryId, 'categoryId'),
          code: p.stableCode(p.string(b.code, 'code')),
          label: p.string(b.label, 'label'),
          value: p.objectBody(b.value) as CreateArgs[0]['value'],
          ...range,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createEntry(input, context.actor, context.correlationId),
      }),
    }),
  ];
}

export function masterEntryListRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/master-data/entries' ? { params: [] } : null),
      validate: (request): ListInput => ({
        companyId: context.actor.companyId,
        categoryId: request.query?.categoryId
          ? context.uuid(request.query.categoryId, 'categoryId')
          : null,
        at: request.query?.at ? context.parseEffectiveTimestamp(request.query.at) : new Date(),
      }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.listEntries(input.companyId, input.categoryId, input.at),
      }),
    }),
  ];
}

export function masterEntryDetailRoutes(context: DetailContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: matchEntry,
      validate: (request, match): DetailInput => ({
        id: context.uuid(match.params[0], 'entryId'),
        companyId: context.actor.companyId,
        at: request.query?.at ? context.parseEffectiveTimestamp(request.query.at) : new Date(),
      }),
      handler: async (_request, _match, input) => {
        const found = await context.repository.findEntry(input.id, input.companyId, input.at);
        return found ? { statusCode: 200, body: found } : context.notFound();
      },
    }),
  ];
}

export function masterEntryUpdateRoutes(context: UpdateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'PATCH',
      match: matchEntry,
      validate: (request, match): UpdateInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['label', 'value', 'effectiveFrom', 'effectiveTo', 'version']);
        const range = p.effectiveRange(b);
        return {
          id: p.uuid(match.params[0], 'entryId'),
          input: {
            label: p.string(b.label, 'label'),
            value: p.objectBody(b.value) as UpdateArgs[1]['value'],
            ...range,
            version: p.version(b.version),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.updateEntry(
          input.id,
          input.input,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function masterEntryDeleteRoutes(context: DeleteContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'DELETE',
      match: matchEntry,
      validate: (request, match): DeleteInput => ({
        id: context.uuid(match.params[0], 'entryId'),
        version: context.version(Number(request.query?.version)),
      }),
      handler: async (_request, _match, input) => {
        await context.repository.deleteEntry(
          input.id,
          input.version,
          context.actor,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
