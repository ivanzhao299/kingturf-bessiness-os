# KingTurf production — Singapore runbook

> **D1 已上线（2026-11-20）**：**常规发布唯一入口 = `release.yml`**（单输入 commit_sha；validate→build→verify→deploy 单锁内联条件迁移→post；首跑 44609703668 零迁移路径已验证，迁移路径待首个含迁移发布验证后关闭——TD-REL-008）。应用级回滚入口 = `release-rollback.yml`（单输入历史已发布 SHA；首验另批）。**旧通道 `recover-application-images.yml` / `apply-migrations.yml` / `release-images.yml` 降级为应急/维护用途**（人工缝合输入仅应急时按 runbook 使用；退役待 D1 连续 N 次稳定另议）。安全契约（production 审批/并发组/known_hosts/字节校验/恢复点/fail-closed）在新旧入口中完全一致。首跑证据见 [ui-console-deployment-2026-11-20](../evidence/ui-console-deployment-2026-11-20.md) §8。

## 当前应用发布契约（2026-11-17）

74 项迁移已经完成（Wave2 对齐）。自 D1 上线（2026-11-20）起生产应用发布常规入口为 `release.yml`；以下「`recover-application-images.yml` 为唯一入口」的描述降级为应急通道历史。旧 `deploy-production.yml` 文件已于 A-F1（2026-11-19）删除，其历史见 git 记录。新迁移执行、历史改写和生产数据恢复必须另行授权及设计。以下迁移时代流程描述保留为历史，不能据此重执行迁移。

新入口输入精确main历史候选SHA、原批准API/Web根digest及成功的release-images run ID。控制脚本来自workflow自身固定SHA，独立于旧应用候选；候选完整ci:local、发布run来源、当前tag原始摘要必须全等。主机`image_compatibility.json`按候选分派：同候选重跑须双digest逐字全等并保留既有schema兼容证据；新候选在注册表FULLY_MATCHED且授权冒烟PASS（runner隔离启动已过，workflow冒烟步骤成功后才写授权）时放行。每次成功发布在DEPLOYED之后以0600原子推进该证据文件（`images_built_at`=发布SHA、digest取自identities、`old_app_on_new_schema`记runner隔离冒烟的run ID与bundle sha256），后续发布证据自动滚动。此次授权来源及进度见[执行任务](../tasks/ghcr-transport-recovery-2026-11-17.md)。

GHCR仍为制品真源。Runner使用固定Skopeo镜像，以 `--all --preserve-digests` 导出原OCI索引、平台manifest、config及全部layers；逐descriptor验证sha256/size，tar总哈希绑定传输。生产仅在拉取时启动 `127.0.0.1:15432` 只读registry，不存GHCR凭据、不改Docker信任或共享Nginx。目标按原根digest拉取，单平台export核原始config字节，核RootFS diff IDs及实际运行容器的镜像引用和平台manifest。Docker29 containerd的image ID可为index/manifest摘要，不能按经典存储的config ID语义处理。

持久 `.env.production` 记录固定loopback镜像仓库名及原根digest；compose使用 `--pull never`。registry在导入完成即停止，正常容器重启不依赖registry。重建或回退须先对保留的 `.release-image-recovery/<run>-<attempt>/` bundle再次验证/导入；不得普通compose拉取一个已经停止的临时registry。严禁清理这些bundle、原恢复镜像或历史迁移状态。

镜像传输、导入、72-schema隔离启动和全部可行预检均先于停服。随后先保存真实旧容器完整配置（仅主机0600），停API并排空，再采数据库/附件/配置联合备份，并在独立、无网络、tmpfs PostgreSQL容器还原核72登记。随后一次应用切换，API/Web仅用现存镜像、`--no-deps --pull never`，不更新PG、不调用迁移执行器。名称/checksum/原applied_at与迁移状态文件hash必须始终不变。

停API之后任一步失败自动尝试**仅应用恢复**：从主机私有快照还原环境配置，以原准确image ID重新启动API/Web，核健康、版本与迁移不变；不恢复生产数据。状态记于bundle内 `application-state.json`。若状态为 `RECOVERY_FAILED`，保留全部现场，主协调必须先读真实状态/错误并恢复服务再继续。不得抹状态冒充成功。成功时全部内外health/ready/version及运行字节身份通过后才原子更新marker。

