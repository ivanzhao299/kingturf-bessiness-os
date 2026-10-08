# BATCH2_AUTH_SECURITY_REPORT

日期：2026-10-08，Asia/Singapore。结论：认证会话撤销与原子审计已在独立分支实现并完成本地验证，代码 checkpoint `e76cb1eee5b70f4328ca07a358aab65aab9bbf98`。没有 push Batch 2、创建 Batch 2 PR、合并或生产部署。

## A. Initial State

仓库与 remote 同 [Batch 1 集成报告](BATCH1_INTEGRATION_REPORT_20261008.md)。Batch 1 推送前工作树干净，两个 checkpoint 核对存在，PR #31 Hosted quality 已因历史 Web 测试失败。最新 main SHA 仍为 `9d89c7d6739454345b1397fe6b02c945fbe1cb99`。

Batch 2 分支 `codex/batch2-auth-session-revocation` 直接从 origin/main 建立，BASE_COMMIT=`9d89c7d6739454345b1397fe6b02c945fbe1cb99`。不依赖、未 cherry-pick Batch 1 workflow 或应用代码，没有叠加到未合并 PR。仅恢复前一批七份接管/证据文档用于延续事实，原始历史报告保持原文，当前状态/问题矩阵增量更新。根/相关目录与父目录未发现仓库 AGENTS 文件，遵守用户提供的子代理指令。

## B. Authentication Architecture

现有 ADR 0003：scrypt 密码哈希，随机 256-bit opaque bearer，服务端 secret 绑定的 SHA-256 token_hash，PostgreSQL sessions 保存 expiry/revoked_at/identity/organization。每次认证读取数据库，检查身份/员工/公司/成员关系及权限，没有全局会话缓存。Web 使用 sessionStorage 和 Authorization header；没有认证 cookie、JWT、refresh-token 续期、公开忘记密码入口或长连接认证实现。该否定结论来自 apps/api/src、apps/web/src 与认证测试中对 refresh/JWT/reset/forgot/WebSocket/EventSource 的限定搜索及现有路由检查，不代表外部集成完整盘点。

已有 login/logout、管理员 identity provision/reset、账户禁用撤销和 RBAC/DataScope。管理员通过 authorization:manage 在自身 company 内重置。没有新增另一套会话系统、数据库字段或外部事件服务。

## C. Confirmed Root Cause

历史 `AuthenticationService.changePassword` 更新哈希后单独调用 AuditSink；`replacePasswordForEmployee` 没有撤销 sessions，resolveSession 不关联 changed_at。管理员 provision 同样没有撤销会话，其成功审计在仓储事务外。因此密码变化既不会影响旧 bearer，也可能在审计失败时部分成功。

登录原先先验证密码再直接 INSERT session，可能在 reset 撤销已存在会话后插入基于旧密码的新会话。仅增加 UPDATE revoked_at 不足以修复这个竞态。Batch 1 隔离 PostgreSQL/API 已确认改密后旧会话返回 200；本批以真实 HTTP 验证修复后的 401，不在生产试验。

## D. Security Behavior Contract

- 自助 PUT /api/v1/auth/credential 必须同时提供 currentPassword/password，且当前 bearer 活跃。正确当前密码才可修改；最少 12 字符策略保持，弱密码返回 400。密码-only 旧调用返回 400，仓库没有调用该旧 body 的自助 UI。接口契约变更已写入 [ADR 0003](../adr/0003-opaque-session-authentication.md)。
- 成功改密撤销目标 identity 的所有会话，包括当前设备；成功后必须重新登录。管理员重置同样撤销目标会话，重置其他员工不会撤销管理员或其他组织用户。
- 普通改密失败保留原密码/会话，不生成成功审计；并发凭据变化返回 409，需要重新认证。logout 在调用会话锁取得前提交，改密拒绝并保持凭据。
- 没有 refresh token，因此 OLD_REFRESH_TOKEN_REJECTED=NOT_APPLICABLE_NO_REFRESH_FLOW。旧 bearer 调用任何受保护路径（包括尝试 /auth/refresh）均拒绝；新 bearer 对不存在的 refresh 路由返回 404。未来忘记密码流程必须复用事务性重置规则，当前未新增。
- opaque 格式/secret/数据库 schema 不变：历史 token 仅在对应身份改密、主动退出、账户停用或原有效期届满后失效，不使所有用户立即退出。
- 多实例以 PostgreSQL 提交为边界，没有缓存宽限；认证数据库不可用时返回错误、不开放访问。提交前已经完成认证的业务请求可能继续，不追溯取消在途操作。
- Web 的当前 token 收到 401 后清除并 reload，显示重新登录提示；自助改密 204 立即触发。启动验证仍直接显示登录视图；403、延迟旧 token 的 401 不会退出新会话。重载会丢弃未保存工作台输入。外部 bearer 集成在本身份改密后需重新认证，实际集成清单尚待业务确认。

