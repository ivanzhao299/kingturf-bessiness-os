# Batch6 验证证据

- 候选 SHA：见父目录 `batch6-delivery-2026-10-27.md` 所在提交。
- 专项 PG：`production-postgres.integration.test.ts` 与 `foundation-postgres.integration.test.ts` 共 18/18；数据库为隔离 PostgreSQL 17.7，未使用生产数据库。
- 完整 CI：`pnpm ci:local` 通过；API 17,730、Web 436，覆盖率结果无 deficit。
- 浏览器：`browser-round-1-safe.json`、`browser-round-2-safe.json`，同一 SHA/配置各 11/11。
- 安全接线：Batch5 的 commission、foundation、sec010 HTTP/PG 测试被 API Vitest 全量发现，并由 `test:coverage` 和 `ci:local` 执行。

原始运行日志保存在受控临时目录，不入库；safe JSON 只包含测试标题、状态、耗时和固定 SHA，不包含凭据、连接串或业务个人数据。
