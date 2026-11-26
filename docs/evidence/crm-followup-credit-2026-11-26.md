# CRM2 客户域一批：线索最近跟进与 360 信用概要证据（2026-11-26）

> 批号前缀 CRM2。实施代理在隔离工作树里完成；主协调负责复核、合并、发布。
> 范围：TD-CRM-003（线索最近跟进）、TD-CRM-006（客户 360 信用概要）、TD-UI-002 尾项（旧视图残留）。
> 本文所有数字都是实施代理在自己的工作树与专用库上实跑得到的；没有实跑的在第 9 节逐条写明。

## 1. 范围与边界

- 做：线索列表响应加一个只读加性键；前端据此显示「最近跟进」；客户 360 信用概要经既有信用端点直连；删除两个生产零引用的旧客户视图文件。
- 不做：任何写路径语义、任何新端点、任何新迁移、任何新运行时依赖、`packages/ui` 的公共行为、`.github/workflows/`、`AGENTS.md`、`docs/evidence/ux-wave-release-2026-11-24.md`、`docs/exec-plans/active/`。
- 「从线索发起的活动带上 lead_id」不在本批：项目所有者 2026-11-26 已裁定另批实施，编号 **TD-CRM-008**（表格行由主协调登记）。

## 2. 基线与提交清单

