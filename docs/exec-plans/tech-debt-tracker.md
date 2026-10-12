# 技术债台账（tech-debt-tracker）

> 依据 `docs/HARNESS-RULES.md` 附录 B 字段定义维护。**本台账是长效文件**：结清的条目移除并记入对应提交，新发现的条目持续登记（§14.3）。
>
> - **度量基线**：commit `779dea3`（2026-10-12），全部数字可用 `node scripts/analysis/repo-metrics.mjs` 复算。
> - **度量口径**：行数以度量脚本为准（内容按换行符切分，含末段空行），与 `wc -l` 相差 ≤1 行/文件（如 bootstrap.ts：脚本 16,082 / `wc -l` 16,081）；两者差异不影响任何结论的量级。函数跨度为起止行号差，两口径相同。
> - **业务行为影响**取值：`无`（纯重构）／`修复 bug`（纠正错误行为）／`变更行为`（有意改变外部可观察行为，必须单独提交并前置人工决策）。
> - **本轮扫描未发现明确的功能性 bug**；所有「变更行为」条目均为安全加固类，已归入独立批次 4 并前置人工决策 D1，与纯重构严格分离（红线 R2）。

## 索引

| ID           | 标题                                                                                    | 严重度 | 类别          | 业务行为影响             | 关联批次           | 状态   |
| ------------ | --------------------------------------------------------------------------------------- | ------ | ------------- | ------------------------ | ------------------ | ------ |
| TD-WEB-001   | bootstrap.ts 16,082 行巨石文件，七种职责混合                                            | P1     | 复杂度        | 无                       | 批次 3             | 待处理 |
| TD-WEB-002   | commercialWorkspaceStructure 单函数 ≈8,551 行                                           | P1     | 复杂度        | 无                       | 批次 3             | 待处理 |
| TD-WEB-003   | bootstrap.ts 深嵌套：≥4 层 8,603 行，最深 14 层                                         | P2     | 复杂度        | 无                       | 批次 3             | 待处理 |
| TD-API-001   | buildApp 单函数 ≈6,442 行、230 个顺序路由分支，吞掉 Service 层                          | P1     | 架构/复杂度   | 无                       | 批次 2             | 待处理 |
| TD-API-002   | app.ts 深嵌套：≥7 层 3,202 行，最深 14 层                                               | P2     | 复杂度        | 无                       | 批次 2             | 待处理 |
| TD-DUP-001   | 数据范围(DataScope) SQL 谓词在 12 个文件各复制一份                                      | P1     | 重复/安全     | 无                       | 批次 1             | 待处理 |
| TD-DUP-002   | audit_events + domain_event_outbox 双写 44 处/20 文件                                   | P1     | 重复          | 无                       | 批次 1             | 待处理 |
| TD-DUP-003   | 幂等键查询样板 23 行重复                                                                | P2     | 重复          | 无                       | 批次 1             | 待处理 |
| TD-DUP-004   | 前端日期格式化内联 12 处                                                                | P2     | 重复          | 无                       | 批次 3             | 待处理 |
| TD-ARCH-001  | foundation-repositories.ts 一文件 4 仓储 + 全仓仅有的 28 处 any + 文件级 eslint-disable | P2     | 架构/类型     | 无                       | 批次 1             | 待处理 |
| TD-ARCH-002  | CommercialController God store：load() 一次拉取 30+ 端点                                | P2     | 架构          | 无                       | 批次 3             | 待处理 |
| TD-BOUND-001 | API 响应边界无运行时形状校验（`as T` 裸转）                                             | P1     | 架构（T4/T5） | 无                       | 批次 3             | 待处理 |
| TD-BOUND-002 | 入站请求体校验为逐路由手写调用，无声明式 schema                                         | P2     | 架构          | 无                       | 批次 2             | 待处理 |
| TD-SEC-001   | 全链路无 Content-Security-Policy                                                        | P1     | 安全          | **变更行为**             | 批次 4（前置 D1）  | 待处理 |
| TD-SEC-002   | API 无限流/429，登录爆破仅 scrypt 成本兜底                                              | P1     | 安全          | **变更行为**             | 批次 4（前置 D1）  | 待处理 |
| TD-SEC-003   | 会话 token 存 sessionStorage，XSS 可读                                                  | P2     | 安全          | **变更行为**             | 批次 4（前置 D1）  | 待处理 |
| TD-SEC-004   | API 自身不设安全响应头，仅依赖生产 nginx                                                | P2     | 安全          | **变更行为**             | 批次 4（前置 D1）  | 待处理 |
| TD-SEC-005   | 动态 SQL 片段拼装面广，缺结构性约束防回归                                               | P2     | 安全/门禁     | 无                       | 阶段 3（结构测试） | 待处理 |
| TD-PERF-001  | 前端无自动重试/断路，失败依赖人工重试按钮                                               | P2     | 性能          | **变更行为**（仅实施时） | 待排期             | 待处理 |
| TD-PERF-002  | 13 处 N+1 查询候选点未判定                                                              | P2     | 性能          | 无                       | 批次 2（子批 2f）  | 待处理 |
| TD-TEST-001  | 2 个仓储模块完全无测试，2 个近乎无覆盖                                                  | P1     | 测试          | 无                       | 阶段 5             | 待处理 |
| TD-TEST-002  | 无任何覆盖率配置与阈值                                                                  | P1     | 测试/门禁     | 无                       | 阶段 5             | 待处理 |
| TD-TEST-003  | 6 个仓储模块仅 mock 路由级测试，SQL 路径未验证                                          | P2     | 测试          | 无                       | 阶段 5             | 待处理 |
| TD-TEST-004  | packages/ui、packages/testing 的占位测试                                                | P2     | 测试          | 无                       | 阶段 5（前置 D3）  | 待处理 |
| TD-TEST-005  | packages/types 占位测试：纯类型包的测试策略未定                                         | P2     | 测试          | 无                       | 阶段 5             | 待处理 |
| TD-GATE-001  | 无 git hooks / commitlint / lint-staged，脏提交仅靠 CI 兜底                             | P1     | 门禁          | 无                       | 阶段 3             | 待处理 |
| TD-GATE-002  | vitest 无配置文件，参数散落各包 scripts                                                 | P2     | 门禁          | 无                       | 阶段 3             | 待处理 |
| TD-DOC-001   | 无 AGENTS.md；docs/ 85+ 文档无统一索引与目标结构                                        | P1     | 文档          | 无                       | 阶段 2（前置 D4）  | 已完成 |
| TD-DOC-002   | 常驻文档未全量与代码核对（抽查 3 份即发现 1 处端点漂移）                                | P2     | 文档          | 无                       | 阶段 3（文档园丁） | 待处理 |
| TD-VER-001   | 版本号全部 0.0.0 占位，发布标识 = commit SHA                                            | P2     | 依赖/版本     | 无                       | 待决策（D2）       | 待处理 |
| TD-HYG-001   | 本地验收产物滞留工作区；packages/ui、testing 近空壳                                     | P2     | 文档/工程卫生 | 无                       | 待决策（D3）       | 待处理 |

