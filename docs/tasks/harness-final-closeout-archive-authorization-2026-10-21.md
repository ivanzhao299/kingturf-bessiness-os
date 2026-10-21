# Harness §14 收官归档授权（2026-10-21）

## 授权与边界

五阶段已由人工终验通过（协调记录 `fd90572`，源码基线 `9fd9144`）。本文件记录本次正式收官授权：按 `docs/HARNESS-RULES.md` §14 执行一次性施工图拆解、常驻契约迁移、移除前自检、`git mv` 归档和终态验证。

本轮只允许纯文档编辑与 `git mv`；业务源码、正式测试正文、workflow、依赖、产品配置和数据库均不得修改。失败史、开放决策、TD-TEST-020、TD-SEC-008、六项 P1 与通道限制必须保留为待决或常态维护事项，不得写成已关闭。

## 执行顺序

1. 依 §14.3 将七信条、存量适配、R1–R7、反模式、分层与品味不变量、会话/提交纪律、CI 非 Tauri 结论、度量指标、附录字段和术语拆解到常驻文档；每项写入归档件映射与差异记录。
2. 假设 `HARNESS-RULES.md` 不存在，仅用 AGENTS、core-beliefs、ARCHITECTURE、CI、GATES 和 QUALITY_SCORE 自检全部硬约束；任何否项先补迁移，不能带缺口归档。
3. 使用 `git mv docs/HARNESS-RULES.md docs/exec-plans/completed/harness-2026-10-21.md`，在归档件头尾写入终验、映射、差异、自检和母本回流记录；AGENTS 改为竣工后地图。
4. 同步 docs/index、tech-debt-tracker、QUALITY_SCORE、终验材料与 §7；格式和 doc-lint 通过。
5. 收官单独提交使用指定 Conventional Commit 标题并含 `[已测试]`；提交前后各运行完整 `pnpm ci:local`，退出码0且工作树干净。

## 收官后契约

施工期“不 push、不部署、不改 workflow”随本施工图归档解除；后续是否 push、合并或部署由用户另行决定。本轮收官提交前后仍不执行这些外部动作，不执行 §14 之外批次。
