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
      // 裁定15（2026-11-20）：动态 CSS 注入在多 chunk 场景不可靠（__vitePreload 的
      // CSS 分支在真实登录流中被跳过，bootstrap CSS 从未被请求——生产纯文本列表
      // 的根因）。cssCodeSplit: false 将全部 CSS 合并为单一文件，经 index.html
      // 静态 <link> 加载，永久消灭此类问题。登录页多载 ~18KB gzip（可接受）。
      cssCodeSplit: false,
      modulePreload: { polyfill: false },
    },
    server: { host: '127.0.0.1', port: webPort, proxy },
    preview: { host: '127.0.0.1', port: 4173, proxy },
  };
});
