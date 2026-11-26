import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, migrationStatus, migrationsDirectory } from '@kingturf/database';
import type { AuthorizationContext } from '@kingturf/domain';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../src/app.js';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import type { authorizeQuery } from '../src/policy.js';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.js';
import { manufacturingPublishRoutes } from '../src/routes/manufacturing-publish.js';
import { ownedHttpApi } from './fixtures/owned-http-api.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// TD-MFG-015（MG2）：BOM 发布要求组件全部已发布（与替代料一致）。迁移 0036 的发布守卫对组件
// 检查的是「至少一个已发布」，含草稿组件的 BOM 也能发布。迁移 0079 只改触发器函数的 BOM 分支
// （packages/database/test/migrations.test.ts 机械比对）；仓储的 publish 在发布前先查一遍，把未
// 发布的组件列给用户（409），触发器仍是最后防线。迁移不改任何已发布 BOM。
const GUARD_0079 = '0079_bom_requires_published_components.sql';
const TRIGGER_MESSAGE =
  'BOM publication requires published product, component, and substitute versions';
const RELEASE_MESSAGE =
  '无法发布 BOM：以下组件尚未发布：BM-DRAFT-RAW（草稿组件）。请先发布这些组件版本，再发布 BOM';
const date = '2026-01-01T00:00:00Z';
const rollback = new Error('mg2 rollback sentinel');
type Owned = Awaited<ReturnType<typeof ownedPostgres>>;
type Repository = PostgresManufacturingRepository;
type Item = JsonObject;
const id = (row: JsonObject, key = 'id'): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};
const migrationSql = (name: string) => readFile(join(migrationsDirectory, name), 'utf8');

const items = async (repository: Repository, owned: Owned) => {
  const item = (sku: string, name: string, itemType: string, publish: boolean) =>
    repository.createItem(
      { sku, name, itemType, baseUnitCode: 'KG', specification: {}, effectiveAt: date, publish },
      owned.context,
      randomUUID(),
    );
  return {
    product: await item('BM-FG', '成品', 'FINISHED_GOOD', true),
    raw: await item('BM-RAW', '已发布组件', 'RAW_MATERIAL', true),
    alternate: await item('BM-ALT', '替代料', 'RAW_MATERIAL', true),
    draft: await item('BM-DRAFT-RAW', '草稿组件', 'RAW_MATERIAL', false),
  };
};
const bomOf =
  (repository: Repository, owned: Owned, parts: Awaited<ReturnType<typeof items>>) =>
  (code: string, lines: readonly JsonObject[]) =>
    repository.createBom(
      {
        code,
        name: code,
        productItemId: id(parts.product, 'itemId'),
        productItemVersionId: id(parts.product),
        outputQuantity: '1',
        effectiveAt: date,
        lines: lines as Parameters<Repository['createBom']>[0]['lines'],
        publish: false,
      },
      owned.context,
      randomUUID(),
    );
const line = (component: Item, substitutes: readonly Item[] = []) => ({
  componentItemVersionId: id(component),
  quantity: '1',
  scrapBasisPoints: 0,
  substitutes: substitutes.map((entry, index) => ({
    itemVersionId: id(entry),
    priority: index + 1,
    conversionFactor: '1',
  })),
});
/** 旧仓储发布 BOM 时执行的那条 UPDATE（迁移 0079 之前的应用代码就是这一句）。 */
const legacyPublishSql =
  "UPDATE manufacturing_bom_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2 AND status='DRAFT'";

