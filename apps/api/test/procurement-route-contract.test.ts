// Frozen against bb114ff inline procurement HTTP; opaque mocks are not SQL acceptance.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['procurement']>;
type Method =
  | 'list'
  | 'createSupplier'
  | 'qualifySupplier'
  | 'createRfq'
  | 'createSupplierQuote'
  | 'createPurchaseOrder'
  | 'issueRfq'
  | 'issuePurchaseOrder'
  | 'createLocation'
  | 'receive'
  | 'move';
type Kind =
  | 'list'
  | 'supplier'
  | 'qualification'
  | 'rfq'
  | 'quote'
  | 'order'
  | 'issue'
  | 'location'
  | 'receipt'
  | 'move';
type Row = Readonly<{
  label: string;
  kind: Kind;
  method: Method;
  path: string;
  http: string;
  cap: PermissionKey;
  read: PermissionKey;
  view?: string;
}>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type MockCall = (...args: unknown[]) => Promise<unknown>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '66666666-6666-4666-8666-666666666666';
const actor = { employeeId: id, companyId: 'procurement-old-http-mock' };
const time = '2026-08-01T08:00:00+08:00',
  iso = '2026-08-01T00:00:00.000Z',
  date = '2026-08-31';
const rows: readonly Row[] = [
  ...(
    [
      ['suppliers', 'suppliers', 'supplier:read'],
      ['procurement-rfqs', 'rfqs', 'procurement:read'],
      ['supplier-quotes', 'quotes', 'procurement:read'],
      ['purchase-orders', 'orders', 'procurement:read'],
      ['goods-receipts', 'receipts', 'procurement:read'],
      ['inventory-locations', 'locations', 'inventory:read'],
      ['inventory-balances', 'inventory', 'inventory:read'],
    ] as const
  ).map(
    ([path, view, cap]): Row => ({
      label: view + ' list',
      kind: 'list',
      method: 'list',
      http: 'GET',
      path: '/api/v1/' + path,
      view,
      cap,
      read: cap,
    }),
  ),
  {
    label: 'supplier create',
    kind: 'supplier',
    method: 'createSupplier',
    http: 'POST',
    path: '/api/v1/suppliers',
    cap: 'supplier:manage',
    read: 'supplier:read',
  },
  {
    label: 'supplier qualification',
    kind: 'qualification',
    method: 'qualifySupplier',
    http: 'POST',
    path: '/api/v1/suppliers/' + id + '/qualifications',
    cap: 'supplier:manage',
    read: 'supplier:read',
  },
  {
    label: 'RFQ create',
    kind: 'rfq',
    method: 'createRfq',
    http: 'POST',
    path: '/api/v1/procurement-rfqs',
    cap: 'procurement:manage',
    read: 'procurement:read',
  },
  {
    label: 'supplier quote create',
    kind: 'quote',
    method: 'createSupplierQuote',
    http: 'POST',
    path: '/api/v1/supplier-quotes',
    cap: 'procurement:manage',
    read: 'procurement:read',
  },
  {
    label: 'purchase order create',
    kind: 'order',
    method: 'createPurchaseOrder',
    http: 'POST',
    path: '/api/v1/purchase-orders',
    cap: 'procurement:manage',
    read: 'procurement:read',
  },
  ...(['rfq', 'order'] as const).map(
    (kind): Row => ({
      label: kind + ' issue',
      kind: 'issue',
      method: kind === 'rfq' ? 'issueRfq' : 'issuePurchaseOrder',
      http: 'POST',
      path:
        '/api/v1/' +
        (kind === 'rfq' ? 'procurement-rfqs' : 'purchase-orders') +
        '/' +
        id +
        '/issue',
      cap: 'procurement:manage',
      read: 'procurement:read',
    }),
  ),
  {
    label: 'location create',
    kind: 'location',
    method: 'createLocation',
    http: 'POST',
    path: '/api/v1/inventory-locations',
    cap: 'inventory:move',
    read: 'inventory:read',
  },
  {
    label: 'receipt create',
    kind: 'receipt',
    method: 'receive',
    http: 'POST',
    path: '/api/v1/goods-receipts',
    cap: 'procurement:manage',
    read: 'procurement:read',
  },
  {
    label: 'inventory move',
    kind: 'move',
    method: 'move',
    http: 'POST',
    path: '/api/v1/inventory-movements',
    cap: 'inventory:move',
    read: 'inventory:read',
  },
];
const lists = rows.filter((r) => r.kind === 'list'),
  writes = rows.filter((r) => r.kind !== 'list'),
  issues = rows.filter((r) => r.kind === 'issue'),
  nested = rows.filter((r) => ['rfq', 'quote', 'order', 'receipt'].includes(r.kind)),
  raw = rows.filter((r) => r.kind === 'issue' || r.kind === 'qualification');
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function bodyFor(row: Row): Record<string, unknown> {
  if (row.kind === 'supplier')
    return {
      supplierNumber: ' SUP_1 ',
      name: ' Supplier ',
      currency: ' USD ',
      paymentTermsDays: 0,
      qualityRatingBasisPoints: 0,
      contact: { nested: { keep: true } },
    };
  if (row.kind === 'qualification')
    return {
      itemVersionId: id,
      status: ' APPROVED ',
      validFrom: ' 2026-02-30 ',
      validTo: null,
      minimumOrderQuantity: ' 0.000000 ',
      leadTimeDays: 3650,
      evidence: { nested: { keep: true } },
    };
  if (row.kind === 'rfq')
    return {
      rfqNumber: ' RFQ_1 ',
      responseDueAt: time,
      currency: ' USD ',
      lines: [{ itemVersionId: id, quantity: ' 1.250000 ', requiredAt: ' ' + date + ' ' }],
      issue: true,
    };
  if (row.kind === 'quote')
    return {
      rfqId: id,
      supplierId: other,
      quoteReference: ' ref text ',
      receivedAt: time,
      validUntil: ' ' + date + ' ',
      terms: { nested: { keep: true } },
      lines: [
        {
          rfqLineId: id,
          unitPrice: ' 1.250000 ',
          promisedAt: ' ' + date + ' ',
          minimumOrderQuantity: '0',
        },
      ],
    };
  if (row.kind === 'order')
    return {
      poNumber: ' PO_1 ',
      supplierId: other,
      supplierQuoteId: null,
      currency: ' USD ',
      lines: [{ itemVersionId: id, quantity: '1.250000', unitPrice: '2.000000', requiredAt: date }],
      issue: true,
    };
  if (row.kind === 'location')
    return { code: ' LOC_1 ', name: ' Location ', locationType: ' STORAGE ' };
  if (row.kind === 'receipt')
    return {
      receiptNumber: ' GR_1 ',
      purchaseOrderId: id,
      receivedAt: time,
      sourceReference: ' reference ',
      lines: [
        {
          purchaseOrderLineId: id,
          lotNumber: ' LOT_1 ',
          locationCode: ' LOC_1 ',
          quantity: '1.250000',
          manufacturedAt: '2026-02-30',
          expiresAt: null,
        },
      ],
    };
  if (row.kind === 'move')
    return {
      movementType: ' ISSUE ',
      itemVersionId: id,
      lotId: other,
      locationId: id,
      quantity: '1.250000',
      occurredAt: time,
      sourceType: ' MANUAL ',
      sourceId: other,
    };
  return {};
}
function expectedInput(row: Row, body: Record<string, unknown>): Record<string, unknown> {
  if (row.kind === 'supplier')
    return {
      supplierNumber: 'SUP_1',
      name: 'Supplier',
      currency: 'USD',
      paymentTermsDays: 0,
      qualityRatingBasisPoints: 0,
      contact: body.contact,
    };
  if (row.kind === 'qualification')
    return {
      itemVersionId: id,
      status: 'APPROVED',
      validFrom: '2026-02-30',
      validTo: null,
      minimumOrderQuantity: '0',
      leadTimeDays: 3650,
      evidence: body.evidence,
    };
  if (row.kind === 'rfq')
    return {
      rfqNumber: 'RFQ_1',
      responseDueAt: iso,
      currency: 'USD',
      lines: [{ itemVersionId: id, quantity: '1.25', requiredAt: date }],
      issue: true,
    };
  if (row.kind === 'quote')
    return {
      rfqId: id,
      supplierId: other,
      quoteReference: 'ref text',
      receivedAt: iso,
      validUntil: date,
      terms: body.terms,
      lines: [{ rfqLineId: id, unitPrice: '1.25', promisedAt: date, minimumOrderQuantity: '0' }],
    };
  if (row.kind === 'order')
    return {
      poNumber: 'PO_1',
      supplierId: other,
      supplierQuoteId: null,
      currency: 'USD',
      lines: [{ itemVersionId: id, quantity: '1.25', unitPrice: '2', requiredAt: date }],
      issue: true,
    };
  if (row.kind === 'location') return { code: 'LOC_1', name: 'Location', locationType: 'STORAGE' };
  if (row.kind === 'receipt')
    return {
      receiptNumber: 'GR_1',
      purchaseOrderId: id,
      receivedAt: iso,
      sourceReference: 'reference',
      lines: [
        {
          purchaseOrderLineId: id,
          lotNumber: 'LOT_1',
          locationCode: 'LOC_1',
          quantity: '1.25',
          manufacturedAt: '2026-02-30',
          expiresAt: null,
        },
      ],
    };
  return {
    movementType: 'ISSUE',
    itemVersionId: id,
    lotId: other,
    locationId: id,
    quantity: '1.25',
    occurredAt: iso,
    sourceType: 'MANUAL',
    sourceId: other,
  };
}
const scopeIndex = (row: Row) => (row.kind === 'qualification' ? 2 : 1);
const inputIndex = (row: Row) => (row.kind === 'qualification' ? 1 : 0);
function fixture(
  row: Row,
  options: {
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    denied?: boolean;
    noRead?: boolean;
    noAnchors?: boolean;
    missing?: boolean;
    unauthenticated?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['COMPANY'];
  const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [row.cap, { scopes, fields: options.fields === undefined ? null : options.fields }],
  ]);
  if (row.cap !== row.read && !options.noRead)
    permissions.set(row.read, { scopes: ['COMPANY'], fields: null });
  if (options.denied) permissions.delete(row.cap);
  const scopeAnchors = new Map<
    PermissionKey,
    readonly { readonly scope: 'TEAM'; readonly organizationId: string }[]
  >([[row.cap, anchors]]);
  const context: AuthorizationContext = {
    actor,
    permissions,
    ...(options.noAnchors ? {} : { scopeAnchors }),
  };
  const returned: JsonObject = {
    id,
    version: 7,
    name: 'Visible',
    nested: { keep: true },
    extra: 'opaque',
  };
  const output = [returned, { ...returned, id: other }];
  const repository = {
    list: vi.fn<MockCall>().mockResolvedValue(output),
    createSupplier: vi.fn<MockCall>().mockResolvedValue(returned),
    qualifySupplier: vi.fn<MockCall>().mockResolvedValue(returned),
    createRfq: vi.fn<MockCall>().mockResolvedValue(returned),
    createSupplierQuote: vi.fn<MockCall>().mockResolvedValue(returned),
    createPurchaseOrder: vi.fn<MockCall>().mockResolvedValue(returned),
    issueRfq: vi.fn<MockCall>().mockResolvedValue(returned),
    issuePurchaseOrder: vi.fn<MockCall>().mockResolvedValue(returned),
    createLocation: vi.fn<MockCall>().mockResolvedValue(returned),
    receive: vi.fn<MockCall>().mockResolvedValue(returned),
    move: vi.fn<MockCall>().mockResolvedValue(returned),
  };
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.unauthenticated ? null : context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { procurement: repository as unknown as Repository }),
  };
  const body = bodyFor(row),
    headers = {
      authorization: 'Bearer mock-only-procurement-session',
      'x-correlation-id': correlationId,
    };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: row.http, pathname: row.path, body, headers, ...overrides });
  return {
    scopes,
    anchors,
    scopeAnchors,
    permissions,
    context,
    returned,
    output,
    repository,
    authenticate,
    dependencies,
    body,
    headers,
    app,
    dispatch,
    call: repository[row.method],
  };
}
function error(response: ApiResponse, status: number, code: string, message: string) {
  expect(response.statusCode).toBe(status);
  expect(response.body).toEqual({ error: { code, message, correlationId } });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      required(settle)(value);
    },
  };
}

