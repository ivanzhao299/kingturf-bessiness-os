import { DomainError } from '@kingturf/domain';
import {
  allow,
  array,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { projectedReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* contractsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.contractDocuments) {
    if (request.method === 'GET' && request.pathname === '/api/v1/contract-documents') {
      const grant = authorizeQuery(context, 'contract-document:read');
      const query = request.query ?? {};
      const subjectType = query.subjectType;
      if (subjectType && !['contract-revision', 'purchase-order'].includes(subjectType))
        throw new DomainError('invalid_request', 'subjectType is unsupported');
      const subjectId = query.subjectId ? uuid(query.subjectId, 'subjectId') : undefined;
      yield projectedReply(
        dependencies.contractDocuments.list(
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          subjectType,
          subjectId,
        ),
        (items) => {
          return { statusCode: 200, body: { items } };
        },
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/contract-documents') {
      const body = objectBody(request.body);
      allow(body, ['businessType', 'subjectType', 'subjectId', 'attachmentId', 'title']);
      const grant = authorizeQuery(context, 'contract-document:manage', Object.keys(body));
      const businessType = string(body.businessType, 'businessType');
      const subjectType = string(body.subjectType, 'subjectType');
      if (
        !['SALES', 'PURCHASE'].includes(businessType) ||
        !['contract-revision', 'purchase-order'].includes(subjectType)
      )
        throw new DomainError(
          'invalid_request',
          'Contract business or subject type is unsupported',
        );
      yield projectedReply(
        dependencies.contractDocuments.create(
          {
            businessType: businessType as 'SALES' | 'PURCHASE',
            subjectType: subjectType as 'contract-revision' | 'purchase-order',
            subjectId: uuid(body.subjectId, 'subjectId'),
            attachmentId: uuid(body.attachmentId, 'attachmentId'),
            title: string(body.title, 'title'),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return {
            statusCode: 201,
            body: mutationDto(result, context, 'contract-document:read'),
          };
        },
      );
    }
    const ocr = /^\/api\/v1\/contract-documents\/([0-9a-f-]+)\/ocr(?:-review)?$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && ocr) {
      const body = objectBody(request.body);
      allow(body, ['provider', 'text', 'fields', 'confidence']);
      const reviewed = request.pathname.endsWith('/ocr-review');
      const grant = authorizeQuery(
        context,
        reviewed ? 'contract-ocr:review' : 'contract-ocr:operate',
        Object.keys(body),
      );
      const confidence = Number(body.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
        throw new DomainError('invalid_request', 'confidence must be between 0 and 1');
      yield projectedReply(
        dependencies.contractDocuments.ocr(
          uuid(ocr[1], 'contractDocumentId'),
          {
            provider: string(body.provider, 'provider'),
            text: string(body.text, 'text'),
            fields: jsonObject(body.fields ?? {}, 'fields'),
            confidence,
          },
          reviewed,
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return {
            statusCode: 200,
            body: mutationDto(result, context, 'contract-document:read'),
          };
        },
      );
    }
    const envelope = /^\/api\/v1\/contract-documents\/([0-9a-f-]+)\/signature-envelopes$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && envelope) {
      const body = objectBody(request.body);
      allow(body, ['provider', 'providerEnvelopeId', 'signingOrder', 'expiresAt', 'signers']);
      const grant = authorizeQuery(context, 'contract-signature:send', Object.keys(body));
      const signingOrder = string(body.signingOrder, 'signingOrder');
      if (!['SEQUENTIAL', 'PARALLEL'].includes(signingOrder))
        throw new DomainError('invalid_request', 'signingOrder is unsupported');
      const signers = array(body.signers, 'signers').map((value, index) => {
        const signer = objectBody(value);
        allow(signer, ['sequence', 'role', 'name', 'contact']);
        return {
          sequence: integer(signer.sequence, `signers[${String(index)}].sequence`, 1, 20),
          role: string(signer.role, 'role'),
          name: string(signer.name, 'name'),
          contact: string(signer.contact, 'contact'),
        };
      });
      if (!signers.length)
        throw new DomainError('invalid_request', 'At least one signer is required');
      yield projectedReply(
        dependencies.contractDocuments.createEnvelope(
          uuid(envelope[1], 'contractDocumentId'),
          {
            provider: string(body.provider, 'provider'),
            providerEnvelopeId: string(body.providerEnvelopeId, 'providerEnvelopeId'),
            signingOrder: signingOrder as 'SEQUENTIAL' | 'PARALLEL',
            expiresAt: body.expiresAt ? timestamp(body.expiresAt, 'expiresAt') : null,
            signers,
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return {
            statusCode: 201,
            body: mutationDto(result, context, 'contract-document:read'),
          };
        },
      );
    }
    const complete = /^\/api\/v1\/signature-envelopes\/([0-9a-f-]+)\/complete$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && complete) {
      const body = objectBody(request.body);
      allow(body, ['providerEventId', 'signedAt', 'signedAttachmentId', 'evidence']);
      const grant = authorizeQuery(context, 'contract-signature:confirm', Object.keys(body));
      yield projectedReply(
        dependencies.contractDocuments.completeEnvelope(
          uuid(complete[1], 'envelopeId'),
          {
            providerEventId: string(body.providerEventId, 'providerEventId'),
            signedAt: timestamp(body.signedAt, 'signedAt'),
            signedAttachmentId: uuid(body.signedAttachmentId, 'signedAttachmentId'),
            evidence: jsonObject(body.evidence ?? {}, 'evidence'),
          },
          { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          correlationId,
        ),
        (result) => {
          return {
            statusCode: 200,
            body: mutationDto(result, context, 'contract-document:read'),
          };
        },
      );
    }
  }
}
