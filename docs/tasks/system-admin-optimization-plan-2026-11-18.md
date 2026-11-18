# 系统管理模块优化计划（组织、权限与配置）— 2026-11-18

> 评估基线：main@28b2bbc（2026-11-17 生产验收后）。本计划为 2026-11-18 评估报告复核后的**终版**，供人工审查。已批项以 §0 人裁原文为准；未批项仅在 §2.6 保留提案地位，不因本计划自动获得授权。

## §0 已获人裁的授权范围（2026-11-18，对话原文落盘）

1. **A1（强制首登改密）与 A2（权限目录收敛）为行为变更，批准进入台账并排期。**
2. **B1（治理子路由化）：接受「卡片墙降级为概览页」的兼容策略。**
3. **B2（分页）：不做前端「加载更多」过渡，直接一步到位修改后端列表端点。**
4. **D5（统一配置中心）：确认立项，需新 ADR。**
5. **二次人裁（同日，执行授权）**：确认项目处于开发阶段、**无用户使用与真实数据**；本计划审查通过；授权主协调代理创建独立执行会话按本计划推进至**部署完成**，主协调持续协调监督（非交接了事）。据此：§5 Wave 2 迁移执行不再需要独立授权设计批——随部署实施，保留恢复点与隔离演练；§7 开放决策 1/2/3 收口（见 §7）；决策 4（ADR-0013 人工确认）保留至 M5 检查点。

以上五项即本计划 §2.1–§2.5 的实施授权；登记条目见 `docs/exec-plans/tech-debt-tracker.md`（TD-SEC-011/012、TD-WEB-012/013、TD-API-003、TD-ARCH-003）。

## §1 复核修正（对 2026-11-18 初版方案的纠错，共 9 项）

初版评估报告的批次设计经二次复核发现以下问题，本计划已全部修正：

| #   | 初版问题                                                                                                                                                                                                                                                                                     | 修正                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A2 原设计过度**：「全局只读目录 + 租户私有 capability 目录」。租户私有 capability 无代码执行点（路由授权均为硬编码常量）、无前端消费面，纯增 schema 与查询复杂度                                                                                                                           | 收敛为**目录代码所有化**：`POST /api/v1/permissions` 收归系统管理维护（或移除，§7 开放决策 1），目录仍全局可读。**零 schema 变更**，可随 Wave 1 应用发布。存量非种子行先只读盘点、清理另批                                            |
| 2   | **A1 设计缺口**：未定义门禁执行点、机器 token-login 处置、标志位生命周期                                                                                                                                                                                                                     | 见 §2.1：服务端会话门（非 UI 重定向兜底）、token-login 同门、provision 置位/自助改密清位、存量回填 false、会话 DTO 加性字段                                                                                                           |
| 3   | **B2 契约与仓库惯例冲突**：初版提议 offset/limit/total 信封；但仓库既有分页契约为 `limit(1-100, 默认50) + cursor(uuid) → {items, nextCursor}`（`routes/qtc-operational-reads.ts:60-97`、customer-base、lead-base、complaint-reads 同款）                                                     | 统一采用 **cursor 契约**，不引入 offset/total；治理表 UI 显示「已加载 N 条」+ 继续加载，与商业域列表一致                                                                                                                              |
| 4   | **B2 影响面低估**：响应形状变化不止 governance 消费方                                                                                                                                                                                                                                        | 增加步骤 0「消费方盘点」：对 18 个端点逐一 grep `apps/web/src` 消费点（如 employees 列表可能被商业域选择器消费），同提交内同步适配                                                                                                    |
| 5   | **B1 路由机制未核实**：担忧多段 hash 兼容                                                                                                                                                                                                                                                    | 已核实 `shared/navigation.ts:90-93` 整段字符串匹配，`'governance/identity'` 可直接作为 AppRoute 联合类型成员，**路由器零改造**；`crm/shell-frame.ts:158` navGroup 原生支持多项子项；现状无深链书签，`#/governance` 保留为概览即全兼容 |
| 6   | **D1（未批项）enum 坑**：`definition_status` 加 DISABLED 需 `ALTER TYPE ADD VALUE`，PG 单事务迁移内新值不可用                                                                                                                                                                                | 修正为 `disabled_at timestamptz` 列方案，仅记录供未来决策，不在本计划范围                                                                                                                                                             |
| 7   | **C5→A3 依赖未显性化**：独立「重置密码」端点需新 capability `identity:reset-credential`（A3 未批）                                                                                                                                                                                           | C5 标记依赖 A3 人裁；A3 批准前仅可复用 provision 整体流程                                                                                                                                                                             |
| 8   | **D5 空壳风险**：统一配置中心若无首批键则成空架子                                                                                                                                                                                                                                            | Phase 1 绑定 3 个试点键（§2.5），其中密码策略键与 A1 联动，避免重复造策略读取路径                                                                                                                                                     |
| 9   | **部署波次缺失（最重要）**：初版未区分应用-only 与 schema 变更。当前生产唯一入口 `recover-application-images.yml` 为应用-only 发布：不更新 PG、不调用迁移执行器、启动时 SELECT-only 校验迁移元数据并对 pending/drifted/unknown fail-closed（`docs/deployment/PRODUCTION_PARK_HOST.md:5,68`） | 引入**两波发布模型**（§5）：Wave 1 = 零迁移（A2/B1/B2）；Wave 2 = 含迁移 0073/0074（A1/D5），**必须另行授权迁移执行设计**后方可上线；跨 schema 应用回滚会 fail-closed，Wave 2 回滚策略须在迁移授权时一并裁决                          |

