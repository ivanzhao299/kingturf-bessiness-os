# WF-A 服务端写路径修复证据（TD-WF-003 / 013 / 011；2026-11-24）

> 授权链：项目所有者全权授予主协调 + WF-A 任务书（服务端写路径修复）。隔离工作协议：独立
> worktree `/tmp/wfa-wt`、分支 `fix/wf-a-server-write-paths`；一次性 PostgreSQL 17.7
> （`postgres:17.7-alpine3.23`，发布在 `127.0.0.1:5444`，库名 `kingturf_test_wfa`，
> `NODE_ENV=test`）。**未连接共享开发库 5432**：真浏览器冒烟的管理连接串也指向这个一次性
> 实例（配方只取地址与凭据、自建自删随机专用库）。不 push、不触发 workflow、不改
> `.github/workflows/`、不直接改 `main`、不编辑 `tech-debt-tracker.md`。
>
> 任务书原列四项；其中 **TD-WF-001（报价行补 customerId）改由主协调实施**（main
> `551952a`），本批不含。主协调中途追加一项：TD-WF-013 的两个相邻情形一并映射（第四个提交）。

## 1. 结论

| 登记项                                  | 改前                                                   | 改后                                                                      | 提交      |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | --------- |
| TD-WF-003 询价「关闭询价」500           | 已签发询价单的 UPDATE 被迁移 0038 的守卫拒绝，接口 500 | 已签发询价单可关闭为 **CANCELLED**，接口 200；守卫拒绝映射 409 + 中文提示 | `891df58` |
| TD-WF-013 可纠正的输入错误返回 500      | 重复客户编号 500；评估人自批 500                       | 重复客户编号 → 409「客户编号已存在」；评估人自批 → 403 + 中文说明         | `b16784c` |
| TD-WF-011 草稿 BOM 详情「组件层级」为空 | 纯草稿 BOM 的 `tree` 恒为 `[]`                         | 没有任何已发布版本时以最新草稿版本为根出树                                | `4209326` |
| TD-WF-013 相邻情形（主协调裁定追加）    | 规范化名称重复 500；legacy 审批轨自批 500              | 名称重复 → 409「客户名称已存在」；legacy 轨自批 → 403（提示与桥轨一致）   | `77c7339` |

零新写语义；除迁移 0076 重定义的触发器函数外不改任何数据库对象（不加枚举值、不改表、
不动触发器本身与数据）。前端零改动。

## 2. 分支与提交

分支 `fix/wf-a-server-write-paths`，基线 `dcdb19b`，收尾 `git rebase main`（→ `5610673`）无冲突。
相对 main：24 个文件，+1603 / −55。

| #   | 提交      | 标题                                                                                                                  | 文件 | +/−        |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------- | ---- | ---------- |
| ①   | `891df58` | fix(procurement): let an issued RFQ be closed and map guard rejections to 409 (TD-WF-003) [已测试]                    | 14   | +601 / −20 |
| ②   | `b16784c` | fix(api): map duplicate customer numbers and credit self-approval to 4xx (TD-WF-013) [已测试]                         | 5    | +784 / −14 |
| ③   | `4209326` | fix(manufacturing): build the BOM component tree from the latest draft when nothing is published (TD-WF-011) [已测试] | 3    | +149 / −12 |
| ④   | `77c7339` | fix(api): map duplicate customer names and legacy-track credit self-approval to 4xx (TD-WF-013) [已测试]              | 7    | +125 / −65 |

提交号沿革（rebase 改写，内容不变）：首版 `1621651 / 25f27b8 / 0912c28 / ff9c1b2` → rebase
@`d8a3fd7` 后 `a8f0820 / 40f6561 / a85bb88 / ff9c1b2` → rebase @`5610673` 后为上表。

**未触碰**：`apps/web`、`packages/ui`、`commercial-repositories.ts`、`registry.ts`（认领清单
未动）、`production-*`（工单域）、`.github/workflows/`、`tech-debt-tracker.md`、共享库 5432。

