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

## 限定证书维护新增授权（2026-11-17）

生产原证书SAN仅erp.kingturf.cn，于2026-11-15T04:28:03Z到期；主机自身和外部客户端都验证失败。用户在本会话直接答复“授权这项限定维护，继续部署”，原协调会话同步转交用户原话“授权限定证书续期及平滑重载，继续部署”。授权仅ERP证书续期、nginx -t通过后的共享Nginx平滑重载、ERP及同机其他站点复核；不修改其他站点配置、不扩大到全局证书/定时器治理。

只读准备确认现有HTTP ACME location已指向/var/www/html、证书SAN单一，nginx -t通过且有存量warn；certbot.timer为failed/resources，后者只登记，不顺手修共享定时器。执行前保存ERP renewal配置和各Nginx配置hash、同机HTTPS基线；采用仅ERP lineage的certonly webroot验证避免改动Nginx路由；保留原证书archive，检查新SAN/期限与Nginx配置后再reload并逐站比对。

## 证书维护结果与最终验证冻结

- 仅ERP证书certonly webroot续期成功；新有效期截至2027-02-15T08:26:14Z，SAN仍仅erp.kingturf.cn。nginx -t后平滑重载，53份Nginx文件哈希全部保持；TLS实际服务端叶证书SHA256与磁盘原件均为b843c55005601dfd7f4f53f387f373e636b9edc5007a4095e5803df9ba040f0d。
- reload后的首个即时ERP断言未通过，后续完整重测PASS；现场保留原命令失败史，不声称首测通过。ERP内外HTTPS health/ready/version恢复；其他11个域名检查结果与维护前全同（包括两个原本证书过期域名，未扩修）。主机证据 `.release-certificate-maintenance-20261117/after.json`、原证书及renewal配置保留。
- 独立终审提出的Docker写通道缺口已经闭合；containerd写通道增量后的完整备份/切换再次真实PASS。Classic Compose以原精确config image ID实际启动API/Web二进制亦过；完整失败回退和业务健康恢复在containerd镜像存储上实测通过。
- 新增公共HTTPS基线门禁，在任何停API之前校对当前证书与三个探针，避免把已过期证书带入切换窗口。Actionlint已实际通过两个workflow的语义检查。
- 04b0612的完整CI因运行中源码增量被干净树门禁拒绝；3ba4201完整CI运行中新增证书授权文档，同样被门禁拒绝（该轮六包测试都已通过，但不得冒称CI通过）。失败日志均保留。最终收口提交后不再改工作区，重新执行完整CI。最终本地PG为独立PostgreSQL17.7 tmpfs测试库，仍保留默认fsync，所有PG集成真实执行；psql仅通过本任务专用docker客户端适配，不复用或启动他人测试容器。
- [PR #47](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/47) 已创建为draft；source image SHA仍45605d3，不重建批准镜像。平台只读发现main未启保护、production无审批/分支限制；未修改或绕过平台设置，主线集成仍经PR与完整CI及独立复核。此既有平台配置为残余限制，不充作已启用保护。

最终d6e7361本地完整CI实际退出0（含104运维测试、六包覆盖率、build及audit），远程CI run44056178709亦success。准备部署前最后权限核验发现新增tar在旧0755 backup目录和0022掩码下可能在写入期间暂时0644；独立复核确认。新增进程级0077掩码和真实tar写入期间权限测试，只影响本工具新文件，历史材料不改；该新工具尚未生产执行。此次安全增量单独提交，随后再次冻结并完整CI，不沿用d6e的绿。

## 正式首轮失败与继续恢复

PR47已正常合并至91740514dc3178ba0e758fbaef7e4b4f57fb06ae，精确主线CI44059670232 success。正式run44062257356中候选45605完整ci:local、publication来源、OCI导出/真实runner导入均success；原API未监听导致startup smoke失败，deploy skipped。配置解析器要求会话TTL、五项密码参数和附件适配路径，原smoke漏传，前30次ready拒连不能证明传输失败。补足测试配置并前台执行镜像原解析器，完整脚本另实际演练。旧失败保留，生产未停API。

等待期间已经按9174051原工具真实预载生产缓存：批准两根、平台manifest、原始config字节和diff IDs全部PASS，恢复runtime保持health/ready且临时registry已停。主机`.release-image-recovery`私有祖先root0700预置；父目录所有者属既有Docker管理员，与root同属主机特权信任边界，不声称防御这些管理员。本轮源码再内化tar data filter和run0700，避免保留archive UID/GID或'.'权限。

保持原有完整候选CI和主协调先等主线CI通过再dispatch的顺序，不引入新的CI复用或证明系统。此修复另PR，最终head再完整CI和独立复核后重试，禁止重跑迁移。

修复后已在独立Docker29.5.1 containerd daemon内**直接执行仓库smoke_release_images.sh原字节入口到末尾**并退出0。主机与容器脚本SHA256均0e6a66512141d3b452f7aceda3b2722a8f6836231a0a523a799e6dc689e7a10c。外部适配仅测试DB地址改为同隔离daemon的PG bridge IP/相同5432和测试凭据；API3000、Web8080、脚本逻辑及参数数组未改，工作流仍使用已发布到runner loopback的CI PG。真实配置解析、API health/ready/version、write fence、Web HTML和实际容器identity全部通过，精确日志exact-smoke-success.log保留。

同时用recover脚本中的原Python提取片段在root隔离daemon真实执行：archive刻意携带uid/gid12345、目录0777、文件0666；data filter后控制文件owner0/mode0644、run目录owner0/mode0700，原字节全等。此为实证安全补强，不扩大其余发布架构。

## 当前最终状态（2026-11-17 19:14 Singapore后复核）

PR48合并fbf7b7a，主线CI44068484102 success后正式run44070050685全部success。应用SHA45605d3、控制SHAfbf7b7a分别固定；主协调与独立审查证实运行API/Web批准根/manifest/config/diff IDs及实际容器全链匹配、内外探针与marker通过、72条含applied_at和迁移state原始字节hash全等、PG容器未变、原两恢复镜像与10材料全保留、新三私有联合备份与隔离恢复PASS。15432无监听、临时restore容器已移除。生产技术部署及验收完成。详见[正式验收](../evidence/ghcr-production-acceptance-2026-11-17.md)。本步只补最终文档，最后文档head仍须完整ci:local，生产服务不再改动。
