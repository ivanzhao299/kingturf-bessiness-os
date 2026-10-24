/* eslint-disable @typescript-eslint/require-await -- mocked async database/storage boundaries preserve production ordering. */
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PostgresAttachmentRepository } from '../src/attachment-repositories.js';

const actor = { companyId: randomUUID(), employeeId: randomUUID() };
const attachmentId = randomUUID();
const baseRow = {
  id: attachmentId,
  tenant_id: actor.companyId,
  opaque_key: `ab/${attachmentId}`,
  original_name: 'evidence.txt',
  mime_type: 'text/plain',
  expected_size: '3',
  actual_size: '3',
  expected_checksum: createHash('sha256')
    .update(new Uint8Array([1, 2, 3]))
    .digest('hex'),
  actual_checksum: 'a'.repeat(64),
  state: 'AVAILABLE',
  version: 2,
  created_by: actor.employeeId,
  created_at: new Date(),
  finalized_at: new Date(),
  deleted_at: null,
  upload_token: null,
  upload_lease_until: null,
  actual_storage_key: `ab/${attachmentId}.${randomUUID()}`,
};

describe('attachment repository lifecycle order', () => {
  it('reserves before storage and finalizes after storage', async () => {
    const events: string[] = [];
    const txQuery = vi.fn(async (sql: string) => {
      events.push(sql);
      if (sql.startsWith("UPDATE attachments SET state='UPLOADING'"))
        return {
          rows: [{ ...baseRow, state: 'UPLOADING', opaque_key: `ab/${attachmentId}` }],
          rowCount: 1,
        };
      if (sql.startsWith("UPDATE attachments SET state='AVAILABLE'"))
        return { rows: [baseRow], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const storage = {
      put: vi.fn(async () => {
        events.push('storage:put');
      }),
      get: vi.fn(),
      delete: vi.fn(),
    };
    const db = {
      query: vi.fn(async () => ({
        rows: [{ ...baseRow, object_type: null, object_id: null }],
        rowCount: 1,
      })),
      transaction: (work: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        work({ query: txQuery }),
    };
    const result = await new PostgresAttachmentRepository(db as never, storage, {
      authorize: vi.fn(async () => true),
    }).upload(attachmentId, new Uint8Array([1, 2, 3]), actor, ['COMPANY'], [], randomUUID());
    expect(result.id).toBe(attachmentId);
    expect(
      events.findIndex((item) => item.startsWith("UPDATE attachments SET state='UPLOADING'")),
    ).toBe(0);
    expect(events.indexOf('storage:put')).toBe(2);
    expect(
      events.findIndex((item) => item.startsWith("UPDATE attachments SET state='AVAILABLE'")),
    ).toBe(3);
  });

  it('resets after storage failure without deleting an unpersisted object', async () => {
    const events: string[] = [];
    const txQuery = vi.fn(async (sql: string) => {
      events.push(sql);
      if (sql.startsWith("UPDATE attachments SET state='UPLOADING'"))
        return { rows: [{ ...baseRow, state: 'UPLOADING' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const storage = {
      put: vi.fn(async () => {
        events.push('storage:put');
        throw new Error('storage unavailable');
      }),
      get: vi.fn(),
      delete: vi.fn(),
    };
    const db = {
      query: vi.fn(async () => ({
        rows: [{ ...baseRow, object_type: null, object_id: null }],
        rowCount: 1,
      })),
      transaction: (work: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        work({ query: txQuery }),
    };
    await expect(
      new PostgresAttachmentRepository(db as never, storage, {
        authorize: vi.fn(async () => true),
      }).upload(attachmentId, new Uint8Array([1, 2, 3]), actor, ['COMPANY'], [], randomUUID()),
    ).rejects.toThrow('storage unavailable');
    expect(events.some((item) => item.startsWith("UPDATE attachments SET state='PENDING'"))).toBe(
      true,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
