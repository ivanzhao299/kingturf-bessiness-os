import { companyReadAllowed, projectCollectionLegal } from './aggregate-authorization.ts';
import { randomUUID } from 'node:crypto';
import {
  assertEffectiveRange,
  addDecimal,
  assertStableCode,
  DomainError,
  normalizeContactEmail,
  normalizeDecimal,
  assertCurrency,
  parseEffectiveTimestamp,
  type AuthorizationRepository,
  type AuthorizationContext,
  type EmployeeRepository,
  type OrganizationRepository,
  NOOP_TELEMETRY,
  type OperationalLogger,
  type Telemetry,
} from '@kingturf/domain';
import type { ErrorCode, PermissionKey } from '@kingturf/types';
import { authorizeQuery } from './policy.ts';
import { auditReadRoutes } from './routes/audit-reads.ts';
import { numberAllocationRoutes } from './routes/number-allocation.ts';
import { ruleEvaluationRoutes } from './routes/rule-evaluation.ts';
import {
  ruleDefinitionListRoutes,
  ruleDefinitionCreateRoutes,
  ruleDefinitionPublishRoutes,
  ruleDefinitionVersionRoutes,
} from './routes/rule-definitions.ts';
import {
  workflowDefinitionListRoutes,
  workflowDefinitionCreateRoutes,
  workflowDefinitionVersionRoutes,
  workflowDefinitionPublishRoutes,
} from './routes/workflow-definitions.ts';
import {
  workflowRuntimeStartRoutes,
  workflowRuntimeTaskListRoutes,
  workflowRuntimeDecisionRoutes,
} from './routes/workflow-runtime.ts';
import {
  productionOrderReadRoutes,
  productionCostPolicyReadRoutes,
  productionCostRunReadRoutes,
} from './routes/production-reads.ts';
import { productionOrderCreateRoutes } from './routes/production-order-create.ts';
import { productionOrderCommandRoutes } from './routes/production-order-commands.ts';
import { productionMaterialRoutes } from './routes/production-material.ts';
import { productionReportRoutes } from './routes/production-report.ts';
import { productionOutputRoutes } from './routes/production-output.ts';
import { productionCostPolicyRoutes } from './routes/production-cost-policy.ts';
import { productionCostCalculationRoutes } from './routes/production-cost-calculation.ts';
import { productionCostDecisionRoutes } from './routes/production-cost-decisions.ts';
import { qtcBaseReadRoutes } from './routes/qtc-base-reads.ts';
import { qtcOperationalReadRoutes } from './routes/qtc-operational-reads.ts';
import { qtcCreditLimitRoutes, qtcCreditEvaluationRoutes } from './routes/qtc-credit-writes.ts';
import { qtcCreditApprovalRoutes } from './routes/qtc-credit-approval.ts';
import { qtcContractCreateRoutes } from './routes/qtc-contract-create.ts';
import { qtcContractSignRoutes } from './routes/qtc-contract-sign.ts';
import { qtcSalesOrderCreateRoutes } from './routes/qtc-sales-order-create.ts';
import { qtcArPostRoutes } from './routes/qtc-ar-post.ts';
import { qtcBankPaymentIntakeRoutes } from './routes/qtc-bank-payment-intake.ts';
import { qtcReconciliationRunRoutes } from './routes/qtc-reconciliation-run.ts';
import { commissionReadRoutes } from './routes/commission-reads.ts';
import { executiveDashboardRoutes } from './routes/dashboard.ts';
import { manufacturingReadRoutes } from './routes/manufacturing-reads.ts';
import { manufacturingItemCreateRoutes } from './routes/manufacturing-item-create.ts';
import { manufacturingBomCreateRoutes } from './routes/manufacturing-bom-create.ts';
import { manufacturingRoutingCreateRoutes } from './routes/manufacturing-routing-create.ts';
import { manufacturingPublishRoutes } from './routes/manufacturing-publish.ts';
import { procurementReadRoutes } from './routes/procurement-reads.ts';
import { procurementSupplierCreateRoutes } from './routes/procurement-supplier-create.ts';
import { procurementSupplierQualificationRoutes } from './routes/procurement-supplier-qualification.ts';
import { procurementRfqCreateRoutes } from './routes/procurement-rfq-create.ts';
import { procurementSupplierQuoteCreateRoutes } from './routes/procurement-supplier-quote-create.ts';
import { procurementPurchaseOrderCreateRoutes } from './routes/procurement-purchase-order-create.ts';
import { procurementIssueRoutes } from './routes/procurement-issue.ts';
import { procurementLocationCreateRoutes } from './routes/procurement-location-create.ts';
import { procurementReceiptCreateRoutes } from './routes/procurement-receipt-create.ts';
import { procurementMovementCreateRoutes } from './routes/procurement-movement-create.ts';
import { mrpReadRoutes } from './routes/mrp-reads.ts';
import { mrpPolicyCreateRoutes } from './routes/mrp-policy-create.ts';
import { mrpDemandCreateRoutes } from './routes/mrp-demand-create.ts';
import { mrpRunCreateRoutes } from './routes/mrp-run-create.ts';
import { mrpProposalCommandRoutes } from './routes/mrp-proposal-commands.ts';
import { commissionCommandRoutes } from './routes/commission-commands.ts';
import { commissionAccrueRoutes } from './routes/commission-accrue.ts';
import { commissionPolicyPublishRoutes } from './routes/commission-policy-publish.ts';
import {
  commissionPolicyCreateRoutes,
  commissionPolicyVersionRoutes,
} from './routes/commission-policy-writes.ts';
import { websiteLeadIngestRoutes } from './routes/website-lead-ingest.ts';
import {
  numberDefinitionListRoutes,
  numberDefinitionCreateRoutes,
  numberDefinitionPublishRoutes,
  numberDefinitionVersionRoutes,
} from './routes/number-definitions.ts';
import {
  masterEntryCreateRoutes,
  masterEntryListRoutes,
  masterEntryDetailRoutes,
  masterEntryUpdateRoutes,
  masterEntryDeleteRoutes,
} from './routes/master-data-entries.ts';
import {
  masterCategoryReadRoutes,
  masterCategoryCreateRoutes,
  masterCategoryUpdateRoutes,
  masterCategoryDeleteRoutes,
} from './routes/master-data-categories.ts';
import type { AuthenticationService } from './security.ts';
import type {
  PostgresAuditRepository,
  PostgresMasterDataRepository,
  PostgresNumberRepository,
  PostgresRuleRepository,
  PostgresWorkflowRepository,
} from './platform-repositories.ts';
import type {
  PostgresAttachmentRepository,
  PostgresBusinessObjectRepository,
  PostgresEventRepository,
  PostgresNotificationRepository,
} from './foundation-repositories.ts';
import type { PostgresCrmRepository } from './crm-repositories.ts';
import type { PostgresCommercialRepository } from './commercial-repositories.ts';
import type { PostgresQuoteToCashRepository } from './qtc-repositories.ts';
import type { PostgresCommissionRepository } from './commission-repositories.ts';
import type { PostgresOrder360Repository } from './order-360-repositories.ts';
import type { PostgresRiskRepository } from './risk-repositories.ts';
import type { PostgresDashboardRepository } from './dashboard-repositories.ts';
import type { PostgresManufacturingRepository } from './manufacturing-repositories.ts';
import type { PostgresProcurementRepository } from './procurement-repositories.ts';
import type { PostgresMrpRepository } from './mrp-repositories.ts';
import type { PostgresProductionRepository } from './production-repositories.ts';
import type { PostgresProductionCostRepository } from './production-cost-repositories.ts';
import type { PostgresQualityRepository } from './quality-repositories.ts';
import type { PostgresShipmentRepository } from './shipment-repositories.ts';
import type { PostgresCollectionRepository } from './collection-repositories.ts';
import type { PostgresComplaintRepository } from './complaint-repositories.ts';
import type { PostgresBusinessDocumentRepository } from './business-document-repositories.ts';
import type { PostgresContractDocumentRepository } from './contract-document-repositories.ts';
import type { PostgresWebsiteLeadIngestor } from './website-lead-ingest.ts';
import { dispatchFoundationRoutes, foundationRoutes } from './routes/foundation.ts';
import { credentialRoutes, loginRoutes, sessionRoutes } from './routes/auth.ts';
import { dispatchRoutes } from './routes/types.ts';
import { identityProvisionRoutes } from './routes/identity-provision.ts';
import { dispatchAuthorizationRoutes } from './routes/authorization.ts';
import { identityAccessRoutes } from './routes/identity-access.ts';
import { collectionRoutes } from './routes/collection.ts';
import { dispatchOpportunityRoutes } from './routes/opportunities.ts';
import { commercialNestedReadRoutes } from './routes/commercial-nested-reads.ts';
import { commercialViewRoutes } from './routes/commercial-views.ts';
import { ctrRoutes } from './routes/ctr.ts';
import { technicalSolutionRoutes } from './routes/technical-solutions.ts';
import { costMatrixBaseRoutes } from './routes/cost-matrix-base.ts';
import { costMatrixFactorRoutes } from './routes/cost-matrix-factors.ts';
import { costMatrixCalculationRoutes } from './routes/cost-matrix-calculations.ts';
import { commercialDefinitionRoutes } from './routes/commercial-definitions.ts';
import { commercialEvaluationRoutes } from './routes/commercial-evaluations.ts';
import { quoteWriteRoutes } from './routes/quote-writes.ts';
import { quoteCommandRoutes } from './routes/quote-commands.ts';
import { complaintSlaRoutes } from './routes/complaint-sla.ts';
import { complaintReadRoutes } from './routes/complaint-reads.ts';
import { complaintCreateRoutes } from './routes/complaint-create.ts';
import { complaintBatchTriageRoutes } from './routes/complaint-batch-triage.ts';
import { complaintTransitionRoutes } from './routes/complaint-transitions.ts';
import { ncrCreateRoutes } from './routes/ncr-create.ts';
import { ncrTransitionRoutes } from './routes/ncr-transitions.ts';
import { capaCreateRoutes } from './routes/capa-create.ts';
import { capaActionRoutes } from './routes/capa-actions.ts';
import { capaLifecycleRoutes } from './routes/capa-lifecycle.ts';
import { customerCollectionRoutes, customerDetailRoutes } from './routes/customer-base.ts';
import { customerOwnershipRoutes } from './routes/customer-ownership.ts';
import { customerActivityRoutes } from './routes/customer-activities.ts';
import { customerLifecycleRoutes } from './routes/customer-lifecycle.ts';
import { customer360Routes } from './routes/customer-360.ts';
import { customerContactRoutes } from './routes/customer-contacts.ts';
import { leadListRoutes, leadCreateRoutes, leadPoolRoutes } from './routes/lead-base.ts';
import { leadClaimRoutes } from './routes/lead-claim.ts';
import { leadCommandRoutes } from './routes/lead-commands.ts';
import { riskPolicyReadRoutes, riskEvaluationReadRoutes } from './routes/risk-reads.ts';
import { riskPolicyCreateRoutes } from './routes/risk-policy-create.ts';
import { riskPolicyRevisionRoutes } from './routes/risk-policy-revision.ts';
import { riskPolicyPublishRoutes } from './routes/risk-policy-publish.ts';
import { riskEvaluationCreateRoutes } from './routes/risk-evaluation-create.ts';
import { riskTaskCommandRoutes } from './routes/risk-task-commands.ts';
import { order360Routes } from './routes/order-360.ts';
import {
  qualityPlanReadRoutes,
  qualityInspectionReadRoutes,
  lotTraceabilityReadRoutes,
} from './routes/quality-reads.ts';
import { qualityPlanCreateRoutes } from './routes/quality-plan-create.ts';
import { qualityPlanPublishRoutes } from './routes/quality-plan-publish.ts';
import { qualityInspectionOpenRoutes } from './routes/quality-inspection-open.ts';
import { qualityInspectionTransitionRoutes } from './routes/quality-inspection-transitions.ts';

