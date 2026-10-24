import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type CommandRepository = Pick<NonNullable<ApiDependencies['crm']>, 'assign' | 'transitionLead'>;
type AssignArgs = Parameters<CommandRepository['assign']>;
type TransitionArgs = Parameters<CommandRepository['transitionLead']>;
type LeadAction = 'assign' | 'reassign' | 'transition' | 'release';
type ValidatedAssignment = Readonly<{
  kind: 'assignment';
  grant: AuthorizedQuery;
  id: AssignArgs[1];
  assigneeId: AssignArgs[2];
  version: AssignArgs[3];
  reason: AssignArgs[4];
  reassignment: AssignArgs[7];
}>;
type ValidatedTransition = Readonly<{
  kind: 'transition';
  grant: AuthorizedQuery;
  id: TransitionArgs[0];
  status: TransitionArgs[1];
  version: TransitionArgs[2];
  reason: TransitionArgs[3];
  requiredFrom: TransitionArgs[8];
}>;
type ValidatedCommand = ValidatedAssignment | ValidatedTransition;
type CommandContext = Readonly<{
  repository: CommandRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    uuid: (value: unknown, name: string) => string;
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    expectedVersion: (value: unknown) => number;
    string: (value: unknown, name: string) => string;
  }>;
}>;

function matchLeadCommand(pathname: string, action: LeadAction): RouteMatch | null {
  const match = /^\/api\/v1\/leads\/([0-9a-f-]+)\/(transition|assign|reassign|release)$/u.exec(
    pathname,
  );
  return match?.[2] === action ? { params: match.slice(1, 2) } : null;
}

function parseLeadCommand(context: CommandContext, request: ApiRequest, match: RouteMatch) {
  const id = context.parsers.uuid(match.params[0], 'leadId');
  const body = context.parsers.objectBody(request.body);
  return { id, body };
}

async function executeLeadCommand(
  context: CommandContext,
  input: ValidatedCommand,
): Promise<ApiResponse> {
  if (input.kind === 'assignment') {
    return {
      statusCode: 200,
      body: context.mutationDto(
        await context.repository.assign(
          'LEAD',
          input.id,
          input.assigneeId,
          input.version,
          input.reason,
          context.authorization.actor,
          context.correlationId,
          input.reassignment,
          input.grant.scopes,
          input.grant.anchors,
        ),
      ),
    };
  }
  return {
    statusCode: 200,
    body: context.mutationDto(
      await context.repository.transitionLead(
        input.id,
        input.status,
        input.version,
        input.reason,
        context.authorization.actor,
        context.correlationId,
        input.grant.scopes,
        input.grant.anchors,
        input.requiredFrom,
      ),
    ),
  };
}

export function leadCommandRoutes(context: CommandContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => matchLeadCommand(pathname, 'transition'),
      validate: (request, match): ValidatedTransition => {
        const { id, body } = parseLeadCommand(context, request, match);
        const grant = context.authorize('lead:lifecycle', ['status', 'reason']);
        p.allow(body, ['status', 'expectedVersion', 'reason']);
        return {
          kind: 'transition',
          grant,
          id,
          status: p.string(body.status, 'status') as TransitionArgs[1],
          version: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
          requiredFrom: undefined,
        };
      },
      handler: (_request, _match, input) => executeLeadCommand(context, input),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => matchLeadCommand(pathname, 'assign'),
      validate: (request, match): ValidatedAssignment => {
        const { id, body } = parseLeadCommand(context, request, match);
        const grant = context.authorize('lead:assign');
        p.allow(body, ['assigneeId', 'expectedVersion', 'reason']);
        return {
          kind: 'assignment',
          grant,
          id,
          assigneeId: p.uuid(body.assigneeId, 'assigneeId'),
          version: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
          reassignment: false,
        };
      },
      handler: (_request, _match, input) => executeLeadCommand(context, input),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => matchLeadCommand(pathname, 'reassign'),
      validate: (request, match): ValidatedAssignment => {
        const { id, body } = parseLeadCommand(context, request, match);
        const grant = context.authorize('lead:reassign');
        p.allow(body, ['assigneeId', 'expectedVersion', 'reason']);
        return {
          kind: 'assignment',
          grant,
          id,
          assigneeId: p.uuid(body.assigneeId, 'assigneeId'),
          version: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
          reassignment: true,
        };
      },
      handler: (_request, _match, input) => executeLeadCommand(context, input),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => matchLeadCommand(pathname, 'release'),
      validate: (request, match): ValidatedTransition => {
        const { id, body } = parseLeadCommand(context, request, match);
        const grant = context.authorize('lead-pool:release', ['status', 'reason']);
        p.allow(body, ['expectedVersion', 'reason']);
        return {
          kind: 'transition',
          grant,
          id,
          status: 'POOL',
          version: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
          requiredFrom: 'CLAIMED',
        };
      },
      handler: (_request, _match, input) => executeLeadCommand(context, input),
    }),
  ];
}
