import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type SolutionRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'createTechnicalSolution' | 'createTechnicalSolutionRevision'
>;
type SolutionContext = Readonly<{
  repository: SolutionRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    strings: (value: unknown, name: string) => readonly string[];
  }>;
}>;

export function technicalSolutionRoutes(context: SolutionContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/technical-solutions' ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'opportunityId',
          'code',
          'ctrVersionId',
          'specification',
          'assumptions',
          'final',
        ]);
        const grant = context.authorize('technical-solution:create', Object.keys(body));
        return {
          grant,
          input: {
            opportunityId: p.uuid(body.opportunityId, 'opportunityId'),
            code: p.string(body.code, 'code'),
            ctrVersionId: p.uuid(body.ctrVersionId, 'ctrVersionId'),
            specification: p.jsonObject(body.specification, 'specification'),
            assumptions: p.strings(body.assumptions, 'assumptions'),
            final: body.final === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createTechnicalSolution(
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/technical-solutions\/([0-9a-f-]+)\/revisions$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['ctrVersionId', 'specification', 'assumptions', 'final']);
        const grant = context.authorize('technical-solution:update', Object.keys(body));
        return {
          grant,
          solutionId: p.uuid(match.params[0], 'technicalSolutionId'),
          input: {
            ctrVersionId: p.uuid(body.ctrVersionId, 'ctrVersionId'),
            specification: p.jsonObject(body.specification, 'specification'),
            assumptions: p.strings(body.assumptions, 'assumptions'),
            final: body.final === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createTechnicalSolutionRevision(
            input.solutionId,
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}
