import { DomainError } from '@kingturf/domain';
import type { SqlClient } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';

export type CommandResultIdentity = Readonly<{
  type: string;
  subjectId: string;
  actorId: string;
  requestHash: string;
}>;

export async function replayCommercialCommand<T extends JsonObject>(
  tx: SqlClient,
  tenantId: string,
  key: string,
  identity: CommandResultIdentity,
): Promise<T | null> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${tenantId}:${key}`]);
  const retained = (
    await tx.query<{
      command_type: string;
      subject_id: string;
      actor_id: string;
      request_hash: string;
      payload: T;
    }>(
      'SELECT command_type,subject_id,actor_id,request_hash,payload FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
      [tenantId, key],
    )
  ).rows[0];
  if (!retained) return null;
  if (
    retained.command_type !== identity.type ||
    retained.subject_id !== identity.subjectId ||
    retained.actor_id !== identity.actorId ||
    retained.request_hash !== identity.requestHash
  )
    throw new DomainError('conflict', 'Idempotency key is bound to another command');
  return retained.payload;
}

export const retainCommercialCommand = (
  tx: SqlClient,
  tenantId: string,
  key: string,
  identity: CommandResultIdentity,
  payload: JsonObject,
) =>
  tx.query(
    'INSERT INTO commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      tenantId,
      key,
      identity.type,
      identity.subjectId,
      identity.actorId,
      identity.requestHash,
      payload,
    ],
  );
