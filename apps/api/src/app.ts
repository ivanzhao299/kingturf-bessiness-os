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
import type { ApiApplication } from './api-types.ts';
import {
  allow,
  attachmentBytes,
  correlation,
  error,
  expectedVersion,
  integer,
  notificationChannel,
  objectBody,
  string,
  strings,
  uuid,
  version,
} from './app-values.ts';
import { completeApplication } from './application-completion.ts';
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
import {
  authorizeCookieRequest,
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
import { businessAttempts } from './routes/dispatch/business.ts';
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
        for (const pending of businessAttempts({
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
  return completeApplication(application, dependencies, security, telemetry, browserSession);
}
