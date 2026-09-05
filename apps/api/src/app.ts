import { randomUUID } from 'node:crypto';
import {
  assertEffectiveRange,
  addDecimal,
  assertStableCode,
  DomainError,
  normalizeContactEmail,
  normalizeContactPhone,
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
import { DATA_SCOPES, type DataScope, type ErrorCode, type PermissionKey } from '@kingturf/types';
import { authorizeQuery } from './policy.ts';
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
const CAPABILITY = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/u;
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
const scopes = (value: unknown): readonly DataScope[] => {
  const values = strings(value, 'scopes');
  if (values.length === 0 || values.some((v) => !DATA_SCOPES.includes(v as DataScope)))
    throw new DomainError('invalid_request', 'scopes contains an unsupported DataScope');
  return values as DataScope[];
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
        if (request.method === 'POST' && request.pathname === '/api/v1/auth/login') {
          const body = objectBody(request.body);
          const result = await dependencies.auth.login(
            string(body.login, 'login'),
            string(body.password, 'password'),
            correlationId,
          );
          return result
            ? { statusCode: 200, body: result }
            : {
                statusCode: 401,
                body: {
                  error: {
                    code: 'authentication_required',
                    message: 'Invalid credentials',
                    correlationId,
                  },
                },
              };
        }
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
        if (request.method === 'POST' && request.pathname === '/api/v1/auth/logout') {
          await dependencies.auth.logout(token, context, correlationId);
          return { statusCode: 204, body: {} };
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/auth/session') {
          const profile = await dependencies.employees.findById(
            context.actor.employeeId,
            context.actor.companyId,
            ['SELF'],
            context.actor.employeeId,
          );
          return {
            statusCode: 200,
            body: {
              employeeId: context.actor.employeeId,
              companyId: context.actor.companyId,
              displayName: profile?.displayName ?? null,
              employeeNumber: profile?.employeeNumber ?? null,
              permissions: [...context.permissions.keys()].sort(),
            },
          };
        }
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
            const grant = authorizeQuery(context, 'production:read');
            const items = await dependencies.production.list({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get('production:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/production-orders') {
            const body = objectBody(request.body);
            allow(body, [
              'orderNumber',
              'itemVersionId',
              'routingVersionId',
              'mrpProposalId',
              'plannedQuantity',
              'plannedStartAt',
              'plannedDueAt',
              'sourceReference',
            ]);
            const grant = authorizeQuery(context, 'production:plan', Object.keys(body));
            const result = await dependencies.production.create(
              {
                orderNumber: assertStableCode(string(body.orderNumber, 'orderNumber')),
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                routingVersionId: uuid(body.routingVersionId, 'routingVersionId'),
                ...(body.mrpProposalId === undefined
                  ? {}
                  : { mrpProposalId: uuid(body.mrpProposalId, 'mrpProposalId') }),
                plannedQuantity: decimal(body.plannedQuantity, 'plannedQuantity'),
                plannedStartAt: calendarDate(body.plannedStartAt, 'plannedStartAt'),
                plannedDueAt: calendarDate(body.plannedDueAt, 'plannedDueAt'),
                sourceReference: assertStableCode(string(body.sourceReference, 'sourceReference')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'production:read') };
          }
          const productionCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/(release|start|complete|close|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && productionCommand) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const action = productionCommand[2] as
              | 'release'
              | 'start'
              | 'complete'
              | 'close'
              | 'cancel';
            const capability: PermissionKey =
              action === 'release'
                ? 'production:plan'
                : action === 'start'
                  ? 'production:report'
                  : 'production:close';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const states = {
              release: 'RELEASED',
              start: 'IN_PROGRESS',
              complete: 'COMPLETED',
              close: 'CLOSED',
              cancel: 'CANCELLED',
            } as const;
            const result = await dependencies.production.transition(
              uuid(productionCommand[1], 'productionOrderId'),
              states[action],
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'production:read') };
          }
          const materialCommand = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/materials$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && materialCommand) {
            const body = objectBody(request.body);
            allow(body, [
              'transactionType',
              'itemVersionId',
              'lotId',
              'locationId',
              'quantity',
              'reason',
              'occurredAt',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'production:material', Object.keys(body));
            const transactionType = string(body.transactionType, 'transactionType');
            if (!['ISSUE', 'RETURN'].includes(transactionType))
              throw new DomainError('invalid_request', 'transactionType is unsupported');
            const result = await dependencies.production.transactMaterial(
              uuid(materialCommand[1], 'productionOrderId'),
              {
                transactionType: transactionType as 'ISSUE' | 'RETURN',
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                lotId: uuid(body.lotId, 'lotId'),
                locationId: uuid(body.locationId, 'locationId'),
                quantity: decimal(body.quantity, 'quantity'),
                reason: string(body.reason, 'reason'),
                occurredAt: timestamp(body.occurredAt, 'occurredAt'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'production:read') };
          }
          const reportCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/operation-reports$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && reportCommand) {
            const body = objectBody(request.body);
            allow(body, [
              'operationId',
              'goodQuantity',
              'scrapQuantity',
              'laborMinutes',
              'machineMinutes',
              'startedAt',
              'completedAt',
              'notes',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'production:report', Object.keys(body));
            const result = await dependencies.production.reportOperation(
              uuid(reportCommand[1], 'productionOrderId'),
              {
                operationId: uuid(body.operationId, 'operationId'),
                goodQuantity: decimal(body.goodQuantity, 'goodQuantity'),
                scrapQuantity: decimal(body.scrapQuantity, 'scrapQuantity'),
                laborMinutes: decimal(body.laborMinutes, 'laborMinutes'),
                machineMinutes: decimal(body.machineMinutes, 'machineMinutes'),
                startedAt: timestamp(body.startedAt, 'startedAt'),
                completedAt: timestamp(body.completedAt, 'completedAt'),
                notes: string(body.notes ?? '', 'notes'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'production:read') };
          }
          const outputCommand =
            /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/finished-rolls$/u.exec(request.pathname);
          if (request.method === 'POST' && outputCommand) {
            const body = objectBody(request.body);
            allow(body, [
              'operationReportId',
              'itemVersionId',
              'rollNumber',
              'lotNumber',
              'locationId',
              'quantity',
              'manufacturedAt',
            ]);
            const grant = authorizeQuery(context, 'production:report', Object.keys(body));
            const result = await dependencies.production.createOutput(
              uuid(outputCommand[1], 'productionOrderId'),
              {
                operationReportId: uuid(body.operationReportId, 'operationReportId'),
                itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
                rollNumber: assertStableCode(string(body.rollNumber, 'rollNumber')),
                lotNumber: assertStableCode(string(body.lotNumber, 'lotNumber')),
                locationId: uuid(body.locationId, 'locationId'),
                quantity: decimal(body.quantity, 'quantity'),
                manufacturedAt: calendarDate(body.manufacturedAt, 'manufacturedAt'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'production:read') };
          }
        }
        if (dependencies.productionCosts) {
          if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-policies') {
            const grant = authorizeQuery(context, 'manufacturing-cost:read');
            const items = await dependencies.productionCosts.listPolicies({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return { statusCode: 200, body: { items } };
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-runs') {
            const grant = authorizeQuery(context, 'manufacturing-cost:read');
            const items = await dependencies.productionCosts.list({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(
                    item,
                    context.permissions.get('manufacturing-cost:read')?.fields ?? null,
                  ),
                ),
              },
            };
          }
          if (
            request.method === 'POST' &&
            request.pathname === '/api/v1/production-cost-policies'
          ) {
            const body = objectBody(request.body);
            allow(body, [
              'version',
              'currency',
              'laborRatePerHour',
              'machineRatePerHour',
              'overheadRatePerMachineHour',
              'effectiveFrom',
              'effectiveTo',
              'sourceReference',
              'materialRates',
            ]);
            const grant = authorizeQuery(context, 'manufacturing-cost:policy', Object.keys(body));
            if (!Array.isArray(body.materialRates) || !body.materialRates.length)
              throw new DomainError('invalid_request', 'materialRates must be a non-empty array');
            const materialRates = body.materialRates.map((raw) => {
              const x = objectBody(raw);
              allow(x, ['itemVersionId', 'unitCost', 'sourceReference']);
              return {
                itemVersionId: uuid(x.itemVersionId, 'itemVersionId'),
                unitCost: decimal(x.unitCost, 'unitCost'),
                sourceReference: assertStableCode(string(x.sourceReference, 'sourceReference')),
              };
            });
            const result = await dependencies.productionCosts.createPolicy(
              {
                version: integer(body.version, 'version', 1, 1000000),
                currency: assertCurrency(string(body.currency, 'currency')),
                laborRatePerHour: decimal(body.laborRatePerHour, 'laborRatePerHour'),
                machineRatePerHour: decimal(body.machineRatePerHour, 'machineRatePerHour'),
                overheadRatePerMachineHour: decimal(
                  body.overheadRatePerMachineHour,
                  'overheadRatePerMachineHour',
                ),
                effectiveFrom: calendarDate(body.effectiveFrom, 'effectiveFrom'),
                ...(body.effectiveTo === undefined
                  ? {}
                  : { effectiveTo: calendarDate(body.effectiveTo, 'effectiveTo') }),
                sourceReference: assertStableCode(string(body.sourceReference, 'sourceReference')),
                materialRates,
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'manufacturing-cost:read'),
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/production-cost-runs') {
            const body = objectBody(request.body);
            allow(body, ['productionOrderId', 'policyId', 'runNumber', 'idempotencyKey']);
            const grant = authorizeQuery(
              context,
              'manufacturing-cost:calculate',
              Object.keys(body),
            );
            const result = await dependencies.productionCosts.calculate(
              {
                productionOrderId: uuid(body.productionOrderId, 'productionOrderId'),
                policyId: uuid(body.policyId, 'policyId'),
                runNumber: assertStableCode(string(body.runNumber, 'runNumber')),
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
          if (request.method === 'GET' && request.pathname === '/api/v1/complaint-sla-policies') {
            const grant = authorizeQuery(context, 'complaint-sla:read');
            const items = await dependencies.complaints.listSlaPolicies({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get('complaint-sla:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/complaint-sla-policies') {
            const body = objectBody(request.body);
            allow(body, [
              'policyCode',
              'version',
              'severity',
              'responseHours',
              'containmentHours',
              'rootCauseHours',
              'closureHours',
              'effectiveAt',
            ]);
            const grant = authorizeQuery(context, 'complaint-sla:manage', Object.keys(body));
            const severity = string(body.severity, 'severity');
            if (!['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'].includes(severity))
              throw new DomainError('invalid_request', 'severity is unsupported');
            const responseHours = integer(body.responseHours, 'responseHours', 1, 8760);
            const containmentHours = integer(body.containmentHours, 'containmentHours', 1, 8760);
            const rootCauseHours = integer(body.rootCauseHours, 'rootCauseHours', 1, 8760);
            const closureHours = integer(body.closureHours, 'closureHours', 1, 8760);
            if (
              responseHours > containmentHours ||
              containmentHours > rootCauseHours ||
              rootCauseHours > closureHours
            )
              throw new DomainError(
                'invalid_request',
                'SLA hours must progress from response through closure',
              );
            const result = await dependencies.complaints.createSlaPolicy(
              {
                policyCode: assertStableCode(string(body.policyCode, 'policyCode')),
                version: integer(body.version, 'version', 1, 10_000),
                severity: severity as 'LOW' | 'MEDIUM' | 'MAJOR' | 'CRITICAL',
                responseHours,
                containmentHours,
                rootCauseHours,
                closureHours,
                effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return {
              statusCode: 201,
              body: mutationDto(result, context, 'complaint-sla:read'),
            };
          }
          if (request.method === 'GET' && request.pathname === '/api/v1/complaints') {
            const grant = authorizeQuery(context, 'complaint:read');
            const query = request.query ?? {};
            const state = query.state;
            const severity = query.severity;
            const allowedStates = [
              'REPORTED',
              'TRIAGED',
              'INVESTIGATING',
              'NCR_OPEN',
              'CAPA_ACTIVE',
              'VERIFIED',
              'CLOSED',
              'REJECTED',
            ];
            const allowedSeverities = ['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'];
            if (state && !allowedStates.includes(state))
              throw new DomainError('invalid_request', 'state is unsupported');
            if (severity && !allowedSeverities.includes(severity))
              throw new DomainError('invalid_request', 'severity is unsupported');
            if (query.overdue && !['true', 'false'].includes(query.overdue))
              throw new DomainError('invalid_request', 'overdue must be true or false');
            const page = await dependencies.complaints.list(
              {
                limit: query.limit ? integer(Number(query.limit), 'limit', 1, 100) : 50,
                ...(query.cursor ? { cursor: uuid(query.cursor, 'cursor') } : {}),
                ...(query.query ? { query: string(query.query, 'query') } : {}),
                ...(state
                  ? {
                      state: state as
                        | 'REPORTED'
                        | 'TRIAGED'
                        | 'INVESTIGATING'
                        | 'NCR_OPEN'
                        | 'CAPA_ACTIVE'
                        | 'VERIFIED'
                        | 'CLOSED'
                        | 'REJECTED',
                    }
                  : {}),
                ...(severity
                  ? { severity: severity as 'LOW' | 'MEDIUM' | 'MAJOR' | 'CRITICAL' }
                  : {}),
                ...(query.assignedTo ? { assignedTo: uuid(query.assignedTo, 'assignedTo') } : {}),
                ...(query.customerId ? { customerId: uuid(query.customerId, 'customerId') } : {}),
                ...(query.salesOrderId
                  ? { salesOrderId: uuid(query.salesOrderId, 'salesOrderId') }
                  : {}),
                ...(query.inventoryLotId
                  ? { inventoryLotId: uuid(query.inventoryLotId, 'inventoryLotId') }
                  : {}),
                ...(query.createdFrom
                  ? { createdFrom: timestamp(query.createdFrom, 'createdFrom') }
                  : {}),
                ...(query.createdTo ? { createdTo: timestamp(query.createdTo, 'createdTo') } : {}),
                ...(query.overdue ? { overdue: query.overdue === 'true' } : {}),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
            );
            return {
              statusCode: 200,
              body: {
                items: page.items.map((item) =>
                  permittedDto(item, context.permissions.get('complaint:read')?.fields ?? null),
                ),
                nextCursor: page.nextCursor,
              },
            };
          }
          const complaintDetail = /^\/api\/v1\/complaints\/([0-9a-f-]+)$/u.exec(request.pathname);
          if (request.method === 'GET' && complaintDetail) {
            const grant = authorizeQuery(context, 'complaint:read');
            const item = await dependencies.complaints.getById(
              uuid(complaintDetail[1], 'complaintId'),
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
            );
            return {
              statusCode: 200,
              body: permittedDto(item, context.permissions.get('complaint:read')?.fields ?? null),
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/complaints') {
            const body = objectBody(request.body);
            allow(body, [
              'complaintNumber',
              'customerId',
              'salesOrderId',
              'shipmentId',
              'inventoryLotId',
              'qualityInspectionId',
              'slaPolicyVersionId',
              'channel',
              'defectCategory',
              'severity',
              'occurredAt',
              'reportedAt',
              'description',
              'customerRequest',
              'assignedTo',
              'initialSnapshot',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'complaint:create', Object.keys(body));
            const channel = string(body.channel, 'channel');
            const severity = string(body.severity, 'severity');
            if (
              !['CUSTOMER_SERVICE', 'SALES', 'EMAIL', 'PHONE', 'ONSITE', 'OTHER'].includes(channel)
            )
              throw new DomainError('invalid_request', 'channel is unsupported');
            if (!['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'].includes(severity))
              throw new DomainError('invalid_request', 'severity is unsupported');
            const result = await dependencies.complaints.createComplaint(
              {
                complaintNumber: assertStableCode(string(body.complaintNumber, 'complaintNumber')),
                customerId: uuid(body.customerId, 'customerId'),
                ...(body.salesOrderId
                  ? { salesOrderId: uuid(body.salesOrderId, 'salesOrderId') }
                  : {}),
                ...(body.shipmentId ? { shipmentId: uuid(body.shipmentId, 'shipmentId') } : {}),
                ...(body.inventoryLotId
                  ? { inventoryLotId: uuid(body.inventoryLotId, 'inventoryLotId') }
                  : {}),
                ...(body.qualityInspectionId
                  ? { qualityInspectionId: uuid(body.qualityInspectionId, 'qualityInspectionId') }
                  : {}),
                slaPolicyVersionId: uuid(body.slaPolicyVersionId, 'slaPolicyVersionId'),
                channel: channel as
                  | 'CUSTOMER_SERVICE'
                  | 'SALES'
                  | 'EMAIL'
                  | 'PHONE'
                  | 'ONSITE'
                  | 'OTHER',
                defectCategory: string(body.defectCategory, 'defectCategory'),
                severity: severity as 'LOW' | 'MEDIUM' | 'MAJOR' | 'CRITICAL',
                occurredAt: timestamp(body.occurredAt, 'occurredAt'),
                reportedAt: timestamp(body.reportedAt, 'reportedAt'),
                description: string(body.description, 'description'),
                customerRequest: string(body.customerRequest, 'customerRequest'),
                ...(body.assignedTo ? { assignedTo: uuid(body.assignedTo, 'assignedTo') } : {}),
                initialSnapshot: jsonObject(body.initialSnapshot, 'initialSnapshot'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'complaint:read') };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/complaints/batch-triage') {
            const body = objectBody(request.body);
            allow(body, ['batchKey', 'items']);
            const triageGrant = authorizeQuery(context, 'complaint:triage', Object.keys(body));
            const assignGrant = authorizeQuery(context, 'complaint:assign', Object.keys(body));
            const rawItems = array(body.items, 'items');
            if (rawItems.length < 1 || rawItems.length > 50)
              throw new DomainError('invalid_request', 'items must contain between 1 and 50 rows');
            const items = rawItems.map((value, index) => {
              const item = objectBody(value);
              allow(item, ['id', 'expectedVersion', 'assignedTo', 'reason']);
              return {
                id: uuid(item.id, `items[${String(index)}].id`),
                expectedVersion: integer(
                  item.expectedVersion,
                  `items[${String(index)}].expectedVersion`,
                  1,
                  1_000_000,
                ),
                assignedTo: uuid(item.assignedTo, `items[${String(index)}].assignedTo`),
                reason: string(item.reason, `items[${String(index)}].reason`),
              };
            });
            if (new Set(items.map((item) => item.id)).size !== items.length)
              throw new DomainError(
                'invalid_request',
                'items must not contain duplicate complaints',
              );
            const sharedScopes = triageGrant.scopes.filter((value) =>
              assignGrant.scopes.includes(value),
            );
            const sharedAnchors = triageGrant.anchors.filter((left) =>
              assignGrant.anchors.some(
                (right) =>
                  right.scope === left.scope && right.organizationId === left.organizationId,
              ),
            );
            const result = await dependencies.complaints.batchTriage(
              {
                batchKey: assertStableCode(string(body.batchKey, 'batchKey')),
                items,
              },
              { actor: context.actor, scopes: sharedScopes, anchors: sharedAnchors },
              correlationId,
            );
            return { statusCode: 200, body: result };
          }
          const complaintTransition =
            /^\/api\/v1\/complaints\/([0-9a-f-]+)\/(triage|investigate|reject|close)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && complaintTransition) {
            const body = objectBody(request.body);
            allow(body, ['expectedVersion', 'reason', 'evidence', 'assignedTo', 'idempotencyKey']);
            const action = complaintTransition[2] ?? '';
            const capability = action === 'close' ? 'complaint:close' : 'complaint:triage';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const state =
              action === 'triage'
                ? 'TRIAGED'
                : action === 'investigate'
                  ? 'INVESTIGATING'
                  : action === 'reject'
                    ? 'REJECTED'
                    : 'CLOSED';
            const result = await dependencies.complaints.transitionComplaint(
              uuid(complaintTransition[1], 'complaintId'),
              {
                state,
                expectedVersion: integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                ...(body.assignedTo ? { assignedTo: uuid(body.assignedTo, 'assignedTo') } : {}),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'complaint:read') };
          }
          const ncrCreate = /^\/api\/v1\/complaints\/([0-9a-f-]+)\/ncrs$/u.exec(request.pathname);
          if (request.method === 'POST' && ncrCreate) {
            const body = objectBody(request.body);
            allow(body, [
              'ncrNumber',
              'defectType',
              'affectedScope',
              'responsibleOrganizationId',
              'investigatorId',
              'quarantinedQuantity',
              'temporaryContainment',
              'complaintExpectedVersion',
              'evidence',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'ncr:manage', Object.keys(body));
            const result = await dependencies.complaints.createNcr(
              {
                ncrNumber: assertStableCode(string(body.ncrNumber, 'ncrNumber')),
                complaintId: uuid(ncrCreate[1], 'complaintId'),
                defectType: string(body.defectType, 'defectType'),
                affectedScope: string(body.affectedScope, 'affectedScope'),
                ...(body.responsibleOrganizationId
                  ? {
                      responsibleOrganizationId: uuid(
                        body.responsibleOrganizationId,
                        'responsibleOrganizationId',
                      ),
                    }
                  : {}),
                investigatorId: uuid(body.investigatorId, 'investigatorId'),
                quarantinedQuantity: decimal(body.quarantinedQuantity, 'quarantinedQuantity'),
                temporaryContainment: string(body.temporaryContainment, 'temporaryContainment'),
                complaintExpectedVersion: integer(
                  body.complaintExpectedVersion,
                  'complaintExpectedVersion',
                  1,
                  1_000_000,
                ),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'ncr:read') };
          }
          const ncrTransition =
            /^\/api\/v1\/ncrs\/([0-9a-f-]+)\/(contain|root-cause|disposition|close)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && ncrTransition) {
            const body = objectBody(request.body);
            allow(body, [
              'expectedVersion',
              'reason',
              'rootCauseMethod',
              'rootCause',
              'disposition',
              'evidence',
              'idempotencyKey',
            ]);
            const action = ncrTransition[2] ?? '';
            const capability =
              action === 'disposition'
                ? 'ncr:disposition'
                : action === 'close'
                  ? 'ncr:close'
                  : 'ncr:manage';
            const grant = authorizeQuery(context, capability, Object.keys(body));
            const state =
              action === 'contain'
                ? 'CONTAINED'
                : action === 'root-cause'
                  ? 'ROOT_CAUSE_CONFIRMED'
                  : action === 'disposition'
                    ? 'DISPOSITIONED'
                    : 'CLOSED';
            const method = body.rootCauseMethod
              ? string(body.rootCauseMethod, 'rootCauseMethod')
              : undefined;
            const disposition = body.disposition
              ? string(body.disposition, 'disposition')
              : undefined;
            if (method && !['FIVE_WHY', 'FISHBONE', 'FAULT_TREE', 'OTHER'].includes(method))
              throw new DomainError('invalid_request', 'rootCauseMethod is unsupported');
            if (
              disposition &&
              !['REWORK', 'REPAIR', 'CONCESSION', 'RETURN', 'SCRAP', 'SUPPLIER_CLAIM'].includes(
                disposition,
              )
            )
              throw new DomainError('invalid_request', 'disposition is unsupported');
            const result = await dependencies.complaints.transitionNcr(
              uuid(ncrTransition[1], 'ncrId'),
              {
                state,
                expectedVersion: integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
                reason: string(body.reason, 'reason'),
                ...(method
                  ? {
                      rootCauseMethod: method as 'FIVE_WHY' | 'FISHBONE' | 'FAULT_TREE' | 'OTHER',
                    }
                  : {}),
                ...(body.rootCause ? { rootCause: jsonObject(body.rootCause, 'rootCause') } : {}),
                ...(disposition
                  ? {
                      disposition: disposition as
                        | 'REWORK'
                        | 'REPAIR'
                        | 'CONCESSION'
                        | 'RETURN'
                        | 'SCRAP'
                        | 'SUPPLIER_CLAIM',
                    }
                  : {}),
                ...(action === 'disposition' ? { approvedBy: context.actor.employeeId } : {}),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'ncr:read') };
          }
          const capaCreate = /^\/api\/v1\/ncrs\/([0-9a-f-]+)\/capas$/u.exec(request.pathname);
          if (request.method === 'POST' && capaCreate) {
            const body = objectBody(request.body);
            allow(body, [
              'capaNumber',
              'ownerId',
              'targetAt',
              'riskLevel',
              'rootCauseSnapshot',
              'complaintExpectedVersion',
              'evidence',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'capa:manage', Object.keys(body));
            const riskLevel = string(body.riskLevel, 'riskLevel');
            if (!['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'].includes(riskLevel))
              throw new DomainError('invalid_request', 'riskLevel is unsupported');
            const result = await dependencies.complaints.createCapa(
              {
                capaNumber: assertStableCode(string(body.capaNumber, 'capaNumber')),
                ncrId: uuid(capaCreate[1], 'ncrId'),
                ownerId: uuid(body.ownerId, 'ownerId'),
                targetAt: timestamp(body.targetAt, 'targetAt'),
                riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'MAJOR' | 'CRITICAL',
                rootCauseSnapshot: jsonObject(body.rootCauseSnapshot, 'rootCauseSnapshot'),
                complaintExpectedVersion: integer(
                  body.complaintExpectedVersion,
                  'complaintExpectedVersion',
                  1,
                  1_000_000,
                ),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'capa:read') };
          }
          const capaAction = /^\/api\/v1\/capas\/([0-9a-f-]+)\/actions$/u.exec(request.pathname);
          if (request.method === 'POST' && capaAction) {
            const body = objectBody(request.body);
            allow(body, [
              'actionType',
              'description',
              'ownerId',
              'dueAt',
              'expectedVersion',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'capa:manage', Object.keys(body));
            const actionType = string(body.actionType, 'actionType');
            if (!['CORRECTIVE', 'PREVENTIVE'].includes(actionType))
              throw new DomainError('invalid_request', 'actionType is unsupported');
            const result = await dependencies.complaints.addCapaAction(
              uuid(capaAction[1], 'capaId'),
              {
                actionType: actionType as 'CORRECTIVE' | 'PREVENTIVE',
                description: string(body.description, 'description'),
                ownerId: uuid(body.ownerId, 'ownerId'),
                dueAt: timestamp(body.dueAt, 'dueAt'),
                expectedVersion: integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'capa:read') };
          }
          const capaActionComplete = /^\/api\/v1\/capa-actions\/([0-9a-f-]+)\/complete$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && capaActionComplete) {
            const body = objectBody(request.body);
            allow(body, ['completedAt', 'evidence', 'expectedCapaVersion', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'capa:manage', Object.keys(body));
            const result = await dependencies.complaints.completeCapaAction(
              uuid(capaActionComplete[1], 'capaActionId'),
              {
                completedAt: timestamp(body.completedAt, 'completedAt'),
                evidence: jsonObject(body.evidence, 'evidence'),
                expectedCapaVersion: integer(
                  body.expectedCapaVersion,
                  'expectedCapaVersion',
                  1,
                  1_000_000,
                ),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'capa:read') };
          }
          const capaClose = /^\/api\/v1\/capas\/([0-9a-f-]+)\/close$/u.exec(request.pathname);
          if (request.method === 'POST' && capaClose) {
            const body = objectBody(request.body);
            allow(body, ['expectedVersion', 'reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'capa:manage', Object.keys(body));
            const result = await dependencies.complaints.closeCapa(
              uuid(capaClose[1], 'capaId'),
              {
                expectedVersion: integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'capa:read') };
          }
          const capaVerify = /^\/api\/v1\/capas\/([0-9a-f-]+)\/verify$/u.exec(request.pathname);
          if (request.method === 'POST' && capaVerify) {
            const body = objectBody(request.body);
            allow(body, [
              'verifiedAt',
              'standard',
              'sampleScope',
              'observationUntil',
              'result',
              'evidence',
              'expectedVersion',
              'complaintExpectedVersion',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'capa:verify', Object.keys(body));
            const verificationResult = string(body.result, 'result');
            if (!['PASSED', 'FAILED'].includes(verificationResult))
              throw new DomainError('invalid_request', 'result is unsupported');
            const result = await dependencies.complaints.verifyCapa(
              uuid(capaVerify[1], 'capaId'),
              {
                verifiedAt: timestamp(body.verifiedAt, 'verifiedAt'),
                standard: string(body.standard, 'standard'),
                sampleScope: string(body.sampleScope, 'sampleScope'),
                observationUntil: timestamp(body.observationUntil, 'observationUntil'),
                result: verificationResult as 'PASSED' | 'FAILED',
                evidence: jsonObject(body.evidence, 'evidence'),
                expectedVersion: integer(body.expectedVersion, 'expectedVersion', 1, 1_000_000),
                complaintExpectedVersion: integer(
                  body.complaintExpectedVersion,
                  'complaintExpectedVersion',
                  1,
                  1_000_000,
                ),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'capa:read') };
          }
        }
        if (dependencies.collections) {
          if (request.method === 'GET' && request.pathname === '/api/v1/collection-cases') {
            const grant = authorizeQuery(context, 'collection:read');
            const items = await dependencies.collections.list({
              actor: context.actor,
              scopes: grant.scopes,
              anchors: grant.anchors,
            });
            return {
              statusCode: 200,
              body: {
                items: items.map((item) =>
                  permittedDto(item, context.permissions.get('collection:read')?.fields ?? null),
                ),
              },
            };
          }
          if (request.method === 'POST' && request.pathname === '/api/v1/collection-cases') {
            const body = objectBody(request.body);
            allow(body, [
              'caseNumber',
              'arOpenItemId',
              'assignedTo',
              'priority',
              'reason',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'collection:manage', Object.keys(body));
            const priority = string(body.priority, 'priority');
            if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority))
              throw new DomainError('invalid_request', 'priority is unsupported');
            const result = await dependencies.collections.createCase(
              {
                caseNumber: assertStableCode(string(body.caseNumber, 'caseNumber')),
                arOpenItemId: uuid(body.arOpenItemId, 'arOpenItemId'),
                assignedTo: uuid(body.assignedTo, 'assignedTo'),
                priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
                reason: string(body.reason, 'reason'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'collection:read') };
          }
          const followup = /^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/followups$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && followup) {
            const body = objectBody(request.body);
            allow(body, [
              'channel',
              'occurredAt',
              'contactPerson',
              'outcome',
              'nextActionAt',
              'evidence',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'collection:manage', Object.keys(body));
            const channel = string(body.channel, 'channel');
            if (!['PHONE', 'EMAIL', 'LETTER', 'MEETING', 'VISIT', 'OTHER'].includes(channel))
              throw new DomainError('invalid_request', 'channel is unsupported');
            const result = await dependencies.collections.addFollowup(
              uuid(followup[1], 'collectionCaseId'),
              {
                channel: channel as 'PHONE' | 'EMAIL' | 'LETTER' | 'MEETING' | 'VISIT' | 'OTHER',
                occurredAt: timestamp(body.occurredAt, 'occurredAt'),
                contactPerson: string(body.contactPerson, 'contactPerson'),
                outcome: string(body.outcome, 'outcome'),
                ...(body.nextActionAt
                  ? { nextActionAt: timestamp(body.nextActionAt, 'nextActionAt') }
                  : {}),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'collection:read') };
          }
          const promiseCreate = /^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/promises$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && promiseCreate) {
            const body = objectBody(request.body);
            allow(body, [
              'promisedAmount',
              'currency',
              'promisedAt',
              'dueAt',
              'debtorContact',
              'evidence',
              'idempotencyKey',
            ]);
            const grant = authorizeQuery(context, 'collection:manage', Object.keys(body));
            const result = await dependencies.collections.createPromise(
              uuid(promiseCreate[1], 'collectionCaseId'),
              {
                promisedAmount: decimal(body.promisedAmount, 'promisedAmount'),
                currency: currency(body.currency),
                promisedAt: timestamp(body.promisedAt, 'promisedAt'),
                dueAt: timestamp(body.dueAt, 'dueAt'),
                debtorContact: string(body.debtorContact, 'debtorContact'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'collection:read') };
          }
          const promiseDecision =
            /^\/api\/v1\/collection-promises\/([0-9a-f-]+)\/(fulfill|break|cancel)$/u.exec(
              request.pathname,
            );
          if (request.method === 'POST' && promiseDecision) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'allocationEntryIds', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'collection:escalate', Object.keys(body));
            const action = promiseDecision[2] ?? '';
            const result = await dependencies.collections.decidePromise(
              uuid(promiseDecision[1], 'promiseId'),
              action === 'fulfill' ? 'FULFILLED' : action === 'break' ? 'BROKEN' : 'CANCELLED',
              {
                reason: string(body.reason, 'reason'),
                allocationEntryIds: strings(
                  body.allocationEntryIds ?? [],
                  'allocationEntryIds',
                ).map((id) => uuid(id, 'allocationEntryId')),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'collection:read') };
          }
          const legalRequest = /^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/legal-handoffs$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && legalRequest) {
            const body = objectBody(request.body);
            allow(body, ['handoffNumber', 'reason', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'collection:escalate', Object.keys(body));
            const result = await dependencies.collections.requestLegal(
              uuid(legalRequest[1], 'collectionCaseId'),
              {
                handoffNumber: assertStableCode(string(body.handoffNumber, 'handoffNumber')),
                reason: string(body.reason, 'reason'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'legal-case:read') };
          }
          const legalDecision = /^\/api\/v1\/legal-handoffs\/([0-9a-f-]+)\/(accept|return)$/u.exec(
            request.pathname,
          );
          if (request.method === 'POST' && legalDecision) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'legal-case:decide', Object.keys(body));
            const result = await dependencies.collections.decideLegal(
              uuid(legalDecision[1], 'legalHandoffId'),
              legalDecision[2] === 'accept' ? 'ACCEPTED' : 'RETURNED',
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'legal-case:read') };
          }
          const evidencePackage =
            /^\/api\/v1\/legal-handoffs\/([0-9a-f-]+)\/evidence-packages$/u.exec(request.pathname);
          if (request.method === 'POST' && evidencePackage) {
            const body = objectBody(request.body);
            allow(body, ['packageNumber', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'debt-evidence:generate', Object.keys(body));
            const result = await dependencies.collections.generateEvidencePackage(
              uuid(evidencePackage[1], 'legalHandoffId'),
              {
                packageNumber: assertStableCode(string(body.packageNumber, 'packageNumber')),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'legal-case:read') };
          }
          const caseTransition =
            /^\/api\/v1\/collection-cases\/([0-9a-f-]+)\/(resolve|close)$/u.exec(request.pathname);
          if (request.method === 'POST' && caseTransition) {
            const body = objectBody(request.body);
            allow(body, ['reason', 'evidence', 'idempotencyKey']);
            const grant = authorizeQuery(context, 'collection:close', Object.keys(body));
            const result = await dependencies.collections.transitionCase(
              uuid(caseTransition[1], 'collectionCaseId'),
              caseTransition[2] === 'resolve' ? 'RESOLVED' : 'CLOSED',
              {
                reason: string(body.reason, 'reason'),
                evidence: jsonObject(body.evidence ?? {}, 'evidence'),
                idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
              },
              { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors },
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'collection:read') };
          }
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
          authorizeQuery(context, 'order-360:read');
          const orderGrant = authorizeQuery(context, 'sales-order:read');
          const aggregate = (await dependencies.order360.get(orderId, {
            actor: context.actor,
            scopes: orderGrant.scopes,
            anchors: orderGrant.anchors,
          })) as Record<string, unknown>;
          const sectionCapabilities = {
            customer: 'customer:read',
            opportunity: 'opportunity:read',
            technical: 'technical-solution:read',
            cost: 'cost:read',
            policy: 'sales-policy:read',
            quote: 'quote:read',
            credit: 'credit:read',
            contract: 'contract:read',
            receivables: 'ar:read',
            payments: 'bank-payment:read',
            reconciliations: 'reconciliation:read',
            commissions: 'commission:read',
            risks: 'risk:read',
            shipments: 'shipment:read',
            collections: 'collection:read',
          } as const satisfies Record<string, PermissionKey>;
          const body: Record<string, unknown> = {
            order: permittedDto(
              aggregate.order as Record<string, unknown>,
              context.permissions.get('sales-order:read')?.fields ?? null,
            ),
            anomalies: aggregate.anomalies,
          };
          for (const [section, capability] of Object.entries(sectionCapabilities)) {
            const grant = context.permissions.get(capability);
            if (!grant) continue;
            const value = aggregate[section];
            body[section] = Array.isArray(value)
              ? value.map((item) => permittedDto(item as Record<string, unknown>, grant.fields))
              : permittedDto(value as Record<string, unknown>, grant.fields);
          }
          const timelineCapability = (type: string): PermissionKey => {
            if (type.startsWith('QUOTE_')) return 'quote:read';
            if (type.startsWith('CREDIT_')) return 'credit:read';
            if (type.startsWith('CONTRACT_')) return 'contract:read';
            if (type.startsWith('AR_')) return 'ar:read';
            if (type.startsWith('PAYMENT_')) return 'bank-payment:read';
            if (type.startsWith('COMMISSION_')) return 'commission:read';
            if (type.startsWith('RISK_')) return 'risk:read';
            if (type.startsWith('SHIPMENT_')) return 'shipment:read';
            if (type.startsWith('COLLECTION_')) return 'collection:read';
            if (type.startsWith('LEGAL_HANDOFF_') || type.startsWith('DEBT_EVIDENCE_'))
              return 'legal-case:read';
            if (type.startsWith('OPPORTUNITY_')) return 'opportunity:read';
            return 'sales-order:read';
          };
          body.timeline = (aggregate.timeline as Record<string, unknown>[]).filter((event) => {
            const type = typeof event.type === 'string' ? event.type : '';
            return context.permissions.has(timelineCapability(type));
          });
          return { statusCode: 200, body };
        }
        if (request.method === 'PUT' && request.pathname === '/api/v1/auth/credential') {
          const body = objectBody(request.body);
          await dependencies.auth.changePassword(
            context,
            string(body.password, 'password'),
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const identityProvisionMatch = /^\/api\/v1\/employees\/([0-9a-f-]+)\/identity$/u.exec(
          request.pathname,
        );
        if (request.method === 'PUT' && identityProvisionMatch) {
          authorizeQuery(context, 'authorization:manage');
          const body = objectBody(request.body);
          allow(body, ['login', 'password']);
          await dependencies.auth.provisionIdentity(
            context,
            uuid(identityProvisionMatch[1], 'employeeId'),
            string(body.login, 'login'),
            string(body.password, 'password'),
            correlationId,
          );
          return { statusCode: 204, body: {} };
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
        const opportunityMatch = /^\/api\/v1\/opportunities(?:\/([0-9a-f-]+))?$/u.exec(
          request.pathname,
        );
        if (opportunityMatch) {
          if (!dependencies.commercial)
            return error(503, 'internal_error', 'Commercial dependency unavailable', correlationId);
          const id = opportunityMatch[1];
          if (request.method === 'GET') {
            const grant = authorizeQuery(context, 'opportunity:read');
            if (!id)
              return {
                statusCode: 200,
                body: {
                  items: (
                    await dependencies.commercial.listOpportunities(
                      context.actor,
                      grant.scopes,
                      grant.anchors,
                    )
                  ).map((item) =>
                    permittedDto(item, context.permissions.get('opportunity:read')?.fields ?? null),
                  ),
                },
              };
            const item = await dependencies.commercial.findOpportunity(
              uuid(id, 'opportunityId'),
              context.actor,
              grant.scopes,
              grant.anchors,
            );
            return item
              ? {
                  statusCode: 200,
                  body: permittedDto(
                    item,
                    context.permissions.get('opportunity:read')?.fields ?? null,
                  ),
                }
              : error(404, 'not_found', 'Opportunity not found', correlationId);
          }
          const body = objectBody(request.body);
          if (request.method === 'POST' && !id) {
            allow(body, [
              'customerId',
              'leadId',
              'name',
              'value',
              'currency',
              'probabilityBasisPoints',
              'expectedCloseDate',
            ]);
            authorizeQuery(context, 'opportunity:create', Object.keys(body));
            const result = await dependencies.commercial.createOpportunity(
              {
                customerId: body.customerId === null ? null : uuid(body.customerId, 'customerId'),
                leadId: body.leadId === null ? null : uuid(body.leadId, 'leadId'),
                name: string(body.name, 'name'),
                value: decimal(body.value, 'value'),
                currency: currency(body.currency),
                probabilityBasisPoints: integer(
                  body.probabilityBasisPoints,
                  'probabilityBasisPoints',
                  0,
                  10000,
                ),
                expectedCloseDate: string(body.expectedCloseDate, 'expectedCloseDate'),
              },
              context.actor,
              correlationId,
            );
            return { statusCode: 201, body: mutationDto(result, context, 'opportunity:read') };
          }
          if (request.method === 'PATCH' && id) {
            const transition = body.status !== undefined;
            allow(
              body,
              transition
                ? ['status', 'reason', 'expectedVersion']
                : [
                    'name',
                    'value',
                    'currency',
                    'probabilityBasisPoints',
                    'expectedCloseDate',
                    'expectedVersion',
                  ],
            );
            const capability = transition ? 'opportunity:lifecycle' : 'opportunity:update';
            const grant = authorizeQuery(
              context,
              capability,
              Object.keys(body).filter((key) => key !== 'expectedVersion' && key !== 'reason'),
            );
            const result = transition
              ? await dependencies.commercial.transitionOpportunity(
                  uuid(id, 'opportunityId'),
                  string(body.status, 'status') as never,
                  string(body.reason, 'reason'),
                  expectedVersion(body.expectedVersion),
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                  correlationId,
                )
              : await dependencies.commercial.updateOpportunity(
                  uuid(id, 'opportunityId'),
                  {
                    ...(body.name === undefined ? {} : { name: string(body.name, 'name') }),
                    ...(body.value === undefined ? {} : { value: decimal(body.value, 'value') }),
                    ...(body.currency === undefined ? {} : { currency: currency(body.currency) }),
                    ...(body.probabilityBasisPoints === undefined
                      ? {}
                      : {
                          probabilityBasisPoints: integer(
                            body.probabilityBasisPoints,
                            'probabilityBasisPoints',
                            0,
                            10000,
                          ),
                        }),
                    ...(body.expectedCloseDate === undefined
                      ? {}
                      : { expectedCloseDate: string(body.expectedCloseDate, 'expectedCloseDate') }),
                  },
                  expectedVersion(body.expectedVersion),
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                  correlationId,
                );
            return { statusCode: 200, body: mutationDto(result, context, 'opportunity:read') };
          }
        }
        const opportunityCtrs = /^\/api\/v1\/opportunities\/([0-9a-f-]+)\/ctrs$/u.exec(
          request.pathname,
        );
        if (request.method === 'GET' && opportunityCtrs && dependencies.commercial) {
          const grant = authorizeQuery(context, 'ctr:read');
          return {
            statusCode: 200,
            body: {
              items: (
                await dependencies.commercial.listCtrs(
                  uuid(opportunityCtrs[1], 'opportunityId'),
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                )
              ).map((item) =>
                permittedDto(item, context.permissions.get('ctr:read')?.fields ?? null),
              ),
            },
          };
        }
        const opportunitySolutions =
          /^\/api\/v1\/opportunities\/([0-9a-f-]+)\/technical-solutions$/u.exec(request.pathname);
        if (request.method === 'GET' && opportunitySolutions && dependencies.commercial) {
          const grant = authorizeQuery(context, 'technical-solution:read');
          return {
            statusCode: 200,
            body: {
              items: (
                await dependencies.commercial.listTechnicalSolutions(
                  uuid(opportunitySolutions[1], 'opportunityId'),
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                )
              ).map((item) =>
                permittedDto(
                  item,
                  context.permissions.get('technical-solution:read')?.fields ?? null,
                ),
              ),
            },
          };
        }
        const commercialReadViews = new Map<
          string,
          readonly [`${string}:${string}`, 'ctrs' | 'solutions' | 'costs' | 'policies' | 'quotes']
        >([
          ['/api/v1/ctrs', ['ctr:read', 'ctrs']],
          ['/api/v1/technical-solutions', ['technical-solution:read', 'solutions']],
          ['/api/v1/cost-evaluations', ['cost:read', 'costs']],
          ['/api/v1/sales-policy-evaluations', ['sales-policy:read', 'policies']],
          ['/api/v1/quotes', ['quote:read', 'quotes']],
        ] as const);
        const commercialRead = commercialReadViews.get(request.pathname);
        if (request.method === 'GET' && commercialRead && dependencies.commercial) {
          const grant = authorizeQuery(context, commercialRead[0]);
          return {
            statusCode: 200,
            body: {
              items: (
                await dependencies.commercial.listCommercialView(
                  commercialRead[1],
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                )
              ).map((item) =>
                permittedDto(item, context.permissions.get(commercialRead[0])?.fields ?? null),
              ),
            },
          };
        }
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/ctrs' &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, ['opportunityId', 'code', 'title', 'requirements']);
          const grant = authorizeQuery(context, 'ctr:create', Object.keys(body));
          const result = await dependencies.commercial.createCtr(
            {
              opportunityId: uuid(body.opportunityId, 'opportunityId'),
              code: string(body.code, 'code'),
              title: string(body.title, 'title'),
              requirements: jsonObject(body.requirements, 'requirements'),
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'ctr:read') };
        }
        const ctrRevision = /^\/api\/v1\/ctrs\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
        if (request.method === 'POST' && ctrRevision && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, ['title', 'requirements']);
          const grant = authorizeQuery(context, 'ctr:update', Object.keys(body));
          const result = await dependencies.commercial.createCtrVersion(
            uuid(ctrRevision[1], 'ctrId'),
            {
              title: string(body.title, 'title'),
              requirements: jsonObject(body.requirements, 'requirements'),
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'ctr:read') };
        }
        const ctrCommand = /^\/api\/v1\/ctr-versions\/([0-9a-f-]+)\/(submit|decision)$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && ctrCommand && dependencies.commercial) {
          const body = objectBody(request.body),
            versionId = uuid(ctrCommand[1], 'ctrVersionId');
          if (ctrCommand[2] === 'submit') {
            const grant = authorizeQuery(context, 'ctr:submit');
            allow(body, ['expectedVersion']);
            const result = await dependencies.commercial.submitCtr(
              versionId,
              version(body.expectedVersion),
              idempotency(request),
              context.actor,
              grant.scopes,
              grant.anchors,
              correlationId,
            );
            return { statusCode: 200, body: mutationDto(result, context, 'ctr:read') };
          }
          allow(body, ['decision', 'reason']);
          const grant = authorizeQuery(context, 'ctr:approve');
          const decision = string(body.decision, 'decision');
          if (!['APPROVED', 'REJECTED'].includes(decision))
            throw new DomainError('invalid_request', 'decision is unsupported');
          const result = await dependencies.commercial.approveCtr(
            versionId,
            decision as 'APPROVED' | 'REJECTED',
            string(body.reason, 'reason'),
            idempotency(request),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 200, body: mutationDto(result, context, 'ctr:read') };
        }
        const ctrAttachment = /^\/api\/v1\/ctr-versions\/([0-9a-f-]+)\/attachments$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && ctrAttachment && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, ['attachmentId']);
          const grant = authorizeQuery(context, 'ctr:update', Object.keys(body));
          const result = await dependencies.commercial.linkCtrAttachment(
            uuid(ctrAttachment[1], 'ctrVersionId'),
            uuid(body.attachmentId, 'attachmentId'),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'ctr:read') };
        }
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/technical-solutions' &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, [
            'opportunityId',
            'code',
            'ctrVersionId',
            'specification',
            'assumptions',
            'final',
          ]);
          const grant = authorizeQuery(context, 'technical-solution:create', Object.keys(body));
          const result = await dependencies.commercial.createTechnicalSolution(
            {
              opportunityId: uuid(body.opportunityId, 'opportunityId'),
              code: string(body.code, 'code'),
              ctrVersionId: uuid(body.ctrVersionId, 'ctrVersionId'),
              specification: jsonObject(body.specification, 'specification'),
              assumptions: strings(body.assumptions, 'assumptions'),
              final: body.final === true,
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'technical-solution:read') };
        }
        const solutionRevision = /^\/api\/v1\/technical-solutions\/([0-9a-f-]+)\/revisions$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && solutionRevision && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, ['ctrVersionId', 'specification', 'assumptions', 'final']);
          const grant = authorizeQuery(context, 'technical-solution:update', Object.keys(body));
          const result = await dependencies.commercial.createTechnicalSolutionRevision(
            uuid(solutionRevision[1], 'technicalSolutionId'),
            {
              ctrVersionId: uuid(body.ctrVersionId, 'ctrVersionId'),
              specification: jsonObject(body.specification, 'specification'),
              assumptions: strings(body.assumptions, 'assumptions'),
              final: body.final === true,
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'technical-solution:read') };
        }
        if (
          request.method === 'GET' &&
          request.pathname === '/api/v1/cost-matrix-summaries' &&
          dependencies.commercial
        ) {
          const grant = authorizeQuery(context, 'cost-matrix:read');
          const page = integer(Number(request.query?.page ?? 1), 'page', 1, 100000);
          const pageSize = integer(Number(request.query?.pageSize ?? 20), 'pageSize', 5, 100);
          const attention = request.query?.attention ?? 'ALL';
          if (
            !['ALL', 'NEEDS_INPUT', 'NEEDS_CALCULATION', 'READY_FOR_QUOTE', 'IN_QUOTE'].includes(
              attention,
            )
          )
            throw new DomainError('invalid_request', 'Invalid cost matrix attention filter');
          const sort = request.query?.sort ?? 'ATTENTION';
          if (!['ATTENTION', 'CODE', 'UPDATED', 'COST_DESC'].includes(sort))
            throw new DomainError('invalid_request', 'Invalid cost matrix sort');
          const result = await dependencies.commercial.listCostMatrixSummaries(
            {
              page,
              pageSize,
              query: request.query?.q?.trim().slice(0, 120) ?? '',
              productFamily: request.query?.productFamily?.trim().slice(0, 80) ?? '',
              attention: attention as
                | 'ALL'
                | 'NEEDS_INPUT'
                | 'NEEDS_CALCULATION'
                | 'READY_FOR_QUOTE'
                | 'IN_QUOTE',
              sort: sort as 'ATTENTION' | 'CODE' | 'UPDATED' | 'COST_DESC',
            },
            context.actor,
            grant.scopes,
          );
          return { statusCode: 200, body: { ...result, page, pageSize } };
        }
        if (
          request.method === 'GET' &&
          request.pathname === '/api/v1/cost-matrices' &&
          dependencies.commercial
        ) {
          const grant = authorizeQuery(context, 'cost-matrix:read');
          return {
            statusCode: 200,
            body: {
              items: await dependencies.commercial.listCostMatrices(context.actor, grant.scopes),
            },
          };
        }
        const costMatrixDetail = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (request.method === 'GET' && costMatrixDetail && dependencies.commercial) {
          const grant = authorizeQuery(context, 'cost-matrix:read');
          return {
            statusCode: 200,
            body: await dependencies.commercial.getCostMatrix(
              uuid(costMatrixDetail[1], 'modelId'),
              context.actor,
              grant.scopes,
              context.permissions.get('audit:read')?.scopes.includes('COMPANY') === true,
            ),
          };
        }
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/cost-matrices' &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, [
            'code',
            'name',
            'productItemVersionId',
            'productSpecification',
            'currency',
            'defaultTaxRate',
          ]);
          const grant = authorizeQuery(context, 'cost-matrix:manage', Object.keys(body));
          const result = await dependencies.commercial.createCostMatrix(
            {
              code: string(body.code, 'code'),
              name: string(body.name, 'name'),
              ...(body.productItemVersionId
                ? { productItemVersionId: uuid(body.productItemVersionId, 'productItemVersionId') }
                : {}),
              productSpecification: jsonObject(
                body.productSpecification ?? {},
                'productSpecification',
              ),
              currency: currency(body.currency),
              defaultTaxRate: decimal(body.defaultTaxRate, 'defaultTaxRate'),
            },
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 201, body: result };
        }
        const costMatrixFactor = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/factors$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && costMatrixFactor && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, [
            'factorCode',
            'factorName',
            'category',
            'sourceType',
            'sourceItemVersionId',
            'quantity',
            'unitCode',
            'manualUnitPriceTaxInclusive',
            'taxRate',
            'priceSourceName',
            'priceSourceReference',
            'priceEffectiveAt',
            'priceNote',
            'adjustable',
            'sortOrder',
          ]);
          const grant = authorizeQuery(context, 'cost-matrix:manage', Object.keys(body));
          const sourceType = costFactorSourceType(body.sourceType);
          requireCostFactorItemSource(sourceType, body.sourceItemVersionId);
          const result = await dependencies.commercial.addCostMatrixFactor(
            uuid(costMatrixFactor[1], 'modelId'),
            {
              factorCode: string(body.factorCode, 'factorCode'),
              factorName: string(body.factorName, 'factorName'),
              category: string(body.category, 'category'),
              sourceType,
              ...(body.sourceItemVersionId
                ? { sourceItemVersionId: uuid(body.sourceItemVersionId, 'sourceItemVersionId') }
                : {}),
              quantity: decimal(body.quantity, 'quantity'),
              unitCode: string(body.unitCode, 'unitCode'),
              manualUnitPriceTaxInclusive: decimal(
                body.manualUnitPriceTaxInclusive,
                'manualUnitPriceTaxInclusive',
              ),
              taxRate: decimal(body.taxRate, 'taxRate'),
              priceSourceName: string(body.priceSourceName, 'priceSourceName'),
              ...(body.priceSourceReference
                ? {
                    priceSourceReference: string(body.priceSourceReference, 'priceSourceReference'),
                  }
                : {}),
              ...(body.priceEffectiveAt
                ? { priceEffectiveAt: calendarDate(body.priceEffectiveAt, 'priceEffectiveAt') }
                : {}),
              ...(body.priceNote ? { priceNote: string(body.priceNote, 'priceNote') } : {}),
              adjustable: body.adjustable !== false,
              sortOrder: integer(body.sortOrder ?? 0, 'sortOrder', 0, 10000),
            },
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 201, body: result };
        }
        const costMatrixFactorUpdate =
          /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/factors\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (request.method === 'PATCH' && costMatrixFactorUpdate && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, [
            'factorName',
            'category',
            'sourceType',
            'sourceItemVersionId',
            'quantity',
            'unitCode',
            'manualUnitPriceTaxInclusive',
            'taxRate',
            'priceSourceName',
            'priceSourceReference',
            'priceEffectiveAt',
            'priceNote',
            'adjustable',
            'sortOrder',
          ]);
          const grant = authorizeQuery(context, 'cost-matrix:manage', Object.keys(body));
          const sourceType = costFactorSourceType(body.sourceType);
          requireCostFactorItemSource(sourceType, body.sourceItemVersionId);
          const result = await dependencies.commercial.updateCostMatrixFactor(
            uuid(costMatrixFactorUpdate[1], 'modelId'),
            uuid(costMatrixFactorUpdate[2], 'factorId'),
            {
              factorName: string(body.factorName, 'factorName'),
              category: string(body.category, 'category'),
              sourceType,
              ...(body.sourceItemVersionId
                ? { sourceItemVersionId: uuid(body.sourceItemVersionId, 'sourceItemVersionId') }
                : {}),
              quantity: decimal(body.quantity, 'quantity'),
              unitCode: string(body.unitCode, 'unitCode'),
              manualUnitPriceTaxInclusive: decimal(
                body.manualUnitPriceTaxInclusive,
                'manualUnitPriceTaxInclusive',
              ),
              taxRate: decimal(body.taxRate, 'taxRate'),
              priceSourceName: string(body.priceSourceName, 'priceSourceName'),
              ...(body.priceSourceReference
                ? {
                    priceSourceReference: string(body.priceSourceReference, 'priceSourceReference'),
                  }
                : {}),
              ...(body.priceEffectiveAt
                ? { priceEffectiveAt: calendarDate(body.priceEffectiveAt, 'priceEffectiveAt') }
                : {}),
              ...(body.priceNote ? { priceNote: string(body.priceNote, 'priceNote') } : {}),
              adjustable: body.adjustable !== false,
              sortOrder: integer(body.sortOrder ?? 0, 'sortOrder', 0, 10000),
            },
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 200, body: result };
        }
        const costMatrixCalculate = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/calculate$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && costMatrixCalculate && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, ['pricingMode']);
          const grant = authorizeQuery(context, 'cost-matrix:calculate', Object.keys(body));
          const mode = string(body.pricingMode, 'pricingMode');
          if (mode !== 'TAX_INCLUSIVE' && mode !== 'TAX_EXCLUSIVE')
            throw new DomainError(
              'invalid_request',
              'pricingMode must be TAX_INCLUSIVE or TAX_EXCLUSIVE',
            );
          const result = await dependencies.commercial.calculateCostMatrix(
            uuid(costMatrixCalculate[1], 'modelId'),
            mode,
            idempotency(request),
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 201, body: result };
        }
        const matrixQuoteCost =
          /^\/api\/v1\/cost-matrix-calculations\/([0-9a-f-]+)\/quote-cost-decision$/u.exec(
            request.pathname,
          );
        if (request.method === 'POST' && matrixQuoteCost && dependencies.commercial) {
          const body = objectBody(request.body);
          allow(body, ['technicalSolutionRevisionId', 'modelVersionId']);
          const grant = authorizeQuery(context, 'cost:evaluate', Object.keys(body));
          const result = await dependencies.commercial.createQuoteCostDecisionFromMatrix(
            uuid(matrixQuoteCost[1], 'calculationId'),
            {
              technicalSolutionRevisionId: uuid(
                body.technicalSolutionRevisionId,
                'technicalSolutionRevisionId',
              ),
              modelVersionId: uuid(body.modelVersionId, 'modelVersionId'),
              idempotencyKey: idempotency(request),
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'cost:read') };
        }
        if (
          request.method === 'GET' &&
          (request.pathname === '/api/v1/cost-models' ||
            request.pathname === '/api/v1/sales-policies') &&
          dependencies.commercial
        ) {
          const cost = request.pathname.endsWith('cost-models');
          const grant = authorizeQuery(context, cost ? 'cost-model:read' : 'sales-policy:read');
          return {
            statusCode: 200,
            body: {
              items: await dependencies.commercial.listDefinitions(
                cost ? 'cost' : 'policy',
                context.actor,
                grant.scopes,
              ),
            },
          };
        }
        if (
          request.method === 'POST' &&
          (request.pathname === '/api/v1/cost-models' ||
            request.pathname === '/api/v1/sales-policies') &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body),
            cost = request.pathname.endsWith('cost-models');
          allow(
            body,
            cost
              ? ['code', 'name', 'currency', 'rules', 'publish']
              : ['code', 'name', 'rules', 'publish'],
          );
          const grant = authorizeQuery(
            context,
            cost ? 'cost-model:manage' : 'sales-policy:manage',
            Object.keys(body),
          );
          const result = await dependencies.commercial.createDefinition(
            cost ? 'cost' : 'policy',
            {
              code: string(body.code, 'code'),
              name: string(body.name, 'name'),
              ...(cost ? { currency: currency(body.currency) } : {}),
              rules: array(body.rules, 'rules'),
              publish: body.publish === true,
            },
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 201, body: result };
        }
        const definitionRevision =
          /^\/api\/v1\/(cost-models|sales-policies)\/([0-9a-f-]+)\/versions$/u.exec(
            request.pathname,
          );
        if (request.method === 'POST' && definitionRevision && dependencies.commercial) {
          const body = objectBody(request.body),
            cost = definitionRevision[1] === 'cost-models';
          allow(body, cost ? ['currency', 'rules', 'publish'] : ['rules', 'publish']);
          const grant = authorizeQuery(
            context,
            cost ? 'cost-model:manage' : 'sales-policy:manage',
            Object.keys(body),
          );
          const result = await dependencies.commercial.createDefinitionVersion(
            cost ? 'cost' : 'policy',
            uuid(definitionRevision[2], 'definitionId'),
            {
              ...(cost ? { currency: currency(body.currency) } : {}),
              rules: array(body.rules, 'rules'),
              publish: body.publish === true,
            },
            context.actor,
            grant.scopes,
            correlationId,
          );
          return { statusCode: 201, body: result };
        }
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/cost-evaluations' &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, [
            'modelVersionId',
            'technicalSolutionRevisionId',
            'currency',
            'lines',
            'context',
          ]);
          const grant = authorizeQuery(context, 'cost:evaluate', Object.keys(body));
          const lines = array(body.lines, 'lines').map((candidate, index) => {
            const line = jsonObject(candidate, `lines[${String(index)}]`) as Record<
              string,
              unknown
            >;
            return {
              key: string(line.key, 'key'),
              description: string(line.description, 'description'),
              quantity: {
                value: decimal(line.quantity, 'quantity'),
                unit: string(line.unit, 'unit'),
              },
              unitCost: {
                amount: decimal(line.unitCost, 'unitCost'),
                currency: currency(line.currency),
              },
            };
          });
          const result = await dependencies.commercial.evaluateCost(
            {
              modelVersionId: uuid(body.modelVersionId, 'modelVersionId'),
              technicalSolutionRevisionId: uuid(
                body.technicalSolutionRevisionId,
                'technicalSolutionRevisionId',
              ),
              currency: currency(body.currency),
              lines,
              context: jsonObject(body.context, 'context'),
              idempotencyKey: idempotency(request),
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'cost:read') };
        }
        if (
          request.method === 'POST' &&
          request.pathname === '/api/v1/sales-policy-evaluations' &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, ['policyVersionId', 'costDecisionId', 'context']);
          const grant = authorizeQuery(context, 'sales-policy:evaluate', Object.keys(body));
          const result = await dependencies.commercial.evaluatePolicy(
            {
              policyVersionId: uuid(body.policyVersionId, 'policyVersionId'),
              costDecisionId: uuid(body.costDecisionId, 'costDecisionId'),
              context: jsonObject(body.context, 'context'),
              idempotencyKey: idempotency(request),
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'sales-policy:read') };
        }
        const quoteRevision = /^\/api\/v1\/quotes\/([0-9a-f-]+)\/revisions$/u.exec(
          request.pathname,
        );
        if (
          request.method === 'POST' &&
          (request.pathname === '/api/v1/quotes' || quoteRevision) &&
          dependencies.commercial
        ) {
          const body = objectBody(request.body);
          allow(body, [
            'quoteNumber',
            'opportunityId',
            'ctrVersionId',
            'technicalSolutionRevisionId',
            'costDecisionId',
            'policyVersionId',
            'policyEvaluationId',
            'currency',
            'subtotal',
            'discount',
            'total',
            'costTotal',
            'margin',
            'marginBasisPoints',
            'validUntil',
            'lines',
          ]);
          const grant = authorizeQuery(
            context,
            quoteRevision ? 'quote:update' : 'quote:create',
            Object.keys(body),
          );
          const lines = array(body.lines, 'lines').map((candidate, index) => {
            const line = jsonObject(candidate, `lines[${String(index)}]`) as Record<
              string,
              unknown
            >;
            return {
              description: string(line.description, 'description'),
              quantity: decimal(line.quantity, 'quantity'),
              unitCode: string(line.unitCode, 'unitCode'),
              unitPrice: decimal(line.unitPrice, 'unitPrice'),
              total: decimal(line.total, 'total'),
            };
          });
          const result = await dependencies.commercial.createQuote(
            {
              ...(quoteRevision ? { quoteId: uuid(quoteRevision[1], 'quoteId') } : {}),
              quoteNumber: string(body.quoteNumber, 'quoteNumber'),
              opportunityId: uuid(body.opportunityId, 'opportunityId'),
              ctrVersionId: uuid(body.ctrVersionId, 'ctrVersionId'),
              technicalSolutionRevisionId: uuid(
                body.technicalSolutionRevisionId,
                'technicalSolutionRevisionId',
              ),
              costDecisionId: uuid(body.costDecisionId, 'costDecisionId'),
              policyVersionId: uuid(body.policyVersionId, 'policyVersionId'),
              policyEvaluationId: uuid(body.policyEvaluationId, 'policyEvaluationId'),
              currency: currency(body.currency),
              subtotal: decimal(body.subtotal, 'subtotal'),
              discount: decimal(body.discount, 'discount'),
              total: decimal(body.total, 'total'),
              costTotal: decimal(body.costTotal, 'costTotal'),
              margin: decimal(body.margin, 'margin', false),
              marginBasisPoints: integer(
                body.marginBasisPoints,
                'marginBasisPoints',
                -100000,
                10000,
              ),
              validUntil: timestamp(body.validUntil, 'validUntil'),
              lines,
            },
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 201, body: mutationDto(result, context, 'quote:read') };
        }
        const quoteCommand = /^\/api\/v1\/quote-revisions\/([0-9a-f-]+)\/(approve|issue)$/u.exec(
          request.pathname,
        );
        if (request.method === 'POST' && quoteCommand && dependencies.commercial) {
          const id = uuid(quoteCommand[1], 'quoteRevisionId'),
            body = objectBody(request.body);
          if (quoteCommand[2] === 'issue') {
            allow(body, []);
            const grant = authorizeQuery(context, 'quote:issue');
            return {
              statusCode: 200,
              body: mutationDto(
                await dependencies.commercial.issueQuote(
                  id,
                  idempotency(request),
                  context.actor,
                  grant.scopes,
                  grant.anchors,
                  correlationId,
                ),
                context,
                'quote:read',
              ),
            };
          }
          allow(body, ['decision', 'reason']);
          const grant = authorizeQuery(context, 'quote:approve');
          const decision = string(body.decision, 'decision');
          if (!['APPROVED', 'REJECTED'].includes(decision))
            throw new DomainError('invalid_request', 'decision is unsupported');
          return {
            statusCode: 200,
            body: mutationDto(
              await dependencies.commercial.approveQuote(
                id,
                decision as 'APPROVED' | 'REJECTED',
                string(body.reason, 'reason'),
                idempotency(request),
                context.actor,
                grant.scopes,
                grant.anchors,
                correlationId,
              ),
              context,
              'quote:read',
            ),
          };
        }
        const customerMatch =
          /^\/api\/v1\/customers(?:\/([0-9a-f-]+))?(?:\/(contacts|ownership|activities|360))?$/u.exec(
            request.pathname,
          );
        if (customerMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const id = customerMatch[1],
            nested = customerMatch[2];
          if (request.method === 'GET' && !id) {
            const g = authorizeQuery(context, 'customer:read');
            const fields = context.permissions.get('customer:read')?.fields ?? null;
            return {
              statusCode: 200,
              body: {
                items: (
                  await dependencies.crm.listCustomers(context.actor, g.scopes, g.anchors)
                ).map((item) => permittedDto(item, fields)),
                nextCursor: null,
              },
            };
          }
          if (request.method === 'POST' && !id) {
            authorizeQuery(context, 'customer:create', ['name', 'customerNumber', 'tags']);
            const b = objectBody(request.body);
            allow(b, ['name', 'customerNumber', 'tags']);
            return {
              statusCode: 201,
              body: mutationDto(
                await dependencies.crm.createCustomer(
                  {
                    name: string(b.name, 'name'),
                    customerNumber: string(b.customerNumber, 'customerNumber'),
                    tags: b.tags === undefined ? [] : strings(b.tags, 'tags'),
                  },
                  context.actor,
                  correlationId,
                ),
                context,
                'customer:read',
              ),
            };
          }
          if (request.method === 'POST' && id && nested === 'ownership') {
            const capability =
              objectBody(request.body).reassignment === true
                ? 'customer-ownership:reassign'
                : 'customer-ownership:assign';
            const grant = authorizeQuery(context, capability);
            const b = objectBody(request.body);
            allow(b, ['assigneeId', 'expectedVersion', 'reason', 'reassignment']);
            return {
              statusCode: 200,
              body: mutationDto(
                await dependencies.crm.assign(
                  'CUSTOMER',
                  uuid(id, 'customerId'),
                  uuid(b.assigneeId, 'assigneeId'),
                  expectedVersion(b.expectedVersion),
                  string(b.reason, 'reason'),
                  context.actor,
                  correlationId,
                  b.reassignment === true,
                  grant.scopes,
                  grant.anchors,
                ),
                context,
                'customer:read',
              ),
            };
          }
          if (request.method === 'POST' && id && nested === 'activities') {
            const grant = authorizeQuery(context, 'customer-activity:create', [
              'leadId',
              'type',
              'occurredAt',
              'summary',
              'details',
            ]);
            const key = request.headers?.['idempotency-key'];
            if (!key || key.length > 128)
              throw new DomainError(
                'invalid_request',
                'Idempotency-Key is required and must be at most 128 characters',
              );
            const b = objectBody(request.body);
            allow(b, ['leadId', 'type', 'occurredAt', 'summary', 'details']);
            const details = (
              b.details === undefined ? {} : objectBody(b.details)
            ) as import('@kingturf/types').JsonObject;
            return {
              statusCode: 201,
              body: mutationDto(
                await dependencies.crm.createActivity(
                  uuid(id, 'customerId'),
                  {
                    leadId:
                      b.leadId === null || b.leadId === undefined ? null : uuid(b.leadId, 'leadId'),
                    type: string(b.type, 'type'),
                    occurredAt: timestamp(b.occurredAt, 'occurredAt'),
                    summary: string(b.summary, 'summary'),
                    details,
                  },
                  context.actor,
                  correlationId,
                  key,
                  grant.scopes,
                  grant.anchors,
                ),
                context,
                'customer-activity:read',
              ),
            };
          }
          if (request.method === 'PATCH' && id && !nested) {
            const grant = authorizeQuery(context, 'customer:lifecycle', ['status', 'reason']);
            const b = objectBody(request.body);
            allow(b, ['status', 'reason', 'expectedVersion']);
            return {
              statusCode: 200,
              body: mutationDto(
                await dependencies.crm.transitionCustomer(
                  uuid(id, 'customerId'),
                  string(b.status, 'status') as import('@kingturf/types').CustomerStatus,
                  expectedVersion(b.expectedVersion),
                  string(b.reason, 'reason'),
                  context.actor,
                  correlationId,
                  grant.scopes,
                  grant.anchors,
                ),
                context,
                'customer:read',
              ),
            };
          }
          if (request.method === 'GET' && id && nested === '360') {
            const readGrant = authorizeQuery(context, 'customer:read');
            const g = authorizeQuery(context, 'customer-360:read');
            const customerId = uuid(id, 'customerId');
            const readable = await dependencies.crm.findCustomer(
              customerId,
              context.actor,
              readGrant.scopes,
              readGrant.anchors,
            );
            if (!readable) return error(404, 'not_found', 'Customer not found', correlationId);
            const fields = context.permissions.get('customer-360:read')?.fields;
            const sectionGrant = (capability: PermissionKey) => {
              if (!context.permissions.has(capability)) return undefined;
              const grant = authorizeQuery(context, capability);
              return { scopes: grant.scopes, anchors: grant.anchors };
            };
            const ownership = sectionGrant('customer-ownership:read');
            const leads = sectionGrant('lead:read');
            const opportunities = sectionGrant('opportunity:read');
            const activities = sectionGrant('customer-activity:read');
            const found = await dependencies.crm.customer360(
              customerId,
              context.actor,
              g.scopes,
              g.anchors,
              {
                email: fields === null || fields?.includes('contacts.email') === true,
                phone: fields === null || fields?.includes('contacts.phone') === true,
              },
              {
                ...(ownership ? { ownership } : {}),
                ...(leads ? { leads } : {}),
                ...(opportunities ? { opportunities } : {}),
                ...(activities ? { activities } : {}),
              },
            );
            const project = <T extends Record<string, unknown>>(
              prefix: string,
              item: T,
              sectionCapability?: PermissionKey,
            ) => {
              const viewFields =
                fields === null
                  ? null
                  : (fields ?? [])
                      .filter((field) => field.startsWith(`${prefix}.`))
                      .map((field) => field.slice(prefix.length + 1));
              const sectionFields = sectionCapability
                ? (context.permissions.get(sectionCapability)?.fields ?? null)
                : null;
              const effectiveFields =
                viewFields === null
                  ? sectionFields
                  : sectionFields === null
                    ? viewFields
                    : viewFields.filter((field) => sectionFields.includes(field));
              return permittedDto(item, effectiveFields);
            };
            return found
              ? {
                  statusCode: 200,
                  body: {
                    customer: project('customer', found.customer, 'customer:read'),
                    contacts: found.contacts.map((item) => project('contacts', item)),
                    ownership: found.ownership.map((item) =>
                      project('ownership', item, 'customer-ownership:read'),
                    ),
                    leads: found.leads.map((item) => project('leads', item, 'lead:read')),
                    opportunities: found.opportunities.map((item) =>
                      project('opportunities', item, 'opportunity:read'),
                    ),
                    activities: found.activities.map((item) =>
                      project('activities', item, 'customer-activity:read'),
                    ),
                    unavailableSections: found.unavailableSections,
                  },
                }
              : error(404, 'not_found', 'Customer not found', correlationId);
          }
          if (request.method === 'POST' && id && nested === 'contacts') {
            const grant = authorizeQuery(context, 'customer:update', ['contacts']);
            const b = objectBody(request.body);
            allow(b, ['name', 'title', 'email', 'phone', 'primary']);
            if (b.email !== undefined && b.email !== null && typeof b.email !== 'string')
              throw new DomainError('invalid_request', 'email must be a string');
            if (b.phone !== undefined && b.phone !== null && typeof b.phone !== 'string')
              throw new DomainError('invalid_request', 'phone must be a string');
            const email = typeof b.email === 'string' ? normalizeContactEmail(b.email) : null;
            const phone = typeof b.phone === 'string' ? normalizeContactPhone(b.phone) : null;
            if (email === null && phone === null)
              throw new DomainError('invalid_request', 'Contact email or phone is required');
            return {
              statusCode: 201,
              body: mutationDto(
                await dependencies.crm.createContact(
                  uuid(id, 'customerId'),
                  {
                    name: string(b.name, 'name'),
                    title: typeof b.title === 'string' ? b.title : null,
                    email,
                    phone,
                    primary: b.primary === true,
                  },
                  context.actor,
                  correlationId,
                  grant.scopes,
                  grant.anchors,
                ),
                context,
                'customer-360:read',
              ),
            };
          }
          if (request.method === 'GET' && id && !nested) {
            const g = authorizeQuery(context, 'customer:read');
            const found = await dependencies.crm.findCustomer(
              uuid(id, 'customerId'),
              context.actor,
              g.scopes,
              g.anchors,
            );
            return found
              ? {
                  statusCode: 200,
                  body: permittedDto(
                    found,
                    context.permissions.get('customer:read')?.fields ?? null,
                  ),
                }
              : error(404, 'not_found', 'Customer not found', correlationId);
          }
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/leads') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const g = authorizeQuery(context, 'lead:read');
          const fields = context.permissions.get('lead:read')?.fields ?? null;
          return {
            statusCode: 200,
            body: {
              items: (await dependencies.crm.listLeads(context.actor, g.scopes, g.anchors)).map(
                (item) => permittedDto(item, fields),
              ),
              nextCursor: null,
            },
          };
        }
        if (request.method === 'POST' && request.pathname === '/api/v1/leads') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const grant = authorizeQuery(context, 'lead:create', [
            'title',
            'source',
            'customerId',
            'pool',
          ]);
          const b = objectBody(request.body);
          allow(b, ['title', 'source', 'customerId', 'pool']);
          return {
            statusCode: 201,
            body: mutationDto(
              await dependencies.crm.createLead(
                {
                  title: string(b.title, 'title'),
                  source: string(b.source, 'source'),
                  customerId:
                    b.customerId === null || b.customerId === undefined
                      ? null
                      : uuid(b.customerId, 'customerId'),
                  pool: b.pool === true,
                },
                context.actor,
                correlationId,
                grant.scopes,
                grant.anchors,
              ),
              context,
              'lead:read',
            ),
          };
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/leads/pool') {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const g = authorizeQuery(context, 'lead-pool:read');
          const fields = context.permissions.get('lead-pool:read')?.fields ?? null;
          return {
            statusCode: 200,
            body: {
              items: (
                await dependencies.crm.listLeads(context.actor, g.scopes, g.anchors, true)
              ).map((item) => permittedDto(item, fields)),
              nextCursor: null,
            },
          };
        }
        const claimMatch = /^\/api\/v1\/leads\/([0-9a-f-]+)\/claim$/u.exec(request.pathname);
        if (request.method === 'POST' && claimMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const grant = authorizeQuery(context, 'lead-pool:claim');
          const key = request.headers?.['idempotency-key'];
          if (!key || key.length > 128)
            throw new DomainError(
              'invalid_request',
              'Idempotency-Key is required and must be at most 128 characters',
            );
          const b = objectBody(request.body);
          allow(b, ['expectedVersion']);
          return {
            statusCode: 200,
            body: mutationDto(
              await dependencies.crm.claimLead(
                uuid(claimMatch[1], 'leadId'),
                expectedVersion(b.expectedVersion),
                context.actor,
                correlationId,
                key,
                grant.scopes,
                grant.anchors,
              ),
              context,
              'lead:read',
            ),
          };
        }
        const leadActionMatch =
          /^\/api\/v1\/leads\/([0-9a-f-]+)\/(transition|assign|reassign|release)$/u.exec(
            request.pathname,
          );
        if (request.method === 'POST' && leadActionMatch) {
          if (!dependencies.crm)
            return error(503, 'internal_error', 'CRM dependency unavailable', correlationId);
          const id = uuid(leadActionMatch[1], 'leadId'),
            action = leadActionMatch[2],
            b = objectBody(request.body);
          if (action === 'assign' || action === 'reassign') {
            const grant = authorizeQuery(
              context,
              action === 'assign' ? 'lead:assign' : 'lead:reassign',
            );
            allow(b, ['assigneeId', 'expectedVersion', 'reason']);
            return {
              statusCode: 200,
              body: mutationDto(
                await dependencies.crm.assign(
                  'LEAD',
                  id,
                  uuid(b.assigneeId, 'assigneeId'),
                  expectedVersion(b.expectedVersion),
                  string(b.reason, 'reason'),
                  context.actor,
                  correlationId,
                  action === 'reassign',
                  grant.scopes,
                  grant.anchors,
                ),
                context,
                'lead:read',
              ),
            };
          }
          const grant = authorizeQuery(
            context,
            action === 'release' ? 'lead-pool:release' : 'lead:lifecycle',
            ['status', 'reason'],
          );
          allow(
            b,
            action === 'release'
              ? ['expectedVersion', 'reason']
              : ['status', 'expectedVersion', 'reason'],
          );
          return {
            statusCode: 200,
            body: mutationDto(
              await dependencies.crm.transitionLead(
                id,
                action === 'release'
                  ? 'POOL'
                  : (string(b.status, 'status') as import('@kingturf/types').LeadStatus),
                expectedVersion(b.expectedVersion),
                string(b.reason, 'reason'),
                context.actor,
                correlationId,
                grant.scopes,
                grant.anchors,
                action === 'release' ? 'CLAIMED' : undefined,
              ),
              context,
              'lead:read',
            ),
          };
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
        const authorizationMatch =
          /^\/api\/v1\/(roles|permissions|grants|assignments|scope-grants)(?:\/([0-9a-f-]+))?$/u.exec(
            request.pathname,
          );
        if (authorizationMatch) {
          const resource = authorizationMatch[1];
          const atomicCapability: PermissionKey =
            resource === 'roles'
              ? `role:${request.method === 'GET' ? 'read' : 'manage'}`
              : resource === 'permissions'
                ? `permission:${request.method === 'GET' ? 'read' : 'manage'}`
                : resource === 'assignments'
                  ? `role-assignment:${request.method === 'GET' ? 'read' : 'manage'}`
                  : resource === 'scope-grants'
                    ? `data-scope:${request.method === 'GET' ? 'read' : 'manage'}`
                    : `role:${request.method === 'GET' ? 'read' : 'manage'}`;
          authorizeOneOf(
            context,
            atomicCapability,
            `authorization:${request.method === 'GET' ? 'read' : 'manage'}`,
          );
          const repository = dependencies.authorization;
          if (!repository)
            return error(
              503,
              'internal_error',
              'Authorization repository is unavailable',
              correlationId,
            );
          const b =
            request.method === 'GET' ||
            (request.method === 'DELETE' && Boolean(authorizationMatch[2]))
              ? {}
              : objectBody(request.body);
          const itemId = authorizationMatch[2];
          if (resource === 'roles' && !itemId) {
            if (request.method === 'GET')
              return { statusCode: 200, body: await repository.listRoles(context.actor.companyId) };
            if (request.method === 'POST') {
              allow(b, ['code', 'name']);
              return {
                statusCode: 201,
                body: await repository.createRole(
                  { code: string(b.code, 'code'), name: string(b.name, 'name') },
                  context.actor,
                  correlationId,
                ),
              };
            }
          }
          if (resource === 'permissions' && !itemId) {
            if (request.method === 'GET')
              return { statusCode: 200, body: await repository.listPermissions() };
            if (request.method === 'POST') {
              allow(b, ['capability', 'description']);
              const value = string(b.capability, 'capability');
              if (!CAPABILITY.test(value))
                throw new DomainError(
                  'invalid_request',
                  'capability must use resource:action syntax',
                );
              return {
                statusCode: 201,
                body: await repository.createPermission(
                  {
                    capability: value as PermissionKey,
                    description: string(b.description, 'description'),
                  },
                  context.actor,
                  correlationId,
                ),
              };
            }
          }
          if (resource === 'grants' && !itemId) {
            if (request.method === 'GET')
              return {
                statusCode: 200,
                body: await repository.listGrants(context.actor.companyId),
              };
            allow(b, ['roleId', 'permissionId', 'scopes', 'fields']);
            const roleId = uuid(b.roleId, 'roleId'),
              permissionId = uuid(b.permissionId, 'permissionId');
            if (request.method === 'POST') {
              const fields =
                b.fields === null || b.fields === undefined ? null : strings(b.fields, 'fields');
              if (fields?.some((field) => !/^[A-Za-z][A-Za-z0-9]*$/u.test(field)))
                throw new DomainError(
                  'invalid_request',
                  'fields contains an unsupported field name',
                );
              await repository.grant(
                { roleId, permissionId, scopes: scopes(b.scopes), fields },
                context.actor,
                correlationId,
              );
              return { statusCode: 204, body: {} };
            }
            if (request.method === 'DELETE') {
              await repository.revoke(roleId, permissionId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
          }
          if (resource === 'assignments' && !itemId) {
            if (request.method === 'GET')
              return {
                statusCode: 200,
                body: await repository.listAssignments(context.actor.companyId),
              };
            allow(b, ['employeeId', 'roleId']);
            const employeeId = uuid(b.employeeId, 'employeeId'),
              roleId = uuid(b.roleId, 'roleId');
            if (request.method === 'POST') {
              await repository.assign(employeeId, roleId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
            if (request.method === 'DELETE') {
              await repository.unassign(employeeId, roleId, context.actor, correlationId);
              return { statusCode: 204, body: {} };
            }
          }
          if (resource === 'scope-grants') {
            if (request.method === 'GET' && !itemId)
              return {
                statusCode: 200,
                body: await repository.listScopeGrants(context.actor.companyId),
              };
            if (request.method === 'POST' && !itemId) {
              allow(b, ['employeeId', 'permissionId', 'scope', 'organizationId']);
              const selected = scopes([b.scope])[0];
              if (!selected) throw new DomainError('invalid_request', 'scope is required');
              const organizationId =
                b.organizationId === null || b.organizationId === undefined
                  ? null
                  : uuid(b.organizationId, 'organizationId');
              const typed =
                selected === 'TEAM' || selected === 'DEPARTMENT' || selected === 'REGION';
              if (typed !== Boolean(organizationId))
                throw new DomainError(
                  'invalid_request',
                  typed
                    ? 'Typed scopes require organizationId'
                    : 'SELF, COMPANY, and GROUP do not accept organizationId',
                );
              return {
                statusCode: 201,
                body: await repository.grantScope(
                  {
                    employeeId: uuid(b.employeeId, 'employeeId'),
                    permissionId: uuid(b.permissionId, 'permissionId'),
                    scope: selected,
                    organizationId,
                  },
                  context.actor,
                  correlationId,
                ),
              };
            }
            if (request.method === 'DELETE' && itemId) {
              allow(b, []);
              await repository.revokeScope(
                uuid(itemId, 'scopeGrantId'),
                context.actor,
                correlationId,
              );
              return { statusCode: 204, body: {} };
            }
          }
        }
        if (request.method === 'GET' && request.pathname === '/api/v1/user-access-profiles') {
          authorizeOneOf(context, 'identity:read', 'authorization:read');
          if (!dependencies.authorization?.listUserAccessProfiles)
            return error(
              503,
              'internal_error',
              'User access profile repository is unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: {
              items: await dependencies.authorization.listUserAccessProfiles(
                context.actor.companyId,
              ),
            },
          };
        }
        const identityState = /^\/api\/v1\/identities\/([0-9a-f-]+)\/state$/u.exec(
          request.pathname,
        );
        if (request.method === 'PATCH' && identityState) {
          const body = objectBody(request.body);
          allow(body, ['active', 'revokeSessions']);
          authorizeOneOf(context, 'identity:manage', 'authorization:manage', Object.keys(body));
          if (
            typeof body.active !== 'boolean' ||
            (body.revokeSessions !== undefined && typeof body.revokeSessions !== 'boolean')
          )
            throw new DomainError('invalid_request', 'active and revokeSessions must be boolean');
          if (!dependencies.authorization?.setIdentityActive)
            return error(
              503,
              'internal_error',
              'Identity management repository is unavailable',
              correlationId,
            );
          await dependencies.authorization.setIdentityActive(
            uuid(identityState[1], 'identityId'),
            body.active,
            body.revokeSessions === true,
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const auditMatch = /^\/api\/v1\/audit-events(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
        if (auditMatch && request.method === 'GET') {
          const auditGrant = authorizeQuery(context, 'audit:read');
          if (!dependencies.audit)
            return error(503, 'internal_error', 'Audit repository unavailable', correlationId);
          const id = auditMatch[1];
          if (id) {
            const found = await dependencies.audit.find(
              uuid(id, 'auditEventId'),
              context.actor.companyId,
              auditGrant.scopes,
              context.actor.employeeId,
              auditGrant.anchors,
            );
            return found
              ? { statusCode: 200, body: found }
              : error(404, 'not_found', 'Audit event not found', correlationId);
          }
          const q = request.query ?? {};
          return {
            statusCode: 200,
            body: await dependencies.audit.list(
              context.actor.companyId,
              {
                ...(q.actorId ? { actorId: uuid(q.actorId, 'actorId') } : {}),
                ...(q.action ? { action: q.action } : {}),
                ...(q.targetType ? { targetType: q.targetType } : {}),
                ...(q.targetId ? { targetId: uuid(q.targetId, 'targetId') } : {}),
                ...(q.correlationId
                  ? { correlationId: uuid(q.correlationId, 'correlationId') }
                  : {}),
                ...(q.from ? { from: q.from } : {}),
                ...(q.to ? { to: q.to } : {}),
                ...(q.cursor ? { cursor: uuid(q.cursor, 'cursor') } : {}),
                ...(q.limit ? { limit: Number(q.limit) } : {}),
              },
              auditGrant.scopes,
              context.actor.employeeId,
              auditGrant.anchors,
            ),
          };
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
          return {
            statusCode: 200,
            body: await dependencies.masterData.listCategories(
              context.actor.companyId,
              request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['code', 'name', 'description', 'effectiveFrom', 'effectiveTo']);
          const range = effectiveRange(b);
          return {
            statusCode: 201,
            body: await dependencies.masterData.createCategory(
              {
                code: assertStableCode(string(b.code, 'code')),
                name: string(b.name, 'name'),
                description:
                  b.description === null || b.description === undefined
                    ? null
                    : string(b.description, 'description'),
                ...range,
              },
              context.actor,
              correlationId,
            ),
          };
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
          const b = objectBody(request.body);
          allow(b, ['name', 'description', 'effectiveFrom', 'effectiveTo', 'version']);
          const range = effectiveRange(b);
          return {
            statusCode: 200,
            body: await dependencies.masterData.updateCategory(
              uuid(category[1], 'categoryId'),
              {
                name: string(b.name, 'name'),
                description:
                  b.description === null || b.description === undefined
                    ? null
                    : string(b.description, 'description'),
                ...range,
                version: version(b.version),
              },
              context.actor,
              correlationId,
            ),
          };
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
          await dependencies.masterData.deleteCategory(
            uuid(category[1], 'categoryId'),
            version(Number(request.query?.version)),
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
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
          const b = objectBody(request.body);
          allow(b, ['categoryId', 'code', 'label', 'value', 'effectiveFrom', 'effectiveTo']);
          const range = effectiveRange(b);
          return {
            statusCode: 201,
            body: await dependencies.masterData.createEntry(
              {
                categoryId: uuid(b.categoryId, 'categoryId'),
                code: assertStableCode(string(b.code, 'code')),
                label: string(b.label, 'label'),
                value: objectBody(b.value) as never,
                ...range,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/number-definitions' && request.method === 'GET') {
          authorizeQuery(context, 'number:read');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          return {
            statusCode: 200,
            body: { items: await dependencies.numbers.list(context.actor.companyId) },
          };
        }
        if (request.pathname === '/api/v1/number-definitions' && request.method === 'POST') {
          authorizeQuery(context, 'number:create');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, [
            'code',
            'prefix',
            'suffix',
            'padding',
            'startingValue',
            'increment',
            'resetPeriod',
          ]);
          return {
            statusCode: 201,
            body: await dependencies.numbers.createDefinition(
              {
                code: assertStableCode(string(b.code, 'code')),
                prefix: typeof b.prefix === 'string' ? b.prefix : '',
                suffix: typeof b.suffix === 'string' ? b.suffix : '',
                padding: integer(b.padding, 'padding', 1, 32),
                startingValue: integer(
                  b.startingValue,
                  'startingValue',
                  0,
                  Number.MAX_SAFE_INTEGER,
                ),
                increment: integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
                resetPeriod: string(b.resetPeriod, 'resetPeriod') as never,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const publishNumber = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (publishNumber && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.numbers.publish(
              uuid(publishNumber[1], 'definitionId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const allocate = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/allocate$/u.exec(
          request.pathname,
        );
        if (allocate && request.method === 'POST') {
          authorizeQuery(context, 'number:allocate');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          return {
            statusCode: 201,
            body: await dependencies.numbers.allocate(
              uuid(allocate[1], 'definitionId'),
              key,
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/rules' && request.method === 'GET') {
          authorizeQuery(context, 'rule:read');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          return {
            statusCode: 200,
            body: { items: await dependencies.rules.list(context.actor.companyId) },
          };
        }
        if (request.pathname === '/api/v1/rules' && request.method === 'POST') {
          authorizeQuery(context, 'rule:create');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'ast', 'requiredInputs']);
          return {
            statusCode: 201,
            body: await dependencies.rules.create(
              {
                code: assertStableCode(string(b.code, 'code')),
                ast: b.ast,
                requiredInputs: strings(b.requiredInputs ?? [], 'requiredInputs'),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const publishRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
        if (publishRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.rules.publish(
              uuid(publishRule[1], 'ruleId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const evaluateRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/evaluate$/u.exec(request.pathname);
        if (evaluateRule && request.method === 'POST') {
          authorizeQuery(context, 'rule:evaluate');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['input']);
          return {
            statusCode: 200,
            body: await dependencies.rules.evaluate(
              uuid(evaluateRule[1], 'ruleId'),
              objectBody(b.input) as never,
              key,
              context.actor,
              correlationId,
            ),
          };
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
          return {
            statusCode: 200,
            body: await dependencies.masterData.listEntries(
              context.actor.companyId,
              request.query?.categoryId ? uuid(request.query.categoryId, 'categoryId') : null,
              request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
            ),
          };
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
          const found = await dependencies.masterData.findEntry(
            uuid(entry[1], 'entryId'),
            context.actor.companyId,
            request.query?.at ? parseEffectiveTimestamp(request.query.at) : new Date(),
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Master-data entry not found', correlationId);
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
          const b = objectBody(request.body);
          allow(b, ['label', 'value', 'effectiveFrom', 'effectiveTo', 'version']);
          const range = effectiveRange(b);
          return {
            statusCode: 200,
            body: await dependencies.masterData.updateEntry(
              uuid(entry[1], 'entryId'),
              {
                label: string(b.label, 'label'),
                value: objectBody(b.value) as never,
                ...range,
                version: version(b.version),
              },
              context.actor,
              correlationId,
            ),
          };
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
          await dependencies.masterData.deleteEntry(
            uuid(entry[1], 'entryId'),
            version(Number(request.query?.version)),
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const numberVersion = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (numberVersion && request.method === 'POST') {
          authorizeQuery(context, 'number:update');
          if (!dependencies.numbers)
            return error(503, 'internal_error', 'Number repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['prefix', 'suffix', 'padding', 'startingValue', 'increment', 'resetPeriod']);
          return {
            statusCode: 201,
            body: await dependencies.numbers.createVersion(
              uuid(numberVersion[1], 'definitionId'),
              {
                prefix: typeof b.prefix === 'string' ? b.prefix : '',
                suffix: typeof b.suffix === 'string' ? b.suffix : '',
                padding: integer(b.padding, 'padding', 1, 32),
                startingValue: integer(
                  b.startingValue,
                  'startingValue',
                  0,
                  Number.MAX_SAFE_INTEGER,
                ),
                increment: integer(b.increment, 'increment', 1, Number.MAX_SAFE_INTEGER),
                resetPeriod: string(b.resetPeriod, 'resetPeriod') as never,
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const ruleVersion = /^\/api\/v1\/rules\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
        if (ruleVersion && request.method === 'POST') {
          authorizeQuery(context, 'rule:update');
          if (!dependencies.rules)
            return error(503, 'internal_error', 'Rule repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['ast', 'requiredInputs']);
          return {
            statusCode: 201,
            body: await dependencies.rules.createVersion(
              uuid(ruleVersion[1], 'ruleId'),
              { ast: b.ast, requiredInputs: strings(b.requiredInputs ?? [], 'requiredInputs') },
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/workflows' && request.method === 'GET') {
          authorizeQuery(context, 'workflow:read');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          return {
            statusCode: 200,
            body: { items: await dependencies.workflows.list(context.actor.companyId) },
          };
        }
        if (request.pathname === '/api/v1/workflows' && request.method === 'POST') {
          authorizeQuery(context, 'workflow:create');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'spec']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.create(
              { code: assertStableCode(string(b.code, 'code')), spec: objectBody(b.spec) as never },
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowVersion = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (workflowVersion && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['spec']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.createVersion(
              uuid(workflowVersion[1], 'workflowId'),
              objectBody(b.spec) as never,
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowPublish = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/publish$/u.exec(
          request.pathname,
        );
        if (workflowPublish && request.method === 'POST') {
          authorizeQuery(context, 'workflow:update');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          return {
            statusCode: 200,
            body: await dependencies.workflows.publish(
              uuid(workflowPublish[1], 'workflowId'),
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        const workflowStart = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/instances$/u.exec(
          request.pathname,
        );
        if (workflowStart && request.method === 'POST') {
          authorizeQuery(context, 'workflow:start');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['subjectType', 'subjectId']);
          return {
            statusCode: 201,
            body: await dependencies.workflows.start(
              uuid(workflowStart[1], 'workflowId'),
              string(b.subjectType, 'subjectType'),
              uuid(b.subjectId, 'subjectId'),
              key,
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/workflow-tasks' && request.method === 'GET') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          return { statusCode: 200, body: await dependencies.workflows.listTasks(context.actor) };
        }
        const decide = /^\/api\/v1\/workflow-tasks\/([0-9a-f-]+)\/decisions$/u.exec(
          request.pathname,
        );
        if (decide && request.method === 'POST') {
          authorizeQuery(context, 'workflow:decide');
          if (!dependencies.workflows)
            return error(503, 'internal_error', 'Workflow repository unavailable', correlationId);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          const b = objectBody(request.body);
          allow(b, ['decision', 'comment', 'version']);
          return {
            statusCode: 200,
            body: await dependencies.workflows.decide(
              uuid(decide[1], 'taskId'),
              string(b.decision, 'decision'),
              b.comment == null ? null : string(b.comment, 'comment'),
              key,
              version(b.version),
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/notifications' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.notifications.list(
              context.actor,
              request.query?.unread === 'true',
            ),
          };
        }
        if (request.pathname === '/api/v1/notifications/unread-count' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: { count: await dependencies.notifications.unread(context.actor) },
          };
        }
        const notification = /^\/api\/v1\/notifications\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (notification && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const found = await dependencies.notifications.find(
            uuid(notification[1], 'notificationId'),
            context.actor,
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Notification not found', correlationId);
        }
        const readState = /^\/api\/v1\/notifications\/([0-9a-f-]+)\/(read|unread)$/u.exec(
          request.pathname,
        );
        if (readState && request.method === 'PUT') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          await dependencies.notifications.setRead(
            uuid(readState[1], 'notificationId'),
            readState[2] === 'read',
            context.actor,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (request.pathname === '/api/v1/notification-preferences' && request.method === 'GET') {
          authorizeQuery(context, 'notification:read');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          return {
            statusCode: 200,
            body: await dependencies.notifications.preferences(context.actor),
          };
        }
        if (request.pathname === '/api/v1/notification-preferences' && request.method === 'PUT') {
          authorizeQuery(context, 'notification:manage');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['channel', 'enabled', 'expectedVersion']);
          if (typeof b.enabled !== 'boolean')
            throw new DomainError('invalid_request', 'enabled must be boolean');
          if (b.expectedVersion === undefined)
            throw new DomainError('invalid_request', 'expectedVersion is required');
          return {
            statusCode: 200,
            body: await dependencies.notifications.setPreference(
              notificationChannel(b.channel),
              b.enabled,
              expectedVersion(b.expectedVersion),
              context.actor,
              correlationId,
            ),
          };
        }
        if (request.pathname === '/api/v1/internal/notifications' && request.method === 'POST') {
          const authorized = authorizeQuery(context, 'notification:manage');
          if (!dependencies.notifications)
            return error(
              503,
              'internal_error',
              'Notification repository unavailable',
              correlationId,
            );
          const b = objectBody(request.body);
          allow(b, ['kind', 'title', 'message', 'recipients', 'subjectType', 'subjectId']);
          const key = request.headers?.['idempotency-key'];
          if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          return {
            statusCode: 201,
            body: await dependencies.notifications.create(
              {
                kind: string(b.kind, 'kind'),
                title: string(b.title, 'title'),
                message: string(b.message, 'message'),
                recipients: strings(b.recipients, 'recipients').map((recipient) =>
                  uuid(recipient, 'recipient'),
                ),
                ...(b.subjectType ? { subjectType: string(b.subjectType, 'subjectType') } : {}),
                ...(b.subjectId ? { subjectId: uuid(b.subjectId, 'subjectId') } : {}),
                idempotencyKey: key,
              },
              context.actor,
              correlationId,
              authorized.scopes,
              authorized.anchors,
            ),
          };
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
        if (request.pathname === '/api/v1/attachments' && request.method === 'POST') {
          authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['name', 'mimeType', 'size', 'checksum']);
          return {
            statusCode: 201,
            body: await dependencies.attachments.create(
              {
                name: string(b.name, 'name'),
                mimeType: string(b.mimeType, 'mimeType'),
                size: integer(b.size, 'size', 1, 26_214_400),
                checksum: string(b.checksum, 'checksum'),
              },
              context.actor,
              correlationId,
            ),
          };
        }
        const attachmentUpload = /^\/api\/v1\/attachments\/([0-9a-f-]+)\/content$/u.exec(
          request.pathname,
        );
        if (attachmentUpload && request.method === 'PUT') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['contentBase64']);
          return {
            statusCode: 200,
            body: await dependencies.attachments.upload(
              uuid(attachmentUpload[1], 'attachmentId'),
              attachmentBytes(b.contentBase64),
              context.actor,
              grant.scopes,
              grant.anchors,
              correlationId,
            ),
          };
        }
        const attachmentBind = /^\/api\/v1\/attachments\/([0-9a-f-]+)\/bindings$/u.exec(
          request.pathname,
        );
        if (attachmentBind && request.method === 'POST') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['objectType', 'objectId']);
          await dependencies.attachments.bind(
            uuid(attachmentBind[1], 'attachmentId'),
            string(b.objectType, 'objectType'),
            uuid(b.objectId, 'objectId'),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (attachmentBind && request.method === 'DELETE') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['objectType', 'objectId']);
          await dependencies.attachments.unbind(
            uuid(attachmentBind[1], 'attachmentId'),
            string(b.objectType, 'objectType'),
            uuid(b.objectId, 'objectId'),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        const attachment = /^\/api\/v1\/attachments\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (attachment && request.method === 'GET') {
          const grant = authorizeQuery(context, 'attachment:read');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const found = await dependencies.attachments.download(
            uuid(attachment[1], 'attachmentId'),
            context.actor,
            grant.scopes,
            grant.anchors,
          );
          return found
            ? {
                statusCode: 200,
                body: {
                  metadata: found.metadata,
                  contentBase64: Buffer.from(found.bytes).toString('base64'),
                },
              }
            : error(404, 'not_found', 'Attachment not found', correlationId);
        }
        if (attachment && request.method === 'DELETE') {
          const grant = authorizeQuery(context, 'attachment:manage');
          if (!dependencies.attachments)
            return error(503, 'internal_error', 'Attachment repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['version']);
          await dependencies.attachments.remove(
            uuid(attachment[1], 'attachmentId'),
            version(b.version),
            context.actor,
            grant.scopes,
            grant.anchors,
            correlationId,
          );
          return { statusCode: 204, body: {} };
        }
        if (request.pathname === '/api/v1/business-objects' && request.method === 'GET') {
          authorizeQuery(context, 'business-object:read');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.businessObjects.list(context.actor.companyId),
          };
        }
        if (request.pathname === '/api/v1/business-objects' && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['code', 'name', 'schema']);
          return {
            statusCode: 201,
            body: await dependencies.businessObjects.create(
              string(b.code, 'code'),
              string(b.name, 'name'),
              b.schema,
              context.actor,
              correlationId,
            ),
          };
        }
        const objectVersion = /^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions$/u.exec(
          request.pathname,
        );
        if (objectVersion && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['schema']);
          return {
            statusCode: 201,
            body: await dependencies.businessObjects.addVersion(
              uuid(objectVersion[1], 'definitionId'),
              b.schema,
              context.actor,
              correlationId,
            ),
          };
        }
        const objectPublish =
          /^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions\/(\d+)\/publish$/u.exec(
            request.pathname,
          );
        if (objectPublish && request.method === 'POST') {
          authorizeQuery(context, 'business-object:manage');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.businessObjects.publish(
              uuid(objectPublish[1], 'definitionId'),
              Number(objectPublish[2]),
              context.actor,
              correlationId,
            ),
          };
        }
        const object = /^\/api\/v1\/business-objects\/([0-9a-f-]+)$/u.exec(request.pathname);
        if (object && request.method === 'GET') {
          authorizeQuery(context, 'business-object:read');
          if (!dependencies.businessObjects)
            return error(503, 'internal_error', 'Registry unavailable', correlationId);
          const found = await dependencies.businessObjects.find(
            uuid(object[1], 'definitionId'),
            context.actor.companyId,
          );
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Business object not found', correlationId);
        }
        if (request.pathname === '/api/v1/operations/events' && request.method === 'GET') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          return {
            statusCode: 200,
            body: await dependencies.events.counts(context.actor.companyId),
          };
        }
        if (request.pathname === '/api/v1/operations/events/claims' && request.method === 'POST') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          const b = objectBody(request.body);
          allow(b, ['consumer', 'worker', 'limit', 'leaseSeconds']);
          return {
            statusCode: 200,
            body: await dependencies.events.claim(
              context.actor,
              string(b.consumer, 'consumer'),
              string(b.worker, 'worker'),
              b.limit === undefined ? undefined : integer(b.limit, 'limit', 1, 100),
              b.leaseSeconds === undefined
                ? undefined
                : integer(b.leaseSeconds, 'leaseSeconds', 5, 300),
            ),
          };
        }
        const eventDelivery =
          /^\/api\/v1\/operations\/events\/([0-9a-f-]+)\/(complete|retry|dead-letter)$/u.exec(
            request.pathname,
          );
        if (eventDelivery && request.method === 'POST') {
          authorizeQuery(context, 'event:operate');
          if (!dependencies.events)
            return error(503, 'internal_error', 'Event repository unavailable', correlationId);
          const b = objectBody(request.body);
          const action = eventDelivery[2];
          allow(
            b,
            action === 'complete'
              ? ['consumer', 'claimToken']
              : ['consumer', 'claimToken', 'errorCode', 'maxAttempts'],
          );
          const eventId = uuid(eventDelivery[1], 'eventId');
          const consumer = string(b.consumer, 'consumer');
          const claimToken = uuid(b.claimToken, 'claimToken');
          if (action === 'complete')
            await dependencies.events.complete(eventId, context.actor, consumer, claimToken);
          else
            await dependencies.events.fail(
              eventId,
              context.actor,
              consumer,
              claimToken,
              string(b.errorCode, 'errorCode'),
              action === 'dead-letter'
                ? 1
                : b.maxAttempts === undefined
                  ? undefined
                  : integer(b.maxAttempts, 'maxAttempts', 2, 100),
            );
          return { statusCode: 204, body: {} };
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