## E. Implementation

| 文件                                                          | 最小变更与目的                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/security.ts                                      | 验证当前密码；向事务传递 tenant、expected hash、当前 token hash、correlation；成功审计交由仓储事务；并发登录失败保留失败审计                                       |
| apps/api/src/repositories.ts                                  | 沿用 Database.transaction/auditTx；登录/改密/管理员重置共用 employee→identity→credential 锁序；密码 CAS、调用 session FOR UPDATE、全身份 revoke、成功 audit 同提交 |
| apps/api/src/app.ts                                           | credential body allowlist、必填 currentPassword，使用已有认证上下文/current bearer，不接收其他员工目标                                                             |
| apps/web/src/http.ts / session.ts / entry.ts                  | 当前会话失效通知、匹配 token 清理/登录提示；启动及运行中分别处理，防止旧请求退出新登录                                                                             |
| apps/api/test/security.test.ts / postgres.integration.test.ts | 保留原断言，mock 反映原子 store audit；补当前密码、哈希/CAS、并发失败审计 unit；原 tenant 测试增加 correlation                                                     |
| apps/api/test/auth-http-postgres.integration.test.ts          | 19 项：两个实际原生 HTTP server、真实仓储/guard/PostgreSQL、故障注入/可观察行锁屏障                                                                                |
| apps/web/src/http.test.ts / session.test.ts                   | 401/403、自助 204、延迟旧 token 与清理反馈                                                                                                                         |
| tests/e2e/session-revocation.spec.ts                          | 两项浏览器运行中失效/权限拒绝 UI 回归，API 模拟边界明确                                                                                                            |
| docs/adr/0003-opaque-session-authentication.md                | 契约、兼容性、锁序与生产版本一致性要求                                                                                                                             |

没有修改依赖、workflow、生产配置、migration 或无关业务模块。API 的登录复查还检查活跃 company/employee organization/company membership，沿用 resolveSession 的既有安全边界。

## F. Atomic Audit Assessment

密码 hash 更新、目标全部会话 revoked_at 和 auth.password_change SUCCESS 使用同一 PostgreSQL client/事务；管理员 identity/membership/credential 更新、revoke 和 auth.identity_provision SUCCESS 同事务。登录 token INSERT 与 auth.login SUCCESS 也同事务。审计或撤销失败抛出并 ROLLBACK，不返回密码修改成功。

AuditSink 的其他事件仍沿用现有实现，未声称整个审计架构原子。这里的安全审计写入 PostgreSQL audit_events，没有调用外部异步服务，因此无需 outbox。错误密码/验证失败没有成功记录；stale login 有 FAILURE 记录，并发 HTTP 测试检查其存在。故障模拟 trigger 仅在随机测试 schema 内，不进入 migration 或生产。

## G. Security Test Matrix

| 要求                                                 | 实际验证结果                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 正确/错误当前密码、修改成功、新密码登录、旧密码拒绝  | PASS，HTTP 204/403/200/401；错误时旧会话仍200、成功审计0                   |
| 旧 bearer→受保护 auth/session→拒绝                   | PASS，两个实际 HTTP API 实例都401，不是 dispatch mock                      |
| 当前设备、其他设备、管理员重置、自身管理员重置       | PASS，目标所有旧 token401；其他身份/管理员（重置别人）200                  |
| refresh、公开 forgot-password                        | 不适用；不存在；旧 bearer 尝试 refresh401，新 bearer404                    |
| password-only/额外 employeeId/弱密码/无认证          | PASS，400/400/400/401，不改变凭据                                          |
| self audit failure / revoke failure                  | PASS，500，旧密码和全部旧 token仍有效，无成功审计                          |
| admin audit failure                                  | PASS，500，identity login/hash/revoke 全部回滚，无成功审计                 |
| login audit failure                                  | PASS，500，无 session 部分提交，无成功审计                                 |
| login 在 reset 前/后排队、admin reset 与旧密码 login | PASS，真实 PostgreSQL 锁屏障；前者签发后撤销，后者401及失败审计            |
| 并发 self changes / logout 与 self change            | PASS，仅一个204和成功审计；另一个409；logout先提交则403且密码不变          |
| tenant/RBAC/SELF / 未授权撤销别人的会话              | PASS，同公司缺能力403，跨公司 admin404；其他公司会话保持；SELF列表仅本员工 |
| 事务内调用 session/tenant 复查                       | PASS，撤销 session拒绝、错误company拒绝，成功审计0                         |
| 历史 token 兼容                                      | PASS，按旧 schema/格式预置token原先200，仅目标改密后401，其他token200      |
| DB 认证查询不可用                                    | PASS，500，无受保护内容；恢复后原session200                                |
| 认证材料日志                                         | PASS，真实 server日志不包含测试密码、已知hash、secret或已签发bearer        |
| UI运行中401/403、启动/登录/原导航                    | PASS，新浏览器2/2；原浏览器21/21；web专项10/10                             |

