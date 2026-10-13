import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type NcrRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'transitionNcr'>;
type NcrInput = Parameters<NcrRepository['transitionNcr']>[1];
type NcrContext = Readonly<{
  repository: NcrRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    stableCode: (value: string) => string;
  }>;
}>;
const transitions = [
  { action: 'contain', capability: 'ncr:manage', state: 'CONTAINED' },
  { action: 'root-cause', capability: 'ncr:manage', state: 'ROOT_CAUSE_CONFIRMED' },
  { action: 'disposition', capability: 'ncr:disposition', state: 'DISPOSITIONED' },
  { action: 'close', capability: 'ncr:close', state: 'CLOSED' },
] as const;

export function ncrTransitionRoutes(context: NcrContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return transitions.map((transition) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/ncrs\/([0-9a-f-]+)\/(contain|root-cause|disposition|close)$/u.exec(pathname);
        return match?.[2] === transition.action ? { params: match.slice(1, 2) } : null;
      },
      validate: (
        request,
        match,
      ): Readonly<{ grant: AuthorizedQuery; id: string; input: NcrInput }> => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'expectedVersion',
          'reason',
          'rootCauseMethod',
          'rootCause',
          'disposition',
          'evidence',
          'idempotencyKey',
        ]);
        const grant = context.authorize(transition.capability, Object.keys(body));
        const state = transition.state;
        const method = body.rootCauseMethod
          ? p.string(body.rootCauseMethod, 'rootCauseMethod')
          : undefined;
        const disposition = body.disposition
          ? p.string(body.disposition, 'disposition')
          : undefined;
        if (
          method &&
          method !== 'FIVE_WHY' &&
          method !== 'FISHBONE' &&
          method !== 'FAULT_TREE' &&
          method !== 'OTHER'
        )
          throw new DomainError('invalid_request', 'rootCauseMethod is unsupported');
        if (
          disposition &&
          disposition !== 'REWORK' &&
          disposition !== 'REPAIR' &&
          disposition !== 'CONCESSION' &&
          disposition !== 'RETURN' &&
          disposition !== 'SCRAP' &&
          disposition !== 'SUPPLIER_CLAIM'
        )
          throw new DomainError('invalid_request', 'disposition is unsupported');
        return {
          grant,
          id: p.uuid(match.params[0], 'ncrId'),
          input: {
            state,
            expectedVersion: p.integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
            reason: p.string(body.reason, 'reason'),
            ...(method
              ? { rootCauseMethod: method as NonNullable<NcrInput['rootCauseMethod']> }
              : {}),
            ...(body.rootCause ? { rootCause: p.jsonObject(body.rootCause, 'rootCause') } : {}),
            ...(disposition
              ? { disposition: disposition as NonNullable<NcrInput['disposition']> }
              : {}),
            ...(transition.action === 'disposition'
              ? { approvedBy: context.authorization.actor.employeeId }
              : {}),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.transitionNcr(
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