The sole production entry is `https://erp.kingturf.cn`. The Singapore host is `47.236.122.224`, shared with Phoenix ERP and the independent KingTurf website. This file retains its historical filename for existing links; its authority is the current deployment below:

- separate `PROD_DEPLOY_PATH=/data/kingturf-erp`;
- separate Compose project `kingturf-erp-production`;
- PostgreSQL at `/data/kingturf-erp-data/postgres` via `KINGTURF_POSTGRES_DATA_PATH`;
- attachments at `/data/kingturf-erp-data/attachments` via `KINGTURF_ATTACHMENT_DATA_PATH`;
- separate web port (default `4332`);
- separate reverse-proxy virtual host for `erp.kingturf.cn`.

The ext4 data disk is mounted at `/data`; backups belong to `/data/kingturf-erp-backups`. Never fall back to the system disk silently if the mount is unavailable. Verify `findmnt /data` and bind mounts before deployment. The website uses its own `kingturf-site` container and port `3500`. Do not share directories, containers, volumes, ports or secrets between these projects.

The GitHub `production` environment must contain `PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`, and `PROD_DEPLOY_PATH`. The remote `.env.production` is created and retained by operations; it is never overwritten by rsync.

Within the API container, persistent attachments are available at `/var/lib/kingturf/attachments`. They must be included in the backup policy and never removed by deployment or rollback. The host reverse proxy routes `erp.kingturf.cn` to port `4332`. Releases must use `.github/workflows/deploy-production.yml` with an exact main SHA; manual file uploads are not a release path.

## Release input and control policy

Dispatch the workflow from `main` in `ivanzhao299/kingturf-bessiness-os`. The only accepted input is an exact lowercase 40-character commit SHA in the freshly fetched canonical `origin/main` history. Branch names, tag names, abbreviated SHAs, annotated tag object SHAs, missing commits and unmerged branch commits are rejected. A tagged main commit is accepted by its underlying commit SHA. There is no separate release-branch or tag-ref publishing policy.

The validator checks the canonical origin URL, exact control checkout, commit object types and ancestry before verification. It pins the workflow's own commit as the release control version; verification and deployment both check out and assert the same validated application SHA. After the production concurrency slot is acquired, the control checkout fetches main and revalidates both application and control commits before loading the SSH key. Network or validation failures deny deployment.

Historical main commits remain eligible for application rollback using the same workflow. Use the current main workflow with the old application SHA; do not dispatch an old workflow branch. The cleanup control comes from the pinned workflow commit and is streamed over SSH, so an old application's cleanup script is not executed and no predictable temporary cleanup script is staged on the shared host. Historical SHA eligibility does not prove compatibility with the current database schema: verify that compatibility, the existing backup, migration state and rollback plan before releasing. Do not restore or reverse production migrations automatically.

Only the production `deploy` job uses concurrency group `kingturf-erp-production` with `cancel-in-progress: false`; ordinary CI and verification remain parallel. Any future workflow writing the same production target must use this exact group, without incorporating branch, workflow name or candidate SHA. GitHub's default concurrency has one pending slot; a newer pending request can replace an older pending request. This is mutual exclusion, not a durable queue for every dispatch. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Manual SSH, interrupted remote processes and out-of-band scripts are outside this scheduler's lock; operators must inspect running processes and runtime health before recovery.

These controls require a trusted workflow and protected main history. Enable main required reviews/status checks, forbid force push/deletion and restrict the production environment to main with independent approval. Workflow self-checks cannot prevent a sufficiently privileged user from modifying the workflow to bypass them. Batch 1 audits and recommends these GitHub settings; it does not apply them.

Run `pnpm test:release-guardrails` for local Git/input tests and shell replay with isolated command substitutes. These tests require Git, Bash, Python 3 and standard Linux utilities; the existing Ubuntu CI runner provides them. `pnpm lint` includes the release scripts and `pnpm test` includes these guardrail tests before workspace tests. This does not trigger a deployment or prove the hosted scheduler, SSH runtime or database rollback has been exercised.

