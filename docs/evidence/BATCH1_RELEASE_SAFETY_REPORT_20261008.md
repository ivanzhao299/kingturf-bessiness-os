# BATCH1 RELEASE SAFETY REPORT

日期：2026-10-08，Asia/Singapore。Batch：Release Pipeline Safety Hardening。代码 checkpoint：`61617c9608af59035117b050e24fd19f2aad8325`，分支 `codex/batch1-release-guardrails`。

本批实现发布输入、main 来源和生产 job 互斥，并修复发布失败时的版本标记与备份顺序问题。38 项专项测试、工作流与 shell 静态检查通过；现有 326 项 workspace 测试仍为 324 PASS、2 FAIL，没有新增失败。代码可以进入评审，当前不能发布到生产。

本轮没有推送、合并、部署、生产数据库写入、secret 变更或 GitHub 设置修改。应用、数据库迁移和原有业务测试没有改动。线上依旧是原始 main 版本，本批控制尚未进入线上发布工作流。

## A. Initial State

| 项目            | 实际核对                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| 仓库/remote     | `/home/jinhuit/Kingturf/kingturf-bessiness-os`；`git@github.com:ivanzhao299/kingturf-bessiness-os.git` |
| 起始分支/HEAD   | `codex/project-takeover-baseline`；`c14101d410cad1616e91d85a0c773c65c1e252a4`                          |
| 工作树          | 起始无修改、无未跟踪文件；未覆盖其他人的工作                                                           |
| 上一 checkpoint | c14101d 存在；接管报告/状态与该 checkpoint 一致                                                        |
| 默认/最新 main  | main；实时 `ls-remote` 和 API 均为 `9d89c7d6739454345b1397fe6b02c945fbe1cb99`                          |
| AGENTS          | 根/相关目录与父目录未发现文件；沿用用户提供的 AGENTS 指令                                              |
| 实际 NEXT       | 发布输入、可信来源和互斥；之后认证/权限、测试和运行缺口                                                |
| 初始 blockers   | 2 个测试失败、API 启动/代理历史问题、真实业务/恢复验收缺口、保护配置缺口                               |

没有重新做 Repository Discovery。修改前以 `pnpm -r --no-bail test` 完整重跑：326 项，324 通过、2 失败，与历史记录一致。历史 21/21 Chromium UI 只保留为历史证据，本轮没有重跑或把它算作当前结果。

## B. Security Risk Triage

| 对象                  | 状态/严重程度                                                   | 本轮证据及边界                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 改密后旧 session      | **CONFIRMED，P1**                                               | 专用 PostgreSQL + 实际 AuthenticationService/PostgresSecurityStore/API dispatch：登录→改密 204→旧会话 `/auth/session` 200→受保护 `/customers` 200；旧密码登录拒绝，新密码可登录；显式退出后旧 token 401 |
| Order 360 来源权限    | **CONFIRMED 代码/dispatch 缺口，P1；真实数据影响 NOT_VERIFIED** | 订单 COMPANY、应收 SELF 的合成上下文中，聚合只收到订单 COMPANY，返回来源记录。实际 repository SQL 未分别应用来源 scope；规范要求模块独立 DataScope。没有在真实生产数据上构造越权                        |
| 法务嵌套              | **CONFIRMED 能力边界暴露，P1**                                  | 无 legal-case:read 的合成 dispatch 仍返回收款列表法务事件 evidence 和订单 360 的嵌套 manifest；独立权限规范和 SQL 路径支持此结论。不是跨租户或完整证据包正文的已证实泄露                                |
| 跨租户 IDOR / 生产 P0 | **NOT_VERIFIED；P0 未确认**                                     | 所查订单、催收及法务查询有 actor.companyId tenant 谓词、复合关联/FK；没有取得实际跨租户绕过证据。本轮没有生产越权实验                                                                                   |

认证使用 opaque bearer session，而不是 access/refresh JWT 组合。所查 auth/session schema 没有 refresh-token 生命周期或凭据/session version 比较；改密未撤销 sessions，resolveSession 不比较密码 changed_at。既有测试涵盖登录、退出和状态/范围控制，缺少改密后全部会话失效的回归。

证据：`security.ts:147`、`repositories.ts:354,409`、`app.ts:2916`。Order 360：`app.ts:2856,2887`、`order-360-repositories.ts:37,74`；独立范围要求见 `docs/tasks/JTF-P1-E18-E21-CLOSURE.md:18`。法务：`collection-repositories.ts:62`、迁移 0053 的独立 read capabilities 和 legal_handoff_events.evidence。