---

## 复杂度

### TD-WEB-001｜bootstrap.ts 16,082 行巨石文件，七种职责混合

- **位置**：`apps/web/src/bootstrap.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P1
- **证据**：度量脚本计 16,082 行（`wc -l` 同文件为 16,081，口径差异见台账头部），占全部非测试源码（48 文件 / 41,451 行）的 **38.8%**。单文件同时承担：①33 个内联 type 定义 ②2 个 API 客户端工厂（`createFetchCommercialApi`/`createFetchCrmApi`）③3 个带可变状态的 Controller 类（`CommercialController`:1427、`CrmController`:10590、`GovernanceController`:14572）④全部 DOM 构建与表单引擎（`openForm`:11932 一带）⑤路由（`setAppRoute`:12296 一带）⑥localStorage 视图/侧栏持久化（4 处 `localStorage.` 访问）⑦打印与本地化文案。
- **修复建议**：按业务域拆分为分域视图模块 + 公共 shell/form/http-client/routing 模块；配合阶段 3 的文件大小上限门禁（T1）防止回潮。
- **业务行为影响**：无（纯重构）
- **关联批次**：批次 3 ｜ **验收方式**：文件行数门禁全绿 + 启动预算断言（`check-startup-budget.mjs`）+ `bootstrap.test.ts` 70 用例全绿 + `git diff` 行为零变化抽查

### TD-WEB-002｜commercialWorkspaceStructure 单函数 ≈8,551 行

- **位置**：`apps/web/src/bootstrap.ts:1851-10401`
- **类别**：复杂度 ｜ **严重度**：P1
- **证据**：度量脚本函数跨度分析：起止行 1851→10401，跨度 ≈8,551 行；函数内一次性构建 21 个商业子域视图（`data-route-view` 属性实测清单，线索→商机→报价→订单→生产→发货全链路）。
- **修复建议**：按子域拆分为独立 view builder，每个 ≤800 行（阈值在阶段 3 定死并机械化）。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：同 TD-WEB-001 + 新增结构测试断言"单函数 ≤ 阈值"

### TD-WEB-003｜bootstrap.ts 深嵌套

- **位置**：`apps/web/src/bootstrap.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P2
- **证据**：缩进直方图（脚本复算）：≥4 层 8,603 行（占 53.5%）、≥7 层 3,893 行、最深 14 层。
- **修复建议**：随批次 3 拆分自然消解大部分；残余热点用早返回/卫语句压平。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：嵌套直方图指标下降（脚本前后对比输出）

