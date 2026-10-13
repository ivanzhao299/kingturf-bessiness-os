import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CapaRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'createCapa'>;
type CapaInput = Parameters<CapaRepository['createCapa']>[0];
type CapaContext = Readonly<{
  repository: CapaRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    uuid: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
  }>;
}>;

function creationInput(
  context: CapaContext,
  body: Record<string, unknown>,
  ncrId: unknown,
): CapaInput {
  const p = context.parsers;
  const riskLevel = p.string(body.riskLevel, 'riskLevel');
  if (!['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'].includes(riskLevel))
    throw new DomainError('invalid_request', 'riskLevel is unsupported');
  return {
    capaNumber: p.stableCode(p.string(body.capaNumber, 'capaNumber')),
    ncrId: p.uuid(ncrId, 'ncrId'),
    ownerId: p.uuid(body.ownerId, 'ownerId'),
    targetAt: p.timestamp(body.targetAt, 'targetAt'),
    riskLevel: riskLevel as CapaInput['riskLevel'],
    rootCauseSnapshot: p.jsonObject(body.rootCauseSnapshot, 'rootCauseSnapshot'),
    complaintExpectedVersion: p.integer(
      body.complaintExpectedVersion,
      'complaintExpectedVersion',
      1,
      1_000_000,
    ),
    evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
    idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
  };
}

export function capaCreateRoutes(context: CapaContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/ncrs\/([0-9a-f-]+)\/capas$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'capaNumber',
          'ownerId',
          'targetAt',
          'riskLevel',
          'rootCauseSnapshot',
          'complaintExpectedVersion',
          'evidence',
          'idempotencyKey',
        ]);
        const grant = context.authorize('capa:manage', Object.keys(body));
        return { grant, input: creationInput(context, body, match.params[0]) };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createCapa(
            input.input,
            {
              actor: context.authorization.actor,
              scopes: input.grant.scopes,
              anchors: input.grant.anchors,
            },
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}