细化上一轮事实：Order 360 返回的 manifest 是来源/ID/缺项清单，不包含 package items.summary；普通 collection 列表另外嵌套法务事件 evidence JSON。两入口应分别测试，不能把两种响应混为完整原始债权正文。

独立 reviewer 完成只读风险复核；主代理只在本轮新建的 loopback/tmpfs PostgreSQL 测试库进行验证，测试凭据和 token 不回显。未修这三项业务安全问题，`SECURITY_P0_CONFIRMED=NO` 不表示安全审核全部通过。

## C. Release Pipeline Findings

正式策略是完整 main 历史 commit SHA，没有正式 tag/ref 或独立 release branch 发布入口。仓库当前唯一自动生产写 workflow 为 deploy-production；业务 seed 脚本不属于发布入口，仍有误配生产目标的独立风险。

原 workflow 直接 checkout 原始输入，并将其拼入远端 shell；没有执行 40 位/main 校验、没有 job concurrency。验证、备份、同步、Compose 与清理都共享同一生产目标。旧代码在健康检查前写 `.release-sha`，会让失败候选成为下一次误导性的 previous_sha；secret 同步发生在 dump 前，备份失败也已修改配置。

```mermaid
flowchart LR
  C[固定 main workflow control SHA] --> V[格式、origin、commit、main ancestry]
  V --> Q[相同 candidate SHA 的质量检查]
  Q --> L[生产 deploy job 互斥]
  L --> R[重新 fetch main 并校验]
  R --> B[备份先于配置同步]
  B --> D[同步和运行候选]
  D --> H[必要健康、就绪、版本、HTTPS检查]
  H --> M[精确 JSON SHA 与原子版本标记]
  M --> K[控制版本清理和复核]
```

main 成员资格是来源限制，不是人工审查的替代；当前外部保护缺失仍为发布 blocker。

## D. Changes

| 文件                                      | 修改/行为                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy-production.yml` | 无生产凭据的 validate job；原始输入仅 env 传递；校验前不 checkout 输入；控制代码固定 workflow_sha；验证/部署同 validated SHA 且断言 HEAD；生产 job 固定 group、不取消在途；锁内二次校验先于 SSH key；备份先于配置；成功探针后原子 marker；清理经 SSH stdin 从控制版本执行；同步排除 .git/control checkout |
| `scripts/validate_release.mjs`            | 精确小写 40 位、不接受尾换行；限定 repo/main workflow；唯一 canonical origin；真实 fetch origin/main；对象必须为 commit，canonical SHA 一致且 candidate/control 均为 main ancestor；禁用 replacement objects，Git 操作 60 秒超时/无交互；失败无 Actions 输出、无部署授权                                  |
| `scripts/validate_release.test.mjs`       | 38 个本地 Git/输入/Bash/控制链/失败重放用例；所有 SSH、容器、特权与同步命令使用独立替身，无真实生产副作用                                                                                                                                                                                                 |
| `package.json`                            | 新增 test:release-guardrails；原 lint/test 前加入 release 脚本 lint/测试，保持全部原 workspace 门禁                                                                                                                                                                                                       |
| `eslint.config.mjs`                       | 对新增 .mjs 脚本启用现有 JS 规则；没有降低原 TypeScript/lint 标准                                                                                                                                                                                                                                         |
| `docs/deployment/PRODUCTION_PARK_HOST.md` | 输入、可信控制、回滚资格、互斥边界、版本标记和失败恢复规范                                                                                                                                                                                                                                                |

没有修改依赖版本或 lockfile，没有重构业务模块、修历史测试日期或修改 schema。

## E. Verification

环境：Node 24.19.0、pnpm 10.33.4、专用 PostgreSQL17.7-alpine3.23，固定 UTC；测试写入仅该新容器及临时 schema。actionlint 1.7.12 校验下载 checksum，ShellCheck 0.11.0 和所需库解包到私有临时目录；PyYAML 6.0.3。没有安装系统软件或加入新项目依赖。

| 命令/检查                                                                                        | 当前结果                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -r --no-bail test`，修改前                                                                 | 324/326 PASS、2 FAIL，确认实际基线                                                                                                                                   |
| `pnpm test:release-guardrails`                                                                   | **38/38 PASS**，0 skip/cancel/todo                                                                                                                                   |
| `pnpm ci:local`，最终代码                                                                        | **FAIL**；install/frozen lock、format、manifest、test-target guard、70 迁移/状态、lint、typecheck、38 新用例通过；原 Web 用例失败，API/后续 build/audit 在此链未到达 |
| `pnpm --filter @kingturf/api test`，独立补跑                                                     | **138/139 PASS**；CAPA 历史日期失败，真实 PostgreSQL 集成照常执行                                                                                                    |
| `pnpm build`，独立补跑                                                                           | **PASS**，8 workspace；应用代码未改                                                                                                                                  |
| `pnpm security:check`，独立补跑                                                                  | **PASS**，未报告已知生产依赖漏洞；不是应用安全通过                                                                                                                   |
| `pnpm exec eslint scripts/validate_release.mjs scripts/validate_release.test.mjs` / Node --check | **PASS**                                                                                                                                                             |
| actionlint + ShellCheck，CI/deploy 两个 workflow                                                 | **PASS**；没有 suppress 新错误；最终 stdout 空、退出 0                                                                                                               |
| PyYAML + `bash -n` + remote `sh -n`                                                              | **PASS**，21 个 run steps 及独立 remote heredoc                                                                                                                      |
| canonical GitHub origin CLI，当前/历史 SHA                                                       | **PASS**，9d89c7d 和正式历史 e47aa9c；输出/HEAD 一致，无生产写入                                                                                                     |
| 生产公共 GET health/ready/version                                                                | **PASS**，SHA 仍为 9d89c7d、builtAt 33996421402；没有部署本批                                                                                                        |
| 独立只读 release reviewer                                                                        | 无剩余新增阻断代码缺陷；发现的 marker/顺序/临时路径/cat failure 已修并补验证                                                                                         |
| hosted scheduler/production SSH/Docker deployment/rollback restore                               | **NOT RUN**；不以本地模拟替代真实运维验证                                                                                                                            |

