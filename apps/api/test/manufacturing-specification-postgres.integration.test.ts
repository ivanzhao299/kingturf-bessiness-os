import { createHash, randomUUID } from 'node:crypto';
import { canonicalize } from '@kingturf/domain';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiDependencies } from '../src/app.js';
import { manufacturingContentHash } from '../src/manufacturing-fingerprint.js';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const effectiveAt = '2026-01-01T00:00:00Z';
const identifier = (row: JsonObject, key = 'id'): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};

describe('TD-MFG-017 manufacturing decimal specifications and unchanged request binding', () => {
  let owned: Awaited<ReturnType<typeof ownedPostgres>>;
  let repository: PostgresManufacturingRepository;
  beforeAll(async () => {
    owned = await ownedPostgres('mfg_decimal');
    repository = new PostgresManufacturingRepository(owned.db);
  }, 30_000);
  afterAll(async () => {
    await owned.close();
  });
  const input = (sku: string, specification: JsonObject) => ({
    sku,
    name: sku,
    itemType: 'FINISHED_GOOD',
    baseUnitCode: 'M2',
    specification,
    effectiveAt,
    publish: false,
  });

  it('creates a root through the real bridge with decimals nested in objects and arrays', async () => {
    const specification = { height: 50.5, calibration: { offsets: [0, -1.25] }, active: true };
    const permissions = new Map<PermissionKey, { scopes: readonly 'COMPANY'[]; fields: null }>([
      ['manufacturing-item:read', { scopes: ['COMPANY'], fields: null }],
      ['manufacturing-item:manage', { scopes: ['COMPANY'], fields: null }],
    ]);
    const response = await dispatchFastifyRouteGroup(
      {
        method: 'POST',
        pathname: '/api/v1/manufacturing-items',
        headers: {},
        body: input('DECIMAL-BRIDGE', specification),
      },
      {
        authorization: { actor: owned.context.actor, permissions },
        dependencies: { commercial: {}, manufacturing: repository } as ApiDependencies,
        correlationId: randomUUID(),
      },
    );
    expect(response?.statusCode).toBe(201);
    const created = response?.body as JsonObject;
    const stored = await owned.db.query<{ specification: JsonObject; canonical_hash: string }>(
      'SELECT specification,canonical_hash FROM manufacturing_item_versions WHERE id=$1',
      [identifier(created)],
    );
    expect(stored.rows[0]?.specification).toEqual(specification);
    expect(stored.rows[0]?.canonical_hash).toBe(created.canonicalHash);
    expect(created.canonicalHash).toBe(
      manufacturingContentHash({
        itemId: created.itemId,
        specification,
        effectiveAt: created.effectiveAt,
      }),
    );
  });

  it('preserves the old integer content hash and uses that same formula on continuation content', async () => {
    const specification = {
      dtex: 12000,
      nested: { zero: 0, negative: -7, max: Number.MAX_SAFE_INTEGER },
      values: [null, true, '001'],
    };
    const created = await repository.createItem(
      input('INTEGER-COMPAT', specification),
      owned.context,
      randomUUID(),
    );
    const content = { itemId: identifier(created, 'itemId'), specification, effectiveAt };
    const oldHash = createHash('sha256').update(canonicalize(content)).digest('hex');
    expect(created.canonicalHash).toBe(oldHash);
    // 显式传同一 effectiveAt，避免 PG 读出的等价时间文本改变内容字符串。
    const continued = await repository.createItemVersion(
      identifier(created, 'itemId'),
      { effectiveAt, specification },
      randomUUID(),
      owned.context,
      randomUUID(),
    );
    expect(continued.canonical_hash).toBe(oldHash);
    expect(continued.specification).toEqual(specification);
    const stored = await owned.db.query<{ canonical_hash: string }>(
      'SELECT canonical_hash FROM manufacturing_item_versions WHERE item_id=$1 ORDER BY version',
      [identifier(created, 'itemId')],
    );
    expect(stored.rows.map((row) => row.canonical_hash)).toEqual([oldHash, oldHash]);
  });

  it('keeps the existing PG jsonb request digest and replays the exact first result without extra evidence', async () => {
    const created = await repository.createItem(
      input('DECIMAL-REPLAY', {}),
      owned.context,
      randomUUID(),
    );
    const root = identifier(created, 'itemId');
    const patch = { effectiveAt, specification: { height: 12.5, nested: [0, { x: -0.25 }] } };
    const key = randomUUID();
    const first = await repository.createItemVersion(root, patch, key, owned.context, randomUUID());
    const receipt = await owned.db.query<{
      request_hash: string;
      expected: string;
      payload: JsonObject;
    }>(
      "SELECT request_hash,payload,encode(sha256(convert_to(($3::jsonb)::text,'UTF8')),'hex') expected FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2",
      [owned.company, key, patch],
    );
    expect(receipt.rows[0]?.request_hash).toBe(receipt.rows[0]?.expected);
    expect(receipt.rows[0]?.request_hash).not.toBe(manufacturingContentHash(patch));
    expect(receipt.rows[0]?.payload).toEqual(first);
    const counts = async () =>
      (
        await owned.db.query<{
          versions: number;
          receipts: number;
          audits: number;
          events: number;
        }>(
          `SELECT (SELECT count(*)::int FROM manufacturing_item_versions WHERE item_id=$1) versions,
            (SELECT count(*)::int FROM commercial_command_results WHERE subject_id=$1) receipts,
            (SELECT count(*)::int FROM audit_events WHERE target_id=$1) audits,
            (SELECT count(*)::int FROM domain_event_outbox WHERE aggregate_id=$1) events`,
          [root],
        )
      ).rows[0];
    const before = await counts();
    const replay = await repository.createItemVersion(
      root,
      { specification: { nested: [0, { x: -0.25 }], height: 12.5 }, effectiveAt },
      key,
      owned.context,
      randomUUID(),
    );
    expect(replay).toEqual(first);
    expect(await counts()).toEqual(before);
    await expect(
      repository.createItemVersion(
        root,
        { ...patch, specification: { height: 13.5 } },
        key,
        owned.context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await counts()).toEqual(before);
  });
});
