import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresCommissionRepository } from '../src/commission-repositories.js';
import { PostgresBusinessDocumentRepository } from '../src/business-document-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';
import { ownedHttpApi } from './fixtures/owned-http-api.js';

// Characterization of the existing defect, not a passing security acceptance contract.
describe('TD-SEC-010 actual HTTP characterization on owned PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>>;
  let http: Awaited<ReturnType<typeof ownedHttpApi>> | undefined;
  let owner: Awaited<ReturnType<NonNullable<typeof http>['user']>>;
  let peer: typeof owner, outsider: typeof owner;
  const capabilities = [
    'commission:accrue',
    'commission:pay',
    'commission:read',
    'business-document:send',
    'business-document:read',
  ];
  const counts = async () =>
    (
      await fixture.db.query(
        'SELECT (SELECT count(*)::int FROM commission_cases) cases,(SELECT count(*)::int FROM commission_ledger_entries) ledger,(SELECT count(*)::int FROM business_document_dispatches) dispatches,(SELECT count(*)::int FROM audit_events) audits,(SELECT count(*)::int FROM domain_event_outbox) outbox',
      )
    ).rows;
  async function json(response: Response, status: number) {
    expect(response.status).toBe(status);
    return (await response.json()) as Record<string, unknown>;
  }
  async function commission(code: string) {
    const policy = await new PostgresCommissionRepository(fixture.db).createPolicy(
      {
        code,
        name: code,
        applicability: { currency: 'CNY', channel: 'DIRECT' },
        baseRateBasisPoints: 300,
        minimumMarginBasisPoints: 2000,
        releaseCollectionBasisPoints: 0,
        effectiveAt: '2026-01-01T00:00:00Z',
        rules: [],
        publish: true,
      },
      fixture.context,
      randomUUID(),
    );
    if (typeof policy.id !== 'string') throw new Error('Synthetic policy missing');
    return {
      salesOrderId: fixture.graph.orderId,
      beneficiaryEmployeeId: fixture.context.actor.employeeId,
      policyVersionId: policy.id,
      accountingPeriod: '2026-08',
    };
  }
  beforeAll(async () => {
    fixture = await ownedCommercialGraph();
    http = await ownedHttpApi(fixture);
    owner = await http.user(fixture.context.actor.employeeId, fixture.context.actor.companyId);
    peer = await http.user(fixture.reviewerEmployee, fixture.context.actor.companyId);
    outsider = await http.user(
      fixture.otherContext.actor.employeeId,
      fixture.otherContext.actor.companyId,
    );
    await owner.grant(capabilities, ['COMPANY']);
    await peer.grant(capabilities, ['SELF']);
    await outsider.grant(capabilities, ['COMPANY']);
  }, 30000);
  afterAll(async () => {
    try {
      await http?.close();
    } finally {
      await fixture.close();
    }
  });
  it('known accrual key returns inaccessible data although fresh key and current list reject it', async () => {
    const body = await commission('SEC010-HTTP-ACCRUE'),
      key = randomUUID();
    const first = await json(
      await owner.request('/api/v1/commissions/accrue', 'POST', body, key),
      201,
    );
    expect(first).toHaveProperty('salesOrderId', fixture.graph.orderId);
    expect(await json(await peer.request('/api/v1/commissions'), 200)).toMatchObject({ items: [] });
    const before = await counts();
    expect(
      await json(await peer.request('/api/v1/commissions/accrue', 'POST', body, randomUUID()), 404),
    ).not.toHaveProperty('commission_amount');
    const leaked = await json(
      await peer.request('/api/v1/commissions/accrue', 'POST', body, key),
      201,
    );
    expect(leaked).toMatchObject({
      id: first.id,
      sales_order_id: fixture.graph.orderId,
      commission_amount: 28500,
    });
    expect(
      await json(await outsider.request('/api/v1/commissions/accrue', 'POST', body, key), 404),
    ).not.toHaveProperty('commission_amount');
    await peer.grant(['commission:accrue'], []);
    expect(
      await json(await peer.request('/api/v1/commissions/accrue', 'POST', body, key), 403),
    ).not.toHaveProperty('commission_amount');
    await peer.grant(['commission:accrue'], ['SELF']);
    expect(await counts()).toEqual(before);
  });
  it('known event key returns inaccessible old evidence even for a different path identifier', async () => {
    const body = await commission('SEC010-HTTP-PAY');
    const first = await json(
      await owner.request('/api/v1/commissions/accrue', 'POST', body, randomUUID()),
      201,
    );
    const command = { reason: 'Synthetic payment', externalReference: 'SYNTHETIC-ONLY' },
      key = randomUUID();
    const paid = await json(
      await owner.request(`/api/v1/commissions/${String(first.id)}/pay`, 'POST', command, key),
      201,
    );
    const inaccessible = `/api/v1/commissions/${randomUUID()}/pay`,
      before = await counts();
    expect(
      await json(await peer.request(inaccessible, 'POST', command, randomUUID()), 404),
    ).not.toHaveProperty('amount');
    const leaked = await json(await peer.request(inaccessible, 'POST', command, key), 201);
    expect(leaked).toMatchObject({ id: first.id, state: 'PAID', amount: paid.amount });
    expect(
      await json(await outsider.request(inaccessible, 'POST', command, key), 404),
    ).not.toHaveProperty('amount');
    await peer.grant(['commission:pay'], []);
    expect(
      await json(await peer.request(inaccessible, 'POST', command, key), 403),
    ).not.toHaveProperty('amount');
    await peer.grant(['commission:pay'], ['SELF']);
    expect(await counts()).toEqual(before);
  });
  it('known complete send request replays receipt outside creator scope without provider calls', async () => {
    const repository = new PostgresBusinessDocumentRepository(fixture.db),
      actor = fixture.context.actor;
    const document = await repository.create(
      {
        templateKey: '13-quotes',
        title: 'SEC010 HTTP synthetic',
        route: 'quotes',
        customerId: fixture.graph.customerId,
        content: { body: 'Synthetic only' },
      },
      actor,
      randomUUID(),
    );
    await repository.configureConnector(
      'EMAIL',
      {
        provider: 'RESEND',
        displayName: 'Synthetic queued adapter',
        senderIdentity: 'sender@example.test',
        secretReference: 'KINGTURF_CONNECTOR_EMAIL_TOKEN',
        configuration: {},
        status: 'READY',
        expectedVersion: 0,
      },
      actor,
      randomUUID(),
    );
    await repository.transition(
      document.id,
      { expectedVersion: 1, action: 'SUBMITTED', reason: 'Synthetic submit' },
      fixture.context,
      randomUUID(),
    );
    await repository.transition(
      document.id,
      { expectedVersion: 1, action: 'APPROVED', reason: 'Synthetic independent approve' },
      {
        actor: { companyId: actor.companyId, employeeId: fixture.reviewerEmployee },
        scopes: ['COMPANY'],
      },
      randomUUID(),
    );
    const body = {
        expectedVersion: 1,
        channel: 'EMAIL',
        recipientName: 'Synthetic buyer',
        recipientAddress: 'synthetic@example.test',
        subject: 'Synthetic evidence',
        message: 'Queued only, no provider call',
      },
      key = randomUUID(),
      path = `/api/v1/business-documents/${document.id}/send`;
    const first = await json(await owner.request(path, 'POST', body, key), 202);
    const before = await counts();
    expect(
      await json(await peer.request(`/api/v1/business-documents/${document.id}`), 404),
    ).not.toHaveProperty('content');
    expect(
      await json(await peer.request(path, 'POST', body, randomUUID()), 409),
    ).not.toHaveProperty('id');
    expect(await json(await peer.request(path, 'POST', body, key), 202)).toEqual(first);
    expect(
      await json(await peer.request(path, 'POST', { ...body, subject: 'Changed' }, key), 409),
    ).not.toHaveProperty('id');
    expect(await json(await outsider.request(path, 'POST', body, key), 409)).not.toHaveProperty(
      'id',
    );
    await peer.grant(['business-document:send'], []);
    expect(await json(await peer.request(path, 'POST', body, key), 403)).not.toHaveProperty('id');
    expect(await counts()).toEqual(before);
  });
});