## 3. 逐项说明

### 3.1 TD-WF-003 关闭询价

**根因**（真库复现）：`closeRfq` 对 DRAFT/ISSUED 执行 `UPDATE … SET status='CANCELLED'`；迁移
0038 的 `guard_rfq_update` 第一句是 `IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'issued RFQ is
immutable'`。这条写路径自 PROC-2 起没有任何真库测试。

**一处与任务书冲突的事实及裁定**：任务书原写「已签发 → CLOSED」。`procurement_document_status`
（迁移 0037）只有 `DRAFT / ISSUED / PARTIALLY_RECEIVED / RECEIVED / CANCELLED`，没有 `CLOSED`；
该枚举由采购单与询价单共用。我最初按任务书字面实现为追加枚举值并立即向主协调报告；
**主协调裁定走回退方案：不追加枚举值，已签发关闭后记为 CANCELLED**（关闭即终止这张询价，
系统已有「已取消」终态，筛选/徽章/接口都已支持）。因此 `closeRfq` 的语句与载荷不变。

**迁移** `packages/database/migrations/0076_rfq_close_transition.sql`：只有一条
`CREATE OR REPLACE FUNCTION guard_rfq_update()`。

| 前态      | 0038（改前）                                                                     | 0076（改后）                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT     | 只能 → ISSUED/CANCELLED；status、issued_at 之外不得变化；签发需 issued_at 与行项 | **逐条一致**（三项检查、顺序、消息与 0038 逐字相同）                                                                                               |
| ISSUED    | 一律拒绝                                                                         | 允许**仅状态** → CANCELLED：`(to_jsonb(NEW)-'status')` 必须等于 `(to_jsonb(OLD)-'status')`（issued_at **不**排除，必须保持原值）；其余目标状态拒绝 |
| CANCELLED | 一律拒绝                                                                         | 一律拒绝（消息 `cancelled RFQ is immutable`）                                                                                                      |

对主协调所问「issued_at」：新函数对「已签发 → 已取消」**不要求** issued_at 变化，恰恰相反，
它必须保持原值；`closeRfq` 只 SET status，所以能通过。行项冻结规则 `protect_issued_rfq_line`
未动。

**端点映射**（`routes/fastify/rfqs.ts`，只在这一个端点内）：守卫触发器拒绝（SQLSTATE P0001
且消息在白名单内）→ `DomainError('conflict', 中文提示)` → 409。白名单八条 = 0038 旧守卫的
一条（迁移 0076 尚未执行时才会出现）+ 0076 的七条。其它异常照旧 500，响应不回显数据库原始
消息。识别工具 `apps/api/src/pg-rejections.ts`（只做识别）。

**验证**

- 契约（`test/fastify/rfqs.test.ts`，13 例）：草稿/已签发两种前态关闭 → 200 + CANCELLED；
  八条已知消息 × issue/close 逐条 → 409 + 对应中文提示；未登记的 P0001 / 23505 / 23502 → 仍
  500 且信封为固定 `Internal server error`；同一消息出现在 GET 列表 → 仍 500（不做全局映射）。
- 真库（新文件 `test/rfq-close-postgres.integration.test.ts`，8 例）：
  已签发 → CANCELLED 且 issued_at、response_due_at 逐值不变，`rfq.closed` 证据的 metadata 与
  payload 均为 `{id, status:'CANCELLED'}`；草稿 → CANCELLED；已签发内容不可变（改截止日 /
  改 issued_at / 改编号 / 改币种 / 改回 DRAFT / 空更新，逐条拒绝且状态不变）；已取消不可变，
  再关闭/再签发 → not_found 且无证据；行项冻结规则不变（已签发、已取消的行项不可改不可删，
  草稿行项可改）；草稿规则与 0038 一致且签发照常；**整文件在同一个事务里原样执行两遍是
  no-op**，枚举仍是五个值、表上仍只有那一个触发器；跨租户不可关闭。
