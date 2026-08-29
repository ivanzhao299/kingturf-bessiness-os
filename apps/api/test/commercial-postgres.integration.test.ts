import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresCommercialRepository } from '../src/commercial-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; commercial PostgreSQL tests may not be skipped');

describe('JTF-P1-E05..E10 PostgreSQL acceptance', () => {
  const identifier = (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('Expected identifier');
    return value;
  };
  const schema = `commercial_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    otherCompany = randomUUID(),
    team = randomUUID(),
    scopedTeam = randomUUID(),
    otherTeam = randomUUID(),
    employee = randomUUID(),
    scopedEmployee = randomUUID(),
    outsider = randomUUID(),
    customer = randomUUID();
  const actor = { companyId: company, employeeId: employee } as const;
  let admin: Database, db: Database, commercial: PostgresCommercialRepository;
  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'A','A','COMPANY'),($2,'B','B','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'TA','TA','TEAM'),($3,$2,'SA','SA','TEAM'),($4,$5,'TB','TB','TEAM')",
      [team, company, scopedTeam, otherTeam, otherCompany],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E','Employee','e@a.test'),($4,$2,$5,'S','Scoped','s@a.test'),($6,$7,$8,'O','Outsider','o@b.test')",
      [employee, company, team, scopedEmployee, scopedTeam, outsider, otherCompany, otherTeam],
    );
    await db.query(
      "INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES($1,$2,'C1','Customer','customer','ACTIVE',$3,$4,$3,$3)",
      [customer, company, employee, team],
    );
    commercial = new PostgresCommercialRepository(db);
  });
  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('executes the pinned commercial graph and freezes issued evidence', async () => {
    const opportunity = await commercial.createOpportunity(
      {
        customerId: customer,
        leadId: null,
        name: 'Arena',
        value: '1000',
        currency: 'CNY',
        probabilityBasisPoints: 6000,
        expectedCloseDate: '2027-01-01',
      },
      actor,
      randomUUID(),
    );
    expect(
      await commercial.listOpportunities(
        { companyId: otherCompany, employeeId: outsider },
        ['COMPANY'],
        [],
      ),
    ).toEqual([]);
    const opportunityUpdates = await Promise.allSettled([
      commercial.updateOpportunity(
        opportunity.id,
        { name: 'Arena A' },
        1,
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
      commercial.updateOpportunity(
        opportunity.id,
        { name: 'Arena B' },
        1,
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ]);
    expect(opportunityUpdates.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(opportunityUpdates.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const ctr = await commercial.createCtr(
      {
        opportunityId: opportunity.id,
        code: 'CTR-1',
        title: 'Arena requirements',
        requirements: { area: '1000' },
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    await commercial.submitCtr(
      identifier(ctr.id),
      1,
      'ctr-submit',
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    const ctr2 = await commercial.createCtrVersion(
      identifier(ctr.ctrId),
      { title: 'Arena requirements v2', requirements: { area: '1100' } },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect(ctr2).toMatchObject({ ctrId: ctr.ctrId, version: 2, status: 'DRAFT' });
    const ctrApprovals = await Promise.allSettled([
      commercial.approveCtr(
        identifier(ctr.id),
        'APPROVED',
        'first',
        'ctr-approve-a',
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
      commercial.approveCtr(
        identifier(ctr.id),
        'APPROVED',
        'second',
        'ctr-approve-b',
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ]);
    expect(ctrApprovals.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(ctrApprovals.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(
      db.query(
        'INSERT INTO ctr_attachment_links(tenant_id,ctr_version_id,attachment_id,linked_by) VALUES($1,$2,$3,$4)',
        [company, ctr.id, randomUUID(), employee],
      ),
    ).rejects.toThrow(/draft version/u);
    const solution = await commercial.createTechnicalSolution(
      {
        opportunityId: opportunity.id,
        code: 'TS-1',
        ctrVersionId: identifier(ctr.id),
        specification: { system: 'turf' },
        assumptions: ['level base'],
        final: true,
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    const solution2 = await commercial.createTechnicalSolutionRevision(
      identifier(solution.technicalSolutionId),
      {
        ctrVersionId: identifier(ctr.id),
        specification: { system: 'turf-v2' },
        assumptions: [],
        final: true,
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect(solution2).toMatchObject({
      technicalSolutionId: solution.technicalSolutionId,
      revision: 2,
      status: 'FINAL',
    });
    const otherOpportunity = await commercial.createOpportunity(
      {
        customerId: customer,
        leadId: null,
        name: 'Other arena',
        value: '10',
        currency: 'CNY',
        probabilityBasisPoints: 1000,
        expectedCloseDate: '2027-02-01',
      },
      actor,
      randomUUID(),
    );
    await expect(
      commercial.createTechnicalSolution(
        {
          opportunityId: otherOpportunity.id,
          code: 'TS-PIN-MISMATCH',
          ctrVersionId: identifier(ctr.id),
          specification: {},
          assumptions: [],
          final: true,
        },
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/same opportunity/u);
    const model = await commercial.createDefinition(
      'cost',
      { code: 'CM-1', name: 'Base cost', currency: 'CNY', rules: [], publish: true },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    const modelRoot = await db.query<{ cost_model_id: string }>(
      'SELECT cost_model_id FROM cost_model_versions WHERE id=$1',
      [model.id],
    );
    const model2 = await commercial.createDefinitionVersion(
      'cost',
      identifier(modelRoot.rows[0]?.cost_model_id),
      { currency: 'CNY', rules: [], publish: true },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    expect(model2).toMatchObject({ version: 2, status: 'PUBLISHED' });
    const matrix = await commercial.createCostMatrix(
      {
        code: 'MATRIX-QUOTE-1',
        name: 'Quote-linked specification matrix',
        productSpecification: { costBasis: 'M2' },
        currency: 'CNY',
        defaultTaxRate: '0.13',
      },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    await commercial.addCostMatrixFactor(
      identifier(matrix.id),
      {
        factorCode: 'YARN',
        factorName: 'PE yarn resin',
        category: 'DIRECT_MATERIAL',
        sourceType: 'MARKET_REFERENCE',
        quantity: '0.620000',
        unitCode: 'KG',
        manualUnitPriceTaxInclusive: '8.600000',
        taxRate: '0.130000',
        priceSourceName: 'Dated spot benchmark',
        priceSourceReference: 'MARKET-2026-08-28',
        priceEffectiveAt: '2026-08-28',
        priceNote: 'Editable planning baseline',
        adjustable: true,
        sortOrder: 10,
      },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    const matrixCalculation = await commercial.calculateCostMatrix(
      identifier(matrix.id),
      'TAX_INCLUSIVE',
      'matrix-calculate-1',
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    expect(matrixCalculation).toMatchObject({ totalCost: '5.332000' });
    expect(matrixCalculation.factorTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolvedSourceType: 'MARKET_REFERENCE',
          sourceReference: 'MARKET-2026-08-28',
          unitCode: 'KG',
        }),
      ]),
    );
    const quoteCost = await commercial.createQuoteCostDecisionFromMatrix(
      identifier(matrixCalculation.id),
      {
        technicalSolutionRevisionId: identifier(solution.id),
        modelVersionId: identifier(model.id),
        idempotencyKey: 'matrix-quote-cost-1',
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect(quoteCost).toMatchObject({ matrixCost: '5.332000', total: '5.332' });
    const matrixCosts = await commercial.listCommercialView('costs', actor, ['COMPANY'], []);
    const linkedCost = matrixCosts.find((candidate) => candidate.id === quoteCost.costDecisionId);
    expect(linkedCost?.opportunityId).toBe(opportunity.id);
    expect(linkedCost?.technicalSolutionRevisionId).toBe(solution.id);
    await expect(
      commercial.createDefinition(
        'cost',
        { code: 'CM-DENIED', name: 'Denied', currency: 'CNY', rules: [], publish: true },
        actor,
        ['SELF'],
        randomUUID(),
      ),
    ).rejects.toThrow(/company scope/u);
    const cost = await commercial.evaluateCost(
      {
        modelVersionId: identifier(model.id),
        technicalSolutionRevisionId: identifier(solution.id),
        currency: 'CNY',
        lines: [
          {
            key: 'turf',
            description: 'Turf',
            quantity: { value: '10', unit: 'M2' },
            unitCost: { amount: '20', currency: 'CNY' },
          },
        ],
        context: { region: 'CN' },
        idempotencyKey: 'cost-1',
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    const concurrentInput = {
      modelVersionId: identifier(model.id),
      technicalSolutionRevisionId: identifier(solution.id),
      currency: 'CNY',
      lines: [
        {
          key: 'concurrent',
          description: 'Concurrent',
          quantity: { value: '1.000001', unit: 'EA' },
          unitCost: { amount: '2.000001', currency: 'CNY' },
        },
      ],
      context: { boundary: true },
      idempotencyKey: 'cost-concurrent',
    } as const;
    const concurrent = await Promise.all([
      commercial.evaluateCost(concurrentInput, actor, ['COMPANY'], [], randomUUID()),
      commercial.evaluateCost(concurrentInput, actor, ['COMPANY'], [], randomUUID()),
    ]);
    expect(concurrent[0]).toEqual(concurrent[1]);
    expect(
      await db.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM cost_sheet_decisions WHERE idempotency_key='cost-concurrent'",
      ),
    ).toMatchObject({ rows: [{ count: '1' }] });
    await expect(
      commercial.evaluateCost(
        {
          ...concurrentInput,
          lines: [
            {
              key: 'different',
              description: 'Different request',
              quantity: { value: '2', unit: 'EA' },
              unitCost: { amount: '2', currency: 'CNY' },
            },
          ],
        },
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/another command/u);
    const policy = await commercial.createDefinition(
      'policy',
      {
        code: 'SP-1',
        name: 'Standard',
        rules: [
          {
            when: {
              op: 'eq',
              left: { op: 'input', path: 'region' },
              right: { op: 'literal', value: 'CN' },
            },
            effect: { passed: true, approvalRequired: false, minimumMarginBasisPoints: 1000 },
            reason: 'standard',
          },
        ],
        publish: true,
      },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    const policyRoot = await db.query<{ sales_policy_id: string }>(
      'SELECT sales_policy_id FROM sales_policy_versions WHERE id=$1',
      [policy.id],
    );
    const policy2 = await commercial.createDefinitionVersion(
      'policy',
      identifier(policyRoot.rows[0]?.sales_policy_id),
      { rules: [], publish: true },
      actor,
      ['COMPANY'],
      randomUUID(),
    );
    expect(policy2).toMatchObject({ version: 2, status: 'PUBLISHED' });
    const evaluation = await commercial.evaluatePolicy(
      {
        policyVersionId: identifier(policy.id),
        costDecisionId: identifier(cost.id),
        context: { marginBasisPoints: 3333, discountBasisPoints: 0, region: 'SPOOFED' },
        idempotencyKey: 'policy-1',
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    const retainedPolicyContext = await db.query<{ canonical_input: Record<string, unknown> }>(
      'SELECT canonical_input FROM sales_policy_evaluations WHERE id=$1',
      [evaluation.id],
    );
    expect(retainedPolicyContext.rows[0]?.canonical_input.region).toBe('CN');
    const alternateSolution = await commercial.createTechnicalSolution(
      {
        opportunityId: opportunity.id,
        code: 'TS-2',
        ctrVersionId: identifier(ctr.id),
        specification: { system: 'alternate' },
        assumptions: [],
        final: true,
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    await expect(
      commercial.createQuote(
        {
          quoteNumber: 'Q-PIN-MISMATCH',
          opportunityId: opportunity.id,
          ctrVersionId: identifier(ctr.id),
          technicalSolutionRevisionId: identifier(alternateSolution.id),
          costDecisionId: identifier(cost.id),
          policyVersionId: identifier(policy.id),
          policyEvaluationId: identifier(evaluation.id),
          currency: 'CNY',
          subtotal: '300',
          discount: '0',
          total: '300',
          costTotal: '200',
          margin: '100',
          marginBasisPoints: 3333,
          validUntil: '2027-01-01T00:00:00.000Z',
          lines: [
            { description: 'Turf', quantity: '10', unitCode: 'M2', unitPrice: '30', total: '300' },
          ],
        },
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/cost decision/u);
    const quote = await commercial.createQuote(
      {
        quoteNumber: 'Q-1',
        opportunityId: opportunity.id,
        ctrVersionId: identifier(ctr.id),
        technicalSolutionRevisionId: identifier(solution.id),
        costDecisionId: identifier(cost.id),
        policyVersionId: identifier(policy.id),
        policyEvaluationId: identifier(evaluation.id),
        currency: 'CNY',
        subtotal: '300',
        discount: '0',
        total: '300',
        costTotal: '200',
        margin: '100',
        marginBasisPoints: 3333,
        validUntil: '2027-01-01T00:00:00.000Z',
        lines: [
          { description: 'Turf', quantity: '10', unitCode: 'M2', unitPrice: '30', total: '300' },
        ],
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    const quote2 = await commercial.createQuote(
      {
        quoteId: identifier(quote.quoteId),
        quoteNumber: 'Q-1',
        opportunityId: opportunity.id,
        ctrVersionId: identifier(ctr.id),
        technicalSolutionRevisionId: identifier(solution.id),
        costDecisionId: identifier(cost.id),
        policyVersionId: identifier(policy.id),
        policyEvaluationId: identifier(evaluation.id),
        currency: 'CNY',
        subtotal: '300',
        discount: '0',
        total: '300',
        costTotal: '200',
        margin: '100',
        marginBasisPoints: 3333,
        validUntil: '2027-01-01T00:00:00.000Z',
        lines: [
          {
            description: 'Turf revised',
            quantity: '10',
            unitCode: 'M2',
            unitPrice: '30',
            total: '300',
          },
        ],
      },
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect(quote2).toMatchObject({ quoteId: quote.quoteId, revision: 2, status: 'DRAFT' });
    await expect(
      commercial.issueQuote(
        identifier(quote.id),
        'cross-scope-issue',
        { companyId: company, employeeId: scopedEmployee },
        ['SELF'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/not found/u);
    const issued = await commercial.issueQuote(
      identifier(quote.id),
      'issue-1',
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect(issued.status).toBe('ISSUED');
    const issuedSnapshot = await db.query<{ status: string }>(
      "SELECT snapshot->>'status' AS status FROM quote_issued_snapshots WHERE quote_revision_id=$1",
      [quote.id],
    );
    expect(issuedSnapshot.rows[0]?.status).toBe('ISSUED');
    expect(
      await commercial.issueQuote(
        identifier(quote.id),
        'issue-1',
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).toEqual(issued);
    await expect(
      commercial.issueQuote(
        identifier(quote.id),
        'ctr-submit',
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/another command/u);
    await expect(
      commercial.issueQuote(
        identifier(quote.id),
        'issue-1',
        { companyId: company, employeeId: scopedEmployee },
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/another command/u);
    await expect(
      commercial.evaluateCost(
        {
          modelVersionId: identifier(model.id),
          technicalSolutionRevisionId: identifier(solution.id),
          currency: 'CNY',
          lines: [
            {
              key: 'blocked',
              description: 'Blocked',
              quantity: { value: '1', unit: 'EA' },
              unitCost: { amount: '1', currency: 'CNY' },
            },
          ],
          context: {},
          idempotencyKey: 'cross-scope-cost',
        },
        { companyId: company, employeeId: scopedEmployee },
        ['SELF'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/not found/u);
    await expect(
      db.query("UPDATE quote_lines SET description='changed' WHERE quote_revision_id=$1", [
        quote.id,
      ]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query(
        "INSERT INTO quote_lines(tenant_id,quote_revision_id,line_number,description,quantity,unit_code,unit_price,total) VALUES($1,$2,99,'late',1,'EA',1,1)",
        [company, quote.id],
      ),
    ).rejects.toThrow(/immutable/u);
    await expect(db.query('DELETE FROM quote_revisions WHERE id=$1', [quote.id])).rejects.toThrow(
      /cannot be deleted/u,
    );
    await expect(
      db.query("UPDATE cost_model_versions SET rules='[]' WHERE id=$1", [model.id]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query("UPDATE sales_policy_versions SET rules='[]' WHERE id=$1", [policy.id]),
    ).rejects.toThrow(/immutable/u);
    const pins = await db.query<{ opportunity_snapshot_id: string }>(
      'SELECT opportunity_snapshot_id FROM quote_revisions WHERE id=$1',
      [quote.id],
    );
    expect(pins.rows[0]?.opportunity_snapshot_id).toBeTruthy();
    const lateCorrelation = randomUUID();
    await expect(
      commercial.createQuote(
        {
          quoteNumber: 'Q-LATE-ROLLBACK',
          opportunityId: opportunity.id,
          ctrVersionId: identifier(ctr.id),
          technicalSolutionRevisionId: identifier(solution.id),
          costDecisionId: identifier(cost.id),
          policyVersionId: identifier(policy.id),
          policyEvaluationId: identifier(evaluation.id),
          currency: 'CNY',
          subtotal: '300',
          discount: '0',
          total: '300',
          costTotal: '200',
          margin: '100',
          marginBasisPoints: 3333,
          validUntil: '2027-01-01T00:00:00.000Z',
          lines: [
            {
              description: 'Invalid unit',
              quantity: '10',
              unitCode: 'UNKNOWN',
              unitPrice: '30',
              total: '300',
            },
          ],
        },
        actor,
        ['COMPANY'],
        [],
        lateCorrelation,
      ),
    ).rejects.toThrow();
    const rolledBack = await db.query<{ quotes: string; audits: string; events: string }>(
      `SELECT (SELECT count(*)::text FROM quotes WHERE quote_number='Q-LATE-ROLLBACK') quotes,(SELECT count(*)::text FROM audit_events WHERE correlation_id=$1) audits,(SELECT count(*)::text FROM domain_event_outbox WHERE correlation_id=$1) events`,
      [lateCorrelation],
    );
    expect(rolledBack.rows[0]).toEqual({ quotes: '0', audits: '0', events: '0' });
  });

  it('rolls back data, audit, and outbox together on failure', async () => {
    const correlation = randomUUID();
    await expect(
      commercial.createCtr(
        { opportunityId: randomUUID(), code: 'BAD', title: 'Bad', requirements: {} },
        actor,
        ['COMPANY'],
        [],
        correlation,
      ),
    ).rejects.toThrow();
    const counts = await db.query<{ audits: string; events: string }>(
      `SELECT (SELECT count(*)::text FROM audit_events WHERE correlation_id=$1) audits,(SELECT count(*)::text FROM domain_event_outbox WHERE correlation_id=$1) events`,
      [correlation],
    );
    expect(counts.rows[0]).toEqual({ audits: '0', events: '0' });
  });
});
