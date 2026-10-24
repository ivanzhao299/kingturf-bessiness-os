import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import type { SourceReadGrant } from '../aggregate-authorization.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type CollectionContext = Readonly<{
  repository: NonNullable<ApiDependencies['collections']>;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  projectLegal: (
    value: Record<string, unknown>,
    grant: SourceReadGrant | undefined,
  ) => Record<string, unknown>;
  permittedDto: (
    value: Record<string, unknown>,
    fields: readonly string[] | null,
  ) => Record<string, unknown>;
  mutationDto: (value: Record<string, unknown>) => unknown;
  legalMutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    strings: (value: unknown, name: string) => readonly string[];
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    stableCode: (value: string) => string;
  }>;
}>;
const literal =
  (pathname: string) =>
  (candidate: string): RouteMatch | null =>
    candidate === pathname ? { params: [] } : null;
const pattern =
  (expression: RegExp) =>
  (candidate: string): RouteMatch | null => {
    const match = expression.exec(candidate);
    return match ? { params: match.slice(1) } : null;
  };

function bodyAndAccess(
  context: CollectionContext,
  request: ApiRequest,
  fields: readonly string[],
  capability: PermissionKey,
) {
  const body = context.parsers.objectBody(request.body);
  context.parsers.allow(body, fields);
  const grant = context.authorize(capability, Object.keys(body));
  return {
    body,
    access: { actor: context.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
  };
}

function caseRoutes(context: CollectionContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/collection-cases'),
      // GET ignores body; authorization and independent legal read are explicit validated inputs.
      validate: () => {
        const grant = context.authorize('collection:read');
        const legalRead = context.authorization.permissions.has('legal-case:read')
          ? {
              ...context.authorize('legal-case:read'),
              fields: context.authorization.permissions.get('legal-case:read')?.fields ?? null,
            }
          : undefined;
        return {
          access: {
            actor: context.authorization.actor,
            scopes: grant.scopes,
            anchors: grant.anchors,
            legalRead,
          },
          legalRead,
        };
      },
      handler: async (_request, _match, input) => {
        const items = await repository.list(input.access);
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                context.projectLegal(item, input.legalRead),
                context.authorization.permissions.get('collection:read')?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/collection-cases'),
      validate: (request) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['caseNumber', 'arOpenItemId', 'assignedTo', 'priority', 'reason', 'idempotencyKey'],
          'collection:manage',
        );
        const priority = p.string(body.priority, 'priority');
        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority))
          throw new DomainError('invalid_request', 'priority is unsupported');
        return {
          access,
          input: {
            caseNumber: p.stableCode(p.string(body.caseNumber, 'caseNumber')),
            arOpenItemId: p.uuid(body.arOpenItemId, 'arOpenItemId'),
            assignedTo: p.uuid(body.assignedTo, 'assignedTo'),
            priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            reason: p.string(body.reason, 'reason'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createCase(input.input, input.access, context.correlationId),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/followups$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          [
            'channel',
            'occurredAt',
            'contactPerson',
            'outcome',
            'nextActionAt',
            'evidence',
            'idempotencyKey',
          ],
          'collection:manage',
        );
        const channel = p.string(body.channel, 'channel');
        if (!['PHONE', 'EMAIL', 'LETTER', 'MEETING', 'VISIT', 'OTHER'].includes(channel))
          throw new DomainError('invalid_request', 'channel is unsupported');
        return {
          access,
          collectionCaseId: p.uuid(match.params[0], 'collectionCaseId'),
          input: {
            channel: channel as 'PHONE' | 'EMAIL' | 'LETTER' | 'MEETING' | 'VISIT' | 'OTHER',
            occurredAt: p.timestamp(body.occurredAt, 'occurredAt'),
            contactPerson: p.string(body.contactPerson, 'contactPerson'),
            outcome: p.string(body.outcome, 'outcome'),
            ...(body.nextActionAt
              ? { nextActionAt: p.timestamp(body.nextActionAt, 'nextActionAt') }
              : {}),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.addFollowup(
            input.collectionCaseId,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/(resolve|close)$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['reason', 'evidence', 'idempotencyKey'],
          'collection:close',
        );
        const collectionCaseId = p.uuid(match.params[0], 'collectionCaseId');
        const state: 'RESOLVED' | 'CLOSED' = match.params[1] === 'resolve' ? 'RESOLVED' : 'CLOSED';
        return {
          access,
          collectionCaseId,
          state,
          input: {
            reason: p.string(body.reason, 'reason'),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.transitionCase(
            input.collectionCaseId,
            input.state,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}

function promiseRoutes(context: CollectionContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/promises$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          [
            'promisedAmount',
            'currency',
            'promisedAt',
            'dueAt',
            'debtorContact',
            'evidence',
            'idempotencyKey',
          ],
          'collection:manage',
        );
        return {
          access,
          collectionCaseId: p.uuid(match.params[0], 'collectionCaseId'),
          input: {
            promisedAmount: p.decimal(body.promisedAmount, 'promisedAmount'),
            currency: p.currency(body.currency),
            promisedAt: p.timestamp(body.promisedAt, 'promisedAt'),
            dueAt: p.timestamp(body.dueAt, 'dueAt'),
            debtorContact: p.string(body.debtorContact, 'debtorContact'),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createPromise(
            input.collectionCaseId,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/collection-promises\/([0-9a-f-]+)\/(fulfill|break|cancel)$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['reason', 'allocationEntryIds', 'evidence', 'idempotencyKey'],
          'collection:escalate',
        );
        const action = match.params[1] ?? '';
        const promiseId = p.uuid(match.params[0], 'promiseId');
        const state: 'FULFILLED' | 'BROKEN' | 'CANCELLED' =
          action === 'fulfill' ? 'FULFILLED' : action === 'break' ? 'BROKEN' : 'CANCELLED';
        return {
          access,
          promiseId,
          state,
          input: {
            reason: p.string(body.reason, 'reason'),
            allocationEntryIds: p
              .strings(body.allocationEntryIds ?? [], 'allocationEntryIds')
              .map((id) => p.uuid(id, 'allocationEntryId')),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.decidePromise(
            input.promiseId,
            input.state,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}

function legalRoutes(context: CollectionContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/legal-handoffs$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['handoffNumber', 'reason', 'idempotencyKey'],
          'collection:escalate',
        );
        return {
          access,
          collectionCaseId: p.uuid(match.params[0], 'collectionCaseId'),
          input: {
            handoffNumber: p.stableCode(p.string(body.handoffNumber, 'handoffNumber')),
            reason: p.string(body.reason, 'reason'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.legalMutationDto(
          await repository.requestLegal(
            input.collectionCaseId,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/legal-handoffs\/([0-9a-f-]+)\/(accept|return)$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['reason', 'evidence', 'idempotencyKey'],
          'legal-case:decide',
        );
        const legalHandoffId = p.uuid(match.params[0], 'legalHandoffId');
        const state: 'ACCEPTED' | 'RETURNED' =
          match.params[1] === 'accept' ? 'ACCEPTED' : 'RETURNED';
        return {
          access,
          legalHandoffId,
          state,
          input: {
            reason: p.string(body.reason, 'reason'),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.legalMutationDto(
          await repository.decideLegal(
            input.legalHandoffId,
            input.state,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/legal-handoffs\/([0-9a-f-]+)\/evidence-packages$/u),
      validate: (request, match) => {
        const { body, access } = bodyAndAccess(
          context,
          request,
          ['packageNumber', 'idempotencyKey'],
          'debt-evidence:generate',
        );
        return {
          access,
          legalHandoffId: p.uuid(match.params[0], 'legalHandoffId'),
          input: {
            packageNumber: p.stableCode(p.string(body.packageNumber, 'packageNumber')),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.legalMutationDto(
          await repository.generateEvidencePackage(
            input.legalHandoffId,
            input.input,
            input.access,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}

export function collectionRoutes(context: CollectionContext): readonly RouteDefinition[] {
  return [...caseRoutes(context), ...promiseRoutes(context), ...legalRoutes(context)];
}
