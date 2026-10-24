import {
  DomainError,
  type AuthorizationContext,
  type AuthorizationRepository,
} from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiResponse } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type IdentityAccessContext = Readonly<{
  repository: AuthorizationRepository | undefined;
  authorization: AuthorizationContext;
  correlationId: string;
  authorizeOneOf: (
    preferred: PermissionKey,
    fallback: PermissionKey,
    fields?: readonly string[],
  ) => void;
  unavailable: (message: string) => ApiResponse;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
  }>;
}>;
type IdentityStateInput =
  | Readonly<{ kind: 'unavailable'; response: ApiResponse }>
  | Readonly<{
      kind: 'ready';
      identityId: string;
      active: boolean;
      revokeSessions: boolean;
      setIdentityActive: NonNullable<AuthorizationRepository['setIdentityActive']>;
    }>;

export function identityAccessRoutes(context: IdentityAccessContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/user-access-profiles' ? { params: [] } : null),
      // Profiles GET deliberately ignores the body and requests no field authorization.
      validate: null,
      handler: async () => {
        context.authorizeOneOf('identity:read', 'authorization:read');
        const repository = context.repository;
        if (!repository?.listUserAccessProfiles)
          return context.unavailable('User access profile repository is unavailable');
        return {
          statusCode: 200,
          body: {
            items: await repository.listUserAccessProfiles(context.authorization.actor.companyId),
          },
        };
      },
    }),
    defineRoute({
      method: 'PATCH',
      match: (pathname) => {
        const match = /^\/api\/v1\/identities\/([0-9a-f-]+)\/state$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): IdentityStateInput => {
        const body = p.objectBody(request.body);
        p.allow(body, ['active', 'revokeSessions']);
        context.authorizeOneOf('identity:manage', 'authorization:manage', Object.keys(body));
        if (
          typeof body.active !== 'boolean' ||
          (body.revokeSessions !== undefined && typeof body.revokeSessions !== 'boolean')
        )
          throw new DomainError('invalid_request', 'active and revokeSessions must be boolean');
        const repository = context.repository;
        // Preserve method-unavailable 503 before path UUID validation, without changing dispatcher.
        if (!repository?.setIdentityActive)
          return {
            kind: 'unavailable',
            response: context.unavailable('Identity management repository is unavailable'),
          };
        return {
          kind: 'ready',
          identityId: p.uuid(match.params[0], 'identityId'),
          active: body.active,
          revokeSessions: body.revokeSessions === true,
          // Capture the available method with its original repository receiver.
          setIdentityActive: repository.setIdentityActive.bind(repository),
        };
      },
      handler: async (_request, _match, input) => {
        if (input.kind === 'unavailable') return input.response;
        await input.setIdentityActive(
          input.identityId,
          input.active,
          input.revokeSessions,
          context.authorization.actor,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