去重统计：原 workspace 324/326，加新 release 38/38，共 **362/364 PASS、2 FAIL**。原六个包 PASS，Web104/105、API138/139。重复验证不累计测试数。

两个历史失败：Web 固定 2026-10-01 日期进入逾期分支，DOM 替身无 classList，`bootstrap.ts:3020` TypeError；CAPA target_at 固定 2026-09-30，`complaint-postgres.integration.test.ts:264` 违反保留的 `target_at>created_at` CHECK。两项修改前后均失败，不属于本批新增回归。没有 skip、删除、降低断言或移动日期制造通过。

### 正向与反向覆盖

- 当前 main、main 稳定历史、已打 tag 的底层 main commit SHA、main 前进后仍固定候选、正常无冲突发布 shell 和显式重跑通过。
- 空/短/超长/非 hex/大写/尾换行、branch/tag 名称、annotated tag object SHA、不存在对象、未合并 commit、不可信/多 origin、insteadOf 重写、fork/非 main workflow、控制 checkout 不一致及 fetch 失败均拒绝。
- 引号、命令替换、反引号和 Actions 输出换行输入不执行、不写成功输出；实际 Bash gate 也验证 env 输入不会变成代码。
- 静态约束检查同一生产 group、cancel-in-progress=false、verify/CI 无锁、先校验再读 SSH key、同 SHA checkout/部署、清理控制来源。GitHub 实际两个同时 dispatch 的调度没有执行；不声称测试过 hosted 并发。
- 重放真实 workflow shell：dump 失败不触碰配置；build/ready/version/public 探针失败保留旧 marker/dump、不清理；成功才精确记录版本；失败后重跑可成功；cleanup 失败/源码缺失/读取失败全部 fail-closed，不在共享 /tmp 暂存脚本。

本地日志在忽略的 `.local-acceptance/batch1/`；持久化摘要见 [BATCH1_VERIFICATION_20261008.json](BATCH1_VERIFICATION_20261008.json)。没有保存生产凭据或真实业务敏感样本。

## F. Regression Assessment

合法的当前与历史 main SHA 资格保留，历史 rollback 不被限定为 main HEAD。旧应用自身测试和最新生产 schema 兼容性仍可能阻塞回滚；不能绕过现有门禁或自动回滚数据库。其他 ref、短 SHA 和非 main workflow 现在明确拒绝，符合原正式策略。