type Field = Readonly<{
  name: string;
  parser:
    | 'uuid'
    | 'code'
    | 'string'
    | 'currency'
    | 'decimal'
    | 'integer'
    | 'calendar'
    | 'timestamp'
    | 'object'
    | 'enum';
  min?: number;
  max?: number;
  nullable?: boolean;
  values?: readonly string[];
  message?: string;
}>;
const field = (
  name: string,
  parser: Field['parser'],
  extra: Omit<Field, 'name' | 'parser'> = {},
): Field => ({ name, parser, ...extra });
function fieldsFor(row: Row): readonly Field[] {
  if (row.kind === 'supplier')
    return [
      field('supplierNumber', 'code'),
      field('name', 'string'),
      field('currency', 'currency'),
      field('paymentTermsDays', 'integer', { min: 0, max: 3650 }),
      field('qualityRatingBasisPoints', 'integer', { min: 0, max: 10000, nullable: true }),
      field('contact', 'object', { nullable: true }),
    ];
  if (row.kind === 'qualification')
    return [
      field('status', 'enum', {
        values: ['APPROVED', 'CONDITIONAL', 'REJECTED'],
        message: 'qualification status is unsupported',
      }),
      field('itemVersionId', 'uuid'),
      field('validFrom', 'calendar'),
      field('validTo', 'calendar', { nullable: true }),
      field('minimumOrderQuantity', 'decimal'),
      field('leadTimeDays', 'integer', { min: 0, max: 3650 }),
      field('evidence', 'object', { nullable: true }),
    ];
  if (row.kind === 'rfq')
    return [
      field('rfqNumber', 'code'),
      field('responseDueAt', 'timestamp'),
      field('currency', 'currency'),
    ];
  if (row.kind === 'quote')
    return [
      field('rfqId', 'uuid'),
      field('supplierId', 'uuid'),
      field('quoteReference', 'string'),
      field('receivedAt', 'timestamp'),
      field('validUntil', 'calendar'),
      field('terms', 'object', { nullable: true }),
    ];
  if (row.kind === 'order')
    return [
      field('poNumber', 'code'),
      field('supplierId', 'uuid'),
      field('supplierQuoteId', 'uuid', { nullable: true }),
      field('currency', 'currency'),
    ];
  if (row.kind === 'location')
    return [
      field('locationType', 'enum', {
        values: ['RECEIVING', 'STORAGE', 'PRODUCTION', 'QUARANTINE', 'SHIPPING'],
        message: 'locationType is unsupported',
      }),
      field('code', 'code'),
      field('name', 'string'),
    ];
  if (row.kind === 'receipt')
    return [
      field('receiptNumber', 'code'),
      field('purchaseOrderId', 'uuid'),
      field('receivedAt', 'timestamp'),
      field('sourceReference', 'string'),
    ];
  if (row.kind === 'move')
    return [
      field('movementType', 'enum', {
        values: [
          'ISSUE',
          'RETURN',
          'TRANSFER_IN',
          'TRANSFER_OUT',
          'ADJUSTMENT_IN',
          'ADJUSTMENT_OUT',
        ],
        message: 'movementType is unsupported',
      }),
      field('itemVersionId', 'uuid'),
      field('lotId', 'uuid'),
      field('locationId', 'uuid'),
      field('quantity', 'decimal'),
      field('occurredAt', 'timestamp'),
      field('sourceType', 'code'),
      field('sourceId', 'uuid'),
    ];
  return [];
}
function lineFields(row: Row): readonly Field[] {
  if (row.kind === 'rfq')
    return [
      field('itemVersionId', 'uuid'),
      field('quantity', 'decimal'),
      field('requiredAt', 'calendar'),
    ];
  if (row.kind === 'quote')
    return [
      field('rfqLineId', 'uuid'),
      field('unitPrice', 'decimal'),
      field('promisedAt', 'calendar'),
      field('minimumOrderQuantity', 'decimal'),
    ];
  if (row.kind === 'order')
    return [
      field('itemVersionId', 'uuid'),
      field('quantity', 'decimal'),
      field('unitPrice', 'decimal'),
      field('requiredAt', 'calendar'),
    ];
  return [
    field('purchaseOrderLineId', 'uuid'),
    field('lotNumber', 'code'),
    field('locationCode', 'code'),
    field('quantity', 'decimal'),
    field('manufacturedAt', 'calendar', { nullable: true }),
    field('expiresAt', 'calendar', { nullable: true }),
  ];
}
const codeMessage = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';
function badCases(spec: Field): readonly (readonly [unknown, string])[] {
  const name = spec.name;
  if (spec.parser === 'integer') {
    const message =
      name + ' must be an integer between ' + String(spec.min) + ' and ' + String(spec.max);
    return [
      ['1', message],
      [-1, message],
      [0.5, message],
      [required(spec.max) + 1, message],
      [Number.NaN, message],
      [Number.POSITIVE_INFINITY, message],
      ...(spec.nullable
        ? []
        : ([
            [undefined, message],
            [null, message],
          ] as const)),
    ];
  }
  if (spec.parser === 'object')
    return [
      [[], name + ' must be a JSON object'],
      [1, name + ' must be a JSON object'],
      ['x', name + ' must be a JSON object'],
    ];
  const missing: readonly (readonly [unknown, string])[] = [
    ...(spec.nullable
      ? []
      : ([
          [undefined, name + ' is required'],
          [null, name + ' is required'],
        ] as const)),
    [' ', name + ' is required'],
    [false, name + ' is required'],
  ];
  if (spec.parser === 'string') return missing;
  if (spec.parser === 'uuid')
    return [
      ...missing,
      ['abc', name + ' must be a UUID'],
      ['aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa', name + ' must be a UUID'],
    ];
  if (spec.parser === 'code')
    return [
      ...missing,
      ['lower', codeMessage],
      ['1CODE', codeMessage],
      ['A B', codeMessage],
      ['A'.repeat(65), codeMessage],
    ];
  if (spec.parser === 'currency')
    return [
      ...missing,
      ['usd', 'Currency must be ISO 4217 uppercase'],
      ['US', 'Currency must be ISO 4217 uppercase'],
    ];
  if (spec.parser === 'decimal')
    return [
      ...missing,
      ['01', 'Invalid decimal'],
      ['1e3', 'Invalid decimal'],
      ['.5', 'Invalid decimal'],
      ['1.0000001', 'Invalid decimal'],
      ['1000000000000000000', 'Invalid decimal'],
      ['-1', name + ' must be non-negative'],
    ];
  if (spec.parser === 'enum')
    return [...missing, ['unsupported', required(spec.message)], ['lower', required(spec.message)]];
  if (spec.parser === 'timestamp')
    return [
      ...missing,
      ['not-time', name + ' must be a valid timestamp'],
      ['2026-13-01', name + ' must be a valid timestamp'],
    ];
  return [
    ...missing,
    ['2026-8-01', name + ' must be a valid YYYY-MM-DD date'],
    ['2026-08-01T00:00:00Z', name + ' must be a valid YYYY-MM-DD date'],
    ['2026-13-01', name + ' must be a valid YYYY-MM-DD date'],
    ['2026-02-32', name + ' must be a valid YYYY-MM-DD date'],
  ];
}
function sourceLine(f: ReturnType<typeof fixture>) {
  return record((f.body.lines as unknown[])[0]);
}

