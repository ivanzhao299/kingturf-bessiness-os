import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CapaRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'closeCapa' | 'verifyCapa'>;
type CloseInput = Parameters<CapaRepository['closeCapa']>[1];
type VerifyInput = Parameters<CapaRepository['verifyCapa']>[1];
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

export function capaLifecycleRoutes(context: CapaContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/capas\/([0-9a-f-]+)\/close$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): { grant: AuthorizedQuery; id: string; input: CloseInput } => {
        const body = p.objectBody(request.body);
        p.allow(body, ['expectedVersion', 'reason', 'evidence', 'idempotencyKey']);
        const grant = context.authorize('capa:manage', Object.keys(body));
        return {
          grant,
          id: p.uuid(match.params[0], 'capaId'),
          input: {
            expectedVersion: p.integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
            reason: p.string(body.reason, 'reason'),
            evidence: p.jsonObject(body.evidence, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.closeCapa(
            input.id,
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
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/capas\/([0-9a-f-]+)\/verify$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): { grant: AuthorizedQuery; id: string; input: VerifyInput } => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'verifiedAt',
          'standard',
          'sampleScope',
          'observationUntil',
          'result',
          'evidence',
          'expectedVersion',
          'complaintExpectedVersion',
          'idempotencyKey',
        ]);
        const grant = context.authorize('capa:verify', Object.keys(body));
        const verificationResult = p.string(body.result, 'result');
        if (!['PASSED', 'FAILED'].includes(verificationResult))
          throw new DomainError('invalid_request', 'result is unsupported');
        return {
          grant,
          id: p.uuid(match.params[0], 'capaId'),
          input: {
            verifiedAt: p.timestamp(body.verifiedAt, 'verifiedAt'),
            standard: p.string(body.standard, 'standard'),
            sampleScope: p.string(body.sampleScope, 'sampleScope'),
            observationUntil: p.timestamp(body.observationUntil, 'observationUntil'),
            result: verificationResult as VerifyInput['result'],
            evidence: p.jsonObject(body.evidence, 'evidence'),
            expectedVersion: p.integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
            complaintExpectedVersion: p.integer(
              body.complaintExpectedVersion,
              'complaintExpectedVersion',
              1,
              1_000_000,
            ),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.verifyCapa(
            input.id,
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