- 工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave1/crm-wave`，分支 `feat/w1-crm-followup-credit`，基线 `main@4a93003`。
- 原五个代码提交保留；另补信用卡展示说明、缺值边界、公海组合权限三笔修正，共八笔代码，最后为 docs 提交。全部标 `[未测试]`（没有跑完整 `pnpm ci:local`，按任务书不冒称）：

| 提交         | 精确主题                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `4ed8c99`    | feat(api): add activity-read-gated lastActivityAt to the lead list (TD-CRM-003) [未测试]                   |
| `309a757`    | test(api): re-pin lead-path f3 scenarios for the activity grant argument (TD-CRM-003) [未测试]             |
| `cb89cf3`    | feat(web): show the latest follow-up time on lead cards and drawer (TD-CRM-003) [未测试]                   |
| `4e2f0a3`    | feat(web): load the customer 360 credit summary from existing credit endpoints (TD-CRM-006) [未测试]       |
| `fb65149`    | refactor(crm): retire the legacy customer views (TD-UI-002) [未测试]                                       |
| `6574f73`    | fix(crm): clarify the credit summary display semantics (TD-CRM-006) [未测试]                               |
| `bfeeda3`    | fix(crm): preserve missing credit snapshot amounts (TD-CRM-006) [未测试]                                   |
| `266920d`    | fix(api): gate pool follow-up timestamps on lead read access (TD-CRM-003) [未测试]                         |
| 本文所在提交 | docs(crm): record the lead follow-up and credit summary batch (TD-CRM-003, TD-CRM-006, TD-UI-002) [未测试] |

第 6 节区分原五笔代码与收口修正的实跑回执。API 全量 18,298 对应原五笔代码快照 `fb65149`；最后一笔 API 权限补强后按主协调要求只跑指定定向用例，不重复 API 全量。最终 Web 源码在 `bfeeda3` 后未变，已跑 Web 全量与构建。没有最终 HEAD 的完整 API 全量或 `ci:local` 回执。`4ed8c99` 单独检出时 f3 线索两场景是红的（与 `e3ffc3e` 先例同序），`309a757` 转绿；最后的公海门控不需要再次重钉。

### 2.1 改动文件与原因（均相对本工作树）

| 文件                                                                                                                                                   | 原因                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `apps/api/src/crm-repositories.ts`、`apps/api/src/routes/fastify/leads.ts`                                                                             | 列表加性聚合、来源活动的客户 DataScope、双读权限门控和既有键序保留                 |
| `apps/api/test/fastify/leads.test.ts`、`apps/api/test/crm-lead-activity-postgres.integration.test.ts`                                                  | 新增路由契约与真实 PostgreSQL 聚合/范围/租户验证                                   |
| `apps/api/test/app-batch4-preservation.test.ts`                                                                                                        | 单独提交 f3 两场景第五实参重钉                                                     |
| `apps/web/src/commercial/console/lead-console-cards.tsx`、`lead-console.tsx`、`lead-console.test.tsx`（同目录）                                        | 跟进相对时间、滞留色、抽屉事实与回退验证                                           |
| `apps/web/src/bootstrap.ts`、`apps/web/src/crm/types.ts`、`apps/web/src/shared/crm-http.ts`、`apps/web/src/crm/controller.ts`                          | CRM 权限白名单纳入 credit:read；沿用 HTTP 客户端增加两个可选信用读方法与控制器委托 |
| `apps/web/src/commercial/console-entry.ts`、`apps/web/src/commercial/console/customer-credit-port.ts`、`customer-credit-port.test.ts`（同目录）        | 权限成立时注入 loadCredit；验证请求门控与台账映射                                  |
| `apps/web/src/crm/crm-ux.ts`                                                                                                                           | 将既有信用台账映射为概要，保留缺值及多币种边界                                     |
| `apps/web/src/commercial/console/customer-console.tsx`、`customer-console-360.tsx`、`customer-console.test.tsx`、`customer-ports.ts`（同目录）         | 卡内失败重试、明确快照语义、组件验证与端口注释更新                                 |
| `apps/web/src/crm/customer-records.ts`、`customer360-view.ts`（同目录，删除）；`apps/web/src/bootstrap.test.ts`、`apps/web/src/style.css`              | 删除无生产引用旧视图、唯一源码读取与专属死样式                                     |
| `docs/evidence/u3-crm-2-customer-console-2026-11-21.md`、`u3-crm-3-contact-console-2026-11-21.md`、`u3-crm-4-activity-console-2026-11-21.md`（同目录） | 保留原文，追加 2026-11-26 挂载/退役时点更正                                        |
| 本文件、`docs/index.md`、`docs/exec-plans/tech-debt-tracker.md`                                                                                        | 本批证据、索引、顶部进展及仅三条负责项的状态格                                     |

## 3. A：线索最近跟进（TD-CRM-003）

### 3.1 lead_id 的写入路径现状（只读核查，行号为基线 `4a93003`）

| 层     | 位置                                                                                                            | 结论                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 数据库 | `packages/database/migrations/0017_crm_customer_lead_foundation.sql:70`                                         | `customer_activities.customer_id uuid NOT NULL`，`lead_id uuid`（可空）；表不可变（同文件 :109 触发器拒绝 UPDATE/DELETE），所以只有 INSERT 一条写入路径 |
| 仓储   | `apps/api/src/crm-repositories.ts:900`（`createActivity`）                                                      | 全仓唯一一条 `INSERT INTO customer_activities`，`$3 = input.leadId`；同语句要求线索与活动同客户（`leads.customer_id=$2`），否则 404（:914）             |
| API    | legacy `apps/api/src/routes/customer-activities.ts:55,64-67`；桥轨 `routes/fastify/activities.ts:157-164`       | 两条 POST 轨都接受请求体 `leadId`（uuid 或 null）并原样交给仓储，字段授权清单含 `leadId`                                                                |
| Web    | `apps/web/src/commercial/console/customer-console.tsx:495`；`apps/web/src/shared/crm-http.ts:71`                | 两处「添加活动」表单都写死 `leadId: null`                                                                                                               |
| seed   | `scripts/seed_p1_demo.mjs`                                                                                      | 不造任何活动（全文无 `activities` 请求）；唯一的 `leadId`（:70）是商机的，值为 null                                                                     |
| 冒烟   | `scripts/e2e-local/write-smoke-flows.mjs:248-263`                                                               | 经界面表单添加活动，因此同样是 null                                                                                                                     |
| 测试   | `apps/api/test/crm-read-postgres.integration.test.ts:56-59`；`customer-activity-route-contract.test.ts:112-120` | 只有这两个测试向 `createActivity` 传过非空 `leadId`                                                                                                     |

**结论**：后端两条既有 POST 轨已支持非空 `leadId`；产品表单、演示 seed 与写冒烟没有生成这类关联，不能据此断言所有数据库中的该列恒为空。项目所有者说明当前处于开发阶段、生产没有实际业务单据，本批未查询线上数据。通过现有表单或 seed 产生、没有关联活动的线索会得到 null，界面回退「最近更新」；外部调用既有 API 传入有效 `leadId` 时可以得到非空结果（本批真库与浏览器探针已验证）。从线索上下文发起活动的产品写流程已裁定另批实施（TD-CRM-008），本批未实现。给下一批的事实见第 11 节。

### 3.2 加性字段

- 字段名 `lastActivityAt`（与既有 `createdAt` / `updatedAt` 同风格），类型 `string | null`；真实仓储在无字段白名单的列表项中恒给该键，白名单仍按既有规则裁剪。取该线索名下活动的最大 `occurred_at`（ISO 串）。
- 所在响应：`GET /api/v1/leads` 与 `GET /api/v1/leads/pool` 的每个列表项，由仓储 `listLeadPage` 产生（`apps/api/src/crm-repositories.ts`）。`GET /api/v1/leads/:id` 详情没有加——界面不消费它，见第 8 节。
- legacy 轨 `listLeads` 与 `lead()` 映射一行未动，legacy 响应不变。

**门控（已确认，2026-11-26 项目所有者）**：账号的 `lead:read` 与 `customer-activity:read` 都必须存在且作用域非空，才向仓储传活动授权；否则第五实参为 null，活动谓词为 `FALSE`，跟进字段为 null。`/leads/pool` 的列表可读性仍只要求 `lead-pool:read`：即使同时持公海读与活动读，缺少 `lead:read` 或其作用域为空时仍返回 200，只隐藏跟进时间（`266920d` 补强，见 3.5）。聚合只统计活动读授权范围内可见客户的活动（与 `customer360` / `listActivities` 的客户可见性同一个 `recordScopeSql` 谓词，没有复制 DataScope），并且只对本语句按列表 DataScope 筛出的线索求值——范围外线索不产生任何活动时间。两种取法在真实角色上的差异见第 12 节。

### 3.3 f3 冻结轨迹：需要重钉，已按先例重钉

f3 探针（`scripts/analysis/app-preservation-probe.mjs`）的授权上下文对任何能力都返回 COMPANY 授权，所以两个已钉的线索场景多出第 5 个仓储实参。

| 时点                                       | 命令（均在 `apps/api`，`NODE_ENV=test` + 专用库）                  | 结果                                      |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| 改代码、未重钉（`a2-f3-before-repin.log`） | `vitest run test/app-batch4-preservation.test.ts`                  | 2 失败 / 309 通过（共 311），EXIT=1       |
| 重钉后（`a2-f3-after-repin.log`）          | 同上，加 dispatch-source / app-values / scope-sql-crm 三个守卫文件 | 4 文件 348/348，EXIT=0（f3 自身 311/311） |

终止仓储调用，改前：

```
['call','crm','listLeadPage',[actor,['COMPANY'],[],{ limit: 100, pool: false|true }]]
```

改后（只多末尾一个实参；响应 `{ items: [] }` 不变）：

```
['call','crm','listLeadPage',[actor,['COMPANY'],[],{ limit: 100, pool: false|true },{ scopes: ['COMPANY'], anchors: [] }]]
```

重钉只改测试 `apps/api/test/app-batch4-preservation.test.ts` 里那一个钉定块，与 `e3ffc3e` 同序同法。`dispatch-source-preservation`（legacy dispatch 逐字节冻结）与 `app-values-preservation` 没有改动即过。

### 3.4 逐键对照

仓储层（真库断言，`crm-lead-activity-postgres.integration.test.ts`）：对每一条线索，把加性项去掉末尾的 `lastActivityAt` 后，`JSON.stringify` 与 legacy `listLeads` 的同一行逐字节相同，且 legacy 行不含该键。

线上层（`fastify/leads.test.ts`）：改前响应的 JSON 是改后响应的字节前缀。键序如下，`lastActivityAt` 排在最末：

```
id, tenantId, title, source, status, ownerId, customerId, version, createdAt, updatedAt, ownerOrganizationId, lastActivityAt
```

`ownerOrganizationId` 此前没有在响应 schema 里声明，靠 `looseObject` 透传、序列化时排在全部声明键之后；本批按它在线上的既有位置显式声明（取值与校验不变，恒为字符串或 null），加性键才真正排在末尾。改前键序的依据：同一断言在还原到基线源码时也是通过的（见 3.5 红绿记录）。

字段白名单：`lead:read` / `lead-pool:read` 的 `field_allowlist` 非 null 时，`permittedDto` 按白名单裁剪，不在白名单的键（含 `lastActivityAt`）不返回——与其它键同一规则。现有角色目录的业务角色白名单都是 NULL，不受影响。

### 3.5 测试

- 新增 `apps/api/test/fastify/leads.test.ts`（最终 17 例）：有双读权限时第 5 实参为活动授权范围（作用域 + 锚点）；无活动读权限 / 作用域为空时为 null；键序与字节前缀；Date 归一为 ISO 串；字段白名单裁剪；旧替身形态仍通过 schema；普通线索列表无读权限时 403 先于仓储调用。两个端点各跑一遍。最后另加两例：公海与活动均可读、`lead:read` 分别缺失或为空作用域时，HTTP 200、仓储调用一次、第五实参 null、行内跟进时间 null；替身依第五实参动态给值，可检出旧门控漏口。
- 新增 `apps/api/test/crm-lead-activity-postgres.integration.test.ts`（3 例，真实 schema）：同一线索两条活动取最新；挂在别的线索、只挂客户的活动不计；无活动的线索与公海线索为 null；既有键逐字节守恒（列表与公海）；无授权不聚合；数据范围受限账号（SELF）看不到的线索不出现、活动读授权范围内看不到其客户时字段为 null、客户负责人变更后字段出现；活动读授权比线索读授权宽时仍只跟随已列出的线索；租户隔离。
- 红绿：把两个源文件换回基线版本后跑三个文件，11 失败 / 318 通过（`a2-new-tests-on-baseline-sources.log`），恢复后 `sha256sum -c` 逐字节一致。
- Web：`lead-console.test.tsx` 新增 3 例（有活动时间显示「最近跟进 <相对时间>」且警示按活动时间算；null / 缺失 / 不可解析回退；详情抽屉有值才多一格），文件 27/27。

### 3.6 界面

- 列表单元格（`lead-console-cards.tsx` 的 `LeadUpdatedCell`）：有值显示「最近跟进 <相对时间>」，滞留警示色按活动时间算，悬停为绝对时间 +「跟进」，并带 `data-kind="activity"`；没有值时 DOM 与加字段之前相同（`data-testid="kt-lead-updated"` 不变）。
- 详情抽屉：有值才多显示一格「最近跟进 <日期时间>」。
- 列头仍是「最近更新」，没有改（见 CRM2-10）。

## 4. B：客户 360 信用概要（TD-CRM-006）

### 4.1 装配位置与权限门控

- 装配在 `appendCustomerConsole`（`apps/web/src/commercial/console-entry.ts`）的端口对象里，照既有「端口委托控制器」的写法，只有一行展开：`...creditPortFor(controller.permissions, controller)`。判定函数在新文件 `console/customer-credit-port.ts`（纯函数，便于单测「无权限不请求」）。
- 门控：账号具备 `credit:read` **且** CRM HTTP 客户端带信用读取方法时才注入 `loadCredit`；否则端口不存在，控制台不发任何信用请求、不渲染卡片，也没有空白占位。
- `CrmController` 的权限集在 `bootstrap.ts` 里是按一张 CRM 白名单过滤出来的，原先不含 `credit:read`，所以 `bootstrap.ts` 的那张白名单加了一行（共享文件，+1 行，785 → 786 行，仍在 800 行门限内）。这是本批对 `bootstrap.ts` 的唯一改动。
- 请求走既有封装：`CrmApi` 新增两个可选方法（`shared/crm-http.ts` 的 `createFetchCrmApi`），即 `GET /api/v1/credit-limits` 与 `GET /api/v1/credit-decisions`，超时、关联 ID、错误映射全部沿用，没有新写 fetch。
- 「高价值」卡维持隐藏（没有口径就不发明）。

### 4.2 已定展示规则（既有端点响应 → `CustomerCreditSummary`）

主协调 2026-11-26 已裁定以下展示取行规则：沿用既有端点顺序，不新增或变更信用审批、实时敞口算法。合成函数是纯函数 `creditSummaryFromLedgers`（`apps/web/src/crm/crm-ux.ts`），端点行为 pg 蛇形列名，个别派生键为驼峰。产品内明确标为「最新生效额度」「最近评估敞口」「参考使用率」，并说明「额度取最新生效记录；敞口为最近一次评估时的金额。」审批时间仍只随「最近决定」展示，不冒充评估时间。

| 概要字段   | 来源                                                                                                  | 口径                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limit`    | `/credit-limits` 中 `customer_id` 等于该客户、且当前生效（`effective_at ≤ now < expires_at`）的第一条 | 服务端序为 `effective_at DESC, id`，即最新生效的一条；币种与金额取该行 `currency` / `amount`；没有生效中的额度 → null                                                        |
| `exposure` | `/credit-decisions` 中该客户的第一条（服务端序 `created_at DESC, id`）的 `exposureAmount`             | **最近一次信用评估时点的敞口快照**，不是实时敞口；币种取该决定的 `currency`；没有决定或快照缺值 → null                                                                       |
| `decision` | 同上一条决定                                                                                          | 结论取 `effective_status`（缺失时回落原始 `status`，再缺省 `PENDING_APPROVAL`，与信用审查控制台同口径）；`decidedAt` 取审批时间 `decided_at`，未审批为空串，卡片上不显示时间 |
| 使用率     | 前端计算                                                                                              | 敞口 / 额度，仅两者币种相同时计算；币种不同显示「—」                                                                                                                         |
| 多币种     | —                                                                                                     | 卡片是单额度、单敞口形态，各按自身币种显示；不做跨币种合计                                                                                                                   |
| 空态       | —                                                                                                     | 三项全缺或客户编号为空 → null，卡片显示「暂无信用记录」                                                                                                                      |