describe('bb114ff 17 canonical old procurement HTTP operations (mock only)', () => {
  for (const row of rows) {
    it(row.label + ' exact status, arguments, receiver and shallow output refs', async () => {
      const f = fixture(row),
        response = await f.dispatch(),
        q = { actor, scopes: f.scopes, anchors: f.anchors };
      const args =
        row.kind === 'list'
          ? [row.view, q]
          : row.kind === 'issue'
            ? [id, q, correlationId]
            : row.kind === 'qualification'
              ? [id, expectedInput(row, f.body), q, correlationId]
              : [expectedInput(row, f.body), q, correlationId];
      expect(f.call.mock.calls).toEqual([args]);
      expect(f.call.mock.contexts).toEqual([f.repository]);
      expect(response.statusCode).toBe(row.kind === 'list' ? 200 : 201);
      const actual = record(f.call.mock.calls[0]?.[scopeIndex(row)]);
      expect(actual).not.toBe(f.context);
      expect(actual.actor).toBe(actor);
      expect(actual.scopes).toBe(f.scopes);
      expect(actual.anchors).toBe(f.anchors);
      if (row.kind === 'list') {
        expect(record(response.body).items).not.toBe(f.output);
        expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      } else expect(response.body).toBe(f.returned);
      for (const key of ['contact', 'terms', 'evidence'])
        if (Object.hasOwn(f.body, key))
          expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[key]).toBe(f.body[key]);
      if (nested.includes(row)) {
        const actualLines = record(f.call.mock.calls[0]?.[0]).lines as unknown[];
        expect(actualLines).not.toBe(f.body.lines);
        expect(actualLines[0]).not.toBe((f.body.lines as unknown[])[0]);
      }
    });
    for (const scope of ['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)
      it(row.label + ' forwards ' + scope + ' to mock not PG scope proof', async () => {
        const f = fixture(row, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(row.kind === 'list' ? 200 : 201);
        expect(record(f.call.mock.calls[0]?.[scopeIndex(row)]).scopes).toBe(f.scopes);
      });
    for (const denied of ['missing', 'empty'] as const)
      it(row.label + ' denies ' + denied + ' primary grant before method', async () => {
        const f = fixture(row, denied === 'missing' ? { denied: true } : { scopes: [] });
        property(f.repository, row.method, () => {
          throw new Error('method');
        });
        error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
      });
    it(row.label + ' anchors absent defaults empty', async () => {
      const f = fixture(row, { noAnchors: true });
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[scopeIndex(row)]).anchors).toEqual([]);
    });
    it(row.label + ' global401 precedes root read', async () => {
      const f = fixture(row, { unauthenticated: true });
      property(f.dependencies, 'procurement', () => {
        throw new Error('root');
      });
      error(await f.dispatch(), 401, 'authentication_required', 'A valid session is required');
    });
    it(row.label + ' missing root skips404 not503', async () => {
      const f = fixture(row, { missing: true });
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
    it(row.label + ' missing method valid input becomes500', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => undefined);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    for (const [code, status] of [
      ['invalid_request', 400],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
    ] as const)
      it(row.label + ' preserves repository ' + code, async () => {
        const f = fixture(row);
        f.call.mockRejectedValue(new DomainError(code, 'old repo error'));
        error(await f.dispatch(), status, code, 'old repo error');
      });
    it(row.label + ' masks ordinary error', async () => {
      const f = fixture(row);
      f.call.mockRejectedValue(new Error('private'));
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' late root error is caught', async () => {
      const f = fixture(row);
      let reads = 0;
      property(f.dependencies, 'procurement', () => {
        if (++reads === 2) throw new Error('late root');
        return f.repository;
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(reads).toBe(2);
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' method getter error caught before invocation', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' Q reads scopes and anchors before late root', async () => {
      const f = fixture(row);
      const events: string[] = [];
      let roots = 0;
      property(required(f.permissions.get(row.cap)), 'scopes', () => {
        events.push('scopes');
        return f.scopes;
      });
      property(required(f.context.scopeAnchors), 'get', () => (cap: PermissionKey) => {
        events.push('anchors:' + cap);
        return f.anchors;
      });
      property(f.dependencies, 'procurement', () => {
        events.push('root' + String(++roots));
        return f.repository;
      });
      await f.dispatch();
      expect(events).toEqual(['root1', 'scopes', 'scopes', 'anchors:' + row.cap, 'root2']);
    });
    it(row.label + ' grant can replace late root', async () => {
      const f = fixture(row),
        replacement = fixture(row);
      property(required(f.context.scopeAnchors), 'get', () => () => {
        f.dependencies.procurement = replacement.repository as unknown as Repository;
        return f.anchors;
      });
      await f.dispatch();
      expect(f.call).not.toHaveBeenCalled();
      expect(replacement.call).toHaveBeenCalledOnce();
    });
    it(row.label + ' method getter replacement preserves captured receiver', async () => {
      const f = fixture(row),
        replacement = fixture(row),
        captured = f.call;
      property(f.repository, row.method, () => {
        f.dependencies.procurement = replacement.repository as unknown as Repository;
        return captured;
      });
      await f.dispatch();
      expect(captured.mock.contexts).toEqual([f.repository]);
      expect(replacement.call).not.toHaveBeenCalled();
    });
    it(row.label + ' actor replacement cannot change captured method', async () => {
      const f = fixture(row),
        replacement = fixture(row);
      property(f.context, 'actor', () => {
        f.dependencies.procurement = replacement.repository as unknown as Repository;
        return actor;
      });
      await f.dispatch();
      expect(f.call).toHaveBeenCalledOnce();
      expect(replacement.call).not.toHaveBeenCalled();
    });
    it(row.label + ' ignores nested query', async () => {
      const f = fixture(row),
        query = new Proxy(
          {},
          {
            get() {
              throw new Error('query');
            },
          },
        );
      expect((await f.dispatch({ query })).statusCode).toBe(row.kind === 'list' ? 200 : 201);
    });
    it(row.label + ' outer shallow request spread getter rejects outside catch', async () => {
      const f = fixture(row),
        cause = new Error('outer');
      const request: ApiRequest = {
        method: row.http,
        pathname: row.path,
        body: f.body,
        headers: f.headers,
      };
      property(request, 'query', () => {
        throw cause;
      });
      await expect(f.app.dispatch(request)).rejects.toBe(cause);
      expect(f.call).not.toHaveBeenCalled();
    });
  }
});

describe('wide guard, ordinary lookup, raw qualification and issue paths, neighbours', () => {
  for (const root of [null, false, 0, ''])
    it('falsy root ' + JSON.stringify(root) + ' skips', async () => {
      const f = fixture(required(rows[0]));
      property(f.dependencies, 'procurement', () => root);
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
  for (const pathname of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])
    it('inherited GET ' + pathname + ' fails before Q', async () => {
      const f = fixture(required(rows[0]), { denied: true });
      error(await f.dispatch({ pathname }), 500, 'internal_error', 'Internal server error');
    });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    it(method + ' inherited key not destructured', async () => {
      const f = fixture(required(rows[0]));
      error(
        await f.dispatch({ method, pathname: 'constructor' }),
        404,
        'not_found',
        'Route not found',
      );
    });
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    it('unsupported ' + method + ' reads only first root', async () => {
      const f = fixture(required(rows[0]));
      let roots = 0;
      property(f.dependencies, 'procurement', () => {
        roots++;
        return f.repository;
      });
      error(
        await f.dispatch({ method, pathname: '/api/v1/suppliers/' }),
        404,
        'not_found',
        'Route not found',
      );
      expect(roots).toBe(1);
    });
  it('health precedes root', async () => {
    const f = fixture(required(rows[0]));
    property(f.dependencies, 'procurement', () => {
      throw new Error('root');
    });
    expect((await f.dispatch({ pathname: '/health' })).statusCode).toBe(200);
  });
  for (const enabled of [false, true])
    it('shared unknown POST null body only when QTC ' + String(enabled), async () => {
      const f = fixture(required(rows[0]));
      if (enabled) f.dependencies.quoteToCash = {} as NonNullable<ApiDependencies['quoteToCash']>;
      error(
        await f.dispatch({ method: 'POST', pathname: '/unmatched', body: null }),
        enabled ? 400 : 404,
        enabled ? 'invalid_request' : 'not_found',
        enabled ? 'A JSON object body is required' : 'Route not found',
      );
    });
  it('manufacturing supported GET precedes procurement', async () => {
    const f = fixture(required(rows[0])),
      list = vi.fn<MockCall>().mockResolvedValue([]);
    f.dependencies.manufacturing = { list } as unknown as NonNullable<
      ApiDependencies['manufacturing']
    >;
    f.permissions.set('manufacturing-item:read', { scopes: ['COMPANY'], fields: null });
    property(f.dependencies, 'procurement', () => {
      throw new Error('late');
    });
    expect((await f.dispatch({ pathname: '/api/v1/manufacturing-items' })).statusCode).toBe(200);
    expect(list).toHaveBeenCalledOnce();
  });
  it('MRP supported GET follows skipped procurement', async () => {
    const f = fixture(required(rows[0])),
      list = vi.fn<MockCall>().mockResolvedValue([]);
    f.dependencies.mrp = { list } as unknown as NonNullable<ApiDependencies['mrp']>;
    f.permissions.set('mrp:read', { scopes: ['COMPANY'], fields: null });
    expect((await f.dispatch({ pathname: '/api/v1/mrp-runs' })).statusCode).toBe(200);
    expect(list).toHaveBeenCalledOnce();
    expect(f.call).not.toHaveBeenCalled();
  });
  for (const row of raw) {
    it(row.label + ' shortlowerhex matches then UUID400', async () => {
      const f = fixture(row);
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'ab-1') }),
        400,
        'invalid_request',
        (row.kind === 'issue' ? 'documentId' : 'supplierId') + ' must be a UUID',
      );
    });
    for (const alteration of [
      'uppercase',
      'nonhex',
      'slash',
      'suffix',
      'action',
      'LF',
      'CR',
      'LS',
      'PS',
    ])
      it(row.label + ' raw rejects ' + alteration, async () => {
        const f = fixture(row);
        const pathname =
          alteration === 'uppercase'
            ? row.path.replace(id, id.toUpperCase())
            : alteration === 'nonhex'
              ? row.path.replace(id, 'xyz')
              : alteration === 'slash'
                ? row.path + '/'
                : alteration === 'suffix'
                  ? row.path + '/x'
                  : alteration === 'action'
                    ? row.path.replace(/[^/]+$/u, 'unknown')
                    : row.path +
                      (alteration === 'LF'
                        ? '\n'
                        : alteration === 'CR'
                          ? '\r'
                          : alteration === 'LS'
                            ? '\u2028'
                            : '\u2029');
        error(await f.dispatch({ pathname }), 404, 'not_found', 'Route not found');
        expect(f.call).not.toHaveBeenCalled();
      });
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
      it(row.label + ' raw unsupported ' + method, async () => {
        const f = fixture(row);
        error(await f.dispatch({ method, body: null }), 404, 'not_found', 'Route not found');
      });
  }
});

describe('old P/M opaque output, late Map getters, arrays and shallow projection', () => {
  for (const row of rows) {
    it(row.label + ' late Map.get retains receiver and exact perrow calls', async () => {
      const f = fixture(row),
        wait = deferred<unknown>();
      f.call.mockReturnValue(wait.promise);
      const pending = f.dispatch();
      await vi.waitFor(() => {
        expect(f.call).toHaveBeenCalledOnce();
      });
      const get = vi.fn(function (this: typeof f.permissions, cap: PermissionKey) {
        expect(this).toBe(f.permissions);
        expect(cap).toBe(row.read);
        return { scopes: [], fields: ['nested'] };
      });
      property(f.permissions, 'get', () => get);
      wait.resolve(row.kind === 'list' ? f.output : f.returned);
      const response = await pending;
      expect(response.statusCode).toBe(row.kind === 'list' ? 200 : 201);
      expect(get).toHaveBeenCalledTimes(row.kind === 'list' ? 2 : 1);
      const body =
        row.kind === 'list'
          ? record((record(response.body).items as unknown[])[0])
          : record(response.body);
      expect(body).toEqual({ id, nested: f.returned.nested });
      expect(body.nested).toBe(f.returned.nested);
    });
    it(row.label + ' late fields getter error caught after repository success', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        f.permissions.set(row.read, { scopes: ['COMPANY'], fields: null });
        property(required(f.permissions.get(row.read)), 'fields', () => {
          throw new Error('fields');
        });
        return Promise.resolve(row.kind === 'list' ? f.output : f.returned);
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledOnce();
    });
    it(
      row.label + ' special own fields use Object.entries/fromEntries and shallow refs',
      async () => {
        const f = fixture(row);
        const output = Object.create({ inherited: true }) as Record<string, unknown>;
        Object.assign(output, { id, nested: f.returned.nested });
        Object.defineProperty(output, '__proto__', { enumerable: true, value: 'own' });
        Object.defineProperty(output, 'hidden', { value: true });
        f.permissions.set(row.read, {
          scopes: ['COMPANY'],
          fields: ['nested', '__proto__', 'inherited', 'hidden'],
        });
        f.call.mockResolvedValue(row.kind === 'list' ? [output] : output);
        const response = await f.dispatch();
        const body =
          row.kind === 'list'
            ? record((record(response.body).items as unknown[])[0])
            : record(response.body);
        expect(Object.keys(body)).toEqual(['id', 'nested', '__proto__']);
        expect(body.nested).toBe(f.returned.nested);
        expect(Object.getPrototypeOf(body)).toBe(Object.prototype);
      },
    );
  }
  for (const row of lists) {
    for (const fields of [null, [], ['name'], ['version', 'nested']] as const)
      it(row.label + ' Q0/P fields ' + JSON.stringify(fields), async () => {
        const f = fixture(row, { fields }),
          response = await f.dispatch({ body: null });
        expect(response.statusCode).toBe(200);
        const value = (record(response.body).items as unknown[])[0];
        if (fields === null) expect(value).toBe(f.returned);
        else
          expect(value).toEqual(
            Object.fromEntries(
              Object.entries(f.returned).filter(
                ([key]) => key === 'id' || (fields as readonly string[]).includes(key),
              ),
            ),
          );
      });
    it(row.label + ' each row reads then-current fields', async () => {
      const f = fixture(row);
      let reads = 0;
      f.call.mockImplementation(() => {
        property(required(f.permissions.get(row.cap)), 'fields', () =>
          ++reads === 1 ? ['name'] : ['version'],
        );
        return Promise.resolve(f.output);
      });
      expect((await f.dispatch()).body).toEqual({
        items: [
          { id, name: 'Visible' },
          { id: other, version: 7 },
        ],
      });
      expect(reads).toBe(2);
    });
    it(row.label + ' removed grant after await defaults P null without another Q', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        f.permissions.delete(row.cap);
        return Promise.resolve(f.output);
      });
      expect((record((await f.dispatch()).body).items as unknown[])[0]).toBe(f.returned);
    });
    it(row.label + ' map keeps holes and local inherited index', async () => {
      const f = fixture(row),
        array = new Array<unknown>(3),
        prototype = Object.create(Array.prototype) as object;
      Object.defineProperty(prototype, '1', { value: f.returned });
      Object.setPrototypeOf(array, prototype);
      f.call.mockResolvedValue(array);
      const output = record((await f.dispatch()).body).items as unknown[];
      expect(output).toHaveLength(3);
      expect(0 in output).toBe(false);
      expect(Object.hasOwn(output, 1)).toBe(true);
      expect(output[1]).toBe(f.returned);
      expect(2 in output).toBe(false);
    });
    for (const value of [null, {}, 1, 'opaque'])
      it(row.label + ' malformed items ' + JSON.stringify(value) + ' native500', async () => {
        const f = fixture(row);
        f.call.mockResolvedValue(value);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
    it(
      row.label + ' raw rows preserved at null fields, null row fails only under P filtering',
      async () => {
        const f = fixture(row);
        const values = [null, undefined, 1, 'opaque', [], {}];
        f.call.mockResolvedValue(values);
        const output = record((await f.dispatch()).body).items as unknown[];
        expect(output).toEqual(values);
        expect(output[4]).toBe(values[4]);
        f.permissions.set(row.cap, { scopes: ['COMPANY'], fields: [] });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      },
    );
  }
  for (const row of writes) {
    for (const fields of [null, [], ['name'], ['version', 'nested']] as const)
      it(
        row.label + ' independent empty read scopes fields ' + JSON.stringify(fields),
        async () => {
          const f = fixture(row);
          f.permissions.set(row.read, { scopes: [], fields });
          const response = await f.dispatch();
          expect(response.statusCode).toBe(201);
          if (fields === null) expect(response.body).toBe(f.returned);
          else
            expect(response.body).toEqual(
              Object.fromEntries(
                Object.entries(f.returned).filter(
                  ([key]) => key === 'id' || (fields as readonly string[]).includes(key),
                ),
              ),
            );
        },
      );
    it(row.label + ' no read only id/version', async () => {
      const f = fixture(row, { noRead: true });
      expect((await f.dispatch()).body).toEqual({ id, version: 7 });
    });
    it(row.label + ' removed read after await retains id/version', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        f.permissions.delete(row.read);
        return Promise.resolve(f.returned);
      });
      expect((await f.dispatch()).body).toEqual({ id, version: 7 });
    });
    for (const value of [null, undefined, 9, 'opaque', [], { raw: true }])
      it(row.label + ' null fields preserve raw ' + JSON.stringify(value), async () => {
        const f = fixture(row);
        f.call.mockResolvedValue(value);
        expect((await f.dispatch()).body).toBe(value);
      });
    it(row.label + ' no-read null result native500 after successful call', async () => {
      const f = fixture(row, { noRead: true });
      f.call.mockResolvedValue(null);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledOnce();
    });
  }
});

