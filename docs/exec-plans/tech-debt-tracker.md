# 技术债台账（tech-debt-tracker）

> 依据 `docs/HARNESS-RULES.md` 附录 B 字段定义维护。**本台账是长效文件**：结清的条目移除并记入对应提交，新发现的条目持续登记（§14.3）。
>
> - **度量基线**：commit `779dea3`（2026-10-12），全部数字可用 `node scripts/analysis/repo-metrics.mjs` 复算。
> - **度量口径**：行数以度量脚本为准（内容按换行符切分，含末段空行），与 `wc -l` 相差 ≤1 行/文件（如 bootstrap.ts：脚本 16,082 / `wc -l` 16,081）；两者差异不影响任何结论的量级。函数跨度为起止行号差，两口径相同。
> - **业务行为影响**取值：`无`（纯重构）／`修复 bug`（纠正错误行为）／`变更行为`（有意改变外部可观察行为，必须单独提交并前置人工决策）。
> - **初始扫描（779dea3）未发现明确的功能性 bug**；计划内安全加固归入独立批次 4 并前置决策 D1。后续新增问题按各自业务影响与人工决策边界处置，与纯重构严格分离（红线 R2）。

## 索引

**CDP工具登记（2026-10-16，现38顶层项，原37历史保持）**：新增TD-TEST-006，仅本批自有合成浏览器驱动可靠性，业务行为影响无。旧driver单帧命中后再次scroll/取点、未等导航布局稳定；真实诊断看到13.3ms内目标下移25px、同坐标变邻项命中，但前两次导航失败的实际事件target未捕获，根因不作全证声明。先登记，随后只做独立最小工具修正和负向验证，不改业务/Playwright/原超时/断言/网络硬闸。

**E1现时更新（2026-10-16）**：父项2f/GATE003已人工验收b575b9c；E1已授权守恒去嵌套并撤例外，完整CI0/0硬31软，不再是32。下面原A/B待验收/32说明保留旧时点，E1关闭及前端停报不改其他债务。

**本轮现时更新（2026-10-16，A/B待人工验收）**：TD-PERF-002的13/13判定完成，7确证仅登记R1–R7修复/6有界误报关闭该候选；TD-GATE-003扫描覆盖已修复，仍留E1精确限期例外。32信息豁免＝旧31逐条保持＋1，台账仍37顶层项。下方旧“未修复/未判定”登记及7/24口径按历史时点保留，不当作当前状态；生产性能未实测、不是全体风险已消除。

**登记现状更新（2026-10-16，TD-GATE-003）**：当前登记37条（包含已解决历史项）；新增P1工程门禁覆盖缺口，静态遗漏已证、未修复／动态影响待核实，业务行为影响无。仅本独立登记获R4授权，旧36条正文/索引和处置历史不回写。

**登记前快照（原36条，保留原文）**：

当前登记36条（包含已解决历史项）；TD-REG-001迁移求值/receiver回归已协调确认解决并按本轮授权留存，原35条与历史时点保持，不改其他债务状态。

| ID           | 标题                                                                                          | 严重度 | 类别          | 业务行为影响             | 关联批次                           | 状态             |
| ------------ | --------------------------------------------------------------------------------------------- | ------ | ------------- | ------------------------ | ---------------------------------- | ---------------- |
| TD-WEB-001   | bootstrap.ts 16,082 行巨石文件，七种职责混合                                                  | P1     | 复杂度        | 无                       | 批次 3                             | 待处理           |
| TD-WEB-002   | commercialWorkspaceStructure 单函数 ≈8,551 行                                                 | P1     | 复杂度        | 无                       | 批次 3                             | 待处理           |
| TD-WEB-003   | bootstrap.ts 深嵌套：≥4 层 8,603 行，最深 14 层                                               | P2     | 复杂度        | 无                       | 批次 3                             | 待处理           |
| TD-API-001   | buildApp 单函数 ≈6,442 行、230 个顺序路由分支，吞掉 Service 层                                | P1     | 架构/复杂度   | 无                       | 批次 2                             | 待处理           |
| TD-API-002   | app.ts 深嵌套：≥7 层 3,202 行，最深 14 层                                                     | P2     | 复杂度        | 无                       | 批次 2                             | 待处理           |
| TD-REG-001   | QTC 前六模块提前读取仓储根，违反旧求值/receiver契约                                           | P1     | 重构回归      | 修复 bug（恢复旧契约）   | 2b独立回归恢复                     | 已解决（留历史） |
| TD-DUP-001   | 数据范围(DataScope) SQL 谓词在 12 个文件各复制一份                                            | P1     | 重复/安全     | 无                       | 批次 1                             | 已完成           |
| TD-DUP-002   | audit_events + domain_event_outbox 双写 44 处/20 文件                                         | P1     | 重复          | 无                       | 批次 1                             | 已完成           |
| TD-DUP-003   | 幂等键查询样板 23 行重复                                                                      | P2     | 重复          | 无                       | 批次 1                             | 已完成           |
| TD-DUP-004   | 前端日期格式化内联 12 处                                                                      | P2     | 重复          | 无                       | 批次 3                             | 待处理           |
| TD-ARCH-001  | foundation-repositories.ts 一文件 4 仓储 + 全仓仅有的 29 处代码级 any + 文件级 eslint-disable | P2     | 架构/类型     | 无                       | 批次 1                             | 已完成           |
| TD-ARCH-002  | CommercialController God store：load() 一次拉取 30+ 端点                                      | P2     | 架构          | 无                       | 批次 3                             | 待处理           |
| TD-BOUND-001 | API 响应边界无运行时形状校验（`as T` 裸转）                                                   | P1     | 架构（T4/T5） | 无                       | 批次 3                             | 待处理           |
| TD-BOUND-002 | 入站请求体校验为逐路由手写调用，无声明式 schema                                               | P2     | 架构          | 无                       | 批次 2                             | 待处理           |
| TD-BOUND-003 | calendarDate 放行不存在的日历日期到仓储，真实 PG 影响待核实                                   | P2     | 边界校验      | 变更行为（若收紧）       | 待独立人工决策，不在当前 2b 修复   | 待核实           |
| TD-BOUND-004 | complaint batch 字符串去重放行同一 UUID 大小写变体，真实副作用待核实                          | P2     | 边界校验      | 变更行为（若收紧）       | 待独立人工决策，不阻塞 2b 守恒迁移 | 待核实           |
| TD-SEC-001   | 全链路无 Content-Security-Policy                                                              | P1     | 安全          | **变更行为**             | 批次 4（前置 D1）                  | 待处理           |
| TD-SEC-002   | API 无限流/429，登录爆破仅 scrypt 成本兜底                                                    | P1     | 安全          | **变更行为**             | 批次 4（前置 D1）                  | 待处理           |
| TD-SEC-003   | 会话 token 存 sessionStorage，XSS 可读                                                        | P2     | 安全          | **变更行为**             | 批次 4（前置 D1）                  | 待处理           |
| TD-SEC-004   | API 自身不设安全响应头，仅依赖生产 nginx                                                      | P2     | 安全          | **变更行为**             | 批次 4（前置 D1）                  | 待处理           |
| TD-SEC-005   | 动态 SQL 片段拼装面广，缺结构性约束防回归                                                     | P2     | 安全/门禁     | 无                       | 阶段 3（结构测试）                 | 已完成           |
| TD-SEC-006   | complaint 锚点谓词语义弱于其他域（osr 单表、TEAM 无 depth、无组织有效性校验）                 | P2     | 安全/一致性   | **变更行为**（若统一）   | 待决策（批次 1 后）                | 待处理           |
| TD-SEC-007   | foundation 通知收件人谓词缺省省略 actor_org/authorized_org 两处组织有效性 JOIN                | P2     | 安全/一致性   | **变更行为**（若统一）   | 待决策（批次 1 后）                | 待处理           |
| TD-PERF-001  | 前端无自动重试/断路，失败依赖人工重试按钮                                                     | P2     | 性能          | **变更行为**（仅实施时） | 待排期                             | 待处理           |
| TD-PERF-002  | 13 处 N+1 候选已判定；7项修复待排                                                             | P2     | 性能          | 无                       | 批次 2（子批 2f）                  | 已判定／待修复   |
| TD-TEST-001  | 2 个仓储模块完全无测试，2 个近乎无覆盖                                                        | P1     | 测试          | 无                       | 阶段 5                             | 待处理           |
| TD-TEST-002  | 无任何覆盖率配置与阈值                                                                        | P1     | 测试/门禁     | 无                       | 阶段 5                             | 待处理           |
| TD-TEST-003  | 6 个仓储模块仅 mock 路由级测试，SQL 路径未验证                                                | P2     | 测试          | 无                       | 阶段 5                             | 待处理           |
| TD-TEST-004  | packages/ui、packages/testing 的占位测试                                                      | P2     | 测试          | 无                       | 阶段 5（前置 D3）                  | 已完成           |
| TD-TEST-005  | packages/types 占位测试：纯类型包的测试策略未定                                               | P2     | 测试          | 无                       | 阶段 5                             | 待处理           |
| TD-TEST-006  | 临时CDP驱动未等待导航目标几何稳定，动画窗口可误点邻项                                         | P2     | 测试可靠性    | 无（仅测试工具）         | 批次3自有CDP验证                   | 待最终门禁       |
| TD-GATE-001  | 无 git hooks / commitlint / lint-staged，脏提交仅靠 CI 兜底                                   | P1     | 门禁          | 无                       | 阶段 3                             | 已完成           |
| TD-GATE-002  | vitest 无配置文件，参数散落各包 scripts                                                       | P2     | 门禁          | 无                       | 阶段 3                             | 已完成           |
| TD-GATE-003  | routes覆盖已修复；E1已撤，恢复31旧豁免                                                        | P1     | 工程门禁      | 无                       | 独立门禁任务／阶段5前复核          | 已验收           |
| TD-DOC-001   | 无 AGENTS.md；docs/ 85+ 文档无统一索引与目标结构                                              | P1     | 文档          | 无                       | 阶段 2（前置 D4）                  | 已完成           |
| TD-DOC-002   | 常驻文档未全量与代码核对（抽查 3 份即发现 1 处端点漂移）                                      | P2     | 文档          | 无                       | 阶段 3（文档园丁）                 | 待处理           |
| TD-VER-001   | 版本号全部 0.0.0 占位，发布标识 = commit SHA                                                  | P2     | 依赖/版本     | 无                       | D2 已决策（保留 SHA）              | 已完成           |
| TD-HYG-001   | 本地验收产物滞留工作区；packages/ui、testing 近空壳                                           | P2     | 文档/工程卫生 | 无                       | D3 已执行                          | 已完成           |