## §2 批次设计

### 2.1 A1 — 凭证强制首登改密（TD-SEC-011，Wave 2，已批排期）

**问题**：`provisionIdentity`（`repositories.ts:446-491`）允许管理员直接设定/重置目标账号密码，无「首登强制改密」；临时密码生命周期无人约束（ASVS 2.5.5/2.5.6）。

**设计**：

- **迁移 0073**：`ALTER TABLE password_credentials ADD COLUMN must_change_password boolean NOT NULL DEFAULT false`（存量回填 false，加性可空安全；旧应用不读该列）。注意 §5 迁移另授约束。
- **置位语义**：`PUT /employees/:id/identity`（provision）写入凭证时 `must_change_password = true`；`PUT /auth/credential` 自助改密成功事务内置 `false`。
- **会话门（服务端强制，非 UI 兜底）**：`resolveSession` 聚合时携带 `credentialState: 'OK' | 'MUST_CHANGE'`（join password_credentials 一列，进既有 3 条 SQL 之一）；dispatch 层新增门：`MUST_CHANGE` 状态下仅放行 `GET /auth/session`、`PUT /auth/credential`、`POST /auth/logout`，其余返回 `403 credential_must_change`。机器 `POST /auth/token-login` 产出的会话同门。
- **会话 DTO 加性字段**：`GET /auth/session` 响应新增 `credentialState`（加性变更，旧前端忽略无害）。
- **前端**：`MUST_CHANGE` 时登录后跳独立改密屏（复用 `login-flow` 表单组件与 `PUT /auth/credential`），完成改密后按既有语义全量会话撤销、引导重新登录。
- **审计**：provision 置位沿用 `auth.identity_provision`；改密清位沿用既有改密审计动作，元数据增 `must_change_cleared: true`。
- **测试**：见 §4。

**行为变更声明（已批）**：provision 后的目标账号在改密前不可执行任何业务操作（原行为：立即可用）。

### 2.2 A2 — 权限目录代码所有化（TD-SEC-012，Wave 1，已批排期）

**问题**：`permissions` 表全局共享（`migrations/0001:41`），任意租户持 `permission:manage` 可经 `POST /api/v1/permissions` 创建全局 capability，污染其它租户目录。