### 4.3 失败态

此前端口失败时卡片直接隐藏（原设计写的是「辅助信息：失败即隐藏」，并有一条单测钉着这个行为）。本批按任务书改为不吞错：卡片内显示简短原因（经既有 `failureMessage` 转中文）与「重试」按钮（`data-testid="kt-customer-credit-retry"`），错误不写入抽屉的提交错误位，360 其它分区照常。原单测改写为「失败显示原因与重试入口；重试成功后恢复概要」。

### 4.4 测试

- 新增 `console/customer-credit-port.test.ts`（最终 14 例）：无 `credit:read` 不注入端口、两个端点零请求；有权限时各请求一次并合成概要；客户端不带信用方法时不注入；额度 / 敞口 / 决定口径与多币种；未生效或过期额度不算；无记录返回 null。
- `customer-console.test.tsx`：空态；失败 → 卡内原因 + 重试 → 恢复（不占用提交错误位，事实条仍在）；360 响应内嵌 credit 分区时仍优先于端口（行为断言保持）。末次展示裁定后新增多币种组件用例，保留各自币种且参考使用率显示「—」。
- **旧断言改动明细**：原「端口返回空、失败时分别呈现空态 / 不渲染」拆为空态与失败重试两例，失败期望由隐藏改为显示卡内原因与重试（任务书明确要求）；三处「额度使用率 75% / 75% / 95%」期望改成「参考使用率 …」，对应端口成功、重试成功、内嵌 credit 优先三条用例；新增标题、说明文字、无障碍进度条名称断言。没有删除失败或权限负例。
- 映射用例新增「沿用端点创建顺序、而非审批时间重排」；控制器用例固定 `Date.now()` 为 2026-11-26，避免信用额度夹具随运行日期自然过期。
- 主协调复核指出新映射会将 SQL 提取缺键的 `exposureAmount: null` 经 `Number(null)` 转为 0。本批未发布代码已在**新映射调用点**修正，原 `creditMoneyOf` 不改：null / undefined / 空串 / 空白串 → null，真实数值 0 / 字符串 `0` / `0.000000` → 0；增加 7 个纯映射边界用例与 1 个组件「金额显示 —」用例。以新断言运行旧映射，3 红 / 4 绿 / 7 跳过，EXIT=1；恢复修正后两文件 47/47，EXIT=0。还原源码的 SHA256 已核对一致，日志 `credit-null-before-fix.log` 与 `credit-null-after-fix.log`。
- 真浏览器：见第 7 节（合成账号，不是真实角色目录账号）。

