import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['mrp']>, 'transitionProposal'>;
type Transition = Repository['transitionProposal'];
type Input = Readonly<Parameters<Transition>[2]>;
type ScopeContext = Readonly<Parameters<Transition>[3]>;
type ValidatedProposal = Readonly<{
  repository: Repository;
  transitionProposal: Transition;
  proposalId: Parameters<Transition>[0];
  state: Parameters<Transition>[1];
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<Transition>[4];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Transition>[4];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Input['evidence'];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function mrpProposalCommandRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/mrp-proposals\/([0-9a-f-]+)\/(approve|reject|release|cancel)$/u.exec(
            pathname,
          );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedProposal => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence']);
        const action = match.params[1] as 'approve' | 'reject' | 'release' | 'cancel';
        const capability = action === 'release' ? 'mrp:release' : 'mrp:approve';
        const grant = context.authorizeQuery(context.authorization, capability, Object.keys(body));
        const states = {
          approve: 'APPROVED',
          reject: 'REJECTED',
          release: 'RELEASED',
          cancel: 'CANCELLED',
        } as const;
        const repository = context.repository();
        const transitionProposal = repository.transitionProposal;
        const proposalId = context.parsers.uuid(match.params[0], 'proposalId');
        const state = states[action];
        const input: Input = {
          reason: context.parsers.string(body.reason, 'reason'),
          evidence: context.parsers.jsonObject(body.evidence ?? {}, 'evidence'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return {
          repository,
          transitionProposal,
          proposalId,
          state,
          input,
          scopeContext,
          correlationId,
        };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Transition>> = await validated.transitionProposal.call(
          validated.repository,
          validated.proposalId,
          validated.state,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'mrp:read'),
        };
      },
    }),
  ];
}
