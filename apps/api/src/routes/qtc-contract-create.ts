import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type CreateContract = Qtc['createContract'];
type Input = Readonly<Parameters<CreateContract>[0]>;
type ScopeContext = Readonly<Parameters<CreateContract>[2]>;
type ValidatedContract = Readonly<{
  repository: Pick<Qtc, 'createContract'>;
  createContract: CreateContract;
  input: Input;
  key: Parameters<CreateContract>[1];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Pick<Qtc, 'createContract'>;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<CreateContract>[3];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Input['content'];
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcContractCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/contracts' ? { params: [] } : null),
      validate: (request): ValidatedContract => {
        context.parsers.allow(context.body, [
          'customerId',
          'opportunityId',
          'contractNumber',
          'quoteRevisionId',
          'quoteSnapshotId',
          'content',
        ]);
        const repository = context.repository();
        const createContract = repository.createContract;
        const input: Input = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          opportunityId: context.parsers.uuid(context.body.opportunityId, 'opportunityId'),
          contractNumber: context.parsers.string(context.body.contractNumber, 'contractNumber'),
          quoteRevisionId: context.parsers.uuid(context.body.quoteRevisionId, 'quoteRevisionId'),
          quoteSnapshotId: context.parsers.uuid(context.body.quoteSnapshotId, 'quoteSnapshotId'),
          content: context.parsers.jsonObject(context.body.content, 'content'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('contract:revise');
        return { repository, createContract, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.createContract.call(
          validated.repository,
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