describe('body/allow/field permissions and raw issue defaults preserve first errors', () => {
  for (const row of writes) {
    for (const body of [undefined, null, [], false, 0, 'body'])
      it(row.label + ' body ' + JSON.stringify(body) + ' before denied Q', async () => {
        const f = fixture(row, { denied: true }),
          fallback = row.kind === 'issue' && (body === null || body === undefined);
        error(
          await f.dispatch({ body }),
          fallback ? 403 : 400,
          fallback ? 'forbidden' : 'invalid_request',
          fallback ? 'Permission denied' : 'A JSON object body is required',
        );
        expect(f.call).not.toHaveBeenCalled();
      });
    it(row.label + ' unknown ownkeys sorted before denied Q', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ body: { ...f.body, zzz: 1, aaa: 2 } }),
        400,
        'invalid_request',
        'Unsupported fields: aaa, zzz',
      );
    });
    it(row.label + ' inherited inputs/symbol ignored by ownkeys grant', async () => {
      const f = fixture(row, { fields: [] });
      const body = Object.create({ ...f.body, unexpected: true }) as Record<string, unknown>;
      Object.defineProperty(body, Symbol('ignored'), { enumerable: true, value: 1 });
      expect((await f.dispatch({ body })).statusCode).toBe(201);
    });
    it(row.label + ' denied Q before any value getter', async () => {
      const f = fixture(row, { denied: true });
      if (row.kind !== 'issue')
        property(f.body, required(Object.keys(f.body)[0]), () => {
          throw new Error('value');
        });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
    if (row.kind !== 'issue') {
      it(row.label + ' own undefined allowed field still requests field permission', async () => {
        const f = fixture(row, { fields: [] });
        f.body[required(Object.keys(f.body)[0])] = undefined;
        error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
      });
      it(row.label + ' body value getter failure inside HTTP catch', async () => {
        const f = fixture(row);
        property(f.body, required(Object.keys(f.body)[0]), () => {
          throw new Error('input');
        });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
    }
  }
  for (const row of issues) {
    for (const body of [undefined, null, {}, new Date(0)])
      it(
        row.label + ' Q0 and nullish fallback ' + Object.prototype.toString.call(body),
        async () => {
          const f = fixture(row, { fields: [] });
          expect((await f.dispatch({ body })).statusCode).toBe(201);
        },
      );
    it(row.label + ' UUID error precedes late method getter', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        400,
        'invalid_request',
        'documentId must be a UUID',
      );
    });
    it(row.label + ' bad body precedes short path UUID and denied Q', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a'), body: [] }),
        400,
        'invalid_request',
        'A JSON object body is required',
      );
    });
    it(row.label + ' denied Q precedes short path UUID', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        403,
        'forbidden',
        'Permission denied',
      );
    });
    it(row.label + ' short UUID wins actor getter and missing method', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => undefined);
      property(f.context, 'actor', () => {
        throw new Error('actor');
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        400,
        'invalid_request',
        'documentId must be a UUID',
      );
    });
  }
});

