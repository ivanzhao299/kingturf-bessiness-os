import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['commissions']>, 'transition'>;
type Transition = Repository['transition'];
type TransitionInput = Readonly<Parameters<Transition>[1]>;
type ScopeContext = Readonly<Parameters<Transition>[3]>;
type ValidatedCommand = Readonly<{
  repository: Repository;
  transition: Transition;
  id: Parameters<Transition>[0];
  input: TransitionInput;
  key: Parameters<Transition>[2];
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
    idempotency: (request: ApiRequest) => Parameters<Transition>[2];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;
type Command = Readonly<{
  action: string;
  state: TransitionInput['state'];
  capability: PermissionKey;
}>;
const commands = [
  { action: 'freeze', state: 'FROZEN', capability: 'commission:manage' },
  { action: 'release', state: 'RELEASED', capability: 'commission:manage' },
  { action: 'pay', state: 'PAID', capability: 'commission:pay' },
  { action: 'clawback', state: 'CLAWED_BACK', capability: 'commission:manage' },
  { action: 'cancel', state: 'CANCELLED', capability: 'commission:manage' },
] as const satisfies readonly Command[];

export function commissionCommandRoutes(context: Context): readonly RouteDefinition[] {
  return commands.map((command) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/commissions\/([0-9a-f-]+)\/(freeze|release|pay|clawback|cancel)$/u.exec(
            pathname,
          );
        return match?.[2] === command.action ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedCommand => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'externalReference']);
        const target = command.state;
        const capability = command.capability;
        const grant = context.authorizeQuery(context.authorization, capability, Object.keys(body));
        const repository = context.repository();
        const transition = repository.transition;
        const id = context.parsers.uuid(match.params[0], 'commissionId');
        const input: TransitionInput = {
          state: target,
          reason: context.parsers.string(body.reason, 'reason'),
          externalReference:
            body.externalReference === null || body.externalReference === undefined
              ? null
              : context.parsers.string(body.externalReference, 'externalReference'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, transition, id, input, key, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Transition>> = await validated.transition.call(
          validated.repository,
          validated.id,
          validated.input,
          validated.key,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'commission:read'),
        };
      },
    }),
  );
}
