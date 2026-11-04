import { companyReadAllowed } from './aggregate-authorization.ts';

import { randomUUID } from 'node:crypto';

import {
  assertCurrency,
  assertEffectiveRange,
  DomainError,
  normalizeDecimal,
  type AuthorizationContext,
} from '@kingturf/domain';

import type { ErrorCode, PermissionKey } from '@kingturf/types';

import { authorizeQuery } from './policy.ts';

import type { ApiRequest, ApiResponse } from './api-types.ts';
import type { ApiDependencies } from './app.ts';

export const permittedDto = <T extends Record<string, unknown>>(
  value: T,
  fields: readonly string[] | null,
): Partial<T> => {
  if (fields === null) return value;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => visible.has(key)),
  ) as Partial<T>;
};

export const mutationDto = <T extends Record<string, unknown>>(
  value: T,
  context: AuthorizationContext,
  readCapability: PermissionKey,
): Partial<T> => {
  const read = context.permissions.get(readCapability);
  return read ? permittedDto(value, read.fields) : permittedDto(value, ['version']);
};

// A legal write capability does not widen the independent legal read scope of its response.
export const legalMutationDto = <T extends Record<string, unknown>>(
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

export const authorizeOneOf = (
  context: AuthorizationContext,
  preferred: PermissionKey,
  fallback: PermissionKey,
  fields?: readonly string[],
) => authorizeQuery(context, context.permissions.has(preferred) ? preferred : fallback, fields);

export const error = (
  statusCode: number,
  code: ErrorCode,
  message: string,
  correlationId: string,
  details?: readonly string[],
): ApiResponse => ({
  statusCode,
  body: { error: { code, message, correlationId, ...(details ? { details } : {}) } },
});

export const objectBody = (body: unknown): Record<string, unknown> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new DomainError('invalid_request', 'A JSON object body is required');
  return body as Record<string, unknown>;
};

export const string = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('invalid_request', `${name} is required`);
  return value.trim();
};

export const boundedString = (value: unknown, name: string, maximum: number): string => {
  const result = string(value, name);
  if (result.length > maximum)
    throw new DomainError('invalid_request', `${name} exceeds ${String(maximum)} characters`);
  return result;
};

export const timestamp = (value: unknown, name: string): string => {
  const result = string(value, name);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.getTime()))
    throw new DomainError('invalid_request', `${name} must be a valid timestamp`);
  return parsed.toISOString();
};

export const calendarDate = (value: unknown, name: string): string => {
  const result = string(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`)))
    throw new DomainError('invalid_request', `${name} must be a valid YYYY-MM-DD date`);
  return result;
};

export const optionalCalendarDate = (value: unknown, name: string): string | null =>
  value === null || value === undefined ? null : calendarDate(value, name);

export const COST_FACTOR_SOURCE_TYPES = [
  'MANUAL',
  'PURCHASE_ORDER',
  'SUPPLIER_QUOTE',
  'MARKET_REFERENCE',
  'INTERNAL_BENCHMARK',
] as const;

export const costFactorSourceType = (value: unknown): string => {
  const result = string(value, 'sourceType');
  if (!COST_FACTOR_SOURCE_TYPES.some((candidate) => candidate === result))
    throw new DomainError('invalid_request', 'sourceType is not supported');
  return result;
};

export const requireCostFactorItemSource = (
  sourceType: string,
  sourceItemVersionId: unknown,
): void => {
  if ((sourceType === 'PURCHASE_ORDER' || sourceType === 'SUPPLIER_QUOTE') && !sourceItemVersionId)
    throw new DomainError(
      'invalid_request',
      'Purchase order and supplier quote sources require a linked purchasing item',
    );
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const correlation = (value: string | undefined): string =>
  value && UUID.test(value) ? value : randomUUID();

export const uuid = (value: unknown, name: string): string => {
  const result = string(value, name);
  if (!UUID.test(result)) throw new DomainError('invalid_request', `${name} must be a UUID`);
  return result;
};

export const allow = (body: Record<string, unknown>, fields: readonly string[]): void => {
  const unexpected = Object.keys(body).filter((key) => !fields.includes(key));
  if (unexpected.length)
    throw new DomainError('invalid_request', `Unsupported fields: ${unexpected.sort().join(', ')}`);
};

export const version = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new DomainError('invalid_request', 'version must be a positive integer');
  return value;
};

export const expectedVersion = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new DomainError('invalid_request', 'expectedVersion must be a non-negative integer');
  return value;
};

export const strings = (value: unknown, name: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim()))
    throw new DomainError('invalid_request', `${name} must be an array of non-empty strings`);
  return [...new Set(value as string[])].sort();
};

export const notificationChannel = (value: unknown): string => {
  const channel = string(value, 'channel');
  if (!['IN_APP', 'EMAIL', 'SMS', 'PUSH'].includes(channel))
    throw new DomainError('invalid_request', 'channel is unsupported');
  return channel;
};

export const documentConnector = (value: unknown, includeTranslation = false): string => {
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

export const documentLocale = (value: unknown): string => {
  const locale = string(value, 'targetLocale');
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(locale))
    throw new DomainError('invalid_request', 'targetLocale must use a supported locale code');
  return locale;
};

export const connectorProvider = (value: unknown): string => {
  const provider = string(value, 'provider');
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(provider))
    throw new DomainError('invalid_request', 'provider must be an uppercase provider code');
  return provider;
};

export const connectorSecretReference = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const reference = string(value, 'secretReference');
  if (!/^KINGTURF_CONNECTOR_[A-Z0-9_]{3,96}$/u.test(reference))
    throw new DomainError(
      'invalid_request',
      'secretReference must name a KINGTURF_CONNECTOR_* managed secret',
    );
  return reference;
};

export const safeConnectorConfiguration = (value: unknown): Record<string, never> => {
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

export const attachmentBytes = (value: unknown): Uint8Array => {
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

export const integer = (value: unknown, name: string, minimum: number, maximum: number): number => {
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

export const jsonObject = (value: unknown, name: string): Record<string, never> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainError('invalid_request', `${name} must be a JSON object`);
  return value as Record<string, never>;
};

export const array = (value: unknown, name: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new DomainError('invalid_request', `${name} must be an array`);
  return value;
};

export const decimal = (value: unknown, name: string, nonnegative = true): string => {
  const result = normalizeDecimal(string(value, name));
  if (nonnegative && result.startsWith('-'))
    throw new DomainError('invalid_request', `${name} must be non-negative`);
  return result;
};

export const currency = (value: unknown): string => assertCurrency(string(value, 'currency'));

export const idempotency = (request: ApiRequest): string => {
  const key = request.headers?.['idempotency-key'];
  if (!key || key.length > 128)
    throw new DomainError('invalid_request', 'Idempotency-Key is required');
  return key;
};

export const effectiveRange = (body: Record<string, unknown>) => {
  const effectiveFrom = string(body.effectiveFrom, 'effectiveFrom');
  const effectiveTo =
    body.effectiveTo === null || body.effectiveTo === undefined
      ? null
      : string(body.effectiveTo, 'effectiveTo');
  assertEffectiveRange(effectiveFrom, effectiveTo);
  return { effectiveFrom, effectiveTo };
};

export type RiskEvaluationRepository = Pick<
  NonNullable<ApiDependencies['risks']>,
  'evaluate' | 'canReadResult'
>;

export type RiskTaskRepository = Pick<
  NonNullable<ApiDependencies['risks']>,
  'transitionTask' | 'canReadResult'
>;