describe('top input parsers, priority of errors and original enum capture', () => {
  for (const row of writes.filter((r) => r.kind !== 'issue')) {
    const specs = fieldsFor(row);
    for (const spec of specs) {
      for (const [index, [value, message]] of badCases(spec).entries())
        it(row.label + ' ' + spec.name + ' invalid ' + String(index), async () => {
          const f = fixture(row);
          f.body[spec.name] = value;
          error(await f.dispatch(), 400, 'invalid_request', message);
          expect(f.call).not.toHaveBeenCalled();
        });
      it(
        row.label + ' bad ' + spec.name + ' beats actor and missing method invocation',
        async () => {
          const f = fixture(row);
          const [value, message] = required(badCases(spec)[0]);
          f.body[spec.name] = value;
          property(f.repository, row.method, () => undefined);
          property(f.context, 'actor', () => {
            throw new Error('actor');
          });
          error(await f.dispatch(), 400, 'invalid_request', message);
        },
      );
      if (spec.parser !== 'enum')
        it(row.label + ' method getter precedes ' + spec.name + ' parse', async () => {
          const f = fixture(row);
          f.body[spec.name] = required(badCases(spec)[0])[0];
          property(f.repository, row.method, () => {
            throw new Error('method');
          });
          error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        });
      if (spec.parser === 'uuid')
        it(row.label + ' ' + spec.name + ' UUID trim retains uppercase', async () => {
          const f = fixture(row);
          f.body[spec.name] = ' ' + other.toUpperCase() + ' ';
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(
            other.toUpperCase(),
          );
        });
      if (spec.parser === 'code')
        for (const value of ['A', 'A'.repeat(64), ' CODE_1-X '])
          it(row.label + ' ' + spec.name + ' stable accepts ' + String(value.length), async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(value.trim());
          });
      if (spec.parser === 'decimal')
        for (const [value, normalized] of [
          ['0', '0'],
          ['-0.000000', '0'],
          ['999999999999999999.999999', '999999999999999999.999999'],
          [' 1.230000 ', '1.23'],
        ] as const)
          it(row.label + ' ' + spec.name + ' decimal accepts ' + value, async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(normalized);
          });
      if (spec.parser === 'integer')
        for (const value of [required(spec.min), required(spec.max)])
          it(row.label + ' ' + spec.name + ' bound ' + String(value), async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(value);
          });
      if (spec.parser === 'timestamp')
        for (const [value, normalized] of [
          ['2026-08-01', iso],
          ['2026-02-30', '2026-03-02T00:00:00.000Z'],
          [' ' + time + ' ', iso],
        ] as const)
          it(row.label + ' ' + spec.name + ' Date accepts ' + value, async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(normalized);
          });
      if (spec.parser === 'calendar')
        for (const value of ['2026-02-30', '2026-04-31', ' 0000-01-01 '])
          it(row.label + ' ' + spec.name + ' calendar keeps ' + value, async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(value.trim());
          });
      if (spec.nullable)
        for (const value of [null, undefined])
          it(row.label + ' ' + spec.name + ' nullish default ' + String(value), async () => {
            const f = fixture(row);
            f.body[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            const actual = record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name];
            expect(actual).toEqual(spec.parser === 'object' ? {} : null);
          });
      if (spec.parser === 'object') {
        for (const value of [
          { nested: { keep: true } },
          Object.create(null) as object,
          new Date(0),
        ])
          it(
            row.label +
              ' ' +
              spec.name +
              ' shallow JSON object ' +
              Object.prototype.toString.call(value),
            async () => {
              const f = fixture(row);
              f.body[spec.name] = value;
              expect((await f.dispatch()).statusCode).toBe(201);
              expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(value);
            },
          );
        it(
          row.label + ' ' + spec.name + ' missing creates distinct empty object per request',
          async () => {
            const f = fixture(row);
            Reflect.deleteProperty(f.body, spec.name);
            await f.dispatch();
            await f.dispatch();
            const first = record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name],
              second = record(f.call.mock.calls[1]?.[inputIndex(row)])[spec.name];
            expect(first).toEqual({});
            expect(second).toEqual({});
            expect(first).not.toBe(second);
          },
        );
      }
    }
    for (let i = 0; i < specs.length - 1; i++) {
      const first = required(specs[i]),
        next = required(specs[i + 1]);
      it(row.label + ' ' + first.name + ' error before ' + next.name, async () => {
        const f = fixture(row);
        const [value, message] = required(badCases(first)[0]);
        f.body[first.name] = value;
        property(f.body, next.name, () => {
          throw new Error('next input');
        });
        error(await f.dispatch(), 400, 'invalid_request', message);
      });
    }
    it(row.label + ' top input getter after capture cannot replace receiver', async () => {
      const f = fixture(row),
        replacement = fixture(row),
        spec = required(specs.find((s) => s.parser !== 'enum')),
        value = f.body[spec.name];
      property(f.body, spec.name, () => {
        f.dependencies.procurement = replacement.repository as unknown as Repository;
        return value;
      });
      await f.dispatch();
      expect(f.call.mock.contexts).toEqual([f.repository]);
      expect(replacement.call).not.toHaveBeenCalled();
    });
    for (const spec of specs.filter((s) => s.parser === 'enum')) {
      for (const value of required(spec.values))
        it(row.label + ' enum accepts ' + value, async () => {
          const f = fixture(row);
          f.body[spec.name] = ' ' + value + ' ';
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(value);
        });
      it(row.label + ' enum parsed once and may replace late root', async () => {
        const f = fixture(row),
          replacement = fixture(row);
        let reads = 0;
        property(f.body, spec.name, () => {
          reads++;
          f.dependencies.procurement = replacement.repository as unknown as Repository;
          return reads === 1 ? required(spec.values)[0] : 'bad';
        });
        await f.dispatch();
        expect(reads).toBe(1);
        expect(f.call).not.toHaveBeenCalled();
        expect(replacement.call).toHaveBeenCalledOnce();
      });
      it(row.label + ' bad enum precedes method getter', async () => {
        const f = fixture(row);
        f.body[spec.name] = 'bad';
        property(f.repository, row.method, () => {
          throw new Error('method');
        });
        error(await f.dispatch(), 400, 'invalid_request', required(spec.message));
      });
    }
  }
  const qualification = required(rows.find((r) => r.kind === 'qualification'));
  it('qualification valid enum then method getter before supplier UUID', async () => {
    const f = fixture(qualification);
    property(f.repository, 'qualifySupplier', () => {
      throw new Error('method');
    });
    error(
      await f.dispatch({ pathname: qualification.path.replace(id, 'a') }),
      500,
      'internal_error',
      'Internal server error',
    );
  });
  it('qualification enum error before supplier UUID and method getter', async () => {
    const f = fixture(qualification);
    f.body.status = 'bad';
    property(f.repository, 'qualifySupplier', () => {
      throw new Error('method');
    });
    error(
      await f.dispatch({ pathname: qualification.path.replace(id, 'a') }),
      400,
      'invalid_request',
      'qualification status is unsupported',
    );
  });
  for (const row of rows.filter((r) => r.kind === 'rfq' || r.kind === 'order'))
    for (const value of [true, false, 1, 'true', null, undefined])
      it(row.label + ' issue is strict ===true ' + JSON.stringify(value), async () => {
        const f = fixture(row);
        f.body.issue = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0]).issue).toBe(value === true);
      });
});