// 升级：迁移到 0078 为止的库 → 按旧规则发布一张混合 BOM → 应用 0079 → 仍是已发布、行项逐字节不变。
describe('TD-MFG-015 upgrade keeps a mixed BOM that was published before 0079', () => {
  it('leaves status, timestamps, hash and every line byte-identical after the migration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kt-mfg2-bom-78-'));
    const files = (await readdir(migrationsDirectory)).filter(
      (name) => name.endsWith('.sql') && name < '0079_',
    );
    expect(files).toHaveLength(78);
    for (const file of files)
      await copyFile(join(migrationsDirectory, file), join(directory, file));
    const owned = await ownedPostgres('bom_upgrade_pg', directory);
    try {
      const repository = new PostgresManufacturingRepository(owned.db);
      const parts = await items(repository, owned);
      const mixed = await bomOf(
        repository,
        owned,
        parts,
      )('BM-UPGRADE-MIXED', [line(parts.raw), line(parts.draft)]);
      await owned.db.query(legacyPublishSql, [id(mixed), owned.company]);
      const snapshot = async () =>
        (
          await owned.db.query<{
            status: string;
            published_at: string | null;
            hash: string;
            lines: string;
            component_statuses: string[];
          }>(
            `SELECT v.status,v.published_at::text published_at,v.canonical_hash hash,
               (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.line_number)::text FROM manufacturing_bom_lines l WHERE l.tenant_id=v.tenant_id AND l.bom_version_id=v.id) lines,
               ARRAY(SELECT iv.status::text FROM manufacturing_bom_lines l JOIN manufacturing_item_versions iv ON iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id WHERE l.tenant_id=v.tenant_id AND l.bom_version_id=v.id ORDER BY l.line_number) component_statuses
             FROM manufacturing_bom_versions v WHERE v.id=$1`,
            [id(mixed)],
          )
        ).rows[0];
      const before = await snapshot();
      if (!before) throw new Error('Upgraded BOM version missing');
      // 这确实是一张 0079 之前就能发布的混合 BOM：一行已发布、一行草稿。
      expect(before.status).toBe('PUBLISHED');
      expect(before.component_statuses).toEqual(['PUBLISHED', 'DRAFT']);
      expect(before.published_at).not.toBeNull();
      await copyFile(join(migrationsDirectory, GUARD_0079), join(directory, GUARD_0079));
      await migrate(owned.db, directory);
      const status = await migrationStatus(owned.db, directory);
      expect(status.filter((item) => item.state !== 'applied')).toEqual([]);
      expect(status.at(-1)?.name).toBe(GUARD_0079);
      expect(await snapshot()).toEqual(before);
      // 升级后新规则生效：同结构的草稿不能再这样发布。
      const fresh = await bomOf(
        repository,
        owned,
        parts,
      )('BM-UPGRADE-FRESH', [line(parts.raw), line(parts.draft)]);
      await expect(
        owned.db.transaction(async (tx) => {
          await tx.query(legacyPublishSql, [id(fresh), owned.company]);
          throw rollback;
        }),
      ).rejects.toMatchObject({ code: 'P0001', message: TRIGGER_MESSAGE });
    } finally {
      await owned.close();
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('TD-MFG-015 BOM publication requires every component to be published', () => {
  let owned: Owned | undefined;
  let repository: Repository;
  let parts: Awaited<ReturnType<typeof items>>;
  let mixed: JsonObject, clean: JsonObject, empty: JsonObject;
  const state = () => {
    if (!owned) throw new Error('Owned fixture not initialized');
    return owned;
  };
  /** 在总是回滚的事务里执行一条语句，返回它抛出的数据库错误（成功则为 null）。 */
  const attempt = async (sql: string, values: readonly unknown[]) => {
    let caught: { code?: unknown; message?: unknown } | null = null;
    await state()
      .db.transaction(async (tx) => {
        try {
          await tx.query(sql, values);
        } catch (error) {
          caught = error as { code?: unknown; message?: unknown };
        }
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
      });
    return caught;
  };
  const statusOf = async (bom: JsonObject) =>
    (
      await state().db.query<{ status: string }>(
        'SELECT status FROM manufacturing_bom_versions WHERE id=$1',
        [id(bom)],
      )
    ).rows[0]?.status;
  const evidence = async (correlation: string) =>
    (
      await state().db.query<{ audit: number; outbox: number }>(
        'SELECT (SELECT count(*)::int FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::int FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  /** 桥轨：PUT /api/v1/manufacturing-boms/:id/publish 经真实路由组与真实仓储。 */
  const publishOverBridge = (bom: JsonObject, correlationId: string) => {
    const grants = new Map<
      PermissionKey,
      { scopes: readonly 'COMPANY'[]; fields: readonly string[] | null }
    >();
    grants.set('bom:read', { fields: null, scopes: ['COMPANY'] });
    grants.set('bom:manage', { fields: null, scopes: ['COMPANY'] });
    const request: ApiRequest = {
      method: 'PUT',
      pathname: `/api/v1/manufacturing-boms/${id(bom)}/publish`,
      headers: {},
      body: {},
    };
    return dispatchFastifyRouteGroup(request, {
      authorization: {
        actor: { employeeId: state().employee, companyId: state().company },
        permissions: grants,
      },
      dependencies: { commercial: {}, manufacturing: repository } as ApiDependencies,
      correlationId,
    });
  };
  /** 旧轨：POST /api/v1/manufacturing-bom-versions/:id/publish 的 legacy 路由定义 + 真实仓储。 */
  const publishOverLegacy = (bom: JsonObject) => {
    const request = {
      method: 'POST',
      pathname: `/api/v1/manufacturing-bom-versions/${id(bom)}/publish`,
      headers: {},
      body: {},
    } as unknown as ApiRequest;
    const route = manufacturingPublishRoutes({
      repository: () => repository,
      authorization: {
        actor: { employeeId: state().employee, companyId: state().company },
      } as unknown as AuthorizationContext,
      authorizeQuery: (() => ({
        scopes: ['COMPANY'] as const,
        anchors: [],
      })) as unknown as typeof authorizeQuery,
      correlationId: randomUUID(),
      parsers: {
        objectBody: (value: unknown) => (value ?? {}) as Record<string, unknown>,
        allow: () => undefined,
        uuid: (value: unknown) => value as string,
      },
      mutationDto: <T extends Record<string, unknown>>(value: T): Partial<T> => value,
    })[0];
    if (!route?.validate) throw new Error('Legacy publish route missing');
    const match = route.match(request.pathname);
    if (!match) throw new Error('Legacy publish route did not match');
    // 与旧分发层一致：先 validate，再把结果交给 handler。
    return route.handler(request, match, route.validate(request, match));
  };

  beforeAll(async () => {
    owned = await ownedPostgres('bom_components_pg');
    repository = new PostgresManufacturingRepository(owned.db);
    parts = await items(repository, owned);
    const bom = bomOf(repository, owned, parts);
    mixed = await bom('BM-MIXED', [line(parts.raw), line(parts.draft)]);
    clean = await bom('BM-CLEAN', [line(parts.raw, [parts.alternate]), line(parts.alternate)]);
    empty = await bom('BM-EMPTY', []);
  }, 30_000);
  afterAll(async () => {
    await owned?.close();
  });

  it('rejects a draft that still has an unpublished component, naming exactly those components', async () => {
    const { context } = state();
    const correlation = randomUUID();
    const error = await repository
      .publish('bom', id(mixed), context, correlation)
      .catch((cause: unknown) => cause as { code?: string; message?: string });
    expect(error).toMatchObject({ code: 'conflict', message: RELEASE_MESSAGE });
    expect(error.code).not.toBe('P0001');
    expect(await statusOf(mixed)).toBe('DRAFT');
    expect(await evidence(correlation)).toEqual({ audit: 0, outbox: 0 });
  });

  it('keeps the database trigger as the last line of defense', async () => {
    expect(await attempt(legacyPublishSql, [id(mixed), state().company])).toMatchObject({
      code: 'P0001',
      message: TRIGGER_MESSAGE,
    });
    expect(await statusOf(mixed)).toBe('DRAFT');
  });

  it('still publishes a BOM whose components and substitutes are all published', async () => {
    const { context } = state();
    const correlation = randomUUID();
    expect(await repository.publish('bom', id(clean), context, correlation)).toMatchObject({
      status: 'PUBLISHED',
      kind: 'bom',
    });
    expect((await evidence(correlation))?.audit).toBe(1);
  });

  it('does not loosen anything: a BOM without any component still cannot be published', async () => {
    await expect(
      repository.publish('bom', id(empty), state().context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: TRIGGER_MESSAGE });
    expect(await statusOf(empty)).toBe('DRAFT');
  });

  it('unblocks the BOM once its component is published', async () => {
    const { context } = state();
    const late = await repository.createItem(
      {
        sku: 'BM-DRAFT-LATE',
        name: '稍后发布的组件',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: date,
        publish: false,
      },
      context,
      randomUUID(),
    );
    const blocked = await bomOf(repository, state(), parts)('BM-AFTER-COMPONENT', [line(late)]);
    const attempt = repository.publish('bom', id(blocked), context, randomUUID());
    await expect(attempt).rejects.toMatchObject({
      code: 'conflict',
      message:
        '无法发布 BOM：以下组件尚未发布：BM-DRAFT-LATE（稍后发布的组件）。请先发布这些组件版本，再发布 BOM',
    });
    await repository.publish('item', id(late), context, randomUUID());
    expect(await repository.publish('bom', id(blocked), context, randomUUID())).toMatchObject({
      status: 'PUBLISHED',
    });
  });

  it('is really the 0036 rule: with the old function installed the mixed draft publishes, 0079 rejects it again', async () => {
    const { db, company } = state();
    const legacy = /CREATE FUNCTION validate_manufacturing_publish\(\)[\s\S]*?END \$\$;/u.exec(
      await migrationSql('0036_manufacturing_master_data.sql'),
    )?.[0];
    if (!legacy) throw new Error('0036 publish guard definition not found');
    await db.transaction(async (tx) => {
      await tx.query(legacy.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'));
    });
    expect(await attempt(legacyPublishSql, [id(mixed), company])).toBeNull();
    await db.transaction(async (tx) => {
      await tx.query(await migrationSql(GUARD_0079));
    });
    expect(await attempt(legacyPublishSql, [id(mixed), company])).toMatchObject({
      code: 'P0001',
      message: TRIGGER_MESSAGE,
    });
  });

  it('re-applies 0079 twice inside one transaction as a no-op; publish guards still fire on UPDATE only', async () => {
    const { db } = state();
    const file = await migrationSql(GUARD_0079);
    const definition = async () =>
      (
        await db.query<{ definition: string }>(
          'SELECT pg_get_functiondef($1::regproc) definition',
          ['validate_manufacturing_publish'],
        )
      ).rows[0]?.definition;
    const before = await definition();
    await db.transaction(async (tx) => {
      await tx.query(file);
      await tx.query(file);
    });
    expect(await definition()).toBe(before);
    for (const table of [
      'manufacturing_item_versions',
      'manufacturing_bom_versions',
      'manufacturing_routing_versions',
    ]) {
      const definitions = (
        await db.query<{ definition: string }>(
          'SELECT pg_get_triggerdef(t.oid) definition FROM pg_trigger t WHERE t.tgrelid=$1::regclass AND NOT t.tgisinternal ORDER BY t.tgname',
          [table],
        )
      ).rows.map((row) => row.definition);
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatch(
        /^CREATE TRIGGER manufacturing_\w+_publish_guard BEFORE UPDATE ON /u,
      );
    }
  });

  it('creates and publishes over real HTTP, returning a named 409 with no residues for draft components', async () => {
    const fixture = state();
    const http = await ownedHttpApi(fixture);
    try {
      const user = await http.user(fixture.employee, fixture.company);
      await user.grant(['bom:manage', 'bom:read'], ['COMPANY']);
      const snapshot = async () =>
        (
          await fixture.db.query<{
            roots: number;
            versions: number;
            lines: number;
            substitutes: number;
            audit: number;
            outbox: number;
          }>(
            `SELECT
              (SELECT count(*)::int FROM manufacturing_boms WHERE tenant_id=$1) roots,
              (SELECT count(*)::int FROM manufacturing_bom_versions WHERE tenant_id=$1) versions,
              (SELECT count(*)::int FROM manufacturing_bom_lines WHERE tenant_id=$1) lines,
              (SELECT count(*)::int FROM manufacturing_bom_substitutes WHERE tenant_id=$1) substitutes,
              (SELECT count(*)::int FROM audit_events WHERE organization_id=$1) audit,
              (SELECT count(*)::int FROM domain_event_outbox WHERE tenant_id=$1) outbox`,
            [fixture.company],
          )
        ).rows[0];
      const input = {
        code: 'BM-HTTP-PUBLISH-BLOCKED',
        name: '创建即发布',
        productItemId: id(parts.product, 'itemId'),
        productItemVersionId: id(parts.product),
        outputQuantity: '1',
        effectiveAt: date,
        lines: [line(parts.raw, [parts.alternate]), line(parts.draft)],
        publish: true,
      };
      const before = await snapshot();
      const blocked = await user.request('/api/v1/manufacturing-boms', 'POST', input);
      expect(await snapshot()).toEqual(before);
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toMatchObject({
        error: { code: 'conflict', message: RELEASE_MESSAGE },
      });
      const accepted = await user.request('/api/v1/manufacturing-boms', 'POST', {
        ...input,
        code: 'BM-HTTP-PUBLISH-OK',
        lines: [line(parts.raw, [parts.alternate]), line(parts.alternate)],
      });
      expect(accepted.status).toBe(201);
      const result = (await accepted.json()) as JsonObject;
      expect(result).toMatchObject({ code: 'BM-HTTP-PUBLISH-OK', status: 'PUBLISHED' });
      expect(await statusOf(result)).toBe('PUBLISHED');
      if (!before) throw new Error('Initial manufacturing snapshot missing');
      expect(await snapshot()).toEqual({
        roots: before.roots + 1,
        versions: before.versions + 1,
        lines: before.lines + 2,
        substitutes: before.substitutes + 1,
        audit: before.audit + 1,
        outbox: before.outbox + 1,
      });
    } finally {
      await http.close();
    }
  }, 30_000);

  it('turns the rejection into a 409 carrying the same message on both HTTP tracks', async () => {
    const correlationId = randomUUID();
    const bridge = await publishOverBridge(mixed, correlationId);
    expect(bridge?.statusCode).toBe(409);
    expect(bridge?.body).toEqual({
      error: { code: 'conflict', message: RELEASE_MESSAGE, correlationId },
    });
    // 旧轨：handler 以同一个 conflict 拒绝（旧分发层把 conflict 映射为 409）。
    await expect(publishOverLegacy(mixed)).rejects.toMatchObject({
      code: 'conflict',
      message: RELEASE_MESSAGE,
    });
    expect(await statusOf(mixed)).toBe('DRAFT');
    // 成功那条轨不受影响：组件全部已发布的草稿照常 201。
    const published = await bomOf(repository, state(), parts)('BM-BRIDGE-OK', [line(parts.raw)]);
    const created = await publishOverBridge(published, randomUUID());
    expect(created?.statusCode).toBe(201);
    expect(await statusOf(published)).toBe('PUBLISHED');
  });
});