### TD-API-001｜buildApp 单函数 ≈6,442 行、230 个顺序路由分支

- **位置**：`apps/api/src/app.ts:383-6824`
- **类别**：架构/复杂度 ｜ **严重度**：P1
- **证据**：函数跨度分析 383→6824（≈6,442 行）；`grep -c 'request.method ==='` = 230 个顺序 if 分发分支；每个分支内联"校验+授权+编排+SQL 调用+DTO 组装"，本应存在的 Service 层被吞掉。现有测试保护：`app.test.ts` 35 用例（mock 注入）+ 13 个 PG 集成测试。
- **修复建议**：改为声明式路由表 + 分域 handler 文件；显式抽出 Service 层（Types→Config→Repo→Service→Runtime→UI 分层的存量适配起点，§4.1）。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：`pnpm test` 全绿 + 新增路由结构测试（路由表与实际行为对拍）+ 集成测试回归

### TD-API-002｜app.ts 深嵌套

- **位置**：`apps/api/src/app.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P2
- **证据**：缩进 ≥4 层 6,392 行、≥7 层 3,202 行、最深 14 层（if 分发→try/catch→校验→事务→条件 DTO 纵向叠加）。
- **修复建议**：随批次 2 路由表化消解。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：嵌套直方图指标下降

## 重复

### TD-DUP-001｜数据范围(DataScope) SQL 谓词 12 份拷贝

- **位置**：`apps/api/src/` 下 12 个文件（commercial、commission、complaint、crm、dashboard、foundation、order-360、platform、qtc、repositories、risk 各 \*-repositories.ts 及 `policy.ts`）；样例：`crm-repositories.ts:183`、`commercial-repositories.ts:76`
- **类别**：重复/安全 ｜ **严重度**：P1
- **证据**：`grep -l 'organization_scope_relationships' apps/api/src/*.ts` = 12 个文件，各自手写 `EXISTS (SELECT 1 FROM organizations anchor JOIN organization_scope_relationships …)` 谓词，结构同构、命名与参数风格各异。**这是 DataScope 越权防护的安全关键逻辑，同样的语义手写了 12 遍**——任何一处修复都要同步 12 处。
- **修复建议**：下沉到共享 `scope-sql` 模块（单一实现 + 单测覆盖各 scope 组合），12 处调用点替换。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：PG 集成测试全绿（含 DataScope 用例）+ `grep -l` 计数降为 1 个定义文件 + 对拍（同输入同结果）

### TD-DUP-002｜审计+事件外发双写 44 处/20 文件

- **位置**：`apps/api/src/` 20 个文件；样例 `crm-repositories.ts`（auditEvent）、`commercial-repositories.ts:81-97`（evidence）
- **类别**：重复 ｜ **严重度**：P1
- **证据**：`INSERT INTO audit_events` 出现 31 处/20 文件；`INSERT INTO domain_event_outbox` 13 处；两连写模式逐 repository 复制，字段顺序略异。
- **修复建议**：统一 `writeAuditWithOutbox` 共享助手（事务内两连写一处实现）。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：集成测试中审计与 outbox 断言全绿 + grep 计数下降（前后数值入进度日志）

### TD-DUP-003｜幂等键查询样板 23 行重复

- **位置**：`apps/api/src/` 多文件；样例 `crm-repositories.ts:500` 一带、`commercial-repositories.ts:127` 一带
- **类别**：重复 ｜ **严重度**：P2
- **证据**：含 `idempotency_key` 与 `SELECT` 的行 23 行命中（`*_command_results WHERE tenant_id=$1 AND idempotency_key=$2` 模式）。
- **修复建议**：共享幂等查询/写入助手。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：grep 计数下降 + 幂等性行为集成测试

### TD-DUP-004｜前端日期格式化内联 12 处

- **位置**：`apps/web/src/bootstrap.ts`（4091、4440、4498、4786 等分散各处）
- **类别**：重复 ｜ **严重度**：P2
- **证据**：`toLocaleString('zh-CN')`/`toLocaleDateString('zh-CN')` 内联 12 处，无共享 formatter。
- **修复建议**：收敛到共享 `format-date` 工具（一个语义一个实现，信条 B4/T6）。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：grep 计数降为 0（formatter 内 1 处实现）+ 快照对拍

## 架构与类型

### TD-ARCH-001｜foundation-repositories.ts 混装 4 仓储 + 28 处 any

- **位置**：`apps/api/src/foundation-repositories.ts`（1,106 行；文件头 eslint-disable；any 集中在 391-1093 行的 JSONB 读写区）
- **类别**：架构/类型 ｜ **严重度**：P2
- **证据**：单文件装 Notification/Attachment/BusinessObject/Event 4 个 repository；文件第 1 行整文件 `eslint-disable` 7 条 unsafe 规则；全仓非测试源显式 `any` 共 28 处且 **100% 在本文件**。
- **修复建议**：拆为 4 个文件；用边界解析（T4）替代 `any`（JSONB 读写处定义窄类型 + 运行时校验）。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：文件级 eslint-disable 删除后 lint 全绿 + `foundation-postgres.integration.test.ts` 回归

### TD-ARCH-002｜CommercialController God store

- **位置**：`apps/web/src/bootstrap.ts:1427`（类定义起）
- **类别**：架构 ｜ **严重度**：P2
- **证据**：`load()` 一次并发拉取 30+ 个端点（permission→path 对列表内联），持有 `views Map`（全端点读缓存）、`order360 Map`、`costMatrixDetails Map`、`dashboard`、`revisionState` 等 10+ 可变字段。
- **修复建议**：随批次 3 按域拆分为分域 store；加载策略改为按视图惰性加载。
- **业务行为影响**：无（加载时序不变或仅减少无关请求，若涉及可观察变化需单独登记） ｜ **关联批次**：批次 3 ｜ **验收方式**：路由隔离/竞态 e2e（`workspace-route-isolation.spec.ts`）全绿

### TD-BOUND-001｜API 响应边界无运行时形状校验

- **位置**：`apps/web/src/http.ts:66`（`return (…) as T`）；`apps/web/src/entry.ts:174-176`（sessionStorage 会话读取直接使用）
- **类别**：架构（不变量 T4/T5） ｜ **严重度**：P1
- **证据**：前端对 API 响应一律 `as T` 断言强转（`json<SessionDto>` 等），服务端字段变化在编译期不可见、运行时直接 YOLO 探字段；localStorage/sessionStorage 读取（视图缓存、侧栏状态）同样无形状校验。仓库无 zod/valibot/ajv 任何 schema 库。
- **修复建议**：按 §1.3「允许重新实现功能子集」：引入轻量运行时校验（或自研 ~100 行 parser），在 http 封装与存储读取两处边界统一解析。
- **业务行为影响**：无（校验失败路径新增报错属健壮性提升；若涉及行为变化单独登记） ｜ **关联批次**：批次 3 ｜ **验收方式**：故意注入畸形响应的单测（解析器拒绝）+ 现有 70 用例回归

### TD-BOUND-002｜入站请求体校验无声明式 schema

- **位置**：`apps/api/src/app.ts:145-357`（手写校验器群）、230 个分支逐路由手工调用
- **类别**：架构 ｜ **严重度**：P2
- **证据**：20+ 个手写校验器（`objectBody/string/boundedString/timestamp/…`）质量高但逐路由手工调用，新增路由漏调用无机械防护。
- **修复建议**：随批次 2 路由表化，把"必须过校验器"变成路由表的结构约束（结构测试拦截无校验的路由）。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：结构测试——注册无校验路由必须失败（实测）

## 安全（全部为「变更行为」类，前置人工决策 D1，独立批次 4 提交）

### TD-SEC-001｜全链路无 Content-Security-Policy

- **位置**：`infra/nginx/erp.kingturf.cn.conf`（仅 X-Content-Type-Options/X-Frame-Options/Referrer-Policy，无 CSP）；`apps/api/src/app.ts`（无安全头）；`apps/web/index.html`（无 meta CSP）
- **类别**：安全 ｜ **严重度**：P1 ｜ **业务行为影响**：**变更行为**
- **证据**：三层 grep `Content-Security-Policy` = 0 命中；bootstrap.ts 存在 17 处 `innerHTML`（已过 `sanitizeBusinessDocumentHtml` 白名单消毒，但缺 CSP 纵深防御；扫描方法见计划 §3.8）。
- **修复建议**：先 `Content-Security-Policy-Report-Only` 观察一个发布周期，再启用严格 CSP；落地位置优先 nginx（一处生效）。
- **关联批次**：批次 4 ｜ **验收方式**：e2e 断言 CSP 头存在 + Report-Only 期零违例报告 + 人工确认发布

### TD-SEC-002｜API 无限流/429

- **位置**：`apps/api/src/app.ts`（全文件 `grep '429'` = 0）；对照 `apps/web/src/login-flow.ts:11`（前端已预留 429 文案）
- **类别**：安全 ｜ **严重度**：P1 ｜ **业务行为影响**：**变更行为**（超限请求将收到 429）
- **证据**：登录爆破仅有 scrypt 计算成本兜底，无按 IP/账号的速率限制；其余 API 端点同样无限流。
- **修复建议**：登录端点先行（按 IP+账号双维度，内存滑窗即可，单实例部署无需 Redis）；范围与阈值属产品决策，**纳入 D1 一并确认**。
- **关联批次**：批次 4 ｜ **验收方式**：限流单测（超限得 429）+ 集成回归 + 人工确认阈值

### TD-SEC-003｜会话 token 存 sessionStorage，XSS 可读

- **位置**：`apps/web/src/entry.ts:129`（写入）、`entry.ts:174`（读取 `kingturf.session`）
- **类别**：安全 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若迁移 HttpOnly cookie）
- **证据**：opaque token（服务端存 sha256 哈希，安全性本身良好）存 sessionStorage；任何 XSS 可窃取。当前无 CSP（TD-SEC-001）使风险叠加。
- **修复建议**：短期以 CSP 缓解；中期评估迁移 HttpOnly cookie（会话模型 ADR-0003 为不透明会话，迁移影响登录/登出/过期全链路，成本高，**先过 D1 决策再动**）。
- **关联批次**：批次 4 ｜ **验收方式**：若迁移：会话 e2e（`session-revocation.spec.ts` 等）全绿 + 人工验收；若仅缓解：随 TD-SEC-001 验收

### TD-SEC-004｜API 自身不设安全响应头

- **位置**：`apps/api/src/app.ts`（`setHeader('X-…')` = 0 处）；对照 `infra/nginx/erp.kingturf.cn.conf:22-24`（生产有三头）
- **类别**：安全 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（响应头新增）
- **证据**：本地 dev、预览环境、以及任何绕过 nginx 的直连路径均无 `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`。
- **修复建议**：API 层统一中间件加三头（与 nginx 现值一致，双保险）。
- **关联批次**：批次 4 ｜ **验收方式**：`app.test.ts` 新增头断言 + e2e 回归

### TD-SEC-005｜动态 SQL 拼装面广，缺结构性约束

- **位置**：`apps/api/src/*-repositories.ts`（`clauses.join(' AND ')` 模式遍布）
- **类别**：安全/门禁 ｜ **严重度**：P2 ｜ **业务行为影响**：无（纯防护性约束，不改代码行为）
- **证据**：当前全部用户输入走 `pg` 参数化 `$1..$n`（未发现直拼用户输入，属现状良好）；但模板字符串拼 SQL 片段的模式面广，未来新增代码有直拼风险，无机械拦截。
- **修复建议**：阶段 3 写结构测试/linter：仓储层模板字符串中只允许出现 `$N` 占位符与代码内枚举白名单，出现其他插值即失败（错误信息附修复指令，§4.2）。
- **关联批次**：阶段 3 ｜ **验收方式**：故意注入直拼 SQL 的测试提交必须被门禁拦截（实测）

## 测试

### TD-TEST-001｜2 个仓储模块完全无测试，2 个近乎无覆盖

- **位置**：`apps/api/src/business-document-repositories.ts`（775 行，任何层 0 引用）、`production-cost-repositories.ts`（290 行，0 引用）；`quality-repositories.ts`（app.test.ts 仅 1 处引用）、`order-360-repositories.ts`（仅 2 处）
- **类别**：测试 ｜ **严重度**：P1
- **证据**：交叉验证：`grep -ci <module> apps/api/test/app.test.ts` 依次为 0/0/1/2，且 `apps/api/test/` 无对应测试文件（对比：commercial/crm/qtc/foundation 等 9 个域均有 `*-postgres.integration.test.ts`）。
- **修复建议**：阶段 5 按现有集成测试范式补齐（business-document 优先，行数最多）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：新增测试文件 + 注入缺陷实测必须失败（防假测试）

### TD-TEST-002｜无覆盖率配置与阈值

- **位置**：全仓（package.json 无 coverage 脚本；无 vitest coverage 配置；lockfile 无 `@vitest/coverage-*`）
- **类别**：测试/门禁 ｜ **严重度**：P1
- **证据**：`.gitignore:4` 有 `coverage/` 条目但目录从未生成过；现状无法回答"覆盖率多少"。
- **修复建议**：阶段 5 接入 `@vitest/coverage-v8`，整体下限 + 关键模块（apps/api 仓储层、packages/domain）单独下限，进 `ci:local`。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：覆盖率报告产出 + 低于阈值实测拦截

### TD-TEST-003｜6 个仓储模块仅 mock 路由级测试，SQL 路径未验证

- **位置**：`commission`/`dashboard`/`manufacturing`/`mrp`/`procurement`/`risk` 六个 `*-repositories.ts`
- **类别**：测试 ｜ **严重度**：P2
- **证据**：app.test.ts 引用计数 24/8/31/37/43/30（编排层有覆盖、仓储以 vi.mock 注入）；`apps/api/test/` 无这六个域的 `*-postgres.integration.test.ts`，真实 SQL 与 DataScope 谓词未验证。
- **修复建议**：阶段 5 补 PG 集成测试（复用现有集成测试范式与 fixtures）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：6 个域各有集成测试文件且全绿

### TD-TEST-004｜packages/ui、packages/testing 的占位测试

- **位置**：`packages/ui/src/index.test.ts`、`packages/testing/src/index.test.ts`（各 1 用例）
- **类别**：测试 ｜ **严重度**：P2
- **证据**：两包源码极小（ui 7 行、testing 3 行），测试为占位性质。
- **修复建议**：视 D3 对空壳包的处置决策而定（若合并/删除则本条随之关闭；若保留则补齐对现有导出的用例）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5（前置 D3） ｜ **验收方式**：随 D3 决策落地

### TD-TEST-005｜packages/types 占位测试：纯类型包的测试策略未定

- **位置**：`packages/types/src/index.test.ts`（1 用例）；对照 `packages/types/src/index.ts`（约 537 行纯 DTO/枚举/ErrorEnvelope 类型）
- **类别**：测试 ｜ **严重度**：P2
- **证据**：纯类型包的运行时测试意义有限（无逻辑可断言）；现状为占位用例，策略未定。**本条不依赖 D3**（types 是被全部包引用的活跃共享包，无去留问题，与空壳包性质不同）。
- **修复建议**：阶段 5 二选一并记录：①以类型级断言（`asserts`/`tsd` 风格或 `expectTypeOf`）替代运行时占位测试；②豁免并登记（豁免格式见计划 §5 阶段 5 阈值表）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：策略落盘且占位测试被替换或豁免登记

## 性能与可靠性

### TD-PERF-001｜前端无自动重试/断路，失败依赖人工重试按钮

- **位置**：`apps/web/src/http.ts`（封装内有 15s 超时与中止，无重试）；对照 `entry.ts:66-68`（"重新加载工作台"人工重试按钮）
- **类别**：性能 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（仅实施时——引入自动重试会改变失败路径的表现与请求次数）
- **证据**：`node scripts/analysis/audit-scan.mjs` S9 节：17 行命中（app.ts 1、foundation 5、bootstrap 5、document-send 1、entry 5），人工判定全部为人工重试按钮与幂等命令语义，自动重试/断路 0 处；网络失败目前靠登录页/启动失败视图的手动重试兜底（方法与限制见计划 §3.8）。
- **修复建议**：**待排期**：若实施，仅对幂等 GET 加单次自动重试（指数退避可选），并在实施前按行为变更登记、单独提交。
- **关联批次**：待排期（P2，登记不丢） ｜ **验收方式**：若实施：重试/放弃行为单测 + 请求次数断言

### TD-PERF-002｜13 处 N+1 查询候选点未判定

- **位置**：`contract-document-repositories.ts:188`、`foundation-repositories.ts:{142,276,434,995}`、`procurement-repositories.ts:{259,436}`、`manufacturing-repositories.ts:{207,295}`、`qtc-repositories.ts:{890,932}`、`complaint-repositories.ts:1063`、`production-cost-repositories.ts:85`
- **类别**：性能 ｜ **严重度**：P2
- **证据**：`node scripts/analysis/audit-scan.mjs` S6 节（for-of 循环块内含 `await` 的语法级检测，方法与限制见计划 §3.8）命中 13 处；是否构成真 N+1 取决于调用频次与数据量，**未判定**（当前无慢查询故障报告）。
- **修复建议**：批次 2 子批 2f 迁移路由时逐个判定：确证者（循环次数受用户输入影响）登记修复子任务并单独处理；误报者在本条标注关闭。
- **业务行为影响**：无（判定阶段零代码改动；确证修复另登记） ｜ **关联批次**：批次 2（子批 2f） ｜ **验收方式**：13 处全部有判定结论（确证/误报）记录于本条

## 门禁

### TD-GATE-001｜无 git hooks / commitlint / lint-staged

- **位置**：仓库根（`.husky/` 不存在；`.git/hooks/` 仅默认 `*.sample`；package.json 无相关字段）
- **类别**：门禁 ｜ **严重度**：P1
- **证据**：提交规范仅靠 PR 标题约定（历史均为 conventional commits 风格但无机械校验）；脏提交（lint 不过/格式错）只有 push 后 CI 兜底。
- **修复建议**：阶段 3 接入 lefthook 或 husky + commitlint + lint-staged，`pnpm ci:local` 的子集本地化；错误信息附修复指令。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：非 conventional 提交信息、含 lint 错误的提交在本地被实测拦截

### TD-GATE-002｜vitest 无配置文件

- **位置**：全仓 0 个 `vitest.config.*`；`apps/api` 的 `--maxWorkers=1` 只写在 package.json scripts
- **类别**：门禁 ｜ **严重度**：P2
- **证据**：集成测试串行要求（共享 PG schema）仅靠 CLI 参数记忆，无集中配置；覆盖率配置（TD-TEST-002）也无落点。
- **修复建议**：阶段 3 与覆盖率接入一并统一到 vitest 配置。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：配置文件存在且各包 scripts 引用一致

## 文档与工程卫生

### TD-DOC-001｜无 AGENTS.md；docs/ 85+ 文档无统一索引与目标结构

- **位置**：仓库根（无 AGENTS.md/CLAUDE.md）；`docs/`（adr 10、agent-memory 11、engineering 26+、evidence 14+、tasks 22+、deployment 2，另散文件）
- **类别**：文档 ｜ **严重度**：P1
- **证据**：规则要求的 `docs/exec-plans/`、`docs/design-docs/`、`AGENTS.md` 均不存在；现有 85+ 文档质量高但无 index、无新鲜度标注、无交叉链接校验，智能体无法判断哪份仍有效（B3/B5 违背）。
- **修复建议**：阶段 2 按 §2.1 建目标结构 + AGENTS.md（目标 ≤100 行，机械上限 200 行）+ docs/index.md；现有文档归并策略属 D4 决策。
- **处理中（2026-10-12，阶段 2a）**：AGENTS.md（53 行）、ARCHITECTURE.md、docs/index.md（101 文件全量索引 + doc-lint 链接校验实测通过）、core-beliefs/QUALITY_SCORE/RELIABILITY 已建立。剩余：2b 归并（阻塞 D4）+ 阶段 3 doc-lint 接入 `ci:local` 后关闭。
- **已完成（2026-10-12，阶段 2b）**：D4 已决策（方案 A 轻触式 + agent-memory 保留常驻；ROADMAP 与长任务计划均常驻）；index 状态列全量归并（**常驻 50 / 已归档-只读 54**，零文件移动、零死链）；抽样 3 份旧文档比对代码，发现并修正 IDENTITY_AUTHORIZATION.md 授权管理端点漂移（旧的 5 端点已被 `user-access-profiles` / `identities/{id}/state` / `audit-events` 三端点取代）。doc-lint 持续绿；其接入 `ci:local` 的持续强制属阶段 3（TD-GATE 范畴），本条按验收方式（lint 通过 + AGENTS ≤200 行）关闭。

### TD-DOC-002｜常驻文档未全量与代码核对

- **位置**：docs/ 常驻文档 50 份（阶段 2 按验收要求仅抽查 3 份）
- **类别**：文档 ｜ **严重度**：P2
- **证据**：抽查 3 份即命中 1 处漂移——IDENTITY_AUTHORIZATION.md 声明的 roles/permissions/grants/assignments/scope-grants 五端点在代码中不存在，实际为 `GET/PATCH /api/v1/user-access-profiles`（`identity:read|authorization:read` / `identity:manage|authorization:manage`）+ `GET /api/v1/audit-events`（`audit:read`），已于阶段 2b 修正（app.ts:5329-5356、aggregate-authorization.ts）。其余 47 份常驻文档未逐份核对，存在同类漂移风险。
- **修复建议**：阶段 3 建立文档园丁任务（规则 §2.4）：按目录分批核对常驻文档与代码一致性，被 README/AGENTS/ARCHITECTURE 引用者优先；发现漂移登记并修复。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3（文档园丁） ｜ **验收方式**：50 份常驻文档完成一轮核对并有记录；后续由定期园丁任务维持
- **业务行为影响**：无 ｜ **关联批次**：阶段 2（前置 D4） ｜ **验收方式**：文档 lint（链接可解析、必填节）通过 + AGENTS.md ≤200 行

### TD-VER-001｜版本号全部 0.0.0 占位，发布标识 = commit SHA

- **位置**：根及 8 个子包 `package.json` 的 `version` 字段；`apps/api/src/server.ts`（读取 `KINGTURF_RELEASE_SHA`）
- **类别**：依赖/版本 ｜ **严重度**：P2
- **证据**：全部 version = `0.0.0`；发布链路用 commit SHA 校验（`/version` 端点 + 部署后探针），该链路完整可靠。规则 §6.1 的"版本声明一致性"规范在此现状下无从落地，但也非缺陷。
- **修复建议**：**待人工决策 D2**：维持 SHA 标识（在 docs/CI.md 记录决定，规则 §6.1 标注不适用）或引入语义化版本（需一次 bump + guard）。
- **业务行为影响**：无 ｜ **关联批次**：待决策 ｜ **验收方式**：决策落盘 docs/CI.md

### TD-HYG-001｜本地验收产物滞留；近空壳包

- **位置**：`.local-acceptance/`（**10 个目录、36 个条目**，已被 .gitignore 忽略；复核命令 `find .local-acceptance -maxdepth 1 -type d | wc -l`）、`.test-results/`；`packages/ui/src/index.ts`（7 行）、`packages/testing/src/index.ts`（3 行）
- **类别**：文档/工程卫生 ｜ **严重度**：P2
- **证据**：验收期产物滞留工作区（不入库，仅本地噪音）；ui/testing 两包占位未长成，但被 apps/web 与各包 devDependencies 引用，不可贸然删（R5）。
- **修复建议**：**待人工决策 D3**：空壳包合并/长成/保留的处置；.local-acceptance 加清理脚本或保留策略说明。
- **业务行为影响**：无 ｜ **关联批次**：待决策 ｜ **验收方式**：决策落盘并执行

---

## 处置记录

| 日期       | 条目       | 动作                                                                                                                                                                                                             | 关联 commit                 |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- |
| 2026-10-12 | 全部 27 条 | 阶段 1 全量扫描登记（基线 779dea3）                                                                                                                                                                              | 本分支首次提交              |
| 2026-10-12 | 30 条      | 审核修订：TD-TEST-004 拆出 types 为 TD-TEST-005（脱离 D3）；新增 TD-PERF-001/002（§3.8 性能扫描落盘）；修正度量口径表述（脚本 vs `wc -l`）、`.local-acceptance` 计数（10 目录）、innerHTML 17 处、商业子域 21 个 | 本分支修订提交              |
| 2026-10-12 | TD-DOC-001 | 状态置「处理中」：阶段 2a 完成入口地图/架构总览/全量索引/doc-lint/核心信念/质量评分/runbook 六件                                                                                                                 | harnessing 分支 2a 系列提交 | 剩余 2b 归并（阻塞 D4）+ 阶段 3 doc-lint 进 ci:local 后关闭 |
| 2026-10-12 | TD-DOC-001 | 已完成（阶段 2b：D4 决策执行 + 抽查修正 1 处漂移）                                                                                                                                                               | harnessing 分支 2b 提交     |
| 2026-10-12 | TD-DOC-002 | 新登记：常驻文档未全量核对，抽查 3 份即发现 1 处端点漂移（已修）                                                                                                                                                 | 同上                        |
| 2026-10-12 | TD-DOC-001 | 复核修正：归并计数口径更正（常驻 50/归档 54）；ID_AUTH 三端点表述更正                                                                                                                                            | 阶段 2 复核提交             |
