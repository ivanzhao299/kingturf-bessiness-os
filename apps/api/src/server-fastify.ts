// ADR-0015 首个 API 批（F1）：Fastify+Zod 挂载验证的探索性并行入口。
// 不被生产 server.ts/app.ts 装配引用；仅证明 fastify + @fastify/type-provider-zod
// 依赖链与 zod 入站/出站 schema 校验在本仓库可用，为后续分域迁移铺路。
// 本文件不 import 任何现有业务模块（纯增量，行为守恒）。
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { z } from 'zod';

const apiVersion = '0.0.0';

const healthResponseSchema = z.object({ status: z.literal('ok') });
const readyResponseSchema = z.object({ ready: z.literal(true) });
const versionResponseSchema = z.object({ version: z.string() });
const demoBodySchema = z.object({
  name: z.string(),
  count: z.number(),
});
const demoResponseSchema = z.object({
  name: z.string(),
  count: z.number(),
  doubled: z.number(),
});

type DemoRequestBody = {
  name: string;
  count: number;
};

export function buildFastifyApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- serializerCompiler/validatorCompiler 的泛型签名在 strict 模式下退化为 any；本 demo 文件（ADR-0015）允许
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);

  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, () => ({
    status: 'ok' as const,
  }));

  app.get('/ready', { schema: { response: { 200: readyResponseSchema } } }, () => ({
    ready: true as const,
  }));

  app.get('/version', { schema: { response: { 200: versionResponseSchema } } }, () => ({
    version: apiVersion,
  }));

  app.post(
    '/api/v1/fastify-demo',
    {
      schema: {
        body: demoBodySchema,
        response: { 200: demoResponseSchema },
      },
    },
    (request) => {
      const body: DemoRequestBody = request.body;
      return {
        name: body.name,
        count: body.count,
        doubled: body.count * 2,
      };
    },
  );

  return app;
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildFastifyApp();
  const listen = app.listen.bind(app);
  await listen({ port, host: '127.0.0.1' });
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  void main();
}
