import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type SignContract = Qtc['signContract'];
type Input = Readonly<Parameters<SignContract>[1]>;
type ScopeContext = Readonly<Parameters<SignContract>[3]>;
type ValidatedSignature = Readonly<{
  repository: Pick<Qtc, 'signContract'>;
  signContract: SignContract;
  id: Parameters<SignContract>[0];
  input: Input;
  key: Parameters<SignContract>[2];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Pick<Qtc, 'signContract'>;
  rawId: string | undefined;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<SignContract>[4];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Input['payload'];
    timestamp: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcContractSignRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) =>
        /^\/api\/v1\/contracts\/([0-9a-f-]+)\/sign$/u.test(pathname) ? { params: [] } : null,
      validate: (request): ValidatedSignature => {
        context.parsers.allow(context.body, [
          'provider',
          'providerReceiptId',
          'payload',
          'signedAt',
        ]);
        const repository = context.repository();
        const signContract = repository.signContract;
        const id = context.parsers.uuid(context.rawId, 'contractRevisionId');
        const input: Input = {
          provider: context.parsers.string(context.body.provider, 'provider'),
          providerReceiptId: context.parsers.string(
            context.body.providerReceiptId,
            'providerReceiptId',
          ),
          payload: context.parsers.jsonObject(context.body.payload, 'payload'),
          signedAt: context.parsers.timestamp(context.body.signedAt, 'signedAt'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('contract:sign');
        return { repository, signContract, id, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.signContract.call(
          validated.repository,
          validated.id,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'contract:read'),
        };
      },
    }),
  ];
}