测试启动先 assertTestDatabaseTarget：NODE_ENV=test、loopback、库名含 test。PostgreSQL 17.7-alpine3.23 位于专用 tmpfs 容器；每次随机 schema，API 仅监听127.0.0.1；先停进程再 DROP 自己的 schema，终止等待有上限。未使用生产真实数据或清除生产用户会话。最终只读查询确认 auth_http 测试 schema 余数为 0；任务专属容器与临时凭据文件已清理。

## H. Regression Results

Node v24.19.0、pnpm 10.33.4、Vitest 3.2.6、TypeScript 5.9.3、Playwright 1.62.1、Prettier 3.8.1。使用仓库原命令，无依赖升级或测试标准下降。

| 命令/范围                                                                                                                                                                       | 当前结果                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm ci:local                                                                                                                                                                   | FAIL：install/frozen lock、format、manifest、test DB guard、70 migrations/status、8 workspace lint/typecheck通过；shared82/82，Web108/109；在原有Web失败停止，API/build/audit没有在该链执行 |
| pnpm --filter @kingturf/api test                                                                                                                                                | FAIL：160/161，仅原CAPA target日期违反 capa_cases_target_check                                                                                                                              |
| pnpm --filter @kingturf/api exec vitest run test/auth-http-postgres.integration.test.ts test/security.test.ts test/postgres.integration.test.ts test/app.test.ts --maxWorkers=1 | PASS，87/87，含HTTP19、service13、PostgreSQL权限16、API路由39                                                                                                                               |
| pnpm --filter @kingturf/web exec vitest run src/http.test.ts src/session.test.ts --maxWorkers=1                                                                                 | PASS，10/10                                                                                                                                                                                 |
| pnpm lint / pnpm typecheck / pnpm build                                                                                                                                         | PASS，最终源码8 workspace；build包含Web启动体积预算                                                                                                                                         |
| pnpm format:check / pnpm verify:frontend-capabilities                                                                                                                           | PASS                                                                                                                                                                                        |
| pnpm security:check                                                                                                                                                             | PASS，无已知生产依赖漏洞                                                                                                                                                                    |
| Chromium E2E，7 files                                                                                                                                                           | 原有21/21 PASS +新增2/2 PASS；模拟API，只证明浏览器交互；隔离runner选Chromium和临时库路径，未改全局配置                                                                                     |
| Git diff/staged scope/credential pattern scan                                                                                                                                   | PASS，code checkpoint仅13个预期文件，无workflow/infra/migration或连接串/私钥                                                                                                                |
| Batch 2 Hosted CI / PR / production rollback                                                                                                                                    | NOT_RUN；未推送Batch2或部署                                                                                                                                                                 |

全 workspace 合并统计 **350/352 PASS、2 FAIL**：shared82/82、Web108/109、API160/161。与 main 324/326 的两项失败相同，新增26项 workspace测试全部通过；不将352与Batch1的364比较，因为独立main基线没有未合并的38项release测试。浏览器另计，不混入workspace统计。

历史失败：Web固定日期触发未实现classList的DOM fixture；CAPA固定target_at=2026-09-30早于created_at。原用例/断言/数据库约束未删、未skip、未降低；新增回归0。实现阶段曾发现并修正测试harness readiness路径、浏览器hash导航未重启应用及新增代码lint问题，最终检查均按原标准通过。因这些变更只涉及本批代码和测试，未将暂态开发失败伪称历史问题。

