# PG2 采购写路径裁定落地与验证（2026-11-26）

## 1. 范围、工作树与交付边界

- 实施树：`/home/jinhuit/Kingturf/kingturf-coord/wave2/proc-db`，分支 `fix/w2-proc-guards`，基线 `main@4a93003`。
- 源码最终提交：`0525fbf00e6b0cea8e9e591c877f0cf268be01fa`。真实祖先顺序为 `56421d1 → cbfded7 → f6701cf → 0525fbf`，最后一笔包含下文三个补强，`f6701cf` 尚不包含锁粒度修复。
- 实施顺序依裁定为 TD-PROC-021 → TD-PROC-016 → TD-PROC-015 → TD-MFG-013 → TD-PROC-022；逐项提交，随后分别提交复核发现的局部补强。
- 仅新增迁移 0080、0081；本分支迁移文件实际数量 79。0078、0079 属并行制造批，本树留空是预期；集成后的 81 条清单由主协调统一钉定。
- 未修改主检出、AGENTS.md、发布记录、活动执行计划、发布工作流或 packages/ui 公共行为；未 push、合并 main、部署、触发发布或使用 stash。连接串仅经环境传入。
- 依直接指令，本批没有运行完整 `pnpm ci:local`。代码提交主题的 `[未测试]` 专指未跑该整条命令，不表示下列定向/分包检查未执行；最终集成 CI 与发布由主协调完成。

## 2. 提交与文件职责

| 提交      | 主题摘要                                                                                                 | 职责                                                               |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `e4a7823` | feat(procurement): mark suspended suppliers in quote candidates and block their submission (TD-PROC-021) | 前端三态候选及提交拦截                                             |
| `b204ece` | refactor(procurement): extract purchase order cancellation before guard changes                          | 机械迁移取消事务，给接近 800 行的仓储腾出空间；SQL、载荷、证据不变 |
| `4e932c9` | fix(procurement): lock and check supplier status before issuance (TD-PROC-016)                           | 同事务签发前状态检查、表单内错误                                   |
| `090cbff` | fix(procurement): allow never-issued draft order cancellation (TD-PROC-015)                              | 0080、状态端点已知拒绝映射、当时钉定 78                            |
| `3a21c8c` | feat(procurement): link purchase orders to tenant purchase proposals (TD-MFG-013)                        | 0081、双轨创建引用、授权读聚合、共用建单表单与入口、钉定 79        |
| `56421d1` | feat(inventory): expose scoped movement source choices (TD-PROC-022)                                     | 库存来源候选只读端点、registry 认领及选择器接线                    |
| `cbfded7` | fix(mrp): recognize proposal deep links in navigation (TD-MFG-013)                                       | 精确放行 `material-planning?`，不扩其他查询路由                    |
| `f6701cf` | fix(inventory): ignore stale movement source failures (TD-PROC-022)                                      | 当前余额、宿主存续、请求序号三重迟到隔离                           |
| `0525fbf` | fix(procurement): avoid supplier FK lock upgrades on issuance (TD-PROC-016)                              | 消除并发创建签发的 FK 锁升级死锁，补真实 HTTP 双事务回归           |

核心文件按用途分组：

- `apps/api/src/purchase-order-write-repository.ts` 收纳取消、签发和建议校验；`procurement-repositories.ts` 保留既有事务与证据链，未超过 800 行。
- `procurement-read-repositories.ts` 承载采购来源元数据及库存候选查询，`mrp-read-repositories.ts` 承载 MRP 详情关联采购单；路由不跨仓储编排。
- `routes/fastify/{purchase-orders,mrp,inventory-ledger,registry}.ts` 负责边界解析、读权限/字段/范围门控与加性端点；`routes/procurement-purchase-order-create.ts` 同步 legacy 可选引用字段。
- 前端 `sq-{data,console,host,supplier-picker}` 与共享本域 `supplier-status.ts` 实现报价三态；`po-create.tsx` 是两种建单入口共用表单，`po-issue-form.tsx` 保持签发拒绝在表单内。
- `mrp-{detail,purchase-order,proposal-link,host,console}`、`po-proposal-link.tsx` 和 `shared/navigation.ts` 完成建议入口、只读固定来源、授权深链与关联展示。
- `inv-{data,host,state,detail,console}` 按需读最小来源集合，保留 `movementPayload` 的八个旧键；迟到成功、失败和 finally 均不覆盖新选择。
- 新增真实 PG 用例分别覆盖草稿取消、采购 MRP 引用、库存来源；供应商既有真库文件增加三态签发和可控并发。冻结测试源码与 f3 pin 均未修改。

