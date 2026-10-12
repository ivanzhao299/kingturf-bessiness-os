/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import type { Database, Transaction } from '@kingturf/database';
import { writeFoundationEmptyAudit as audit } from './audit-outbox.ts';
import { eventPublisher } from './event-repositories.ts';
import {
  assertStableCode,
  DomainError,
  validateBusinessObjectSchema,
  type Actor,
} from '@kingturf/domain';
import type {
  BusinessObjectDefinitionDto,
  BusinessObjectSchema,
  BusinessObjectVersionDto,
} from '@kingturf/types';

export {
  InProcessEventDispatcher,
  PostgresEventRepository,
  PostgresTransactionalEventPublisher,
} from './event-repositories.ts';

export { PostgresNotificationRepository } from './notification-repositories.ts';
export { LocalAttachmentStorage, PostgresAttachmentRepository } from './attachment-repositories.ts';
export {
  EmployeeObjectInstanceResolver,
  PostgresRegistryObjectAccessAuthorizer,
} from './foundation-object-access.ts';

export class PostgresBusinessObjectRepository {
  public constructor(private readonly db: Database) {}
  private version(r: any): BusinessObjectVersionDto {
    return {
      id: r.id,
      definitionId: r.definition_id,
      tenantId: r.tenant_id,
      version: r.version,
      status: r.status,
      schema: r.schema,
      createdAt: r.created_at.toISOString(),
      publishedAt: r.published_at?.toISOString?.() ?? null,
    };
  }
  private async definition(tx: Transaction, id: string, tenantId: string) {
    const d = await tx.query<any>(
      'SELECT * FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',
      [id, tenantId],
    );
    if (!d.rows[0]) throw new DomainError('not_found', 'Business object not found');
    const versions = (
      await tx.query<any>(
        'SELECT * FROM business_object_versions WHERE definition_id=$1 AND tenant_id=$2 ORDER BY version',
        [id, tenantId],
      )
    ).rows.map((row) => this.version(row));
    return {
      id: d.rows[0].id,
      tenantId: d.rows[0].tenant_id,
      code: d.rows[0].code,
      name: d.rows[0].name,
      version: d.rows[0].version,
      versions,
    } satisfies BusinessObjectDefinitionDto;
  }
  public async create(
    code: string,
    name: string,
    schemaValue: unknown,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    const schema = validateBusinessObjectSchema(schemaValue);
    return this.db.transaction(async (tx) => {
      const d = await tx.query<any>(
        'INSERT INTO business_object_definitions(tenant_id,code,name,created_by) VALUES($1,$2,$3,$4) RETURNING *',
        [actor.companyId, assertStableCode(code), name, actor.employeeId],
      );
      const definition = d.rows[0];
      const v = await tx.query<any>(
        'INSERT INTO business_object_versions(tenant_id,definition_id,version,schema,created_by) VALUES($1,$2,1,$3,$4) RETURNING *',
        [actor.companyId, definition.id, schema, actor.employeeId],
      );
      await this.relationships(tx, v.rows[0].id, schema, actor.companyId);
      await eventPublisher.enqueue(tx, {
        eventType: 'business-object.created',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'business-object',
        aggregateId: definition.id,
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { code: definition.code },
      });
      await audit(
        tx,
        'business-object.create',
        actor,
        'business-object',
        definition.id,
        correlationId,
      );
      return {
        id: definition.id,
        tenantId: definition.tenant_id,
        code: definition.code,
        name: definition.name,
        version: definition.version,
        versions: [this.version(v.rows[0])],
      };
    });
  }
  private async relationships(
    tx: Transaction,
    versionId: string,
    schema: BusinessObjectSchema,
    tenantId: string,
  ): Promise<void> {
    for (const f of schema.fields)
      if (f.type === 'relationship')
        await tx.query(
          'INSERT INTO business_object_relationships(tenant_id,version_id,field_key,target_definition_id,cardinality) VALUES($1,$2,$3,$4,$5)',
          [tenantId, versionId, f.key, f.targetDefinitionId, f.cardinality],
        );
  }
  public async addVersion(
    id: string,
    schemaValue: unknown,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    const schema = validateBusinessObjectSchema(schemaValue);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:${id}`,
      ]);
      const r = await tx.query<any>(
        'INSERT INTO business_object_versions(tenant_id,definition_id,version,schema,created_by) SELECT $2,id,COALESCE((SELECT max(version)+1 FROM business_object_versions WHERE definition_id=$1),1),$3,$4 FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING *',
        [id, actor.companyId, schema, actor.employeeId],
      );
      if (!r.rows[0]) throw new DomainError('not_found', 'Business object not found');
      await this.relationships(tx, r.rows[0].id, schema, actor.companyId);
      await tx.query(
        'UPDATE business_object_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2',
        [id, actor.companyId],
      );
      await audit(
        tx,
        'business-object.version.create',
        actor,
        'business-object',
        id,
        correlationId,
      );
      return this.definition(tx, id, actor.companyId);
    });
  }
  public async publish(
    id: string,
    version: number,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:${id}`,
      ]);
      const r = await tx.query<any>(
        "UPDATE business_object_versions SET status='PUBLISHED',published_at=now() WHERE definition_id=$1 AND tenant_id=$2 AND version=$3 AND status='DRAFT' RETURNING *",
        [id, actor.companyId, version],
      );
      if (!r.rows[0]) throw new DomainError('not_found', 'Draft version not found');
      await tx.query(
        'UPDATE business_object_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2',
        [id, actor.companyId],
      );
      await eventPublisher.enqueue(tx, {
        eventType: 'business-object.published',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'business-object',
        aggregateId: id,
        aggregateVersion: version,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { version },
      });
      await audit(tx, 'business-object.publish', actor, 'business-object', id, correlationId);
      return this.definition(tx, id, actor.companyId);
    });
  }
  public async find(id: string, tenantId: string): Promise<BusinessObjectDefinitionDto | null> {
    const d = await this.db.query<any>(
      'SELECT * FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',
      [id, tenantId],
    );
    if (!d.rows[0]) return null;
    const versions = (
      await this.db.query<any>(
        'SELECT * FROM business_object_versions WHERE definition_id=$1 AND tenant_id=$2 ORDER BY version',
        [id, tenantId],
      )
    ).rows.map((r) => this.version(r));
    return {
      id: d.rows[0].id,
      tenantId: d.rows[0].tenant_id,
      code: d.rows[0].code,
      name: d.rows[0].name,
      version: d.rows[0].version,
      versions,
    };
  }
  public async list(tenantId: string): Promise<readonly BusinessObjectDefinitionDto[]> {
    return (
      await this.db.query<any>(
        'SELECT * FROM business_object_definitions WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY code',
        [tenantId],
      )
    ).rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      code: r.code,
      name: r.name,
      version: r.version,
    }));
  }
}
