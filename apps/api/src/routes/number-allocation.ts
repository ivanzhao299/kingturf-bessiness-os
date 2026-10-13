import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type AllocateArgs = Parameters<NonNullable<ApiDependencies['numbers']>['allocate']>;
type AllocationInput = Readonly<{ id: AllocateArgs[0]; key: AllocateArgs[1] }>;
type AllocationContext = Readonly<{
  repository: Pick<NonNullable<ApiDependencies['numbers']>, 'allocate'>;
  actor: AllocateArgs[2];
  correlationId: AllocateArgs[3];
  uuid: (value: unknown, name: string) => string;
  keyRequired: () => never;
}>;

export function numberAllocationRoutes(context: AllocationContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/allocate$/u.exec(pathname);
        return match?.[1] ? { params: [match[1]] } : null;
      },
      validate: (request, match): AllocationInput => {
        const key = request.headers?.['idempotency-key'];
        if (!key) context.keyRequired();
        return { id: context.uuid(match.params[0], 'definitionId'), key };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.allocate(
          input.id,
          input.key,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}