- **旧守卫真红还原**：同一用例里把 0038 的旧函数装回去 → 关闭被拒（`issued RFQ is immutable`）
  → 重新应用 0076 → 通过。

### 3.2 TD-WF-013 可纠正的输入错误

映射规则收在 `apps/api/src/write-rejection-mapping.ts`（哪个约束 / 哪条守卫 → 哪句提示、
哪个状态码），各端点在自己的调用点引用；不进任何全局错误处理器。

| 端点                                                     | 触发它的数据库拒绝                                                                                      | 结果                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `POST /api/v1/customers`（桥轨）                         | 唯一约束 `customers_tenant_id_customer_number_key`（迁移 0017）                                         | 409「客户编号已存在」           |
| 同上                                                     | 部分唯一索引 `customers_identity_active_unique`（tenant_id + normalized_name WHERE deleted_at IS NULL） | 409「客户名称已存在」（提交 ④） |
| `PUT /api/v1/credit-decisions/:id/state`（桥轨）         | 触发器 `enforce_credit_approval_separation`（迁移 0026）                                                | 403 + 中文说明                  |
| `POST /api/v1/credit-decisions/:id/approve`（legacy 轨） | 同上                                                                                                    | 403 + 同一说明（提交 ④）        |

**legacy 轨的结构判断**（主协调要求先判断再动手）：映射落在
`routes/qtc-credit-approval.ts` 自己的 `handler` 里，只包住那一次 `approveCredit` 调用。
仓储方法 `approveCredit` 是两条轨共用的，**没有动**；`registry.ts` 的认领清单**没有动**。
因为不新增对依赖 / 授权 / 仓储的任何访问，**f3 守恒 311 个场景的 trace 与响应逐字段不变，
无需 re-pin**（实测 `app-batch4-preservation.test.ts` 311/311）。

**验证**：契约 `test/fastify/customers.test.ts`（6）+ `test/fastify/credit-review.test.ts`
（7）——这两个桥轨端点组此前没有专门的契约文件；真库
`test/correctable-errors-postgres.integration.test.ts`（4），走完整应用分发（`buildApp` + 真实
仓储 + 真实会话），数据库真的拒绝一次，并钉住：响应信封恰为 code / message / correlationId
三键、不含原始消息、客户数与审批行数不变、被拒后决定仍 `PENDING_APPROVAL` 且无
`credit.decided` 证据、**换另一位审批人照常 200**。

### 3.3 TD-WF-011 草稿 BOM 组件层级

**根因**：`findBom` 只取「最新已发布版本」做树根，纯草稿 BOM 的 `tree` 恒为 `[]`。

**改法**（`manufacturing-read-repositories.ts`）：树根选择抽成 `treeRootVersion`——有已发布
版本时取其中最新的一个（**与改前是同一个表达式**）；没有任何已发布版本时取最新草稿。节点
组装、深度上限、环守卫、「下层只展开已发布子 BOM」的规则都没动。前端抽屉只读顶层 `tree`，
节点形状与已发布树相同，**前端零改动**。

**口径与边界（主协调裁定维持最小口径）**：

- 仅当 BOM **没有任何**已发布版本时才用草稿做树根。一个 BOM 同时有已发布版本与更新草稿时，
  树仍以已发布版本为根（与改前一致）。
- **这条路径在真库上未验证**：同码第二版无法经 `createBom` 建立（`createItem` 恒建 v1，
  TD-MFG-001），夹具注释有该域级证明。选择逻辑与改前是同一个 `find` 表达式，改前既有三个
  `findBom` 真库用例（已发布树、子 BOM 展开、环守卫）原样通过、未改任何断言。主协调将把
  这一点作为 TD-MFG-001 的关联说明登记。
