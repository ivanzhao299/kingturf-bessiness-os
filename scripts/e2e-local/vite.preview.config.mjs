// 本地真浏览器 e2e 的预览配置：与 apps/web/vite.config.ts 的 preview 段同款（/api /health /ready
// /version 代理到同容器内的 API），仅把端口改为可配置，并从本脚本位置推出 web 根目录。
// 与仓库配置的差别只有两处：端口不写死为 4173；浏览器只从容器内回环访问，不需要放开 Host 校验。
import { fileURLToPath } from 'node:url';

const integer = (value, name) => {
  if (!/^\d+$/u.test(value)) throw new Error(`${name} must be an integer`);
  return Number(value);
};

const apiPort = integer(process.env.E2E_LOCAL_API_PORT ?? '3938', 'E2E_LOCAL_API_PORT');
const webPort = integer(process.env.E2E_LOCAL_WEB_PORT ?? '4198', 'E2E_LOCAL_WEB_PORT');
const target = `http://127.0.0.1:${apiPort}`;
const proxy = Object.fromEntries(
  ['/api', '/health', '/ready', '/version'].map((path) => [path, { target, changeOrigin: true }]),
);

export default {
  root: fileURLToPath(new URL('../../apps/web/', import.meta.url)),
  preview: { host: '127.0.0.1', port: webPort, strictPort: true, proxy },
};
