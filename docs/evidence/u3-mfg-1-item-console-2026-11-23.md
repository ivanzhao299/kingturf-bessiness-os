# U3-MFG-1 物料管理控制台 + Fastify manufacturing-items 端点组证据（2026-11-23）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + U3-MFG 生产域启动指令（MFG-1 物料管理
> 子批）。旧 vanilla「物料与规格版本」卡片 + 「创建物料版本」表单退役沿用裁定 17 语义
> （引用清零即删）；f3 冻结场景按 A1-P3/A-F2a/U3-COM-7/U3-CRM-1/U3-PROC-1 已批 re-pin
> 先例适配。**执行会话披露（R7）**：本子批施工期间同一工作树存在主协调授权的并行会话
> （CRM/治理 UX 批），本批全程仅触碰 MFG-1 文件；共享文件（registry/structure-gate/
> 台账/索引/AGENTS）编辑前逐次核对无他人改动，提交采用路径限定。

## 1. Fastify manufacturing-items 端点组（registry 认领 +3，累计 60 路径/16 文件不含 registry）

| 端点                                | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/manufacturing-items     | 视图轨迁移：listItemPage（additive keyset，排序键 (sku,version DESC) 与 list('items') 一致）+ itemType/status/query 筛选（additive；query=sku/名称 strpos 字面子串、大小写不敏感、无通配符语义）；**limit 不设默认值——legacy 物料列表无 LIMIT，无查询参数时响应与 legacy 全量 `{items}` 逐字节一致（无 nextCursor 键）**；显式 limit（1..100）才附 nextCursor；looseObject 透传 + Date 归一化（COM/PROC 同款）                            |
| GET /api/v1/manufacturing-items/:id | additive 只读 findItem：物料根行 + 版本历史（list 同投影，version DESC）+ 关联聚合（以该物料为产品的 BOM 含各版本状态 / 被引用位置（主料 COMPONENT 行与替代料 SUBSTITUTE 行）/ 工艺路线 / 最近工单预览 5 行 created_at DESC）——**关联聚合按调用方读权限门控（bom:read/routing:read/production:read，能力缺在或 scopes 空均不查询）**，物料读权限不放宽其它域可见面；404 信封含 correlationId；非 uuid 参数 400（`itemId must be a UUID`） |
| POST /api/v1/manufacturing-items    | legacy manufacturingItemCreateRoutes 同解析链（objectBody→allow 七字段→authorizeQuery(Object.keys(body))→itemType→stableCode/jsonObject/timestamp→201 + mutationDto(manufacturing-item:read)）；负例消息逐字一致（Unsupported fields/`itemType is required`/`itemType is unsupported`/`sku is required`/`Code must be …`/`specification must be a JSON object`/`effectiveAt must be a valid timestamp`）                                  |

仓储（`manufacturing-repositories.ts` additive）：`listItemPage`（(sku,version) 复合键集
cursor=`<sku>.<version>`——(tenant_id,sku) 与 (tenant_id,item_id,version) 唯一约束保证不重
不漏；itemType/status/query/cursor/limit 全部 values.push 参数化 $N）/ `findItem`（根行 +
版本列表 + 四类关联聚合，parts 参数按权限门控，未授权聚合不发出查询）；行投影
`ITEM_VERSION_PROJECTION` 提取为模块常量供 list/listItemPage/findItem 三处复用（SQL 字节
与提取前逐字一致；structure-gate G3 白名单按 SUPPLIER_ITEM_PROJECTION 同先例登记）。
company 作用域门保持。legacy `list('items'|'boms'|'routings')`/`createItem` 等方法逐字不动。

## 2. 物料 Preact 控制台（治理模块同款交互范式）

