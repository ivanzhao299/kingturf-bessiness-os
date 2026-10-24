import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type CommandRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'approveQuote' | 'issueQuote'
>;
type CommandContext = Readonly<{
  repository: CommandRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;
type ApproveInput = Readonly<{
  grant: AuthorizedQuery;
  revisionId: string;
  decision: Parameters<CommandRepository['approveQuote']>[1];
  reason: string;
  idempotencyKey: string;
}>;
const commandMatch =
  (action: 'approve' | 'issue') =>
  (pathname: string): RouteMatch | null => {
    const match = /^\/api\/v1\/quote-revisions\/([0-9a-f-]+)\/(approve|issue)$/u.exec(pathname);
    return match?.[2] === action ? { params: match.slice(1, 2) } : null;
  };
function commandBody(context: CommandContext, request: ApiRequest, match: RouteMatch) {
  const revisionId = context.parsers.uuid(match.params[0], 'quoteRevisionId');
  const body = context.parsers.objectBody(request.body);
  return { revisionId, body };
}

export function quoteCommandRoutes(context: CommandContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: commandMatch('approve'),
      validate: (request, match): ApproveInput => {
        const { revisionId, body } = commandBody(context, request, match);
        p.allow(body, ['decision', 'reason']);
        const grant = context.authorize('quote:approve');
        const decision = p.string(body.decision, 'decision');
        if (decision !== 'APPROVED' && decision !== 'REJECTED')
          throw new DomainError('invalid_request', 'decision is unsupported');
        return {
          grant,
          revisionId,
          decision,
          reason: p.string(body.reason, 'reason'),
          idempotencyKey: p.idempotency(request),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await context.repository.approveQuote(
            input.revisionId,
            input.decision,
            input.reason,
            input.idempotencyKey,
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
      match: commandMatch('issue'),
      validate: (request, match) => {
        const { revisionId, body } = commandBody(context, request, match);
        p.allow(body, []);
        const grant = context.authorize('quote:issue');
        return { grant, revisionId, idempotencyKey: p.idempotency(request) };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await context.repository.issueQuote(
            input.revisionId,
            input.idempotencyKey,
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
