# Phase 12C — 生产发布兼容预检整改与受控迁移编排（本地整改记录）

状态：本地整改完成待独立评审（2026-11-05）；生产部署维持 BLOCKED。
基线：main `82dc6837c1b005423acae934320b5e9cce331d96`；分支 `codex/kt-v1-phase12c-release-remediation`。

## 修复的缺陷（Phase 12A/12B 取证结论）

失败部署 run `41915661655` 在只读预检处 fail-closed：`production_preflight.py` 要求生产登记与候选清单**全等**，把合法的「0001–0070 已应用 + 0071/0072 待应用连续前缀」误判为不兼容。

## 1. 预检严格连续前缀分类（scripts/production_preflight.py）

- 登记改以行数组读取（可检出重复行）；新增 `classify_registry(rows, expected)`：
  - 合法且 checksum 全配 → `MATCHED_PREFIX_PENDING`（附待应用清单）或 `FULLY_MATCHED`；
  - fail-closed 类别：`HISTORICAL_CHECKSUM_DRIFT` / `MIGRATION_HISTORY_GAP` / `UNKNOWN_EXTRA_MIGRATION` / `DUPLICATE_MIGRATION` / `INVALID_REGISTRY` / `INVALID_MIGRATION_ORDER`（候选清单自身乱序同样拒绝）。
- 新增 `--require-full` 模式供迁移后使用（非 FULLY_MATCHED 即拒绝）。
- 原有存储目录、磁盘、容器身份、健康、Nginx、版本标记检查全部保留；不硬编码 70。

## 2. 受控迁移编排（scripts/release_orchestrator.py，新增）

单文件、仅标准库；复用 preflight 的分类器保证单一事实源。子命令：`plan` / `registry` / `execute` / `postcheck`。

- **门禁顺序**（每项都消费主机端 `.release-migration-evidence/` 下的 JSON 证据，缺失/失效即 STOPPED）：
  release_approval（SHA+批准后缀+维护窗口）→ write_fence → task_drain → backup_restore（数据库+附件+配置+恢复演练+RPO/RTO 联合证据）→ image_compatibility（候选镜像 digest + 旧应用兼容新 schema 验证）→ data_preconditions（停写后重跑三项 Phase 12B 审计且必须为 0）。
- **执行内核**：单会话 `pg_advisory_lock` 单飞；锁内重读登记并核对与计划一致（`REGISTRY_CHANGED_UNDER_LOCK` 拒绝）；逐文件「BEGIN + lock_timeout=2s + statement_timeout=300s + idle_in_transaction_session_timeout=300s + 迁移 SQL + 登记 INSERT + COMMIT」单事务（与迁移器 `tx.query(file.sql)+INSERT` 等价，隔离演练已做逐行登记等价比对）；应用后逐条核对登记；最终 `FULLY_MATCHED` postcheck。
- **失败即停**：任何失败写 `orchestration-state.json`（STOPPED + 阶段 + 原因 + 停止时登记快照）；STOPPED 后拒绝无 `--new-approval`（且必须与已消耗审批哈希不同）的重跑；COMPLETED 后拒绝重复执行。无任何自动重试。
- 会话经 `psql` 或 `--psql-argv-file`（生产走 `docker compose exec -T postgres psql`，无 5432 发布端口）。语句强制分号终结（标记协议加固）。

## 3. 写入隔离 fence（apps/api/src/middleware/write-fence.ts，新增）

- `KINGTURF_WRITE_FENCE=enabled` 时所有非安全方法（GET/HEAD/OPTIONS 除外，`/health|/ready|/version` 始终放行）返回 503 + `x-kingturf-write-fence: active`；compose.production 增加该变量（默认 disabled，行为不变）。
- 背景任务面核查：API 无常驻 cron/outbox 消费进程（outbox 为请求事务内写入），排空语义 = fence 生效 + 在途请求完成 + 静默观察，由编排器 write_fence/task_drain 证据承载；外部直连数据库写入通道未知 → 登记 RELEASE_CONDITIONS_OPEN。

## 4. 部署工作流（.github/workflows/deploy-production.yml）

- rsync 追加排除 `.release-migration-evidence/`、`.release-migration-state/`。
- 新增「Controlled migration」阶段（rsync 与容器切换之间）：先核对主机同步版控制脚本与 release-control 哈希一致，再 registry→plan→execute→postcheck，并与 runner 侧候选清单全等核对；任何证据缺失在触碰容器前 fail-closed。
- 「Deploy and verify」去除 `up -d --build` 失败后的**自动二次执行**（保留 ps 诊断后退出）。
- 生产 API 从不自动迁移（`server.ts` 生产路径 `assertMigrationsCurrent` 仅校验）；迁移只经编排器显式阶段。

## 5. 测试（tests/operations + packages/database + apps/api）

- `production_preflight_test.py`：19 项（原 10 项适配 + 前缀/全配/门类拒绝/`--require-full`）。
- `release_orchestrator_test.py`：17 项（门禁拒绝矩阵、部分失败状态、拒绝无新审批重跑、COMPLETED 拒重复、并发锁、锁内漂移）。
- `release_migration_drill_test.py`（真实 PG，跳过条件明确登记）：70→72 全链路 + 与 node 迁移器逐行等价、分类矩阵、0071 成功/0072 破坏、连接中断、锁超时、缺证据不触库、负库存/超退/孤立退料被迁移断言拒绝。
- `packages/database/test/startup-gate.integration.test.ts`：70/72 前缀报 pending 且生产启动拒绝；72/72 全 applied 且放行。
- `apps/api/test/write-fence.test.ts`：6 项 fence 行为。

## 6. 开放条件（不满足则生产迁移门禁不放行）

1. 联合备份恢复演练（JOINT_BACKUP_RESTORE=NO_GO：现流程仅 pg_dump，附件/配置/恢复演练证据链缺失）。
2. 候选镜像以不可变 digest 部署（现 compose 现场构建）。
3. 旧应用（上一个生产镜像）对新 schema 的兼容验证。
4. 生产 write-fence 操作规程演练（机制已实现并测试，操作流程未在生产演练）。
5. 独立生产发布窗口授权。

Phase 12A 只读登记证据、Phase 12B 数据前提证据不受本阶段影响；证据目录见 `/home/jinhuit/Kingturf/batch9-production-deployment-evidence/phase12c-release-remediation/`。
