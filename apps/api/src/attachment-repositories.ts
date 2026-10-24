import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@kingturf/database';
import { writeFoundationEmptyAudit as audit } from './audit-outbox.ts';
import { eventPublisher } from './event-repositories.ts';
import {
  DomainError,
  type Actor,
  type ObjectAccessAuthorizer,
  type ObjectStorage,
  type ScopeAnchor,
} from '@kingturf/domain';
import type { AttachmentDto, AttachmentState, DataScope } from '@kingturf/types';

type AttachmentRow = Readonly<{
  id: string;
  tenant_id: string;
  opaque_key: string;
  original_name: string;
  mime_type: string;
  expected_size: string;
  actual_size: string | null;
  expected_checksum: string;
  actual_checksum: string | null;
  state: AttachmentState;
  version: number;
  created_by: string;
  created_at: Date;
  finalized_at: Date | null;
  deleted_at: Date | null;
  upload_token: string | null;
  upload_lease_until: Date | null;
  actual_storage_key: string | null;
}>;
type AttachmentBindingRow = Readonly<{
  created_by: string;
  object_type: string;
  object_id: string;
}>;
type AttachmentWithBindingRow = AttachmentRow & AttachmentBindingRow;
type AttachmentDeleteRow = Readonly<{
  actual_storage_key: string | null;
  opaque_key: string;
  version: number;
}>;