Before every production synchronization, the deployment workflow creates a PostgreSQL custom-format recovery point under `.release-backups/` and records the previous and candidate release SHAs. The new recovery point and every older recovery point remain intact until the candidate passes local and public health, readiness, and exact-version checks. After those checks pass, the workflow preserves every existing dump, metadata pair and rollback image. Retirement requires separate authorization and accepted restore evidence. A failed deployment does not run cleanup, so it cannot erase the pre-deploy recovery point needed for investigation or recovery.

The recovery point is created and checked before synchronizing the configured website ingest secret. Backup failure prevents that configuration write. A later release failure can still leave the synchronized configuration or partially updated application in place; there is no automatic configuration or application rollback. Preserve recovery artifacts and inspect actual runtime state before an explicitly approved recovery.

`.release-sha` records the last release that passed the required local and public probes. It is atomically replaced only after a fresh exact JSON `/version` check. Compose failure, readiness failure or a required version/HTTPS probe failure preserves the previous marker and recovery dump. The marker does not prove the runtime remained unchanged after a partial update or interruption; always compare `/version`, container state and health. The recovery-material inventory runs after marker promotion. Its failure may coexist with a verified running candidate and must be investigated separately; it deletes no backups or images.

After a successful deployment, the workflow inventories the active KingTurf image IDs and preserves all images and recovery materials. It never prunes shared or project resources. Application rollback redeploys the selected immutable main-history SHA through the current workflow only after schema, startup and session-security compatibility are independently accepted. Old SHA eligibility alone does not make rollback safe; older startup code that runs DDL is blocked under the present application-only authorization. Attachment storage is never deleted or rewritten.

The deployment is successful only when the exact candidate SHA passes the verify job, the server-local health/readiness/version probes, and the public HTTPS health/readiness probes. A public probe failure blocks the workflow; it is not advisory evidence.

## Storage safeguards

Each of the three project containers uses JSON log rotation (`10m`, three files), approximately 30 MB per container plus rollover overhead. This affects diagnostic stdout/stderr only; business audit events and immutable document versions remain in PostgreSQL. Do not truncate Docker-owned log files by hand. Existing containers need recreation through the official deployment before the new policy applies.

The API installs production dependencies only. Docker build context excludes release backups, test reports and local output artifacts. These exclusions do not delete any source files or backups. The post-release inventory preserves backups and images; neither project retirement nor host-wide pruning is authorized.

Preserving database dumps is not a complete disaster-recovery strategy. Independently verify attachment coverage and an isolated restore exercise, and establish off-host backup retention before claiming a recovery SLA. Existing migration recovery points must remain untouched without separately approved retirement and restore acceptance.

## Current release safety gates

The immutable release-control checkout supplies `infra/ssh/production_known_hosts`. Its ED25519 fingerprint is `SHA256:Y4WEXMJ24a4r1KxOw0det4qcCFNxj65mZeIG9oQOJcI`, independently confirmed through the approved operations channel. SSH retains strict checking and `KexAlgorithms=curve25519-sha256`; an unmatched hostname or port fails before loading the deployment key. No private key belongs in the repository.

Before backup, configuration synchronization or service updates, a read-only gate verifies the actual mounted `/data` disk, existing approved database/attachment bind mounts, three healthy single-version containers, candidate migration checksums and previous runtime/marker agreement. Five GiB free is only a minimum floor, not a backup-capacity acceptance test. The separately reviewed runtime startup fix must be integrated before release: production startup checks migration metadata with SELECT only and fails closed on pending, drifted, unknown or absent metadata; explicit migrations require separate authorization.

Shared Nginx must already match the reviewed configuration hash. The workflow neither installs configuration nor reloads Nginx; a mismatch requires separate approval. Database dump creation does not back up attachments or configuration and does not prove restore capability. Current database-plus-files/configuration restore, off-host retention, rollback startup/session compatibility, independent human review and repository/environment protection remain separate mandatory gates.
