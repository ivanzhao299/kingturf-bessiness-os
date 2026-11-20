import { afterEach, describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/server-fastify.js';

// ADR-0015 首个 API 批：Fastify+Zod 挂载验证（探索性并行入口，不经生产 server.ts 装配）。
// 覆盖三探针端点（/health、/ready、/version，zod 响应 schema）与演示端点
// POST /api/v1/fastify-demo 的入站正/负例（缺字段/类型错 → 400）。
const instances: { close: () => Promise<void> }[] = [];

function app() {
  const instance = buildFastifyApp();
  instances.push(instance);
  return instance;
}

afterEach(async () => {
  for (const instance of instances.splice(0)) {
    await instance.close();
  }
});

describe('fastify demo server probes', () => {
  it('GET /health returns a schema-validated ok body', async () => {
    const response = await app().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toEqual({ status: 'ok' });
  });

  it('GET /ready returns a schema-validated readiness body', async () => {
    const response = await app().inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ ready: boolean }>()).toEqual({ ready: true });
  });

  it('GET /version returns a schema-validated version body', async () => {
    const response = await app().inject({ method: 'GET', url: '/version' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ version: string }>();
    expect(typeof body.version).toBe('string');
  });
});

describe('POST /api/v1/fastify-demo zod validation', () => {
  it('accepts a valid payload and returns the schema-validated echo', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/v1/fastify-demo',
      payload: { name: 'kingturf', count: 21 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ name: string; count: number; doubled: number }>()).toEqual({
      name: 'kingturf',
      count: 21,
      doubled: 42,
    });
  });

  it('rejects a payload missing count with 400', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/v1/fastify-demo',
      payload: { name: 'kingturf' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects a payload with the wrong count type with 400', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/v1/fastify-demo',
      payload: { name: 'kingturf', count: '21' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects a payload with the wrong name type with 400', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/v1/fastify-demo',
      payload: { name: 42, count: 21 },
    });
    expect(response.statusCode).toBe(400);
  });
});
