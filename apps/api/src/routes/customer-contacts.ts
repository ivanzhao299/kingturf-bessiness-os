import {
  DomainError,
  normalizeContactEmail,
  normalizeContactPhone,
  type AuthorizationContext,
} from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type ContactRepository = Pick<NonNullable<ApiDependencies['crm']>, 'createContact'>;
type ContactArgs = Parameters<ContactRepository['createContact']>;
type ValidatedContact = Readonly<{
  grant: AuthorizedQuery;
  id: ContactArgs[0];
  input: ContactArgs[1];
}>;
type ContactContext = Readonly<{
  repository: ContactRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
  }>;
}>;

export function customerContactRoutes(context: ContactContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/customers\/([0-9a-f-]+)\/contacts$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedContact => {
        const grant = context.authorize('customer:update', ['contacts']);
        const body = p.objectBody(request.body);
        p.allow(body, ['name', 'title', 'email', 'phone', 'primary']);
        if (body.email !== undefined && body.email !== null && typeof body.email !== 'string')
          throw new DomainError('invalid_request', 'email must be a string');
        if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string')
          throw new DomainError('invalid_request', 'phone must be a string');
        const email = typeof body.email === 'string' ? normalizeContactEmail(body.email) : null;
        const phone = typeof body.phone === 'string' ? normalizeContactPhone(body.phone) : null;
        if (email === null && phone === null)
          throw new DomainError('invalid_request', 'Contact email or phone is required');
        return {
          grant,
          id: p.uuid(match.params[0], 'customerId'),
          input: {
            name: p.string(body.name, 'name'),
            title: typeof body.title === 'string' ? body.title : null,
            email,
            phone,
            primary: body.primary === true,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createContact(
            input.id,
            input.input,
            context.authorization.actor,
            context.correlationId,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}
