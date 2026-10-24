import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type ClaimRepository = Pick<NonNullable<ApiDependencies['crm']>, 'claimLead'>;
type ClaimArgs = Parameters<ClaimRepository['claimLead']>;
type ValidatedClaim = Readonly<{
  grant: AuthorizedQuery;
  id: ClaimArgs[0];
  version: ClaimArgs[1];
  key: ClaimArgs[4];
}>;
type ClaimContext = Readonly<{
  repository: ClaimRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    expectedVersion: (value: unknown) => number;
  }>;
}>;

export function leadClaimRoutes(context: ClaimContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/leads\/([0-9a-f-]+)\/claim$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedClaim => {
        const grant = context.authorize('lead-pool:claim');
        const key = request.headers?.['idempotency-key'];
        if (!key || key.length > 128)
          throw new DomainError(
            'invalid_request',
            'Idempotency-Key is required and must be at most 128 characters',
          );
        const body = p.objectBody(request.body);
        p.allow(body, ['expectedVersion']);
        return {
          grant,
          key,
          id: p.uuid(match.params[0], 'leadId'),
          version: p.expectedVersion(body.expectedVersion),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await context.repository.claimLead(
            input.id,
            input.version,
            context.authorization.actor,
            context.correlationId,
            input.key,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}