## 5. C：旧视图残留（TD-UI-002 尾项）

### 5.1 判定

| 检查项                     | 结果                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 生产引用                   | 两个文件的非测试导入均为零；检索文件名及 `appendCustomerList`、`appendCustomerDetail`、`customer360Content`                                                                                                                          |
| 专用测试                   | 没有专门导入这两个模块的行为测试文件                                                                                                                                                                                                 |
| bootstrap.test.ts 引用原因 | 「captures artificial-turf project handoff fields without test-channel evidence markers」拼接一批源码检查交接字段，其中一行读取旧 360 模块。只移除这一行，整条测试保持、115/115 通过；旧模块的 UI 行为已有 customer-console 测试覆盖 |
| 动态拼接类名               | 从两个文件的 `el` 第二参数、class 属性与 classList 调用提取 36 个类名；对其余 TS/TSX 检索整词、片段及以 section/card/row/list/icon/state 为后缀的模板，未发现动态生成这些专属类名的代码                                              |

### 5.2 删除清单

- 文件：`apps/web/src/crm/customer-records.ts`（242 行）、`apps/web/src/crm/customer360-view.ts`（100 行）。
- `apps/web/src/bootstrap.test.ts`：去掉上述一行。
- `apps/web/src/style.css`：只被这两个文件使用的规则。整块删除：`.customer-row`（两处，含 `.mobile .customer-row`）、`.avatar`、`.customer-360-content`、`.detail-section h3`、`.empty-state .empty-icon`、`.list-filters`、`.filter-empty`、`.info-card` 两块；选择器列表里只摘掉 `.info-card`（两处）、`.contact-card`（两处）、`.history-row`（三处）、`.customer-list`（一处）。
- 保留：`.timeline-item`（`commercial/console/gr-console-detail.tsx:383` 的收货时间线仍在用）、`.lead-pool`、`.empty-state` 系列（`packages/ui` 的 `EmptyState` 组件在用这个类名）。`crm-ux.css` 没有只被这两个文件使用的规则，零改动。
- 36 个类名中，14 个同时见于其它 Web 源码；`.empty-state` 由 UI Kit 使用，一并保留。另 21 个专属类名中，11 个有样式（如上一条删除清单），10 个未定义专用样式：`activity-timeline`、`contact-details`、`contact-title`、`contacts-section`、`customer-identity`、`ownership-section`、`related-lead`、`related-leads-section`、`related-opportunities-section`、`related-opportunity`。
- 没有删除的相关残留见 CRM2-4（`lead-records.ts` 不在任务书点名的范围内）。