- `item-console.tsx`（页面工厂+动作闭包，G5 拆分）+ `item-ports.ts`（端口层）+
  `item-state.ts`（共享展示契约）+ `item-detail.tsx`（详情抽屉）+ `item-create.tsx`
  （新建抽屉）+ `manufacturing-console.css`（kt tokens 取值）：
  - **主从布局**（console-split）：左侧分类树（全部/原材料/半成品/成品/包装物，计数按
    物料根去重——列表行为版本行）+ 版本状态筛选（ALL/DRAFT/PUBLISHED/RETIRED）；
    右侧 DataTable（物料编码+名称双行/类别/规格参数 chips/单位/版本状态徽章/生效日期/
    行级操作）。
  - **行级操作**：查看 → 详情抽屉；草稿版本 → 发布版本（legacy
    POST /manufacturing-item-versions/:id/publish 同链；列表与抽屉内双入口）。
  - **筛选/检索/分页一体化**：分类/状态任一生效 → 服务端分页（itemType/status/query +
    limit 50 + keyset cursor，请求序号守卫丢弃过期响应；「继续加载」追加）；全部恢复
    → 路由加载的全量快照（legacy 列表语义，零请求）。关键字回车提交（trim 后服务端
    过滤），可清除。
  - **详情抽屉**：根信息（编码/名称/类别/单位/创建时间）+ 当前版本规格参数 +
    版本历史（徽章 + 生效/发布日期 + 草稿行级发布）+ 关联 BOM（含版本状态 chips）+
    被引用位置（主料/替代料角色、行号、用量）+ 工艺路线 + 最近工单
    （orderNumber/状态/计划量/交期）——**聚合区块仅在响应含该键时渲染**（服务端按
    读权限门控），不以「暂无」冒充「无权限」；详情读取失败静默回退列表行；竞态守卫
    （旧响应不覆盖新打开行）。
  - **新建抽屉**：物料类型选择联动规格参数预设（原材料：旦数/颜色/层数；半成品/成品：
    草高/针距；包装物：无预设），自定义键值行始终可加、可移除（行 id 稳定不串值）；
    数值预设键与十进制字面量归一为数值。**创建载荷与原 vanilla 表单逐字节一致**
    （publish 恒 false——保存草稿，发布为独立行级动作；effectiveAt→`T00:00:00.000Z`）。
  - 三态：DataTable loading/空态（区分「暂无物料版本」与「没有符合条件的物料版本」）/
    错态；**装载错误与动作错误分离**——列表行级动作失败呈独立告警不隐藏列表。
- 装配：`manufacturing-view.ts` 物料卡定义移除、改挂 `appendManufacturingItemConsole`
  （宿主 `manufacturing-items-console`/data-testid `kt-mfg-items`；**刻意不携带
  data-route-view**——manufacturing-master 非独立 AppRoute 挂载面，父级
  manufacturing-workbench 路由可见性统一治理）；BOM/工艺路线两卡保持 vanilla
  （U3-MFG-2/3 迁移），vanilla 网格 3 列→2 列。`manufacturing-forms.ts`
  openItemVersionForm 删除（openBomVersionForm/openRoutingVersionForm 保留）；
  `manufacturing-cards.ts` 物料分支删除。

## 3. 测试

- fastify inject：`test/fastify/manufacturing-items.test.ts` 15/15——默认全量逐字节
  `{items}`（无 nextCursor 键）+ 过滤对象 oracle、itemType/status/query/cursor/limit
  透传 + 七类查询参数负例 400、字段裁剪、详情 200/404/非 uuid 400 + 关联聚合按读权限
  门控（含 scopes 空默认拒绝）+ 详情字段裁剪、POST 入参 oracle（trim/stableCode/
  specification 默认空对象/timestamp 归一/publish 严格 true）+ 八负例消息逐字、mutation
  投影、权限负例（无 manage 403/字段拒绝 403/无读 403）、DomainError 映射、依赖缺失
  503、未认领方法与尾斜杠落回 null；**parity 组**：GET 列表与 POST 创建新旧轨响应逐键
  一致（含遮蔽）+ 仓储实参逐字节一致。
- PG 集成（真实 kingturf*test，独立 owned schema）：
  `test/manufacturing-postgres.integration.test.ts` +6（U3-MFG-1 describe 块 12/12）——
  无过滤与 legacy list 逐字节相等、itemType/status/query 筛选（% * 字面子串）、keyset
  游标 4 页走查全量不重不漏 + 同 SKU 多版本游标、坏 cursor/非 COMPANY 403/租户隔离、
  findItem 根+版本历史+四类聚合内容与键集、未授权聚合键缺失、跨租户/未知 id null、
  非 COMPANY 403。
- 组件：`item-console.test.tsx` 21/21——默认视图与 e2e 黑盒文案契约（SKU 独占元素、
  `已发布 · 第 1 版` 徽章逐字、无草稿时无「发布版本」、表内无 BOM/路线编码）、分类
  计数去重、权限门（manage 缺失无新建/发布入口）、分类/状态/关键字服务端筛选与游标
  续载、条件空态与装载错态、行级发布（成功重读/失败独立告警不隐藏列表）、新建载荷
  oracle（默认日期/规格预设联动/数值归一/移除中间行不串值/失败保留抽屉）、详情聚合
  渲染与权限键缺失不渲染、创建成功即关抽屉（刷新失败不阻断）、详情竞态守卫、
  specificationOf/countByCategory/specEntries 纯助手。
