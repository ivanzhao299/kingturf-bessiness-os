# Wave2 迁移执行指引（workflow dispatch）— 更新于 2026-11-19

> 原「一次性 SSH 操作员命令单」已被 **`apply-migrations.yml` workflow** 取代（TD-REL-005 本次实施）；
> 人工序列仍保留在 [wave2-migration-runbook-2026-11-18.md](wave2-migration-runbook-2026-11-18.md) 作参考备选。

## Dispatch 步骤（项目所有者在 GitHub）

1. 仓库 `ivanzhao299/kingturf-bessiness-os` → Actions → **Apply KingTurf Production Migrations** → Run workflow（branch: main）。
2. 输入两字段：
   - `commit_sha` = `f742143c3bdf227d231f566d61c96f3df89df6fc`（Wave2 候选，已与迁移批准/镜像 44337781449 绑定）
   - `approved_suffixes` = `0073_credential_must_change.sql,0074_tenant_settings.sql`
3. `production` 环境审批通过后执行：validate（SHA/后缀/候选树校验）→ apply（主机上五门证据机器实测 → orchestrator check-evidence/execute/postcheck）。
4. 每个 `environment: production` 的 dispatch 都会占用 `kingturf-erp-production` 并发锁（与 recover 互斥）。

## 成功判据（run 日志逐行 JSON，最后一步）

```
{"step": "done", ...}
```

以及 `postcheck` 行含 `"classification": "FULLY_MATCHED"` 与 `"final_count": 74`；artifact `migration-evidence`（90 天）含 `migration-log.jsonl` 全文。

## 失败语义

任一步输出 `"status": "FAIL"` 即中止保现场（orchestrator 语义：不注册失败迁移）；API 停止/fence enabled 状态保持。恢复 = runbook §1 前置 dump；处置联系主协调。

## 完成后

不要手工启动 API。回报主协调 → dispatch release-images/recover（$WAVE2_SHA 已固化）→ 新镜像 up 时 API 恢复、fence 置 disabled、must-change 门生效、主机 image_compatibility 自动推进。