## 6. 验证命令与退出码

除标注外均在工作树根目录；重活经 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy`。原始日志在 `/home/jinhuit/Kingturf/kingturf-coord/wave1/crm-wave-artifacts/logs/`。

| 命令                                                                      | 退出码 | 快照、关键数字与日志                                                                                                                                                         |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:migrate` / `pnpm db:status`（专用库 `w1_crm_wave_test`）         | 0 / 0  | 77 条迁移全部 applied；没有新增迁移                                                                                                                                          |
| `heavy pnpm --filter @kingturf/api test`                                  | 0      | **原五笔代码快照 `fb65149`**：201 文件，**18,298 / 18,298**；13:30:30–13:43:32，`api-full.log`                                                                               |
| `heavy pnpm --filter @kingturf/api exec vitest run` + 下列五文件          | 0      | **最终代码 `266920d`**：5 文件，**361 / 361**；路由 17 + 聚合真库 3 + f3 311 + dispatch 28 + app-values 2；`closing-api-targeted.log`                                        |
| `heavy pnpm --filter @kingturf/web exec vitest run --maxWorkers=4`        | 0      | 最终 Web 源码（`bfeeda3` 后未变）：66 文件，**1,044 / 1,044**；`closing-web-test.log`                                                                                        |
| `pnpm --filter @kingturf/web exec vitest run` + 信用端口/客户控制台两文件 | 0      | 最终代码相关定向 **47 / 47**（14 + 33）；`closing-web-targeted.log`                                                                                                          |
| `heavy pnpm --filter @kingturf/domain test`                               | 0      | 原五笔代码快照：4 文件，20 / 20；domain 本批零改动                                                                                                                           |
| `heavy pnpm --filter @kingturf/web build`                                 | 0      | 最终 Web：登录关键路径 JS **11753 B** gzip（预算 12000 B）+ CSS **0 B**；console CSS 守卫通过；`closing-web-build.log`                                                       |
| `heavy pnpm lint`；最终 API/Web 修改文件的 scoped ESLint                  | 0 / 0  | 全量 lint 在 Web 收口后通过，只有 `server-fastify.ts` 两条既有警告；最终 API 权限补强后 scoped lint 通过；`closing-lint.log`、`closing-api-lint.log`、`closing-web-lint.log` |
| `pnpm typecheck`                                                          | 0      | 最终代码全仓类型检查；`closing-typecheck.log`                                                                                                                                |
| `pnpm format:check`                                                       | 0      | 最终文档提交前通过；`closing-format.log`                                                                                                                                     |
| `pnpm doc:lint`                                                           | 0      | 最终文档提交前通过；`closing-doclint.log`                                                                                                                                    |
| `pnpm structure:check`                                                    | 0      | 最终代码：强制违规 0，存量白名单豁免 30，G5 豁免 0；`closing-structure.log`                                                                                                  |
| `pnpm service:check`                                                      | 0      | 最终代码：244 文件，32 仓储端口，241 路由模板，0 违规；`closing-service.log`                                                                                                 |
| `pnpm verify:frontend-capabilities`                                       | 0      | 最终代码：0 direct capabilities，19 governed endpoint families；`closing-capabilities.log`                                                                                   |

最终 API 定向五文件（命令在 `apps/api` 包下执行）：

```sh
vitest run test/fastify/leads.test.ts test/crm-lead-activity-postgres.integration.test.ts test/app-batch4-preservation.test.ts test/dispatch-source-preservation.test.ts test/app-values-preservation.test.ts
```

最终 Web 信用定向两文件：`src/commercial/console/customer-credit-port.test.ts`、`src/commercial/console/customer-console.test.tsx`。API 用例使用 `NODE_ENV=test` 与环境变量注入的专用库连接，连接串和口令不进日志或文件。

原五笔代码回执为 API 18,298、Web 1,034 / JS 11752B；展示说明修正后 Web 1,036 / JS 11751B；缺值边界修正后 Web **1,044 / JS 11753B**。最终公海门控新增两条路由负例后只有上述 API 定向回执，没有再次跑 API 全量；完整 `ci:local` 由主协调在合并树串行执行。相较第十次发布的 Web 1,024，本批净增 20（线索控制台 3 + 信用端口 14 + 客户控制台净增 3）。全部所列实跑退出码为 0，原始与收口日志均保留。

## 7. 真浏览器验证

工具：`scripts/e2e-local/e2e-local.mjs`，镜像 `mcr.microsoft.com/playwright:v1.62.1-noble`，容器 `e2e-harness-crmwave`，产物 `/home/jinhuit/Kingturf/kingturf-coord/wave1/crm-wave-artifacts/e2e`。末轮在 **最终代码 `266920d` + 最终 Web 构建** 上重新起栈，双视口走查与探针全部完成；日志统一为 `logs/post-review-*.log`。第 7.2 节前后像素对照是原五笔代码时点的前端对照，保留其快照边界。

### 7.1 走查（`walk --routes customers,leads`）

