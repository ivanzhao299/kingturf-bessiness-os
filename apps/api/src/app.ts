import {
  ORDER360_SOURCE_CAPABILITIES,
  companyReadAllowed,
  fieldReadable,
  projectCollectionLegal,
  type SourceReadGrant,
} from './aggregate-authorization.ts';
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
          const result = await dependencies.websiteLeads.ingest(
            request.body,
            request.headers?.['x-kingturf-timestamp'],
            request.headers?.['x-kingturf-signature'],
            correlationId,
          );
          return { statusCode: result.duplicate ? 200 : 201, body: result };
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
            const grant = authorizeQuery(context, capability);
            const items = await dependencies.manufacturing.list(view, {
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get(capability)?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-items') {
            const body = objectBody(request.body);
            allow(body, [
              'sku',
              'name',
              'itemType',
              'baseUnitCode',
              'specification',
              'effectiveAt',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'manufacturing-item:manage', Object.keys(body));
            const itemType = string(body.itemType, 'itemType');
            if (!['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING'].includes(itemType))
              throw new DomainError('invalid_request', 'itemType is unsupported');
            const result = await dependencies.manufacturing.createItem(
              {
                sku: assertStableCode(string(body.sku, 'sku')),
                name: string(body.name, 'name'),
                itemType,
                baseUnitCode: assertStableCode(string(body.baseUnitCode, 'baseUnitCode')),
                specification: jsonObject(body.specification ?? {}, 'specification'),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                publish: body.publish === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'manufacturing-item:read'),
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-boms') {
            const body = objectBody(request.body);
            allow(body, [
              'code',
              'name',
              'productItemId',
              'productItemVersionId',
              'outputQuantity',
              'effectiveAt',
              'lines',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'bom:manage', Object.keys(body));
            const lines = array(body.lines, 'lines').map((value, index) => {
              const line = jsonObject(value, `lines[${String(index)}]`);
              allow(line, [
                'componentItemVersionId',
                'quantity',
                'scrapBasisPoints',
                'substitutes',
              ]);
              return {
                componentItemVersionId: uuid(
                  line.componentItemVersionId,
                  `lines[${String(index)}].componentItemVersionId`,
                ),
                quantity: decimal(line.quantity, `lines[${String(index)}].quantity`),
                scrapBasisPoints: integer(
                  Object.hasOwn(line, 'scrapBasisPoints') ? line.scrapBasisPoints : 0,
                  `lines[${String(index)}].scrapBasisPoints`,
                  0,
                  10000,
                ),
                substitutes: array(
                  Object.hasOwn(line, 'substitutes') ? line.substitutes : [],
                  `lines[${String(index)}].substitutes`,
                ).map((entry, substituteIndex) => {
                  const substitute = jsonObject(
                    entry,
                    `lines[${String(index)}].substitutes[${String(substituteIndex)}]`,
                  );
                  allow(substitute, ['itemVersionId', 'priority', 'conversionFactor']);
                  return {
                    itemVersionId: uuid(substitute.itemVersionId, 'itemVersionId'),
                    priority: integer(substitute.priority, 'priority', 1, 1000),
                    conversionFactor: decimal(substitute.conversionFactor, 'conversionFactor'),
                  };
                }),
              };
            });
            if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
            const result = await dependencies.manufacturing.createBom(
              {
                code: assertStableCode(string(body.code, 'code')),
                name: string(body.name, 'name'),
                productItemId: uuid(body.productItemId, 'productItemId'),
                productItemVersionId: uuid(body.productItemVersionId, 'productItemVersionId'),
                outputQuantity: decimal(body.outputQuantity, 'outputQuantity'),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                lines,
                publish: body.publish === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'bom:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-routings') {
            const body = objectBody(request.body);
            allow(body, [
              'code',
              'name',
              'productItemId',
              'productItemVersionId',
              'effectiveAt',
              'operations',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'routing:manage', Object.keys(body));
            const operations = array(body.operations, 'operations').map((value, index) => {
              const operation = jsonObject(value, `operations[${String(index)}]`);
              allow(operation, [
                'operationCode',
                'name',
                'workCenterCode',
                'sequence',
                'setupMinutes',
                'runMinutesPerUnit',
                'instructions',
              ]);
              return {
                operationCode: assertStableCode(string(operation.operationCode, 'operationCode')),
                name: string(operation.name, 'name'),
                workCenterCode: assertStableCode(
                  string(operation.workCenterCode, 'workCenterCode'),
                ),
                sequence: integer(operation.sequence, 'sequence', 1, 100000),
                setupMinutes: decimal(operation.setupMinutes, 'setupMinutes'),
                runMinutesPerUnit: decimal(operation.runMinutesPerUnit, 'runMinutesPerUnit'),
                instructions: jsonObject(
                  Object.hasOwn(operation, 'instructions') ? operation.instructions : {},
                  'instructions',
                ),
              };
            });
            if (!operations.length)
              throw new DomainError('invalid_request', 'operations must not be empty');
            const result = await dependencies.manufacturing.createRouting(
              {
                code: assertStableCode(string(body.code, 'code')),
                name: string(body.name, 'name'),
                productItemId: uuid(body.productItemId, 'productItemId'),
                productItemVersionId: uuid(body.productItemVersionId, 'productItemVersionId'),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                operations,
                publish: body.publish === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'routing:read') };
          }
          const manufacturingPublish =
            /^\/api\/v1\/manufacturing-(item|bom|routing)-versions\/([0-9a-f-]+)\/publish$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && manufacturingPublish) {
            allow(objectBody(request.body ?? {}), []);
            const kind = manufacturingPublish[1] as 'item' | 'bom' | 'routing';
            const capability =
              `${kind === 'item' ? 'manufacturing-item' : kind}:manage` as PermissionKey;
            const grant = authorizeQuery(context, capability);
            const result = await dependencies.manufacturing.publish(
              kind,
              uuid(manufacturingPublish[2], 'versionId'),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            const readCapability =
              `${kind === 'item' ? 'manufacturing-item' : kind}:read` as PermissionKey;
            return { statusCode: 201, body: mutationDto(result, context, readCapability) };
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
            const grant = authorizeQuery(context, effectiveCapability);
            const items = await dependencies.procurement.list(view, {
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get(effectiveCapability)?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/suppliers') {
            const body = objectBody(request.body);
            allow(body, [
              'supplierNumber',
              'name',
              'currency',
              'paymentTermsDays',
              'qualityRatingBasisPoints',
              'contact',
            ]);
            const grant = authorizeQuery(context, 'supplier:manage', Object.keys(body));
            const result = await dependencies.procurement.createSupplier(
              {
                supplierNumber: assertStableCode(string(body.supplierNumber, 'supplierNumber')),
                name: string(body.name, 'name'),
                currency: currency(body.currency),
                paymentTermsDays: integer(body.paymentTermsDays, 'paymentTermsDays', 0, 3650),
                qualityRatingBasisPoints:
                  body.qualityRatingBasisPoints === null ||
                  body.qualityRatingBasisPoints === undefined
                    ? null
                    : integer(body.qualityRatingBasisPoints, 'qualityRatingBasisPoints', 0, 10000),
                contact: jsonObject(body.contact ?? {}, 'contact'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'supplier:read') };
          }
          const qualification = /^\/api\/v1\/suppliers\/([0-9a-f-]+)\/qualifications$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && qualification) {
            const body = objectBody(request.body);
            allow(body, [
              'itemVersionId',
              'status',
              'validFrom',
              'validTo',
              'minimumOrderQuantity',
              'leadTimeDays',
              'evidence',
            ]);
            const grant = authorizeQuery(context, 'supplier:manage', Object.keys(body));
            const status = string(body.status, 'status');
            if (!['APPROVED', 'CONDITIONAL', 'REJECTED'].includes(status))
              throw new DomainError('invalid_request', 'qualification status is unsupported');
            const result = await dependencies.procurement.qualifySupplier(
              uuid(qualification[1], 'supplierId'),
              {
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                status,
                validFrom: calendarDate(body.validFrom, 'validFrom'),
                validTo:
                  body.validTo === null || body.validTo === undefined
                    ? null
                    : calendarDate(body.validTo, 'validTo'),
                minimumOrderQuantity: decimal(body.minimumOrderQuantity, 'minimumOrderQuantity'),
                leadTimeDays: integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'supplier:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/procurement-rfqs') {
            const body = objectBody(request.body);
            allow(body, ['rfqNumber', 'responseDueAt', 'currency', 'lines', 'issue']);
            const grant = authorizeQuery(context, 'procurement:manage', Object.keys(body));
            const lines = array(body.lines, 'lines').map((entry, index) => {
              const line = jsonObject(entry, `lines[${String(index)}]`);
              allow(line, ['itemVersionId', 'quantity', 'requiredAt']);
              return {
                itemVersionId: uuid(line.itemVersionId, 'itemVersionId'),
                quantity: decimal(line.quantity, 'quantity'),
                requiredAt: calendarDate(line.requiredAt, 'requiredAt'),
              };
            });
            if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
            const result = await dependencies.procurement.createRfq(
              {
                rfqNumber: assertStableCode(string(body.rfqNumber, 'rfqNumber')),
                responseDueAt: timestamp(body.responseDueAt, 'responseDueAt'),
                currency: currency(body.currency),
                lines,
                issue: body.issue === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'procurement:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/supplier-quotes') {
            const body = objectBody(request.body);
            allow(body, [
              'rfqId',
              'supplierId',
              'quoteReference',
              'receivedAt',
              'validUntil',
              'terms',
              'lines',
            ]);
            const grant = authorizeQuery(context, 'procurement:manage', Object.keys(body));
            const lines = array(body.lines, 'lines').map((entry, index) => {
              const line = jsonObject(entry, `lines[${String(index)}]`);
              allow(line, ['rfqLineId', 'unitPrice', 'promisedAt', 'minimumOrderQuantity']);
              return {
                rfqLineId: uuid(line.rfqLineId, 'rfqLineId'),
                unitPrice: decimal(line.unitPrice, 'unitPrice'),
                promisedAt: calendarDate(line.promisedAt, 'promisedAt'),
                minimumOrderQuantity: decimal(line.minimumOrderQuantity, 'minimumOrderQuantity'),
              };
            });
            if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
            const result = await dependencies.procurement.createSupplierQuote(
              {
                rfqId: uuid(body.rfqId, 'rfqId'),
                supplierId: uuid(body.supplierId, 'supplierId'),
                quoteReference: string(body.quoteReference, 'quoteReference'),
                receivedAt: timestamp(body.receivedAt, 'receivedAt'),
                validUntil: calendarDate(body.validUntil, 'validUntil'),
                terms: jsonObject(body.terms ?? {}, 'terms'),
                lines,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'procurement:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/purchase-orders') {
            const body = objectBody(request.body);
            allow(body, [
              'poNumber',
              'supplierId',
              'supplierQuoteId',
              'currency',
              'lines',
              'issue',
            ]);
            const grant = authorizeQuery(context, 'procurement:manage', Object.keys(body));
            const lines = array(body.lines, 'lines').map((entry, index) => {
              const line = jsonObject(entry, `lines[${String(index)}]`);
              allow(line, ['itemVersionId', 'quantity', 'unitPrice', 'requiredAt']);
              return {
                itemVersionId: uuid(line.itemVersionId, 'itemVersionId'),
                quantity: decimal(line.quantity, 'quantity'),
                unitPrice: decimal(line.unitPrice, 'unitPrice'),
                requiredAt: calendarDate(line.requiredAt, 'requiredAt'),
              };
            });
            if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
            const result = await dependencies.procurement.createPurchaseOrder(
              {
                poNumber: assertStableCode(string(body.poNumber, 'poNumber')),
                supplierId: uuid(body.supplierId, 'supplierId'),
                supplierQuoteId:
                  body.supplierQuoteId === null || body.supplierQuoteId === undefined
                    ? null
                    : uuid(body.supplierQuoteId, 'supplierQuoteId'),
                currency: currency(body.currency),
                lines,
                issue: body.issue === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'procurement:read') };
          }
          const procurementIssue =
            /^\/api\/v1\/(procurement-rfqs|purchase-orders)\/([0-9a-f-]+)\/issue$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && procurementIssue) {
            allow(objectBody(request.body ?? {}), []);
            const grant = authorizeQuery(context, 'procurement:manage');
            const id = uuid(procurementIssue[2], 'documentId');
            const result =
              procurementIssue[1] === 'procurement-rfqs'
                ? await dependencies.procurement.issueRfq(
                    id,
                    { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
                    correlationId,
                  )
                : await dependencies.procurement.issuePurchaseOrder(
                    id,
                    { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
                    correlationId,
                  );
            return { statusCode: 201, body: mutationDto(result, context, 'procurement:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/inventory-locations') {
            const body = objectBody(request.body);
            allow(body, ['code', 'name', 'locationType']);
            const grant = authorizeQuery(context, 'inventory:move', Object.keys(body));
            const locationType = string(body.locationType, 'locationType');
            if (
              !['RECEIVING', 'STORAGE', 'PRODUCTION', 'QUARANTINE', 'SHIPPING'].includes(
                locationType,
              )
            )
              throw new DomainError('invalid_request', 'locationType is unsupported');
            const result = await dependencies.procurement.createLocation(
              {
                code: assertStableCode(string(body.code, 'code')),
                name: string(body.name, 'name'),
                locationType,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'inventory:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/goods-receipts') {
            const body = objectBody(request.body);
            allow(body, [
              'receiptNumber',
              'purchaseOrderId',
              'receivedAt',
              'sourceReference',
              'lines',
            ]);
            const grant = authorizeQuery(context, 'procurement:manage', Object.keys(body));
            const lines = array(body.lines, 'lines').map((entry, index) => {
              const line = jsonObject(entry, `lines[${String(index)}]`);
              allow(line, [
                'purchaseOrderLineId',
                'lotNumber',
                'locationCode',
                'quantity',
                'manufacturedAt',
                'expiresAt',
              ]);
              return {
                purchaseOrderLineId: uuid(line.purchaseOrderLineId, 'purchaseOrderLineId'),
                lotNumber: assertStableCode(string(line.lotNumber, 'lotNumber')),
                locationCode: assertStableCode(string(line.locationCode, 'locationCode')),
                quantity: decimal(line.quantity, 'quantity'),
                manufacturedAt: optionalCalendarDate(
                  Object.hasOwn(line, 'manufacturedAt') ? line.manufacturedAt : null,
                  'manufacturedAt',
                ),
                expiresAt: optionalCalendarDate(
                  Object.hasOwn(line, 'expiresAt') ? line.expiresAt : null,
                  'expiresAt',
                ),
              };
            });
            if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
            const result = await dependencies.procurement.receive(
              {
                receiptNumber: assertStableCode(string(body.receiptNumber, 'receiptNumber')),
                purchaseOrderId: uuid(body.purchaseOrderId, 'purchaseOrderId'),
                receivedAt: timestamp(body.receivedAt, 'receivedAt'),
                sourceReference: string(body.sourceReference, 'sourceReference'),
                lines,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'procurement:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/inventory-movements') {
            const body = objectBody(request.body);
            allow(body, [
              'movementType',
              'itemVersionId',
              'lotId',
              'locationId',
              'quantity',
              'occurredAt',
              'sourceType',
              'sourceId',
            ]);
            const grant = authorizeQuery(context, 'inventory:move', Object.keys(body));
            const movementType = string(body.movementType, 'movementType');
            if (
              ![
                'ISSUE',
                'RETURN',
                'TRANSFER_IN',
                'TRANSFER_OUT',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
              ].includes(movementType)
            )
              throw new DomainError('invalid_request', 'movementType is unsupported');
            const result = await dependencies.procurement.move(
              {
                movementType: movementType as
                  | 'ISSUE'
                  | 'RETURN'
                  | 'TRANSFER_IN'
                  | 'TRANSFER_OUT'
                  | 'ADJUSTMENT_IN'
                  | 'ADJUSTMENT_OUT',
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                lotId: uuid(body.lotId, 'lotId'),
                locationId: uuid(body.locationId, 'locationId'),
                quantity: decimal(body.quantity, 'quantity'),
                occurredAt: timestamp(body.occurredAt, 'occurredAt'),
                sourceType: assertStableCode(string(body.sourceType, 'sourceType')),
                sourceId: uuid(body.sourceId, 'sourceId'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'inventory:read') };
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
            const grant = authorizeQuery(context, capability);
            const items = await dependencies.mrp.list(view, {
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get(capability)?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-policies') {
            const body = objectBody(request.body);
            allow(body, [
              'itemVersionId',
              'safetyStock',
              'minimumOrderQuantity',
              'orderMultiple',
              'leadTimeDays',
              'freezeWindowDays',
              'makeOrBuy',
              'effectiveAt',
            ]);
            const grant = authorizeQuery(context, 'mrp-policy:manage', Object.keys(body));
            const makeOrBuy = string(body.makeOrBuy, 'makeOrBuy');
            if (!['MAKE', 'BUY'].includes(makeOrBuy))
              throw new DomainError('invalid_request', 'makeOrBuy is unsupported');
            const result = await dependencies.mrp.createPolicy(
              {
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                safetyStock: decimal(body.safetyStock, 'safetyStock'),
                minimumOrderQuantity: decimal(body.minimumOrderQuantity, 'minimumOrderQuantity'),
                orderMultiple: decimal(body.orderMultiple, 'orderMultiple'),
                leadTimeDays: integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
                freezeWindowDays: integer(body.freezeWindowDays, 'freezeWindowDays', 0, 3650),
                makeOrBuy: makeOrBuy as 'MAKE' | 'BUY',
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'mrp-policy:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-demands') {
            const body = objectBody(request.body);
            allow(body, [
              'itemVersionId',
              'sourceType',
              'sourceId',
              'requiredAt',
              'quantity',
              'priority',
            ]);
            const grant = authorizeQuery(context, 'mrp:run', Object.keys(body));
            const result = await dependencies.mrp.createDemand(
              {
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                sourceType: assertStableCode(string(body.sourceType, 'sourceType')),
                sourceId: uuid(body.sourceId, 'sourceId'),
                requiredAt: calendarDate(body.requiredAt, 'requiredAt'),
                quantity: decimal(body.quantity, 'quantity'),
                priority: integer(body.priority ?? 100, 'priority', 1, 100000),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'mrp:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/mrp-runs') {
            const body = objectBody(request.body);
            allow(body, ['runNumber', 'asOf', 'horizonEnd']);
            const grant = authorizeQuery(context, 'mrp:run', Object.keys(body));
            const result = await dependencies.mrp.run(
              {
                runNumber: assertStableCode(string(body.runNumber, 'runNumber')),
                asOf: timestamp(body.asOf, 'asOf'),
                horizonEnd: calendarDate(body.horizonEnd, 'horizonEnd'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'mrp:read') };
          }
          const proposalCommand =
            /^\/api\/v1\/mrp-proposals\/([0-9a-f-]+)\/(approve|reject|release|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && proposalCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence']);
            const action = proposalCommand[2] as 'approve' | 'reject' | 'release' | 'cancel';
            const capability = action === 'release' ? 'mrp:release' : 'mrp:approve';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const states = {
              approve: 'APPROVED',
              reject: 'REJECTED',
              release: 'RELEASED',
              cancel: 'CANCELLED',
            } as const;
            const result = await dependencies.mrp.transitionProposal(
              uuid(proposalCommand[1], 'proposalId'),
              states[action],
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'mrp:read') };
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
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'manufacturing-cost:approve', Object.keys(body));
            const result = await dependencies.productionCosts.decide(
              uuid(costDecision[1], 'costRunId'),
              costDecision[2] === 'approve' ? 'APPROVED' : 'REJECTED',
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'manufacturing-cost:read'),
            };
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
            const grant = authorizeQuery(context, capability);
            const items = await dependencies.quality.list(view, {
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get(capability)?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/quality-plans') {
            const body = objectBody(request.body);
            allow(body, [
              'code',
              'name',
              'itemVersionId',
              'inspectionStage',
              'samplingMethod',
              'acceptanceRule',
              'effectiveAt',
              'characteristics',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'quality-plan:manage', Object.keys(body));
            const stage = string(body.inspectionStage, 'inspectionStage');
            if (!['INCOMING', 'IN_PROCESS', 'FINAL'].includes(stage))
              throw new DomainError('invalid_request', 'inspectionStage is unsupported');
            const characteristics = array(body.characteristics, 'characteristics').map(
              (entry, index) => {
                const item = objectBody(entry);
                allow(item, [
                  'code',
                  'name',
                  'dataType',
                  'unitCode',
                  'lowerLimit',
                  'upperLimit',
                  'required',
                  'instructions',
                ]);
                const dataType = string(
                  item.dataType,
                  `characteristics[${String(index)}].dataType`,
                );
                if (!['NUMERIC', 'BOOLEAN', 'TEXT'].includes(dataType))
                  throw new DomainError(
                    'invalid_request',
                    'characteristic dataType is unsupported',
                  );
                if (typeof item.required !== 'boolean')
                  throw new DomainError(
                    'invalid_request',
                    'characteristic required must be boolean',
                  );
                return {
                  code: assertStableCode(string(item.code, 'code')),
                  name: string(item.name, 'name'),
                  dataType: dataType as 'NUMERIC' | 'BOOLEAN' | 'TEXT',
                  ...(item.unitCode === undefined
                    ? {}
                    : { unitCode: string(item.unitCode, 'unitCode') }),
                  ...(item.lowerLimit === undefined
                    ? {}
                    : { lowerLimit: decimal(item.lowerLimit, 'lowerLimit', false) }),
                  ...(item.upperLimit === undefined
                    ? {}
                    : { upperLimit: decimal(item.upperLimit, 'upperLimit', false) }),
                  required: item.required,
                  instructions: string(item.instructions, 'instructions'),
                };
              },
            );
            if (typeof body.publish !== 'boolean')
              throw new DomainError('invalid_request', 'publish must be boolean');
            const result = await dependencies.quality.createPlan(
              {
                code: assertStableCode(string(body.code, 'code')),
                name: string(body.name, 'name'),
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                inspectionStage: stage as 'INCOMING' | 'IN_PROCESS' | 'FINAL',
                samplingMethod: string(body.samplingMethod, 'samplingMethod'),
                acceptanceRule: jsonObject(body.acceptanceRule, 'acceptanceRule'),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                characteristics,
                publish: body.publish,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'quality-plan:read') };
          }
          const planPublish = /^\/api\/v1\/quality-plans\/([0-9a-f-]+)\/publish$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && planPublish) {
            const grant = authorizeQuery(context, 'quality-plan:manage');
            const result = await dependencies.quality.publishPlan(
              uuid(planPublish[1], 'planVersionId'),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'quality-plan:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/quality-inspections') {
            const body = objectBody(request.body);
            allow(body, [
              'inspectionNumber',
              'planVersionId',
              'lotId',
              'sourceType',
              'sourceId',
              'sampleSize',
            ]);
            const grant = authorizeQuery(context, 'quality:inspect', Object.keys(body));
            const result = await dependencies.quality.openInspection(
              {
                inspectionNumber: assertStableCode(
                  string(body.inspectionNumber, 'inspectionNumber'),
                ),
                planVersionId: uuid(body.planVersionId, 'planVersionId'),
                lotId: uuid(body.lotId, 'lotId'),
                sourceType: assertStableCode(string(body.sourceType, 'sourceType')),
                sourceId: uuid(body.sourceId, 'sourceId'),
                sampleSize: decimal(body.sampleSize, 'sampleSize'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'quality:read') };
          }
          const inspectionCommand =
            /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(sample|complete|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && inspectionCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'quality:inspect', Object.keys(body));
            const states = {
              sample: 'SAMPLED',
              complete: 'COMPLETED',
              cancel: 'CANCELLED',
            } as const;
            const action = inspectionCommand[2] as keyof typeof states;
            const result = await dependencies.quality.transitionInspection(
              uuid(inspectionCommand[1], 'inspectionId'),
              states[action],
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
          const grant = authorizeQuery(context, 'executive-dashboard:read');
          const from = timestamp(request.query?.from, 'from');
          const to = timestamp(request.query?.to, 'to');
          if (new Date(from).getTime() >= new Date(to).getTime())
            throw new DomainError('invalid_request', 'from must be before to');
          const aggregate = (await dependencies.dashboard.get(
            { from, to, currency: currency(request.query?.currency) },
            { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
          )) as Record<string, unknown>;
          const metrics = aggregate.metrics as Record<string, unknown>;
          const metricCapabilities = {
            weightedForecast: 'opportunity:read',
            bookedRevenue: 'sales-order:read',
            grossMargin: 'quote:read',
            cashCollected: 'reconciliation:read',
            openReceivable: 'ar:read',
            overdueReceivable: 'ar:read',
            releasedOrders: 'sales-order:read',
            activeRisks: 'risk:read',
            criticalRisks: 'risk:read',
            commissionAccrued: 'commission:read',
          } as const satisfies Record<string, PermissionKey>;
          const visibleMetrics = Object.fromEntries(
            Object.entries(metricCapabilities)
              .filter(([, capability]) => context.permissions.has(capability))
              .map(([key]) => [key, metrics[key]]),
          );
          const drilldowns = aggregate.drilldowns as Record<string, unknown>;
          return {
            statusCode: 200,
            body: {
              filters: aggregate.filters,
              refreshedAt: aggregate.refreshedAt,
              metrics: visibleMetrics,
              drilldowns: {
                ...(context.permissions.has('sales-order:read')
                  ? { orders: drilldowns.orders }
                  : {}),
                ...(context.permissions.has('ar:read') ? { overdue: drilldowns.overdue } : {}),
                ...(context.permissions.has('risk:read') ? { risks: drilldowns.risks } : {}),
              },
            },
          };
        }
        if (dependencies.risks) {
          if (request.method === 'GET' && request.pathname === '/api/v1/risk-policies') {
            const grant = authorizeQuery(context, 'risk-policy:read');
            return {
              statusCode: 200,
              body: {
                items: (
                  await dependencies.risks.listPolicies({
                    actor: context.actor,
                    scopes: grant.scopes,
                    anchors: grant.anchors,
                  })
                ).map((item) =>
                  permittedDto(item, context.permissions.get('risk-policy:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/risk-evaluations') {
            const grant = authorizeQuery(context, 'risk:read');
            return {
              statusCode: 200,
              body: {
                items: (
                  await dependencies.risks.listEvaluations({
                    actor: context.actor,
                    scopes: grant.scopes,
                    anchors: grant.anchors,
                  })
                ).map((item) =>
                  permittedDto(item, context.permissions.get('risk:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/risk-policies') {
            const body = objectBody(request.body);
            allow(body, [
              'code',
              'name',
              'minimumMarginBasisPoints',
              'overdueGraceDays',
              'creditWarningDays',
              'effectiveAt',
              'rules',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'risk-policy:manage', Object.keys(body));
            const result = await dependencies.risks.createPolicy(
              {
                code: string(body.code, 'code'),
                name: string(body.name, 'name'),
                minimumMarginBasisPoints: integer(
                  body.minimumMarginBasisPoints,
                  'minimumMarginBasisPoints',
                  -100000,
                  10000,
                ),
                overdueGraceDays: integer(body.overdueGraceDays, 'overdueGraceDays', 0, 3650),
                creditWarningDays: integer(body.creditWarningDays, 'creditWarningDays', 0, 3650),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                rules: array(body.rules, 'rules').map((rule, index) =>
                  jsonObject(rule, `rules[${String(index)}]`),
                ),
                publish: body.publish === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'risk-policy:read') };
          }
          const riskPolicyRevision = /^\/api\/v1\/risk-policies\/([0-9a-f-]+)\/versions$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && riskPolicyRevision) {
            const body = objectBody(request.body);
            allow(body, [
              'minimumMarginBasisPoints',
              'overdueGraceDays',
              'creditWarningDays',
              'effectiveAt',
              'rules',
            ]);
            const policyId = riskPolicyRevision[1];
            if (!policyId) throw new DomainError('invalid_request', 'riskPolicyId is required');
            const grant = authorizeQuery(context, 'risk-policy:manage', Object.keys(body));
            const result = await dependencies.risks.createPolicyVersion(
              policyId,
              {
                minimumMarginBasisPoints: integer(
                  body.minimumMarginBasisPoints,
                  'minimumMarginBasisPoints',
                  -100000,
                  10000,
                ),
                overdueGraceDays: integer(body.overdueGraceDays, 'overdueGraceDays', 0, 3650),
                creditWarningDays: integer(body.creditWarningDays, 'creditWarningDays', 0, 3650),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                rules: array(body.rules, 'rules').map((rule, index) =>
                  jsonObject(rule, `rules[${String(index)}]`),
                ),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'risk-policy:read') };
          }
          const riskPolicyPublish =
            /^\/api\/v1\/risk-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
          if (request.method === 'POST' && riskPolicyPublish) {
            const body = objectBody(request.body);
            allow(body, []);
            const versionId = riskPolicyPublish[1];
            if (!versionId)
              throw new DomainError('invalid_request', 'riskPolicyVersionId is required');
            const grant = authorizeQuery(context, 'risk-policy:manage');
            const result = await dependencies.risks.publishPolicyVersion(
              versionId,
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 200, body: mutationDto(result, context, 'risk-policy:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/risk-evaluations') {
            const body = objectBody(request.body);
            allow(body, [
              'salesOrderId',
              'policyVersionId',
              'assigneeEmployeeId',
              'validUntil',
              'dueAt',
            ]);
            const grant = authorizeQuery(context, 'risk:evaluate', Object.keys(body));
            const result = await dependencies.risks.evaluate(
              {
                salesOrderId: uuid(body.salesOrderId, 'salesOrderId'),
                policyVersionId: uuid(body.policyVersionId, 'policyVersionId'),
                assigneeEmployeeId: uuid(body.assigneeEmployeeId, 'assigneeEmployeeId'),
                validUntil: timestamp(body.validUntil, 'validUntil'),
                dueAt: timestamp(body.dueAt, 'dueAt'),
              },
              idempotency(request),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'risk:read') };
          }
          const riskTaskCommand =
            /^\/api\/v1\/risk-tasks\/([0-9a-f-]+)\/(acknowledge|escalate|close)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && riskTaskCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence']);
            const grant = authorizeQuery(context, 'risk:manage', Object.keys(body));
            const state = (
              { acknowledge: 'ACKNOWLEDGED', escalate: 'ESCALATED', close: 'CLOSED' } as const
            )[riskTaskCommand[2] as 'acknowledge' | 'escalate' | 'close'];
            const taskId = riskTaskCommand[1];
            if (!taskId) throw new DomainError('invalid_request', 'riskTaskId is required');
            const result = await dependencies.risks.transitionTask(
              taskId,
              {
                state,
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence, 'evidence'),
              },
              idempotency(request),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'risk:read') };
          }
        }
        const order360Match = /^\/api\/v1\/sales-orders\/([0-9a-f-]+)\/360$/u.exec(
          request.pathname,
        );
        if (request.method === 'GET' && order360Match && dependencies.order360) {
          const orderId = order360Match[1];
          if (!orderId) throw new DomainError('invalid_request', 'salesOrderId is required');
          const entryGrant = authorizeQuery(context, 'order-360:read');
          const orderGrant = authorizeQuery(context, 'sales-order:read');
          const sources: Partial<
            Record<keyof typeof ORDER360_SOURCE_CAPABILITIES, SourceReadGrant>
          > = {};
          for (const [name, capability] of Object.entries(ORDER360_SOURCE_CAPABILITIES)) {
            if (!context.permissions.has(capability)) continue;
            const grant = authorizeQuery(context, capability);
            sources[name as keyof typeof ORDER360_SOURCE_CAPABILITIES] = {
              scopes: grant.scopes,
              anchors: grant.anchors,
              fields: context.permissions.get(capability)?.fields ?? null,
            };
          }
          const aggregate = (await dependencies.order360.get(orderId, {
            actor: context.actor,
            scopes: orderGrant.scopes,
            anchors: orderGrant.anchors,
            sources,
            entry: {
              scopes: entryGrant.scopes,
              anchors: entryGrant.anchors,
              fields: context.permissions.get('order-360:read')?.fields ?? null,
            },
          })) as Record<string, unknown>;
          const body: Record<string, unknown> = {
            order: permittedDto(
              aggregate.order as Record<string, unknown>,
              context.permissions.get('sales-order:read')?.fields ?? null,
            ),
            anomalies: aggregate.anomalies,
          };
          for (const [section, capability] of Object.entries(ORDER360_SOURCE_CAPABILITIES)) {
            const grant = context.permissions.get(capability);
            if (!grant || section === 'legal') continue;
            const value = aggregate[section];
            body[section] = Array.isArray(value)
              ? value.map((item) =>
                  permittedDto(
                    section === 'collections'
                      ? projectCollectionLegal(item as Record<string, unknown>, sources.legal)
                      : (item as Record<string, unknown>),
                    grant.fields,
                  ),
                )
              : value === null
                ? null
                : permittedDto(value as Record<string, unknown>, grant.fields);
          }
          const timelineCapability = (type: string): PermissionKey | null => {
            if (type.startsWith('QUOTE_')) return 'quote:read';
            if (type.startsWith('CREDIT_')) return 'credit:read';
            if (type.startsWith('CONTRACT_')) return 'contract:read';
            if (type.startsWith('AR_')) return 'ar:read';
            if (type.startsWith('PAYMENT_')) return 'bank-payment:read';
            if (type.startsWith('COMMISSION_')) return 'commission:read';
            if (type.startsWith('RISK_')) return 'risk:read';
            if (type.startsWith('SHIPMENT_')) return 'shipment:read';
            if (type.startsWith('COLLECTION_LEGAL_')) return 'legal-case:read';
            if (type.startsWith('COLLECTION_')) return 'collection:read';
            if (type.startsWith('LEGAL_HANDOFF_') || type.startsWith('DEBT_EVIDENCE_'))
              return 'legal-case:read';
            if (type.startsWith('OPPORTUNITY_')) return 'opportunity:read';
            return type === 'ORDER_RELEASED' ? 'sales-order:read' : null;
          };
          body.timeline = (aggregate.timeline as Record<string, unknown>[]).flatMap((event) => {
            const type = typeof event.type === 'string' ? event.type : '';
            const capability = timelineCapability(type);
            if (capability === null) return [];
            const read = context.permissions.get(capability);
            if (!read) return [];
            const legalNested =
              type.startsWith('LEGAL_HANDOFF_') ||
              type.startsWith('DEBT_EVIDENCE_') ||
              type.startsWith('COLLECTION_LEGAL_');
            if (
              legalNested &&
              !fieldReadable(
                sources.collections,
                type.startsWith('COLLECTION_LEGAL_') ? 'events' : 'legalHandoffs',
              )
            )
              return [];
            if (read.fields === null) return [event];
            const stateFields = type.startsWith('COLLECTION_')
              ? ['event_type', 'state']
              : ['state'];
            const carriesState = [
              'LEGAL_HANDOFF_',
              'DEBT_EVIDENCE_',
              'COMMISSION_',
              'RISK_TASK_',
              'SHIPMENT_RELEASE_',
              'SHIPMENT_',
              'COLLECTION_',
            ].some((prefix) => type.startsWith(prefix));
            if (carriesState && !stateFields.some((name) => read.fields?.includes(name))) return [];
            const labelFields: Record<string, readonly string[]> = {
              OPPORTUNITY_CREATED: ['name'],
              QUOTE_ISSUED: ['quoteNumber', 'quote_number'],
              CREDIT_DECIDED: ['effectiveStatus', 'effective_status'],
              CONTRACT_SIGNED: ['contractNumber', 'contract_number'],
              ORDER_RELEASED: ['order_number', 'orderNumber'],
              AR_POSTED: ['documentNumber', 'document_number'],
              PAYMENT_RECEIVED: ['bank_reference', 'bankReference'],
              COLLECTION_FOLLOWUP: ['outcome'],
            };
            const fields =
              labelFields[type] ??
              (type.startsWith('DEBT_EVIDENCE_')
                ? ['package_number']
                : type.startsWith('SHIPMENT_') && !type.startsWith('SHIPMENT_RELEASE_')
                  ? ['tracking_number']
                  : ['reason']);
            const grant = { scopes: read.scopes, anchors: [], fields: read.fields };
            const labelAllowed =
              type === 'RISK_EVALUATED'
                ? fieldReadable(grant, 'severity') && fieldReadable(grant, 'score')
                : fieldReadable(grant, ...fields);
            // Flat source allowlists cannot safely describe joined/coalesced event timestamps.
            return [permittedDto(event, ['type', 'subjectId', ...(labelAllowed ? ['label'] : [])])];
          });
          return {
            statusCode: 200,
            body: permittedDto(body, context.permissions.get('order-360:read')?.fields ?? null),
          };
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
          const grant = authorizeQuery(context, qtcRead[0]);
          if (qtcRead[1] === 'ar' || qtcRead[1] === 'payments') {
            const query = request.query ?? {};
            const state = query.state;
            if (state && !['OPEN', 'CLEARED', 'OVERDUE'].includes(state))
              throw new DomainError('invalid_request', 'state is unsupported');
            const minimum = query.minAmount ? decimal(query.minAmount, 'minAmount') : undefined;
            const maximum = query.maxAmount ? decimal(query.maxAmount, 'maxAmount') : undefined;
            if (minimum && maximum && Number(minimum) > Number(maximum))
              throw new DomainError('invalid_request', 'minAmount must not exceed maxAmount');
            const page = await dependencies.quoteToCash.listOperationalPage(
              qtcRead[1],
              {
                limit: query.limit ? integer(Number(query.limit), 'limit', 1, 100) : 50,
                ...(query.cursor ? { cursor: uuid(query.cursor, 'cursor') } : {}),
                ...(query.query ? { query: string(query.query, 'query') } : {}),
                ...(query.from ? { from: timestamp(query.from, 'from') } : {}),
                ...(query.to ? { to: timestamp(query.to, 'to') } : {}),
                ...(minimum ? { minAmount: minimum } : {}),
                ...(maximum ? { maxAmount: maximum } : {}),
                ...(state ? { state: state as 'OPEN' | 'CLEARED' | 'OVERDUE' } : {}),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
            );
            return {
              statusCode: 200,
              body: {
                items: page.items.map((item) =>
                  permittedDto(item, context.permissions.get(qtcRead[0])?.fields ?? null),
                ),
                nextCursor: page.nextCursor,
              },
            };
          }
          return {
            statusCode: 200,
            body: {
              items: (
                await dependencies.quoteToCash.list(qtcRead[1], {
                  actor: context.actor,
                  scopes: grant.scopes,
                  anchors: grant.anchors,
                })
              ).map((item) =>
                permittedDto(item, context.permissions.get(qtcRead[0])?.fields ?? null),
              ),
            },
          };
        }
        if (request.method === 'POST' && dependencies.quoteToCash) {
          const body = objectBody(request.body),
            ctx = (capability: PermissionKey) => {
              const grant = authorizeQuery(context, capability, Object.keys(body));
              return { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors };
            };
          if (request.pathname === '/api/v1/credit-limits') {
            allow(body, ['customerId', 'currency', 'amount', 'effectiveAt', 'expiresAt']);
            const result = await dependencies.quoteToCash.setCreditLimit(
              {
                customerId: uuid(body.customerId, 'customerId'),
                currency: currency(body.currency),
                amount: decimal(body.amount, 'amount'),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                expiresAt: timestamp(body.expiresAt, 'expiresAt'),
              },
              idempotency(request),
              ctx('credit:approve'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'credit:read') };
          }
          if (request.pathname === '/api/v1/credit-decisions') {
            allow(body, [
              'customerId',
              'quoteRevisionId',
              'quoteSnapshotId',
              'creditLimitId',
              'validUntil',
            ]);
            const result = await dependencies.quoteToCash.evaluateCredit(
              {
                customerId: uuid(body.customerId, 'customerId'),
                quoteRevisionId: uuid(body.quoteRevisionId, 'quoteRevisionId'),
                quoteSnapshotId: uuid(body.quoteSnapshotId, 'quoteSnapshotId'),
                creditLimitId: uuid(body.creditLimitId, 'creditLimitId'),
                validUntil: timestamp(body.validUntil, 'validUntil'),
              },
              idempotency(request),
              ctx('credit:evaluate'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'credit:read') };
          }
          const creditApproval = /^\/api\/v1\/credit-decisions\/([0-9a-f-]+)\/approve$/u.exec(
            request.pathname,
          );
          if (creditApproval) {
            allow(body, ['decision', 'reason']);
            const d = string(body.decision, 'decision');
            if (!['APPROVED', 'REJECTED'].includes(d))
              throw new DomainError('invalid_request', 'decision is unsupported');
            const result = await dependencies.quoteToCash.approveCredit(
              uuid(creditApproval[1], 'creditDecisionId'),
              d as 'APPROVED' | 'REJECTED',
              string(body.reason, 'reason'),
              idempotency(request),
              ctx('credit:approve'),
              correlationId,
            );
            return { statusCode: 200, body: mutationDto(result, context, 'credit:read') };
          }
          if (request.pathname === '/api/v1/contracts') {
            allow(body, [
              'customerId',
              'opportunityId',
              'contractNumber',
              'quoteRevisionId',
              'quoteSnapshotId',
              'content',
            ]);
            const result = await dependencies.quoteToCash.createContract(
              {
                customerId: uuid(body.customerId, 'customerId'),
                opportunityId: uuid(body.opportunityId, 'opportunityId'),
                contractNumber: string(body.contractNumber, 'contractNumber'),
                quoteRevisionId: uuid(body.quoteRevisionId, 'quoteRevisionId'),
                quoteSnapshotId: uuid(body.quoteSnapshotId, 'quoteSnapshotId'),
                content: jsonObject(body.content, 'content'),
              },
              idempotency(request),
              ctx('contract:revise'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'contract:read') };
          }
          const signing = /^\/api\/v1\/contracts\/([0-9a-f-]+)\/sign$/u.exec(request.pathname);
          if (signing) {
            allow(body, ['provider', 'providerReceiptId', 'payload', 'signedAt']);
            const result = await dependencies.quoteToCash.signContract(
              uuid(signing[1], 'contractRevisionId'),
              {
                provider: string(body.provider, 'provider'),
                providerReceiptId: string(body.providerReceiptId, 'providerReceiptId'),
                payload: jsonObject(body.payload, 'payload'),
                signedAt: timestamp(body.signedAt, 'signedAt'),
              },
              idempotency(request),
              ctx('contract:sign'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'contract:read') };
          }
          if (request.pathname === '/api/v1/sales-orders') {
            allow(body, [
              'customerId',
              'opportunityId',
              'orderNumber',
              'quoteRevisionId',
              'quoteSnapshotId',
              'creditDecisionId',
              'contractRevisionId',
              'signatureEvidenceId',
              'currency',
              'total',
              'lines',
            ]);
            const lines = array(body.lines, 'lines').map((v, i) => {
              const l = objectBody(v);
              allow(l, ['description', 'quantity', 'unitPrice', 'total']);
              return {
                description: string(l.description, `lines[${String(i)}].description`),
                quantity: decimal(l.quantity, 'quantity'),
                unitPrice: decimal(l.unitPrice, 'unitPrice'),
                total: decimal(l.total, 'total'),
              };
            });
            if (!lines.length)
              throw new DomainError('invalid_request', 'Sales order requires at least one line');
            const declaredTotal = decimal(body.total, 'total');
            const lineTotal = lines.reduce((sum, line) => addDecimal(sum, line.total), '0');
            if (normalizeDecimal(declaredTotal) !== lineTotal)
              throw new DomainError('invalid_request', 'Sales order lines must equal order total');
            const result = await dependencies.quoteToCash.createOrder(
              {
                customerId: uuid(body.customerId, 'customerId'),
                opportunityId: uuid(body.opportunityId, 'opportunityId'),
                orderNumber: string(body.orderNumber, 'orderNumber'),
                quoteRevisionId: uuid(body.quoteRevisionId, 'quoteRevisionId'),
                quoteSnapshotId: uuid(body.quoteSnapshotId, 'quoteSnapshotId'),
                creditDecisionId: uuid(body.creditDecisionId, 'creditDecisionId'),
                contractRevisionId: uuid(body.contractRevisionId, 'contractRevisionId'),
                signatureEvidenceId: uuid(body.signatureEvidenceId, 'signatureEvidenceId'),
                currency: currency(body.currency),
                total: declaredTotal,
                lines,
              },
              idempotency(request),
              ctx('sales-order:create'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'sales-order:read') };
          }
          if (request.pathname === '/api/v1/ar-open-items') {
            allow(body, [
              'customerId',
              'salesOrderId',
              'documentNumber',
              'documentType',
              'currency',
              'amount',
              'dueAt',
            ]);
            const dt = string(body.documentType, 'documentType');
            if (!['INVOICE', 'CREDIT_NOTE'].includes(dt))
              throw new DomainError('invalid_request', 'documentType is unsupported');
            const result = await dependencies.quoteToCash.postAr(
              {
                customerId: uuid(body.customerId, 'customerId'),
                salesOrderId:
                  body.salesOrderId === null ? null : uuid(body.salesOrderId, 'salesOrderId'),
                documentNumber: string(body.documentNumber, 'documentNumber'),
                documentType: dt as 'INVOICE' | 'CREDIT_NOTE',
                currency: currency(body.currency),
                amount: decimal(body.amount, 'amount'),
                dueAt: timestamp(body.dueAt, 'dueAt'),
              },
              idempotency(request),
              ctx('ar:post'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'ar:read') };
          }
          if (request.pathname === '/api/v1/bank-payments') {
            allow(body, [
              'customerId',
              'currency',
              'amount',
              'receivedAt',
              'bankReference',
              'rawPayload',
            ]);
            const result = await dependencies.quoteToCash.intakePayment(
              {
                customerId: uuid(body.customerId, 'customerId'),
                currency: currency(body.currency),
                amount: decimal(body.amount, 'amount'),
                receivedAt: timestamp(body.receivedAt, 'receivedAt'),
                bankReference: string(body.bankReference, 'bankReference'),
                rawPayload: jsonObject(body.rawPayload, 'rawPayload'),
              },
              idempotency(request),
              ctx('bank-payment:intake'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'bank-payment:read') };
          }
          if (request.pathname === '/api/v1/reconciliation-runs') {
            allow(body, ['paymentId']);
            const result = await dependencies.quoteToCash.reconcile(
              { paymentId: uuid(body.paymentId, 'paymentId') },
              idempotency(request),
              ctx('reconciliation:run'),
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'reconciliation:read') };
          }
        }
        if (dependencies.commissions) {
          if (request.method === 'GET' && request.pathname === '/api/v1/commission-policies') {
            const grant = authorizeQuery(context, 'commission-policy:read');
            return {
              statusCode: 200,
              body: {
                items: (
                  await dependencies.commissions.listPolicies({
                    actor: context.actor,
                    scopes: grant.scopes,
                    anchors: grant.anchors,
                  })
                ).map((item) =>
                  permittedDto(
                    item,
                    context.permissions.get('commission-policy:read')?.fields ?? null,
                  ),
                ),
              },
            };
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/commissions') {
            const grant = authorizeQuery(context, 'commission:read');
            return {
              statusCode: 200,
              body: {
                items: (
                  await dependencies.commissions.listCases({
                    actor: context.actor,
                    scopes: grant.scopes,
                    anchors: grant.anchors,
                  })
                ).map((item) =>
                  permittedDto(item, context.permissions.get('commission:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/commission-policies') {
            const body = objectBody(request.body);
            allow(body, [
              'code',
              'name',
              'applicability',
              'baseRateBasisPoints',
              'minimumMarginBasisPoints',
              'releaseCollectionBasisPoints',
              'effectiveAt',
              'rules',
              'publish',
            ]);
            const grant = authorizeQuery(context, 'commission-policy:manage', Object.keys(body));
            const rules = array(body.rules, 'rules').map((rule, index) =>
              jsonObject(rule, `rules[${String(index)}]`),
            );
            const result = await dependencies.commissions.createPolicy(
              {
                code: string(body.code, 'code'),
                name: string(body.name, 'name'),
                applicability: jsonObject(body.applicability, 'applicability'),
                baseRateBasisPoints: integer(
                  body.baseRateBasisPoints,
                  'baseRateBasisPoints',
                  0,
                  10000,
                ),
                minimumMarginBasisPoints: integer(
                  body.minimumMarginBasisPoints,
                  'minimumMarginBasisPoints',
                  -100000,
                  10000,
                ),
                releaseCollectionBasisPoints: integer(
                  body.releaseCollectionBasisPoints,
                  'releaseCollectionBasisPoints',
                  0,
                  10000,
                ),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                rules,
                publish: body.publish === true,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'commission-policy:read'),
            };
          }
          const commissionPolicyRevision =
            /^\/api\/v1\/commission-policies\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
          if (request.method === 'POST' && commissionPolicyRevision) {
            const body = objectBody(request.body);
            allow(body, [
              'baseRateBasisPoints',
              'minimumMarginBasisPoints',
              'releaseCollectionBasisPoints',
              'effectiveAt',
              'rules',
            ]);
            const grant = authorizeQuery(context, 'commission-policy:manage', Object.keys(body));
            const result = await dependencies.commissions.createPolicyVersion(
              uuid(commissionPolicyRevision[1], 'commissionPolicyId'),
              {
                baseRateBasisPoints: integer(
                  body.baseRateBasisPoints,
                  'baseRateBasisPoints',
                  0,
                  10000,
                ),
                minimumMarginBasisPoints: integer(
                  body.minimumMarginBasisPoints,
                  'minimumMarginBasisPoints',
                  -100000,
                  10000,
                ),
                releaseCollectionBasisPoints: integer(
                  body.releaseCollectionBasisPoints,
                  'releaseCollectionBasisPoints',
                  0,
                  10000,
                ),
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
                rules: array(body.rules, 'rules').map((rule, index) =>
                  jsonObject(rule, `rules[${String(index)}]`),
                ),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'commission-policy:read'),
            };
          }
          const commissionPolicyPublish =
            /^\/api\/v1\/commission-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && commissionPolicyPublish) {
            const body = objectBody(request.body);
            allow(body, []);
            const grant = authorizeQuery(context, 'commission-policy:manage');
            const result = await dependencies.commissions.publishPolicyVersion(
              uuid(commissionPolicyPublish[1], 'commissionPolicyVersionId'),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 200,
              body: mutationDto(result, context, 'commission-policy:read'),
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/commissions/accrue') {
            const body = objectBody(request.body);
            allow(body, [
              'salesOrderId',
              'beneficiaryEmployeeId',
              'policyVersionId',
              'accountingPeriod',
            ]);
            const grant = authorizeQuery(context, 'commission:accrue', Object.keys(body));
            const accountingPeriod = string(body.accountingPeriod, 'accountingPeriod');
            if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/u.test(accountingPeriod))
              throw new DomainError('invalid_request', 'accountingPeriod must use YYYY-MM');
            const result = await dependencies.commissions.accrue(
              {
                salesOrderId: uuid(body.salesOrderId, 'salesOrderId'),
                beneficiaryEmployeeId: uuid(body.beneficiaryEmployeeId, 'beneficiaryEmployeeId'),
                policyVersionId: uuid(body.policyVersionId, 'policyVersionId'),
                accountingPeriod,
              },
              idempotency(request),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'commission:read') };
          }
          const commissionCommand =
            /^\/api\/v1\/commissions\/([0-9a-f-]+)\/(freeze|release|pay|clawback|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && commissionCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'externalReference']);
            const target = (
              {
                freeze: 'FROZEN',
                release: 'RELEASED',
                pay: 'PAID',
                clawback: 'CLAWED_BACK',
                cancel: 'CANCELLED',
              } as const
            )[commissionCommand[2] as 'freeze' | 'release' | 'pay' | 'clawback' | 'cancel'];
            const capability = target === 'PAID' ? 'commission:pay' : 'commission:manage';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const result = await dependencies.commissions.transition(
              uuid(commissionCommand[1], 'commissionId'),
              {
                state: target,
                reason: string(body.reason, 'reason'),
                externalReference:
                  body.externalReference === null || body.externalReference === undefined
                    ? null
                    : string(body.externalReference, 'externalReference'),
              },
              idempotency(request),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'commission:read') };
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
