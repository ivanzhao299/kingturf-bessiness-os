import { DomainError } from '@kingturf/domain';
import { integer, permittedDto, uuid } from '../../app-values.ts';
import { guardRejection } from '../../pg-rejections.ts';
import { authorizeQuery } from '../../policy.ts';
import { shipmentsAttempts } from '../dispatch/shipments.ts';
import { legacyRequest, runLegacyAttempts } from './legacy-attempts.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const pathname = '/api/v1/shipment-releases';
const states = ['EXCEPTION_PENDING', 'READY', 'APPROVED', 'RELEASED', 'REJECTED'];
const searchFields = ['request_number', 'orderNumber', 'productionOrderNumber', 'lotNumber'];
const shipmentGuardHints = {
  'release event sequence must be contiguous': '放行申请已更新，请刷新后再操作。',
  'ready release can only be released': '待放行的申请只能执行仓库放行。',
  'exception requires approval decision': '请先完成发货例外审批。',
  'approved exception can only be released': '已批准的例外申请只能执行仓库放行。',
  'terminal release state is immutable': '该放行申请已结案。',
  'shipment requester cannot approve own exception': '请由发货申请人以外的人员审批例外。',
  'shipment requires released gate': '请先完成仓库放行再登记发运。',
  'shipment event sequence must be contiguous': '发运状态已更新，请刷新后再操作。',
  'invalid shipment transition': '当前发运状态无法办理该操作。',
  'in-transit shipment can only be delivered': '运输中的发运单只能登记签收。',
  'delivered shipment is immutable': '该发运单已签收。',
  'delivery requires receiver, timestamp, and proof reference':
    '签收须填写签收人、时间和回单编号。',
};

function shipmentRepository(scope: FastifyRouteScope) {
  const repo = scope.dependencies.shipments;
  if (!repo) throw Object.assign(new Error('Shipment dependency unavailable'), { statusCode: 503 });
  return repo;
}

function readContext(scope: FastifyRouteScope) {
  const { authorization } = scope;
  const grant = authorizeQuery(authorization, 'shipment:read');
  return { actor: authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
}

function registerShipmentReads(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  const fields = scope.authorization.permissions.get('shipment:read')?.fields ?? null;
  const canRead = (field: string) => fields === null || fields.includes(field);
  app.get(pathname, async (request) => {
    const { state, query, limit, cursor, summary } = request.query as Readonly<
      Record<string, string | undefined>
    >;
    const repo = shipmentRepository(scope);
    if (!(state || query || limit || cursor || summary))
      return (await runLegacyAttempts(scope, legacyRequest(request), shipmentsAttempts)).body;
    const context = readContext(scope);
    if (state && !states.includes(state))
      throw new DomainError('invalid_request', 'state is unsupported');
    if ((state && !canRead('state')) || (query && !searchFields.every(canRead)))
      throw new DomainError('forbidden', 'Field permission denied');
    if (query && query.length > 100)
      throw new DomainError('invalid_request', 'query exceeds 100 characters');
    if (summary && summary !== 'true')
      throw new DomainError('invalid_request', 'summary is unsupported');
    const filter = {
      limit: limit ? integer(Number(limit), 'limit', 1, 100) : 50,
      ...(state ? { state } : {}),
      ...(query?.trim() ? { query: query.trim() } : {}),
      ...(cursor ? { cursor: uuid(cursor, 'cursor') } : {}),
    };
    const [page, counts] = await Promise.all([
      repo.listShipmentPage(filter, context),
      summary && canRead('state') && canRead('shipments') ? repo.shipmentCounts(context) : null,
    ]);
    return {
      items: page.items.map((item) => permittedDto(item, fields)),
      nextCursor: page.nextCursor,
      ...(counts ? { summary: counts } : {}),
    };
  });
  app.get(`${pathname}/:id`, async (request) => {
    const context = readContext(scope);
    const id = uuid((request.params as { id: string }).id, 'releaseRequestId');
    const row = await shipmentRepository(scope).findShipmentRelease(id, context);
    if (!row) throw new DomainError('not_found', 'Shipment release not found');
    return permittedDto(row, fields);
  });
}

export function registerShipmentRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  registerShipmentReads(app, scope);
  for (const path of [
    pathname,
    ...['approve-exception', 'reject-exception', 'release', 'dispatch'].map(
      (action) => `${pathname}/:id/${action}`,
    ),
    '/api/v1/shipments/:id/in-transit',
    '/api/v1/shipments/:id/deliver',
  ]) {
    app.post(path, async (request, reply) => {
      shipmentRepository(scope);
      try {
        const result = await runLegacyAttempts(scope, legacyRequest(request), shipmentsAttempts);
        void reply.code(result.statusCode);
        return result.body;
      } catch (error: unknown) {
        const hint = guardRejection(error, shipmentGuardHints);
        if (hint) throw new DomainError('conflict', hint);
        throw error;
      }
    });
  }
}
