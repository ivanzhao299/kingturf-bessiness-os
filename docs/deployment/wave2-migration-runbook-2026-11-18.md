# Wave2 迁移执行手册（72→74：0073 凭证首登改密 + 0074 租户设置）— 2026-11-18

> 执行主体：**项目所有者一次性 SSH 执行**（主协调无主机密钥）。完成后由主协调走
> `recover-application-images.yml` 应用发布（该入口永不跑迁移且要求 FULLY_MATCHED）。
> 依据：`scripts/release_orchestrator.py`（fail-closed、单飞、证据门禁迁移机，唯一已授权
> 的生产迁移执行器）；隔离演练证据见附录 A。

## 0. 前提与常量

- 主机：`47.236.122.224`，`PROD_DEPLOY_PATH=/data/kingturf-erp`；仓库检出 = Wave2 候选 SHA
  （主协调届时提供；下文 `$WAVE2_SHA` 占位）。
- 生产 PG 无发布端口：全部 SQL 经容器执行。从 `.env.production` 取 `POSTGRES_USER/POSTGRES_DB`
  （记为 `$PGU/$PGD`），容器名 `kingturf-erp-production-postgres-1`。
- 证据目录（固定名，orchestrator 依赖）：`/data/kingturf-erp/.release-migration-evidence`
  （已存在，含 45605d37 时代 image_compatibility.json——门禁只校验 digest 形态与
  old_app verified，现有文件继续满足）。
- 备份目录：`/data/kingturf-erp/.release-backups`。
- psql 会话文件（下文 `$PSQL_ARGV`）：
  ```bash
  cat > /tmp/psql-argv.json <<'EOF'
  ["docker","exec","-i","kingturf-erp-production-postgres-1","psql","-X","-qAt","-v","ON_ERROR_STOP=1","--no-psqlrc","-U","<PGU>","-d","<PGD>"]
  EOF
  # 将 <PGU>/<PGD> 替换为 .env.production 实际值后：
  python3 scripts/release_orchestrator.py registry ignored --psql-argv-file /tmp/psql-argv.json
  # ↑ 应输出 72 行迁移注册（JSON 数组）；此步同时验证会话可用
  ```

## 1. 前置 pg_dump 恢复点（在任何写动作之前）

```bash
cd /data/kingturf-erp
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker exec kingturf-erp-production-postgres-1 pg_dump --format=custom --username="$PGU" "$PGD" \
  > "/data/kingturf-erp-backups/wave2-pre-$TS.dump"
sha256sum "/data/kingturf-erp-backups/wave2-pre-$TS.dump" | tee "/data/kingturf-erp-backups/wave2-pre-$TS.dump.sha256"
```

失败中止时用该 dump 恢复（恢复演练在隔离容器先行——参考 §5 门禁要求）。

## 2. 计划（plan，只读）

```bash
cd <仓库检出>
python3 scripts/release_orchestrator.py registry ignored --psql-argv-file /tmp/psql-argv.json > /tmp/registry.json
python3 scripts/release_orchestrator.py plan packages/database/migrations "$WAVE2_SHA" /tmp/registry.json > /tmp/plan.json
cat /tmp/plan.json
```

预期：`classification=MATCHED_PREFIX_PENDING`、`pending=["0073_credential_must_change.sql","0074_tenant_settings.sql"]`。

## 3. 证据文件（五门 + 数据前置）

写入 `/data/kingturf-erp/.release-migration-evidence/`（`image_compatibility.json` 已存在无需改）。
时间戳全部 UTC（Z 结尾）；`$WAVE2_SHA` 替换实际值。

1. **写栅栏 + 受控停 API**（先启 fence、观察无新写入，再停 API）：
   ```bash
   # .env.production 设置 KINGTURF_WRITE_FENCE=enabled 后重启 API（或经 API 支持的配置通道）；
   # 确认 /health 与写请求被 503 拒绝，记录观察时间 $T_FENCE/$T_OBS：
   cat > .release-migration-evidence/write_fence.json <<EOF
   {"method":"controlled_old_api_shutdown","enabled_at_utc":"$T_FENCE","observed_no_new_writes_utc":"$T_OBS","api_release_sha":"01ef0e1fd34c724b21cfd470a41161687020ec5c","in_flight_settled":true,"api_service_state":"stopped","stopped_at_utc":"$T_STOP"}
   EOF
   docker compose --project-directory /data/kingturf-erp --env-file .env.production \
     -f infra/docker/compose.production.yaml stop -t 30 api   # API 停止后 fence 状态持续成立
   ```
2. **任务排空**（事件 outbox/交付队列为空后）：
   ```bash
   cat > .release-migration-evidence/task_drain.json <<EOF
   {"background_queues_drained":true,"external_write_channels_isolated":true,"drained_at_utc":"$T_DRAIN"}
   EOF
   ```
3. **联合备份与还原演练**（fence 之后采集；sha256 为 64 位小写 hex；路径相对 `.release-backups`）：
   ```bash
   TS2=$(date -u +%Y%m%dT%H%M%SZ)
   docker exec kingturf-erp-production-postgres-1 pg_dump --format=custom --username="$PGU" "$PGD" > .release-backups/wave2-$TS2.dump
   tar -C /data/kingturf-erp-data -czf .release-backups/attachments-$TS2.tar.gz attachments
   DUMP_SHA=$(sha256sum .release-backups/wave2-$TS2.dump | cut -d' ' -f1)
   ATT_SHA=$(sha256sum .release-backups/attachments-$TS2.tar.gz | cut -d' ' -f1)
   # 还原演练：隔离无网络 tmpfs 容器 pg_restore 全量成功（同 Wave1 backup() 模式），记录 $T_CAP：
   cat > .release-migration-evidence/backup_restore.json <<EOF
   {"database_dump":{"file":"wave2-$TS2.dump","sha256":"$DUMP_SHA","captured_at_utc":"$T_CAP"},"attachments_archive":{"file":"attachments-$TS2.tar.gz","sha256":"$ATT_SHA","captured_at_utc":"$T_CAP"},"config_material":"AVAILABLE","restore_rehearsal":"PASS","rehearsal_report":"wave2-$TS2-restore.md","rpo_statement":"RPO=0 (fence后联合备份)","rto_statement":"RTO<1h (隔离演练实测)"}
   EOF
   ```