## 3. 五项实现及真实前后证据

### 3.1 TD-PROC-021：报价供应商候选

全部可读供应商继续列出，逐家显示「已启用 / 暂停 / 已停用」。本域原生单选组显示徽章，非 ACTIVE 禁选。提交时再读取当前候选状态：先前选中的供应商若已暂停或停用，中文原因留在报价表单内，不发写请求。未修改 API 资格规则或公共 UI 组件。

报价组件 6 例与供应商组件原 19 例通过。精确旧载荷断言保留，覆盖候选全部列出、两种禁选、旧选中值改变状态后的拦截、未选择和服务端错误。基线探针确认旧 select 仍把非启用供应商作为可选项；修复树已改用带徽章单选组。双视口真实 Chromium 检查三态文字与 disabled，截图见 §6。

### 3.2 TD-PROC-016：签发与供应商状态原子检查

已有草稿签发和创建时 `issue:true` 都在原事务内检查供应商当前状态。非启用返回包含「暂停 / 已停用」的中文 409，采购单保持 DRAFT、`ordered_at=null`，无签发审计/事件；恢复 ACTIVE 后可签发。界面错误处于签发表单自己的 `role=alert`。

基线相同三态断言期望 409，实际为 200。初次修复 8 项真库通过，保留两条方向明确的竞争：签发持锁时状态变更等待；状态变更先持锁时，后来的签发等待并按提交后的停用状态拒绝。

复核另发现原 `FOR UPDATE OF s,p` 与新建采购单外键已持有的供应商 KEY SHARE 形成锁升级窗口。新增测试经完整 app dispatch 发两笔不同编号、同供应商、`issue:true` 的请求，代理只控制真实 SQL 的时序：两边都完成 PO INSERT、持有 FK 锁后统一放行。旧锁法实测 HTTP `[500,201]` 且捕获 `40P01`；改为 `FOR NO KEY UPDATE OF s FOR UPDATE OF p` 后两笔均 201、零 SQL 错误。供应商 status 更新仍与本锁互斥，FK KEY SHARE 可并存，PO 仍排他；未改变查询或写入顺序、载荷、权限、作用域和证据。

双建单用例同时核对两行 ISSUED/非空签发时间、两份数量/单价、每单恰一条 `purchase-order.created` 审计与 outbox；原两方向状态竞争未删改。锁修复后的采购定向为 8 文件 401/401，包含三项本批真库、原采购/供应商状态、桥轨和 311/28。

### 3.3 TD-PROC-015：从未签发的草稿取消

0080 仅替换 `purchase_orders_check`，保留旧表达式并追加 `OR (status='CANCELLED' AND ordered_at IS NULL)`。不伪造签发时间，不改触发器或枚举。

基线真库记录：HTTP 500、`internal_error`、状态 DRAFT、`ordered_at=null`、取消 audit/outbox 各 0；修复后 HTTP 200、CANCELLED、时间仍 null，取消 audit/outbox 各 1。已签发取消保持原时间。另覆盖部分收货/已收货/不存在/外租户旧行为、十种状态/时间真值表、同事务重复应用 DDL 和原更新守卫。

状态端点只映射已知 P0001 文案及精确名 `purchase_orders_check` 的 23514 为中文 409；未知触发器、其他约束和读取错误仍保持原处理。真实恢复旧检查时 409 且零写，执行 0080 后同请求成功。真库 7/7、桥轨 11/11；同类约束盘点只列 §8，没有扩范围修改。

### 3.4 TD-MFG-013：建单时记录采购建议引用

裁定采用与工单相同的「创建时传建议 UUID」机制；MRP 下达仍只写事件，不自动建单。

