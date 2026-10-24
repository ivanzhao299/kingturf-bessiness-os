import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type BatchRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'batchTriage'>;
type ValidatedBatch = Readonly<{
  input: Parameters<BatchRepository['batchTriage']>[0];
  repositoryContext: Parameters<BatchRepository['batchTriage']>[1];
}>;
type BatchContext = Readonly<{
  repository: BatchRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    uuid: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
}>;

function validateBatch(context: BatchContext, request: ApiRequest): ValidatedBatch {
  const p = context.parsers;
  const body = p.objectBody(request.body);
  p.allow(body, ['batchKey', 'items']);
  const triageGrant = context.authorize('complaint:triage', Object.keys(body));
  const assignGrant = context.authorize('complaint:assign', Object.keys(body));
  const rawItems = p.array(body.items, 'items');
  if (rawItems.length < 1 || rawItems.length > 50)
    throw new DomainError('invalid_request', 'items must contain between 1 and 50 rows');
  const items = rawItems.map((value, index) => {
    const item = p.objectBody(value);
    p.allow(item, ['id', 'expectedVersion', 'assignedTo', 'reason']);
    return {
      id: p.uuid(item.id, `items[${String(index)}].id`),
      expectedVersion: p.integer(
        item.expectedVersion,
        `items[${String(index)}].expectedVersion`,
        1,
        1_000_000,
      ),
      assignedTo: p.uuid(item.assignedTo, `items[${String(index)}].assignedTo`),
      reason: p.string(item.reason, `items[${String(index)}].reason`),
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new DomainError('invalid_request', 'items must not contain duplicate complaints');
  const sharedScopes = triageGrant.scopes.filter((value) => assignGrant.scopes.includes(value));
  const sharedAnchors = triageGrant.anchors.filter((left) =>
    assignGrant.anchors.some(
      (right) => right.scope === left.scope && right.organizationId === left.organizationId,
    ),
  );
  return {
    input: { batchKey: p.stableCode(p.string(body.batchKey, 'batchKey')), items },
    repositoryContext: {
      actor: context.authorization.actor,
      scopes: sharedScopes,
      anchors: sharedAnchors,
    },
  };
}

export function complaintBatchTriageRoutes(context: BatchContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/complaints/batch-triage' ? { params: [] } : null),
      validate: (request) => validateBatch(context, request),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.batchTriage(
          input.input,
          input.repositoryContext,
          context.correlationId,
        ),
      }),
    }),
  ];
}