describe('nested lines parse before capture; sparse arrays and receipt own-defaults', () => {
  for (const row of nested) {
    for (const value of [undefined, null, {}, 'x', false])
      it(
        row.label + ' lines array rejects ' + JSON.stringify(value) + ' before method',
        async () => {
          const f = fixture(row);
          f.body.lines = value;
          property(f.repository, row.method, () => {
            throw new Error('method');
          });
          error(await f.dispatch(), 400, 'invalid_request', 'lines must be an array');
        },
      );
    it(row.label + ' empty lines before method and top input', async () => {
      const f = fixture(row);
      f.body.lines = [];
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(await f.dispatch(), 400, 'invalid_request', 'lines must not be empty');
    });
    for (const value of [undefined, null, [], false, 1, 'x'])
      it(row.label + ' lines[0] JSON object ' + JSON.stringify(value), async () => {
        const f = fixture(row);
        f.body.lines = [value];
        error(await f.dispatch(), 400, 'invalid_request', 'lines[0] must be a JSON object');
      });
    it(row.label + ' nested unknown own fields sorted before capture', async () => {
      const f = fixture(row);
      Object.assign(sourceLine(f), { zzz: 1, aaa: 2 });
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(await f.dispatch(), 400, 'invalid_request', 'Unsupported fields: aaa, zzz');
    });
    it(row.label + ' denied Q precedes nested invalid array', async () => {
      const f = fixture(row, { denied: true });
      f.body.lines = null;
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
    for (const spec of lineFields(row)) {
      for (const [index, [value, message]] of badCases(spec).entries())
        it(
          row.label + ' line ' + spec.name + ' invalid ' + String(index) + ' before method',
          async () => {
            const f = fixture(row);
            sourceLine(f)[spec.name] = value;
            property(f.repository, row.method, () => {
              throw new Error('method');
            });
            error(await f.dispatch(), 400, 'invalid_request', message);
            expect(f.call).not.toHaveBeenCalled();
          },
        );
      if (spec.parser === 'decimal')
        for (const [value, normalized] of [
          ['0', '0'],
          ['-0.000000', '0'],
          ['999999999999999999.999999', '999999999999999999.999999'],
          [' 1.230000 ', '1.23'],
        ] as const)
          it(row.label + ' line ' + spec.name + ' decimal ' + value, async () => {
            const f = fixture(row);
            sourceLine(f)[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(
              record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[spec.name],
            ).toBe(normalized);
          });
      if (spec.parser === 'uuid')
        it(row.label + ' line ' + spec.name + ' UUID retains upper', async () => {
          const f = fixture(row);
          sourceLine(f)[spec.name] = ' ' + other.toUpperCase() + ' ';
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[spec.name]).toBe(
            other.toUpperCase(),
          );
        });
      if (spec.parser === 'calendar')
        for (const value of ['2026-02-30', '2026-04-31', ' 0000-01-01 '])
          it(row.label + ' line ' + spec.name + ' weak calendar ' + value, async () => {
            const f = fixture(row);
            sourceLine(f)[spec.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(
              record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[spec.name],
            ).toBe(value.trim());
          });
    }
    const specs = lineFields(row);
    for (let i = 0; i < specs.length - 1; i++) {
      const first = required(specs[i]),
        next = required(specs[i + 1]);
      it(row.label + ' line ' + first.name + ' error before ' + next.name, async () => {
        const f = fixture(row);
        const [value, message] = required(badCases(first)[0]);
        sourceLine(f)[first.name] = value;
        property(sourceLine(f), next.name, () => {
          throw new Error('next line field');
        });
        error(await f.dispatch(), 400, 'invalid_request', message);
      });
    }
    it(row.label + ' later line failure precedes top getter/capture', async () => {
      const f = fixture(row);
      f.body.lines = [sourceLine(f), null];
      property(f.body, required(fieldsFor(row)[0]).name, () => {
        throw new Error('top');
      });
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(await f.dispatch(), 400, 'invalid_request', 'lines[1] must be a JSON object');
    });
    it(row.label + ' accepts nonempty all-hole lines through HTTP mock', async () => {
      const f = fixture(row);
      f.body.lines = new Array<unknown>(2);
      expect((await f.dispatch()).statusCode).toBe(201);
      const actual = record(f.call.mock.calls[0]?.[0]).lines as unknown[];
      expect(actual).toHaveLength(2);
      expect(0 in actual).toBe(false);
      expect(1 in actual).toBe(false);
    });
    it(row.label + ' local inherited array index parsed into own mapped row', async () => {
      const f = fixture(row),
        line = sourceLine(f),
        array = new Array<unknown>(1),
        prototype = Object.create(Array.prototype) as object;
      Object.defineProperty(prototype, '0', { value: line });
      Object.setPrototypeOf(array, prototype);
      f.body.lines = array;
      expect((await f.dispatch()).statusCode).toBe(201);
      const actual = record(f.call.mock.calls[0]?.[0]).lines as unknown[];
      expect(Object.hasOwn(actual, 0)).toBe(true);
      expect(actual[0]).not.toBe(line);
    });
    it(row.label + ' inherited line inputs and symbols ignored by line allow', async () => {
      const f = fixture(row),
        line = Object.create({ ...sourceLine(f), unexpected: 1 }) as Record<string, unknown>;
      Object.defineProperty(line, Symbol('ignored'), { value: true, enumerable: true });
      f.body.lines = [line];
      expect((await f.dispatch()).statusCode).toBe(201);
    });
    it(row.label + ' nested getter can replace root before capture', async () => {
      const f = fixture(row),
        replacement = fixture(row),
        line = sourceLine(f),
        name = required(lineFields(row)[0]).name,
        value = line[name];
      property(line, name, () => {
        f.dependencies.procurement = replacement.repository as unknown as Repository;
        return value;
      });
      await f.dispatch();
      expect(f.call).not.toHaveBeenCalled();
      expect(replacement.call.mock.contexts).toEqual([replacement.repository]);
    });
  }
  const receipt = required(rows.find((r) => r.kind === 'receipt'));
  for (const name of ['manufacturedAt', 'expiresAt']) {
    for (const value of [undefined, null])
      it('receipt own ' + name + ' nullish maps null ' + String(value), async () => {
        const f = fixture(receipt);
        sourceLine(f)[name] = value;
        await f.dispatch();
        expect(record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[name]).toBeNull();
      });
    it('receipt inherited ' + name + ' ignored without reading getter', async () => {
      const f = fixture(receipt),
        line = sourceLine(f),
        prototype = {};
      Reflect.deleteProperty(line, name);
      property(prototype, name, () => {
        throw new Error('inherited date');
      });
      Object.setPrototypeOf(line, prototype);
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[name]).toBeNull();
    });
  }
});

describe('location-only effective capability and Map.has/get receiver order', () => {
  const locations = required(lists.find((r) => r.view === 'locations'));
  it('only move grant falls back with its scopes/anchors/late fields', async () => {
    const f = fixture(locations, { denied: true }),
      scopes = ['TEAM'] as const,
      anchors = [{ scope: 'TEAM', organizationId: other }] as const;
    f.permissions.set('inventory:move', { scopes, fields: ['name'] });
    f.scopeAnchors.set('inventory:move', anchors);
    expect((await f.dispatch()).body).toEqual({
      items: [
        { id, name: 'Visible' },
        { id: other, name: 'Visible' },
      ],
    });
    const q = record(f.call.mock.calls[0]?.[1]);
    expect(q.scopes).toBe(scopes);
    expect(q.anchors).toBe(anchors);
  });
  it('has read key even empty scopes prevents move fallback', async () => {
    const f = fixture(locations, { scopes: [] });
    f.permissions.set('inventory:move', { scopes: ['GROUP'], fields: null });
    error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
  });
  for (const fields of [null, [], ['name']] as const)
    it('read key exists keeps read fields ' + JSON.stringify(fields), async () => {
      const f = fixture(locations, { fields });
      f.permissions.set('inventory:move', { scopes: ['GROUP'], fields: ['nested'] });
      const response = await f.dispatch();
      expect(response.statusCode).toBe(200);
      if (fields === null) expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      else
        expect((record(response.body).items as unknown[])[0]).toEqual(
          fields.length ? { id, name: 'Visible' } : { id },
        );
      expect(record(f.call.mock.calls[0]?.[1]).scopes).toBe(f.scopes);
    });
  for (const fallback of [false, true])
    it('has/get receiver and order, fallback ' + String(fallback), async () => {
      const f = fixture(locations, { denied: fallback });
      if (fallback) f.permissions.set('inventory:move', { scopes: ['COMPANY'], fields: null });
      const events: string[] = [],
        has = f.permissions.has.bind(f.permissions),
        get = f.permissions.get.bind(f.permissions);
      property(
        f.permissions,
        'has',
        () =>
          function (this: typeof f.permissions, cap: PermissionKey) {
            expect(this).toBe(f.permissions);
            events.push('has:' + cap);
            return has(cap);
          },
      );
      property(
        f.permissions,
        'get',
        () =>
          function (this: typeof f.permissions, cap: PermissionKey) {
            expect(this).toBe(f.permissions);
            events.push('get:' + cap);
            return get(cap);
          },
      );
      await f.dispatch();
      const cap = fallback ? 'inventory:move' : 'inventory:read';
      expect(events).toEqual([
        'has:inventory:read',
        ...(fallback ? ['has:inventory:move'] : []),
        ...Array.from({ length: 4 }, () => 'get:' + cap),
      ]);
    });
  it('only move with empty scopes denies', async () => {
    const f = fixture(locations, { denied: true });
    f.permissions.set('inventory:move', { scopes: [], fields: null });
    error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
  });
  for (const row of lists.filter((r) => r.view !== 'locations'))
    it(row.label + ' never consults has/move fallback', async () => {
      const f = fixture(row, { denied: true });
      f.permissions.set('inventory:move', { scopes: ['GROUP'], fields: null });
      property(f.permissions, 'has', () => {
        throw new Error('has touched');
      });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
  it('fallback projection uses selected capability even if grants change after await', async () => {
    const f = fixture(locations, { denied: true });
    f.permissions.set('inventory:move', { scopes: ['COMPANY'], fields: ['name'] });
    f.call.mockImplementation(() => {
      f.permissions.set('inventory:read', { scopes: ['GROUP'], fields: ['nested'] });
      f.permissions.set('inventory:move', { scopes: [], fields: ['version'] });
      return Promise.resolve(f.output);
    });
    expect((await f.dispatch()).body).toEqual({
      items: [
        { id, version: 7 },
        { id: other, version: 7 },
      ],
    });
  });
  it('removed fallback grant after await becomes raw P, not read fallback re-selection', async () => {
    const f = fixture(locations, { denied: true });
    f.permissions.set('inventory:move', { scopes: ['COMPANY'], fields: [] });
    f.call.mockImplementation(() => {
      f.permissions.delete('inventory:move');
      f.permissions.set('inventory:read', { scopes: ['GROUP'], fields: [] });
      return Promise.resolve(f.output);
    });
    expect((record((await f.dispatch()).body).items as unknown[])[0]).toBe(f.returned);
  });
  for (const cause of ['has', 'get'] as const)
    it('fallback ' + cause + ' getter failure masks as500', async () => {
      const f = fixture(locations);
      property(f.permissions, cause, () => {
        throw new Error('map');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
});

describe('exact evaluation trace and eager own-entry projection', () => {
  for (const row of writes.filter((r) => r.kind !== 'issue')) {
    it(row.label + ' exact body read order relative to late root/method/actor', async () => {
      const f = fixture(row),
        events: string[] = [],
        bodyEntries = Object.entries(f.body),
        line = f.body.lines ? sourceLine(f) : undefined,
        captured = f.call;
      let roots = 0;
      for (const [key, value] of bodyEntries)
        property(f.body, key, () => {
          events.push(key);
          return value;
        });
      if (line)
        for (const [key, value] of Object.entries(line))
          property(line, key, () => {
            events.push('line.' + key);
            return value;
          });
      property(f.dependencies, 'procurement', () => {
        events.push('root' + String(++roots));
        return f.repository;
      });
      property(f.repository, row.method, () => {
        events.push('method');
        return captured;
      });
      property(f.context, 'actor', () => {
        events.push('actor');
        return actor;
      });
      await f.dispatch();
      const top: Readonly<Partial<Record<Kind, readonly string[]>>> = {
        supplier: [
          'supplierNumber',
          'name',
          'currency',
          'paymentTermsDays',
          'qualityRatingBasisPoints',
          'qualityRatingBasisPoints',
          'qualityRatingBasisPoints',
          'contact',
        ],
        qualification: [
          'itemVersionId',
          'validFrom',
          'validTo',
          'minimumOrderQuantity',
          'leadTimeDays',
          'evidence',
        ],
        rfq: ['rfqNumber', 'responseDueAt', 'currency', 'issue'],
        quote: ['rfqId', 'supplierId', 'quoteReference', 'receivedAt', 'validUntil', 'terms'],
        order: ['poNumber', 'supplierId', 'supplierQuoteId', 'currency', 'issue'],
        location: ['code', 'name'],
        receipt: ['receiptNumber', 'purchaseOrderId', 'receivedAt', 'sourceReference'],
        move: [
          'itemVersionId',
          'lotId',
          'locationId',
          'quantity',
          'occurredAt',
          'sourceType',
          'sourceId',
        ],
      };
      const pre =
        row.kind === 'qualification'
          ? ['status']
          : row.kind === 'location'
            ? ['locationType']
            : row.kind === 'move'
              ? ['movementType']
              : nested.includes(row)
                ? ['lines', ...lineFields(row).map((s) => 'line.' + s.name)]
                : [];
      expect(events).toEqual([
        'root1',
        ...pre,
        'root2',
        'method',
        ...required(top[row.kind]),
        'actor',
      ]);
    });
    for (const shape of ['Date', 'null-prototype'] as const)
      it(row.label + ' objectBody accepts ' + shape + ' with old fields', async () => {
        const f = fixture(row);
        const body = Object.assign(
          shape === 'Date' ? new Date(0) : (Object.create(null) as object),
          f.body,
        );
        expect((await f.dispatch({ body })).statusCode).toBe(201);
      });
  }
  for (const row of rows)
    it(row.label + ' P eagerly reads unselected own getter, null fields do not', async () => {
      const f = fixture(row),
        output: Record<string, unknown> = { id };
      property(output, 'unselected', () => {
        throw new Error('unselected getter');
      });
      f.call.mockResolvedValue(row.kind === 'list' ? [output] : output);
      const first = await f.dispatch();
      expect(first.statusCode).toBe(row.kind === 'list' ? 200 : 201);
      expect(row.kind === 'list' ? (record(first.body).items as unknown[])[0] : first.body).toBe(
        output,
      );
      f.permissions.set(row.read, { scopes: ['COMPANY'], fields: [] });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledTimes(2);
    });
  for (const row of nested)
    for (const shape of ['Date', 'null-prototype'] as const)
      it(row.label + ' line jsonObject accepts ' + shape + ' with fields', async () => {
        const f = fixture(row),
          line = Object.assign(
            shape === 'Date' ? new Date(0) : (Object.create(null) as object),
            sourceLine(f),
          );
        f.body.lines = [line];
        expect((await f.dispatch()).statusCode).toBe(201);
        expect((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0]).not.toBe(line);
      });
  for (const row of issues)
    it(row.label + ' invalid UUID avoids second root even if it throws', async () => {
      const f = fixture(row);
      let roots = 0;
      property(f.dependencies, 'procurement', () => {
        if (++roots === 2) throw new Error('late root');
        return f.repository;
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        400,
        'invalid_request',
        'documentId must be a UUID',
      );
      expect(roots).toBe(1);
    });
  const qualification = required(rows.find((r) => r.kind === 'qualification'));
  it('qualification supplier UUID before item UUID/other input and actor when method missing', async () => {
    const f = fixture(qualification);
    f.body.itemVersionId = 'bad';
    property(f.repository, 'qualifySupplier', () => undefined);
    property(f.context, 'actor', () => {
      throw new Error('actor');
    });
    error(
      await f.dispatch({ pathname: qualification.path.replace(id, 'a') }),
      400,
      'invalid_request',
      'supplierId must be a UUID',
    );
  });
});

describe('nullable expression reads and receipt own-date capture', () => {
  for (const spec of [
    { kind: 'supplier', name: 'qualityRatingBasisPoints', valid: 7, next: 9 },
    { kind: 'qualification', name: 'validTo', valid: date, next: '2027-01-01' },
    { kind: 'order', name: 'supplierQuoteId', valid: id, next: other },
  ]) {
    for (const sequence of [
      [null],
      [undefined, undefined],
      [spec.valid, spec.valid, spec.next],
      [undefined, spec.valid, spec.next],
    ])
      it(spec.kind + ' nullable getter sequence ' + JSON.stringify(sequence), async () => {
        const row = required(rows.find((r) => r.kind === spec.kind)),
          f = fixture(row);
        let reads = 0;
        property(f.body, spec.name, () => {
          if (reads >= sequence.length) throw new Error('unexpected extra nullable read');
          return sequence[reads++];
        });
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(reads).toBe(sequence.length);
        expect(record(f.call.mock.calls[0]?.[inputIndex(row)])[spec.name]).toBe(
          sequence.length === 3 ? spec.next : null,
        );
      });
  }
  for (const name of ['manufacturedAt', 'expiresAt'])
    for (const value of [undefined, null, date])
      it('receipt own date getter read once ' + name + ' ' + String(value), async () => {
        const f = fixture(required(rows.find((r) => r.kind === 'receipt')));
        let reads = 0;
        property(sourceLine(f), name, () => {
          if (++reads > 1) throw new Error('date reread');
          return value;
        });
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(reads).toBe(1);
        expect(record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])[name]).toBe(
          value ?? null,
        );
      });
});