type Json = unknown;
const permittedDto = <T extends Record<string, unknown>>(
  value: T,
  fields: readonly string[] | null,
): Partial<T> => {
  if (fields === null) return value;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => visible.has(key)),
  ) as Partial<T>;
};
const mutationDto = <T extends Record<string, unknown>>(
  value: T,
  context: AuthorizationContext,
  readCapability: PermissionKey,
): Partial<T> => {
  const read = context.permissions.get(readCapability);
  return read ? permittedDto(value, read.fields) : permittedDto(value, ['version']);
};
// A legal write capability does not widen the independent legal read scope of its response.
const legalMutationDto = <T extends Record<string, unknown>>(
  value: T,
  context: AuthorizationContext,
): Partial<T> => {
  const read = context.permissions.get('legal-case:read');
  const legalRead = read
    ? {
        scopes: read.scopes,
        anchors: context.scopeAnchors?.get('legal-case:read') ?? [],
        fields: read.fields,
      }
    : undefined;
  return companyReadAllowed(legalRead)
    ? permittedDto(value, read ? read.fields : [])
    : permittedDto(value, ['version']);
};
const authorizeOneOf = (
  context: AuthorizationContext,
  preferred: PermissionKey,
  fallback: PermissionKey,
  fields?: readonly string[],
) => authorizeQuery(context, context.permissions.has(preferred) ? preferred : fallback, fields);
export type ApiRequest = Readonly<{
  method: string;
  pathname: string;
  query?: Readonly<Record<string, string | undefined>>;
  headers?: Readonly<Record<string, string | undefined>>;
  body?: unknown;
}>;
export type ApiResponse = Readonly<{
  body: Json;
  statusCode: number;
  headers?: Readonly<Record<string, string>>;
}>;
export type ApiDependencies = Readonly<{
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
export type ApiApplication = Readonly<{
  dispatch(request: ApiRequest): Promise<ApiResponse>;
  rejectOversized(correlationId?: string): ApiResponse;
}>;
const error = (
  statusCode: number,
  code: ErrorCode,
  message: string,
  correlationId: string,
  details?: readonly string[],
): ApiResponse => ({
  statusCode,
  body: { error: { code, message, correlationId, ...(details ? { details } : {}) } },
});
const objectBody = (body: unknown): Record<string, unknown> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new DomainError('invalid_request', 'A JSON object body is required');
  return body as Record<string, unknown>;
};
const string = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('invalid_request', `${name} is required`);
  return value.trim();
};
const boundedString = (value: unknown, name: string, maximum: number): string => {
  const result = string(value, name);
  if (result.length > maximum)
    throw new DomainError('invalid_request', `${name} exceeds ${String(maximum)} characters`);
  return result;
};
const timestamp = (value: unknown, name: string): string => {
  const result = string(value, name);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.getTime()))
    throw new DomainError('invalid_request', `${name} must be a valid timestamp`);
  return parsed.toISOString();
};
const calendarDate = (value: unknown, name: string): string => {
  const result = string(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`)))
    throw new DomainError('invalid_request', `${name} must be a valid YYYY-MM-DD date`);
  return result;
};
const optionalCalendarDate = (value: unknown, name: string): string | null =>
  value === null || value === undefined ? null : calendarDate(value, name);
const COST_FACTOR_SOURCE_TYPES = [
  'MANUAL',
  'PURCHASE_ORDER',
  'SUPPLIER_QUOTE',
  'MARKET_REFERENCE',
  'INTERNAL_BENCHMARK',
] as const;
const costFactorSourceType = (value: unknown): string => {
  const result = string(value, 'sourceType');
  if (!COST_FACTOR_SOURCE_TYPES.some((candidate) => candidate === result))
    throw new DomainError('invalid_request', 'sourceType is not supported');
  return result;
};
const requireCostFactorItemSource = (sourceType: string, sourceItemVersionId: unknown): void => {
  if ((sourceType === 'PURCHASE_ORDER' || sourceType === 'SUPPLIER_QUOTE') && !sourceItemVersionId)
    throw new DomainError(
      'invalid_request',
      'Purchase order and supplier quote sources require a linked purchasing item',
    );
};
const bearer = (headers: Readonly<Record<string, string | undefined>>): string | null => {
  const value = headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const correlation = (value: string | undefined): string =>
  value && UUID.test(value) ? value : randomUUID();
const uuid = (value: unknown, name: string): string => {
  const result = string(value, name);
  if (!UUID.test(result)) throw new DomainError('invalid_request', `${name} must be a UUID`);
  return result;
};
const allow = (body: Record<string, unknown>, fields: readonly string[]): void => {
  const unexpected = Object.keys(body).filter((key) => !fields.includes(key));
  if (unexpected.length)
    throw new DomainError('invalid_request', `Unsupported fields: ${unexpected.sort().join(', ')}`);
};
const version = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new DomainError('invalid_request', 'version must be a positive integer');
  return value;
};
const expectedVersion = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new DomainError('invalid_request', 'expectedVersion must be a non-negative integer');
  return value;
};
const strings = (value: unknown, name: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim()))
    throw new DomainError('invalid_request', `${name} must be an array of non-empty strings`);
  return [...new Set(value as string[])].sort();
};
const notificationChannel = (value: unknown): string => {
  const channel = string(value, 'channel');
  if (!['IN_APP', 'EMAIL', 'SMS', 'PUSH'].includes(channel))
    throw new DomainError('invalid_request', 'channel is unsupported');
  return channel;
};
const documentConnector = (value: unknown, includeTranslation = false): string => {
  const connector = string(value, 'connector');
  const supported = [
    'EMAIL',
    'WECHAT_WORK',
    'WHATSAPP_BUSINESS',
    'MICROSOFT_TEAMS',
    'TELEGRAM',
    'LINE',
    ...(includeTranslation ? ['TRANSLATION'] : []),
  ];
  if (!supported.includes(connector))
    throw new DomainError('invalid_request', 'document connector is unsupported');
  return connector;
};
const documentLocale = (value: unknown): string => {
  const locale = string(value, 'targetLocale');
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(locale))
    throw new DomainError('invalid_request', 'targetLocale must use a supported locale code');
  return locale;
};
const connectorProvider = (value: unknown): string => {
  const provider = string(value, 'provider');
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(provider))
    throw new DomainError('invalid_request', 'provider must be an uppercase provider code');
  return provider;
};
const connectorSecretReference = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const reference = string(value, 'secretReference');
  if (!/^KINGTURF_CONNECTOR_[A-Z0-9_]{3,96}$/u.test(reference))
    throw new DomainError(
      'invalid_request',
      'secretReference must name a KINGTURF_CONNECTOR_* managed secret',
    );
  return reference;
};
const safeConnectorConfiguration = (value: unknown): Record<string, never> => {
  const configuration = jsonObject(value ?? {}, 'configuration');
  const secretKeys: string[] = [];
  const visit = (candidate: unknown, path = ''): void => {
    if (typeof candidate !== 'object' || candidate === null) return;
    for (const [key, nested] of Object.entries(candidate)) {
      const current = path ? `${path}.${key}` : key;
      if (/(secret|token|password|api.?key|credential)/iu.test(key)) secretKeys.push(current);
      visit(nested, current);
    }
  };
  visit(configuration);
  if (secretKeys.length)
    throw new DomainError(
      'invalid_request',
      'Connector secrets must be stored in the secret reference, not configuration',
    );
  if (JSON.stringify(configuration).length > 8192)
    throw new DomainError('invalid_request', 'Connector configuration exceeds 8192 characters');
  return configuration;
};
const attachmentBytes = (value: unknown): Uint8Array => {
  const encoded = string(value, 'contentBase64');
  if (encoded.length > 34_952_536)
    throw new DomainError('invalid_request', 'Attachment transport exceeds 25 MiB');
  if (
    encoded.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
  )
    throw new DomainError('invalid_request', 'contentBase64 must be canonical base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength > 26_214_400)
    throw new DomainError('invalid_request', 'Attachment transport exceeds 25 MiB');
  return bytes;
};
const integer = (value: unknown, name: string, minimum: number, maximum: number): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new DomainError(
      'invalid_request',
      `${name} must be an integer between ${String(minimum)} and ${String(maximum)}`,
    );
  return value;
};
const jsonObject = (value: unknown, name: string): Record<string, never> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainError('invalid_request', `${name} must be a JSON object`);
  return value as Record<string, never>;
};
const array = (value: unknown, name: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new DomainError('invalid_request', `${name} must be an array`);
  return value;
};
const decimal = (value: unknown, name: string, nonnegative = true): string => {
  const result = normalizeDecimal(string(value, name));
  if (nonnegative && result.startsWith('-'))
    throw new DomainError('invalid_request', `${name} must be non-negative`);
  return result;
};
const currency = (value: unknown): string => assertCurrency(string(value, 'currency'));
const idempotency = (request: ApiRequest): string => {
  const key = request.headers?.['idempotency-key'];
  if (!key || key.length > 128)
    throw new DomainError('invalid_request', 'Idempotency-Key is required');
  return key;
};
const effectiveRange = (body: Record<string, unknown>) => {
  const effectiveFrom = string(body.effectiveFrom, 'effectiveFrom');
  const effectiveTo =
    body.effectiveTo === null || body.effectiveTo === undefined
      ? null
      : string(body.effectiveTo, 'effectiveTo');
  assertEffectiveRange(effectiveFrom, effectiveTo);
  return { effectiveFrom, effectiveTo };
};
export function buildApp(dependencies?: ApiDependencies): ApiApplication {
  const telemetry = dependencies?.telemetry ?? NOOP_TELEMETRY;
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
          correlationId,
          parsers: { objectBody, string, allow },
        };
        const loginResponse = await dispatchRoutes(loginRoutes(authRouteContext), request);
        if (loginResponse) return loginResponse;
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/integrations/website/leads'
        ) {
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
        const token = bearer(request.headers ?? {});
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
          authorization: context,
          employees: dependencies.employees,
        };
        const sessionResponse = await dispatchRoutes(sessionRoutes(securedAuthContext), request);
        if (sessionResponse) return sessionResponse;
        if (dependencies.manufacturing) {
          const manufacturingLists: Readonly<
            Record<string, readonly ['items' | 'boms' | 'routings', PermissionKey] | undefined>
          > = {
            '/api/v1/manufacturing-items': ['items', 'manufacturing-item:read'],
            '/api/v1/manufacturing-boms': ['boms', 'bom:read'],
            '/api/v1/manufacturing-routings': ['routings', 'routing:read'],
          } as const;
          const listDefinition = manufacturingLists[request.pathname];
          if (request.method === 'GET' && listDefinition) {
            const [view, capability] = listDefinition;
            const response = await dispatchRoutes(
              manufacturingReadRoutes({
                repository: () =>
                  dependencies.manufacturing as Pick<
                    NonNullable<ApiDependencies['manufacturing']>,
                    'list'
                  >,
                view,
                capability,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-items') {
            const response = await dispatchRoutes(
              manufacturingItemCreateRoutes({
                repository: () =>
                  dependencies.manufacturing as Pick<
                    NonNullable<ApiDependencies['manufacturing']>,
                    'createItem'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  jsonObject,
                  timestamp,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-boms') {
            const response = await dispatchRoutes(
              manufacturingBomCreateRoutes({
                repository: () =>
                  dependencies.manufacturing as Pick<
                    NonNullable<ApiDependencies['manufacturing']>,
                    'createBom'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  jsonObject,
                  array,
                  uuid,
                  decimal,
                  integer,
                  timestamp,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-routings') {
            const response = await dispatchRoutes(
              manufacturingRoutingCreateRoutes({
                repository: () =>
                  dependencies.manufacturing as Pick<
                    NonNullable<ApiDependencies['manufacturing']>,
                    'createRouting'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  jsonObject,
                  array,
                  uuid,
                  decimal,
                  integer,
                  timestamp,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const manufacturingPublish =
            /^\/api\/v1\/manufacturing-(item|bom|routing)-versions\/([0-9a-f-]+)\/publish$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && manufacturingPublish) {
            const response = await dispatchRoutes(
              manufacturingPublishRoutes({
                repository: () =>
                  dependencies.manufacturing as Pick<
                    NonNullable<ApiDependencies['manufacturing']>,
                    'publish'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        if (dependencies.procurement) {
          const procurementLists: Readonly<
            Record<
              string,
              | readonly [
                  (
                    | 'suppliers'
                    | 'rfqs'
                    | 'quotes'
                    | 'orders'
                    | 'receipts'
                    | 'locations'
                    | 'inventory'
                  ),
                  PermissionKey,
                ]
              | undefined
            >
          > = {
            '/api/v1/suppliers': ['suppliers', 'supplier:read'],
            '/api/v1/procurement-rfqs': ['rfqs', 'procurement:read'],
            '/api/v1/supplier-quotes': ['quotes', 'procurement:read'],
            '/api/v1/purchase-orders': ['orders', 'procurement:read'],
            '/api/v1/goods-receipts': ['receipts', 'procurement:read'],
            '/api/v1/inventory-locations': ['locations', 'inventory:read'],
            '/api/v1/inventory-balances': ['inventory', 'inventory:read'],
          };
          const listDefinition = procurementLists[request.pathname];
          if (request.method === 'GET' && listDefinition) {
            const [view, capability] = listDefinition;
            const effectiveCapability =
              request.pathname === '/api/v1/inventory-locations' &&
              !context.permissions.has('inventory:read') &&
              context.permissions.has('inventory:move')
                ? 'inventory:move'
                : capability;
            const response = await dispatchRoutes(
              procurementReadRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'list'
                  >,
                view,
                capability: effectiveCapability,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/suppliers') {
            const response = await dispatchRoutes(
              procurementSupplierCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'createSupplier'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  currency,
                  integer,
                  jsonObject,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const qualification = /^\/api\/v1\/suppliers\/([0-9a-f-]+)\/qualifications$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && qualification) {
            const response = await dispatchRoutes(
              procurementSupplierQualificationRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'qualifySupplier'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  uuid,
                  calendarDate,
                  decimal,
                  integer,
                  jsonObject,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/procurement-rfqs') {
            const response = await dispatchRoutes(
              procurementRfqCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'createRfq'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  array,
                  jsonObject,
                  uuid,
                  decimal,
                  calendarDate,
                  string,
                  stableCode: assertStableCode,
                  timestamp,
                  currency,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/supplier-quotes') {
            const response = await dispatchRoutes(
              procurementSupplierQuoteCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'createSupplierQuote'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  array,
                  jsonObject,
                  uuid,
                  decimal,
                  calendarDate,
                  string,
                  timestamp,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/purchase-orders') {
            const response = await dispatchRoutes(
              procurementPurchaseOrderCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'createPurchaseOrder'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  array,
                  jsonObject,
                  uuid,
                  decimal,
                  calendarDate,
                  string,
                  stableCode: assertStableCode,
                  currency,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const procurementIssue =
            /^\/api\/v1\/(procurement-rfqs|purchase-orders)\/([0-9a-f-]+)\/issue$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && procurementIssue) {
            const response = await dispatchRoutes(
              procurementIssueRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'issueRfq' | 'issuePurchaseOrder'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/inventory-locations') {
            const response = await dispatchRoutes(
              procurementLocationCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'createLocation'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, stableCode: assertStableCode },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/goods-receipts') {
            const response = await dispatchRoutes(
              procurementReceiptCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'receive'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  array,
                  jsonObject,
                  uuid,
                  string,
                  stableCode: assertStableCode,
                  decimal,
                  optionalCalendarDate,
                  timestamp,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/inventory-movements') {
            const response = await dispatchRoutes(
              procurementMovementCreateRoutes({
                repository: () =>
                  dependencies.procurement as Pick<
                    NonNullable<ApiDependencies['procurement']>,
                    'move'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  uuid,
                  decimal,
                  timestamp,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        if (dependencies.mrp) {
          const mrpLists: Readonly<
            Record<string, readonly ['policies' | 'demands' | 'runs', PermissionKey] | undefined>
          > = {
            '/api/v1/mrp-policies': ['policies', 'mrp-policy:read'],
            '/api/v1/mrp-demands': ['demands', 'mrp:read'],
            '/api/v1/mrp-runs': ['runs', 'mrp:read'],
          };
          const listDefinition = mrpLists[request.pathname];
          if (request.method === 'GET' && listDefinition) {
            const [view, capability] = listDefinition;
            const response = await dispatchRoutes(
              mrpReadRoutes({
                repository: () =>
                  dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'list'>,
                view,
                capability,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-policies') {
            const response = await dispatchRoutes(
              mrpPolicyCreateRoutes({
                repository: () =>
                  dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'createPolicy'>,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, uuid, decimal, integer, timestamp },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-demands') {
            const response = await dispatchRoutes(
              mrpDemandCreateRoutes({
                repository: () =>
                  dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'createDemand'>,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  uuid,
                  calendarDate,
                  decimal,
                  integer,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-runs') {
            const response = await dispatchRoutes(
              mrpRunCreateRoutes({
                repository: () =>
                  dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'run'>,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  timestamp,
                  calendarDate,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const proposalCommand =
            /^\/api\/v1\/mrp-proposals\/([0-9a-f-]+)\/(approve|reject|release|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && proposalCommand) {
            const response = await dispatchRoutes(
              mrpProposalCommandRoutes({
                repository: () =>
                  dependencies.mrp as Pick<
                    NonNullable<ApiDependencies['mrp']>,
                    'transitionProposal'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid, string, jsonObject },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        if (dependencies.production) {
          if (request.method === 'GET' && request.pathname === '/api/v1/production-orders') {
            const response = await dispatchRoutes(
              productionOrderReadRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/production-orders') {
            const response = await dispatchRoutes(
              productionOrderCreateRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  stableCode: assertStableCode,
                  uuid,
                  decimal,
                  calendarDate,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const productionCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/(release|start|complete|close|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && productionCommand) {
            const response = await dispatchRoutes(
              productionOrderCommandRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  string,
                  jsonObject,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const materialCommand = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/materials$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && materialCommand) {
            const response = await dispatchRoutes(
              productionMaterialRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  uuid,
                  decimal,
                  timestamp,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const reportCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/operation-reports$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && reportCommand) {
            const response = await dispatchRoutes(
              productionReportRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  decimal,
                  timestamp,
                  string,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const outputCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/finished-rolls$/u.exec(request.pathname);
          if (request.method === 'POST' && outputCommand) {
            const response = await dispatchRoutes(
              productionOutputRoutes({
                repository: dependencies.production,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  string,
                  stableCode: assertStableCode,
                  decimal,
                  calendarDate,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        if (dependencies.productionCosts) {
          if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-policies') {
            const response = await dispatchRoutes(
              productionCostPolicyReadRoutes({
                repository: dependencies.productionCosts,
                authorization: context,
                authorizeQuery,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-runs') {
            const response = await dispatchRoutes(
              productionCostRunReadRoutes({
                repository: dependencies.productionCosts,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (
            request.method === 'POST' &&
            request.pathname === '/api/v1/production-cost-policies'
          ) {
            const response = await dispatchRoutes(
              productionCostPolicyRoutes({
                repository: dependencies.productionCosts,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  decimal,
                  string,
                  stableCode: assertStableCode,
                  integer,
                  currency: assertCurrency,
                  calendarDate,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/production-cost-runs') {
            const response = await dispatchRoutes(
              productionCostCalculationRoutes({
                repository: dependencies.productionCosts,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid, string, stableCode: assertStableCode },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const costDecision =
            /^\/api\/v1\/production-cost-runs\/([0-9a-f-]+)\/(approve|reject)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && costDecision) {
            const response = await dispatchRoutes(
              productionCostDecisionRoutes({
                repository: dependencies.productionCosts,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  string,
                  jsonObject,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
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
        if (dependencies.complaints) {
          const slaResponse = await dispatchRoutes(
            complaintSlaRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              permittedDto,
              mutationDto: (value) => mutationDto(value, context, 'complaint-sla:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                integer,
                timestamp,
              },
            }),
            request,
          );
          if (slaResponse) return slaResponse;
          const complaintReadResponse = await dispatchRoutes(
            complaintReadRoutes({
              repository: dependencies.complaints,
              authorization: context,
              authorize: (capability) => authorizeQuery(context, capability),
              permittedDto,
              parsers: { string, uuid, integer, timestamp },
            }),
            request,
          );
          if (complaintReadResponse) return complaintReadResponse;
          const complaintCreateResponse = await dispatchRoutes(
            complaintCreateRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'complaint:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                uuid,
                timestamp,
                jsonObject,
              },
            }),
            request,
          );
          if (complaintCreateResponse) return complaintCreateResponse;
          const complaintBatchResponse = await dispatchRoutes(
            complaintBatchTriageRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              parsers: {
                objectBody,
                allow,
                array,
                uuid,
                integer,
                string,
                stableCode: assertStableCode,
              },
            }),
            request,
          );
          if (complaintBatchResponse) return complaintBatchResponse;
          const complaintTransitionResponse = await dispatchRoutes(
            complaintTransitionRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'complaint:read'),
              parsers: {
                objectBody,
                allow,
                uuid,
                integer,
                string,
                jsonObject,
                stableCode: assertStableCode,
              },
            }),
            request,
          );
          if (complaintTransitionResponse) return complaintTransitionResponse;
          const ncrCreateResponse = await dispatchRoutes(
            ncrCreateRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'ncr:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                uuid,
                decimal,
                integer,
                jsonObject,
              },
            }),
            request,
          );
          if (ncrCreateResponse) return ncrCreateResponse;
          const ncrTransitionResponse = await dispatchRoutes(
            ncrTransitionRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'ncr:read'),
              parsers: {
                objectBody,
                allow,
                string,
                uuid,
                integer,
                jsonObject,
                stableCode: assertStableCode,
              },
            }),
            request,
          );
          if (ncrTransitionResponse) return ncrTransitionResponse;
          const capaCreateResponse = await dispatchRoutes(
            capaCreateRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'capa:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                uuid,
                timestamp,
                integer,
                jsonObject,
              },
            }),
            request,
          );
          if (capaCreateResponse) return capaCreateResponse;
          const capaActionResponse = await dispatchRoutes(
            capaActionRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'capa:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                uuid,
                timestamp,
                integer,
                jsonObject,
              },
            }),
            request,
          );
          if (capaActionResponse) return capaActionResponse;
          const capaLifecycleResponse = await dispatchRoutes(
            capaLifecycleRoutes({
              repository: dependencies.complaints,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              mutationDto: (value) => mutationDto(value, context, 'capa:read'),
              parsers: {
                objectBody,
                allow,
                string,
                stableCode: assertStableCode,
                uuid,
                timestamp,
                integer,
                jsonObject,
              },
            }),
            request,
          );
          if (capaLifecycleResponse) return capaLifecycleResponse;
        }
        if (dependencies.collections) {
          const collectionResponse = await dispatchRoutes(
            collectionRoutes({
              repository: dependencies.collections,
              authorization: context,
              correlationId,
              authorize: (capability, fields) => authorizeQuery(context, capability, fields),
              projectLegal: projectCollectionLegal,
              permittedDto,
              mutationDto: (value) => mutationDto(value, context, 'collection:read'),
              legalMutationDto: (value) => legalMutationDto(value, context),
              parsers: {
                objectBody,
                allow,
                string,
                uuid,
                timestamp,
                decimal,
                currency,
                strings,
                jsonObject,
                stableCode: assertStableCode,
              },
            }),
            request,
          );
          if (collectionResponse) return collectionResponse;
        }
        if (dependencies.quality) {
          const qualityLists: Readonly<
            Record<string, readonly ['plans' | 'inspections' | 'lots', PermissionKey] | undefined>
          > = {
            '/api/v1/quality-plans': ['plans', 'quality-plan:read'],
            '/api/v1/quality-inspections': ['inspections', 'quality:read'],
            '/api/v1/lot-traceability': ['lots', 'traceability:read'],
          };
          const qualityList = qualityLists[request.pathname];
          if (request.method === 'GET' && qualityList) {
            const [view, capability] = qualityList;
            const readContext = {
              repository: () =>
                dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'list'>,
              authorization: context,
              authorizeQuery,
              view,
              capability,
              permittedDto,
            };
            const response = await dispatchRoutes(
              [
                ...qualityPlanReadRoutes(readContext),
                ...qualityInspectionReadRoutes(readContext),
                ...lotTraceabilityReadRoutes(readContext),
              ],
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/quality-plans') {
            const response = await dispatchRoutes(
              qualityPlanCreateRoutes({
                repository: () =>
                  dependencies.quality as Pick<
                    NonNullable<ApiDependencies['quality']>,
                    'createPlan'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  uuid,
                  decimal,
                  timestamp,
                  array,
                  jsonObject,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const planPublish = /^\/api\/v1\/quality-plans\/([0-9a-f-]+)\/publish$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && planPublish) {
            const response = await dispatchRoutes(
              qualityPlanPublishRoutes({
                repository: () =>
                  dependencies.quality as Pick<
                    NonNullable<ApiDependencies['quality']>,
                    'publishPlan'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                uuid,
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/quality-inspections') {
            const response = await dispatchRoutes(
              qualityInspectionOpenRoutes({
                repository: () =>
                  dependencies.quality as Pick<
                    NonNullable<ApiDependencies['quality']>,
                    'openInspection'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  string,
                  uuid,
                  decimal,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const inspectionCommand =
            /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(sample|complete|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && inspectionCommand) {
            const response = await dispatchRoutes(
              qualityInspectionTransitionRoutes({
                repository: () =>
                  dependencies.quality as Pick<
                    NonNullable<ApiDependencies['quality']>,
                    'transitionInspection'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: {
                  objectBody,
                  allow,
                  uuid,
                  string,
                  jsonObject,
                  stableCode: assertStableCode,
                },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const resultCommand = /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/results$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && resultCommand) {
            const body = objectBody(request.body);
            allow(body, [
              'characteristicId',
              'measuredNumeric',
              'measuredBoolean',
              'measuredText',
              'passed',
              'notes',
              'occurredAt',
              'idempotencyKey',
            ]);
            if (typeof body.passed !== 'boolean')
              throw new DomainError('invalid_request', 'passed must be boolean');
            if (body.measuredBoolean !== undefined && typeof body.measuredBoolean !== 'boolean')
              throw new DomainError('invalid_request', 'measuredBoolean must be boolean');
            const grant = authorizeQuery(context, 'quality:inspect', Object.keys(body));
            const result = await dependencies.quality.recordResult(
              uuid(resultCommand[1], 'inspectionId'),
              {
                characteristicId: uuid(body.characteristicId, 'characteristicId'),
                ...(body.measuredNumeric === undefined
                  ? {}
                  : { measuredNumeric: decimal(body.measuredNumeric, 'measuredNumeric', false) }),
                ...(body.measuredBoolean === undefined
                  ? {}
                  : { measuredBoolean: body.measuredBoolean }),
                ...(body.measuredText === undefined
                  ? {}
                  : { measuredText: string(body.measuredText, 'measuredText') }),
                passed: body.passed,
                notes: string(body.notes ?? '', 'notes'),
                occurredAt: timestamp(body.occurredAt, 'occurredAt'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'quality:read') };
          }
          const dispositionCommand =
            /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(release|reject)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && dispositionCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'quality:disposition', Object.keys(body));
            const result = await dependencies.quality.dispose(
              uuid(dispositionCommand[1], 'inspectionId'),
              dispositionCommand[2] === 'release' ? 'RELEASED' : 'REJECTED',
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'quality:read') };
          }
        }
        if (
          request.method === 'GET' &&
          request.pathname === '/api/v1/executive-dashboard' &&
          dependencies.dashboard
        ) {
          const response = await dispatchRoutes(
            executiveDashboardRoutes({
              repository: () =>
                dependencies.dashboard as Pick<NonNullable<ApiDependencies['dashboard']>, 'get'>,
              authorization: context,
              authorizeQuery,
              parsers: { timestamp, currency },
            }),
            request,
          );
          if (response !== null) return response;
        }
        if (dependencies.risks) {
          if (request.method === 'GET' && request.pathname === '/api/v1/risk-policies') {
            const response = await dispatchRoutes(
              riskPolicyReadRoutes({
                repository: () =>
                  dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'listPolicies'>,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/risk-evaluations') {
            const response = await dispatchRoutes(
              riskEvaluationReadRoutes({
                repository: () =>
                  dependencies.risks as Pick<
                    NonNullable<ApiDependencies['risks']>,
                    'listEvaluations'
                  >,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/risk-policies') {
            const response = await dispatchRoutes(
              riskPolicyCreateRoutes({
                repository: () =>
                  dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'createPolicy'>,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, integer, timestamp, array, jsonObject },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const riskPolicyRevision = /^\/api\/v1\/risk-policies\/([0-9a-f-]+)\/versions$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && riskPolicyRevision) {
            const response = await dispatchRoutes(
              riskPolicyRevisionRoutes({
                repository: () =>
                  dependencies.risks as Pick<
                    NonNullable<ApiDependencies['risks']>,
                    'createPolicyVersion'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, integer, timestamp, array, jsonObject },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const riskPolicyPublish =
            /^\/api\/v1\/risk-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
          if (request.method === 'POST' && riskPolicyPublish) {
            const response = await dispatchRoutes(
              riskPolicyPublishRoutes({
                repository: () =>
                  dependencies.risks as Pick<
                    NonNullable<ApiDependencies['risks']>,
                    'publishPolicyVersion'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/risk-evaluations') {
            const response = await dispatchRoutes(
              riskEvaluationCreateRoutes({
                repository: () =>
                  dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'evaluate'>,
                authorization: context,
                authorizeQuery,
                idempotency,
                correlationId,
                parsers: { objectBody, allow, uuid, timestamp },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const riskTaskCommand =
            /^\/api\/v1\/risk-tasks\/([0-9a-f-]+)\/(acknowledge|escalate|close)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && riskTaskCommand) {
            const response = await dispatchRoutes(
              riskTaskCommandRoutes({
                repository: () =>
                  dependencies.risks as Pick<
                    NonNullable<ApiDependencies['risks']>,
                    'transitionTask'
                  >,
                authorization: context,
                authorizeQuery,
                idempotency,
                correlationId,
                parsers: { objectBody, allow, string, jsonObject },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
        }
        const order360Match = /^\/api\/v1\/sales-orders\/([0-9a-f-]+)\/360$/u.exec(
          request.pathname,
        );
        if (request.method === 'GET' && order360Match && dependencies.order360) {
          const response = await dispatchRoutes(
            order360Routes({
              repository: () =>
                dependencies.order360 as Pick<NonNullable<ApiDependencies['order360']>, 'get'>,
              authorization: context,
              authorizeQuery,
              permittedDto,
            }),
            request,
          );
          if (response !== null) return response;
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
        if (dependencies.commissions) {
          if (request.method === 'GET' && request.pathname === '/api/v1/commission-policies') {
            const response = await dispatchRoutes(
              commissionReadRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'listPolicies' | 'listCases'
                  >,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/commissions') {
            const response = await dispatchRoutes(
              commissionReadRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'listPolicies' | 'listCases'
                  >,
                authorization: context,
                authorizeQuery,
                permittedDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/commission-policies') {
            const response = await dispatchRoutes(
              commissionPolicyCreateRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'createPolicy' | 'createPolicyVersion'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, uuid, integer, timestamp, jsonObject, array },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const commissionPolicyRevision =
            /^\/api\/v1\/commission-policies\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
          if (request.method === 'POST' && commissionPolicyRevision) {
            const response = await dispatchRoutes(
              commissionPolicyVersionRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'createPolicy' | 'createPolicyVersion'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, uuid, integer, timestamp, jsonObject, array },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const commissionPolicyPublish =
            /^\/api\/v1\/commission-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && commissionPolicyPublish) {
            const response = await dispatchRoutes(
              commissionPolicyPublishRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'publishPolicyVersion'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/commissions/accrue') {
            const response = await dispatchRoutes(
              commissionAccrueRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'accrue'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, string, uuid, idempotency },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
          const commissionCommand =
            /^\/api\/v1\/commissions\/([0-9a-f-]+)\/(freeze|release|pay|clawback|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && commissionCommand) {
            const response = await dispatchRoutes(
              commissionCommandRoutes({
                repository: () =>
                  dependencies.commissions as Pick<
                    NonNullable<ApiDependencies['commissions']>,
                    'transition'
                  >,
                authorization: context,
                authorizeQuery,
                correlationId,
                parsers: { objectBody, allow, uuid, string, idempotency },
                mutationDto,
              }),
              request,
            );
            if (response !== null) return response;
          }
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
          return {
            statusCode: 200,
            body: {
              items: await dependencies.businessDocuments.listConnectors(
                context.actor,
                canConfigure,
              ),
            },
          };
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
          const b = objectBody(request.body);
          allow(b, [
            'provider',
            'displayName',
            'senderIdentity',
            'secretReference',
            'configuration',
            'status',
            'expectedVersion',
          ]);
          const status = string(b.status, 'status');
          if (!['UNCONFIGURED', 'READY', 'DISABLED'].includes(status))
            throw new DomainError('invalid_request', 'connector status is unsupported');
          const nullableText = (value: unknown, name: string): string | null =>
            value === undefined || value === null || value === '' ? null : string(value, name);
          const secretReference = connectorSecretReference(b.secretReference);
          const senderIdentity = nullableText(b.senderIdentity, 'senderIdentity');
          if (senderIdentity !== null && (senderIdentity.length < 2 || senderIdentity.length > 200))
            throw new DomainError(
              'invalid_request',
              'senderIdentity must contain 2 to 200 characters',
            );
          if (status === 'READY' && secretReference === null)
            throw new DomainError(
              'invalid_request',
              'A managed secret reference is required before a connector can be enabled',
            );
          return {
            statusCode: 200,
            body: await dependencies.businessDocuments.configureConnector(
              documentConnector(connectorConfiguration[1], true),
              {
                provider: connectorProvider(b.provider),
                displayName: boundedString(b.displayName, 'displayName', 100),
                senderIdentity,
                secretReference,
                configuration: safeConnectorConfiguration(b.configuration),
                status: status as 'UNCONFIGURED' | 'READY' | 'DISABLED',
                expectedVersion: expectedVersion(b.expectedVersion),
              },
              context.actor,
              correlationId,
            ),
          };
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
          const q = request.query ?? {};
          const requestedLimit = q.limit === undefined ? undefined : Number(q.limit);
          if (
            requestedLimit !== undefined &&
            (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200)
          )
            throw new DomainError('invalid_request', 'limit must be an integer between 1 and 200');
          return {
            statusCode: 200,
            body: {
              items: await dependencies.businessDocuments.activityLog(context.actor, {
                ...(q.documentId ? { documentId: uuid(q.documentId, 'documentId') } : {}),
                ...(q.actorId ? { actorId: uuid(q.actorId, 'actorId') } : {}),
                ...(requestedLimit === undefined ? {} : { limit: requestedLimit }),
              }),
            },
          };
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
          return {
            statusCode: 200,
            body: {
              items: await dependencies.businessDocuments.list(request.query?.route, {
                actor: context.actor,
                scopes: grant.scopes,
              }),
            },
          };
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
          return {
            statusCode: 200,
            body: await dependencies.businessDocuments.referenceData({
              actor: context.actor,
              scopes: grant.scopes,
            }),
          };
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
          const b = objectBody(request.body);
          allow(b, [
            'templateKey',
            'title',
            'route',
            'subjectType',
            'subjectId',
            'customerId',
            'salesOrderId',
            'operatorId',
            'salespersonId',
            'assignedTo',
            'content',
          ]);
          return {
            statusCode: 201,
            body: await dependencies.businessDocuments.create(
              {
                templateKey: string(b.templateKey, 'templateKey'),
                title: string(b.title, 'title'),
                route: string(b.route, 'route'),
                ...(b.subjectType
                  ? {
                      subjectType: string(b.subjectType, 'subjectType'),
                      subjectId: uuid(b.subjectId, 'subjectId'),
                    }
                  : {}),
                ...(b.customerId ? { customerId: uuid(b.customerId, 'customerId') } : {}),
                ...(b.salesOrderId ? { salesOrderId: uuid(b.salesOrderId, 'salesOrderId') } : {}),
                ...(b.operatorId ? { operatorId: uuid(b.operatorId, 'operatorId') } : {}),
                ...(b.salespersonId
                  ? { salespersonId: uuid(b.salespersonId, 'salespersonId') }
                  : {}),
                ...(b.assignedTo ? { assignedTo: uuid(b.assignedTo, 'assignedTo') } : {}),
                content: jsonObject(b.content, 'content'),
              },
              context.actor,
              correlationId,
            ),
          };
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
          return {
            statusCode: 200,
            body: await dependencies.businessDocuments.get(
              uuid(businessDocument[1], 'documentId'),
              {
                actor: context.actor,
                scopes: grant.scopes,
                includeAudit: context.permissions.has('business-document:audit'),
              },
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['expectedVersion', 'content', 'changeSummary']);
          return {
            statusCode: 201,
            body: await dependencies.businessDocuments.saveVersion(
              uuid(businessDocumentVersion[1], 'documentId'),
              {
                expectedVersion: version(b.expectedVersion),
                content: jsonObject(b.content, 'content'),
                changeSummary: string(b.changeSummary, 'changeSummary'),
              },
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['customerId', 'salesOrderId', 'operatorId', 'salespersonId', 'assignedTo']);
          const nullableUuid = (value: unknown, field: string): string | null | undefined =>
            value === undefined
              ? undefined
              : value === null || value === ''
                ? null
                : uuid(value, field);
          return {
            statusCode: 200,
            body: await dependencies.businessDocuments.updateBindings(
              businessDocumentBindings[1] ?? '',
              {
                customerId: nullableUuid(b.customerId, 'customerId'),
                salesOrderId: nullableUuid(b.salesOrderId, 'salesOrderId'),
                operatorId: nullableUuid(b.operatorId, 'operatorId'),
                salespersonId: nullableUuid(b.salespersonId, 'salespersonId'),
                assignedTo: nullableUuid(b.assignedTo, 'assignedTo'),
              },
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['expectedVersion', 'reason']);
          return {
            statusCode: 201,
            body: await dependencies.businessDocuments.transition(
              uuid(businessDocumentReview[1], 'documentId'),
              {
                expectedVersion: version(b.expectedVersion),
                action,
                reason: string(b.reason, 'reason'),
              },
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['expectedVersion', 'targetLocale', 'content']);
          return {
            statusCode: 201,
            body: await dependencies.businessDocuments.createTranslation(
              uuid(businessDocumentTranslation[1], 'documentId'),
              {
                expectedVersion: version(b.expectedVersion),
                targetLocale: documentLocale(b.targetLocale),
                ...(b.content === undefined ? {} : { content: jsonObject(b.content, 'content') }),
              },
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['action', 'version']);
          const action = string(b.action, 'action');
          if (!['PRINTED', 'DOWNLOADED'].includes(action))
            throw new DomainError('invalid_request', 'document activity is unsupported');
          return {
            statusCode: 201,
            body: await dependencies.businessDocuments.recordClientActivity(
              uuid(businessDocumentActivity[1], 'documentId'),
              action as 'PRINTED' | 'DOWNLOADED',
              version(b.version),
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
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
          const key = request.headers?.['idempotency-key'];
          if (!key || key.length < 8 || key.length > 128)
            throw new DomainError(
              'invalid_request',
              'Idempotency-Key header must contain 8 to 128 characters',
            );
          const b = objectBody(request.body);
          allow(b, [
            'expectedVersion',
            'channel',
            'recipientName',
            'recipientAddress',
            'subject',
            'message',
            'translationId',
          ]);
          const channel = documentConnector(b.channel);
          const rawAddress = boundedString(b.recipientAddress, 'recipientAddress', 320);
          const recipientAddress =
            channel === 'EMAIL' ? normalizeContactEmail(rawAddress) : rawAddress;
          return {
            statusCode: 202,
            body: await dependencies.businessDocuments.dispatch(
              uuid(businessDocumentDispatch[1], 'documentId'),
              {
                expectedVersion: version(b.expectedVersion),
                channel,
                recipientName: boundedString(b.recipientName, 'recipientName', 200),
                recipientAddress,
                subject: boundedString(b.subject, 'subject', 200),
                message: boundedString(b.message, 'message', 4000),
                ...(b.translationId
                  ? { translationId: uuid(b.translationId, 'translationId') }
                  : {}),
                idempotencyKey: key,
              },
              { actor: context.actor, scopes: grant.scopes },
              correlationId,
            ),
          };
        }
        return error(404, 'not_found', 'Route not found', correlationId);
      } catch (cause) {
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
    return { ...response, headers: { ...response.headers, 'x-correlation-id': correlationId } };
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
