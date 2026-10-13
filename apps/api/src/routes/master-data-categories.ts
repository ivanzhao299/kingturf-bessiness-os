import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type MasterData = NonNullable<ApiDependencies['masterData']>;
type ListArgs = Parameters<MasterData['listCategories']>;
type CreateArgs = Parameters<MasterData['createCategory']>;
type UpdateArgs = Parameters<MasterData['updateCategory']>;
type DeleteArgs = Parameters<MasterData['deleteCategory']>;
type ReadInput = Readonly<{ companyId: ListArgs[0]; at: NonNullable<ListArgs[1]> }>;
type UpdateInput = Readonly<{ id: UpdateArgs[0]; input: UpdateArgs[1] }>;
type DeleteInput = Readonly<{ id: DeleteArgs[0]; version: DeleteArgs[1] }>;
type BodyParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
  effectiveRange: (
    body: Record<string, unknown>,
  ) => Pick<CreateArgs[0], 'effectiveFrom' | 'effectiveTo'>;
  string: (value: unknown, name: string) => string;
}>;
type WriteContext = Readonly<{ actor: CreateArgs[1]; correlationId: CreateArgs[2] }>;
type ReadContext = Readonly<{
  repository: Pick<MasterData, 'listCategories'>;
  actor: Readonly<{ companyId: ListArgs[0] }>;
  parseEffectiveTimestamp: (value: string) => Date;
}>;
type CreateContext = WriteContext &
  Readonly<{
    repository: Pick<MasterData, 'createCategory'>;
    parsers: BodyParsers & Readonly<{ stableCode: (value: string) => string }>;
  }>;
type UpdateContext = WriteContext &
  Readonly<{
    repository: Pick<MasterData, 'updateCategory'>;
    parsers: BodyParsers &
      Readonly<{
        uuid: (value: unknown, name: string) => string;
        version: (value: unknown) => number;
      }>;
  }>;
type DeleteContext = Readonly<{
  repository: Pick<MasterData, 'deleteCategory'>;
  actor: DeleteArgs[2];
  correlationId: DeleteArgs[3];
  uuid: (value: unknown, name: string) => string;
  version: (value: unknown) => number;
}>;

function matchCategory(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/master-data\/categories\/([0-9a-f-]+)$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function masterCategoryReadRoutes(context: ReadContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/master-data/categories' ? { params: [] } : null),
      validate: (request): ReadInput => ({
        companyId: context.actor.companyId,
        at: request.query?.at ? context.parseEffectiveTimestamp(request.query.at) : new Date(),
      }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.listCategories(input.companyId, input.at),
      }),
    }),
  ];
}

export function masterCategoryCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/master-data/categories' ? { params: [] } : null),
      validate: (request): CreateArgs[0] => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['code', 'name', 'description', 'effectiveFrom', 'effectiveTo']);
        const range = p.effectiveRange(b);
        return {
          code: p.stableCode(p.string(b.code, 'code')),
          name: p.string(b.name, 'name'),
          description:
            b.description === null || b.description === undefined
              ? null
              : p.string(b.description, 'description'),
          ...range,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createCategory(input, context.actor, context.correlationId),
      }),
    }),
  ];
}

export function masterCategoryUpdateRoutes(context: UpdateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'PATCH',
      match: matchCategory,
      validate: (request, match): UpdateInput => {
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['name', 'description', 'effectiveFrom', 'effectiveTo', 'version']);
        const range = p.effectiveRange(b);
        return {
          id: p.uuid(match.params[0], 'categoryId'),
          input: {
            name: p.string(b.name, 'name'),
            description:
              b.description === null || b.description === undefined
                ? null
                : p.string(b.description, 'description'),
            ...range,
            version: p.version(b.version),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.updateCategory(
          input.id,
          input.input,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function masterCategoryDeleteRoutes(context: DeleteContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'DELETE',
      match: matchCategory,
      validate: (request, match): DeleteInput => ({
        id: context.uuid(match.params[0], 'categoryId'),
        version: context.version(Number(request.query?.version)),
      }),
      handler: async (_request, _match, input) => {
        await context.repository.deleteCategory(
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
