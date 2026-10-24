import { parseResponseRecord } from './response-parser';
import { parseResponseArray, parseResponseItems } from './api-response-parser';

function requireStrings(record: Record<string, unknown>, fields: readonly string[]): void {
  for (const field of fields)
    if (typeof record[field] !== 'string') throw new Error('服务器返回的文档字段格式无效');
}

function requireVersion(record: Record<string, unknown>): void {
  if (
    typeof record.currentVersion !== 'number' ||
    !Number.isInteger(record.currentVersion) ||
    record.currentVersion < 1
  )
    throw new Error('服务器返回的文档版本格式无效');
}

function parseDocumentContent(value: unknown): void {
  const record = parseResponseRecord(value);
  for (const key of ['body', 'html']) {
    const field = record[key];
    if (field !== undefined && field !== null && typeof field !== 'string')
      throw new Error('服务器返回的文档正文格式无效');
  }
}

function parseDocument(value: unknown): void {
  const record = parseResponseRecord(value);
  requireStrings(record, ['id', 'templateKey', 'title', 'route']);
  requireVersion(record);
  for (const key of ['versions', 'translations', 'reviewEvents', 'dispatches']) {
    const field = record[key];
    if (field !== undefined && field !== null) parseResponseArray(field);
  }
  if (record.versions !== undefined && record.versions !== null)
    for (const version of parseResponseArray(record.versions))
      parseDocumentContent(version.content);
  if (record.translations !== undefined && record.translations !== null)
    for (const translation of parseResponseArray(record.translations)) {
      if (translation.content !== undefined && translation.content !== null)
        parseDocumentContent(translation.content);
    }
}

function parseReferenceData(value: unknown): void {
  const record = parseResponseRecord(value);
  for (const key of ['customers', 'orders', 'employees']) parseResponseArray(record[key]);
}

const subjectPaths = new Set([
  '/api/v1/quotes',
  '/api/v1/contracts',
  '/api/v1/sales-orders',
  '/api/v1/production-orders',
  '/api/v1/shipment-releases',
]);

// Each cached GET path has one fixed wire schema. Do not change cache identity or timing.
export function parseKnownDocumentResponse(path: string, value: unknown): unknown {
  const pathname = path.split('?')[0] ?? path;
  if (pathname === '/api/v1/business-documents/reference-data') parseReferenceData(value);
  else if (pathname === '/api/v1/business-documents') {
    const record = parseResponseRecord(value);
    if ('items' in record) {
      const page = parseResponseItems(value);
      for (const item of page.items) parseDocument(item);
    } else parseDocument(value);
  } else if (/^\/api\/v1\/business-documents\/[^/]+$/u.test(pathname)) parseDocument(value);
  else if (
    pathname === '/api/v1/document-connectors' ||
    pathname === '/api/v1/business-document-activity'
  )
    parseResponseItems(value);
  else if (/^\/api\/v1\/business-documents\/[^/]+\/versions$/u.test(pathname))
    requireVersion(parseResponseRecord(value));
  else if (/^\/api\/v1\/business-documents\/[^/]+\/send$/u.test(pathname))
    requireStrings(parseResponseRecord(value), ['id', 'status']);
  else if (/^\/api\/v1\/business-documents\/[^/]+\/translations$/u.test(pathname))
    requireStrings(parseResponseRecord(value), ['status']);
  else if (subjectPaths.has(pathname)) {
    if (Array.isArray(value)) parseResponseArray(value);
    else {
      const record = parseResponseRecord(value);
      if (record.items !== undefined) parseResponseArray(record.items);
    }
  }
  return value;
}
