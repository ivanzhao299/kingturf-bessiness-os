import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type TransitionRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'transitionComplaint'>;
type TransitionContext = Readonly<{
  repository: TransitionRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    stableCode: (value: string) => string;
  }>;
}>;
const transitions = [
  { action: 'triage', capability: 'complaint:triage', state: 'TRIAGED' },
  { action: 'investigate', capability: 'complaint:triage', state: 'INVESTIGATING' },
  { action: 'reject', capability: 'complaint:triage', state: 'REJECTED' },
  { action: 'close', capability: 'complaint:close', state: 'CLOSED' },
] as const;

export function complaintTransitionRoutes(context: TransitionContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return transitions.map((transition) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/complaints\/([0-9a-f-]+)\/(triage|investigate|reject|close)$/u.exec(
            pathname,
          );
        return match?.[2] === transition.action ? { params: match.slice(1, 2) } : null;
      },
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['expectedVersion', 'reason', 'evidence', 'assignedTo', 'idempotencyKey']);
        const grant = context.authorize(transition.capability, Object.keys(body));
        const state = transition.state;
        return {
          id: p.uuid(match.params[0], 'complaintId'),
          input: {
            state,
            expectedVersion: p.integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
            reason: p.string(body.reason, 'reason'),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            ...(body.assignedTo ? { assignedTo: p.uuid(body.assignedTo, 'assignedTo') } : {}),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
          grant,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.transitionComplaint(
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
  );
}