- 0081 增加可空 `purchase_orders.mrp_proposal_id`、复合租户外键、非唯一 `(tenant_id,mrp_proposal_id)` 索引，历史行不回填。
- legacy 与 Fastify 创建都接受可选 `mrpProposalId`。同事务只接受本租户 PURCHASE 建议；生产类、缺失和外租户建议均 409、零采购单写入。只有 `procurement:manage` 的账号也能填合法引用，不额外要求 `mrp:read`。
- 采购单自己的引用按 `procurement:read` 字段裁剪。派生的 `mrp_run_id`、建议编号和可点击深链仅在 `mrp:read` 未裁字段且 COMPANY/GROUP 时查询/暴露；建议编号沿原工单口径为 UUID。
- MRP 详情的 `purchaseOrders` 仅在 `procurement:read` 未裁字段且 COMPANY/GROUP 时聚合，不授权则不查询、不带该键。按当前建议精确过滤关联单。
- 采购建议详情有「建立采购订单」，使用普通采购页的同一表单，预填物料、数量和到货日。来源只读，提交闭包再次覆盖为原建议 ID；普通创建保留可选 UUID 手填兜底。
- 采购单列表/详情显示来源；具备 MRP 授权时可跳回对应批次建议。浏览器发现共享导航未承认新查询路由，补精确白名单与保留其他族拒绝的回归，不放宽任意 query。

基线同一新增引用请求为 400，修复后 201。新增引用真库 6/6，既有 MRP 真库 10/10、桥轨 23/23及 311/28，共 378/378；PO/MRP 组件最初 36/36，后续包含导航和库存补强的 Web 全量 1,036/1,036。

双视口从建议真实建单各 201，MRP 建议详情自动显示新采购单。切回已挂载采购页时，显式点击该页原有「刷新」，再在列表/详情读取引用、点深链回建议；这个手动步骤没有被探针隐藏，见 PG2-N5。

历史恢复调查仅为本地结构和代码检查：旧采购单没有建议结构化引用，`supplier_quote_id` 与 `canonical_hash` 不能证明唯一对应某条建议，不能据此自动回填。项目所有者说明开发阶段生产无实际业务单据；本批未访问生产核数，也没有宣称已恢复生产历史对应关系。

### 3.5 TD-PROC-022：库存移动来源候选

新增、认领 `GET /api/v1/inventory-movement-sources`，只读仓储查询仅返回 `{ items: [{ value, label }] }`，不返回工序、物料、报工、成品卷或事件聚合。写端点及载荷不变。

权限和候选判据：

| 情形                 | 判据及结果                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| 没有 production:read | 可用库存权限取得最小来源；完整工单读取仍为 403，浏览器不请求完整工单端点                                     |
| 库存权限选择         | 优先 `inventory:read`，没有时使用 `inventory:move`；两者都无则 403；不新增权限                               |
| 字段裁剪             | 按所选库存授权要求 `value`、`label`；只有其中一个字段时 403，两字段可读则返回两键                            |
| 范围                 | 复用库存已有 `company(context)`：COMPANY/GROUP 且固定当前 company；TEAM 等窄范围 403，不另造跨域谓词         |
| 外租户或空候选       | 200、`items=[]`；不拼入外公司行；表单显示「暂无可选业务来源」                                                |
| 六种工单状态         | 只取 DRAFT、RELEASED、IN_PROGRESS；排除 COMPLETED、CLOSED、CANCELLED                                         |
| 顺序与形状           | 保留旧列表 `created_at DESC`，`value=id`、`label=order_number`；与真实 legacy 列表经原选择器口径派生逐键相等 |
| 前端已有完整候选清单 | 保留旧 `workOrderChoices`；无生产读权限、清单未到或缺 id/order_number/state 时才按需读取新端点               |

真库种子通过原创建、报工、入卷、异人成本批准和关单写链形成六态，没有禁触发器制造终态。基线同一断言得到 404，修复后 200。新真库 4 例覆盖逐键/顺序、仅库存读、仅移动、无权限、外租户空集合、字段和范围，以及实际移动提交；与原库存 4 例和 311/28 合计 347/347。最小投影强化类型后新 4+311/28 为 343/343。

来源读取成功、失败、finally 均检查当前余额 key、宿主 attached 和请求序号。切换条目释放旧加载状态；受控拒绝用例先让新条目来源就绪，再拒绝旧 Promise，旧实现把新来源清空为「暂无可选业务来源」，修复后新来源和错误隔离保持，零写请求。

双视口合成账号仅授 `inventory:read`、`inventory:move`，从来源候选选择新草稿工单，经原确认框提交盘亏 0.5 各得到 201；断言八键载荷、sourceId、写后流水和成功提示，记录没有发出完整工单 GET。

## 4. 迁移、数量钉定与回退

