import { defineConfig } from 'vitest/config';

// 数据库集成测试共享一次性 PostgreSQL 实例（CI service 容器），并行 worker 同时
// 全量迁移会耗尽实例级锁表（53200 out of shared memory），必须串行——与 apps/api
// 的既有约定一致。
export default defineConfig({
  test: {
    maxWorkers: 1,
  },
});
