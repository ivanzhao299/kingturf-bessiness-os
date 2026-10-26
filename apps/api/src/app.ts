import { DEFAULT_BROWSER_SESSION, type BrowserSessionConfig } from '@kingturf/config';
import {
  addDecimal,
  assertStableCode,
  DomainError,
  NOOP_TELEMETRY,
  normalizeContactEmail,
  normalizeDecimal,
  parseEffectiveTimestamp,
  type AuthorizationRepository,
  type EmployeeRepository,
  type OperationalLogger,
  type OrganizationRepository,
  type Telemetry,
} from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiApplication, ApiRequest, ApiResponse } from './api-types.ts';
import {
  allow,
  array,
  attachmentBytes,
  authorizeOneOf,
  boundedString,
  calendarDate,
  connectorProvider,
  connectorSecretReference,
  correlation,
  costFactorSourceType,
  currency,
  decimal,
  documentConnector,
  documentLocale,
  effectiveRange,
  error,
  expectedVersion,
  idempotency,
  integer,
  jsonObject,
  mutationDto,
  notificationChannel,
  objectBody,
  permittedDto,
  requireCostFactorItemSource,
  safeConnectorConfiguration,
  string,
  strings,
  timestamp,
  uuid,
  version,
} from './app-values.ts';
import type { PostgresBusinessDocumentRepository } from './business-document-repositories.ts';
import type { PostgresCollectionRepository } from './collection-repositories.ts';
import type { PostgresCommercialRepository } from './commercial-repositories.ts';
import type { PostgresCommissionRepository } from './commission-repositories.ts';
import type { PostgresComplaintRepository } from './complaint-repositories.ts';
import type { PostgresContractDocumentRepository } from './contract-document-repositories.ts';
import type { PostgresCrmRepository } from './crm-repositories.ts';
import type { PostgresDashboardRepository } from './dashboard-repositories.ts';
import type {
  PostgresAttachmentRepository,
  PostgresBusinessObjectRepository,
  PostgresEventRepository,
  PostgresNotificationRepository,
} from './foundation-repositories.ts';
import type { PostgresManufacturingRepository } from './manufacturing-repositories.ts';
import { LoginRateLimiter } from './middleware/login-rate-limit.ts';
import { securityResponseHeaders } from './middleware/security-headers.ts';
import {
  authorizeCookieRequest,
  browserAuthResponse,
  parseSessionCarrier,
  requireMachineContext,
  SessionRequestError,
} from './middleware/session-carrier.ts';
import type { PostgresMrpRepository } from './mrp-repositories.ts';
import type { PostgresOrder360Repository } from './order-360-repositories.ts';
import type {
  PostgresAuditRepository,
  PostgresMasterDataRepository,
  PostgresNumberRepository,
  PostgresRuleRepository,
  PostgresWorkflowRepository,
} from './platform-repositories.ts';
import { authorizeQuery } from './policy.ts';
import type { PostgresProcurementRepository } from './procurement-repositories.ts';
import type { PostgresProductionCostRepository } from './production-cost-repositories.ts';
import type { PostgresProductionRepository } from './production-repositories.ts';
import type { PostgresQuoteToCashRepository } from './qtc-repositories.ts';
import type { PostgresQualityRepository } from './quality-repositories.ts';
import type { PostgresRiskRepository } from './risk-repositories.ts';
import { auditReadRoutes } from './routes/audit-reads.ts';
import { credentialRoutes, loginRoutes, sessionRoutes } from './routes/auth.ts';
import { dispatchAuthorizationRoutes } from './routes/authorization.ts';
import { businessDocumentActivityRoutes } from './routes/business-document-activity.ts';
import { businessDocumentBindingRoutes } from './routes/business-document-bindings.ts';
import { businessDocumentConnectorRoutes } from './routes/business-document-connector.ts';
import { businessDocumentCreateRoutes } from './routes/business-document-create.ts';
import {
  businessDocumentActivityLogReadRoutes,
  businessDocumentConnectorReadRoutes,
  businessDocumentDetailReadRoutes,
  businessDocumentListReadRoutes,
  businessDocumentReferenceReadRoutes,
} from './routes/business-document-reads.ts';
import { businessDocumentReviewRoutes } from './routes/business-document-review.ts';
import { businessDocumentSendRoutes } from './routes/business-document-send.ts';
import { businessDocumentTranslationRoutes } from './routes/business-document-translation.ts';
import { businessDocumentVersionRoutes } from './routes/business-document-version.ts';
import { commercialDefinitionRoutes } from './routes/commercial-definitions.ts';
import { commercialEvaluationRoutes } from './routes/commercial-evaluations.ts';
import { commercialNestedReadRoutes } from './routes/commercial-nested-reads.ts';
import { commercialViewRoutes } from './routes/commercial-views.ts';
import { costMatrixBaseRoutes } from './routes/cost-matrix-base.ts';
import { costMatrixCalculationRoutes } from './routes/cost-matrix-calculations.ts';
import { costMatrixFactorRoutes } from './routes/cost-matrix-factors.ts';
import { ctrRoutes } from './routes/ctr.ts';
import { customer360Routes } from './routes/customer-360.ts';
import { customerActivityRoutes } from './routes/customer-activities.ts';
import { customerCollectionRoutes, customerDetailRoutes } from './routes/customer-base.ts';
import { customerContactRoutes } from './routes/customer-contacts.ts';
import { customerLifecycleRoutes } from './routes/customer-lifecycle.ts';
import { customerOwnershipRoutes } from './routes/customer-ownership.ts';
import { collectionsAttempts } from './routes/dispatch/collections.ts';
import { commissionAttempts } from './routes/dispatch/commission.ts';
import { complaintsAttempts } from './routes/dispatch/complaints.ts';
import { costsAttempts } from './routes/dispatch/costs.ts';
import { dashboardAttempts } from './routes/dispatch/dashboard.ts';
import { manufacturingAttempts } from './routes/dispatch/manufacturing.ts';
import { mrpAttempts } from './routes/dispatch/mrp.ts';
import { orderAttempts } from './routes/dispatch/order.ts';
import { procurementAttempts } from './routes/dispatch/procurement.ts';
import { productionAttempts } from './routes/dispatch/production.ts';
import { qualityAttempts } from './routes/dispatch/quality.ts';
import { riskAttempts } from './routes/dispatch/risk.ts';
import { dispatchFoundationRoutes, foundationRoutes } from './routes/foundation.ts';
import { identityAccessRoutes } from './routes/identity-access.ts';
import { identityProvisionRoutes } from './routes/identity-provision.ts';
import { leadCreateRoutes, leadListRoutes, leadPoolRoutes } from './routes/lead-base.ts';
import { leadClaimRoutes } from './routes/lead-claim.ts';
import { leadCommandRoutes } from './routes/lead-commands.ts';
import {
  masterCategoryCreateRoutes,
  masterCategoryDeleteRoutes,
  masterCategoryReadRoutes,
  masterCategoryUpdateRoutes,
} from './routes/master-data-categories.ts';
import {
  masterEntryCreateRoutes,
  masterEntryDeleteRoutes,
  masterEntryDetailRoutes,
  masterEntryListRoutes,
  masterEntryUpdateRoutes,
} from './routes/master-data-entries.ts';
import { numberAllocationRoutes } from './routes/number-allocation.ts';
import {
  numberDefinitionCreateRoutes,
  numberDefinitionListRoutes,
  numberDefinitionPublishRoutes,
  numberDefinitionVersionRoutes,
} from './routes/number-definitions.ts';
import { dispatchOpportunityRoutes } from './routes/opportunities.ts';
import { qtcArPostRoutes } from './routes/qtc-ar-post.ts';
import { qtcBankPaymentIntakeRoutes } from './routes/qtc-bank-payment-intake.ts';
import { qtcBaseReadRoutes } from './routes/qtc-base-reads.ts';
import { qtcContractCreateRoutes } from './routes/qtc-contract-create.ts';
import { qtcContractSignRoutes } from './routes/qtc-contract-sign.ts';
import { qtcCreditApprovalRoutes } from './routes/qtc-credit-approval.ts';
import { qtcCreditEvaluationRoutes, qtcCreditLimitRoutes } from './routes/qtc-credit-writes.ts';
import { qtcOperationalReadRoutes } from './routes/qtc-operational-reads.ts';
import { qtcReconciliationRunRoutes } from './routes/qtc-reconciliation-run.ts';
import { qtcSalesOrderCreateRoutes } from './routes/qtc-sales-order-create.ts';
import { quoteCommandRoutes } from './routes/quote-commands.ts';
import { quoteWriteRoutes } from './routes/quote-writes.ts';
import {
  ruleDefinitionCreateRoutes,
  ruleDefinitionListRoutes,
  ruleDefinitionPublishRoutes,
  ruleDefinitionVersionRoutes,
} from './routes/rule-definitions.ts';
import { ruleEvaluationRoutes } from './routes/rule-evaluation.ts';
import { technicalSolutionRoutes } from './routes/technical-solutions.ts';
import { dispatchRoutes } from './routes/types.ts';
import { websiteLeadIngestRoutes } from './routes/website-lead-ingest.ts';
import {
  workflowDefinitionCreateRoutes,
  workflowDefinitionListRoutes,
  workflowDefinitionPublishRoutes,
  workflowDefinitionVersionRoutes,
} from './routes/workflow-definitions.ts';
import {
  workflowRuntimeDecisionRoutes,
  workflowRuntimeStartRoutes,
  workflowRuntimeTaskListRoutes,
} from './routes/workflow-runtime.ts';
import type { AuthenticationService } from './security.ts';
import type { PostgresShipmentRepository } from './shipment-repositories.ts';
import type { PostgresWebsiteLeadIngestor } from './website-lead-ingest.ts';
export type { ApiApplication, ApiRequest, ApiResponse } from './api-types.ts';