| 文件                                 | SHA256                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| `0080_po_draft_cancel.sql`           | `88c630410cab014d8b601c9eb67cf3e476e92b120940b7f7e8dd2796316b7fc9` |
| `0081_po_mrp_proposal_reference.sql` | `7ead061c89189dbeb26a58bdda61c1e57060de80fc785cce4c9932429f634f3f` |

`git diff 4a93003 -- packages/database/migrations` 仅有这两个新增文件。77 条起点及新空库各迁移至 79 条，db:status 全部 `applied`、所有 storedChecksum 与 checksum 相等；无 drift。0080 独立提交时已验证 77→78、空库→78；0081 独立提交再按实际数量更新为 79。

最终 pin 位置（工作树相对路径，行号取源码最终提交）：

| 文件                                                          | 行号与内容                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/database/test/migrations.test.ts`                   | 128：最后文件 0081                                                         |
| `packages/database/test/read-only-status.integration.test.ts` | 62：79 条                                                                  |
| `packages/database/test/startup-gate.integration.test.ts`     | 37–38：79 条；68：pending 清单含 0081（67 含 0080）                        |
| `scripts/application_release.py`                              | 115：78→79 注释；116：manifest 79                                          |
| `scripts/prepare_release_bundle.sh`                           | 30：manifest 79                                                            |
| `tests/operations/apply_migrations_rehearsal_test.py`         | 31：approved suffixes 含 0080/0081；104：expected-after 79；156：注册表 79 |
| `tests/operations/release_migration_drill_test.py`            | 27：候选 79；183：注册表 79                                                |
| `tests/operations/production_preflight_test.py`               | 262：79；263：最后文件 0081                                                |

集成合入 0078/0079 后，主协调统一改为 81；本分支不借修改检查器放行空号。发布时 approved_suffixes 必须显式包含 0080、0081，实际发布由主协调执行。

回退使用代码回退及主协调准备的兼容恢复应用，不删除已应用迁移、不删已存建议引用；旧业务代码仍需与已迁移数据库兼容。恢复候选与本批代码的集成认证不由本会话冒签。

## 5. 验证回执与命令

全部日志根目录为 `/home/jinhuit/Kingturf/kingturf-coord/wave2/proc-db-artifacts/logs/`。重活均经 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy`；DATABASE_URL 预先从指定来源在环境中设置，不在文档落值。

| 检查                        | 命令要点                                                                                             | 退出码/实际数量                | 日志                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| API 全量                    | `heavy pnpm --filter @kingturf/api test`                                                             | 0，202 文件、18,300 例         | `batch-api-full.log`                                                                   |
| 最终锁修复后定向            | `heavy pnpm --filter @kingturf/api exec vitest run` 指定采购/供应商/本批 PG、桥轨、冻结八文件        | 0，401/401                     | `016-deadlock-green.log`                                                               |
| Web 最终全量                | `heavy pnpm --filter @kingturf/web exec vitest run --maxWorkers=4`                                   | 0，65 文件、1,036 例           | `batch-web-final.log`                                                                  |
| 数据库包                    | `heavy pnpm --filter @kingturf/database test`                                                        | 0，77/77                       | `batch-database-full.log`                                                              |
| 运维整轮                    | `heavy python3 -m unittest discover -s tests/operations -p '*_test.py'`，`PYTHONDONTWRITEBYTECODE=1` | 0，145/145                     | `batch-operations-full.log`                                                            |
| 根 lint/typecheck/build     | 分别 `heavy pnpm lint`、`heavy pnpm typecheck`、`heavy pnpm build`                                   | 各 0                           | `batch-lint.log`、`batch-tsc.log`、`batch-build.log`                                   |
| 三补强定向 lint/tsc         | API 与 Web 修改文件 eslint、对应包 tsc                                                               | 各 0                           | `016-deadlock-lint-final2.log`、`016-deadlock-tsc.log`、`web-followups-{lint,tsc}.log` |
| 最终格式/结构/分层/权限清单 | `pnpm format:check`、`structure:check`、`service:check`、`verify:frontend-capabilities`              | 各 0，零强制结构/分层违规      | `final-{format,structure,service,capabilities}.log`                                    |
| 静态审计                    | `pnpm audit:scan`                                                                                    | 0                              | `batch-audit-scan.log`                                                                 |
| 迁移两起点                  | `pnpm db:migrate`、`pnpm db:status`                                                                  | 各 0，79 applied、校验和全匹配 | `0081-{from77,empty}-{migrate,status}.log`                                             |