**设计**：

- `POST /api/v1/permissions` 收敛：默认 403；仅当会话身份为系统管理维护角色（`SYSTEM_ADMIN` 直查角色编码，不新增 capability）时放行，用于种子外补录。完全移除 vs 保留维护口 → §7 开放决策 1。
- `GET /api/v1/permissions` 不变（目录全局只读，双轨 `permission:read ∥ authorization:read` 保持）。
- **存量盘点（只读）**：新增脚本 `scripts/analysis/permission-catalog-audit.mjs`——以 `packages/types` 的 `FOUNDATION_CAPABILITIES` 与迁移种子清单为基准，输出非种子 capability 报告（是否存在租户创建行、是否被 grant 引用）。清理为数据操作，另批。（2026-11-18 二次人裁后注：开发库无真实数据，盘点保留为回归工具、优先级降低，无生产数据风险。）
- 零 schema 变更、零前端变更（治理面「新建权限」按钮的可见性条件同步收窄为系统维护角色）。

**行为变更声明（已批）**：普通租户管理员失去创建全局 capability 的能力（原行为：可创建）。

### 2.3 B1 — 治理子路由化（TD-WEB-012，Wave 1，已立项）

**问题**：11 个异质治理面挤在单路由 `#/governance` 卡片墙（`governance/surfaces.ts:12-121`），表格仅预览 8 条，管理控制台场景不可用。

**设计**：

- **路由**：`AppRoute` 联合类型新增 9 个成员：`governance/identity`、`governance/organization`（organizations+employees 两面）、`governance/audit`、`governance/master-data`、`governance/numbering`、`governance/rules`、`governance/workflow`、`governance/notifications`、`governance/system`（business-objects+event-operations）。`navigation.ts` 的 LABELS/DESCRIPTIONS 同步补齐；路由机制零改造（§1#5）。
- **菜单**：`shell-frame.ts` 的 `navGroup('系统管理', ...)` 由单子项改为按上述 9 路由多项子项；每项可见性 = 对应 surface 可见性（沿用 `surfaces.ts` 权限判定，`bootstrap.ts:185` 路由注册改为并集）。
- **页面形态**：每子页 = 标题 + 该域全量列表（B2 分页组件）+ 既有操作按钮组（各 `*-actions.ts` 原样迁移挂载）。数据加载从「一次拉全部 surface」改为**按当前子路由只拉所需面**；概览页 `#/governance` 保留现有卡片墙与全部并行加载（兼容策略，已批）。
- **`surfaces.ts` 复用为路由注册表**：surface 定义（readPermission/managePermission/paths）不重写，仅新增 route 字段映射。
- **B3 顺带修复（并入本批）**：`workspace-actions.ts:27` 提交文案从统一「确认提交」改为动词化（「停用账号」「撤销授权」「删除条目」…），命中 `shared/forms.ts:119` 敏感词正则即自动获得二次确认勾选；原生 `confirm()` 换 dialog（`forms.ts:111,195`）。
- **C4 顺带修复（纯前端，并入本批）**：按钮依赖的数据面不可见时（如仅有 role:manage 无 employee:read），在下拉处显示「需要 employee:read 权限才能选择员工」，替代静默空下拉。

**行为边界**：导航形态与数据加载范围为前端可观测变化；API 合同不变（B2 另批）。

### 2.4 B2 — 治理列表分页（TD-API-003 + TD-WEB-013，Wave 1，已批排期）

**问题**：18 个治理面读端点无界返回全量、无确定性排序；前端仅渲染前 8 条（`presentation.ts:154`）；审计「导出当前日志」导出全量而非筛选结果（`audit-workbench.ts:40`，bug）。

**端点清单（18）**：organizations、employees、user-access-profiles、roles、permissions、grants、assignments、scope-grants、audit-events、master-data/categories、master-data/entries、number-definitions、rules、workflows、workflow-tasks、notifications、business-objects、operations/events。

