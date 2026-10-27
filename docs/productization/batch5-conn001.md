# TD-CONN-001 复现与设计

状态：**隔离 PG 稳定复现，P2 程序缺陷候选，未修复**。

`business_document_connectors` 的 version 初始为 1。`configureConnector` 当前 SQL 使用 `INSERT ... SELECT ... WHERE expectedVersion=0 ON CONFLICT ... WHERE version=expectedVersion`。首次 expectedVersion=0 可以插入；已有 connector 使用 expectedVersion=1 时 SELECT 条件不成立，ON CONFLICT 分支永远不会执行，方法返回 stale conflict。该结果在隔离 PG 中重复得到，属于 SQL 控制流错误，不是 HTTP、网络或连接泄漏。

最小候选：使用普通 `INSERT ... VALUES`，把 expectedVersion 条件只保留在 `ON CONFLICT DO UPDATE ... WHERE version=expectedVersion`。保留租户唯一键、CAS stale 拒绝、状态/secret 校验、事务、audit/outbox 原子性。

待验证矩阵：0→1→2 正常更新；旧版本拒绝；同一 expectedVersion 并发仅一成功；跨租户/角色拒绝；审计和 outbox 只记录成功；失败后连接、事务和配置均释放。本批不修改连接超时或生产配置。