- 下层只展开**已发布**的子 BOM：草稿行引用的组件必须是已发布版本，未发布的下层结构不是
  已确认的工艺，不在草稿树里冒充层级。

**验证**：`manufacturing-postgres.integration.test.ts` +2（纯草稿两行带替代料出树，树根与
行项状态 DRAFT，树行与 `versions[0].lines` 同源、只多一个 `bom` 键；草稿发布前后除 `status`
外逐字节一致）；`fastify/manufacturing-boms.test.ts` +1（纯草稿详情的 HTTP 形状与字段裁剪
规则）。写用例时核实过一处易错点：`repository.publish('bom', id, …)` 的第二个参数是 **BOM
版本行**的 id（`UPDATE manufacturing_bom_versions`），不是 `findBom` 顶层的 BOM 根 id。

## 4. 被修改的断言（改前 → 改后）

原则：没有删除或弱化任何断言；没有 `.skip` / `.only`。两类改动——(a) 迁移数量钉定按 0075
先例（`db1e774` + `7ec11c9`）re-pin；(b) 我自己在提交 ② 里钉住「相邻情形仍是 500」的断言，
按主协调裁定改为正确行为。

### 4.1 迁移钉定 re-pin（提交 ①，8 处，75 → 76）

| #   | 文件                                                          | 改前                                                                                                | 改后                                                                     |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `packages/database/test/migrations.test.ts`                   | `expect(ordered.at(-1)).toBe('0075_login_lockout.sql')`                                             | `.toBe('0076_rfq_close_transition.sql')`，并新增一条 0076 的静态形状用例 |
| 2   | `packages/database/test/read-only-status.integration.test.ts` | `expect(status).toHaveLength(75)`                                                                   | `toHaveLength(76)`                                                       |
| 3   | `packages/database/test/startup-gate.integration.test.ts`     | `if (files.length !== 75)` + `expected 75 candidate migrations`                                     | `76`；待应用清单追加 `'0076_rfq_close_transition.sql'`                   |
| 4   | `scripts/prepare_release_bundle.sh`                           | `assert len(manifest)==75,'… completed 75-migration manifest'`                                      | `==76` / `76-migration`                                                  |
| 5   | `scripts/application_release.py`                              | `… and len(expected) == 75, 'Candidate migration manifest binding invalid'`（注释 `bumped 74->75`） | `== 76`（注释 `bumped 75->76 with 0076_rfq_close_transition`）           |
| 6   | `tests/operations/apply_migrations_rehearsal_test.py`         | `APPROVED` 三元组不含 0076；`'--expected-after', '75'`；`schema_migrations` 计数 `75`               | `APPROVED` 追加 `'0076_rfq_close_transition.sql'`；`'76'`；`76`          |
| 7   | `tests/operations/production_preflight_test.py`               | `assertEqual(len(manifest), 75)`；`sorted(manifest)[-1] == '0075_login_lockout.sql'`                | `76`；`'0076_rfq_close_transition.sql'`                                  |
| 8   | `tests/operations/release_migration_drill_test.py`            | `assert len(REAL_FILES) == 75`；`registry_names` 计数 `75`                                          | `76`；`76`                                                               |

第 4、5 处是发布脚本而非工作流文件（主协调确认可改）。发布事故终录
（`release-incident-2026-11-20.md`）的根因正是 `application_release.py` 漏改——本次 8 处同步，
演练测试断言 `len == 76`。**发布时 `apply-migrations` 的 `approved_suffixes` 需带上
`0076_rfq_close_transition.sql`。**

冻结场景：**f3 守恒 311/311 无需 re-pin**（本批没有改动任何被冻结场景走到的响应或 trace）。
`QUOTES_VIEW_SELECT` 的 SQL 指纹不涉及（TD-WF-001 不在本批）。

### 4.2 「仍是 500」改为正确行为（提交 ④）

