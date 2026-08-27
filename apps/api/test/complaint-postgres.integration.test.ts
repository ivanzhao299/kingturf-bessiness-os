import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresComplaintRepository } from '../src/complaint-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; complaint PostgreSQL tests may not be skipped');

const hash = 'a'.repeat(64);

describe('KT-L20 PostgreSQL complaint, NCR, and CAPA integrity', () => {
  const schema = `complaint_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    otherCompany = randomUUID(),
    team = randomUUID(),
    otherTeam = randomUUID(),
    reporter = randomUUID(),
    investigator = randomUUID(),
    approver = randomUUID(),
    owner = randomUUID(),
    verifier = randomUUID(),
    outsider = randomUUID(),
    customer = randomUUID(),
    otherCustomer = randomUUID(),
    policy = randomUUID();
  let admin: Database, db: Database, repository: PostgresComplaintRepository;

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'KT','KingTurf','COMPANY'),($2,'OTHER','Other','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'QA','Quality','TEAM'),($3,$4,'OQA','Other Quality','TEAM')",
      [team, company, otherTeam, otherCompany],
    );
    await db.query(
      `INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES
       ($1,$2,$3,'REPORTER','Reporter','reporter@kt.test'),($4,$2,$3,'INVESTIGATOR','Investigator','investigator@kt.test'),
       ($5,$2,$3,'APPROVER','Approver','approver@kt.test'),($6,$2,$3,'OWNER','Owner','owner@kt.test'),
       ($7,$2,$3,'VERIFIER','Verifier','verifier@kt.test'),($8,$9,$10,'OUTSIDER','Outsider','outsider@other.test')`,
      [
        reporter,
        company,
        team,
        investigator,
        approver,
        owner,
        verifier,
        outsider,
        otherCompany,
        otherTeam,
      ],
    );
    await db.query(
      `INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES
       ($1,$2,'C-1','Customer','customer','ACTIVE',$3,$4,$3,$3),
       ($5,$6,'C-2','Other Customer','other customer','ACTIVE',$7,$8,$7,$7)`,
      [customer, company, reporter, team, otherCustomer, otherCompany, outsider, otherTeam],
    );
    await db.query(
      `INSERT INTO complaint_sla_policy_versions(id,tenant_id,policy_code,version,severity,response_hours,containment_hours,root_cause_hours,closure_hours,effective_at,published_at,canonical_hash,created_by)
       VALUES($1,$2,'MAJOR-STANDARD',1,'MAJOR',4,8,72,240,'2026-01-01','2026-01-01',$3,$4)`,
      [policy, company, hash, approver],
    );
    repository = new PostgresComplaintRepository(db);
  });

  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  async function createComplaint(number: string, key: string): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO customer_complaints(
        id,tenant_id,complaint_number,customer_id,sla_policy_version_id,channel,defect_category,severity,
        occurred_at,reported_at,description,customer_request,initial_snapshot,response_due_at,
        containment_due_at,root_cause_due_at,closure_due_at,reported_by,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,$3,$4,$5,'CUSTOMER_SERVICE','PILE_HEIGHT','MAJOR','2026-08-01 00:00Z','2026-08-02 00:00Z',
        'Customer reports pile height outside the approved specification','Investigate and replace',
        '{"source":"customer"}','2026-08-02 04:00Z','2026-08-02 08:00Z','2026-08-05 00:00Z','2026-08-12 00:00Z',$6,$7,$8,$9)`,
      [id, company, number, customer, policy, reporter, randomUUID(), key, hash],
    );
    return id;
  }

  async function addComplaintEvent(
    complaintId: string,
    sequence: number,
    state: string,
    actor: string,
    key: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO customer_complaint_events(tenant_id,complaint_id,sequence,state,reason,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,$3,$4,'state evidence','{}',$5,$6,$7,$8,$9)`,
      [company, complaintId, sequence, state, actor, sequence - 1, randomUUID(), key, hash],
    );
  }

  it('enforces tenant relationships, command identity, versions, and complaint state gates', async () => {
    await expect(
      db.query(
        `INSERT INTO customer_complaints(
          tenant_id,complaint_number,customer_id,sla_policy_version_id,channel,defect_category,severity,occurred_at,reported_at,
          description,customer_request,initial_snapshot,response_due_at,containment_due_at,root_cause_due_at,closure_due_at,
          reported_by,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,'CROSS-TENANT',$2,$3,'EMAIL','OTHER','MAJOR',now(),now(),'Cross tenant complaint is invalid','Investigate','{}',now(),now(),now(),now(),$4,$5,'cross-tenant',$6)`,
        [company, otherCustomer, policy, reporter, randomUUID(), hash],
      ),
    ).rejects.toThrow();

    const complaint = await createComplaint('CMP-1', 'complaint-1');
    await expect(createComplaint('CMP-1-REPLAY', 'complaint-1')).rejects.toThrow(
      /unique|duplicate/iu,
    );
    await expect(
      addComplaintEvent(complaint, 1, 'TRIAGED', investigator, 'complaint-wrong-start'),
    ).rejects.toThrow(/begin at REPORTED version 0/u);
    await addComplaintEvent(complaint, 1, 'REPORTED', reporter, 'complaint-reported');
    await expect(
      addComplaintEvent(complaint, 2, 'CLOSED', approver, 'complaint-illegal-close'),
    ).rejects.toThrow(/illegal complaint transition/u);
    await addComplaintEvent(complaint, 2, 'TRIAGED', investigator, 'complaint-triaged');
    await expect(
      db.query(
        `INSERT INTO customer_complaint_events(tenant_id,complaint_id,sequence,state,reason,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,3,'INVESTIGATING','wrong expected version','{}',$3,0,$4,'complaint-version-conflict',$5)`,
        [company, complaint, investigator, randomUUID(), hash],
      ),
    ).rejects.toThrow(/version conflict/u);
    await addComplaintEvent(complaint, 3, 'INVESTIGATING', investigator, 'complaint-investigating');
    await expect(
      addComplaintEvent(complaint, 4, 'CLOSED', reporter, 'complaint-self-close'),
    ).rejects.toThrow(/reporter cannot close own complaint/u);
    await expect(
      addComplaintEvent(complaint, 4, 'CLOSED', approver, 'complaint-unverified-close'),
    ).rejects.toThrow(/direct complaint closure requires structured investigation evidence/u);
  });

  it('requires structured root cause and separates NCR investigation from disposition approval', async () => {
    const complaint = await createComplaint('CMP-2', 'complaint-2');
    await addComplaintEvent(complaint, 1, 'REPORTED', reporter, 'complaint-2-reported');
    await addComplaintEvent(complaint, 2, 'TRIAGED', investigator, 'complaint-2-triaged');
    await addComplaintEvent(
      complaint,
      3,
      'INVESTIGATING',
      investigator,
      'complaint-2-investigating',
    );
    const ncr = randomUUID();
    await db.query(
      `INSERT INTO nonconformance_reports(id,tenant_id,ncr_number,complaint_id,defect_type,affected_scope,responsible_organization_id,investigator_id,created_by,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,'NCR-1',$3,'Pile height','Customer shipment',$4,$5,$6,$7,'ncr-1',$8)`,
      [ncr, company, complaint, team, investigator, reporter, randomUUID(), hash],
    );
    const addNcrEvent = async (
      sequence: number,
      state: string,
      key: string,
      extra = '',
      values: unknown[] = [],
    ) =>
      db.query(
        `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash${extra ? ',root_cause_method,disposition,approved_by' : ''})
         VALUES($1,$2,$3,$4,'NCR evidence','{}','{}',$5,$6,$7,$8,$9${extra})`,
        [
          company,
          ncr,
          sequence,
          state,
          investigator,
          sequence - 1,
          randomUUID(),
          key,
          hash,
          ...values,
        ],
      );
    await addNcrEvent(1, 'OPEN', 'ncr-open');
    await expect(addNcrEvent(2, 'ROOT_CAUSE_CONFIRMED', 'ncr-skip')).rejects.toThrow(
      /illegal NCR transition/u,
    );
    await addNcrEvent(2, 'CONTAINED', 'ncr-contained');
    await expect(addNcrEvent(3, 'ROOT_CAUSE_CONFIRMED', 'ncr-empty-root')).rejects.toThrow(
      /structured analysis/u,
    );
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause_method,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,3,'ROOT_CAUSE_CONFIRMED','Analysis complete','FIVE_WHY','{"cause":"tufting setup"}','{}',$3,2,$4,'ncr-root',$5)`,
      [company, ncr, investigator, randomUUID(), hash],
    );
    await expect(
      db.query(
        `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,approved_by,disposition,expected_version,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,4,'DISPOSITIONED','Disposition','{}','{"approval":"self"}',$3,$3,'REWORK',3,$4,'ncr-self-approve',$5)`,
        [company, ncr, investigator, randomUUID(), hash],
      ),
    ).rejects.toThrow(/investigator cannot approve own disposition/u);
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,approved_by,disposition,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,4,'DISPOSITIONED','Approved disposition','{}','{"approval":"independent"}',$3,$3,'REWORK',3,$4,'ncr-approved',$5)`,
      [company, ncr, approver, randomUUID(), hash],
    );
    await expect(
      db.query("UPDATE nonconformance_reports SET affected_scope='Changed' WHERE id=$1", [ncr]),
    ).rejects.toThrow(/immutable/u);
    await expect(db.query('DELETE FROM ncr_events WHERE ncr_id=$1', [ncr])).rejects.toThrow(
      /immutable/u,
    );
  });

  it('requires completed CAPA actions and an independent verifier', async () => {
    const complaint = await createComplaint('CMP-3', 'complaint-3');
    const ncr = randomUUID(),
      capa = randomUUID(),
      action = randomUUID();
    await addComplaintEvent(complaint, 1, 'REPORTED', reporter, 'complaint-3-reported');
    await addComplaintEvent(complaint, 2, 'TRIAGED', investigator, 'complaint-3-triaged');
    await addComplaintEvent(
      complaint,
      3,
      'INVESTIGATING',
      investigator,
      'complaint-3-investigating',
    );
    await db.query(
      `INSERT INTO nonconformance_reports(id,tenant_id,ncr_number,complaint_id,defect_type,affected_scope,responsible_organization_id,investigator_id,created_by,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,'NCR-2',$3,'Backing','Production lot',$4,$5,$6,$7,'ncr-2',$8)`,
      [ncr, company, complaint, team, investigator, reporter, randomUUID(), hash],
    );
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash) VALUES
       ($1,$2,1,'OPEN','Opened','{}','{}',$3,0,$4,'ncr-2-open',$5)`,
      [company, ncr, investigator, randomUUID(), hash],
    );
    await addComplaintEvent(complaint, 4, 'NCR_OPEN', approver, 'complaint-3-ncr-open');
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,2,'CONTAINED','Contained','{}','{}',$3,1,$4,'ncr-2-contained',$5)`,
      [company, ncr, investigator, randomUUID(), hash],
    );
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause_method,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,3,'ROOT_CAUSE_CONFIRMED','Root cause','FISHBONE','{"cause":"process control"}','{}',$3,2,$4,'ncr-2-root',$5)`,
      [company, ncr, investigator, randomUUID(), hash],
    );
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,approved_by,disposition,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,4,'DISPOSITIONED','Disposition approved','{}','{"approval":"independent"}',$3,$3,'REWORK',3,$4,'ncr-2-disposition',$5)`,
      [company, ncr, approver, randomUUID(), hash],
    );
    await db.query(
      `INSERT INTO capa_cases(id,tenant_id,capa_number,ncr_id,owner_id,target_at,risk_level,root_cause_snapshot,created_by,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,'CAPA-1',$3,$4,'2026-09-30','MAJOR','{"cause":"process control"}',$4,$5,'capa-1',$6)`,
      [capa, company, ncr, owner, randomUUID(), hash],
    );
    const addCapaEvent = (sequence: number, state: string, key: string) =>
      db.query(
        `INSERT INTO capa_events(tenant_id,capa_id,sequence,state,reason,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,$3,$4,'CAPA evidence','{}',$5,$6,$7,$8,$9)`,
        [company, capa, sequence, state, owner, sequence - 1, randomUUID(), key, hash],
      );
    await addCapaEvent(1, 'OPEN', 'capa-open');
    await db.query(
      `INSERT INTO capa_actions(id,tenant_id,capa_id,action_type,description,owner_id,due_at,created_by,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,$3,'CORRECTIVE','Reset tufting process controls',$4,'2026-09-15',$4,$5,'capa-action-1',$6)`,
      [action, company, capa, owner, randomUUID(), hash],
    );
    const verify = (actor: string, key: string) =>
      db.query(
        `INSERT INTO capa_verifications(tenant_id,capa_id,verifier_id,verified_at,standard,sample_scope,observation_until,result,evidence,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,$3,'2026-09-27','Internal CAPA standard','Three production lots','2026-09-27','PASSED','{"report":"CAPA-VERIFY-1"}',$4,$5,$6)`,
        [company, capa, actor, randomUUID(), key, hash],
      );
    await expect(verify(verifier, 'verify-too-early')).rejects.toThrow(
      /all actions complete and ready state/u,
    );
    await addCapaEvent(2, 'ACTIONS_IN_PROGRESS', 'capa-in-progress');
    await expect(verify(verifier, 'verify-incomplete')).rejects.toThrow(
      /all actions complete and ready state/u,
    );
    await expect(
      db.query(
        `INSERT INTO capa_action_completions(tenant_id,capa_action_id,completed_by,completed_at,evidence,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,$3,now(),'{}',$4,'cross-tenant-completion',$5)`,
        [otherCompany, action, outsider, randomUUID(), hash],
      ),
    ).rejects.toThrow();
    await expect(addCapaEvent(3, 'READY_FOR_VERIFICATION', 'capa-ready-too-early')).rejects.toThrow(
      /readiness requires completed actions/u,
    );
    await db.query(
      `INSERT INTO capa_action_completions(tenant_id,capa_action_id,completed_by,completed_at,evidence,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,$3,now(),'{"result":"implemented"}',$4,'completion-1',$5)`,
      [company, action, owner, randomUUID(), hash],
    );
    await addCapaEvent(3, 'READY_FOR_VERIFICATION', 'capa-ready');
    await expect(verify(owner, 'verify-self')).rejects.toThrow(
      /CAPA owner, creator, or investigator cannot verify effectiveness/u,
    );
    await verify(verifier, 'verify-independent');
    await expect(verify(verifier, 'verify-independent')).rejects.toThrow(/unique|duplicate/iu);
    await addCapaEvent(4, 'VERIFIED', 'capa-verified');
    await addComplaintEvent(complaint, 5, 'CAPA_ACTIVE', approver, 'complaint-3-capa-active');
    await addComplaintEvent(complaint, 6, 'VERIFIED', verifier, 'complaint-3-verified');
    await expect(
      addComplaintEvent(complaint, 7, 'CLOSED', approver, 'complaint-3-close-too-early'),
    ).rejects.toThrow(/complaint closure requires closed NCR and CAPA/u);
    await addCapaEvent(5, 'CLOSED', 'capa-closed');
    await db.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,5,'CLOSED','Verified CAPA archived','{}','{"verification":"CAPA-VERIFY-1"}',$3,4,$4,'ncr-2-closed',$5)`,
      [company, ncr, approver, randomUUID(), hash],
    );
    await addComplaintEvent(complaint, 7, 'CLOSED', approver, 'complaint-3-closed');
    await expect(
      db.query('UPDATE capa_actions SET description=$1 WHERE id=$2', ['Changed', action]),
    ).rejects.toThrow(/immutable/u);
  });

  it('pages complaints and preserves deterministic mixed batch triage replay', async () => {
    const context = {
      actor: { companyId: company, employeeId: investigator },
      scopes: ['COMPANY'] as const,
      anchors: [],
    };
    const create = (number: string, key: string) =>
      repository.createComplaint(
        {
          complaintNumber: number,
          customerId: customer,
          slaPolicyVersionId: policy,
          channel: 'CUSTOMER_SERVICE',
          defectCategory: 'COLOUR_DIFFERENCE',
          severity: 'MAJOR',
          occurredAt: '2026-08-20T08:00:00.000Z',
          reportedAt: '2026-08-21T08:00:00.000Z',
          description: 'Customer reports a visible colour difference between delivered rolls',
          customerRequest: 'Investigate root cause and provide corrective action',
          initialSnapshot: { customerReference: number },
          idempotencyKey: key,
        },
        context,
        randomUUID(),
      );
    const first = await create('CMP-BATCH-1', 'repo-complaint-1');
    const second = await create('CMP-BATCH-2', 'repo-complaint-2');
    if (typeof first.id !== 'string' || typeof second.id !== 'string') {
      throw new Error('Expected complaint identifiers');
    }
    const pageOne = await repository.list({ limit: 1, query: 'CMP-BATCH' }, context);
    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.nextCursor).toBeTypeOf('string');
    if (!pageOne.nextCursor) throw new Error('Expected a second complaint page');
    const pageTwo = await repository.list(
      { limit: 1, query: 'CMP-BATCH', cursor: pageOne.nextCursor },
      context,
    );
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.nextCursor).toBeNull();
    const mixed = await repository.batchTriage(
      {
        batchKey: 'repo-batch-1',
        items: [
          {
            id: first.id,
            expectedVersion: 1,
            assignedTo: investigator,
            reason: 'Assign first complaint for investigation',
          },
          {
            id: second.id,
            expectedVersion: 99,
            assignedTo: investigator,
            reason: 'This row carries a stale expected version',
          },
        ],
      },
      context,
      randomUUID(),
    );
    expect(mixed).toMatchObject({ requested: 2, succeeded: 1, rejected: 1, failed: 0 });
    const replay = await repository.batchTriage(
      {
        batchKey: 'repo-batch-1',
        items: [
          {
            id: first.id,
            expectedVersion: 1,
            assignedTo: investigator,
            reason: 'Assign first complaint for investigation',
          },
          {
            id: second.id,
            expectedVersion: 99,
            assignedTo: investigator,
            reason: 'This row carries a stale expected version',
          },
        ],
      },
      context,
      randomUUID(),
    );
    expect(replay).toEqual(mixed);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM audit_events WHERE organization_id=$1 AND action='complaint.batch-triaged'",
          [company],
        )
      ).rows[0],
    ).toEqual({ n: 1 });
  });
});