---

## 重构回归

### TD-REG-001｜QTC 前六模块提前读取仓储根，违反旧求值/receiver契约

- **位置**：起点7251b08的app.ts:2618,2630,2648,2663,2681,2697,2713及qtc-base-reads、qtc-operational-reads、qtc-credit-writes、qtc-credit-approval、qtc-contract-create、qtc-contract-sign六模块，共12canonical。
- **类别**：重构回归 ｜ **严重度**：P1 ｜ **状态**：已解决（2026-10-14，f8059a8/ab0f3d4经协调复核确认，按本轮授权保留历史台账项；不关闭TD-API/TD-BOUND或其他安全债，不等于整体2b验收）。
- **解决协调证据**：固定源码CI124751ms/HEAD125573ms真实exit0/API1078852、QTC PG2/doclint103/structure0违规31豁免/build/audit绿/干净树；协调65mock-only8469/8469、独立深审七late inject/六module捕获点/refs/335固定guard及旧2389/探针限制无阻塞。51182b7以后工件零diff，before154fail181pass→after335green保持；revert f8059a8会重新暴露已固定335套件中的154回归红灯，不应改预期消红。仅directmock旧求值/receiver恢复，不当作产品决策或已证生产漏洞；本轮QTC全域文档收尾不改源码，最终文档HEAD另完整门禁。
- **恢复证据（2026-10-14）**：登记acba392、固定旧护栏51182b7、修复f8059a8单独提交。旧c7833e7/起点7251b08的12入口166场景、335契约在修复前154失败/181通过，恢复后335全绿，旧十组2389零diff；合计2724/2724、相关8659/8659、前后QTC PG2/2、独立review/byte还原/源码固定完整CI真实0（API107/8852）。范围仅七处注入/六模块repository-method捕获及receiver绑定，后四QTC/SQL/产品规则不动，directmock/非hermetic历史依赖及参数值限制见计划§4.2.7。最终状态文档HEAD另完整CI复验；回滚fix f8059a8会重现被冻结的红灯，登记/护栏/日志可独立revert，原35条及TD-BOUND/D1/TD-API/评分不扩。
- **证据**：旧c7833e7:app.ts2588–2756在授权/前置query/allow/decision校验之后才取得root-method；迁移后factory context提前读取第二次根。directmock allow ownKeys替换整个依赖根：旧credit-limit201/second receiver，7251b08当前201/first receiver；第二根getter异常还能改变错误优先级。协调与独立只读源码核验已确认，主代理可复算探针及护栏另落盘；原2389契约不覆盖该边界，不能因其绿否定差异。
- **影响边界**：仅已证directmock可变依赖注入的求值时序与接收者回归，未验证生产依赖动态替换，非已证生产权限漏洞；不改变产品、DataScope、SQL或业务算法，TD-BOUND-003/004/D1不扩。
- **修复建议**：七处注入改晚resolver，六module在旧method点取root-method并保存validated.repository，handler绑定已捕获receiver；后四QTC模块不动。
- **业务行为影响**：修复 bug（恢复旧c7833e7契约，不新增产品行为） ｜ **关联批次**：2b独立回归恢复小步，人工已授权。
- **验收方式**：固定旧基线对拍/变更前真实失败/12入口时点与root计数护栏、十旧组冻结、前后PG2、独立review、代码及文档HEAD完整CI真实0后停协调；状态不凭提取数量关闭。

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

### TD-DUP-001｜数据范围(DataScope) SQL 谓词 12 份拷贝（已完成）

