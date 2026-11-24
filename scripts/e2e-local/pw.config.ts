// 本地真浏览器 e2e 的 Playwright 包装配置（TD-TEST-023）：沿用仓库 playwright.config.ts，仅
// ① 改用 Playwright 自带 Chromium（官方镜像内没有 Google Chrome）；② 测试目录按本文件位置解析；
// ③ 产物目录指向仓库之外（trace.zip 含合成账号口令的明文，不得入库）。
// 超时、重试、worker 数等一律与仓库原配置一致。
// 注意：仓库是 CommonJS 包，Playwright 把本文件转成 CJS 加载，不能用 import.meta；相对路径以本文件
// 所在目录为基准。
import base from '../../playwright.config';

export default {
  ...base,
  testDir: '../../tests/e2e',
  outputDir: process.env.E2E_LOCAL_RESULTS ?? '/tmp/kingturf-e2e-local/results',
  reporter: [['list']] as never,
  use: {
    ...base.use,
    channel: undefined,
    baseURL: process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:4198',
  },
};