**设计**：

- **步骤 0 消费方盘点**：逐端点 grep `apps/web/src` 全部消费点（不止 governance；如 employees/organizations 可能被商业域选择器消费），形成清单附于实施提交。
- **契约**：统一接入既有 cursor 分页——query `limit`（integer 1-100，默认 50）+ 可选 `cursor`（opaque）；响应 `{ items, nextCursor }`（对齐 `qtc-operational-reads.ts:60-97` 既有实现与 `permittedDto` 字段投影）。audit-events 额外保留既有 SUCCESS/FAILURE 筛选并新增 `query` 关键字参数（服务端过滤，替换前端全量过滤）。
- **确定性排序**：每端点定义稳定 ORDER BY（默认 `created_at DESC, id`；编号/规则/工作流等定义表按 `code`）；无显式排序的现有列表行为变更已批（§0#3）。
- **仓储层**：各 list 方法增加 limit/cursor 参数与 keyset 条件（`created_at, id` 元组比较），DataScope 谓词原样下推；`$n` 重排 hack（`repositories.ts:215-218`）随参数化一并消除。
- **前端**：新增 `governance/list-view.ts`（表头 + 分页加载 + 「已加载 N 条/继续加载」+ 可选搜索框，风格对齐商业域列表工具）；替换 `governanceTable` 的 `slice(0,8)`；**审计导出改分页循环拉取**（按当前筛选参数循环至 nextCursor 为空，上限 10,000 条防失控，导出即筛选结果——修复 bug）。
- **回滚**：单提交 revert；无迁移参与。

**行为变更声明（已批）**：上述 18 端点响应形状由裸数组变为 `{items, nextCursor}`，排序确定化；所有前端消费方同提交适配。

### 2.5 D5 — 统一租户配置中心（TD-ARCH-003 + ADR-0013，Wave 2，已立项）

**问题**：无租户级统一参数存储；locale/currency 在组织列、应用配置在 env、业务策略散落 6+ 自有版本化表。

**设计**：

- **ADR-0013《租户设置中心》**（评审通过后实施）：遵循 ADR-0005 形态——`tenant_settings`（稳定身份：tenant + key UNIQUE）+ `tenant_setting_versions`（追加版本，`value jsonb`，DRAFT/PUBLISHED 单向发布，已发布行禁改禁删触发器），写入同事务审计；key 目录由代码注册（白名单 + 每键 JSON schema 手写校验，不引入 zod/ajv，维持零新依赖）。
- **迁移 0074**：上述两表 + 触发器。
- **API**：`GET/PUT /api/v1/tenant-settings`（`tenant-setting:read/manage` 新 capability，纳入权限目录种子）+ 发布动作，幂等键必须。
- **前端**：`governance/system` 子页新增「系统参数」区（键-值表单 + 发布按钮 + 版本只读历史）。
- **Phase 1 试点键（防空壳）**：`security.password.minLength`（8-128，默认 12，供 A1 后续读取）、`security.password.historyCount`（0-24，默认 0，为 A3/A4 预留）、`ux.loginNoticeText`（≤500 字符登录横幅）。既有 env/组织列不迁移（迁移范围另批）。
- **测试**：见 §4。

### 2.6 未批保留提案（不随本计划自动授权）

A3（拆细 authorization:manage + identity:reset-credential）、A4（并发会话上限/last_seen_at 节流更新/单会话吊销）、A5（SoD 覆盖自定义角色）、C1（授权 UI 暴露 scopes/fields 全量能力）、C2（用户 360 视图）、C3（批量角色分配）、C5（重置密码独立动作，依赖 A3）、D1（定义停用开关，disabled_at 方案）、D2（版本历史视图 + 复制为草稿）、D3（配置结构化编辑器）、D4（规则/工作流 dry-run）、D6（主数据层级与引用检查）。以上维持评估报告原描述，逐项另行决策。