API 全量在 `56421d1` 候选启动，复核补强期间继续运行至结束，没有中止；不将它称为最终 `0525fbf` 干净快照的全量。补强后另跑上述 401 例及最终 Web 全量。最终代码包含的 311 冻结轨迹和 28 源码守恒断言均通过，无新 f3 re-pin。

最终浏览器重建开始时 HEAD 为 `f6701cf`，工作区已含后来提交为 `0525fbf` 的锁修复三文件，随后只提交、未再改变源码；与最终 `0525fbf` 源码树相同。最终 P1 为 11/11，四路由桌面/手机各 4/4，均零页面/控制台异常、零失败请求、零布局及抽屉问题；对应 `e2e-final-{up,p1}.log`、`walk-final-{desktop,mobile}.log`。最终构建预算器报告登录 JS gzip 11,752 B；其 CSS 0 B 是既有漏计口径，不声称真实 CSS 为 0，也不在本批调整 TD-GATE-005。

## 6. 双视口定向与逐张截图

使用项目 Docker Playwright 配方，自有容器 `e2e-harness-procdb`；两档实测 `1440×900`、`390×844`。P1 和只读走查先于写探针。

制品根目录 `/home/jinhuit/Kingturf/kingturf-coord/wave2/proc-db-artifacts/e2e/`：

- `pg2-browser-report.json`：最终每档六个步骤及实测尺寸、写响应、引用和截图路径。
- `probe/pg2-browser.mjs`：仓外探针。前置供应商/准入/草稿/合成库存身份通过明确的 API 或专用库种子建立；被验收的取消、签发、建议建单、库存移动均经真实界面触发。
- `walk/{desktop,mobile}/report.json` 与各 `shots/`：四页及四个详情，共 16 张，已逐张目检。
- `pg2-shots/`：下列 16 张最终功能截图逐张目检；截图等待抽屉动画结束，库存保存图等待写后流水出现。

每个前缀 `DESKTOP-`、`MOBILE-` 下均有：

| 文件后缀                       | 证明内容                                |
| ------------------------------ | --------------------------------------- |
| `draft-cancel.png`             | CANCELLED、无伪造签发时间、页面状态更新 |
| `supplier-ON_HOLD.png`         | 暂停中文 409 原因留在签发表单           |
| `supplier-INACTIVE.png`        | 已停用中文 409 原因留在签发表单         |
| `quote-supplier-states.png`    | 已启用/暂停/已停用徽章及禁用单选项      |
| `mrp-locked-source.png`        | 共用表单的只读来源和建议预填            |
| `po-proposal-link.png`         | 采购单列表/详情来源与回建议深链         |
| `inventory-source-choice.png`  | 仅库存权限的工单来源可选，八键旧载荷    |
| `inventory-movement-saved.png` | 201 后可见成功提示和新流水              |

采购列表在跨控制台建单后的手动刷新已明确记录，见 PG2-N5。表格的自身横向滚动沿既有响应式行为，未宣称手机所有列同时入屏。浏览器覆盖仅 Chromium 与这两档合成账号场景，未覆盖生产真实单据或其他浏览器。

## 7. 失败与修正保留（R7）

- 015 的 pg_get_constraintdef 预期最初写成 text cast、后又少一层括号；真实定义不变，改为精确枚举 cast 与括号后 7/7。初次 357 例组合是 356 过、1 字符串断言失败，未报成全绿。
- MFG013 加性 purchaseOrders 参数/响应使旧 MRP 三条桥轨参数断言和一条真库键集断言失败；只增加新键/参数预期，旧字段及精确键集断言保留，最终 378/378。
- 022 初始 schema 前缀含数字被夹具拒绝，之后 CLOSED 种子又缺实际成本批准；补齐真实 BOM、成本计算和异人批准后才取得端点 404→200 的有效红绿。异步组件最初没有等待候选读取，补等待后通过，不删旧载荷断言。
- 016 复核新增双建单用例真实暴露 40P01→500，不以原 8 例绿色掩盖；锁粒度修复独立提交。新真实 SQL 代理维持 SqlClient 泛型投影，局部 lint 注释与原 SqlClient 同义，无全局规则或门禁放宽。
- MFG 新深链真实页面回退总览，补精确导航；022 迟到拒绝清空新候选，受控 Promise 真红后补当前请求隔离；均独立提交。
- 浏览器前置种子曾因大写编号、必须字母开头及日历日期契约返回 400；这是探针输入错误，未改业务规则。另有截图处于抽屉进入动画中，重取清晰图片。历史 `pg2-browser*.log` 保留，最终以有效 report 和最终成功日志为准。
- 同类约束只读采集最初与 API 测试的临时 schema 删除并发，系统目录查询遇到已删除 relation OID；改在自有、无并发 DDL 的空库采集成功，未把它当业务数据库缺陷。
- 全量前曾有 lint/tsc、焦点时序和测试夹具类型错误，修正后相应绿色回执另存；没有声称每项重复跑过 API 全量，也没有声称完整 ci:local 通过。