export type ApiDependencies = Readonly<{
  loginRateLimiter?: LoginRateLimiter;
  auth: AuthenticationService;
  organizations: OrganizationRepository;
  employees: EmployeeRepository;
  authorization?: AuthorizationRepository;
  audit?: PostgresAuditRepository;
  masterData?: PostgresMasterDataRepository;
  numbers?: PostgresNumberRepository;
  rules?: PostgresRuleRepository;
  workflows?: PostgresWorkflowRepository;
  notifications?: PostgresNotificationRepository;
  attachments?: PostgresAttachmentRepository;
  events?: PostgresEventRepository;
  businessObjects?: PostgresBusinessObjectRepository;
  crm?: PostgresCrmRepository;
  commercial?: PostgresCommercialRepository;
  quoteToCash?: PostgresQuoteToCashRepository;
  commissions?: PostgresCommissionRepository;
  order360?: PostgresOrder360Repository;
  risks?: PostgresRiskRepository;
  dashboard?: PostgresDashboardRepository;
  manufacturing?: PostgresManufacturingRepository;
  procurement?: PostgresProcurementRepository;
  mrp?: PostgresMrpRepository;
  production?: PostgresProductionRepository;
  productionCosts?: PostgresProductionCostRepository;
  quality?: PostgresQualityRepository;
  shipments?: PostgresShipmentRepository;
  collections?: PostgresCollectionRepository;
  complaints?: PostgresComplaintRepository;
  businessDocuments?: PostgresBusinessDocumentRepository;
  contractDocuments?: PostgresContractDocumentRepository;
  websiteLeads?: PostgresWebsiteLeadIngestor;
  readiness?: () => Promise<boolean>;
  release?: Readonly<{ sha: string; environment: string; builtAt?: string }>;
  telemetry?: Telemetry;
  logger?: OperationalLogger;
}>;