| 构建                     | 视口    | 结果                                                        |
| ------------------------ | ------- | ----------------------------------------------------------- |
| 当前分支                 | desktop | 2/2 到达，errors=0，api≥400=0，pageIssues=0，drawerIssues=0 |
| 当前分支                 | mobile  | 2/2 到达，errors=0，api≥400=0；leads pageIssues=2（见下）   |
| 基线 web 构建 + 当前 API | desktop | 2/2 到达，全部 0                                            |
| 基线 web 构建 + 当前 API | mobile  | 2/2 到达；leads pageIssues=2（与当前分支完全相同的两条）    |

mobile 的两条是 `cjk-per-char-wrap`，落在我造的两条探针线索的**标题**按钮上（13 个字在 390 宽下排成 9 行）；基线构建在同一份数据上同样复现，属于标题列既有的窄屏行为，不是本批引入（CRM2-6）。标题单元格本批没有动。

### 7.2 前后对照（同一栈、同一数据、同一 API，像素比对）

| 截图                             | desktop                                              | mobile                                        |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `customers.png`                  | 逐字节相同                                           | 逐字节相同                                    |
| `customers--customer-drawer.png` | 仅一处相对时间文字不同（「2 分钟前」对「8 分钟前」） | 逐字节相同                                    |
| `leads.png`                      | 差异区 (618,465)–(1307,586)：已跟进线索的单元格      | 差异区 (361,1342)–(752,2201)：同一单元格      |
| `leads--lead-drawer.png`         | 多出「最近跟进」一格                                 | 多出「最近跟进」一格（在 390 宽下折到第二行） |

基线的做法与任务书设想略有不同，如实说明：先用 `git worktree add --detach` 在产物目录开了临时基线树 `4a93003`，但该树没有自己的依赖，符号链接进容器后解析不到，基线栈起不来；于是改为在已起好的当前栈里把前端构建产物临时换成基线构建、走查后再换回（已换回并核对产物哈希不同）。因此「前」是**基线前端 + 当前 API**：对客户路由等价于基线（360 响应不含内嵌 credit）；对线索列表，基线前端会忽略多出来的 `lastActivityAt` 键。没有做「基线 API + 基线前端」的整栈对照。

### 7.3 定向探针（脚本在产物目录 `probe/`，不入库）

造数：经接口新建两条挂在演示客户上的线索，并给其中一条挂两次「拜访」（2026-11-20、2026-11-24）；接口回读 `lastActivityAt` 为 `2026-11-24T02:00:00.000Z`，另一条为 null。受限账号按 `bootstrap.mjs` 的建模另造两个合成账号（各去掉一项权限，其余 192 项全给，作用域 COMPANY）。

| 视口    | 账号                 | 检查项                                                                                                    | 结果 |
| ------- | -------------------- | --------------------------------------------------------------------------------------------------------- | ---- |
| desktop | admin（全权限）      | 已跟进线索显示「最近跟进 2 天前」；无活动线索回退「最近更新」；抽屉含「最近跟进」                         | 通过 |
| desktop | admin                | 信用概要卡出现，内容非空；请求恰为 `/credit-limits`、`/credit-decisions` 各一次                           | 通过 |
| desktop | `crmwave.nocredit`   | 零信用请求；信用概要卡不出现，无「信用概要」占位文字                                                      | 通过 |
| desktop | `crmwave.noactivity` | 接口 `lastActivityAt` 为 null；界面回退「最近更新」；抽屉不含「最近跟进」；信用卡照常（它有 credit:read） | 通过 |
| mobile  | admin                | 同上前两项                                                                                                | 通过 |

最终 desktop 19/19、mobile 8/8，退出码 0；登录后无页面异常、无控制台报错、无 ≥400 响应。探针第一轮把登录前的控制台错误也算进去，记到一条登录页会话探测的 401（既有行为，与本批无关），改为登录后才开始记录。

最终截图在产物目录 `e2e/final/` 下（原五笔代码的初验截图仍保留于 `e2e/probe/` 与 `e2e/walk/`）：

- `probe/desktop/`：`leads-admin.png`、`lead-drawer-admin.png`、`customer-360-admin.png`、`credit-card-admin.png`、`leads-noactivity.png`、`lead-drawer-noactivity.png`、`customer-360-noactivity.png`、`credit-card-noactivity.png`、`customer-360-nocredit.png`
- `probe/mobile/`：`leads-admin.png`、`leads-recency-admin.png`（表格横向滚动后）、`lead-drawer-admin.png`、`customer-360-admin.png`、`credit-card-admin.png`
- 最终走查：`e2e/final/walk/{desktop,mobile}/shots/`；初验与前后对照：`e2e/walk/{desktop,mobile}/shots/` 与 `e2e/walk-baseline/{desktop,mobile}/{desktop,mobile}/shots/`
- 差异裁剪：`e2e/compare/`

目检结论：最终信用概要卡在两档视口排版正常（最新生效额度 ¥5,000,000 / 最近评估敞口 ¥0 / 参考使用率 0% / 最近决定 信用已过期——演示客户最新创建的决定是过期的那条），说明文字完整显示。线索详情抽屉的跟进时间两档可读；390 宽列表需要在表格自身横向滚动后才能完整看到时间列，探针另拍 `leads-recency-admin.png`；标题一字一行仍存在，不能称为移动端零布局问题。活动时间线的两条探针活动已关联线索。

截图取点后补：最初探针在抽屉滑入动画结束前截图，导致抽屉只露出右侧；已改为复用仓库 `settle(page)` 等动画完成后重拍，最终截图不沿用该中间取点。移动倍率最初嵌入 viewport 对象未生效，最终已改为 context 独立 `deviceScaleFactor`，并量测断言 desktop 1440×900@1、mobile 390×844@2。

## 8. 偏离任务书之处