## 8. PG2-N：只登记，不扩范围

| 编号   | 事实、复现方式与影响                                                                                                                                                                                                                       | 状态                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| PG2-N1 | 真库目录有本次 PO 以外 14 表、15 条状态/时间或哈希耦合检查，完整清单见下表。可用 pg_constraint + pg_get_constraintdef 只读复得。若新增取消/退役/撤回动作，需复核是否保留历史时间；本批没跑这些表的全部状态写链，不能当作 14 个已复现故障。 | 待核实，未改                                                                    |
| PG2-N2 | production_orders 没有以 mrp_proposal_id 为键的专用索引；与本批采购单新索引相比，按建议反查工单可能随数据增长增加扫描成本。只读 pg_indexes 查询已确认未找到该列索引；未做生产性能测量。                                                    | 未改工单索引                                                                    |
| PG2-N3 | 既有工单 create 仅用复合 FK 验证建议存在/租户，没有检查 PRODUCTION 类型；代码可传同租户其他类型建议。本批 PO 明确限制 PURCHASE。跨类型工单新建的真库复现未做。                                                                             | 待核实，未改工单写语义                                                          |
| PG2-N4 | 既有工单创建入口保留手填建议 UUID，没有从生产建议直接建立工单的同类入口；本批仅为 PURCHASE 建议加采购入口。                                                                                                                                | 已静态确认，未补入口                                                            |
| PG2-N5 | 真实浏览器：MRP 建单 201 后建议详情关联自动更新；此前已挂载的采购页自有 orders 状态仍为旧快照，切回后需点击其原有刷新才显示新单与来源链接。探针保留这个显式步骤。                                                                          | 主协调确认登记后续跨控制台失效通知项，本批不改通用宿主/状态；有刷新兜底，不阻断 |

PG2-N1 的其他表完整清单，来自 `logs/pg2-constraint-audit.json`（另含关联列与索引）：

| 检查形态                                    | 表                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUBLISHED ↔ published_at                    | business_object_versions、commission_policy_versions、manufacturing_bom_versions、manufacturing_item_versions、manufacturing_routing_versions、number_definition_versions、quality_inspection_plan_versions、risk_policy_versions、rule_definition_versions、workflow_definition_versions |
| DRAFT 与 submitted_at/snapshot_hash         | ctr_versions                                                                                                                                                                                                                                                                              |
| DRAFT ↔ computed_at，APPROVED ↔ approved_at | mrp_runs（两条）                                                                                                                                                                                                                                                                          |
| ISSUED ↔ issued_at                          | quote_revisions                                                                                                                                                                                                                                                                           |
| DELIVERED ↔ delivered_at                    | business_document_dispatches                                                                                                                                                                                                                                                              |

procurement_rfqs 没有 PO 同款状态/签发时间 CHECK，未误报为同一问题；触发器迁移 0076 的既有关闭逻辑本批未改。

## 9. 文档与集成事项

五个 TD 原先只出现在台账顶部叙述，主表没有独立行。本批按协调裁定仅在台账标题下增加新的日期小节，保持旧历史和主表不动；主协调集成时统一补行与最终迁移 81 pin。本证据由 docs/index.md 收录。

待主协调集成的五条主表行文本（严重度由主协调统一分级；这不是在本工作树追加主表）：