- f3 冻结场景 re-pin（已批先例）：GET/POST /api/v1/manufacturing-items 两场景比对降级
  为响应+终止仓储调用——响应与 legacy 逐字段相等（200 `{items:[]}`/400
  `itemType is required`）；GET 终止调用钉定桥轨形态 `listItemPage(作用域上下文, {})`
  （原 `list('items', …)` 为 additive 替换）；中间授权访问序变化不在 re-pin 比对内；
  `app-batch4-preservation.test.ts` 311/311 全绿（其余 308 场景逐字段不动）。
- 契约：manufacturing-route-contract（legacy 轨）与 procurement-route-contract 均无改动
  全绿（两测试夹具无 commercial 依赖，生产桥不挂载）。
- bootstrap.test：manufacturing-card 3→2 + 物料控制台宿主断言（宿主必须包含于
  manufacturing-workbench 面板内、class/testid/data-route-view=null、无读权限不挂载）；
  源绑定锚 `openItemVersionForm`→`openBomVersionForm` + 新增 item-console 页面锚。
  96/96 全绿；`manufacturing-forms-behavior.test.ts` 物料表单用例迁移至组件测试
  （BOM/路线用例保留 3/3）；`commercial-route-data.test.ts` 43/43 无改动。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API typecheck / lint / prettier              | 0 / 0 错误 / 通过（干净快照隔离 worktree 实跑）                                                                                                                                                                                                                                                                                                                       |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17916/17916**（175 文件；干净快照 d3fec40——基线 17895 + 本批 fastify 契约 15 + PG 集成 6，归因干净）                                                                                                                                                                                                                                                                |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（干净快照；首轮快照 ci 曾红——item-console.test.tsx `at()` 助手参数类型收窄错误被快照 typecheck 抓出（vitest/esbuild 不做类型检查、eslint 不报该项），amend 修正后复跑全绿）                                                                                                                                                                              |
| Web 测试                                     | **654/654**（干净快照，含 item-console 21/21 + bootstrap 96/96 + manufacturing-forms-behavior 3/3 + commercial-route-data 43/43）                                                                                                                                                                                                                                     |
| structure-gate                               | 强制违规 0（干净快照；ITEM_VERSION_PROJECTION 按 SUPPLIER 先例登记 G3 白名单）                                                                                                                                                                                                                                                                                        |
| coverage（test:coverage check）              | overall 51413/64389（≈79.9%）、domain 630/672（≈93.8%）、repositoryLines 10447/12621（≈82.8%），**deficits 空**（head=d3fec408c64a682ec4fcd142d8c17776799b6427）                                                                                                                                                                                                      |
| build / 启动预算 / console-css 守卫 / audit  | 全过（Console css guard：单一合并 CSS 静态链接 + kt tokens 验证；audit:scan、security:check 无已知漏洞）                                                                                                                                                                                                                                                              |
| e2e P1（黑盒）                               | **未执行——阻塞：KINGTURF_ADMIN_PASSWORD 所有者口令本会话不可得**（U3-COM-1..7/U3-CRM-1..4/U3-PROC-1..4 十五子批同款缺口）；文案契约已逐条静态钉定于组件测试（SKU 独占元素/`已发布 · 第 N 版` 徽章逐字/无草稿时「发布版本」计数 0/表内无 BOM·路线编码独占元素），kingturf_dev 种子核对 4 物料+1 BOM+1 路线与 e2e 期望一致                                              |
| pnpm ci:local                                | **EXIT=0 全链**（干净提交快照 **d3fec40**——feat 提交本体经一次 amend 修正类型后复跑；隔离 worktree /tmp/mfg1-ci-wt 实跑；NODE_ENV=test + kingturf_test：install/format/doc-lint/structure/service/frontend-caps/db-guard/migrate/status/lint/typecheck/test:coverage/build/audit:scan/security:check 全过）。共享树因五会话并行写入不具回执资格，沿隔离 worktree 先例 |

## 5. 边界与后续

- legacy manufacturing dispatch 轨完整保留（boms/routings 列表与创建、publish、全部
  vanilla 双轨并行）；本批零新写路径（POST/publish 均 legacy 同链）。
- **能力缺口如实登记**：①TD-MFG-001——「新建物料版本」端点缺失（createItem 恒建 v1，
  同 SKU 续版无 API 面；前端状态徽章如实映射版本状态）；②TD-MFG-002——物料规格参数
  为自由 jsonb 无参数目录（预设键名取自既有数据实际用法：pileHeightMm/gauge/dtex/
  color/layers；目录化须 schema 设计另批）。均待主协调裁定。
- 未 dispatch workflow；未触 `.github/workflows/`；未 push（待主协调验收后另批）。
- 后续子批：MFG-2（BOM 组件树/版本对比）/MFG-3（工艺路线顺序视图）/MFG-4（工单看板）
  /MFG-5（报工入库）待主协调指令。