原始日志位于忽略目录 `.local-acceptance/batch2/`（ci-local、api-full、auth-final、web-auth、lint-final、typecheck-final、build-final、dependency-audit、browser及browser-auth-targeted）。机器可读摘要见 [BATCH2_VERIFICATION](BATCH2_VERIFICATION_20261008.json)。

## I. Database Compatibility

无 migration、无字段/enum/index变化、无全局 token version、无 secret rotation。70项现有migration在隔离库应用，并由两个测试API启动再次核验。历史session行兼容已实测。仅更新目标identity的既有sessions，保留审计与历史数据；未对生产执行任何SQL。

## J. Production Risk Assessment

本地修复不等于已上线。所有 API 实例必须使用本实现才能保证并发撤销；旧版本实例可不遵守锁协议。部署前需按既定流程确认版本/commit、备份、migration、回滚和health，在批准的发布窗口协调版本一致性。无 schema 变更使旧版本仍能读取数据，但回滚旧代码会恢复安全缺口，且不会让已经 revoked 的 token复活。

main/production仍使用旧workflow/认证代码；没有重新核验生产backup/schema/第三方登录集成，也未生产写入。残留P1：Order360来源范围、法务嵌套可见性、保护规则缺失、历史quality失败、恢复/UAT/迁移控制。没有证据确认生产P0，不代表已完成全面生产安全认证。READY_FOR_PRODUCTION_RELEASE=NO。

## K. Git Checkpoint

分支 `codex/batch2-auth-session-revocation`。BASE_COMMIT `9d89c7d6739454345b1397fe6b02c945fbe1cb99`。代码/行为契约 checkpoint **`e76cb1eee5b70f4328ca07a358aab65aab9bbf98`**，message `fix(auth): revoke sessions and audit password changes atomically`。后续独立文档checkpoint记录本报告、历史证据恢复和持续状态；其SHA以最终交付与git log为准，避免文档自引用SHA。

文档 checkpoint 提交后核对工作树 CLEAN；最终 SHA 见交付消息。Batch1 PR head保持2d5a008，Batch2未push。代码独立于Batch1，治理文档引用它的事实，不引入代码依赖。主代理执行所有修改/验证/外部写入；只读reviewer两轮独立审查锁序、原子性、tenant与测试，未发现认证正确性阻断项，审查建议已补齐失败审计断言和有界进程清理。

## L. Recommended Next Batch

Batch 3 优先修复 KT-006/007：订单聚合来源DataScope、法务子对象/derived字段可见性，采用双tenant/多角色真实API负向测试，保持现有独立模块权限。另设最小测试确定性批次修复 KT-009/010，恢复Batch1及后续PR quality，不降低现有约束/断言。随后解决本地运行/代理，提交保护配置建议供管理员审批，完成备份恢复和真实岗位验收。

```text
BATCH1_PR_STATUS=OPEN_PR_31
BATCH1_HOSTED_CI=FAIL_HISTORICAL_WEB_TEST_RUN_37770650651
BATCH1_MERGE_STATUS=NOT_MERGED
BATCH2_STATUS=COMPLETE_LOCAL_VALIDATED
BATCH2_BASE_COMMIT=9d89c7d6739454345b1397fe6b02c945fbe1cb99
BATCH2_COMMIT=e76cb1eee5b70f4328ca07a358aab65aab9bbf98
AUTH_SESSION_REVOCATION=PASS_LOCAL
OLD_ACCESS_TOKEN_REJECTED=PASS_REAL_HTTP_OPAQUE_BEARER
OLD_REFRESH_TOKEN_REJECTED=NOT_APPLICABLE_NO_REFRESH_FLOW
PASSWORD_AUDIT_ATOMICITY=PASS_POSTGRES_FAILURE_INJECTION
TENANT_ISOLATION_REGRESSION=PASS_TARGETED_HTTP_AND_POSTGRES
AUTH_SECURITY_TESTS=87/87_API_PLUS_10/10_WEB_PLUS_2/2_BROWSER
FULL_TEST_BASELINE=350/352_PASS_2_HISTORICAL_FAIL
NEW_REGRESSIONS=0
DATABASE_MIGRATION_REQUIRED=NO
PRODUCTION_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
READY_FOR_PR=YES
READY_FOR_PRODUCTION_RELEASE=NO
NEXT=BATCH3_SOURCE_AND_NESTED_AUTHORIZATION
```
