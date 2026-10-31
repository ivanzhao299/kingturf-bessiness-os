import type { Actor, AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { PostgresRiskRepository } from '../risk-repositories.ts';

type Project = <T extends Record<string, unknown>>(
  value: T,
  authorization: AuthorizationContext,
  capability: PermissionKey,
) => Partial<T>;

// Action authorization permits the command, never the independent reading of its result.
export async function riskResultDto<T extends Record<string, unknown>>(
  value: T | null,
  kind: 'evaluation' | 'task',
  taskId: string | undefined,
  repository: Pick<PostgresRiskRepository, 'canReadResult'>,
  authorization: AuthorizationContext,
  actor: Actor,
  project: Project,
): Promise<Partial<T> | null> {
  const read = authorization.permissions.get('risk:read');
  // Preserve the legacy null/no-data response contract; it contains no business result.
  if (value === null) {
    if (read?.fields === null) return null;
    throw new Error('Risk repository returned no result');
  }
  const id = kind === 'evaluation' ? value.id : taskId;
  if (
    read?.scopes.length &&
    typeof id === 'string' &&
    (await repository.canReadResult(kind, id, {
      actor,
      scopes: read.scopes,
      anchors: authorization.scopeAnchors?.get('risk:read') ?? [],
    }))
  )
    return project(value, { actor, permissions: new Map([['risk:read', read]]) }, 'risk:read');
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key === 'id' || key === 'version'),
  ) as Partial<T>;
}
