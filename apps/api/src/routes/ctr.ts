import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type CtrRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'createCtr' | 'createCtrVersion' | 'submitCtr' | 'approveCtr' | 'linkCtrAttachment'
>;
type CtrContext = Readonly<{
  repository: CtrRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    version: (value: unknown) => number;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;
const pattern =
  (expression: RegExp) =>
  (pathname: string): RouteMatch | null => {
    const match = expression.exec(pathname);
    return match ? { params: match.slice(1) } : null;
  };
function bodyAndGrant(
  context: CtrContext,
  request: ApiRequest,
  fields: readonly string[],
  capability: PermissionKey,
) {
  const body = context.parsers.objectBody(request.body);
  context.parsers.allow(body, fields);
  const grant = context.authorize(capability, Object.keys(body));
  return { body, grant };
}

function creationRoutes(context: CtrContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/ctrs' ? { params: [] } : null),
      validate: (request) => {
        const { body, grant } = bodyAndGrant(
          context,
          request,
          ['opportunityId', 'code', 'title', 'requirements'],
          'ctr:create',
        );
        return {
          grant,
          input: {
            opportunityId: p.uuid(body.opportunityId, 'opportunityId'),
            code: p.string(body.code, 'code'),
            title: p.string(body.title, 'title'),
            requirements: p.jsonObject(body.requirements, 'requirements'),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createCtr(
            input.input,
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
      match: pattern(/^\/api\/v1\/ctrs\/([0-9a-f-]+)\/versions$/u),
      validate: (request, match) => {
        const { body, grant } = bodyAndGrant(
          context,
          request,
          ['title', 'requirements'],
          'ctr:update',
        );
        return {
          grant,
          ctrId: p.uuid(match.params[0], 'ctrId'),
          input: {
            title: p.string(body.title, 'title'),
            requirements: p.jsonObject(body.requirements, 'requirements'),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createCtrVersion(
            input.ctrId,
            input.input,
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

function commandRoutes(context: CtrContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/ctr-versions\/([0-9a-f-]+)\/submit$/u),
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        const versionId = p.uuid(match.params[0], 'ctrVersionId');
        // Submit authorizes without fields before its whitelist, unlike decision below.
        const grant = context.authorize('ctr:submit');
        p.allow(body, ['expectedVersion']);
        return {
          grant,
          versionId,
          expectedVersion: p.version(body.expectedVersion),
          idempotencyKey: p.idempotency(request),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await repository.submitCtr(
            input.versionId,
            input.expectedVersion,
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
      match: pattern(/^\/api\/v1\/ctr-versions\/([0-9a-f-]+)\/decision$/u),
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        const versionId = p.uuid(match.params[0], 'ctrVersionId');
        p.allow(body, ['decision', 'reason']);
        const grant = context.authorize('ctr:approve');
        const decision = p.string(body.decision, 'decision');
        if (!['APPROVED', 'REJECTED'].includes(decision))
          throw new DomainError('invalid_request', 'decision is unsupported');
        return {
          grant,
          versionId,
          decision: decision as 'APPROVED' | 'REJECTED',
          reason: p.string(body.reason, 'reason'),
          idempotencyKey: p.idempotency(request),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await repository.approveCtr(
            input.versionId,
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
  ];
}

function attachmentRoutes(context: CtrContext): readonly RouteDefinition[] {
  const p = context.parsers,
    repository = context.repository;
  return [
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/ctr-versions\/([0-9a-f-]+)\/attachments$/u),
      validate: (request, match) => {
        const { body, grant } = bodyAndGrant(context, request, ['attachmentId'], 'ctr:update');
        return {
          grant,
          versionId: p.uuid(match.params[0], 'ctrVersionId'),
          attachmentId: p.uuid(body.attachmentId, 'attachmentId'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.linkCtrAttachment(
            input.versionId,
            input.attachmentId,
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

export function ctrRoutes(context: CtrContext): readonly RouteDefinition[] {
  return [...creationRoutes(context), ...commandRoutes(context), ...attachmentRoutes(context)];
}
