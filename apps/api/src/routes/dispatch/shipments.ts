import { assertStableCode } from '@kingturf/domain';
import {
  allow,
  decimal,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { projectedReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* shipmentsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.shipments) {
    if (request.method === 'GET' && request.pathname === '/api/v1/shipment-releases') {
      const grant = authorizeQuery(context, 'shipment:read');
      yield projectedReply(
        dependencies.shipments.list({
          actor: context.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        }),
        (items) => {
          return {
            statusCode: 200,
            body: {
              items: items.map((item) =>
                permittedDto(item, context.permissions.get('shipment:read')?.fields ?? null),
              ),
            },
          };
        },
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/shipment-releases') {
      const body = objectBody(request.body);
      allow(body, [
        'requestNumber',
        'salesOrderId',
        'productionOrderId',
        'finishedLotId',
        'requestedQuantity',
        'requiredPaymentAmount',
        'reason',
        'idempotencyKey',
      ]);
      const grant = authorizeQuery(context, 'shipment:request', Object.keys(body));
      yield projectedReply(
        dependencies.shipments.request(
          {
            requestNumber: assertStableCode(string(body.requestNumber, 'requestNumber')),
            salesOrderId: uuid(body.salesOrderId, 'salesOrderId'),
            productionOrderId: uuid(body.productionOrderId, 'productionOrderId'),
            finishedLotId: uuid(body.finishedLotId, 'finishedLotId'),
            requestedQuantity: decimal(body.requestedQuantity, 'requestedQuantity'),
            requiredPaymentAmount: decimal(body.requiredPaymentAmount, 'requiredPaymentAmount'),
            reason: string(body.reason, 'reason'),
            idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
        },
      );
    }
    const releaseTransition =
      /^\/api\/v1\/shipment-releases\/([0-9a-f-]+)\/(approve-exception|reject-exception|release)$/u.exec(
        request.pathname,
      );
    if (request.method === 'POST' && releaseTransition) {
      const body = objectBody(request.body);
      allow(body, ['reason', 'evidence', 'idempotencyKey']);
      const action = releaseTransition[2] ?? '';
      const capability = action === 'release' ? 'shipment:release' : 'shipment:approve-exception';
      const grant = authorizeQuery(context, capability, Object.keys(body));
      const state =
        action === 'release'
          ? 'RELEASED'
          : action === 'approve-exception'
            ? 'APPROVED'
            : 'REJECTED';
      yield projectedReply(
        dependencies.shipments.transition(
          uuid(releaseTransition[1], 'releaseRequestId'),
          state,
          {
            reason: string(body.reason, 'reason'),
            evidence: jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
        },
      );
    }
    const dispatchCommand = /^\/api\/v1\/shipment-releases\/([0-9a-f-]+)\/dispatch$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && dispatchCommand) {
      const body = objectBody(request.body);
      allow(body, [
        'shipmentNumber',
        'carrierName',
        'trackingNumber',
        'dispatchedAt',
        'location',
        'evidence',
        'idempotencyKey',
      ]);
      const grant = authorizeQuery(context, 'shipment:dispatch', Object.keys(body));
      yield projectedReply(
        dependencies.shipments.dispatch(
          uuid(dispatchCommand[1], 'releaseRequestId'),
          {
            shipmentNumber: assertStableCode(string(body.shipmentNumber, 'shipmentNumber')),
            carrierName: string(body.carrierName, 'carrierName'),
            trackingNumber: assertStableCode(string(body.trackingNumber, 'trackingNumber')),
            dispatchedAt: timestamp(body.dispatchedAt, 'dispatchedAt'),
            location: string(body.location, 'location'),
            evidence: jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
        },
      );
    }
    const trackCommand = /^\/api\/v1\/shipments\/([0-9a-f-]+)\/(in-transit|deliver)$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && trackCommand) {
      const body = objectBody(request.body);
      allow(body, ['occurredAt', 'location', 'evidence', 'idempotencyKey']);
      const grant = authorizeQuery(context, 'shipment:track', Object.keys(body));
      yield projectedReply(
        dependencies.shipments.track(
          uuid(trackCommand[1], 'shipmentId'),
          trackCommand[2] === 'deliver' ? 'DELIVERED' : 'IN_TRANSIT',
          {
            occurredAt: timestamp(body.occurredAt, 'occurredAt'),
            location: string(body.location, 'location'),
            evidence: jsonObject(body.evidence ?? {}, 'evidence'),
            idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
        },
      );
    }
  }
}