- **位置**：`apps/api/src/` 下 12 个文件（commercial、commission、complaint、crm、dashboard、foundation、order-360、platform、qtc、repositories、risk 各 \*-repositories.ts 及 `policy.ts`）；样例：`crm-repositories.ts:183`、`commercial-repositories.ts:76`
- **类别**：重复/安全 ｜ **严重度**：P1
- **关闭证据（2026-10-12）**：`rg -n 'organization_scope_relationships' apps/api/src --glob '*.ts'` 命中仅 `scope-sql.ts`；`rg -n 'customerScope|scopePredicate|recipientScope' apps/api/src --glob '*.ts'` 无生产 helper 定义（`repositories.ts.#scoped` 仅委托 `employeeScopedPredicate`）；所有 repository 调用均导入 `recordScopeSql`、`employeeScopedPredicate` 或 `auditScopePredicate`。完整 scope 对拍、API 全量和 `pnpm ci:local` 均通过。共享出口为 `recordScopeSql`、`employeeScopedPredicate`、`auditScopePredicate`；complaint 的 `relationshipOnly` 与 foundation 的 `actorOrganizationValidation: 'skip'` 显式语义选项保留，TD-SEC-006/007 继续待决。
- **修复结果**：已下沉到共享 `scope-sql` 模块，12 个重复定义清零；回滚点分别为 `56e6603`、`b33813c`、`809e3e8`、`61adc15`、`2540f12`、`f810229`（按子批次独立回滚）。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：PG 集成测试全绿（含 DataScope 用例）+ `grep -l` 计数降为 1 个定义文件 + 对拍（同输入同结果）

### TD-DUP-002｜审计+事件外发双写 44 处/20 文件

- **位置**：`apps/api/src/` 20 个文件；样例 `crm-repositories.ts`（auditEvent）、`commercial-repositories.ts:81-97`（evidence）
- **类别**：重复 ｜ **严重度**：P1
- **证据**：`INSERT INTO audit_events` 出现 31 处/20 文件；`INSERT INTO domain_event_outbox` 13 处；两连写模式逐 repository 复制，字段顺序略异。
- **修复建议**：统一 `writeAuditWithOutbox` 共享助手（事务内两连写一处实现）。
- **关闭证据（2026-10-13）**：生产 `INSERT INTO audit_events` 与 `INSERT INTO domain_event_outbox` 定义仅位于 `apps/api/src/audit-outbox.ts`；其余命中均为 outbox 读取/更新或业务 RETURNING。标准两连写、固定版本、next-version、显式 audit-only、business-document outbox 与 foundation enqueue 均已通过显式出口收敛。全量 API、database、web、domain、build、security audit 与 `pnpm ci:local` 通过；TD-DUP-003 不变，TD-SEC-006/007 保持待决。
- **试点进展（2026-10-12）**：qtc、manufacturing、commission 三域已收敛至 `apps/api/src/audit-outbox.ts:writeAuditOutbox`，替换 13 个调用点；其余 17 个文件保持未修改，TD-DUP-002 继续处理中。试点提交 `d47d48c`，`audit-outbox` 单测、三域集成与 `pnpm ci:local` 全部通过。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：集成测试中审计与 outbox 断言全绿 + grep 计数下降（前后数值入进度日志）

### TD-DUP-003｜幂等键查询样板 23 行重复

- **位置**：`apps/api/src/command-results.ts:13,29,62`；commercial 接入点 `apps/api/src/commercial-repositories.ts:83-90`（7 个 replay + 7 个 retain 调用）；qtc 接入点 `apps/api/src/qtc-repositories.ts:43-61`（9 个 command 调用）。
- **类别**：重复 ｜ **严重度**：P2
- **最终证据（2026-10-13）**：只读复核命令 `rg -n "pg_advisory_xact_lock|SELECT .*idempotency_key.*FROM|crm_command_results|commercial_command_results|commandLock|eventReplay" apps/api/src apps/api/test packages/database/migrations`；commercial/qtc 的同语义表为 `commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload)`，统一冲突字段为 type/subject/actor/request hash，统一锁参数 `${tenantId}:${key}`，锁后 replay；`command-results.test.ts` 固定 SQL/参数、首写、payload 重放及四类冲突，commercial PostgreSQL 2/2、qtc PostgreSQL 2/2。
- **安全豁免（明确语义差异）**：CRM 仅一个 `LEAD_CLAIM` 命令（`crm-repositories.ts:443,463,504`），表字段为 `command_type/subject_id/payload/request_fingerprint`，锁为双 hash，顺序为锁→DataScope subject→replay；customer activity 是普通业务表幂等。complaint 的 `commandLock` 在 `complaint-repositories.ts:53` 被 11 个不同 namespace 调用，`eventReplay`（`:1211`）由 complaint/ncr 两个动态表调用，依赖 `canonical_hash/evidence/expected_version/state`；foundation notifications（`foundation-repositories.ts:312-342`）先 recipients DataScope，再锁→replay，冲突字段为 `normalized_recipients/semantic_payload`。这些路径没有第二个同语义、可安全共用的固定接口，保留本地实现。
- **其他域复核**：risk（2 个锁/replay）、commission（2）、business-document（2）、platform（3）、website-lead（1）及 qtc 内 4 个 customer credit-ledger 锁均是业务表/状态或资源串行化，不是 command-results 同语义；普通 `idempotency_key` 表路径不纳入共享原语。
- **修复结果**：公共 commercial/qtc lock/replay/retain 原语已收敛；CRM、complaint、foundation 及其他语义不同路径明确豁免，不再强行抽象。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：机械复核命令如上；`pnpm ci:local` 全绿（API 35 文件/260 用例、database 68、web 114、domain 14），另通过 typecheck/lint/format/structure/doc-lint/audit/build；回滚：`git revert 8dcc971`（代码）及对应计划/台账文档提交。

### TD-DUP-004｜前端日期格式化内联 12 处

- **位置**：`apps/web/src/bootstrap.ts`（4091、4440、4498、4786 等分散各处）
- **类别**：重复 ｜ **严重度**：P2
- **证据**：`toLocaleString('zh-CN')`/`toLocaleDateString('zh-CN')` 内联 12 处，无共享 formatter。
- **修复建议**：收敛到共享 `format-date` 工具（一个语义一个实现，信条 B4/T6）。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：grep 计数降为 0（formatter 内 1 处实现）+ 快照对拍

## 架构与类型

### TD-ARCH-001｜foundation-repositories.ts 混装 4 仓储 + 29 处代码级 any（已完成）

- **位置**：`apps/api/src/foundation-repositories.ts` facade（当前 14 行）；拆分目标为 `event-repositories.ts`（232 行）、`notification-repositories.ts`（255 行）、`attachment-repositories.ts`（341 行）、`business-object-repositories.ts`（242 行）、`foundation-object-access.ts`（67 行）。
- **类别**：架构/类型 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：Event、Notification、Attachment、BusinessObject 四个仓储及对象访问 support 已拆出；`foundation-repositories.ts` 仅保留兼容性 re-export，app/server/既有测试 import 路径不变。机械命令 `rg -n '\\bany\\b|eslint-disable' apps/api/src --glob '*.ts' --glob '!*.test.ts'` 实测生产源码 any=0，`foundation-repositories.ts` 文件级 eslint-disable=0（目标文件中的局部 non-null invariant 注释不属于文件级禁用）。foundation API/PG、typecheck、lint、format、structure、doc-lint、build、security 与 `pnpm ci:local` 全部通过。
- **修复结果**：已完成；原始 1,029 行基线不再作为现状，当前 facade 与五个拆分文件行数以本条位置证据为准。JSONB 使用固定 SQL 投影/BusinessObjectSchema，运行时校验边界保留。
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