| #   | 文件 / 用例                                                   | 改前                                                                    | 改后                                                                                                 |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `fastify/customers.test.ts`「其它数据库错误保持 500」         | 循环列表含 `customers_identity_active_unique`                           | 从该列表移出（改判 409，见 #2）；补入 `customers_id_tenant_id_key`，保持「别的唯一约束仍 500」的覆盖 |
| 2   | `fastify/customers.test.ts` 新增用例                          | —                                                                       | 重复客户名称 → 409「客户名称已存在」，不回显原始消息                                                 |
| 3   | `fastify/credit-review.test.ts`                               | 用例标题「映射只做在 PUT state：POST 评估遇到同一条触发器消息仍是 500」 | 仅更正标题与注释（映射范围现为两个审批端点）；**断言原样保留**（POST 评估端点仍 500）                |
| 4   | `correctable-errors-postgres.integration.test.ts` legacy 自批 | 500 `internal_error`                                                    | 403 `forbidden` + 中文说明；保留「无审批行写入」                                                     |
| 5   | `correctable-errors-postgres.integration.test.ts` 名称重复    | 500 `internal_error`                                                    | 409 `conflict`「客户名称已存在」；保留「未写入」，加客户数不变                                       |

### 4.3 旧状态真红还原（每项都做过）

做法：把源文件临时还原到上一提交（或移走迁移文件）→ 跑新断言 → 恢复 → 重跑。

| 项  | 还原了什么                                           | 旧代码下                                                                                       | 恢复后  |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| ①   | 移走迁移 0076                                        | 真库 6 失败 / 2 通过，关键失败为 `issued RFQ is immutable`（`procurement-repositories.ts:60`） | 8/8     |
| ①   | `rfqs.ts` 还原                                       | 契约 1 失败（`expected 500 to be 409`）                                                        | 13/13   |
| ②   | `customers.ts` + `credit-review.ts` 还原             | 5 个目标断言失败（`expected 500 to be 409` / `to be 403`）                                     | 16/16   |
| ③   | `manufacturing-read-repositories.ts` 还原            | 2 个新用例失败（`expected [] to have a length of 1`），既有 3 个保持通过                       | 23/23   |
| ④   | 三个路由文件还原 + 移走 `write-rejection-mapping.ts` | 3 个目标断言失败，提交 ② 已覆盖的两条保持通过                                                  | 588/588 |

## 5. 验证回执

### 5.1 `pnpm ci:local`