## §3 排期与提交切分

依赖图：A2 独立；B1→B2 前端耦合（列表组件落在子页上）串行；A1 后端部分可先行开发（部署等迁移授权）；D5 在 ADR 评审后实施。工作日为估算，供审查调整。

| 顺序 | 内容                                                 | 估算   | 前置                  |
| ---- | ---------------------------------------------------- | ------ | --------------------- |
| M0   | 本计划 + TD 登记（docs 提交）                        | 0.5d   | —                     |
| M1   | A2 实施（§2.2）                                      | 1.5-2d | M0                    |
| M2   | B1 实施（§2.3，含 B3/C4 顺带）                       | 4d     | M0                    |
| M3   | B2 实施（§2.4，18 端点+前端+审计导出修复）           | 5-6d   | M2                    |
| M4   | Wave 1 合并验证：干净 HEAD 全 CI + P1 E2E + 发布演练 | 1d     | M1+M3                 |
| M5   | ADR-0013 撰写与评审                                  | 0.5-1d | M0（可与 M1-M4 并行） |
| M6   | A1 实施（§2.1）                                      | 3.5d   | M0；部署另等迁移授权  |
| M7   | D5 实施（§2.5）                                      | 4d     | M5；部署另等迁移授权  |
| M8   | Wave 2 迁移授权 + 隔离演练 + 发布                    | 1-2d   | M4+M6+M7              |

提交序列（Conventional Commits，每提交单一职责、过 `pnpm ci:local`、标注 [已测试]/[未测试]）：

1. `docs(td): register system-admin optimization debts and plan`（本次）
2. `feat(api): restrict permission catalog writes to system administration`（A2，行为变更）
3. `feat(web): split governance into sub-routes with overview compatibility`（B1+B3+C4）
4. `feat(api): adopt cursor pagination contract for governance list endpoints`（B2 后端，行为变更）
5. `feat(web): paginated governance tables, search and fixed audit export`（B2 前端 + B4）
6. `feat(api): enforce credential must-change gate for provisioned accounts`（A1，含迁移 0073，行为变更）
7. `docs(adr): add 0013 tenant settings center`（D5）
8. `feat(api): tenant settings repository, routes and seeds`（D5a，含迁移 0074）
9. `feat(web): system settings administration surface`（D5b）

## §4 测试方案

- **门禁**：每提交 `pnpm ci:local`（14 步全链，需 DATABASE_URL 回环测试库）；文档提交跑 `doc:lint`。最终每 Wave 以干净 HEAD 完整 CI 实跑 0 为准（项目惯例：不预填绿）。
- **目标红→绿**：各批先写失败测试再实现（仓库惯例）。
- **A2**：路由契约测试（普通租户 403 矩阵 / SYSTEM_ADMIN 放行 / GET 不变）+ PG 集成；盘点脚本对 fixture 库输出断言。
- **B1**：`bootstrap.test.ts` 扩展（9 子路由注册、按权限的菜单可见性并集、无权限重定向占位、概览页行为守恒）；B3 敏感文案命中确认勾选的行为测试（`forms-behavior.test.ts` 模式）。
- **B2**：API 契约（limit 边界 1-100/默认 50、cursor 透传、nextCursor 语义、排序确定性、DataScope 下推后分页仍正确）；PG 集成（>50 条数据翻页完整性、keyset 不重不漏）；web 行为测试（继续加载、审计筛选+分页导出循环、10,000 上限）；18 端点消费方适配回归（商业域触及处）。
- **A1**：PG 集成全流（provision 置位 → 登录得 MUST_CHANGE → 业务请求 403 credential_must_change → 改密 → 重新登录放行 → 旧会话全撤销）；token-login 同门；存量账号 credentialState=OK 回归；前端改密屏行为测试；P1 登录 E2E 不回归。
- **D5**：ADR 人审；迁移/触发器（已发布禁改禁删）；键 schema 校验负例；发布/版本追加正例；审计同事务断言；UI 行为测试。
- **E2E**：`pnpm e2e:p1` 在 M4 与 M8 发布前各完整跑一次。

