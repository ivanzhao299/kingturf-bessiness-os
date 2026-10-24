import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type Transition = Production['transition'];
type CommandInput = Readonly<Parameters<Transition>[2]>;
type ScopeContext = Readonly<Parameters<Transition>[3]>;
type ValidatedCommand = Readonly<{
  transition: Transition;
  id: Parameters<Transition>[0];
  state: Parameters<Transition>[1];
  input: CommandInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Production, 'transition'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Transition>[4];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => CommandInput['evidence'];
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;
type Command = Readonly<{
  pattern: RegExp;
  capability: PermissionKey;
  state: Parameters<Transition>[1];
}>;
const commands = [
  {
    pattern: /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/release$/u,
    capability: 'production:plan',
    state: 'RELEASED',
  },
  {
    pattern: /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/start$/u,
    capability: 'production:report',
    state: 'IN_PROGRESS',
  },
  {
    pattern: /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/complete$/u,
    capability: 'production:close',
    state: 'COMPLETED',
  },
  {
    pattern: /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/close$/u,
    capability: 'production:close',
    state: 'CLOSED',
  },
  {
    pattern: /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/cancel$/u,
    capability: 'production:close',
    state: 'CANCELLED',
  },
] as const satisfies readonly Command[];

export function productionOrderCommandRoutes(context: Context): readonly RouteDefinition[] {
  return commands.map((command) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = command.pattern.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedCommand => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence', 'idempotencyKey']);
        const grant = context.authorizeQuery(
          context.authorization,
          command.capability,
          Object.keys(body),
        );
        const transition = context.repository.transition;
        const id = context.parsers.uuid(match.params[0], 'productionOrderId');
        const state = command.state;
        const input: CommandInput = {
          reason: context.parsers.string(body.reason, 'reason'),
          evidence: context.parsers.jsonObject(body.evidence ?? {}, 'evidence'),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { transition, id, state, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.transition.call(
          context.repository,
          validated.id,
          validated.state,
          validated.input,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'production:read'),
        };
      },
    }),
  );
}
