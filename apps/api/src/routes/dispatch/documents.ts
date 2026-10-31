import { normalizeContactEmail } from '@kingturf/domain';
import {
  allow,
  authorizeOneOf,
  boundedString,
  connectorProvider,
  connectorSecretReference,
  documentConnector,
  documentLocale,
  error,
  expectedVersion,
  jsonObject,
  objectBody,
  safeConnectorConfiguration,
  string,
  uuid,
  version,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { businessDocumentActivityRoutes } from '../business-document-activity.ts';
import { businessDocumentBindingRoutes } from '../business-document-bindings.ts';
import { businessDocumentConnectorRoutes } from '../business-document-connector.ts';
import { businessDocumentCreateRoutes } from '../business-document-create.ts';
import {
  businessDocumentActivityLogReadRoutes,
  businessDocumentConnectorReadRoutes,
  businessDocumentDetailReadRoutes,
  businessDocumentListReadRoutes,
  businessDocumentReferenceReadRoutes,
} from '../business-document-reads.ts';
import { businessDocumentReviewRoutes } from '../business-document-review.ts';
import { businessDocumentSendRoutes } from '../business-document-send.ts';
import { businessDocumentTranslationRoutes } from '../business-document-translation.ts';
import { businessDocumentVersionRoutes } from '../business-document-version.ts';
import { dispatchRoutes } from '../types.ts';
import {
  directReply,
  routeReply,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
function* documentsPart1(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.pathname === '/api/v1/document-connectors' && request.method === 'GET') {
    const canConfigure = context.permissions.has('business-document:configure');
    if (!canConfigure)
      authorizeOneOf(context, 'business-document:send', 'business-document:translate');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentConnectorReadRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
            >,
          authorization: context,
          canConfigure,
        }),
        request,
      ),
    );
  }
  const connectorConfiguration = /^\/api\/v1\/document-connectors\/([A-Z_]+)$/u.exec(
    request.pathname,
  );
  if (connectorConfiguration && request.method === 'PUT') {
    authorizeQuery(context, 'business-document:configure');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentConnectorRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'configureConnector'
            >,
          authorization: context,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            expectedVersion,
            boundedString,
            connectorSecretReference,
            connectorProvider,
            safeConnectorConfiguration,
            documentConnector,
          },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/business-document-activity' && request.method === 'GET') {
    authorizeQuery(context, 'business-document:audit');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentActivityLogReadRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
            >,
          authorization: context,
          parsers: { uuid },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/business-documents' && request.method === 'GET') {
    const grant = authorizeQuery(context, 'business-document:read');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentListReadRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
            >,
          authorization: context,
          grant,
        }),
        request,
      ),
    );
  }
  if (
    request.pathname === '/api/v1/business-documents/reference-data' &&
    request.method === 'GET'
  ) {
    const grant = authorizeQuery(context, 'business-document:manage');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentReferenceReadRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
            >,
          authorization: context,
          grant,
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/business-documents' && request.method === 'POST') {
    authorizeQuery(context, 'business-document:manage');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentCreateRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'create'
            >,
          authorization: context,
          correlationId,
          parsers: { objectBody, allow, string, uuid, jsonObject },
        }),
        request,
      ),
    );
  }
}
function* documentsPart2(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const businessDocument = /^\/api\/v1\/business-documents\/([0-9a-f-]+)$/u.exec(request.pathname);
  if (businessDocument && request.method === 'GET') {
    const grant = authorizeQuery(context, 'business-document:read');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentDetailReadRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
            >,
          authorization: context,
          grant,
          parsers: { uuid },
        }),
        request,
      ),
    );
  }
  const businessDocumentVersion = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/versions$/u.exec(
    request.pathname,
  );
  if (businessDocumentVersion && request.method === 'POST') {
    const grant = authorizeQuery(context, 'business-document:manage');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentVersionRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'saveVersion'
            >,
          authorization: context,
          grant,
          correlationId,
          parsers: { objectBody, allow, string, uuid, version, jsonObject },
        }),
        request,
      ),
    );
  }
  const businessDocumentBindings = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/bindings$/u.exec(
    request.pathname,
  );
  if (businessDocumentBindings && request.method === 'PATCH') {
    const grant = authorizeQuery(context, 'business-document:manage');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentBindingRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'updateBindings'
            >,
          authorization: context,
          grant,
          correlationId,
          parsers: { objectBody, allow, uuid },
        }),
        request,
      ),
    );
  }
  const businessDocumentReview =
    /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/(submit|approve|reject)$/u.exec(
      request.pathname,
    );
  if (businessDocumentReview && request.method === 'POST') {
    const operation = businessDocumentReview[2];
    const action =
      operation === 'submit' ? 'SUBMITTED' : operation === 'approve' ? 'APPROVED' : 'REJECTED';
    const grant = authorizeQuery(
      context,
      action === 'SUBMITTED' ? 'business-document:manage' : 'business-document:approve',
    );
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentReviewRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'transition'
            >,
          authorization: context,
          grant,
          correlationId,
          action,
          parsers: { objectBody, allow, string, uuid, version },
        }),
        request,
      ),
    );
  }
  const businessDocumentTranslation =
    /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/translations$/u.exec(request.pathname);
  if (businessDocumentTranslation && request.method === 'POST') {
    const grant = authorizeQuery(context, 'business-document:translate');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentTranslationRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'createTranslation'
            >,
          authorization: context,
          grant,
          correlationId,
          parsers: { objectBody, allow, uuid, version, jsonObject, documentLocale },
        }),
        request,
      ),
    );
  }
}
function* documentsPart3(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const businessDocumentActivity = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/activity$/u.exec(
    request.pathname,
  );
  if (businessDocumentActivity && request.method === 'POST') {
    const grant = authorizeQuery(context, 'business-document:read');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentActivityRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'recordClientActivity'
            >,
          authorization: context,
          grant,
          correlationId,
          parsers: { objectBody, allow, string, uuid, version },
        }),
        request,
      ),
    );
  }
  const businessDocumentDispatch = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/send$/u.exec(
    request.pathname,
  );
  if (businessDocumentDispatch && request.method === 'POST') {
    const grant = authorizeQuery(context, 'business-document:send');
    if (!dependencies.businessDocuments) {
      yield directReply(
        error(503, 'internal_error', 'Business document repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        businessDocumentSendRoutes({
          repository: () =>
            dependencies.businessDocuments as Pick<
              NonNullable<ApiDependencies['businessDocuments']>,
              'dispatch'
            >,
          authorization: context,
          grant,
          correlationId,
          parsers: {
            objectBody,
            allow,
            uuid,
            version,
            boundedString,
            documentConnector,
            normalizeContactEmail,
          },
        }),
        request,
      ),
    );
  }
}
export function* documentsAttempts(scope: RouteDispatchContext): RouteAttempts {
  yield* documentsPart1(scope);
  yield* documentsPart2(scope);
  yield* documentsPart3(scope);
}
