import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type NcrRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'createNcr'>;
type NcrInput = Parameters<NcrRepository['createNcr']>[0];
type NcrContext = Readonly<{
  repository: NcrRepository;
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
    decimal: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
  }>;
}>;

export function ncrCreateRoutes(context: NcrContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/complaints\/([0-9a-f-]+)\/ncrs$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Readonly<{ grant: AuthorizedQuery; input: NcrInput }> => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'ncrNumber',
          'defectType',
          'affectedScope',
          'responsibleOrganizationId',
          'investigatorId',
          'quarantinedQuantity',
          'temporaryContainment',
          'complaintExpectedVersion',
          'evidence',
          'idempotencyKey',
        ]);
        const grant = context.authorize('ncr:manage', Object.keys(body));
        return {
          grant,
          input: {
            ncrNumber: p.stableCode(p.string(body.ncrNumber, 'ncrNumber')),
            complaintId: p.uuid(match.params[0], 'complaintId'),
            defectType: p.string(body.defectType, 'defectType'),
            affectedScope: p.string(body.affectedScope, 'affectedScope'),
            ...(body.responsibleOrganizationId
              ? {
                  responsibleOrganizationId: p.uuid(
                    body.responsibleOrganizationId,
                    'responsibleOrganizationId',
                  ),
                }
              : {}),
            investigatorId: p.uuid(body.investigatorId, 'investigatorId'),
            quarantinedQuantity: p.decimal(body.quarantinedQuantity, 'quarantinedQuantity'),
            temporaryContainment: p.string(body.temporaryContainment, 'temporaryContainment'),
            complaintExpectedVersion: p.integer(
              body.complaintExpectedVersion,
              'complaintExpectedVersion',
              1,
              1_000_000,
            ),
            evidence: p.jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createNcr(
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