export function buildApp(
  dependencies?: ApiDependencies,
  security: Readonly<{ enforceCsp?: boolean; browserSession?: BrowserSessionConfig }> = {},
): ApiApplication {
  const telemetry = dependencies?.telemetry ?? NOOP_TELEMETRY;
  const loginRateLimiter = dependencies?.loginRateLimiter ?? new LoginRateLimiter();
  const browserSession = security.browserSession ?? DEFAULT_BROWSER_SESSION;
  const application: Pick<ApiApplication, 'dispatch'> = {
    async dispatch(request) {
      const correlationId = correlation(request.headers?.['x-correlation-id']);
      try {
        if (request.method === 'GET' && request.pathname === '/health')
          return { statusCode: 200, body: { status: 'ok' } };
        if (request.method === 'GET' && request.pathname === '/version')
          return {
            statusCode: 200,
            body: dependencies?.release ?? { sha: 'development', environment: 'development' },
          };
        if (request.method === 'GET' && request.pathname === '/ready') {
          const ready = dependencies?.readiness ? await dependencies.readiness() : false;
          return ready
            ? { statusCode: 200, body: { status: 'ready' } }
            : error(503, 'internal_error', 'Dependency unavailable', correlationId);
        }
        if (!dependencies)
          return error(
            503,
            'internal_error',
            'Application dependencies are unavailable',
            correlationId,
          );
        const authRouteContext = {
          auth: dependencies.auth,
          loginRateLimiter,
          browserSession,
          correlationId,
          parsers: { objectBody, string, allow },
        };
        const loginResponse = await dispatchRoutes(loginRoutes(authRouteContext), request);
        if (loginResponse) return loginResponse;
        const carrier = parseSessionCarrier(request, browserSession);
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/integrations/website/leads'
        ) {
          if (carrier.kind !== 'none' || carrier.csrf !== undefined)
            throw new SessionRequestError(401, 'Ambiguous website authentication');
          requireMachineContext(request);
          if (!dependencies.websiteLeads)
            return error(
              503,
              'internal_error',
              'Website lead integration unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
            websiteLeadIngestRoutes({
              repository: () =>
                dependencies.websiteLeads as Pick<
                  NonNullable<ApiDependencies['websiteLeads']>,
                  'ingest'
                >,
              correlationId,
            }),
            request,
          );
          if (response) return response;
        }
        if (carrier.kind === 'bearer') requireMachineContext(request);
        const token = carrier.token;
        const context = token ? await dependencies.auth.authenticate(token) : null;
        if (context === null)
          return error(
            401,
            'authentication_required',
            'A valid session is required',
            correlationId,
          );
        if (token === null)
          return error(
            401,
            'authentication_required',
            'A valid session is required',
            correlationId,
          );
        if (carrier.kind === 'cookie')
          authorizeCookieRequest(request, carrier, dependencies.auth, browserSession);
        const foundationResponse = await dispatchFoundationRoutes(
          foundationRoutes({
            dependencies,
            authorization: context,
            correlationId,
            authorize: (capability) => authorizeQuery(context, capability),
            unavailable: (message) => error(503, 'internal_error', message, correlationId),
            error: (statusCode, code, message) => error(statusCode, code, message, correlationId),
            parsers: {
              objectBody,
              string,
              uuid,
              version,
              expectedVersion,
              integer,
              strings,
              notificationChannel,
              attachmentBytes,
              allow,
            },
          }),
          request,
        );
        if (foundationResponse) return foundationResponse;
        const securedAuthContext = {
          ...authRouteContext,
          token,
          carrier,
          authorization: context,
          employees: dependencies.employees,
        };
        const sessionResponse = await dispatchRoutes(sessionRoutes(securedAuthContext), request);
        if (sessionResponse) return sessionResponse;
        for (const pending of manufacturingAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of procurementAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of mrpAttempts({ request, dependencies, context, correlationId })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of productionAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of costsAttempts({ request, dependencies, context, correlationId })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        if (dependencies.shipments) {
          if (request.method === 'GET' && request.pathname === '/api/v1/shipment-releases') {
            const grant = authorizeQuery(context, 'shipment:read');
            const items = await dependencies.shipments.list({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get('shipment:read')?.fields ?? null),
                ),
              },
            };
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
            const result = await dependencies.shipments.request(
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
            );
            return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
          }
          const releaseTransition =
            /^\/api\/v1\/shipment-releases\/([0-9a-f-]+)\/(approve-exception|reject-exception|release)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && releaseTransition) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const action = releaseTransition[2] ?? '';
            const capability =
              action === 'release' ? 'shipment:release' : 'shipment:approve-exception';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const state =
              action === 'release'
                ? 'RELEASED'
                : action === 'approve-exception'
                  ? 'APPROVED'
                  : 'REJECTED';
            const result = await dependencies.shipments.transition(
              uuid(releaseTransition[1], 'releaseRequestId'),
              state,
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
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
            const result = await dependencies.shipments.dispatch(
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
            );
            return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
          }
          const trackCommand = /^\/api\/v1\/shipments\/([0-9a-f-]+)\/(in-transit|deliver)$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && trackCommand) {
            const body = objectBody(request.body);
            allow(body, ['occurredAt', 'location', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'shipment:track', Object.keys(body));
            const result = await dependencies.shipments.track(
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
            );
            return { statusCode: 201, body: mutationDto(result, context, 'shipment:read') };
          }
        }
        for (const pending of complaintsAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of collectionsAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of qualityAttempts({ request, dependencies, context, correlationId })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of dashboardAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of riskAttempts({ request, dependencies, context, correlationId })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of orderAttempts({ request, dependencies, context, correlationId })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        const credentialResponse = await dispatchRoutes(
          credentialRoutes(securedAuthContext),
          request,
        );
        if (credentialResponse) return credentialResponse;
        const identityProvisionResponse = await dispatchRoutes(
          identityProvisionRoutes({
            auth: dependencies.auth,
            authorization: context,
            correlationId,
            authorize: () => {
              authorizeQuery(context, 'authorization:manage');
            },
            parsers: { objectBody, allow, uuid, string },
          }),
          request,
        );
        if (identityProvisionResponse) return identityProvisionResponse;
        if (dependencies.contractDocuments) {
          if (request.method === 'GET' && request.pathname === '/api/v1/contract-documents') {
            const grant = authorizeQuery(context, 'contract-document:read');
            const query = request.query ?? {};
            const subjectType = query.subjectType;
            if (subjectType && !['contract-revision', 'purchase-order'].includes(subjectType))
              throw new DomainError('invalid_request', 'subjectType is unsupported');
            const subjectId = query.subjectId ? uuid(query.subjectId, 'subjectId') : undefined;
            const items = await dependencies.contractDocuments.list(
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              subjectType,
              subjectId,
            );
            return { statusCode: 200, body: { items } };
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
            const result = await dependencies.contractDocuments.create(
              {
                businessType: businessType as 'SALES' | 'PURCHASE',
                subjectType: subjectType as 'contract-revision' | 'purchase-order',
                subjectId: uuid(body.subjectId, 'subjectId'),
                attachmentId: uuid(body.attachmentId, 'attachmentId'),
                title: string(body.title, 'title'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'contract-document:read'),
            };
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
            const result = await dependencies.contractDocuments.ocr(
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
            );
            return {
              statusCode: 200,
              body: mutationDto(result, context, 'contract-document:read'),
            };
          }
          const envelope =
            /^\/api\/v1\/contract-documents\/([0-9a-f-]+)\/signature-envelopes$/u.exec(
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
            const result = await dependencies.contractDocuments.createEnvelope(
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
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'contract-document:read'),
            };
          }
          const complete = /^\/api\/v1\/signature-envelopes\/([0-9a-f-]+)\/complete$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && complete) {
            const body = objectBody(request.body);
            allow(body, ['providerEventId', 'signedAt', 'signedAttachmentId', 'evidence']);
            const grant = authorizeQuery(context, 'contract-signature:confirm', Object.keys(body));
            const result = await dependencies.contractDocuments.completeEnvelope(
              uuid(complete[1], 'envelopeId'),
              {
                providerEventId: string(body.providerEventId, 'providerEventId'),
                signedAt: timestamp(body.signedAt, 'signedAt'),
                signedAttachmentId: uuid(body.signedAttachmentId, 'signedAttachmentId'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 200,
              body: mutationDto(result, context, 'contract-document:read'),
            };
          }
        }
        const qtcReads = new Map<
          string,
          readonly [
            `${string}:${string}`,
            'limits' | 'credit' | 'contracts' | 'orders' | 'ar' | 'payments' | 'reconciliation',
          ]
        >([
          ['/api/v1/credit-limits', ['credit:read', 'limits']],
          ['/api/v1/credit-decisions', ['credit:read', 'credit']],
          ['/api/v1/contracts', ['contract:read', 'contracts']],
          ['/api/v1/sales-orders', ['sales-order:read', 'orders']],
          ['/api/v1/ar-open-items', ['ar:read', 'ar']],
          ['/api/v1/bank-payments', ['bank-payment:read', 'payments']],
          ['/api/v1/reconciliation-runs', ['reconciliation:read', 'reconciliation']],
        ]);
        const qtcRead = qtcReads.get(request.pathname);
        if (request.method === 'GET' && qtcRead && dependencies.quoteToCash) {
          if (qtcRead[1] === 'ar' || qtcRead[1] === 'payments') {
            const response = await dispatchRoutes(
              qtcOperationalReadRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'listOperationalPage'
                  >,
                authorization: context,
                authorizeQuery,
                permittedDto,
                parsers: { decimal, integer, uuid, string, timestamp },
              }),
              request,
            );
            if (response !== null) return response;
          }
          const response = await dispatchRoutes(
            qtcBaseReadRoutes({
              repository: () =>
                dependencies.quoteToCash as Pick<
                  NonNullable<ApiDependencies['quoteToCash']>,
                  'list'
                >,
              authorization: context,
              authorizeQuery,
              permittedDto,
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.method === 'POST' && dependencies.quoteToCash) {
          const body = objectBody(request.body),
            ctx = (capability: PermissionKey) => {
              const grant = authorizeQuery(context, capability, Object.keys(body));
              return { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors };
            };
          if (request.pathname === '/api/v1/credit-limits') {
            const response = await dispatchRoutes(
              qtcCreditLimitRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'setCreditLimit'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, uuid, currency, decimal, timestamp, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/credit-decisions') {
            const response = await dispatchRoutes(
              qtcCreditEvaluationRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'evaluateCredit'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, uuid, currency, decimal, timestamp, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          const creditApproval = /^\/api\/v1\/credit-decisions\/([0-9a-f-]+)\/approve$/u.exec(
            request.pathname,
          );
          if (creditApproval) {
            const response = await dispatchRoutes(
              qtcCreditApprovalRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'approveCredit'
                  >,
                rawId: creditApproval[1],
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, string, uuid, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/contracts') {
            const response = await dispatchRoutes(
              qtcContractCreateRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'createContract'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, uuid, string, jsonObject, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          const signing = /^\/api\/v1\/contracts\/([0-9a-f-]+)\/sign$/u.exec(request.pathname);
          if (signing) {
            const response = await dispatchRoutes(
              qtcContractSignRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'signContract'
                  >,
                rawId: signing[1],
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, uuid, string, jsonObject, timestamp, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/sales-orders') {
            const response = await dispatchRoutes(
              qtcSalesOrderCreateRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'createOrder'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: {
                  allow,
                  array,
                  objectBody,
                  string,
                  decimal,
                  addDecimal,
                  normalizeDecimal,
                  uuid,
                  currency,
                  idempotency,
                },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/ar-open-items') {
            const response = await dispatchRoutes(
              qtcArPostRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'postAr'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, string, uuid, currency, decimal, timestamp, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/bank-payments') {
            const response = await dispatchRoutes(
              qtcBankPaymentIntakeRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'intakePayment'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: {
                  allow,
                  uuid,
                  currency,
                  decimal,
                  timestamp,
                  string,
                  jsonObject,
                  idempotency,
                },
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.pathname === '/api/v1/reconciliation-runs') {
            const response = await dispatchRoutes(
              qtcReconciliationRunRoutes({
                repository: () =>
                  dependencies.quoteToCash as Pick<
                    NonNullable<ApiDependencies['quoteToCash']>,
                    'reconcile'
                  >,
                body,
                authorization: context,
                authorizeScope: ctx,
                mutationDto,
                correlationId,
                parsers: { allow, uuid, idempotency },
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        for (const pending of commissionAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        const opportunityResponse = await dispatchOpportunityRoutes(
          {
            repository: dependencies.commercial,
            authorization: context,
            correlationId,
            authorize: (capability, fields) => authorizeQuery(context, capability, fields),
            unavailable: () =>
              error(503, 'internal_error', 'Commercial dependency unavailable', correlationId),
            notFound: () => error(404, 'not_found', 'Opportunity not found', correlationId),
            permittedDto: (value) =>
              permittedDto(value, context.permissions.get('opportunity:read')?.fields ?? null),
            mutationDto: (value) => mutationDto(value, context, 'opportunity:read'),
            parsers: {
              objectBody,
              allow,
              string,
              uuid,
              decimal,
              currency,
              integer,
              expectedVersion,
            },
          },
          request,
        );
        if (opportunityResponse) return opportunityResponse;
        if (dependencies.commercial) {
          const commercialNestedResponse = await dispatchRoutes(
            commercialNestedReadRoutes({
              repository: dependencies.commercial,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              permittedDto: (value, capability) =>
                permittedDto(value, context.permissions.get(capability)?.fields ?? null),
              uuid,
            }),
            request,
          );
          if (commercialNestedResponse) return commercialNestedResponse;
        }
        if (dependencies.commercial) {
          const commercialViewResponse = await dispatchRoutes(
            commercialViewRoutes({
              repository: dependencies.commercial,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              permittedDto: (value, capability) =>
                permittedDto(value, context.permissions.get(capability)?.fields ?? null),
            }),
            request,
          );
          if (commercialViewResponse) return commercialViewResponse;
        }
        if (dependencies.commercial) {
          const ctrResponse = await dispatchRoutes(
            ctrRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'ctr:read'),
              parsers: { objectBody, allow, uuid, string, jsonObject, version, idempotency },
            }),
            request,
          );
          if (ctrResponse) return ctrResponse;
        }
        if (dependencies.commercial) {
          const solutionResponse = await dispatchRoutes(
            technicalSolutionRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'technical-solution:read'),
              parsers: { objectBody, allow, uuid, string, jsonObject, strings },
            }),
            request,
          );
          if (solutionResponse) return solutionResponse;
        }
        if (dependencies.commercial) {
          const matrixResponse = await dispatchRoutes(
            costMatrixBaseRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              parsers: { objectBody, allow, uuid, string, jsonObject, integer, currency, decimal },
            }),
            request,
          );
          if (matrixResponse) return matrixResponse;
        }
        if (dependencies.commercial) {
          const factorResponse = await dispatchRoutes(
            costMatrixFactorRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              parsers: {
                objectBody,
                allow,
                uuid,
                string,
                decimal,
                calendarDate,
                integer,
                costFactorSourceType,
                requireCostFactorItemSource,
              },
            }),
            request,
          );
          if (factorResponse) return factorResponse;
        }
        if (dependencies.commercial) {
          const calculationResponse = await dispatchRoutes(
            costMatrixCalculationRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'cost:read'),
              parsers: { objectBody, allow, uuid, string, idempotency },
            }),
            request,
          );
          if (calculationResponse) return calculationResponse;
        }
        if (dependencies.commercial) {
          const definitionResponse = await dispatchRoutes(
            commercialDefinitionRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              parsers: { objectBody, allow, uuid, string, currency, array },
            }),
            request,
          );
          if (definitionResponse) return definitionResponse;
        }
        if (dependencies.commercial) {
          const evaluationResponse = await dispatchRoutes(
            commercialEvaluationRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value, capability) => mutationDto(value, context, capability),
              parsers: {
                objectBody,
                allow,
                uuid,
                string,
                decimal,
                currency,
                array,
                jsonObject,
                idempotency,
              },
            }),
            request,
          );
          if (evaluationResponse) return evaluationResponse;
        }
        if (dependencies.commercial) {
          const quoteResponse = await dispatchRoutes(
            quoteWriteRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'quote:read'),
              parsers: {
                objectBody,
                allow,
                uuid,
                string,
                decimal,
                currency,
                integer,
                timestamp,
                array,
                jsonObject,
              },
            }),
            request,
          );
          if (quoteResponse) return quoteResponse;
        }
        if (dependencies.commercial) {
          const quoteCommandResponse = await dispatchRoutes(
            quoteCommandRoutes({
              repository: dependencies.commercial,
              authorization: context,
              correlationId,
              authorize: (capability) => authorizeQuery(context, capability),
              mutationDto: (value) => mutationDto(value, context, 'quote:read'),
              parsers: { objectBody, allow, uuid, string, idempotency },
            }),
            request,
          );
          if (quoteCommandResponse) return quoteCommandResponse;
        }
        const customerMatch =
          /^\/api\/v1\/customers(?:\/([0-9a-f-]+))?(?:\/(contacts|ownership|activities|360))?$/u.exec(
            request.pathname,
          );
        if (customerMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const customerBaseContext = {
            repository: dependencies.crm,
            authorization: context,
            correlationId,
            authorize: (capability: PermissionKey, fields?: readonly string[]) =>
              authorizeQuery(context, capability, fields),
            permittedDto,
            mutationDto: (value: Record<string, unknown>) =>
              mutationDto(value, context, 'customer:read'),
            notFound: () => error(404, 'not_found', 'Customer not found', correlationId),
            parsers: { objectBody, allow, string, strings, uuid },
          } as const;
          const customerCollectionResponse = await dispatchRoutes(
            customerCollectionRoutes(customerBaseContext),
            request,
          );
          if (customerCollectionResponse) return customerCollectionResponse;
          const customerOwnershipResponse = await dispatchRoutes(
            customerOwnershipRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability) => authorizeQuery(context, capability),
              mutationDto: (value) => mutationDto(value, context, 'customer:read'),
              parsers: { objectBody, allow, uuid, expectedVersion, string },
            }),
            request,
          );
          if (customerOwnershipResponse) return customerOwnershipResponse;
          const customerActivityResponse = await dispatchRoutes(
            customerActivityRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'customer-activity:read'),
              parsers: { objectBody, allow, uuid, string, timestamp },
            }),
            request,
          );
          if (customerActivityResponse) return customerActivityResponse;
          const customerLifecycleResponse = await dispatchRoutes(
            customerLifecycleRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'customer:read'),
              parsers: { objectBody, allow, uuid, string, expectedVersion },
            }),
            request,
          );
          if (customerLifecycleResponse) return customerLifecycleResponse;
          const customer360Response = await dispatchRoutes(
            customer360Routes({
              repository: dependencies.crm,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              uuid,
              customerNotFound: () => error(404, 'not_found', 'Customer not found', correlationId),
              permittedDto,
            }),
            request,
          );
          if (customer360Response) return customer360Response;
          const customerContactResponse = await dispatchRoutes(
            customerContactRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'customer-360:read'),
              parsers: { objectBody, allow, uuid, string },
            }),
            request,
          );
          if (customerContactResponse) return customerContactResponse;
          const customerDetailResponse = await dispatchRoutes(
            customerDetailRoutes(customerBaseContext),
            request,
          );
          if (customerDetailResponse) return customerDetailResponse;
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/leads') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const leadListResponse = await dispatchRoutes(
            leadListRoutes({
              repository: dependencies.crm,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              permittedDto,
            }),
            request,
          );
          if (leadListResponse) return leadListResponse;
        }
        if (request.method === 'POST' && request.pathname === '/api/v1/leads') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const leadCreateResponse = await dispatchRoutes(
            leadCreateRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'lead:read'),
              parsers: { objectBody, allow, string, uuid },
            }),
            request,
          );
          if (leadCreateResponse) return leadCreateResponse;
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/leads/pool') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const leadPoolResponse = await dispatchRoutes(
            leadPoolRoutes({
              repository: dependencies.crm,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              permittedDto,
            }),
            request,
          );
          if (leadPoolResponse) return leadPoolResponse;
        }
        const claimMatch = /^\/api\/v1\/leads\/([0-9a-f-]+)\/claim$/u.exec(request.pathname);
        if (request.method === 'POST' && claimMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const leadClaimResponse = await dispatchRoutes(
            leadClaimRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability) => authorizeQuery(context, capability),
              mutationDto: (value) => mutationDto(value, context, 'lead:read'),
              parsers: { objectBody, allow, uuid, expectedVersion },
            }),
            request,
          );
          if (leadClaimResponse) return leadClaimResponse;
        }
        const leadActionMatch =
          /^\/api\/v1\/leads\/([0-9a-f-]+)\/(transition|assign|reassign|release)$/u.exec(
            request.pathname,
          );
        if (request.method === 'POST' && leadActionMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const leadCommandResponse = await dispatchRoutes(
            leadCommandRoutes({
              repository: dependencies.crm,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'lead:read'),
              parsers: { uuid, objectBody, allow, expectedVersion, string },
            }),
            request,
          );
          if (leadCommandResponse) return leadCommandResponse;
        }
        const organizationMatch = /^\/api\/v1\/organizations(?:\/([0-9a-f-]+))?$/u.exec(
          request.pathname,
        );
        if (organizationMatch) {
          const id = organizationMatch[1];
          if (request.method === 'GET' && !id) {
            authorizeQuery(context, 'organization:read');
            return {
              statusCode: 200,
              body: await dependencies.organizations.list(context.actor.companyId),
            };
          }
          if (request.method === 'GET' && id) {
            authorizeQuery(context, 'organization:read');
            const found = await dependencies.organizations.findById(
              uuid(id, 'organizationId'),
              context.actor.companyId,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Organization not found', correlationId);
          }
          if (request.method === 'POST' && !id) {
            authorizeQuery(context, 'organization:create');
            const b = objectBody(request.body);
            allow(b, ['parentId', 'code', 'name', 'locale', 'currency']);
            const created = await dependencies.organizations.create(
              {
                ownerOrganizationId: context.actor.companyId,
                parentId:
                  b.parentId === null || b.parentId === undefined
                    ? null
                    : uuid(b.parentId, 'parentId'),
                code: string(b.code, 'code'),
                name: string(b.name, 'name'),
                locale: typeof b.locale === 'string' ? b.locale : 'zh-CN',
                currency: typeof b.currency === 'string' ? b.currency : 'CNY',
                active: true,
              },
              context.actor,
              correlationId,
            );
            return { statusCode: 201, body: created };
          }
          if (request.method === 'PATCH' && id) {
            const b = objectBody(request.body);
            allow(b, ['name', 'parentId', 'active', 'locale', 'currency', 'version']);
            const fields = Object.keys(b).filter((k) => k !== 'version');
            authorizeQuery(context, 'organization:update', fields);
            const patch = {
              ...(typeof b.name === 'string' ? { name: string(b.name, 'name') } : {}),
              ...(Object.hasOwn(b, 'parentId')
                ? { parentId: b.parentId === null ? null : uuid(b.parentId, 'parentId') }
                : {}),
              ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
              ...(typeof b.locale === 'string' ? { locale: string(b.locale, 'locale') } : {}),
              ...(typeof b.currency === 'string'
                ? { currency: string(b.currency, 'currency') }
                : {}),
            };
            const updated = await dependencies.organizations.update(
              uuid(id, 'organizationId'),
              context.actor.companyId,
              patch,
              version(b.version),
              context.actor,
              correlationId,
            );
            return { statusCode: 200, body: updated };
          }
        }
        const employeeMatch = /^\/api\/v1\/employees(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
        if (employeeMatch) {
          const id = employeeMatch[1];
          if (request.method === 'GET' && !id) {
            const grant = authorizeQuery(context, 'employee:read');
            return {
              statusCode: 200,
              body: await dependencies.employees.list(
                context.actor.companyId,
                grant.scopes,
                context.actor.employeeId,
                grant.anchors,
              ),
            };
          }
          if (request.method === 'GET' && id) {
            const grant = authorizeQuery(context, 'employee:read');
            const found = await dependencies.employees.findById(
              uuid(id, 'employeeId'),
              context.actor.companyId,
              grant.scopes,
              context.actor.employeeId,
              grant.anchors,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Employee not found', correlationId);
          }
          if (request.method === 'POST' && !id) {
            authorizeQuery(context, 'employee:create');
            const b = objectBody(request.body);
            allow(b, ['organizationId', 'employeeNumber', 'displayName', 'email']);
            const created = await dependencies.employees.create(
              {
                companyId: context.actor.companyId,
                organizationId: uuid(b.organizationId, 'organizationId'),
                employeeNumber: string(b.employeeNumber, 'employeeNumber'),
                displayName: string(b.displayName, 'displayName'),
                email: string(b.email, 'email'),
                active: true,
              },
              context.actor,
              correlationId,
            );
            return { statusCode: 201, body: created };
          }
          if (request.method === 'PATCH' && id) {
            const b = objectBody(request.body);
            allow(b, ['displayName', 'email', 'organizationId', 'active', 'version']);
            const fields = Object.keys(b).filter((k) => k !== 'version');
            const grant = authorizeQuery(context, 'employee:update', fields);
            const patch = {
              ...(typeof b.displayName === 'string'
                ? { displayName: string(b.displayName, 'displayName') }
                : {}),
              ...(typeof b.email === 'string' ? { email: string(b.email, 'email') } : {}),
              ...(typeof b.organizationId === 'string'
                ? { organizationId: uuid(b.organizationId, 'organizationId') }
                : {}),
              ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
            };
            const updated = await dependencies.employees.update(
              uuid(id, 'employeeId'),
              context.actor.companyId,
              patch,
              version(b.version),
              context.actor,
              grant.scopes,
              grant.anchors,
              correlationId,
            );
            return { statusCode: 200, body: updated };
          }
        }
        const authorizationResponse = await dispatchAuthorizationRoutes(
          {
            repository: dependencies.authorization,
            authorization: context,
            correlationId,
            authorizeOneOf: (preferred, fallback) => {
              authorizeOneOf(context, preferred, fallback);
            },
            unavailable: () =>
              error(
                503,
                'internal_error',
                'Authorization repository is unavailable',
                correlationId,
              ),
            parsers: { objectBody, allow, uuid, string, strings },
          },
          request,
        );
        if (authorizationResponse) return authorizationResponse;
        const identityAccessResponse = await dispatchRoutes(
          identityAccessRoutes({
            repository: dependencies.authorization,
            authorization: context,
            correlationId,
            authorizeOneOf: (preferred, fallback, fields) => {
              authorizeOneOf(context, preferred, fallback, fields);
            },
            unavailable: (message) => error(503, 'internal_error', message, correlationId),
            parsers: { objectBody, allow, uuid },
          }),
          request,
        );
        if (identityAccessResponse) return identityAccessResponse;
        const auditMatch = /^\/api\/v1\/audit-events(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
        if (auditMatch && request.method === 'GET') {
          const auditGrant = authorizeQuery(context, 'audit:read');
          if (!dependencies.audit)
            return error(503, 'internal_error', 'Audit repository unavailable', correlationId);
          const auditResponse = await dispatchRoutes(
            auditReadRoutes({
              repository: dependencies.audit,
              actor: context.actor,
              grant: auditGrant,
              uuid,
              notFound: () => error(404, 'not_found', 'Audit event not found', correlationId),
            }),
            request,
          );
          if (auditResponse) return auditResponse;
        }
        if (request.pathname === '/api/v1/master-data/categories' && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const categoryResponse = await dispatchRoutes(
            masterCategoryReadRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              parseEffectiveTimestamp,
            }),
            request,
          );
          if (categoryResponse) return categoryResponse;
        }
        if (request.pathname === '/api/v1/master-data/categories' && request.method === 'POST') {
          authorizeQuery(context, 'master-data:create');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const categoryResponse = await dispatchRoutes(
            masterCategoryCreateRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, effectiveRange, string, stableCode: assertStableCode },
            }),
            request,
          );
          if (categoryResponse) return categoryResponse;
        }
        const category = /^\/api\/v1\/master-data\/categories\/([0-9a-f-]+)$/u.exec(
          request.pathname,
        );
        if (category && request.method === 'PATCH') {
          authorizeQuery(context, 'master-data:update');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const categoryResponse = await dispatchRoutes(
            masterCategoryUpdateRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, effectiveRange, uuid, string, version },
            }),
            request,
          );
          if (categoryResponse) return categoryResponse;
        }
        if (category && request.method === 'DELETE') {
          authorizeQuery(context, 'master-data:delete');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const categoryResponse = await dispatchRoutes(
            masterCategoryDeleteRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              uuid,
              version,
            }),
            request,
          );
          if (categoryResponse) return categoryResponse;
        }
        if (request.pathname === '/api/v1/master-data/entries' && request.method === 'POST') {
          authorizeQuery(context, 'master-data:create');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const entryResponse = await dispatchRoutes(
            masterEntryCreateRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              parsers: {
                objectBody,
                allow,
                effectiveRange,
                uuid,
                string,
                stableCode: assertStableCode,
              },
            }),
            request,
          );
          if (entryResponse) return entryResponse;
        }
        if (request.pathname === '/api/v1/number-definitions' && request.method === 'GET') {
          authorizeQuery(context, 'number:read');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const response = await dispatchRoutes(
            numberDefinitionListRoutes({ repository: dependencies.numbers, actor: context.actor }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/number-definitions' && request.method === 'POST') {
          authorizeQuery(context, 'number:create');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const response = await dispatchRoutes(
            numberDefinitionCreateRoutes({
              repository: dependencies.numbers,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, string, integer, stableCode: assertStableCode },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const publishNumber = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (publishNumber && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const response = await dispatchRoutes(
            numberDefinitionPublishRoutes({
              repository: dependencies.numbers,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, version },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const allocate = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/allocate$/u.exec(
          request.pathname,
        );
        if (allocate && request.method === 'POST') {
          authorizeQuery(context, 'number:allocate');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const response = await dispatchRoutes(
            numberAllocationRoutes({
              repository: dependencies.numbers,
              actor: context.actor,
              correlationId,
              uuid,
              keyRequired: () => {
                throw new DomainError('invalid_request', 'Idempotency-Key header is required');
              },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/rules' && request.method === 'GET') {
          authorizeQuery(context, 'rule:read');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const response = await dispatchRoutes(
            ruleDefinitionListRoutes({ repository: dependencies.rules, actor: context.actor }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/rules' && request.method === 'POST') {
          authorizeQuery(context, 'rule:create');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const response = await dispatchRoutes(
            ruleDefinitionCreateRoutes({
              repository: dependencies.rules,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, string, strings, stableCode: assertStableCode },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const publishRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
        if (publishRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const response = await dispatchRoutes(
            ruleDefinitionPublishRoutes({
              repository: dependencies.rules,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, version },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const evaluateRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/evaluate$/u.exec(request.pathname);
        if (evaluateRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:evaluate');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const response = await dispatchRoutes(
            ruleEvaluationRoutes({
              repository: dependencies.rules,
              actor: context.actor,
              correlationId,
              objectBody,
              allow,
              uuid,
              keyRequired: () => {
                throw new DomainError('invalid_request', 'Idempotency-Key header is required');
              },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/master-data/entries' && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const entryResponse = await dispatchRoutes(
            masterEntryListRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              uuid,
              parseEffectiveTimestamp,
            }),
            request,
          );
          if (entryResponse) return entryResponse;
        }
        const entry = /^\/api\/v1\/master-data\/entries\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (entry && request.method === 'GET') {
          authorizeQuery(context, 'master-data:read');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const entryResponse = await dispatchRoutes(
            masterEntryDetailRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              uuid,
              parseEffectiveTimestamp,
              notFound: () => error(404, 'not_found', 'Master-data entry not found', correlationId),
            }),
            request,
          );
          if (entryResponse) return entryResponse;
        }
        if (entry && request.method === 'PATCH') {
          authorizeQuery(context, 'master-data:update');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const entryResponse = await dispatchRoutes(
            masterEntryUpdateRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, effectiveRange, uuid, string, version },
            }),
            request,
          );
          if (entryResponse) return entryResponse;
        }
        if (entry && request.method === 'DELETE') {
          authorizeQuery(context, 'master-data:delete');
          if (!dependencies.masterData)
            return error(
              503,
              'internal_error',
              'Master-data repository unavailable',
              correlationId,
            );
          const entryResponse = await dispatchRoutes(
            masterEntryDeleteRoutes({
              repository: dependencies.masterData,
              actor: context.actor,
              correlationId,
              uuid,
              version,
            }),
            request,
          );
          if (entryResponse) return entryResponse;
        }
        const numberVersion = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (numberVersion && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const response = await dispatchRoutes(
            numberDefinitionVersionRoutes({
              repository: dependencies.numbers,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, string, integer },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const ruleVersion = /^\/api\/v1\/rules\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
        if (ruleVersion && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const response = await dispatchRoutes(
            ruleDefinitionVersionRoutes({
              repository: dependencies.rules,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, strings },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/workflows' && request.method === 'GET') {
          authorizeQuery(context, 'workflow:read');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowDefinitionListRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/workflows' && request.method === 'POST') {
          authorizeQuery(context, 'workflow:create');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowDefinitionCreateRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, string, stableCode: assertStableCode },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const workflowVersion = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (workflowVersion && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowDefinitionVersionRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const workflowPublish = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (workflowPublish && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowDefinitionPublishRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, version },
            }),
            request,
          );
          if (response !== null) return response;
        }
        const workflowStart = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/instances$/u.exec(
          request.pathname,
        );
        if (workflowStart && request.method === 'POST') {
          authorizeQuery(context, 'workflow:start');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowRuntimeStartRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, string },
              missingKey: (): never => {
                throw new DomainError('invalid_request', 'Idempotency-Key header is required');
              },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/workflow-tasks' && request.method === 'GET') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowRuntimeTaskListRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
            }),
            request,
          );
          if (response !== null) return response;
        }
        const decide = /^\/api\/v1\/workflow-tasks\/([0-9a-f-]+)\/decisions$/u.exec(
          request.pathname,
        );
        if (decide && request.method === 'POST') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const response = await dispatchRoutes(
            workflowRuntimeDecisionRoutes({
              repository: dependencies.workflows,
              actor: context.actor,
              correlationId,
              parsers: { objectBody, allow, uuid, string, version },
              missingKey: (): never => {
                throw new DomainError('invalid_request', 'Idempotency-Key header is required');
              },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/document-connectors' && request.method === 'GET') {
          const canConfigure = context.permissions.has('business-document:configure');
          if (!canConfigure)
            authorizeOneOf(context, 'business-document:send', 'business-document:translate');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const connectorConfiguration = /^\/api\/v1\/document-connectors\/([A-Z_]+)$/u.exec(
          request.pathname,
        );
        if (connectorConfiguration && request.method === 'PUT') {
          authorizeQuery(context, 'business-document:configure');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/business-document-activity' && request.method === 'GET') {
          authorizeQuery(context, 'business-document:audit');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/business-documents' && request.method === 'GET') {
          const grant = authorizeQuery(context, 'business-document:read');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        if (
          request.pathname === '/api/v1/business-documents/reference-data' &&
          request.method === 'GET'
        ) {
          const grant = authorizeQuery(context, 'business-document:manage');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        if (request.pathname === '/api/v1/business-documents' && request.method === 'POST') {
          authorizeQuery(context, 'business-document:manage');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocument = /^\/api\/v1\/business-documents\/([0-9a-f-]+)$/u.exec(
          request.pathname,
        );
        if (businessDocument && request.method === 'GET') {
          const grant = authorizeQuery(context, 'business-document:read');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentVersion =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
        if (businessDocumentVersion && request.method === 'POST') {
          const grant = authorizeQuery(context, 'business-document:manage');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentBindings =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/bindings$/u.exec(request.pathname);
        if (businessDocumentBindings && request.method === 'PATCH') {
          const grant = authorizeQuery(context, 'business-document:manage');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentReview =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/(submit|approve|reject)$/u.exec(
            request.pathname,
          );
        if (businessDocumentReview && request.method === 'POST') {
          const operation = businessDocumentReview[2];
          const action =
            operation === 'submit'
              ? 'SUBMITTED'
              : operation === 'approve'
                ? 'APPROVED'
                : 'REJECTED';
          const grant = authorizeQuery(
            context,
            action === 'SUBMITTED' ? 'business-document:manage' : 'business-document:approve',
          );
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentTranslation =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/translations$/u.exec(request.pathname);
        if (businessDocumentTranslation && request.method === 'POST') {
          const grant = authorizeQuery(context, 'business-document:translate');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentActivity =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/activity$/u.exec(request.pathname);
        if (businessDocumentActivity && request.method === 'POST') {
          const grant = authorizeQuery(context, 'business-document:read');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        const businessDocumentDispatch =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/send$/u.exec(request.pathname);
        if (businessDocumentDispatch && request.method === 'POST') {
          const grant = authorizeQuery(context, 'business-document:send');
          if (!dependencies.businessDocuments)
            return error(
              503,
              'internal_error',
              'Business document repository unavailable',
              correlationId,
            );
          const response = await dispatchRoutes(
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
          );
          if (response !== null) return response;
        }
        return error(404, 'not_found', 'Route not found', correlationId);
      } catch (cause) {
        if (cause instanceof SessionRequestError)
          return error(
            cause.statusCode,
            cause.statusCode === 401 ? 'authentication_required' : 'forbidden',
            cause.message,
            correlationId,
          );
        if (cause instanceof DomainError) {
          const status =
            cause.code === 'forbidden'
              ? 403
              : cause.code === 'not_found'
                ? 404
                : cause.code === 'conflict'
                  ? 409
                  : 400;
          return error(status, cause.code, cause.message, correlationId);
        }
        return error(500, 'internal_error', 'Internal server error', correlationId);
      }
    },
  };
  const complete = (
    request: ApiRequest,
    correlationId: string,
    response: ApiResponse,
    started: number,
  ) => {
    const durationMs = Math.max(0, performance.now() - started);
    const route = request.pathname.startsWith('/api/')
      ? 'api'
      : request.pathname === '/health'
        ? 'health'
        : request.pathname === '/ready'
          ? 'ready'
          : 'other';
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ? request.method
      : 'OTHER';
    telemetry.count('http_requests_total', 1, {
      method,
      route,
      status: String(response.statusCode),
    });
    telemetry.timing('http_request_duration_ms', durationMs, { method, route });
    dependencies?.logger?.write({
      level: response.statusCode >= 500 ? 'error' : 'info',
      event: 'http.request.completed',
      correlationId,
      statusCode: response.statusCode,
      durationMs,
    });
    return {
      ...response,
      headers: {
        ...securityResponseHeaders(response.headers, security.enforceCsp ?? false),
        ...(browserAuthResponse(request, browserSession) ? { 'cache-control': 'no-store' } : {}),
        'x-correlation-id': correlationId,
      },
    };
  };
  return {
    rejectOversized(incomingCorrelationId) {
      const correlationId = correlation(incomingCorrelationId);
      return complete(
        { method: 'OTHER', pathname: '/transport/request-body' },
        correlationId,
        error(413, 'invalid_request', 'Request body too large', correlationId),
        performance.now(),
      );
    },
    async dispatch(request) {
      const correlationId = correlation(request.headers?.['x-correlation-id']);
      const started = performance.now();
      const response = await application.dispatch({
        ...request,
        headers: { ...request.headers, 'x-correlation-id': correlationId },
      });
      return complete(request, correlationId, response, started);
    },
  };
}