| 被测快照                                     | EXIT  | 耗时  | 说明                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ff9c1b2`（四个代码提交，rebase @`d8a3fd7`） | **0** | 747 s | 干净已提交快照，跑前跑后工作区均干净。该快照的代码内容与分支最终四个提交一致（后续 rebase @`5610673` 仅改写提交号）；文档提交后的最终 HEAD 复跑回执见 §5.4                                                                                                                         |
| `a85bb88`（前三个提交）                      | 1     | 194 s | **无效回执，操作失误**：我在它后台运行期间开始写提交 ④，覆盖率步骤的「必须从已提交的干净快照开始采集」守卫按设计拒绝（工作区出现未跟踪文件）。守卫之前的步骤（格式、文档、结构、服务边界、迁移 76 条 + 状态、lint、typecheck、发布护栏含 Python 145 例）实测通过，但测试主体未跑完 |

`ff9c1b2` 的实测数字：API 185 文件 / **18034** 例；Web 50 / 761；database 4 / 76；config 71；
domain 20；types 5；ui 53。发布护栏：Python 145 例 OK；演练输出 `"migrations": 76`、待应用
清单含 `0076_rfq_close_transition.sql`、`"final_count": 76`、`"classification":
"FULLY_MATCHED"`。覆盖率：整体 58124 / 70901，domain 630 / 672，仓储 11080 / 12987，
`deficits: []`。structure 强制违规 0；service-boundary 222 文件 0 违规；`No known
vulnerabilities found`。未出现 `inventory-migration-postgres.integration.test.ts` 的超时假失败。

### 5.2 e2e P1

入库配方 `node scripts/e2e-local/e2e-local.mjs run`（仓库原配置）：
**11 passed (38.7s)**，EXIT=0，整轮 58 s。栈自清后无残留容器、专用库、`creds.json`、`trace.zip`。

### 5.3 写流程冒烟（同一环境下的前后对照）

配方 `up → write-smoke → down`，产物目录 `/tmp/wfa/e2e`（非缺省目录），容器名
`e2e-harness-wfa-<随机>`。为让差异完全归因于本批，先在 **main `5610673`**（临时 detached
工作树，跑完即删）上跑一遍基线，再跑本分支 `ff9c1b2`。

两轮都是：流程 6 / 6 通过，必须步骤 32 / 32。

| 检查项                     | main `5610673`                                          | 本分支 `ff9c1b2`                                                       |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| WS-P1-03 关闭询价          | 已复现：`PUT …/state` **500** `Internal server error`   | **未复现**：**200**；列表行「已取消」；接口佐证 `rfqStatus: CANCELLED` |
| WS-P2-11 评估人自批        | 已复现：`PUT …/state` **500**                           | **未复现**：**403** + 中文说明，界面显示同一句                         |
| WS-P2-09 草稿 BOM 组件层级 | 已复现：`treeLines: 0`（接口 `versions[0].lines` 2 行） | **未复现**：`treeLines: 2`                                             |

24 个检查项里**恰好这 3 项**由「已复现」变「未复现」，其余 21 项两轮状态相同（没有引入新的
复现）。退出码两轮都是 1，来自表单基座范围内尚未修复的 P2 / P3（TD-WF-005 / 006 / 007 /
008 / 009 / 012 / 014 等），与本批无关。

**需要单独说明的一处**：WS-P2-11 的「重复客户编号」子情形，服务端已由 500 变为 **409
「客户编号已存在」**，但该检查项仍记「已复现」——它断言的是「界面给出可读的失败原因」，
而新建抽屉不渲染错误（`visibleError: ""`，TD-WF-005 / 006，表单基座范围）。目录汇总里
WS-P2-11 显示「未复现」是两个子情形的合并结果。这一子情形要等表单基座修复落地才会真正转绿。

任务书列的四项冒烟期望：供应链「关闭询价」成功 ✓；制造流程草稿 BOM 组件层级有行 ✓；
客户流程重复客户编号得到带中文提示的 409 ✓（服务端）；信用流程「执行信用评估」请求发出并
被服务端接受 ✓（主协调的 `551952a`；信用流程 4 / 4，审批一步也已通过）。

## 6. 待登记问题（编号 WFA-n，由主协调在合并时登记台账）

| 编号  | 问题                                                                                                                                                | 说明与建议                                                                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WFA-1 | 冒烟检查项「客户编号重复时，界面应给出可读的失败原因」在服务端已正确（409 + 中文提示）后仍会显示「已复现」，直到新建抽屉渲染错误（TD-WF-005 / 006） | 不是缺陷，是对账提示：表单基座修复合并后该项自动转绿，无需改冒烟脚本                                                                                                                                                                                                                       |
| WFA-2 | `scripts/e2e-local/write-smoke-catalog.mjs` 的 `rfqCloseServerError` 条目 `cause` 文本仍写着「迁移 0038 的触发器…必然失败」                         | 本批落地后该条目保留作回归检查（配方文档 4.5 节的既定做法），`cause` 是历史描述；是否在条目上标注修复提交由主协调定                                                                                                                                                                        |
| WFA-3 | 「已发布 + 更新草稿并存」的 BOM，详情树仍以已发布版本为根                                                                                           | 主协调已裁定维持；真库上无法构造该数据（TD-MFG-001），建议作为其关联说明登记                                                                                                                                                                                                               |
| WFA-4 | 询价关闭后结果状态是 CANCELLED，「关闭」与「取消」在数据上不可区分                                                                                  | 裁定的直接结果。若日后需要区分「到期关闭」与「人工取消」，需新增枚举值（不可逆）另批                                                                                                                                                                                                       |
| WFA-5 | 客户创建 legacy 轨（`routes/customer-base.ts`，经 `routes/dispatch/crm.ts` 装配）未做映射                                                           | 该路径在生产不可达：`POST /api/v1/customers` 由桥认领（`registry.ts` 认领清单第 85 行），桥先于 legacy 组处理；legacy 处理函数只被单测经 legacy dispatch 覆盖。未改，保持 f3 不变。与信用审批不同——那条 legacy 路径 `POST …/approve` **不在**认领清单里，生产可达，所以提交 ④ 给它做了映射 |
| WFA-6 | 本批之前 `closeRfq` 没有任何真库测试（PROC-2 新增的写路径）                                                                                         | 已随提交 ① 补上（`rfq-close-postgres.integration.test.ts`）。登记备查：TD-TEST-022 类缺口在写路径上的一个实例                                                                                                                                                                              |

没有发现需要立即修复的新缺陷。

## 7. 偏离任务书之处

1. **TD-WF-003 的结果状态**：任务书原写「已签发 → CLOSED」。因枚举无 `CLOSED`，经主协调
   裁定改为 CANCELLED，不加枚举值（§3.1）。我最初的默认方案（追加枚举值）在落地前被否决，
   未进入任何提交。
2. **TD-WF-001 未做**：主协调改派给自己（main `551952a`）。因此任务书 §4.1 里「报价列表带
   customerId」的契约测试、§4.2 的对应真库断言不在本批。
3. **追加了第四个提交**（TD-WF-013 的两个相邻情形），主协调裁定。
4. **真浏览器冒烟的数据库**：任务书允许配方经共享 5432 的受控机制使用；我改为指向自己的
   一次性实例（更保守，实测容器经 `host.docker.internal` 可达）。**未从 `.env` 读取任何
   值**，未连接 5432。
5. **为冒烟基线临时建过一个 detached 工作树** `/tmp/wfa-baseline-wt`（main `5610673`），
   跑完即 `git worktree remove`；在共享 `.git` 里短暂存在过。未动主检出目录。
6. **一次无效的 ci:local**（§5.1 第二行）：我在后台门禁运行期间改了工作树，被守卫拒绝。
   属操作失误，已如实记录，不计入回执。
7. **文档侧没有可同步的迁移计数**：`docs/` 里搜不到「N 迁移」式的当前计数陈述；
   `docs/adr/0015` 的「74 迁移链健康」是 ADR 当时的时点陈述，按 R5 不改。计数钉定全部在
   §4.1 的 8 处代码 / 脚本里。

## 8. 临时资产

| 资产                                                                                        | 处置                              |
| ------------------------------------------------------------------------------------------- | --------------------------------- |
| 工作树 `/tmp/wfa-wt`（分支 `fix/wf-a-server-write-paths`）                                  | 保留，待主协调合并后删除          |
| 容器 `wfa-pg`（`127.0.0.1:5444`）、库 `kingturf_test_wfa` 与草稿库 `wfa_scratch_test`       | 收尾时删除                        |
| `/tmp/wfa/env`（一次性实例的连接串，0600）                                                  | 收尾时删除；从未打印、未写入仓库  |
| `/tmp/wfa/*.log`、`/tmp/wfa/ci-local-*.summary`、`/tmp/wfa/smoke-reports/`、`/tmp/wfa/e2e*` | 收尾时删除；已确认不含口令 / 令牌 |
| `/tmp/wfa-wt/coverage/`（`ci:local` 产物，git 忽略）                                        | 随工作树删除                      |
| 冒烟容器 `e2e-harness-wfa-*`、专用库 `kingturf_test_e2e_*`、`creds.json`、`trace.zip`       | 每次用完 `down`，已核对无残留     |
