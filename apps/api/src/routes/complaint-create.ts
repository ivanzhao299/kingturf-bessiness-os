import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CreateRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'createComplaint'>;
type CreateInput = Parameters<CreateRepository['createComplaint']>[0];
type CreateContext = Readonly<{
  repository: CreateRepository;
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
    jsonObject: (value: unknown, name: string) => Record<string, never>;
  }>;
}>;

// TD-OPS-007（2026-11-26 项目所有者裁定，沿用现值）：投诉描述去首尾空白后至少 10 个字符，此前置
// 校验镜像迁移 0054 的 CHECK(length(trim(description))>=10——此前短描述直接命中该约束返回 500。
// 按码点计数，与 PostgreSQL 的 length() 同口径：星面字符（emoji 等）是 1 个字符、2 个 UTF-16
// 码元，按码元数会放行数据库仍拒绝的值。string() 已去首尾空白，入库值即计数所用值。
export const COMPLAINT_DESCRIPTION_MINIMUM = 10;

const complaintDescription = (
  value: unknown,
  parse: CreateContext['parsers']['string'],
): string => {
  const description = parse(value, 'description');
  if (Array.from(description).length < COMPLAINT_DESCRIPTION_MINIMUM)
    throw new DomainError(
      'invalid_request',
      `问题描述至少 ${String(COMPLAINT_DESCRIPTION_MINIMUM)} 个字符`,
    );
  return description;
};

function creationInput(context: CreateContext, body: Record<string, unknown>): CreateInput {
  const p = context.parsers;
  const channel = p.string(body.channel, 'channel');
  const severity = p.string(body.severity, 'severity');
  if (
    channel !== 'CUSTOMER_SERVICE' &&
    channel !== 'SALES' &&
    channel !== 'EMAIL' &&
    channel !== 'PHONE' &&
    channel !== 'ONSITE' &&
    channel !== 'OTHER'
  )
    throw new DomainError('invalid_request', 'channel is unsupported');
  if (
    severity !== 'LOW' &&
    severity !== 'MEDIUM' &&
    severity !== 'MAJOR' &&
    severity !== 'CRITICAL'
  )
    throw new DomainError('invalid_request', 'severity is unsupported');
  return {
    complaintNumber: p.stableCode(p.string(body.complaintNumber, 'complaintNumber')),
    customerId: p.uuid(body.customerId, 'customerId'),
    ...(body.salesOrderId ? { salesOrderId: p.uuid(body.salesOrderId, 'salesOrderId') } : {}),
    ...(body.shipmentId ? { shipmentId: p.uuid(body.shipmentId, 'shipmentId') } : {}),
    ...(body.inventoryLotId
      ? { inventoryLotId: p.uuid(body.inventoryLotId, 'inventoryLotId') }
      : {}),
    ...(body.qualityInspectionId
      ? { qualityInspectionId: p.uuid(body.qualityInspectionId, 'qualityInspectionId') }
      : {}),
    slaPolicyVersionId: p.uuid(body.slaPolicyVersionId, 'slaPolicyVersionId'),
    channel,
    defectCategory: p.string(body.defectCategory, 'defectCategory'),
    severity,
    occurredAt: p.timestamp(body.occurredAt, 'occurredAt'),
    reportedAt: p.timestamp(body.reportedAt, 'reportedAt'),
    description: complaintDescription(body.description, p.string),
    customerRequest: p.string(body.customerRequest, 'customerRequest'),
    ...(body.assignedTo ? { assignedTo: p.uuid(body.assignedTo, 'assignedTo') } : {}),
    initialSnapshot: p.jsonObject(body.initialSnapshot, 'initialSnapshot'),
    idempotencyKey: p.stableCode(p.string(body.idempotencyKey, 'idempotencyKey')),
  };
}

export function complaintCreateRoutes(context: CreateContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/complaints' ? { params: [] } : null),
      validate: (request) => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'complaintNumber',
          'customerId',
          'salesOrderId',
          'shipmentId',
          'inventoryLotId',
          'qualityInspectionId',
          'slaPolicyVersionId',
          'channel',
          'defectCategory',
          'severity',
          'occurredAt',
          'reportedAt',
          'description',
          'customerRequest',
          'assignedTo',
          'initialSnapshot',
          'idempotencyKey',
        ]);
        const grant = context.authorize('complaint:create', Object.keys(body));
        return { grant, input: creationInput(context, body) };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createComplaint(
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
