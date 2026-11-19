import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
  const env = loadEnv(mode, repositoryRoot, ['KINGTURF_API_PROXY_TARGET', 'WEB_PORT']);
  const target = new URL(env.KINGTURF_API_PROXY_TARGET ?? 'http://127.0.0.1:3000');
  if (
    target.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  )
    throw new Error('Development API proxy requires a loopback HTTP origin without credentials');
  const webPort = Number(env.WEB_PORT ?? '5173');
  if (!Number.isSafeInteger(webPort) || webPort < 1 || webPort > 65535)
    throw new Error('WEB_PORT must be a valid TCP port');
  const proxy = Object.fromEntries(
    ['/api', '/health', '/ready', '/version'].map((path) => [
      path,
      { target: target.origin, changeOrigin: true },
    ]),
  );
  return {
    build: {
      manifest: true,
      // UI-M2：登录入口无动态子 chunk（工作台整块懒载），modulePreload polyfill 为死重；
      // 关闭以对冲全图模块 id 布局噪声（预算阈值不调，见提交说明）。
      modulePreload: { polyfill: false },
    },
    server: { host: '127.0.0.1', port: webPort, proxy },
    preview: { host: '127.0.0.1', port: 4173, proxy },
  };
});
