import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type SlaRepository = Pick<
  NonNullable<ApiDependencies['complaints']>,
  'listSlaPolicies' | 'createSlaPolicy'
>;
type SlaInput = Parameters<SlaRepository['createSlaPolicy']>[0];
type SlaContext = Readonly<{
  repository: SlaRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  permittedDto: (value: Record<string, unknown>, fields: readonly string[] | null) => unknown;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    timestamp: (value: unknown, name: string) => string;
  }>;
}>;

function slaInput(context: SlaContext, body: Record<string, unknown>): SlaInput {
  const p = context.parsers;
  const severity = p.string(body.severity, 'severity');
  if (
    severity !== 'LOW' &&
    severity !== 'MEDIUM' &&
    severity !== 'MAJOR' &&
    severity !== 'CRITICAL'
  )
    throw new DomainError('invalid_request', 'severity is unsupported');
  const responseHours = p.integer(body.responseHours, 'responseHours', 1, 8760);
  const containmentHours = p.integer(body.containmentHours, 'containmentHours', 1, 8760);
  const rootCauseHours = p.integer(body.rootCauseHours, 'rootCauseHours', 1, 8760);
  const closureHours = p.integer(body.closureHours, 'closureHours', 1, 8760);
  if (
    responseHours > containmentHours ||
    containmentHours > rootCauseHours ||
    rootCauseHours > closureHours
  )
    throw new DomainError(
      'invalid_request',
      'SLA hours must progress from response through closure',
    );
  return {
    policyCode: p.stableCode(p.string(body.policyCode, 'policyCode')),
    version: p.integer(body.version, 'version', 1, 10_000),
    severity,
    responseHours,
    containmentHours,
    rootCauseHours,
    closureHours,
    effectiveAt: p.timestamp(body.effectiveAt, 'effectiveAt'),
  };
}

export function complaintSlaRoutes(context: SlaContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/complaint-sla-policies' ? { params: [] } : null),
      validate: () => context.authorize('complaint-sla:read'),
      handler: async (_request, _match, grant) => {
        const items = await context.repository.listSlaPolicies({
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        });
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get('complaint-sla:read')?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/complaint-sla-policies' ? { params: [] } : null),
      validate: (request) => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'policyCode',
          'version',
          'severity',
          'responseHours',
          'containmentHours',
          'rootCauseHours',
          'closureHours',
          'effectiveAt',
        ]);
        const grant = context.authorize('complaint-sla:manage', Object.keys(body));
        return { grant, input: slaInput(context, body) };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createSlaPolicy(
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