### TD-BOUND-003｜calendarDate 放行不存在的日历日期到仓储

- **位置**：`apps/api/src/app.ts` 的 `calendarDate`（登记时 205-210 行）；`apps/api/test/cost-matrix-factor-contract.test.ts` 的 `retains calendarDate shape/Date.parse normalization behavior`（登记时 356 行）。
- **类别**：边界校验 ｜ **严重度**：P2 ｜ **状态**：待核实 / 待独立人工决策。
- **事实证据**：原 helper 仅检查 `YYYY-MM-DD` 形状与 `Date.parse` 非 NaN，`2026-02-30` 因日期溢出归一化而通过；冻结的 POST/PATCH 契约证明原字符串可传给 mock 仓储。因子迁移原样保留此行为，未修复。
- **复核命令**：`pnpm --filter @kingturf/api exec vitest run test/cost-matrix-factor-contract.test.ts -t "retains calendarDate"`。此命令验证 HTTP 校验到 mock 仓储的边界，不证明真实 PostgreSQL 接收或存储了该日期。
- **未核实范围**：真实 PG 响应、存储影响、全部 helper 调用点及产品对合法日历日期的要求；不得据 mock 测试声称生产已接受非法日期。
- **后续建议**：先逐调用点和隔离测试库核实影响，再形成日历日期真实性校验的独立方案，提交人类裁决。
- **业务行为影响**：若拒绝原来被放行的输入，属于行为变更；必须获独立人工批准、单独提交，不属于当前声明式路由迁移 TD-BOUND-002 的关闭范围，也不属于 D1 四项安全加固授权。
- **关联批次**：待独立排期；不阻塞 2b 因子路由的行为守恒迁移。
- **关闭条件**：影响与语义核实、人工批准（如需收紧）、独立回归/真实 PG 证据和修复提交齐备；本次仅登记，不标已修复。

### TD-BOUND-004｜complaint batch 字符串去重放行同一 UUID 大小写变体

- **位置**：旧基线 `d17dbc9` 的 `apps/api/src/app.ts:247-254`（UUID 正则/helper）和 `:1713-1717`（batch Set 去重）；当前 `apps/api/src/app.ts:248-255` 的同一正则/helper、`apps/api/src/routes/complaint-batch-triage.ts:52`；冻结 `apps/api/test/complaint-batch-route-contract.test.ts:287-310`（旧契约提交 `d0799b6`）；仓储 `apps/api/src/complaint-repositories.ts:1043-1077`（逐项 transition）。
- **类别**：边界校验 ｜ **严重度**：P2 ｜ **状态**：待核实 / 待独立人工决策。
- **已证事实**：UUID 正则带 `i` 忽略大小写，helper 验证后返回 trim 的原字符串；旧/新 Set(items.map(id)) 均按字符串区分大小写。旧 d17dbc9 的固定 HTTP/mock 契约接受 `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` 与其大写变体两行，原样传给 mock 仓储；此为旧行为，路由迁移未引入。协调复核在本地 `kingturf_test` 只读执行 `SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'::uuid AS same_uuid;`，结果 `t`，仅证明 PostgreSQL UUID 身份相等。
- **可复跑 mock 契约**：`pnpm --filter @kingturf/api exec vitest run test/complaint-batch-route-contract.test.ts -t "UUID case is preserved"`。本命令只验证 HTTP 校验到 mock 仓储的接受结果，不证明真实 batch 写入或 replay 副作用。上述 SELECT 不写数据库；本登记轮不新增真实 batch 写入实验或生产验证。
- **候选风险（推断）/未核实范围**：仓储仍逐项独立 transition，同一逻辑 UUID 可能重复处理或产生版本/幂等冲突；实际状态、部分失败、requestHash/canonical、派生幂等键、审计和重放影响均未验证。现有 PG mixed/replay 测试没有专门验证大小写变体。不得据此声称已证数据损坏、权限绕过或生产事故。
- **后续建议**：独立排期，先在隔离本地测试库核实相同逻辑 UUID 的批处理影响、幂等兼容和审计证据，再提出 UUID 规范化或逻辑身份去重拒绝方案，明确受影响调用点与存量 replay 兼容性，提交人类裁决。
- **业务行为影响/审批边界**：收紧重复拒绝或 UUID 规范化会改变旧请求接受结果及幂等 canonical 形态，必须独立人工批准、单独行为提交；不属于当前 TD-BOUND-002 声明式迁移或 D1 四项安全加固授权。当前保持 helper/Set/repository/56 oracle/header/交集语义，不修行为。
- **关联批次**：待独立排期；不阻塞 2b 行为守恒迁移，不在本轮安排生产验证。
- **关闭条件**：真实 batch 影响及幂等/审计/replay 语义核实、人工行为批准（如需收紧）、独立回归与真实 PG 证据、修复提交及兼容说明齐备；本次仅登记，不标已完成。TD-BOUND-003 日期问题保持待核实。

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
- **已完成（2026-10-12，阶段 3；经三轮迭代达标）**：
  - **第一版（黑名单制，误标完成）**：只拦 request/req/body 等开头，人工复核实测 `${input.name}`、`${foo}` 可绕过。
  - **第二版（形状白名单，仍不达标）**：枚举 apps/api/src 全部 74 种 SQL 模板插值形态并分类为结构模式/枚举标识符/枚举表索引/双字面量三元 + 存量值插值 6 处显式豁免（anchorId/actorId/companyId，到期=批次 1）。第二轮复核实测 7 个**不可信根形状样本**穿透：`${input.sql}`、`${input.predicate}`、`${input.join(' AND ')}`、`${String(input)}`、`${input[view]}`、`${foo[bar]}`、`${scope(input, 'cu', 3).sql}`——正则只限形状不限根，"白名单之外一律失败"未成立。
  - **第三版（形状 × 可信根双重约束，当前版）**：每类模式绑定显式登记的根——片段组合根 ∈ {secured,scope,s,scoped,authorized,leadScope,opportunityScope}；子句拼接根 ∈ {clauses,where}；枚举表索引 = 精确对 {definitions[view]}；调用式钉死 `scope(context, '<字面量>', <数字>).sql`；占位符构造参数 token ∈ {offset, values.length, values.push(<标识符链>), 整数}；三元整条禁止反引号（防嵌套模板）且分支为纯字面量。**实测：第二轮 7 样本注入全部退出码 1（7/7 命中）**；第一轮 2 样本维持退出码 1；自测 14 用例（含不可信根回归 9 样本与可信根对照 6 样本）全过；真实代码 0 强制违规、39 条豁免全部显式登记。
- **关联批次**：阶段 3 ｜ **验收方式**：故意注入直拼 SQL 的测试提交必须被门禁拦截（实测）✓（三轮样本共 11 个，全部退出码 1）

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

### TD-TEST-004｜packages/ui、packages/testing 的占位测试（已完成）

- **位置（历史）**：`packages/ui/src/index.test.ts`、`packages/testing/src/index.test.ts`（D3 执行前各 1 用例；现已删除）
- **类别**：测试 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：全仓 `rg` 确认 `createBootstrapView`、`parseJson`、`@kingturf/ui`、`@kingturf/testing` 无生产消费者；两个 workspace 包及占位测试已删除，web 依赖与 lockfile importer 已同步移除。
- **修复结果**：D3 删除方案已执行，不再保留无消费者空壳测试。
- **业务行为影响**：无 ｜ **关联批次**：D3 ｜ **验收方式**：依赖清理 + format/typecheck/lint/build/doc-lint/structure/`pnpm ci:local` 全绿