```text
| TD-PROC-015 | 草稿采购单取消命中状态/时间检查 | 待分级 | 采购 / 写路径 | 已裁行为变更：草稿可取消 | PG2 2026-11-26 | 已实现待集成：0080与精确409映射；真库7/7、双视口200且ordered_at=null，见proc-guards-2026-11-26.md |
| TD-PROC-016 | 非启用供应商的既有草稿仍可签发 | 待分级 | 采购 / 并发守卫 | 已裁行为变更：暂停/停用拒绝签发 | PG2 2026-11-26 | 已实现待集成：同事务供应商NO KEY UPDATE、PO排他；双建单40P01真红→双201、原双向竞争保留，最终401定向全绿 |
| TD-MFG-013 | 采购单缺少来源MRP建议结构化引用 | 待分级 | MRP / 采购关联 | 已裁行为变更：创建时可选本租户PURCHASE引用 | PG2 2026-11-26 | 已实现待集成：0081租户FK及非唯一索引、双轨可选引用、固定来源共用表单、权限门控读聚合和深链；不自动建单、不回填，PG2-N5保留 |
| TD-PROC-021 | 报价候选缺供应商状态和禁选说明 | 待分级 | 采购 / 前端交互 | 候选集合和API资格规则保持；前端禁用非启用项 | PG2 2026-11-26 | 已实现待集成：三态徽章、禁选及旧选中值提交拦截，组件及双视口通过 |
| TD-PROC-022 | 库存岗位选来源依赖完整工单读权限 | 待分级 | 库存 / 最小只读来源 | 已裁新增只读；移动写语义不变 | PG2 2026-11-26 | 已实现待集成：库存权限最小候选端点、范围/字段/六态/逐键真库，迟到失败隔离，仅库存账号双视口真实201 |
```

## 10. 清理回执

清理已完成，退出码 0（`logs/final-cleanup.log`）：`e2e-harness-procdb` 与配方专用库 `kingturf_test_e2e_270e959e` 已删除，creds.json/state.json 均不存在；日志、报告、截图和仓外探针保留。自建 baseline 工作树及 `w2_proc_db_baseline_test`、`w2_proc_db_empty_test`、`w2_proc_db_final_empty_test` 三个临时库已移除。独立确认 `w2-proc-db-pg` 仍 running，`w2_proc_db_test`、实施树及分支保留；未触碰其他会话容器或工作树。

最终功能探针日志为 `logs/pg2-browser-final4.log`，退出码 0、两档各 6/6；最终报告 `ok=true`、12 步全通过。源码最终三项补强按 `cbfded7 → f6701cf → 0525fbf` 的真实祖先关系全部包含在交付树。文档收尾检查 `doc:lint`、`format:check` 均退出 0。

## 11. 主协调集成复验（发布前检查点）

源码与三项审查补强已全部合入集成分支。主协调在干净快照 `c87fd6091645ce9c1c6d7a3476ef0388fe1ebef6` 的协调库实跑数据库目标守卫、迁移和状态检查、数据库全量、采购 API 定向、Web 全量与构建，全部退出 0。

- 最终清单为 **81 条 applied、0 pending、0 drifted**；0001–0077 与生产源码逐字节相同，81 项名称及 checksum 与兼容恢复候选 `ecb3ded` 全等。规范清单摘要为 `7fc59f4afbab4ac65e5240fc8ee14d5482f115710adc9880c441a1470ef57994`。八处计数、末位 0081 与批准后缀钉定均已统一，制造新增守卫断言保留。
- API 定向八文件 **399/399**，包含冻结轨迹 311、分派源码保真 28，以及采购新真库／桥轨；没有把分支 401 的不同命令组合冒称同一计数。数据库四文件 **79/79**（含制造两条新增机械守恒断言），合并 Web 67 文件 **1,064/1,064**。
- 当前登录关键路径实际 gzip 为 **JS 11,751 B、CSS 25,640 B**；静态 CSS 计量已修，满足 12,000／27,000 B。该构建含采购新增控件样式。

原始日志、源码 SHA、退出码、清单核对和资源集合保存在 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/proc-merged/`（`result.json`、`manifest-review.json`、`measurement.json` 及各步骤日志）。五项主表状态由主协调更新为已合入、待完整集成验收及发布；PG2-N1…5 分别登记 TD-DB-001、TD-MFG-024/025/026、TD-WEB-019。上述检查点未含后继恢复控制与传输接线，完整 `ci:local`、最终集成 P1 三轮与全站双视口及写冒烟仍待执行；TD-REL-011／012 未解除，不据此放行生产。