## §5 合并与部署（两波模型）

**分支与合并**：main 直接提交（项目惯例），无 PR 流程变更；`ci.yml` 对 push(main) 自动执行同款 `pnpm ci:local`；发布标识 = commit SHA（D2 决策不变）。

**Wave 1（M1-M4：A2+B1+B2，零迁移）**：

- 构建 release-images 产生新 API/Web digest 并获批准（`recover-application-images.yml` 输入契约：精确 main 历史 SHA + 原/新 digest + release-images run ID，以 workflow 当前要求为准）。
- 发布走既有门禁：候选完整 ci:local、production 审批与并发锁、停服前 pg_dump 恢复点、健康/就绪/版本探针、72-schema 只读全等（本波 schema 不变，FULLY_MATCHED 语义不受影响）。
- **回滚**：按历史 SHA 重新发布旧应用即可（无迁移参与，schema 未动，启动元数据校验通过）。

**Wave 2（M6-M8：A1+D5，含迁移 0073/0074）**：

- **硬前提（2026-11-18 二次人裁简化）**：项目无用户与真实数据，迁移 0073/0074 随 Wave 2 部署一并执行，不再另立授权设计批；仍保留：部署前 pg_dump 恢复点、隔离环境 72→73→74 演练一次、旧镜像回滚的元数据兼容结论（纯加性迁移对旧代码无读写冲突，但旧应用启动校验对 unknown 迁移 fail-closed——应用回滚策略在 CP6 检查点裁决，无数据损失风险）。执行步骤清单在部署检查点报主协调确认后实施。
- 迁移为纯加性（可空列/新表），不改写既有行；执行后按应用-only 流程发布新镜像。
- **回滚**：应用层按历史 SHA 回退 + schema 保留新列/新表（对旧应用无语义影响，以迁移授权时裁决的元数据策略为准）；不自动反向迁移（现有契约禁止）。

**禁止事项沿用**：不 push 由人工/CI 既定流程执行；会话内不执行部署；不动 `.github/workflows/`（如 recover-application-images.yml 输入需要适配新 digest 流程，另行授权）。

## §6 验收标准（每批 DoD）

1. 目标红→绿测试进仓；2. 干净 HEAD `pnpm ci:local` 实跑 0；3. 行为变更提交在台账对应 TD 下落盘证据（file:line + 测试输出）；4. 前端批附行为测试与（涉及路由/导航时）书签兼容验证；5. Wave 发布后 `/version` = 发布 SHA、探针全绿；6. TD 状态更新（实施完成待验收 → 人工验收）。

## §7 开放决策点（2026-11-18 二次人裁后收口状态）

1. ~~A2 收敛形态~~ **已裁定**：保留 SYSTEM_ADMIN 维护口（防目录硬编码缺补充口）。
2. ~~B2 范围确认~~ **已裁定**：18 端点以 `governance/surfaces.ts` 面定义为准。
3. ~~Wave 2 迁移执行授权~~ **已解除**：随部署执行，保留恢复点与演练（见 §5）。
4. ADR-0013 人工确认：**保留**，M5 完成草案后作为轻量检查点提交确认。
5. §2.6 未批项是否随后续批次逐项决策（本计划不预设顺序）——保留开放。

## §8 执行组织（2026-11-18 落盘）

主协调代理（本计划登记与监督方）创建独立执行会话承担 M1-M8 实施；执行会话按 §3 推进并在 CP1-CP6 检查点停下输出状态报告，主协调复核证据后放行续段；发布类远程操作（workflow dispatch/SSH）仅在 CP3/CP6 获主协调放行后执行。执行会话不得自行扩大范围或跳过检查点。