### TD-TEST-005｜packages/types 占位测试：纯类型包的测试策略未定

- **位置**：`packages/types/src/index.test.ts`（1 用例）；对照 `packages/types/src/index.ts`（约 537 行纯 DTO/枚举/ErrorEnvelope 类型）
- **类别**：测试 ｜ **严重度**：P2
- **证据**：纯类型包的运行时测试意义有限（无逻辑可断言）；现状为占位用例，策略未定。**本条不依赖 D3**（types 是被全部包引用的活跃共享包，无去留问题，与空壳包性质不同）。
- **修复建议**：阶段 5 二选一并记录：①以类型级断言（`asserts`/`tsd` 风格或 `expectTypeOf`）替代运行时占位测试；②豁免并登记（豁免格式见计划 §5 阶段 5 阈值表）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：策略落盘且占位测试被替换或豁免登记

### TD-SEC-006｜complaint 锚点谓词语义弱于其他域

- **位置**：原 complaint-repositories.ts:42-58（批次 1b 迁移后由 scope-sql.ts 的 `anchorPredicate='relationshipOnly'` 显式表达）；对照其余 11 域的 organizationJoin 形态
- **类别**：安全/一致性 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若统一为 organizationJoin 形态）
- **证据**：批次 1b-complaint 迁移时发现并经特征化测试固定（test/scope-sql-complaint.test.ts）：complaint 的锚点 EXISTS 只查 organization_scope_relationships 单表——无 organizations JOIN、无组织 active/deleted 与 organization_type 校验、TEAM 无 depth<=1 限制；租户校验在 osr.tenant_id 上、类型匹配用 osr.scope 列。其余 11 域均为 JOIN organizations + 类型/租户/有效性校验 + TEAM depth。行为已按原样守恒迁移，未修改。
- **修复建议**：批次 1 完成后决策：①统一为 organizationJoin 形态（属行为变更，需单独提交+人工批准+集成测试补 DataScope 用例）；或②确认 osr 行的维护约束（触发器/迁移）已足以替代组织有效性校验并记录决策依据。
- **业务行为影响**：无（当前为登记；统一时为变更行为） ｜ **关联批次**：待决策（批次 1 后） ｜ **验收方式**：决策落盘；若统一，complaint 集成测试补锚点 DataScope 用例（含 deleted anchor 组织负例）

### TD-SEC-007｜foundation 通知收件人谓词缺省省略组织有效性 JOIN

- **位置**：原 foundation-repositories.ts recipientScope（批次 1b 迁移后由 scope-sql.ts 的 `employeeScopedPredicate(..., { actorOrganizationValidation: 'skip' })` 表达）；对照 repositories 员工域变体（缺省 'validate'）
- **类别**：安全/一致性 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若统一为 validate 形态）
- **证据**：批次 1b-foundation 迁移时发现并经特征化测试固定（test/scope-sql-foundation.test.ts）：foundation 变体的隐式类型锚点 EXISTS 不 JOIN `actor_org`（不校验 actor 自身组织的有效性/归属），actorExists 不 JOIN `authorized_org`（不校验 actor 组织属于其公司且有效）——与 repositories 员工域变体（两处 JOIN 均在位）是真实语义差异。行为已按原样守恒迁移。另更正：原 GRANDFATHERED_VALUE_INTERPS 中 foundation 的 5 条（actorId/companyId/anchorId）经代码核实为**预构建 $N 占位符变量**而非值直插（当时分类保守），随迁移自然消失（豁免 38→33）。
- **修复建议**：批次 1 完成后与 TD-SEC-006 一并决策：统一为 validate 形态（行为变更，需单独提交+人工批准+集成测试补组织失效负例）；或确认无需组织有效性校验并记录依据。
- **业务行为影响**：无（当前为登记；统一时为变更行为） ｜ **关联批次**：待决策（批次 1 后） ｜ **验收方式**：决策落盘；若统一，foundation 集成测试补失效组织负例

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

**原始登记快照说明**：上列位置/未判定是779dea3扫描时点的历史证据，保留不回写；该提交树中尚无本台账文件，历史13由后续台账固定清单及git show 779dea3的循环上下文重建，不冒称当时已有台账文件。以下为本轮2f判定，不替换为现时扫描新总数。

**2f本轮判定（授权c75dd7b；业务源码基线7e94bbe）**：13/13完成，7个确证逐项SQL扇出、6个误报/有界点，判定任务完成、确证修复未实施/待独立授权，不等于性能风险清零。仓储文件相对7e94bbe零变动。按用户判准区分“每次循环”和“整请求累计”：事务不是集合上界；明确HTTP sequence范围＋立即UNIQUE失败中止可构成业务硬界，不能把routing的大界主观说成无界；普通SQL integer/UUID有限值域或服务器35MB请求体不是业务条目配额。所有频次是静态调用机制，生产QPS/行数分布/耗时未测，无新增判定SQL探针或性能基准。

下表旧文件均位于779dea3的apps/api/src，当前文件均位于7e94bbe的apps/api/src；每条以循环集合及所在符号关联，不按相近行号猜测。q只计所述循环SQL（固定前置/审计/事务常数另计），n为集合长度，m为实际生成allocation数，t为访问候选次数。

