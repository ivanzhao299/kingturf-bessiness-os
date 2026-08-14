import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresCrmRepository } from '../src/crm-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; CRM PostgreSQL tests may not be skipped');

describe('JTF-P1-E01..E04 PostgreSQL acceptance', () => {
  const schema = `crm_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID();
  const otherCompany = randomUUID();
  const team = randomUUID();
  const otherTeam = randomUUID();
  const peerTeam = randomUUID();
  const nestedTeam = randomUUID();
  const deepTeam = randomUUID();
  const actorId = randomUUID();
  const assigneeId = randomUUID();
  const outsiderId = randomUUID();
  const peerId = randomUUID();
  const nestedId = randomUUID();
  const actor = { companyId: company, employeeId: actorId } as const;
  let admin: Database;
  let db: Database;
  let crm: PostgresCrmRepository;
  let adminOpened = false;
  let schemaCreated = false;
  let dbOpened = false;

  async function expectBoundary(correlationId: string, action: string, count = 1) {
    const audit = await db.query<{ action: string }>(
      'SELECT action FROM audit_events WHERE organization_id=$1 AND correlation_id=$2',
      [company, correlationId],
    );
    const outbox = await db.query<{ event_type: string }>(
      'SELECT event_type FROM domain_event_outbox WHERE tenant_id=$1 AND correlation_id=$2',
      [company, correlationId],
    );
    expect(audit.rows).toHaveLength(count);
    expect(outbox.rows).toHaveLength(count);
    if (count === 1) {
      expect(audit.rows[0]?.action).toBe(action);
      expect(outbox.rows[0]?.event_type).toBe(action);
    }
  }

  beforeAll(async () => {
    admin = new Database(connectionString);
    adminOpened = true;
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    dbOpened = true;
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'CRM','CRM','COMPANY'),($2,'OTHER','Other','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$3,'SALES','Sales','TEAM'),($2,$4,'OTHERTEAM','Other','TEAM'),($5,$3,'PEER','Peer','TEAM')",
      [team, otherTeam, company, otherCompany, peerTeam],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$3,'NESTED','Nested','TEAM')",
      [nestedTeam, company, team],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$3,'DEEP','Deep','TEAM')",
      [deepTeam, company, nestedTeam],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$4,$5,'ACT','Actor','actor@crm.test'),($2,$4,$5,'ASSIGN','Assignee','assignee@crm.test'),($3,$6,$7,'OUT','Outsider','outsider@crm.test')",
      [actorId, assigneeId, outsiderId, company, team, otherCompany, otherTeam],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'PEER','Peer','peer@crm.test')",
      [peerId, company, peerTeam],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'NESTED','Nested','nested@crm.test')",
      [nestedId, company, deepTeam],
    );
    crm = new PostgresCrmRepository(db);
  });

  afterAll(async () => {
    try {
      if (dbOpened) await db.close();
    } finally {
      if (adminOpened)
        try {
          if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        } finally {
          await admin.close();
        }
    }
  });

  it('isolates customer identity, enforces deduplication, and emits atomic audit/outbox records', async () => {
    const correlationId = randomUUID();
    const created = await crm.createCustomer(
      { customerNumber: 'C-001', name: ' Acme  Turf ', tags: ['priority'] },
      actor,
      correlationId,
    );
    expect(created.normalizedName).toBe('acme turf');
    expect(await crm.listCustomers(actor, ['COMPANY'], [])).toHaveLength(1);
    expect(
      await crm.listCustomers({ companyId: otherCompany, employeeId: outsiderId }, ['COMPANY'], []),
    ).toEqual([]);
    await expect(
      crm.createCustomer(
        { customerNumber: 'C-002', name: 'Ａｃｍｅ turf', tags: [] },
        actor,
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ count: string }>(
          'SELECT count(*)::text count FROM audit_events WHERE correlation_id=$1',
          [correlationId],
        )
      ).rows[0]?.count,
    ).toBe('1');
    expect(
      (
        await db.query<{ count: string }>(
          'SELECT count(*)::text count FROM domain_event_outbox WHERE correlation_id=$1',
          [correlationId],
        )
      ).rows[0]?.count,
    ).toBe('1');
  });

  it('claims a pool lead once under concurrency and replays an idempotent command', async () => {
    const lead = await crm.createLead(
      { title: 'School pitch', source: 'web', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    const results = await Promise.allSettled([
      crm.claimLead(lead.id, 1, actor, randomUUID(), 'claim-once', ['COMPANY'], []),
      crm.claimLead(lead.id, 1, actor, randomUUID(), 'claim-once', ['COMPANY'], []),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const [first, second] = results;
    if (first.status !== 'fulfilled' || second.status !== 'fulfilled')
      throw new Error('claim replay missing');
    expect(second.value).toEqual(first.value);
    expect(
      await crm.claimLead(lead.id, 1, actor, randomUUID(), 'claim-once', ['COMPANY'], []),
    ).toEqual(first.value);
    await expect(
      crm.claimLead(
        lead.id,
        first.value.version,
        actor,
        randomUUID(),
        'claim-once',
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/different command/u);
    await expect(
      crm.claimLead(
        lead.id,
        1,
        { companyId: company, employeeId: assigneeId },
        randomUUID(),
        'claim-once',
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/different command/u);
    await expect(
      crm.claimLead(
        lead.id,
        first.value.version,
        actor,
        randomUUID(),
        'claim-again',
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/^Illegal lead transition: CLAIMED -> CLAIMED$/u);
    expect(first.value.status).toBe('CLAIMED');
    expect(
      (
        await db.query<{
          assignments: string;
          audits: string;
          commands: string;
          events: string;
          transitions: string;
        }>(
          `SELECT
            (SELECT count(*)::text FROM lead_transitions WHERE tenant_id=$1 AND lead_id=$2 AND from_status='POOL' AND to_status='CLAIMED') transitions,
            (SELECT count(*)::text FROM crm_assignments WHERE tenant_id=$1 AND subject_type='LEAD' AND subject_id=$2) assignments,
            (SELECT count(*)::text FROM audit_events WHERE organization_id=$1 AND target_type='lead' AND target_id=$2 AND action='lead.claimed') audits,
            (SELECT count(*)::text FROM domain_event_outbox WHERE tenant_id=$1 AND aggregate_type='lead' AND aggregate_id=$2 AND event_type='lead.claimed') events,
            (SELECT count(*)::text FROM crm_command_results WHERE tenant_id=$1 AND subject_id=$2 AND command_type='LEAD_CLAIM') commands`,
          [company, lead.id],
        )
      ).rows[0],
    ).toEqual({ assignments: '1', audits: '1', commands: '1', events: '1', transitions: '1' });
    await expect(
      db.query('UPDATE lead_transitions SET reason=$1 WHERE lead_id=$2', ['changed', lead.id]),
    ).rejects.toThrow(/immutable/u);
  });

  it('rejects physical deletion of core CRM aggregates', async () => {
    const customer = await crm.createCustomer(
      { customerNumber: 'C-NO-DELETE', name: 'Retained customer', tags: [] },
      actor,
      randomUUID(),
    );
    const lead = await crm.createLead(
      { title: 'Retained lead', source: 'web', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    await expect(db.query('DELETE FROM customers WHERE id=$1', [customer.id])).rejects.toThrow(
      /immutable/u,
    );
    await expect(db.query('DELETE FROM leads WHERE id=$1', [lead.id])).rejects.toThrow(
      /immutable/u,
    );
  });

  it('restricts pool claim and release to their authorized source states', async () => {
    const fresh = await crm.createLead(
      { title: 'Direct lead', source: 'referral', customerId: null, pool: false },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    await expect(
      crm.claimLead(fresh.id, fresh.version, actor, randomUUID(), 'claim-new', ['COMPANY'], []),
    ).rejects.toThrow(/^Illegal lead transition: NEW -> CLAIMED$/u);
    await expect(
      crm.transitionLead(
        fresh.id,
        'POOL',
        fresh.version,
        'not a release',
        actor,
        randomUUID(),
        ['COMPANY'],
        [],
        'CLAIMED',
      ),
    ).rejects.toThrow(/must be CLAIMED/u);
  });

  it('assigns a POOL lead through one conflict-safe POOL to CLAIMED transition', async () => {
    const created = await crm.createLead(
      { title: 'Manager-routed pool lead', source: 'web', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    const correlationId = randomUUID();
    const assigned = await crm.assign(
      'LEAD',
      created.id,
      assigneeId,
      created.version,
      'manager route',
      actor,
      correlationId,
      false,
      ['COMPANY'],
      [],
    );
    expect(assigned).toMatchObject({ status: 'CLAIMED', ownerId: assigneeId, version: 2 });
    expect((await crm.listLeads(actor, ['COMPANY'], [], true)).map((row) => row.id)).not.toContain(
      created.id,
    );
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM lead_transitions WHERE tenant_id=$1 AND lead_id=$2 AND from_status='POOL' AND to_status='CLAIMED'",
          [company, created.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
    await expect(
      crm.claimLead(
        created.id,
        created.version,
        actor,
        randomUUID(),
        'claim-after-assign',
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/^Illegal lead transition: CLAIMED -> CLAIMED$/u);
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM crm_assignments WHERE tenant_id=$1 AND subject_type='LEAD' AND subject_id=$2 AND ended_at IS NULL",
          [company, created.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
    await expectBoundary(correlationId, 'crm.assigned');

    const raced = await crm.createLead(
      { title: 'Raced pool lead', source: 'event', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    const race = await Promise.allSettled([
      crm.assign(
        'LEAD',
        raced.id,
        assigneeId,
        raced.version,
        'manager won race',
        actor,
        randomUUID(),
        false,
        ['COMPANY'],
        [],
      ),
      crm.claimLead(
        raced.id,
        raced.version,
        actor,
        randomUUID(),
        'assignment-claim-race',
        ['COMPANY'],
        [],
      ),
    ]);
    expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const persisted = await crm.listLeads(actor, ['COMPANY'], []);
    expect(persisted.find((row) => row.id === raced.id)).toMatchObject({ status: 'CLAIMED' });
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM crm_assignments WHERE tenant_id=$1 AND subject_type='LEAD' AND subject_id=$2 AND ended_at IS NULL",
          [company, raced.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
  });

  it('rejects malformed contact identities, deduplicates normalized values, and isolates tenants', async () => {
    const customer = await crm.createCustomer(
      { customerNumber: 'C-CONTACT', name: 'Contact validation', tags: [] },
      actor,
      randomUUID(),
    );
    for (const identity of [
      { email: '   ', phone: null },
      { email: 'missing-at.example.test', phone: null },
      { email: null, phone: '---' },
      { email: null, phone: '+12' },
    ])
      await expect(
        crm.createContact(
          customer.id,
          { name: 'Invalid', title: null, ...identity, primary: false },
          actor,
          randomUUID(),
          ['COMPANY'],
          [],
        ),
      ).rejects.toThrow(/malformed/u);
    await crm.createContact(
      customer.id,
      {
        name: 'Buyer',
        title: null,
        email: 'Buyer@Example.TEST',
        phone: '+1 202-555-0100',
        primary: true,
      },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    await expect(
      crm.createContact(
        customer.id,
        {
          name: 'Duplicate',
          title: null,
          email: ' buyer@example.test ',
          phone: null,
          primary: false,
        },
        actor,
        randomUUID(),
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        'INSERT INTO customer_contacts(tenant_id,customer_id,name,normalized_email,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)',
        [company, customer.id, 'SQL bypass', '', actorId],
      ),
    ).rejects.toThrow();
    await expect(
      crm.createContact(
        customer.id,
        {
          name: 'Other tenant',
          title: null,
          email: 'other@example.test',
          phone: null,
          primary: false,
        },
        { companyId: otherCompany, employeeId: outsiderId },
        randomUUID(),
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/not found/u);
  });

  it('assigns with tenant and separation-of-duties checks and returns a truthful 360 timeline', async () => {
    const customer = await crm.createCustomer(
      { customerNumber: 'C-360', name: 'Customer 360', tags: [] },
      actor,
      randomUUID(),
    );
    const contactEmail = `customer-360-${company}@crm.example.test`;
    await expect(
      crm.assign(
        'CUSTOMER',
        customer.id,
        outsiderId,
        customer.version,
        'invalid tenant',
        actor,
        randomUUID(),
        false,
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/Assignee not found/u);
    const assigned = await crm.assign(
      'CUSTOMER',
      customer.id,
      assigneeId,
      customer.version,
      'territory assignment',
      actor,
      randomUUID(),
      false,
      ['COMPANY'],
      [],
    );
    const reassigned = await crm.assign(
      'CUSTOMER',
      customer.id,
      actorId,
      assigned.version,
      'manager-approved reassignment',
      { companyId: company, employeeId: assigneeId },
      randomUUID(),
      true,
      ['COMPANY'],
      [],
    );
    expect(reassigned.ownerId).toBe(actorId);
    await expect(
      crm.assign(
        'CUSTOMER',
        customer.id,
        actorId,
        reassigned.version,
        'self approval',
        actor,
        randomUUID(),
        true,
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow(/actor other than the assignee/u);
    const contact = await crm.createContact(
      customer.id,
      {
        name: 'Buyer',
        title: 'Manager',
        email: contactEmail,
        phone: null,
        primary: true,
      },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    expect(contact.email).toBe(contactEmail);
    expect(
      (
        await db.query<{ count: string }>(
          'SELECT count(*)::text count FROM customer_contacts WHERE tenant_id=$1 AND normalized_email=$2',
          [company, contactEmail],
        )
      ).rows[0]?.count,
    ).toBe('1');
    await crm.createActivity(
      customer.id,
      {
        leadId: null,
        type: 'CALL',
        occurredAt: new Date().toISOString(),
        summary: 'Discovery call',
        details: { outcome: 'follow-up' },
      },
      actor,
      randomUUID(),
      'activity-360',
      ['COMPANY'],
      [],
    );
    const view = await crm.customer360(
      customer.id,
      actor,
      ['COMPANY'],
      [],
      { email: false, phone: false },
      {
        ownership: { scopes: ['COMPANY'], anchors: [] },
        leads: { scopes: ['COMPANY'], anchors: [] },
        activities: { scopes: ['COMPANY'], anchors: [] },
      },
    );
    expect(view?.contacts[0]).not.toHaveProperty('email');
    expect(view?.activities[0]?.summary).toBe('Discovery call');
    expect(view?.ownership).toHaveLength(2);
    expect(view?.ownership.filter((row) => row.endedAt === null)).toHaveLength(1);
    expect(view?.ownership.filter((row) => row.endedAt !== null)).toHaveLength(1);
    expect(view?.unavailableSections).toEqual(['orders', 'finance']);
  });

  it('allows SELF-scoped users to see and claim unowned pool leads', async () => {
    const created = await crm.createLead(
      { title: 'Unowned pool prospect', source: 'referral', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    expect((await crm.listLeads(actor, ['SELF'], [], true)).map((item) => item.id)).toContain(
      created.id,
    );
    await expect(
      crm.claimLead(
        created.id,
        created.version,
        actor,
        randomUUID(),
        'self-pool-claim',
        ['SELF'],
        [],
      ),
    ).resolves.toMatchObject({ id: created.id, ownerId: actorId, status: 'CLAIMED' });
  });

  it('atomically couples every CRM mutation to audit/outbox and emits nothing on rollback or replay', async () => {
    const createCorrelation = randomUUID();
    let customer = await crm.createCustomer(
      { customerNumber: 'C-BOUNDARY', name: 'Boundary customer', tags: [] },
      actor,
      createCorrelation,
    );
    await expectBoundary(createCorrelation, 'customer.created');

    const lifecycleCorrelation = randomUUID();
    customer = await crm.transitionCustomer(
      customer.id,
      'ACTIVE',
      customer.version,
      'qualified account',
      actor,
      lifecycleCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(lifecycleCorrelation, 'customer.lifecycle-changed');

    const contactCorrelation = randomUUID();
    await crm.createContact(
      customer.id,
      {
        name: 'Boundary buyer',
        title: 'Buyer',
        email: 'boundary@example.test',
        phone: null,
        primary: true,
      },
      actor,
      contactCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(contactCorrelation, 'customer.contact-created');
    const secondContactCorrelation = randomUUID();
    await crm.createContact(
      customer.id,
      {
        name: 'Second boundary buyer',
        title: null,
        email: 'boundary-second@example.test',
        phone: null,
        primary: false,
      },
      actor,
      secondContactCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(secondContactCorrelation, 'customer.contact-created');
    const rolledBackContact = randomUUID();
    await expect(
      crm.createContact(
        customer.id,
        { name: 'Invalid', title: null, email: null, phone: null, primary: false },
        actor,
        rolledBackContact,
        ['COMPANY'],
        [],
      ),
    ).rejects.toThrow();
    await expectBoundary(rolledBackContact, 'customer.contact-created', 0);

    const activityCorrelation = randomUUID();
    const occurredAt = '2026-08-13T01:00:00.000Z';
    await crm.createActivity(
      customer.id,
      {
        leadId: null,
        type: 'MEETING',
        occurredAt,
        summary: 'Boundary meeting',
        details: {},
      },
      actor,
      activityCorrelation,
      'boundary-activity',
      ['COMPANY'],
      [],
    );
    await expectBoundary(activityCorrelation, 'customer.activity-created');
    const secondActivityCorrelation = randomUUID();
    await crm.createActivity(
      customer.id,
      {
        leadId: null,
        type: 'NOTE',
        occurredAt: '2026-08-13T02:00:00.000Z',
        summary: 'Second boundary activity',
        details: {},
      },
      actor,
      secondActivityCorrelation,
      'boundary-activity-second',
      ['COMPANY'],
      [],
    );
    await expectBoundary(secondActivityCorrelation, 'customer.activity-created');
    const replayedActivityCorrelation = randomUUID();
    await crm.createActivity(
      customer.id,
      {
        leadId: null,
        type: 'MEETING',
        occurredAt,
        summary: 'Boundary meeting',
        details: {},
      },
      actor,
      replayedActivityCorrelation,
      'boundary-activity',
      ['COMPANY'],
      [],
    );
    await expectBoundary(replayedActivityCorrelation, 'customer.activity-created', 0);

    const assignCorrelation = randomUUID();
    const assignedCustomer = await crm.assign(
      'CUSTOMER',
      customer.id,
      assigneeId,
      customer.version,
      'initial owner',
      actor,
      assignCorrelation,
      false,
      ['COMPANY'],
      [],
    );
    if (!('customerNumber' in assignedCustomer)) throw new Error('Expected assigned customer');
    customer = assignedCustomer;
    await expectBoundary(assignCorrelation, 'crm.assigned');
    const reassignCorrelation = randomUUID();
    const reassignedCustomer = await crm.assign(
      'CUSTOMER',
      customer.id,
      actorId,
      customer.version,
      'approved handover',
      { companyId: company, employeeId: assigneeId },
      reassignCorrelation,
      true,
      ['COMPANY'],
      [],
    );
    if (!('customerNumber' in reassignedCustomer)) throw new Error('Expected reassigned customer');
    customer = reassignedCustomer;
    await expectBoundary(reassignCorrelation, 'crm.reassigned');

    const leadCreateCorrelation = randomUUID();
    let lead = await crm.createLead(
      { title: 'Boundary lead', source: 'event', customerId: customer.id, pool: true },
      actor,
      leadCreateCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(leadCreateCorrelation, 'lead.created');
    const claimCorrelation = randomUUID();
    lead = await crm.claimLead(
      lead.id,
      lead.version,
      actor,
      claimCorrelation,
      'boundary-claim',
      ['COMPANY'],
      [],
    );
    await expectBoundary(claimCorrelation, 'lead.claimed');
    const replayedClaimCorrelation = randomUUID();
    await crm.claimLead(
      lead.id,
      1,
      actor,
      replayedClaimCorrelation,
      'boundary-claim',
      ['COMPANY'],
      [],
    );
    await expectBoundary(replayedClaimCorrelation, 'lead.claimed', 0);
    const releaseCorrelation = randomUUID();
    lead = await crm.transitionLead(
      lead.id,
      'POOL',
      lead.version,
      'return to pool',
      actor,
      releaseCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(releaseCorrelation, 'lead.lifecycle-changed');
    expect(lead).toMatchObject({ status: 'POOL', ownerId: null });

    const assignedLeadCreateCorrelation = randomUUID();
    let assignedLead = await crm.createLead(
      { title: 'Assigned lead', source: 'partner', customerId: customer.id, pool: false },
      actor,
      assignedLeadCreateCorrelation,
      ['COMPANY'],
      [],
    );
    await expectBoundary(assignedLeadCreateCorrelation, 'lead.created');
    const leadAssignCorrelation = randomUUID();
    const routedLead = await crm.assign(
      'LEAD',
      assignedLead.id,
      assigneeId,
      assignedLead.version,
      'route to specialist',
      actor,
      leadAssignCorrelation,
      false,
      ['COMPANY'],
      [],
    );
    if (!('source' in routedLead)) throw new Error('Expected assigned lead');
    assignedLead = routedLead;
    await expectBoundary(leadAssignCorrelation, 'crm.assigned');
    const leadReassignCorrelation = randomUUID();
    await crm.assign(
      'LEAD',
      assignedLead.id,
      actorId,
      assignedLead.version,
      'specialist handback',
      { companyId: company, employeeId: assigneeId },
      leadReassignCorrelation,
      true,
      ['COMPANY'],
      [],
    );
    await expectBoundary(leadReassignCorrelation, 'crm.reassigned');

    await expect(
      db.query('UPDATE audit_events SET action=$1 WHERE correlation_id=$2', [
        'tampered',
        createCorrelation,
      ]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query('DELETE FROM customer_activities WHERE idempotency_key=$1', ['boundary-activity']),
    ).rejects.toThrow(/immutable/u);
  });

  it('enforces SELF and TEAM scopes on every known-id CRM mutation', async () => {
    const visible = await crm.createCustomer(
      { customerNumber: 'C-SCOPE-1', name: 'Visible customer', tags: [] },
      actor,
      randomUUID(),
    );
    const hidden = await crm.createCustomer(
      { customerNumber: 'C-SCOPE-2', name: 'Hidden customer', tags: [] },
      actor,
      randomUUID(),
    );
    const visibleAssigned = await crm.assign(
      'CUSTOMER',
      visible.id,
      assigneeId,
      visible.version,
      'same team',
      actor,
      randomUUID(),
      false,
      ['COMPANY'],
      [],
    );
    const hiddenAssigned = await crm.assign(
      'CUSTOMER',
      hidden.id,
      peerId,
      hidden.version,
      'different team',
      actor,
      randomUUID(),
      false,
      ['COMPANY'],
      [],
    );
    const nested = await crm.createCustomer(
      { customerNumber: 'C-SCOPE-NESTED', name: 'Nested customer', tags: [] },
      actor,
      randomUUID(),
    );
    await crm.assign(
      'CUSTOMER',
      nested.id,
      nestedId,
      nested.version,
      'nested team owner',
      actor,
      randomUUID(),
      false,
      ['COMPANY'],
      [],
    );
    const teamScope = ['TEAM'] as const;
    const teamAnchor = [{ scope: 'TEAM' as const, organizationId: team }];
    expect(
      (await crm.listCustomers(actor, teamScope, teamAnchor)).map((row) => row.id),
    ).not.toContain(nested.id);
    expect(
      (
        await crm.listCustomers(actor, teamScope, [{ scope: 'TEAM', organizationId: otherTeam }])
      ).map((row) => row.id),
    ).toEqual([]);
    expect(
      (
        await crm.listCustomers(actor, teamScope, [{ scope: 'DEPARTMENT', organizationId: team }])
      ).map((row) => row.id),
    ).toEqual([]);
    await expect(
      crm.transitionCustomer(
        hidden.id,
        'ACTIVE',
        hiddenAssigned.version,
        'out of scope',
        actor,
        randomUUID(),
        teamScope,
        teamAnchor,
      ),
    ).rejects.toThrow(/not found/u);
    await expect(
      crm.createContact(
        hidden.id,
        { name: 'No', title: null, email: null, phone: null, primary: false },
        actor,
        randomUUID(),
        teamScope,
        teamAnchor,
      ),
    ).rejects.toThrow(/not found/u);
    await expect(
      crm.createActivity(
        hidden.id,
        {
          leadId: null,
          type: 'NOTE',
          occurredAt: new Date().toISOString(),
          summary: 'No',
          details: {},
        },
        actor,
        randomUUID(),
        'hidden-activity',
        teamScope,
        teamAnchor,
      ),
    ).rejects.toThrow(/not found/u);
    await expect(
      crm.assign(
        'CUSTOMER',
        hidden.id,
        assigneeId,
        hiddenAssigned.version,
        'out of scope reassignment',
        actor,
        randomUUID(),
        true,
        teamScope,
        teamAnchor,
      ),
    ).rejects.toThrow(/not found/u);
    const transitioned = await crm.transitionCustomer(
      visible.id,
      'ACTIVE',
      visibleAssigned.version,
      'in scope',
      actor,
      randomUUID(),
      teamScope,
      teamAnchor,
    );
    expect(transitioned.status).toBe('ACTIVE');

    const poolLead = await crm.createLead(
      { title: 'Team pool lead', source: 'web', customerId: null, pool: true },
      actor,
      randomUUID(),
      ['COMPANY'],
      [],
    );
    await expect(
      crm.claimLead(
        poolLead.id,
        poolLead.version,
        { companyId: company, employeeId: peerId },
        randomUUID(),
        'wrong-team-claim',
        teamScope,
        [{ scope: 'TEAM', organizationId: peerTeam }],
      ),
    ).rejects.toThrow(/not found/u);
    const claimed = await crm.claimLead(
      poolLead.id,
      poolLead.version,
      actor,
      randomUUID(),
      'team-claim',
      teamScope,
      teamAnchor,
    );
    expect(claimed.ownerId).toBe(actorId);
    await expect(
      crm.transitionLead(
        claimed.id,
        'QUALIFIED',
        claimed.version,
        'SELF mismatch',
        { companyId: company, employeeId: assigneeId },
        randomUUID(),
        ['SELF'],
        [],
      ),
    ).rejects.toThrow(/not found/u);
    const qualified = await crm.transitionLead(
      claimed.id,
      'QUALIFIED',
      claimed.version,
      'owner update',
      actor,
      randomUUID(),
      ['SELF'],
      [],
    );
    expect(qualified.status).toBe('QUALIFIED');
    const leadAssigned = await crm.assign(
      'LEAD',
      qualified.id,
      assigneeId,
      qualified.version,
      'owner assigns teammate',
      actor,
      randomUUID(),
      true,
      ['SELF'],
      [],
    );
    expect(leadAssigned.ownerId).toBe(assigneeId);
    await expect(
      crm.assign(
        'LEAD',
        leadAssigned.id,
        actorId,
        leadAssigned.version,
        'different team cannot reassign',
        { companyId: company, employeeId: peerId },
        randomUUID(),
        true,
        ['TEAM'],
        [{ scope: 'TEAM', organizationId: peerTeam }],
      ),
    ).rejects.toThrow(/not found/u);
  });
});
