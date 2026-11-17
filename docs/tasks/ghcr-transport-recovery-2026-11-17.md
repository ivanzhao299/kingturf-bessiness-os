# GHCR 传输修复与已迁移生产发布恢复

## 授权与边界

2026-11-17 用户明确授权保留 GHCR，先修镜像传输链，由本会话主协调代理推进必要修复、独立复核、完整 CI、提交、推送、PR、遵守保护的合并和正式部署，持续至验收完成或确切外部阻塞。此授权取代旧 harness 施工期的禁止 push/workflow/部署限制；不绕过平台审批或分支保护。来源：源会话 `01a1c9d5-653a-7bf0-a627-c2eab5ac0834` 转交的用户原授权。

禁止重执行迁移、删除/重置迁移状态、伪造审批、改历史 SQL。保留 FULLY_MATCHED 名称及 checksum 全等检查、生产只读启动校验、应用兼容验证和全部恢复材料。数据恢复、破坏性清理、共享设施及权限扩大不在默认范围。

## 刷新事实与失败历史

- 最新 main 为 `45605d37e462801927a50d0ef6f97aea7b7d13c3`；PR #46 已合并（SSH 端口引号修复）。原工作区无改动；本任务在独立 worktree `kt-ghcr-recovery` / `codex/ghcr-transport-recovery` 执行。
- [失败部署 42335884296](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/42335884296)：迁移步骤实际返回 COMPLETED、postcheck FULLY_MATCHED；Runner GHCR pull 成功，远端 load 输出 Loaded image ID，随后两个 repo@digest inspect 均 No such image。不能将其归为 SSH 或 GHCR 源端拉取失败，也不能用 config image ID 替代批准的 registry digest。
- 2026-11-17 只读 SSH：生产 Docker 29.5.1 linux/amd64、containerd image store；API `kingturf-erp-api-restore:45605d3`、Web `kingturf-erp-production-web` 和 PG 三容器健康；marker 和实际 version.sha 都为上述 main SHA；builtAt=`restore-20261109T0914Z`；迁移登记计数72。完整登记、真实 image ID、恢复材料尚在采集，不以此简报替代验收。
- GHCR 采用原因是不可变制品与预先验证及回退证据绑定；后来的私有 GHCR 主机拉取拒绝才导致 Runner 中转。两者因果须区分。

## 实施与验收计划

1. 只读刷新完整 registry、容器/镜像、探针、恢复材料和迁移完成状态；记录原始失败。
2. 保留批准 GHCR 根 digest，通过可验证 OCI 原始 manifest/config/layer 字节分发；候选为 Runner skopeo `--all --preserve-digests` 导出 OCI 布局、受控产物传输、目标只读 loopback registry 拉取相同 digest。正式采用前做跨 daemon 隔离演练和失败路径，独立复核。
3. 设计已 FULLY_MATCHED 应用恢复路径，完全不调用 migration execute、不触迁移状态；新发布授权和真实观测单独记录，不冒用过期迁移窗口或人类签名。
4. 停服前备妥候选和恢复镜像，完成72 schema隔离启动验证。保留固定控制 SHA、精确 main、并发锁、SSH pin、Nginx 哈希、批准路径、备份、写入隔离和失败停止。
5. 最终候选完整 ci:local、独立复核、正式 Actions；内外 health/ready/version、运行镜像全链绑定、runtime/marker SHA、72项名称/checksum全等及未重执行、恢复可用。

当前状态：调查及设计中，尚未修复、合并或部署。后续追加真实检查点，不倒改历史。

## 实现检查点（部署前）

- 生产完整只读登记与候选72项名称/checksum全等；已采集原applied_at、实际API/Web image ID、恢复材料10文件库存和原COMPLETED状态。原始脱敏证据位于工作区外 `ghcr-recovery-evidence-20261117/production-before.json`，不向仓库写生产数据/配置秘密。
- 原批准镜像复用候选 `45605d37e462801927a50d0ef6f97aea7b7d13c3`，发布run `42335784132`。API根 `sha256:18685f7a1070fdd4ef983da1d83140377eabcd630e1aaedc0c842bd218159d61`；Web根 `sha256:229eecf8bc6ed257a94a7fe5fac1320283591f15a862ab271c8bf6865d490130`。不因修复控制面重建或静默更换批准制品。
- Classic overlay2与Docker29.5.1 containerd双隔离daemon真实导入均成功，逐层身份与根digest保留。首轮containerd失败一为HTTP/0.9错误响应不能触发默认loopback回退，二为新版Id语义不同；均保留失败并修复协议/验证，不修改daemon配置，不把root摘要充作config摘要。真实config字节另经单平台export核对。
- 新唯一入口 `recover-application-images.yml`；旧迁移workflow首步明确retired exit1，历史save/load不可再触发。新增应用路径从未调用迁移execute；故障仅恢复原应用配置/镜像，不动生产数据。完整执行契约见生产runbook。
- 新授权工件类型是delegated_application_recovery，operator=codex、来源为本次用户授权，按实际运行时间生成有限执行窗口；不填写人类approver，不修改旧迁移审批。固定控制SHA及候选SHA由可信workflow外传并与工件精确比对。

仍待：完整切换/失败恢复隔离演练、最终CI、独立终审、PR/main集成、正式Actions和生产验收。当前未部署。

## 独立复核后的补强与真实应用演练

- 独立复核指出切换失败的回退需要实证、联合备份必须在停写后、需核外部写通道。全部按此补强；不以停止即安全作为部署完成。
- Docker29.5.1 containerd隔离环境（真实批准API/Web+PG72schema）已完成停API、联合备份、无网络tmpfs PG真实restore、原registry含applied_at全等。故意在API已停后使授权过期，switch非零拒绝并通过真实Compose原image ID恢复API/Web健康，状态RECOVERED_PREVIOUS_APPLICATION。随后新run正向切换PASS/FULLY_MATCHED/NOT_INVOKED。该隔离fixture仅把公网探针路由到本地，不计正式公网验收。
- 实际Docker读取被篡改层时拒绝：filesystem layer verification failed。另10个OCI工具用例覆盖缺失/截断/等长篡改、错误root、descriptor size、缺目标平台、attestation完整性、symlink和真实HTTP范围。
- 生产只读require-full预检真实PASS；只读写通道库存证实PG无宿主发布端口、网络精确API/Web/PG、附件仅API可写。新gate在停止前后和备份后重查这些运行通道；排空检查包括idle在内的所有其他client backend必须为0。特权主机运维仍须由授权协调，代码不能阻止root的独立操作。
- 运维测试102项一轮通过。首完整CI在04b0612启动后独立审查引出上述写通道增量，故不作为最终干净HEAD验证；最终增量提交后重跑完整CI。
