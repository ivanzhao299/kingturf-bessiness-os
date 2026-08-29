import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Database, Transaction } from '@kingturf/database';
import { DomainError } from '@kingturf/domain';

export type WebsiteLeadPayload = Readonly<{
  externalRef: string;
  name: string;
  company: string | null;
  contact: string;
  country: string | null;
  application: string;
  projectBrief: string | null;
  locale: 'zh' | 'en';
  sourcePage: string | null;
}>;

export type WebsiteLeadResult = Readonly<{
  leadId: string;
  externalRef: string;
  status: 'POOL';
  duplicate: boolean;
}>;

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(',')}}`;
};

const clean = (value: unknown, field: string, maximum: number, required = true): string | null => {
  if (value === null || value === undefined || value === '') {
    if (required) throw new DomainError('invalid_request', `${field} is required`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > maximum)
    throw new DomainError('invalid_request', `${field} is invalid`);
  const result = value.trim();
  if (required && !result) throw new DomainError('invalid_request', `${field} is required`);
  return result === '' ? null : result;
};

const requiredClean = (value: unknown, field: string, maximum: number): string => {
  const result = clean(value, field, maximum);
  if (result === null) throw new DomainError('invalid_request', `${field} is required`);
  return result;
};

export class PostgresWebsiteLeadIngestor {
  public constructor(
    private readonly database: Database,
    private readonly secret: string,
  ) {}

  public async ingest(
    raw: unknown,
    timestampHeader: string | undefined,
    signatureHeader: string | undefined,
    correlationId: string,
  ): Promise<WebsiteLeadResult> {
    const timestamp = Number(timestampHeader);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 300_000)
      throw new DomainError('forbidden', 'Website lead signature expired');
    if (!signatureHeader || !/^sha256=[0-9a-f]{64}$/u.test(signatureHeader))
      throw new DomainError('forbidden', 'Website lead signature is invalid');
    const expected = `sha256=${createHmac('sha256', this.secret)
      .update(`${String(timestamp)}.${canonical(raw)}`)
      .digest('hex')}`;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader)))
      throw new DomainError('forbidden', 'Website lead signature is invalid');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new DomainError('invalid_request', 'Website lead payload is invalid');
    const body = raw as Record<string, unknown>;
    const locale = body.locale === 'en' ? 'en' : body.locale === 'zh' ? 'zh' : null;
    if (!locale) throw new DomainError('invalid_request', 'locale is invalid');
    const payload: WebsiteLeadPayload = {
      externalRef: requiredClean(body.externalRef, 'externalRef', 128),
      name: requiredClean(body.name, 'name', 120),
      company: clean(body.company, 'company', 160, false),
      contact: requiredClean(body.contact, 'contact', 200),
      country: clean(body.country, 'country', 120, false),
      application: requiredClean(body.application, 'application', 120),
      projectBrief: clean(body.projectBrief, 'projectBrief', 2000, false),
      locale,
      sourcePage: clean(body.sourcePage, 'sourcePage', 120, false),
    };
    return this.database.transaction((tx) => this.persist(tx, payload, correlationId));
  }

  private async persist(
    tx: Transaction,
    payload: WebsiteLeadPayload,
    correlationId: string,
  ): Promise<WebsiteLeadResult> {
    const companies = (
      await tx.query<{ id: string }>(
        "SELECT id FROM organizations WHERE organization_type='COMPANY' AND active AND deleted_at IS NULL ORDER BY created_at,id LIMIT 2",
      )
    ).rows;
    if (companies.length !== 1)
      throw new DomainError(
        'conflict',
        'Website lead integration requires exactly one active company',
      );
    const company = companies[0];
    if (!company)
      throw new DomainError(
        'conflict',
        'Website lead integration requires exactly one active company',
      );
    const tenantId = company.id;
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${tenantId}:${payload.externalRef}`,
    ]);
    const existing = (
      await tx.query<{ lead_id: string }>(
        'SELECT lead_id FROM website_lead_ingests WHERE tenant_id=$1 AND external_ref=$2',
        [tenantId, payload.externalRef],
      )
    ).rows[0];
    if (existing)
      return {
        leadId: existing.lead_id,
        externalRef: payload.externalRef,
        status: 'POOL',
        duplicate: true,
      };
    const integrationTeam = (
      await tx.query<{ id: string }>(
        `INSERT INTO organizations(owner_organization_id,code,name,organization_type)
         VALUES($1,'KT-WEBSITE-INTEGRATION','官网询盘集成','TEAM')
         ON CONFLICT(owner_organization_id,code) DO UPDATE SET active=true,deleted_at=NULL,updated_at=now()
         RETURNING id`,
        [tenantId],
      )
    ).rows[0];
    if (!integrationTeam) throw new Error('Website integration team was not returned');
    const actor = (
      await tx.query<{ id: string }>(
        `INSERT INTO employees(company_id,organization_id,employee_number,display_name,normalized_email)
         VALUES($1,$2,'KT-WEBSITE-INTEGRATION','官网询盘集成','website.integration@kingturf.invalid')
         ON CONFLICT(company_id,employee_number) DO UPDATE SET active=true,deleted_at=NULL,updated_at=now()
         RETURNING id`,
        [tenantId, integrationTeam.id],
      )
    ).rows[0];
    if (!actor) throw new Error('Website integration actor was not returned');
    const title = `[官网询盘] ${payload.application} · ${payload.company ?? payload.name}`.slice(
      0,
      500,
    );
    const lead = (
      await tx.query<{ id: string }>(
        `INSERT INTO leads(tenant_id,title,source,status,created_by,updated_by)
         VALUES($1,$2,'WEBSITE','POOL',$3,$3) RETURNING id`,
        [tenantId, title, actor.id],
      )
    ).rows[0];
    if (!lead) throw new Error('Website lead was not returned');
    await tx.query(
      `INSERT INTO website_lead_ingests
       (tenant_id,lead_id,external_ref,contact_name,company_name,contact,country,application,project_brief,locale,source_page)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        tenantId,
        lead.id,
        payload.externalRef,
        payload.name,
        payload.company,
        payload.contact,
        payload.country,
        payload.application,
        payload.projectBrief,
        payload.locale,
        payload.sourcePage,
      ],
    );
    await tx.query(
      `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
       VALUES('lead.website_ingested','SUCCESS',$1,$2,'lead',$3,$4,$5)`,
      [
        actor.id,
        tenantId,
        lead.id,
        correlationId,
        { externalRef: payload.externalRef, source: 'WEBSITE' },
      ],
    );
    return { leadId: lead.id, externalRef: payload.externalRef, status: 'POOL', duplicate: false };
  }
}
