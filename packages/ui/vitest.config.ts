import { defineConfig } from 'vitest/config';

// 零依赖测试 DOM：test/setup.ts 在每份测试文件前安装自研 mini-DOM（ADR-0014/U1）。
export default defineConfig({
  test: { environment: 'node', setupFiles: ['test/setup.ts'] },
});