4. **数据前置检查**（三条均为 0 行后；SQL 见 `release_orchestrator.py DATA_PRECONDITION_SQL`，
   对 inventory 负余额/超领退/孤儿退回三态）：
   ```bash
   cat > .release-migration-evidence/data_preconditions.json <<EOF
   {"negative_balance_groups":0,"over_return_groups":0,"orphan_return_movements":0,"checked_at_utc":"$T_CHECK"}
   EOF
   ```
5. **发布批准**（批准后缀精确等于 plan.pending；窗口 ≤12h 且覆盖执行时刻）：
   ```bash
   cat > .release-migration-evidence/release_approval.json <<EOF
   {"release_sha":"$WAVE2_SHA","approved_suffix":["0073_credential_must_change.sql","0074_tenant_settings.sql"],"approved_at_utc":"$T_APPR","window_end_utc":"$T_WIN","approver":"<所有者署名>"}
   EOF
   ```

## 4. 门禁预检与执行

```bash
python3 scripts/release_orchestrator.py check-evidence /tmp/plan.json /data/kingturf-erp/.release-migration-evidence
# 预期 {"check_evidence":"PASS","pending":[...0073..., ...0074...]}

python3 scripts/release_orchestrator.py execute /tmp/plan.json /data/kingturf-erp/.release-migration-evidence \
  packages/database/migrations /data/kingturf-erp/.release-migration-state \
  ignored --psql-argv-file /tmp/psql-argv.json
# 预期 {"verdict":"COMPLETED"}；状态文件 .release-migration-state/orchestration-state.json 全 PASS

python3 scripts/release_orchestrator.py postcheck /tmp/plan.json ignored --psql-argv-file /tmp/psql-argv.json
# 预期 {"postcheck":"PASS","classification":"FULLY_MATCHED"}（74 项）
```

**失败语义**：任一阶段 StopError → 无注册写入（失败迁移不登记）、现场保留、以 §1 dump 恢复，
并通知主协调；orchestrator 无自动重试。

## 5. 完成后

- 不手工启动 API：通知主协调 → dispatch `release-images`（$WAVE2_SHA）→ `recover-application-images`
  （四输入；此时 verify/apply 两侧 manifest 均为 74，FULLY_MATCHED 成立）。发布自身会以新镜像
  `up -d api web`，API 随之恢复且 `must_change_password` 门生效。
- 发布成功后 `advance_image_evidence` 将主机 `image_compatibility.json` 推进到 $WAVE2_SHA
  （TD-REL-004 修复随本批生效）。

## 6. 回滚要点（迁移后、应用发布前）

- 迁移为纯加性（列/表），旧应用（01ef0e1）对新 schema 的启动元数据校验会 fail-closed
  （unknown 迁移）——应用侧不回滚到 01ef0e1 之前的旧镜像即无此问题：01ef0e1 镜像本身按
  72 校验，遇 74 schema 会拒启。故迁移执行后的唯一前进路径是发布 Wave2 应用；
  数据层回退 = §1 dump 恢复（不自动反向迁移，现行契约禁止）。
- 若迁移成功但发布失败：保持 API 停止或以 01ef0e1 镜像带 `KINGTURF_WRITE_FENCE=enabled`
  只读恢复（该镜像对 74 schema 拒启，故实际为停服等待发布修复），主协调重试发布即可。

---

## 附录 A：隔离演练证据（2026-11-18，本仓库开发机）

- 环境：`kingturf-business-os-postgres-1`（本地开发 PG17 容器）；一次性脚本
  `/tmp/wave2_drill.py`（复用 `tests/operations/release_migration_drill_test.py` 基建：
  会话/证据写入/参考迁移器）。
- 步骤与实测输出（`/tmp/wave2-drill-evidence.log`）：
  ```
  [drill] step1 baseline-72 OK (last=0072_production_return_guards.sql)      ← 参考迁移器(仓库 migrator)建 72 基线
  [drill] step2 plan OK classification=MATCHED_PREFIX_PENDING pending=['0073_credential_must_change.sql','0074_tenant_settings.sql']
  [drill] step3 evidence written (5 gates + data_preconditions)
  [drill] step4 execute verdict=COMPLETED applied=['0073_credential_must_change.sql','0074_tenant_settings.sql']
  [drill] step5 postcheck FULLY_MATCHED count=74 last=0074_tenant_settings.sql
  [drill] step6 schema checks: must_change_password column + 2 tenant tables present
  [drill] cleanup done — REHEARSAL PASS
  ```
- 结论：orchestrator 对 72→74 增量路径（plan 前缀分类→五门+数据前置→单飞执行→postcheck
  FULLY_MATCHED）在本机干净库完整走通；0073/0074 均为纯加性且可重复注册语义与仓库 migrator
  一致（checksum 同源 sha256）。生产差异点（真实数据量、docker compose exec 会话）由 §0
  会话预检与 §3 门禁覆盖。
- 另：`tests/operations/release_migration_drill_test.py`（CI 常驻）已覆盖全量 74 经
  orchestrator == 参考迁移器逐字一致 + 破坏 0072 中止不注册等负例。