export class LocalAttachmentStorage implements ObjectStorage {
  public constructor(private readonly root: string) {}
  private path(key: string): string {
    if (!/^[0-9a-f]{2}\/([0-9a-f-]{36})(?:\.([0-9a-f-]{36}))?$/u.test(key))
      throw new DomainError('invalid_request', 'Invalid storage key');
    return join(this.root, ...key.split('/'));
  }
  public async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.path(key);
    await mkdir(join(this.root, key.slice(0, 2)), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
  }
  public async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  public async delete(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export class PostgresAttachmentRepository {
  public constructor(
    private readonly db: Database,
    private readonly storage: ObjectStorage,
    private readonly objectAccess: ObjectAccessAuthorizer,
  ) {}
  private map(r: AttachmentRow): AttachmentDto {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      size: r.actual_size == null ? null : Number(r.actual_size),
      checksum: r.actual_checksum,
      state: r.state,
      version: r.version,
      createdAt: r.created_at.toISOString(),
    };
  }
  public async create(
    input: { name: string; mimeType: string; size: number; checksum: string },
    actor: Actor,
    correlationId: string,
  ): Promise<AttachmentDto> {
    if (
      !/^[0-9a-f]{64}$/u.test(input.checksum) ||
      input.name.length > 255 ||
      /[\\/\0]/u.test(input.name)
    )
      throw new DomainError('invalid_request', 'Unsafe attachment metadata');
    return this.db.transaction(async (tx) => {
      const id = randomUUID(),
        key = `${id.slice(0, 2)}/${id}`;
      const r = await tx.query<AttachmentRow>(
        'INSERT INTO attachments(id,tenant_id,opaque_key,original_name,mime_type,expected_size,expected_checksum,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          id,
          actor.companyId,
          key,
          input.name,
          input.mimeType,
          input.size,
          input.checksum,
          actor.employeeId,
        ],
      );
      await eventPublisher.enqueue(tx, {
        eventType: 'attachment.created',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'attachment',
        aggregateId: id,
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { mimeType: input.mimeType },
      });
      await audit(tx, 'attachment.create', actor, 'attachment', id, correlationId);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- INSERT RETURNING invariant preserved from the original implementation.
      return this.map(r.rows[0]!);
    });
  }
  public async upload(
    id: string,
    bytes: Uint8Array,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ): Promise<AttachmentDto> {
    const locked = await this.db.query<AttachmentWithBindingRow>(
      "SELECT a.*,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 AND (a.state='PENDING' OR (a.state='UPLOADING' AND a.upload_lease_until<now()))",
      [id, actor.companyId],
    );
    const metadata = locked.rows[0];
    if (!metadata) throw new DomainError('not_found', 'Attachment not found');
    if (
      metadata.created_by !== actor.employeeId &&
      !(await this.anyAuthorized(
        locked.rows.filter((row) => row.object_id),
        actor,
        scopes,
        anchors,
      ))
    )
      throw new DomainError('not_found', 'Attachment not found');
    if (
      bytes.byteLength !== Number(metadata.expected_size) ||
      createHash('sha256').update(bytes).digest('hex') !== metadata.expected_checksum
    )
      throw new DomainError('invalid_request', 'Attachment size or checksum mismatch');
    const token = randomUUID();
    const reserved = await this.db.transaction(async (tx) => {
      const result = await tx.query<AttachmentRow>(
        "UPDATE attachments SET state='UPLOADING',upload_token=$3,upload_lease_until=now()+interval '5 minutes' WHERE id=$1 AND tenant_id=$2 AND (state='PENDING' OR (state='UPLOADING' AND upload_lease_until<now())) RETURNING *",
        [id, actor.companyId, token],
      );
      if (!result.rows[0])
        throw new DomainError('conflict', 'Attachment upload already in progress');
      await audit(tx, 'attachment.upload.reserve', actor, 'attachment', id, correlationId);
      return result.rows[0];
    });
    const storageKey = `${reserved.opaque_key}.${token}`;
    let stored = false;
    try {
      await this.storage.put(storageKey, bytes);
      stored = true;
      return await this.db.transaction(async (tx) => {
        const r = await tx.query<AttachmentRow>(
          "UPDATE attachments SET state='AVAILABLE',actual_size=$4,actual_checksum=$5,actual_storage_key=$6,finalized_at=now(),version=version+1,upload_token=NULL,upload_lease_until=NULL WHERE id=$1 AND tenant_id=$2 AND state='UPLOADING' AND upload_token=$3 RETURNING *",
          [id, actor.companyId, token, bytes.byteLength, metadata.expected_checksum, storageKey],
        );
        if (!r.rows[0]) throw new DomainError('conflict', 'Attachment lifecycle conflict');
        await audit(tx, 'attachment.finalize', actor, 'attachment', id, correlationId);
        return this.map(r.rows[0]);
      });
    } catch (error) {
      if (stored) await this.storage.delete(storageKey);
      await this.db.transaction(async (tx) => {
        const reset = await tx.query(
          "UPDATE attachments SET state='PENDING',upload_token=NULL,upload_lease_until=NULL WHERE id=$1 AND tenant_id=$2 AND state='UPLOADING' AND upload_token=$3",
          [id, actor.companyId, token],
        );
        if (reset.rowCount)
          await audit(tx, 'attachment.upload.reset', actor, 'attachment', id, correlationId);
      });
      throw error;
    }
  }
  public async bind(
    id: string,
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    if (!(await this.objectAccess.authorize(objectType, objectId, actor, scopes, anchors)))
      throw new DomainError('not_found', 'Bindable object not found');
    const existing = await this.db.query<AttachmentBindingRow>(
      'SELECT a.created_by,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2',
      [id, actor.companyId],
    );
    if (!existing.rows[0]) throw new DomainError('not_found', 'Attachment not found');
    const prior = existing.rows.filter((row) => row.object_id);
    if (
      existing.rows[0].created_by !== actor.employeeId &&
      !(await this.anyAuthorized(prior, actor, scopes, anchors))
    )
      throw new DomainError('not_found', 'Attachment not found');
    await this.db.transaction(async (tx) => {
      const r = await tx.query(
        "INSERT INTO attachment_bindings(tenant_id,attachment_id,object_type,object_id,bound_by) SELECT tenant_id,id,$3,$4,$5 FROM attachments WHERE id=$1 AND tenant_id=$2 AND state='AVAILABLE' ON CONFLICT DO NOTHING RETURNING id",
        [id, actor.companyId, objectType, objectId, actor.employeeId],
      );
      if (!r.rowCount) throw new DomainError('not_found', 'Attachment not found');
      await audit(tx, 'attachment.bind', actor, 'attachment', id, correlationId);
    });
  }
  public async unbind(
    id: string,
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    if (!(await this.objectAccess.authorize(objectType, objectId, actor, scopes, anchors)))
      throw new DomainError('not_found', 'Bindable object not found');
    await this.db.transaction(async (tx) => {
      const result = await tx.query(
        'UPDATE attachment_bindings SET unbound_at=now() WHERE tenant_id=$1 AND attachment_id=$2 AND object_type=$3 AND object_id=$4 AND unbound_at IS NULL',
        [actor.companyId, id, objectType, objectId],
      );
      if (!result.rowCount) throw new DomainError('not_found', 'Attachment binding not found');
      await audit(tx, 'attachment.unbind', actor, 'attachment', id, correlationId);
    });
  }
  public async download(
    id: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ): Promise<{ metadata: AttachmentDto; bytes: Uint8Array } | null> {
    const r = await this.db.query<AttachmentWithBindingRow>(
      "SELECT a.*,b.object_type,b.object_id FROM attachments a JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 AND a.state='AVAILABLE'",
      [id, actor.companyId],
    );
    if (!r.rows[0]) return null;
    const allowed = await Promise.all(
      r.rows.map((row) =>
        this.objectAccess.authorize(row.object_type, row.object_id, actor, scopes, anchors),
      ),
    );
    if (!allowed.some(Boolean)) return null;
    const bytes = await this.storage.get(r.rows[0].actual_storage_key ?? r.rows[0].opaque_key);
    return bytes ? { metadata: this.map(r.rows[0]), bytes } : null;
  }
  public async remove(
    id: string,
    version: number,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    const pending = await this.db.transaction(async (tx) => {
      const bindings = await tx.query<AttachmentBindingRow>(
        'SELECT a.created_by,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 FOR UPDATE OF a',
        [id, actor.companyId],
      );
      const activeBindings = bindings.rows.filter((row) => row.object_id);
      const creatorMayDeleteUnbound =
        bindings.rows[0]?.created_by === actor.employeeId && activeBindings.length === 0;
      if (
        !bindings.rows[0] ||
        (!creatorMayDeleteUnbound &&
          !(await this.anyAuthorized(activeBindings, actor, scopes, anchors)))
      )
        throw new DomainError('not_found', 'Attachment not found');
      const r = await tx.query<AttachmentDeleteRow>(
        "UPDATE attachments SET state='DELETE_PENDING',version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND state IN ('PENDING','AVAILABLE') RETURNING actual_storage_key,opaque_key,version",
        [id, actor.companyId, version],
      );
      if (r.rows[0]) {
        await audit(tx, 'attachment.delete.reserve', actor, 'attachment', id, correlationId);
        return r.rows[0];
      }
      const retry = await tx.query<AttachmentDeleteRow>(
        "SELECT actual_storage_key,opaque_key,version FROM attachments WHERE id=$1 AND tenant_id=$2 AND state='DELETE_PENDING' AND version IN ($3,$3+1)",
        [id, actor.companyId, version],
      );
      if (!retry.rows[0]) throw new DomainError('conflict', 'Attachment version conflict');
      return retry.rows[0];
    });
    await this.storage.delete(pending.actual_storage_key ?? pending.opaque_key);
    await this.db.transaction(async (tx) => {
      const finalized = await tx.query(
        "UPDATE attachments SET state='DELETED',deleted_at=now() WHERE id=$1 AND tenant_id=$2 AND state='DELETE_PENDING' AND version=$3",
        [id, actor.companyId, pending.version],
      );
      if (!finalized.rowCount) throw new DomainError('conflict', 'Attachment lifecycle conflict');
      await audit(tx, 'attachment.delete.finalize', actor, 'attachment', id, correlationId);
    });
  }
  private async anyAuthorized(
    rows: readonly AttachmentBindingRow[],
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ): Promise<boolean> {
    const allowed = await Promise.all(
      rows.map((row) =>
        this.objectAccess.authorize(row.object_type, row.object_id, actor, scopes, anchors),
      ),
    );
    return allowed.some(Boolean);
  }
}
