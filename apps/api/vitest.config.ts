import { defineConfig } from 'vitest/config';

// API 集成测试共享一次性 PostgreSQL schema，必须串行（原 CLI --maxWorkers=1 收敛于此，
// 由 scripts/analysis/structure-gate.test.mjs 之外的常规 test 脚本隐式继承）。
export default defineConfig({
  test: {
    maxWorkers: 1,
  },
});
