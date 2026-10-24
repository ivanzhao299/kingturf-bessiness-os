# RELIABILITY.md（可靠性与发布链路 runbook）

> 本文档与 `.github/workflows/deploy-production.yml` **逐步对应**（对齐验收：抽查核对）。
> 发布方式：**仅 `workflow_dispatch` 手动触发，输入 40 位 commit SHA**；无 tag、无 GitHub Release、无自动发布（判定记录见 `docs/CI.md`）。

## 1. 发布 runbook（三段式，对应 workflow 三个 job）

### Job 1｜validate（守卫，10 分钟超时）

| 步骤                                     | 做什么                                                                              | 失败含义         |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| Reject untrusted dispatch                | 校验仓库 = ivanzhao299/kingturf-bessiness-os、触发分支 = main、SHA 为 40 位小写 hex | 非信任来源触发   |
| Checkout immutable release control       | 检出 workflow 自身 SHA（控制面与代码面分离）                                        | —                |
| Verify canonical origin and main history | `node scripts/validate_release.mjs`：候选 SHA 必须在 origin/main 历史内             | 候选不在主干部落 |

### Job 2｜verify（对候选 SHA 跑全量门禁）

| 步骤                                          | 做什么                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| checkout 指定 SHA + `git rev-parse HEAD` 复核 | 确保测的就是要发的                                                                |
| postgres:17.7 service 容器                    | 与 ci.yml 同款测试库                                                              |
| `pnpm ci:local`                               | install→format→capabilities→db guard→migrate→lint→typecheck→test→build→audit 全链 |

### Job 3｜deploy（`environment: production`，并发组 `kingturf-erp-production` 串行）

| 步骤                                            | 做什么                                                                                                                                                                                                                  | 备注                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Checkout 候选 + 复核 HEAD                       | 部署即所测                                                                                                                                                                                                              |                       |
| Checkout release control 到 `.release-control/` | 脚本/配置以控制面为准                                                                                                                                                                                                   | 与候选隔离            |
| 二次 `validate_release.mjs`                     | 拿到生产并发后重验 main 历史                                                                                                                                                                                            | 防竞态                |
| Pin SSH host key                                | `infra/ssh/production_known_hosts` 钉扎 + `ssh-keygen -F` 校验                                                                                                                                                          | 防中间人              |
| Read-only preflight                             | ①远端 nginx 配置 sha256 必须等于仓库 `infra/nginx/erp.kingturf.cn.conf`（不一致=共享 nginx 有变更，需单独审批，直接失败）②`production_preflight.py` 比对迁移清单与库内 schema 状态                                      | 只读，不改生产        |
| Diagnose HTTPS ingress                          | 打印监听/防火墙/nginx/证书/本机探针（诊断信息，`set +e` 不阻断）                                                                                                                                                        | 排障通道              |
| Create recovery point                           | `pg_dump --format=custom` 到 `.release-backups/<UTC时间戳>-before-<候选SHA>.dump` + metadata（previous_sha/candidate_sha）                                                                                              | **回滚依据**          |
| Sync ingest secret                              | `WEBSITE_LEAD_INGEST_SECRET` 以幂等方式写入远端 `.env.production`                                                                                                                                                       |                       |
| rsync 同步                                      | `--delete`，排除 `.git/.env.production/.release-sha/.release-backups/数据卷`                                                                                                                                            |                       |
| Verify unchanged nginx                          | sha256 再次比对，仍不一致则**不安装不 reload 直接失败**                                                                                                                                                                 |                       |
| Deploy and verify                               | 注入 `KINGTURF_RELEASE_SHA/BUILT_AT` → `docker compose up -d --build`（失败重试一次）→ `127.0.0.1:4332` 的 /health /ready /version（version 必须含 SHA）→ `--resolve erp.kingturf.cn:443:127.0.0.1` 走 TLS 探同样三端点 | curl 带 retry 12/6 次 |
| Required hostname probe                         | 真实域名 https://erp.kingturf.cn 三探针（健康 `status:ok`、就绪 `status:ready`、version 含 SHA）                                                                                                                        |                       |
| Record release                                  | 探针通过后写 `.release-sha` 标记（临时文件 + 原子 mv）                                                                                                                                                                  |                       |
| Retain recovery point                           | 三探针再验一遍后执行 `cleanup_kingturf_release_artifacts.sh`：保留最新恢复点与活跃镜像                                                                                                                                  | 探针不过不清理        |
| Cross-border probe                              | GitHub runner 公网探测 erp.kingturf.cn（`continue-on-error`，仅诊断）                                                                                                                                                   |                       |