| ID  | 固定历史位置 → 当前位置/符号与每次触发机制                                                                        | 上界来源、SQL频次与判定证据                                                                                                                                                                                                                                                                      | 结论/后续                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| H01 | contract-document-repositories.ts:188 → 同文件:176 createEnvelope/input.signers；每签署请求一次                   | app.ts:2209强制sequence 1..20；DB0061:41–46立即UNIQUE(tenant_id,envelope_id,sequence)，串行无逐项catch，首次重复失败后事务退出；q≤min(n,21)，成功≤20。仅当前HTTP路径上界，不外推任意repo直调                                                                                                     | 误报，关闭无界N+1候选；保留20成功/21尝试的失败时点证据                                  |
| H02 | foundation-repositories.ts:142 → event-repositories.ts:91 claimInTransaction/rows；每claim调用一次                | event-repositories.ts:47–64在repo校验limit默认20、1..100，CLAIM_SQL带LIMIT；n≤100，每行一次operationalAudit（共享helper固定SQL）；不是无界DB rows审计                                                                                                                                            | 误报，有界审计，关闭此候选；不是证明审计成本为零                                        |
| H03 | foundation-repositories.ts:276 → event-repositories.ts:224 InProcessEventDispatcher.pollOnce/claimed；每轮poll    | 此调用省略limit，默认20（claim通用上限100）；每event调用handler并complete或fail；只证明本轮枚举≤20，用户注入handler内部工作不在本判定。限定检索apps/api/src的InProcessEventDispatcher及.pollOnce(，未找到生产调用，定义/测试不当实际生产频次                                                     | 误报，有限后台轮询，关闭此候选；不外推无限poll总运行期或handler无SQL                    |
| H04 | foundation-repositories.ts:434 → notification-repositories.ts:175 insertRecipients/去重recipients；每通知创建一次 | app.ts:404–408 strings无条数配额；notification-repositories.ts:65–73、109–116只要求非空UUID及scope查询全部合法。每recipient两INSERT，q=2n；合格租户员工集合可增长，不是固定权限条目枚举；35MB不作业务上界                                                                                        | 确证，纯写型逐项扇出（非典型读N+1），修复R1                                             |
| H05 | foundation-repositories.ts:995 → business-object-repositories.ts:132 relationships/schema.fields；每定义/版本一次 | domain/src/index.ts:103–112的validateBusinessObjectSchema限制fields≤100；关系字段为子集；每关系一INSERT、q≤100                                                                                                                                                                                   | 误报，有界schema步骤，关闭此候选                                                        |
| H06 | procurement-repositories.ts:259 → 同文件:226 createSupplierQuote/input.lines；每报价创建一次                      | routes/procurement-supplier-quote-create.ts:62–80仅非空数组，无条数配额；每行一个INSERT…SELECT含RFQ/资格关联，q=n；已issued RFQ与qualification只限定每项有效性，RFQ行数无固定配额                                                                                                                | 确证，读写混合INSERTSELECT扇出，修复R2                                                  |
| H07 | procurement-repositories.ts:436 → 同文件:403 receive/input.lines；每收货请求一次                                  | routes/procurement-receipt-create.ts:61–93非空但无条数配额；403–468每有效行查PO line/查location/插lot/插receipt-line/插movement，成功q=5n，出错可提前终止；PO/tenant/剩余数量校验非固定集合配额                                                                                                  | 确证，逐行读取型并伴写入，修复R3                                                        |
| H08 | manufacturing-repositories.ts:207 → 同文件:180 createBom/line.substitutes（外层:165 input.lines.entries）         | priority在routes/manufacturing-bom-create.ts:101限定1..1000，DB0036 per-line UNIQUE priority；每line最多1000成功/第1001次失败。内层有界，但外层lines无业务条数配额（route:64–110，line_number=index+1）；整请求成功q=n+Σs_i≤1001n，没有固定n界。历史简单for-of正则未命中解构外层，不能漏掉上下文 | 确证，嵌套纯写扇出，修复R4；不把内层称严格无界                                          |
| H09 | manufacturing-repositories.ts:295 → 同文件:268 createRouting/input.operations；每工艺创建一次                     | routes/manufacturing-routing-create.ts:84 sequence 1..100000；DB0036:56–61立即UNIQUE(tenant_id,routing_version_id,sequence)，串行无逐项catch、失败rollback/rethrow；q≤min(n,100001)，成功≤100000                                                                                                 | 误报，按明确硬界关闭无界候选；高上界写扇出风险保留，独立授权评估，不与低界20/50/100等价 |
| H10 | qtc-repositories.ts:890 → 同文件:849 reconcile/items；每核销run一次                                               | :841–846查tenant/customer/currency下未结INVOICE，无LIMIT；逐访问item SELECT least，正额allocation再SELECT subtraction，余额耗尽后下一轮可break；q=t+m≤2n、t≤n，余额/金额不提供固定条数配额                                                                                                       | 确证，DB结果驱动读取/算术查询型，修复R5                                                 |
| H11 | qtc-repositories.ts:932 → 同文件:891 reconcile/allocations；同一run第二循环                                       | m≤n但n来自H10无LIMIT集合；每allocation一个INSERT，q=m，不能把生成数组称固定事务步骤                                                                                                                                                                                                              | 确证，纯写型扇出，修复R6（与R5共享输入、分别核验）                                      |
| H12 | complaint-repositories.ts:1063 → 同文件:1044 batchTriage/input.items；每batch请求一次                             | routes/complaint-batch-triage.ts:34–53 HTTP限制1..50且拒绝重复ID；每项transitionComplaint有意分项成功/失败，≤50次调用，内部SQL成本不在此逐行DB读取判定                                                                                                                                           | 误报，有界业务batch，关闭此候选；BOUND004大小写既有状态不动                             |
| H13 | production-cost-repositories.ts:85 → 同文件:86 createPolicy/input.materialRates；每策略创建一次                   | routes/production-cost-policy.ts:64–76只要求非空数组，DB0048:11–14的policy/itemVersion唯一与tenant FK只限定合法性；item versions集合无业务条数配额；每rate INSERT，q=n                                                                                                                           | 确证，纯写型扇出，修复R7                                                                |

**确证关联修复子任务（仅登记，均未授权实施）**：

下列“风险评级”指未来实施修复时改变既有锁/错误顺序/授权/金额/幂等的变更风险，不是已实测事故严重度或生产性能评分。R1/R7属相对局部批量写入评为中；R2–R6涉及资格、库存/父子映射或财务账务一致性评为高，仍须独立方案与验证，不以评级替代授权。

- TD-PERF-002-R1（H04）：未来修复变更风险评级＝中；评估批量recipients及delivery INSERT；风险为授权集合、去重、审计、生成ID与错误顺序守恒。
- TD-PERF-002-R2（H06）：未来修复变更风险评级＝高；评估集合式RFQ/qualification验证和批量INSERTSELECT；风险为无效行不得悄悄丢弃、首错/行映射/幂等。
- TD-PERF-002-R3（H07）：未来修复变更风险评级＝高；评估批量读取PO/location和集合写入；风险为FOR UPDATE锁序/死锁、部分数量冲突、lot/receipt/movement引用与事务证据。
- TD-PERF-002-R4（H08）：未来修复变更风险评级＝高；评估BOM lines/substitutes批量写入RETURNING映射；风险为line ID/priority唯一、顺序、首次冲突与整体回滚。
- TD-PERF-002-R5（H10）：未来修复变更风险评级＝高；评估精确numeric集合计算/减少逐项算术往返；禁止直接用JS浮点替换PG numeric，需保持due_at/created_at/id顺序、锁、金额、trace/resultHash及幂等。
- TD-PERF-002-R6（H11）：未来修复变更风险评级＝高；评估allocation_entries批量INSERT；风险为allocation_order、派生key/canonical_hash、审计与R5联动，不借本登记修改算法。
- TD-PERF-002-R7（H13）：未来修复变更风险评级＝中；评估materialRates批量INSERT；风险为FK/重复项首错、策略版本、成本精度、审计/幂等。
- H09高上界风险：另行评估业务条目配额或集合式写入（改变接受域或SQL锁/错误顺序均须独立授权），本轮不降现有100000序号上界、不修代码。

**覆盖与关闭口径**：6个误报仅关闭“该历史点属于无界N+1”候选，不关闭其他性能/安全债；7个确证仅源码级机制证实，不声称生产已有慢查询事故或已实测吞吐。13点由主代理与只读独立核验交叉确认；未新增PG/SQL判定探针、性能测试或E2E，既有13PG回归不替代上述性能基准。台账仍37顶层条，R1–R7与GATE003-E1为父项关联子任务，不冒算新顶层债。当前A判定完成、业务修复零；待本线稳定HEAD全CI及最终人工验收。

## 门禁

### TD-GATE-001｜无 git hooks / commitlint / lint-staged

- **位置**：仓库根（`.husky/` 不存在；`.git/hooks/` 仅默认 `*.sample`；package.json 无相关字段）
- **类别**：门禁 ｜ **严重度**：P1
- **证据**：提交规范仅靠 PR 标题约定（历史均为 conventional commits 风格但无机械校验）；脏提交（lint 不过/格式错）只有 push 后 CI 兜底。
- **修复建议**：阶段 3 接入 lefthook 或 husky + commitlint + lint-staged，`pnpm ci:local` 的子集本地化；错误信息附修复指令。
- **已完成（2026-10-12，阶段 3）**：采用**零依赖方案**替代 husky/commitlint/lint-staged（选型理由：与仓库零依赖哲学一致，core-beliefs「偏好可内化技术」；行为等效）。`.githooks/{pre-commit,commit-msg}` 经 `core.hooksPath` 接线，`prepare` 脚本在 `pnpm install` 时激活（对无 .git 的 Docker 构建容错）。实测：坏提交信息（退出码 1+修复示例）、暂存坏格式文件（退出码 1+修复指令）均被拦截，好样本放行。清单见 docs/GATES.md。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：非 conventional 提交信息、含 lint 错误的提交在本地被实测拦截 ✓

### TD-GATE-002｜vitest 无配置文件

- **位置**：全仓 0 个 `vitest.config.*`；`apps/api` 的 `--maxWorkers=1` 只写在 package.json scripts
- **类别**：门禁 ｜ **严重度**：P2
- **证据**：集成测试串行要求（共享 PG schema）仅靠 CLI 参数记忆，无集中配置；覆盖率配置（TD-TEST-002）也无落点。
- **修复建议**：阶段 3 与覆盖率接入一并统一到 vitest 配置。
- **已完成（2026-10-12，阶段 3）**：新增 `apps/api/vitest.config.ts`（`test.maxWorkers: 1`，集成测试共享 PG schema 必须串行），CLI 参数已从 test 脚本移除；配置文件纳入 typecheck（tsconfig include）并排除出构建（tsconfig.build exclude，rootDir=src 不受影响）。验证：本地 PG（kingturf_test）上 API 全量 22 文件/184 用例全绿（45s），串行语义保持。覆盖率配置落点将在阶段 5 加入同文件（TD-TEST-002）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：配置文件存在且各包 scripts 引用一致 ✓

### TD-GATE-003｜routes 目录未纳入 G1/G2/G3 扫描

- **位置**：`scripts/analysis/structure-gate.mjs:55–63` 的 `walk`；`runChecks:235–244` 共用 sourceFiles 循环、245–250 的独立 G4；`scripts/analysis/structure-gate.test.mjs:147–179` 的真实进程自测目录。
- **类别**：工程门禁覆盖缺口 ｜ **严重度**：P1 ｜ **状态**：未修复／待核实（静态遗漏已证，真实 routes 注入逃逸及全量影响待独立核实）。
- **证据（2026-10-16，发现基线2761b0a／登记前文档2c7b174）**：`walk` 对目录名 `routes` 直接 continue；G1 文件、G2 缩进和 G3 SQL 插值检查均只运行于该 walk 产生的 sourceFiles。随后 routes 仅单独执行 `routeValidatorViolations`（G4），不会补回 G1/G2/G3。首版 `7dd2ff7` 已有这一跳过，主代理亲读、协调及 readonly reviewer 独立核同；旧真实进程超限样本放在 `apps/.structure-gate-selftest-*/src`，不是 routes。该静态遗漏并非 G1/G2 白名单的显式例外，也不是 G3 可信根豁免；协调限定检索6ba55c4的GATES/台账/active历史未找到人工批准例外或等效TD，此否定结论限所列文档范围。
- **影响与核实边界**：CI 绿不能证明 routes 已受三类机械拦截；这不是已证生产漏洞，不推翻既有人工验收或2d行为守恒。本批九模块无SQL，文件/完整函数/明确词法函数与控制流预算已独立核验，但该手工口径不等于现G2格式缩进算法扫入后必然通过（格式缩进可至9）。本轮**未执行真实 routes 目录三类违规注入／逃逸用例**，未审完所有存量 routes 引入扫描后的影响，不能宣称动态复现、修复或门禁全覆盖已完成。
- **修复候选／前置决策**：后续独立门禁任务先审现有 routes 全量影响与潜在新增违规；评审 G1/G2/G3 覆盖 routes 且保留 G4 逐定义校验的改法，再补真实进程 routes 文件过长／嵌套超限／白名单外SQL插值三类样本的失败拦截及合法样本、清理后回归测试。禁止直接改 walk 触发海量违规后临时加豁免，禁止扩大 G3 可信根。候选不是本轮实施授权，修复须独立决策、独立源码/测试提交及复核；阶段5接入前复核该债。
- **业务行为影响**：无（本轮仅文档登记；不改变API/SQL/权限或产品行为） ｜ **关联批次**：后续独立门禁任务决策／阶段5接入前复核。
- **验收方式（尚未执行）**：批准范围内真实 routes 三类违规进程退出非0、有效样本通过、G4逐定义继续生效；全量存量影响清单/批准处置、无新绕过或未授权豁免；完整 `pnpm ci:local` 与独立复核通过后才可置已修复。本次完整CI仅登记回归，不是该缺口修复验收。

## 文档与工程卫生

**TD-GATE-003-E1关闭证据（2026-10-16，父项已人工验收b575b9c）**：授权310c1e2下，源码d9f43f6仅去掉冗余roles分支，原模板method读取/授权getter/receiver/首错保留；固定旧新773及协调独立复跑一致。撤例外3231964移除path/hash/date条与旧失效自测，换为当前AST5及同路径合法6/7强制拒绝；36结构自测、稳定HEAD全CI真实0/173.927秒，API117/17099、原13PG通过，0硬/31软，原31逐条保持。E1已消除不是延期，不再挂2026-10-23临时豁免；旧32/期限/待授权原文保留历史。其他债务/7个N+1修复/D1/BOUND/SEC均不实施；函数200缺口和前端问题不在本关闭范围。

**TD-GATE-003最终工程验证（待人工验收）**：bd48b5a已提交稳定干净HEAD完整CI实际退出0（171.698秒）；36结构自测及协调独立8个AST/expiry样本通过，G3/G4字节不变，原31逐条无增删＋E1＝32，源码/旧业务测试无改。E1的2026-10-23 Singapore零时由代码机械失效；若批次2提前最终验收，必须先移除/另行人工裁决，是人工验收前置条件，代码不解析批次状态。该例外及函数200未强制边界仍开放（870函数节点/最大foundationRoutes522行），不以覆盖修复冒称所有复杂度债已清；不得借此改业务或静默续期。旧发现/候选记录均保留时点。

**TD-GATE-003本轮实现更新（2026-10-16，授权c75dd7b；旧登记原文保留）**：routes纳入G1/G2/G3同一sourceFiles扫描，G4仍单独逐定义一次。仅API routes的G2采用明确AST词法函数/控制流规则；非routes保留原缩进算法，G3实现/形状/可信根及G4校验函数相对7e94bbe逐字节不变。原116文件G1/G2格式/G3＝0/93/0、maxIndent10，AST分布2×1/3×93/4×20/5×1/6×1，完整逐file基线与定义见[evidence/routes-structure-baseline-2026-10-16.md](../evidence/routes-structure-baseline-2026-10-16.md)。36结构自测真实退出0，routes超800/AST超5/SQL直插/G4缺validate均真实CLI退出1，合法深格式退出0，清理后全仓0硬违规/32信息豁免。最终稳定HEAD全CI和独立复核尚待本线收口，不把局部成功当人工验收。

**TD-GATE-003-E1（新增精确限期例外，不是目录豁免）**：authorization.ts:236–245既有atomicCapability fallback为1函数＋4层资源三元＋1叶三元＝6；本批禁止业务源码改动，故仅`apps/api/src/routes/authorization.ts`整内容SHA256 `d380d23327db8d1751a793d2bdef0a2c62948cf17420a8da25723edc6103daf1`、maxDepth恰为6可信息豁免。明确到期日2026-10-23 Asia/Singapore 00:00，或批次2最终验收前取先；只预留后续独立授权去嵌套/裁决，不授权本批改该源文件。日期到期、内容变化、深度增长或换文件任一条件均强制失败，确定性测试覆盖日期临界/内容变更/更深/异路径。阈值5没有改变，31旧条按rule/path完全保留、无移除（现时原构成9G1＋22G2，不回写旧7/24历史），仅新增此条：总32＝9G1＋23G2。残余例外未消除，函数200仍无新增AST强制，不能宣称复杂度债务清零。业务行为影响无；后续处置独立排期、不得静默续期。

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

### TD-HYG-001｜本地验收产物滞留；近空壳包（已完成）

- **位置**：`.local-acceptance/`（**10 个目录、36 个条目**，已被 .gitignore 忽略；复核命令 `find .local-acceptance -maxdepth 1 -type d | wc -l`）、`.test-results/`；空壳包路径为 D3 执行前历史位置。
- **类别**：文档/工程卫生 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：D3 已批准并执行；两个空壳包已删除，web workspace 依赖及 lockfile importer 已清理；`.local-acceptance/` 继续被 `.gitignore` 忽略，新增 `docs/local-acceptance-cleanup.md` 与不自动执行、目标路径严格校验的 `scripts/analysis/clean-local-acceptance.mjs`（本轮未运行清理脚本）。
- **修复结果**：空壳包已移除，本地验收目录保留为显式本地卫生边界。
- **业务行为影响**：无 ｜ **关联批次**：D3 ｜ **验收方式**：依赖清理 + 门禁全绿

---

## 处置记录

2026-10-16，TD-GATE-003独立登记：协调与readonly reviewer确认walk自7dd2ff7跳过routes，runChecks共用sourceFiles使G1/G2/G3皆漏扫，G4独立扫描；静态遗漏已证，真实routes违规注入逃逸与全量影响未执行，P1／业务行为影响无／未修复待核实。仅新增本条正文、索引与处置记录，旧36条历史字节保留，当前37；后续独立门禁任务决策、阶段5前复核，本轮不改脚本/旧tests/白名单/G3可信根。登记前2c7b174完整CI真实0/147.709s与源码2761b0a真实0/151.592s只为既有回归，不是本缺口修复验收；本登记新实际HEAD另完整CI真实0/干净后交回，回滚仅本登记docs提交需先核授权及后继冲突。

2026-10-13，TD-BOUND-004 登记：④batch 代码 bfc1c06 守恒协调复核通过，旧56契约d0799b6无diff；协调独立21文件1167/1167、最终fe4b76c完整CI退出码0（API1550/complaint PG4/4）。大小写变体 HTTP/mock 接受与 PG 只读 UUID 身份相等已证，真实批处理/幂等/审计/replay 副作用待核实；仅独立文档登记，保持业务和oracle，不阻塞2b守恒迁移。当前索引/正文35条，历史计数保留；本登记提交可独立revert。

| 日期       | 条目         | 动作                                                                                                                                                                                                             | 关联 commit                                      |
| ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| 2026-10-12 | 全部 27 条   | 阶段 1 全量扫描登记（基线 779dea3）                                                                                                                                                                              | 本分支首次提交                                   |
| 2026-10-12 | 30 条        | 审核修订：TD-TEST-004 拆出 types 为 TD-TEST-005（脱离 D3）；新增 TD-PERF-001/002（§3.8 性能扫描落盘）；修正度量口径表述（脚本 vs `wc -l`）、`.local-acceptance` 计数（10 目录）、innerHTML 17 处、商业子域 21 个 | 本分支修订提交                                   |
| 2026-10-12 | TD-DOC-001   | 状态置「处理中」：阶段 2a 完成入口地图/架构总览/全量索引/doc-lint/核心信念/质量评分/runbook 六件                                                                                                                 | harnessing 分支 2a 系列提交                      | 剩余 2b 归并（阻塞 D4）+ 阶段 3 doc-lint 进 ci:local 后关闭 |
| 2026-10-12 | TD-DOC-001   | 已完成（阶段 2b：D4 决策执行 + 抽查修正 1 处漂移）                                                                                                                                                               | harnessing 分支 2b 提交                          |
| 2026-10-12 | TD-DOC-002   | 新登记：常驻文档未全量核对，抽查 3 份即发现 1 处端点漂移（已修）                                                                                                                                                 | 同上                                             |
| 2026-10-12 | TD-DOC-001   | 复核修正：归并计数口径更正（常驻 50/归档 54）；ID_AUTH 三端点表述更正                                                                                                                                            | 阶段 2 复核提交                                  |
| 2026-10-12 | TD-SEC-005   | 已完成：structure-gate G3 强制拦截 + 实测注入样本退出码 1                                                                                                                                                        | 阶段 3 提交                                      |
| 2026-10-12 | TD-GATE-001  | 已完成：零依赖 hooks 实测拦截坏信息/坏格式提交                                                                                                                                                                   | 阶段 3 提交                                      |
| 2026-10-12 | TD-GATE-002  | 已完成：vitest 配置统一，API 184 用例全绿验证                                                                                                                                                                    | 阶段 3 提交                                      |
| 2026-10-12 | TD-SEC-005   | 复核返工：G3 黑名单制被实测绕过（input.name/foo），返工为白名单制后重新达标                                                                                                                                      | 阶段 3 复核提交                                  |
| 2026-10-12 | TD-SEC-005   | 二轮返工：形状×可信根双重约束，评审 7 样本注入全部退出码 1                                                                                                                                                       | 阶段 3 复核2 提交                                |
| 2026-10-12 | TD-SEC-006   | 新登记（批次 1b-complaint 迁移时发现的域间语义差异，原样守恒并固定特征化测试）                                                                                                                                   | 阶段 4 批次 1b 提交                              |
| 2026-10-12 | TD-SEC-007   | 新登记（批次 1b-foundation 迁移时发现的员工域第二变体语义差异，原样守恒并固定特征化测试；附带更正 5 条存量豁免的机制认知——实为预构建占位符而非值直插）                                                           | 阶段 4 批次 1b 提交                              |
| 2026-10-12 | TD-DUP-001   | 已完成：DataScope SQL 统一由 `scope-sql.ts` 的三项共享出口提供；repositories 无本地 scope helper，关系表生产 SQL 仅保留在共享模块；全部 scope 对拍、API 全量与 `pnpm ci:local` 通过；TD-SEC-006/007 保持待决     | `f810229` 及后续收尾文档提交                     |
| 2026-10-13 | TD-BOUND-003 | 因子旧契约复核新增日期真实性边界问题；原样迁移，真实 PG 影响与收紧方案待独立核实/人工决策，不修行为。                                                                                                            | 旧契约 `fc54c8d`；因子代码 `839bf84`；本登记提交 |
