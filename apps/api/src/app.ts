import { DEFAULT_BROWSER_SESSION, type BrowserSessionConfig } from '@kingturf/config';
import {
  DomainError,
  NOOP_TELEMETRY,
  type AuthorizationRepository,
  type EmployeeRepository,
  type OperationalLogger,
  type OrganizationRepository,
  type Telemetry,
} from '@kingturf/domain';
import type { ApiApplication, ApiRequest, ApiResponse } from './api-types.ts';
import {
  allow,
  array,
  attachmentBytes,
  correlation,
  error,
  expectedVersion,
  integer,
  jsonObject,
  mutationDto,
  notificationChannel,
  objectBody,
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
import { loginRoutes, sessionRoutes } from './routes/auth.ts';
import { accessAttempts } from './routes/dispatch/access.ts';
import { catalogAttempts } from './routes/dispatch/catalog.ts';
import { collectionsAttempts } from './routes/dispatch/collections.ts';
import { commercialAttempts } from './routes/dispatch/commercial.ts';
import { commissionAttempts } from './routes/dispatch/commission.ts';
import { complaintsAttempts } from './routes/dispatch/complaints.ts';
import { costsAttempts } from './routes/dispatch/costs.ts';
import { credentialsAttempts } from './routes/dispatch/credentials.ts';
import { crmAttempts } from './routes/dispatch/crm.ts';
import { dashboardAttempts } from './routes/dispatch/dashboard.ts';
import { documentsAttempts } from './routes/dispatch/documents.ts';
import { manufacturingAttempts } from './routes/dispatch/manufacturing.ts';
import { mrpAttempts } from './routes/dispatch/mrp.ts';
import { orderAttempts } from './routes/dispatch/order.ts';
import { procurementAttempts } from './routes/dispatch/procurement.ts';
import { productionAttempts } from './routes/dispatch/production.ts';
import { qtcpostAttempts } from './routes/dispatch/qtcpost.ts';
import { qtcreadsAttempts } from './routes/dispatch/qtcreads.ts';
import { qualityAttempts } from './routes/dispatch/quality.ts';
import { riskAttempts } from './routes/dispatch/risk.ts';
import { shipmentsAttempts } from './routes/dispatch/shipments.ts';
import { dispatchFoundationRoutes, foundationRoutes } from './routes/foundation.ts';
import { dispatchRoutes } from './routes/types.ts';
import { websiteLeadIngestRoutes } from './routes/website-lead-ingest.ts';
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
          if (pending.kind === 'immediate') return pending.value;
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
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of mrpAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
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
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of costsAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of shipmentsAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of complaintsAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.kind === 'immediate') return pending.value;
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
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of qualityAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
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
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of riskAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of orderAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of credentialsAttempts({
          request,
          dependencies,
          context,
          correlationId,
          securedAuthContext,
        })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
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
        for (const pending of qtcreadsAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of qtcpostAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of commissionAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of commercialAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of crmAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
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
        for (const pending of accessAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of catalogAttempts({ request, dependencies, context, correlationId })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
        }
        for (const pending of documentsAttempts({
          request,
          dependencies,
          context,
          correlationId,
        })) {
          if (pending.kind === 'immediate') return pending.value;
          if (pending.accept === 'always') return pending.project(await pending.pending);
          const response = pending.project(await pending.pending);
          if (pending.accept === 'truthy') {
            if (response) return response;
          } else if (response !== null) return response;
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