1. f3 需要重钉（任务书已预留），做了一次测试侧重钉。
2. 详情端点 `GET /api/v1/leads/:id` 没有加 `lastActivityAt`（任务书写的是「必要时含详情」；界面不消费它，判定不必要）。
3. 详情抽屉也显示了「最近跟进」（任务书只说卡/列表；仅在字段有值时多一格，为空时 DOM 不变）。
4. 响应 schema 里显式声明了既有的 `ownerOrganizationId`（为了加性键真正排在末尾，见 3.4）。
5. `bootstrap.ts` 加了一行（CRM 权限白名单放入 `credit:read`），超出了「尽量局限在客户端口装配处」——不改这一行宿主就拿不到 `credit:read`。
6. 信用概要失败行为由「隐藏」改成「卡内原因 + 重试」（任务书要求），改写了一条钉旧行为的单测。
7. 旧视图删除时一并清了 `style.css` 的死规则、去掉了 `bootstrap.test.ts` 的一行源码引用（任务书点名的制造业先例做法）。
8. 基线对照的方法与设想不同（见 7.2）。
9. 收口增加三笔本批代码修正：明确展示取行的产品说明、避免缺值快照被映射为零、公海组合权限补查 `lead:read`。原五笔提交保留，docs 提交最后且也标 `[未测试]`。
10. 未提交台账拼接曾将三条状态行少写一列并引发全表重排；已从 HEAD 主表恢复，仅改允许的 3 格状态、追加顶部小节。最终验证主表七列、其它单元格逐项保持。

## 9. 没做、没验证、做不了

- 没有跑完整 `pnpm ci:local`（按任务书留给主协调）；因此 `test:release-guardrails`、覆盖率检查、`audit:scan`、`security:check` 没有在分支上跑。
- 全站走查、P1 三轮、写冒烟没有跑（主协调做）。
- 聚合的性能没有量测：`customer_activities` 没有 `lead_id` 索引，见 CRM2-3。
- 新子查询在真库上只用 COMPANY 与 SELF 两种活动授权作用域跑过；带锚点（TEAM/DEPARTMENT/REGION）的谓词没有在新子查询里实跑（谓词由共享的 `recordScopeSql` 生成，它有自己的真库对拍）。
- 字段白名单裁剪只用仓储替身在路由单测里验证，没有在真库上配一个带白名单的角色走一遍。
- 信用概要的失败态与重试只在单测（mini-DOM）里验证，真浏览器探针没有做失败注入。
- 多币种显示有纯映射和组件单测，浏览器演示数据仍为单一币种。
- 浏览器里用的是合成账号（全权限、去一项权限），不是真实角色目录里的角色账号；真实角色形态由单测与第 12 节的目录核对补偿，补偿的边界是：没有在真实角色下点过界面。最终「公海读 + 活动读、lead:read 缺失 / 空作用域」的组合只跑路由两条负例，没有另造浏览器账号。
- 「基线 API + 基线前端」整栈没有跑（原因见 7.2）。
- `apps/api/src/crm-repositories.ts` 沿用既有 G1 白名单豁免：1043 → 1073 行（+34/−4，净增 30），没有新增或扩大白名单，也没有拆分该存量超限文件。

## 10. 新发现（不顺手修，仅上报）

| 编号    | 发现                                                                                                                                                | 复现方式 / 依据                                                                               | 影响面                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| CRM2-1  | 产品表单与 seed 不生成活动的 `lead_id`，但既有 API 已支持非空值                                                                                     | 第 3.1 节；生产无实际业务单据为所有者说明，未查询线上                                         | 产品内线索跟进入口已裁定另批 TD-CRM-008，本批只完成读面                             |
| CRM2-2  | `lead:update` 有授权无实现                                                                                                                          | `grep -rn "lead:update" apps/api/src` 无命中，只有 `packages/types/src/index.ts:323` 的能力键 | 下一批若要回填 `leads.customer_id` 需要新写端点                                     |
| CRM2-3  | `customer_activities` 没有 `lead_id` 索引（只有 `(tenant_id, customer_id, occurred_at DESC, id)`）                                                  | `0017…sql:75`                                                                                 | 聚合是相关子查询，列表上限 100 行；数据量上来后每次列表可能做上百次顺序扫描，未量测 |
| CRM2-4  | 旧线索视图 `apps/web/src/crm/lead-records.ts` 仍在仓库，生产零引用，只被 `lead-records-behavior.test.ts` 导入并测试；`record-ports.ts` 只被它们引用 | `grep -rn "crm/lead-records'" apps/web/src`                                                   | 死代码加一个只测死代码的测试文件；不在本批点名范围，未删                            |
| CRM2-5  | `GET /api/v1/leads/:id` 返回 pg 原始蛇形列名行，与列表项的驼峰键不一致；字段白名单非 null 时驼峰键匹配不上而被裁掉                                  | 静态核对：`findLead` 返回 `LeadRow`，路由未映射即 `permittedDto`；**未实跑**                  | 详情端点的契约与列表不一致                                                          |
| CRM2-6  | 390 宽下线索标题列对 13 字标题一字一行                                                                                                              | 7.1；基线构建同样复现                                                                         | 窄屏可读性；本批未引入                                                              |
| CRM2-7  | 两个信用端点没有客户筛选、没有分页                                                                                                                  | `qtc-repositories.ts:136-137` 的两条 SELECT                                                   | 每打开一个客户抽屉拉全量两份台账；台账大了应加筛选或前端缓存                        |
| CRM2-8  | 初稿对信用概要展示取行的假设已上报并获主协调确认（已收口）                                                                                          | 第 4.2 节：最新生效额度、最近评估敞口、参考使用率及卡内说明                                   | 沿用已有读数据；不汇总多币种，不暗示实时敞口                                        |
| CRM2-9  | `lead:read` / `lead-pool:read` 带字段白名单的角色收不到 `lastActivityAt`                                                                            | `permittedDto` 规则；现有目录业务角色白名单均为 NULL                                          | 目前无角色受影响；将来配白名单时要记得加这个键                                      |
| CRM2-10 | 线索列表列头仍是「最近更新」，单元格显示「最近跟进 …」时靠单元格自带文案区分                                                                        | `lead-console.tsx` 的 `columns`                                                               | 列头与部分单元格语义不完全对应                                                      |
| CRM2-11 | 真实角色目录里没有任何业务角色同时具备 `lead:read` 与 `customer-activity:read`                                                                      | 第 12 节                                                                                      | 门控后该字段对现有业务角色全部不可见；所有者已裁定调整角色目录，归 TD-CRM-008       |

