import type { Database } from '@kingturf/database';
import {
  type Actor,
  type ObjectAccessAuthorizer,
  type ObjectInstanceResolver,
  type ScopeAnchor,
} from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';

/** Validates a published type and delegates concrete instance access to its fail-closed adapter. */
export class PostgresRegistryObjectAccessAuthorizer implements ObjectAccessAuthorizer {
  public constructor(
    private readonly db: Database,
    private readonly resolvers: ReadonlyMap<string, ObjectInstanceResolver>,
  ) {}

  public async authorize(
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] = [],
  ): Promise<boolean> {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/u.test(objectType)) return false;
    const resolver = this.resolvers.get(objectType);
    if (!resolver) return false;
    const registered = await this.db.query(
      `SELECT 1
         FROM business_object_definitions definition
        WHERE definition.tenant_id=$1
          AND lower(definition.code)=$2
          AND definition.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM business_object_versions version
             WHERE version.definition_id=definition.id
               AND version.tenant_id=definition.tenant_id
               AND version.status='PUBLISHED'
          )
          AND EXISTS (
            SELECT 1 FROM employees actor
             WHERE actor.id=$3 AND actor.company_id=$1
               AND actor.active AND actor.deleted_at IS NULL
          )
        LIMIT 1`,
      [actor.companyId, objectType, actor.employeeId],
    );
    if (!registered.rowCount) return false;
    return resolver.authorizeInstance(objectId, actor, scopes, anchors);
  }
}

/** Adapter for the existing employee aggregate; it reuses the canonical E01 DataScope repository. */
export class EmployeeObjectInstanceResolver implements ObjectInstanceResolver {
  public constructor(
    private readonly employees: Pick<import('@kingturf/domain').EmployeeRepository, 'findById'>,
  ) {}
  public async authorizeInstance(
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] = [],
  ): Promise<boolean> {
    return Boolean(
      await this.employees.findById(objectId, actor.companyId, scopes, actor.employeeId, anchors),
    );
  }
}
