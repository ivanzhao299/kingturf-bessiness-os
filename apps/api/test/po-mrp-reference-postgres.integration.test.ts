import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresMrpRepository } from '../src/mrp-repositories.js';
import { assertStableCode, type AuthorizationContext } from '@kingturf/domain';
import {
  allow,
  array,
  calendarDate,
  currency,
  decimal,
  jsonObject,
  mutationDto,
  objectBody,
  string,
  uuid,
} from '../src/app-values.ts';
import { authorizeQuery } from '../src/policy.ts';
import { procurementPurchaseOrderCreateRoutes } from '../src/routes/procurement-purchase-order-create.ts';
import { dispatchRoutes } from '../src/routes/types.ts';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.js';

const idOf = (row: Readonly<Record<string, unknown>>) => {
  if (typeof row.id !== 'string') throw new Error('Fixture id missing');
  return row.id;
};
const rowsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

describe('TD-MFG-013 purchase order proposal references on real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedProcurementApp>>;
  let token: string, supplier: string, material: string, proposal: string, run: string;
  const dispatch = async (request: Parameters<typeof fixture.dispatch>[0]) => {
    const response = await fixture.dispatch(request);
    if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body))
      throw new Error('Expected object response');
    return { ...response, body: response.body as Record<string, unknown> };
  };
  const post = (number: string, reference?: string, bearer = token) =>
    dispatch({
      token: bearer,
      method: 'POST',
      pathname: '/api/v1/purchase-orders',
      body: {
        poNumber: number,
        supplierId: supplier,
        supplierQuoteId: null,
        currency: 'CNY',
        issue: false,
        lines: [
          { itemVersionId: material, quantity: '10', unitPrice: '2', requiredAt: '2026-12-10' },
        ],
        ...(reference === undefined ? {} : { mrpProposalId: reference }),
      },
    });
  const read = (path: string, bearer = token) =>
    dispatch({ token: bearer, method: 'GET', pathname: path });
  const grant = (
    employee: string,
    capability: string,
    fields: string[] | null,
    scopes: string[] = ['COMPANY'],
  ) =>
    fixture.db.query(
      `UPDATE role_permission_grants g SET field_allowlist=$3::text[],data_scopes=$4::data_scope[]
     FROM permissions p WHERE p.id=g.permission_id AND p.capability=$2
     AND g.role_id IN(SELECT role_id FROM employee_role_assignments WHERE employee_id=$1)`,
      [employee, capability, fields, scopes],
    );
  beforeEach(async () => {
    fixture = await ownedProcurementApp('po_mrp_ref_pg');
    token = await fixture.session(fixture.employee, 'ALL');
    material = idOf(
      await fixture.manufacturing.createItem(
        {
          sku: 'RAW-PG2',
          name: '原料',
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        fixture.context,
        randomUUID(),
      ),
    );
    supplier = idOf(
      await fixture.repository.createSupplier(
        {
          supplierNumber: 'SUP-PG2',
          name: '供应商',
          currency: 'CNY',
          paymentTermsDays: 30,
          qualityRatingBasisPoints: null,
          contact: {},
        },
        fixture.context,
        randomUUID(),
      ),
    );
    await fixture.repository.qualifySupplier(
      supplier,
      {
        itemVersionId: material,
        status: 'APPROVED',
        validFrom: '2026-01-01',
        validTo: null,
        minimumOrderQuantity: '0',
        leadTimeDays: 1,
        evidence: {},
      },
      fixture.context,
      randomUUID(),
    );
    const mrp = new PostgresMrpRepository(fixture.db);
    await mrp.createDemand(
      {
        itemVersionId: material,
        sourceType: 'PG2-TEST',
        sourceId: randomUUID(),
        requiredAt: '2026-12-10',
        quantity: '10',
        priority: 100,
      },
      fixture.context,
      randomUUID(),
    );
    run = idOf(
      await mrp.run(
        { runNumber: 'MRP-PG2', asOf: '2026-11-01T00:00:00Z', horizonEnd: '2026-12-31' },
        fixture.context,
        randomUUID(),
      ),
    );
    const suggestions = (await mrp.listProposalPage(fixture.context, { runId: run })).items;
    proposal = idOf(suggestions[0] ?? {});
  }, 60_000);
  afterEach(async () => {
    await fixture.close();
  });

  it('persists the supplied proposal reference and exposes it additively in list, detail and MRP executions', async () => {
    const created = await post('PO-REF', proposal);
    expect(created.statusCode).toBe(201);
    const id = idOf(created.body);
    expect(
      (await fixture.db.query('SELECT mrp_proposal_id FROM purchase_orders WHERE id=$1', [id]))
        .rows,
    ).toEqual([{ mrp_proposal_id: proposal }]);
    const detail = await read(`/api/v1/purchase-orders/${id}`);
    const list = await read('/api/v1/purchase-orders');
    expect(detail.statusCode).toBe(200);
    for (const row of [detail.body, ...rowsOf(list.body.items)]) {
      expect(row).toMatchObject({
        id,
        po_number: 'PO-REF',
        mrp_proposal_id: proposal,
        mrpProposalNumber: proposal,
        mrp_run_id: run,
      });
    }
    const base = (await fixture.repository.list('orders', fixture.context))[0];
    const enriched = rowsOf(list.body.items)[0] ?? {};
    const { mrpProposalNumber: number, mrp_run_id: runId, ...unchanged } = enriched;
    expect(number).toBe(proposal);
    expect(runId).toBe(run);
    expect(unchanged).toEqual(base);
    const mrp = await read(`/api/v1/mrp-runs/${run}`);
    expect(mrp.statusCode).toBe(200);
    expect(mrp.body.purchaseOrders).toEqual([
      { proposalId: proposal, orderId: id, poNumber: 'PO-REF', status: 'DRAFT' },
    ]);
    expect(
      (
        await fixture.db.query('SELECT payload FROM domain_event_outbox WHERE aggregate_id=$1', [
          id,
        ])
      ).rows,
    ).toMatchObject([{ payload: { mrpProposalId: proposal } }]);
  });

  it('the legacy create route also parses and stores the optional proposal reference', async () => {
    const effective = { fields: null, scopes: ['COMPANY'] as const };
    const authorization: AuthorizationContext = {
      actor: fixture.context.actor,
      permissions: new Map([
        ['procurement:read', effective],
        ['procurement:manage', effective],
      ] as const),
    };
    const response = await dispatchRoutes(
      procurementPurchaseOrderCreateRoutes({
        repository: () => fixture.repository,
        authorization,
        authorizeQuery,
        correlationId: randomUUID(),
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
      {
        method: 'POST',
        pathname: '/api/v1/purchase-orders',
        headers: {},
        body: {
          poNumber: 'PO-LEGACY-REF',
          supplierId: supplier,
          supplierQuoteId: null,
          mrpProposalId: proposal,
          currency: 'CNY',
          issue: false,
          lines: [
            { itemVersionId: material, quantity: '10', unitPrice: '2', requiredAt: '2026-12-10' },
          ],
        },
      },
    );
    expect(response?.statusCode).toBe(201);
    expect(
      (
        await fixture.db.query('SELECT mrp_proposal_id FROM purchase_orders WHERE po_number=$1', [
          'PO-LEGACY-REF',
        ])
      ).rows,
    ).toEqual([{ mrp_proposal_id: proposal }]);
  });

  it('manual creation leaves a null reference and retains the existing response keys', async () => {
    const response = await post('PO-MANUAL');
    expect(response.statusCode).toBe(201);
    expect(Object.hasOwn(response.body, 'mrpProposalId')).toBe(false);
    expect(
      (
        await fixture.db.query('SELECT mrp_proposal_id FROM purchase_orders WHERE id=$1', [
          idOf(response.body),
        ])
      ).rows,
    ).toEqual([{ mrp_proposal_id: null }]);
    const foreign = await fixture.session(fixture.otherEmployee, 'ALL');
    expect((await read(`/api/v1/purchase-orders/${idOf(response.body)}`, foreign)).statusCode).toBe(
      404,
    );
  });

  it('rejects production, foreign-company and missing proposals with 409 and zero writes', async () => {
    const mrp = new PostgresMrpRepository(fixture.db);
    const product = idOf(
      await fixture.manufacturing.createItem(
        {
          sku: 'FG-PG2',
          name: '成品',
          itemType: 'FINISHED_GOOD',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        fixture.context,
        randomUUID(),
      ),
    );
    await mrp.createDemand(
      {
        itemVersionId: product,
        sourceType: 'PG2-TEST',
        sourceId: randomUUID(),
        requiredAt: '2026-12-10',
        quantity: '1',
        priority: 100,
      },
      fixture.context,
      randomUUID(),
    );
    const secondRun = idOf(
      await mrp.run(
        { runNumber: 'MRP-PRODUCTION', asOf: '2026-11-01T00:00:00Z', horizonEnd: '2026-12-31' },
        fixture.context,
        randomUUID(),
      ),
    );
    const production = (
      await mrp.listProposalPage(fixture.context, { runId: secondRun, proposalType: 'PRODUCTION' })
    ).items[0];
    if (!production) throw new Error('Production proposal missing');
    for (const [index, reference] of [idOf(production), randomUUID()].entries()) {
      const result = await post(`PO-BAD-${String(index)}`, reference);
      expect(result.statusCode).toBe(409);
      expect(result.body).toMatchObject({
        error: { code: 'conflict', message: '来源建议必须是本公司的采购类物料需求建议' },
      });
    }
    const otherEmployee = await fixture.addEmployee();
    const other = await fixture.session(otherEmployee, ['procurement:manage']);
    // A real foreign-company session cannot reference this company's proposal.
    const foreign = await fixture.session(fixture.otherEmployee, 'ALL');
    const foreignResult = await post('PO-FOREIGN', proposal, foreign);
    expect(foreignResult.statusCode).toBe(409);
    expect(foreignResult.body).toMatchObject({
      error: { code: 'conflict', message: '来源建议必须是本公司的采购类物料需求建议' },
    });
    // A procurement-only writer may use a valid reference without separately obtaining mrp:read.
    expect((await post('PO-WRITER', proposal, other)).statusCode).toBe(201);
    expect(
      (
        await fixture.db.query<{ po_number: string }>(
          'SELECT po_number FROM purchase_orders ORDER BY po_number',
        )
      ).rows,
    ).toEqual([{ po_number: 'PO-WRITER' }]);
  });

  it('gates derived MRP origins by mrp:read scope and fields while retaining the procurement-owned reference', async () => {
    const created = await post('PO-READ', proposal);
    expect(created.statusCode).toBe(201);
    const id = idOf(created.body);
    const employee = await fixture.addEmployee();
    const limited = await fixture.session(employee, ['procurement:read', 'mrp:read']);
    for (const [fields, scopes] of [
      [['id'], ['COMPANY']],
      [null, ['TEAM']],
    ] as const) {
      await grant(employee, 'mrp:read', fields === null ? null : [...fields], [...scopes]);
      for (const path of ['/api/v1/purchase-orders', `/api/v1/purchase-orders/${id}`]) {
        const result = await read(path, limited);
        expect(result.statusCode).toBe(200);
        const values = path.endsWith(id) ? [result.body] : rowsOf(result.body.items);
        for (const row of values) {
          expect(row.mrp_proposal_id).toBe(proposal);
          expect(row).not.toHaveProperty('mrp_run_id');
          expect(row).not.toHaveProperty('mrpProposalNumber');
        }
      }
    }
    await grant(employee, 'mrp:read', null);
    await grant(employee, 'procurement:read', ['po_number']);
    expect((await read(`/api/v1/purchase-orders/${id}`, limited)).body).toEqual({
      id,
      po_number: 'PO-READ',
    });
    const result = await read(`/api/v1/mrp-runs/${run}`, limited);
    expect(result.statusCode).toBe(200);
    expect(result.body).not.toHaveProperty('purchaseOrders');
  });

  it('0081 provides a nullable tenant-safe foreign key, non-unique index and immutable stored reference', async () => {
    const created = await post('PO-FK', proposal);
    expect(created.statusCode).toBe(201);
    const id = idOf(created.body);
    const constraints = await fixture.db.query<{ definition: string }>(
      "SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='purchase_orders'::regclass AND conname='purchase_orders_mrp_proposal_fk'",
    );
    expect(constraints.rows[0]?.definition).toContain(
      'FOREIGN KEY (mrp_proposal_id, tenant_id) REFERENCES mrp_proposals(id, tenant_id)',
    );
    const index = await fixture.db.query<{ definition: string }>(
      "SELECT pg_get_indexdef(indexrelid) definition FROM pg_index WHERE indrelid='purchase_orders'::regclass AND indexrelid='purchase_orders_mrp_proposal_idx'::regclass AND NOT indisunique",
    );
    expect(index.rows[0]?.definition).toContain('(tenant_id, mrp_proposal_id)');
    await expect(
      fixture.db.query('UPDATE purchase_orders SET mrp_proposal_id=$2 WHERE id=$1', [
        id,
        randomUUID(),
      ]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'purchase order content is immutable' });
  });
});