普通 CI/verify 保持并行；生产 API/Web/迁移/清理共同处于同一 deploy job 的 group。GitHub 默认只有一个 pending slot，新 pending 可替代旧 pending；不取消 running job，也不是保证每次 dispatch 必定执行的持久队列。[GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

不会追溯改变历史 workflow run 的定义；旧 workflow rerun、手工 SSH、独立 seed 和中断后仍存活的远端进程不受新增 group 自动保护。当前未做 hosted/真实主机并发试验。失败不自动回滚，需实际运行状态核验和批准的恢复。marker 仅代表最后经过探针的版本，不能替代容器/runtime 检查。

## G. GitHub Protection Audit

本轮重新查询：main protected=false、rulesets=[]、main effective rules=[]；production protection_rules=[]、deployment_branch_policy=null。没有独立 production branch。默认 workflow permissions 查询 403，标记 NOT_VERIFIED；仓库 workflow 明确 contents:read。**任何规则均未修改。**

推荐 main required PR/reviews、quality check、禁止强推/删除及 production main-only/独立审批。手动发布 validate/verify/deploy 不是 PR 常驻 check，不能直接设为 PR 必需。具体影响、权限限制和管理员授权需求见 [GITHUB_PROTECTION_AUDIT](GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)。

## H. Git Checkpoint

- 分支：`codex/batch1-release-guardrails`，从 c14101d 新建，没有修改 main。
- 代码 checkpoint：**61617c9608af59035117b050e24fd19f2aad8325**。
- Commit：`fix(release): validate main commits and serialize production deployments`；6 个必要文件。
- 提交前检查 diff、secrets 风险、文件范围和数据库/生产配置修改；apps/packages/tests/infra/lockfile 无差异。
- 代码 checkpoint 后工作树干净；本报告和状态更新作为单独文档 checkpoint，最终 HEAD/clean 状态在最终交付中确认。
- 未 push、未创建/合并 PR、未 force push、未触发部署。新 commit 还不属于远端 main，因此尚不具备发布资格。

## I. Remaining Risks

1. P1：改密会话不失效和审计非原子；Order360 来源 scope 与法务嵌套能力问题未修。
2. P1：main/environment 外部保护未配置；旧 workflow 重跑与人工路径没有统一的执行约束。代码来源校验不能代替这些设置。
3. P1：2 个历史测试失败持续阻塞全量门禁；本地 API 启动和代理历史缺口未处理。
4. P1/待证：生产 schema/迁移状态、备份附件/异地覆盖、恢复与旧应用兼容、真实多岗位业务 UAT 未验证。
5. P2：成功备份后同步配置，后续失败仍可能保留新配置或部分更新；没有自动配置回滚。发布互斥不能保证 SSH 中断后远端进程已经退出。
6. 未做 hosted release job、Docker 生产镜像、真实 rollout、并发 dispatch 或恢复演练。不能把 YAML/模拟 PASS 写成生产部署验证 PASS。

## J. Proposed Batch 2

按本次已确认的风险调整顺序，**Batch 2 优先认证安全**：改密和管理员身份重置在同一事务中更新凭据、撤销该 identity 全部 sessions、写成功 audit；核对重认证和客户端重新登录行为。用真实 PostgreSQL/API 测登录→改密→旧 token401、新密码登录、全部会话失效、错误/审计失败回滚、权限和并发路径，并独立复核。保持接口兼容策略明确，不顺带重构。

之后单独处理来源 DataScope/法务嵌套，补真实双租户和多范围反向测试。时钟/DOM 历史失败作为独立门禁恢复批次；在生产发布前必须消除，不能按 baseline 忽略后上线。Github 管理员配置建议可并行准备审批，但本轮未授权外部写入。

```text
BATCH1_STATUS=COMPLETE_LOCAL_VALIDATED
BATCH1_COMMIT=61617c9608af59035117b050e24fd19f2aad8325
WORKTREE_CLEAN=YES
SECURITY_P0_CONFIRMED=NO
RELEASE_PIPELINE_VALIDATION=PASS_LOCAL_STATIC_AND_ISOLATED_HOSTED_NOT_RUN
REGRESSION_RESULT=NO_NEW_FAILURES_OVERALL_GATE_FAIL
HISTORICAL_TEST_FAILURES=2
PRODUCTION_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
READY_FOR_PR=YES
READY_FOR_PRODUCTION_RELEASE=NO
NEXT_BATCH=AUTH_SESSION_REVOCATION_AND_ATOMIC_AUDIT
```
