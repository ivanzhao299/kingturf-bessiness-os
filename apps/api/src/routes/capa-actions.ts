import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CapaRepository = Pick<
  NonNullable<ApiDependencies['complaints']>,
  'addCapaAction' | 'completeCapaAction'
>;
type AddInput = Parameters<CapaRepository['addCapaAction']>[1];
type CompleteInput = Parameters<CapaRepository['completeCapaAction']>[1];
type CapaContext = Readonly<{
  repository: CapaRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    uuid: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
  }>;
}>;

export function capaActionRoutes(context: CapaContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/capas\/([0-9a-f-]+)\/actions$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): { grant: AuthorizedQuery; id: string; input: AddInput } => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'actionType',
          'description',
          'ownerId',
          'dueAt',
          'expectedVersion',
          'idempotencyKey',
        ]);
        const grant = context.authorize('capa:manage', Object.keys(body));
        const actionType = p.string(body.actionType, 'actionType');
        if (!['CORRECTIVE', 'PREVENTIVE'].includes(actionType))
          throw new DomainError('invalid_request', 'actionType is unsupported');
        return {
          grant,
          id: p.uuid(match.params[0], 'capaId'),
          input: {
            actionType: actionType as AddInput['actionType'],
            description: p.string(body.description, 'description'),
            ownerId: p.uuid(body.ownerId, 'ownerId'),
            dueAt: p.timestamp(body.dueAt, 'dueAt'),
            expectedVersion: p.integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.addCapaAction(
            input.id,
            input.input,
            {
              actor: context.authorization.actor,
              scopes: input.grant.scopes,
              anchors: input.grant.anchors,
            },
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/capa-actions\/([0-9a-f-]+)\/complete$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): { grant: AuthorizedQuery; id: string; input: CompleteInput } => {
        const body = p.objectBody(request.body);
        p.allow(body, ['completedAt', 'evidence', 'expectedCapaVersion', 'idempotencyKey']);
        const grant = context.authorize('capa:manage', Object.keys(body));
        return {
          grant,
          id: p.uuid(match.params[0], 'capaActionId'),
          input: {
            completedAt: p.timestamp(body.completedAt, 'completedAt'),
            evidence: p.jsonObject(body.evidence, 'evidence'),
            expectedCapaVersion: p.integer(
              body.expectedCapaVersion,
              'expectedCapaVersion',
              1,
              1_000_000,
            ),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.completeCapaAction(
            input.id,
            input.input,
            {
              actor: context.authorization.actor,
              scopes: input.grant.scopes,
              anchors: input.grant.anchors,
            },
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}