## 11. 给下一批（TD-CRM-008）留的事实

项目所有者 2026-11-26 裁定（主协调转达，本批不实施）：数据模型取「活动允许只挂线索」（客户可空、客户与线索至少其一、加线索索引）；角色目录调整为线索操作员加活动读写权限、客户专员加线索读权限。

1. **线索与客户的关联方式**
   - `leads.customer_id` 可空（`0017…sql:48`，外键 :51）；`customer_activities.customer_id` 为 `NOT NULL`（:70）。所以按现 schema，没有客户的线索挂不了活动。
   - 线索拿到客户的唯一时点是创建：`createLead` 的 `customerId`（`crm-repositories.ts:568-598`；`lead-base.ts:77-80`、`fastify/leads.ts:182-185`）。三条 `UPDATE leads`（:655 认领、:715 流转、:819 分配）只改状态与负责人；`CONVERTED` 流转既不建客户也不回填 `customer_id`。
   - 现有两个建线索入口都不带客户：控制台新建恒 `customerId: null`（`lead-console.tsx:647`）；官网询盘的 INSERT 不含 `customer_id`（`website-lead-ingest.ts:157-159`）。
   - 仓储已有约束：线索与活动不同客户则 404「Customer or related lead not found」（`crm-repositories.ts:900,914`）。
2. **两处「添加活动」表单的载荷与提交链路**
   - 控制台（生产路径）：`customer-console.tsx:484-510` `addActivity`，表单值 `activityType`（缺省「拜访」）、`occurredAt`（只有日期，追加 `T00:00:00` 后按浏览器本地时区解析再转 ISO；留空取当前时间）、`summary`；载荷固定 `{ leadId: null, type, occurredAt, summary, details: {} }`。链路：`ports.createActivity` → `console-entry.ts:420-428` → `CrmController.createActivity`（`crm/controller.ts:137-150`：`customer-activity:create` 门 → 请求 → 有 `customer-360:read` 则刷新 360）→ `shared/crm-http.ts:74-80`。
   - 旧 vanilla：`shared/crm-http.ts:68-73` `addActivity`，载荷 `{ leadId: null, type: 'NOTE', … }`，调用方 `CrmController.mutateSelected('activity')`（`controller.ts:193-194`），其界面属于本批已删除的旧视图，现在是无调用方的残留。
   - 服务端两轨都已接受 `leadId`，写路径只差前端带值。
   - 线索控制台现在没有任何活动表单：线索详情抽屉只有认领 / 变更状态 / 分配改派 / 释放。
3. **角色与权限（迁移 `0046` 的真实角色目录；业务角色一律 `field_allowlist=NULL`、`data_scopes=['COMPANY']`）**：见第 12 节。

## 12. 两种门控取法在真实角色上的差异

| 角色                                    | lead:read | lead-pool:read | customer:read | customer-360:read | customer-activity:read | customer-activity:create | 本批（要求活动读权限）       | 若不要求活动读权限 |
| --------------------------------------- | --------- | -------------- | ------------- | ----------------- | ---------------------- | ------------------------ | ---------------------------- | ------------------ |
| `KT_LEAD_OPERATOR`                      | 有        | 有             | 无            | 无                | 无                     | 无                       | 看不到，回退「最近更新」     | 能看到             |
| `KT_CUSTOMER_OWNERSHIP_MANAGER`         | 有        | 无             | 有            | 无                | 无                     | 无                       | 看不到，回退「最近更新」     | 能看到             |
| `KT_CUSTOMER_STEWARD`                   | 无        | 无             | 有            | 有                | 有                     | 有                       | 打不开线索列表，字段无从谈起 | 同左               |
| 持全部权限的账号（如本地 e2e 的 admin） | 有        | 有             | 有            | 有                | 有                     | 有                       | 能看到                       | 能看到             |

目录里有 `lead:read` 的角色只有前两个，有活动读或写权限的只有 `KT_CUSTOMER_STEWARD`。所有者已确认取「要求活动读权限」；角色目录的调整归 TD-CRM-008。

## 13. 清理

- 最终代码浏览器复验后，`e2e-harness-crmwave` 已经 `e2e-local.mjs down`，本轮随机库 `kingturf_test_e2e_c2371f7c` 已删除，退出码 0（`post-review-down.log`）。`docker ps -a` 按本容器精确名筛选为空；此前各轮同名栈在重起前均已正常 down。
- 最早一轮库 `kingturf_test_e2e_67f6d9dc`、基线尝试的 `e2e-harness-crmbase` 与库 `kingturf_test_e2e_60da0f35` 均已清理；临时基线树 `crm-wave-artifacts/baseline-tree` 已 `git worktree remove`，目录不存在。
- `e2e/creds.json`、harness 状态及额外的 `e2e/final/restricted-creds.json` 已删除，自造账号随各自随机库一起删除；截图、报告、日志和探针源码保留。
- 专用库 `w1_crm_wave_test` 与容器 `w1-crm-wave-pg` 保留，工作树与分支保留。没有使用 `git stash`、push、合并或改写 main；没有改 `.github/workflows/` 与任务书列明的受保护文件，也没有操作其它会话的目录、容器。
