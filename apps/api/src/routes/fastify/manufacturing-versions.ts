import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../api-types.ts';
import { idempotency, mutationDto, timestamp, uuid } from '../../app-values.ts';
import type { Context } from '../../manufacturing-read-repositories.ts';
import type { VersionPatch } from '../../manufacturing-version-repository.ts';
import { isUniqueViolation } from '../../pg-rejections.ts';
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const positiveQuantity = z
  .string()
  .trim()
  .regex(/^\d{1,18}(?:\.\d{1,6})?$/u)
  .refine((value) => Number(value) > 0);
const minutes = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,6})?$/u);
const stableCode = z.string().trim().min(1).transform(assertStableCode);
const common = {
  copyFromVersionId: z.uuid().toLowerCase().optional(),
  effectiveAt: z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .transform((value) => timestamp(value, 'effectiveAt'))
    .optional(),
};
const itemBody = z.strictObject({
  ...common,
  specification: z.record(z.string(), z.json()).optional(),
});
const substitute = z.strictObject({
  itemVersionId: z.uuid().toLowerCase(),
  priority: z.number().int().min(1).max(1000),
  conversionFactor: positiveQuantity,
});
const bomLine = z.strictObject({
  componentItemVersionId: z.uuid().toLowerCase(),
  quantity: positiveQuantity,
  scrapBasisPoints: z.number().int().min(0).max(10000).optional(),
  substitutes: z.array(substitute).optional(),
});
const bomBody = z.strictObject({
  ...common,
  productItemVersionId: z.uuid().toLowerCase().optional(),
  outputQuantity: positiveQuantity.optional(),
  lines: z.array(bomLine).min(1).optional(),
});
const operation = z.strictObject({
  operationCode: stableCode,
  name: z.string().trim().min(1),
  workCenterCode: stableCode,
  sequence: z.number().int().min(1).max(100000),
  setupMinutes: minutes,
  runMinutesPerUnit: minutes,
  instructions: z.record(z.string(), z.json()).optional(),
});
const routingBody = z.strictObject({
  ...common,
  productItemVersionId: z.uuid().toLowerCase().optional(),
  operations: z.array(operation).min(1).optional(),
});

const distinct = <T>(entries: readonly T[], key: (entry: T) => number | string): boolean =>
  new Set(entries.map(key)).size === entries.length;

function registerVersion<Body extends VersionPatch>(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
  options: Readonly<{
    path: string;
    body: z.ZodType<Body>;
    manage: PermissionKey;
    read: PermissionKey;
    versionConstraint: string;
    insert: (root: string, body: Body, key: string, context: Context) => Promise<JsonObject>;
  }>,
): void {
  app.post(options.path, { schema: { body: options.body } }, async (request, reply) => {
    // The provider validates this route with the supplied Zod schema before dispatch.
    const body = request.body as Body;
    const grant = authorizeQuery(scope.authorization, options.manage, Object.keys(body));
    const rootId = uuid((request.params as { rootId: string }).rootId, 'rootId');
    const key = idempotency(request as unknown as ApiRequest);
    const context = {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: grant.anchors,
    };
    try {
      const created = await options.insert(rootId, body, key, context);
      void reply.code(201);
      return mutationDto(created, scope.authorization, options.read);
    } catch (error: unknown) {
      if (isUniqueViolation(error, options.versionConstraint))
        throw new DomainError('conflict', '其他操作已新建此版本，请刷新后重试');
      throw error;
    }
  });
}

export function registerManufacturingVersionRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository = () => {
    if (!scope.dependencies.manufacturing)
      throw Object.assign(new Error('Manufacturing dependency unavailable'), { statusCode: 503 });
    return scope.dependencies.manufacturing;
  };
  registerVersion(app, scope, {
    path: '/api/v1/manufacturing-items/:rootId/versions',
    body: itemBody,
    manage: 'manufacturing-item:manage',
    read: 'manufacturing-item:read',
    versionConstraint: 'manufacturing_item_versions_tenant_id_item_id_version_key',
    insert: (id, body, key, context) =>
      repository().createItemVersion(id, body, key, context, scope.correlationId),
  });
  registerVersion(app, scope, {
    path: '/api/v1/manufacturing-boms/:rootId/versions',
    body: bomBody,
    manage: 'bom:manage',
    read: 'bom:read',
    versionConstraint: 'manufacturing_bom_versions_tenant_id_bom_id_version_key',
    insert: (id, body, key, context) => {
      const { lines: suppliedLines, ...patch } = body;
      const lines = suppliedLines?.map((line) => {
        const substitutes = line.substitutes ?? [];
        if (
          !distinct(substitutes, (entry) => entry.priority) ||
          !distinct(substitutes, (entry) => entry.itemVersionId)
        )
          throw new DomainError('invalid_request', '同一组件的替代料和优先级不能重复');
        return { ...line, scrapBasisPoints: line.scrapBasisPoints ?? 0, substitutes };
      });
      return repository().createBomVersion(
        id,
        { ...patch, ...(lines === undefined ? {} : { lines }) },
        key,
        context,
        scope.correlationId,
      );
    },
  });
  registerVersion(app, scope, {
    path: '/api/v1/manufacturing-routings/:rootId/versions',
    body: routingBody,
    manage: 'routing:manage',
    read: 'routing:read',
    versionConstraint: 'manufacturing_routing_versions_tenant_id_routing_id_version_key',
    insert: (id, body, key, context) => {
      const { operations: suppliedOperations, ...patch } = body;
      const operations = suppliedOperations?.map((entry) => ({
        ...entry,
        instructions: entry.instructions ?? {},
      }));
      if (
        operations &&
        (!distinct(operations, (entry) => entry.sequence) ||
          !distinct(operations, (entry) => entry.operationCode))
      )
        throw new DomainError('invalid_request', '同一路线的工序编号和顺序不能重复');
      return repository().createRoutingVersion(
        id,
        { ...patch, ...(operations === undefined ? {} : { operations }) },
        key,
        context,
        scope.correlationId,
      );
    },
  });
}