## 2. 回滚手册

1. **首选**：再次 dispatch，输入上一个成功发布的 SHA（`.release-sha` 内容 / Actions 历史可查）——全链路同样过 verify 与探针，幂等安全。
2. **数据层**：若需回退数据库，用 `.release-backups/<时间戳>-before-<SHA>.dump`（pg_dump custom 格式）恢复；迁移 CLI 向后兼容性以 `production_preflight.py` 预检为准——**降级前必须人工评估迁移是否可逆**。
3. 保留策略：恢复点仅保留最新一份（探针全过后清理），重要发布前可人工先备份。

## 3. 运行时可靠性机制（改造时必须保持）

- **超时**：前端全交换 15s（http.ts AbortController）+ 工作台懒加载 45s；API 无外呼。
- **健康端点**：`/health`（存活）、`/ready`（就绪，含 DB 连通）、`/version`（必须回显 `KINGTURF_RELEASE_SHA`，部署后探针强校验）。
- **遥测**：`runtime-telemetry.ts` 结构化无 payload 指标（counter/timing，标签白名单），密钥不入日志有负向测试兜底。
- **容器**：compose.production.yaml 三服务均健康检查 + 重启策略 + json-file 日志上限（10m×3）。
- **失败路径**：登录/启动失败提供人工重试视图（自动重试缺失，TD-PERF-001）；启动预算门禁防首屏劣化（≤12KB gzip JS）。

## 4. 已登记的可靠性债务

**S3现时（2026-10-17）**：CSP Report-Only业务762e393、严格oracle a4c2ca3与工具f693ee2实际稳定干净HEAD完整CI0/219878.817ms。API环境CSP_ENFORCE默认false；外层nginx独立off开关，隐藏上游两CSP头后统一RO，不能通过API变量开启公网强制；内层直连HTML无CSP。workflow不安装/reload host nginx，仓库变化不是生产生效，本次无部署。真实built HTML/合成发送、原29及本地合成upstream20矩阵分开证明，不等同真实TLS/inner/API全栈；打印未测、无report接收端、未来完整发布周期观察及强制另授权。源码/构建/API原生import通过，无启动/端口/DB操作。最终完成docs另实际HEAD全CI后停协调，SEC001只RO段待批次验收，S4仍硬停；[细节、失败史与配套回滚](evidence/security-batch4-s3-csp-2026-10-17.md)。下方SEC001未实施为历史。

**S2现时（2026-10-17）**：登录端点已实施账户/IP独立失败滑窗与持锁退避，b8c1212实际干净HEAD全CI0，最终证据HEAD另复验后停协调。单进程状态、默认10000桶/64活动及等待请求；满容量/受信链非法503而非提前429，原auth未完成持续占名额，共享键排队可能超过前端15s，不是全HTTP堆/连接防DoS。默认trust-none，生产双代理上线前必须核实实际peer/追加链并显式配精确IP；仅新增compose S2透传，不运行/部署。TD-HYG-002登记旧preview Dockerfile仍COPY已删包，未构建/未证生产失败，不顺手修。细节/回滚见[S2证据](evidence/security-batch4-s2-login-limit-2026-10-17.md)，下方SEC002未实施为历史；SEC001/003仍未实施，S4硬停。

**S1现时更新（2026-10-17）**：D1已正式授权实施，TD-SEC004的应用层三头已在统一complete接线，正常/错误及rejectOversized保持原状态/JSON/关联ID/telemetry；后继59f9dfa实际干净HEAD全CI0。Nginx自产响应/dispatch前异常不在该点保证内，代理重复头数量尚未实测，不代表生产生效；本批不部署/dispatch。SEC001/002/003后续按授权分步，S4硬停。旧下段为建档基线，当前细节见[S1验证及回滚](evidence/security-batch4-s1-headers-2026-10-17.md)。

TD-PERF-001（无自动重试）、TD-PERF-002（13 处 N+1 候选）、TD-SEC-001..004（CSP/限流/头/token，前置 D1）——见 `docs/exec-plans/tech-debt-tracker.md`。

## 5. 变更历史

| 日期       | 变更                                            | 原因                                 |
| ---------- | ----------------------------------------------- | ------------------------------------ |
| 2026-10-12 | 建档：runbook 与 deploy-production.yml 逐步对应 | 阶段 2a-6（规则 §5 阶段 2 子任务 9） |
