# U3-MFG-2 BOM 管理控制台 + Fastify manufacturing-boms 端点组证据（2026-11-23）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + U3-MFG 指令（MFG-2 BOM 管理子批；
> MFG-1-CP 已复核通过并附带 console-entry 纯追加/共享文件纪律与 push 前检查规则）。
> 旧 vanilla「BOM 与替代料」卡片 + 「创建标准 BOM」表单退役沿用裁定 17 语义（引用清零
> 即删）；f3 冻结场景按 A1-P3/A-F2a/U3-COM-7/U3-CRM-1/U3-PROC-1/U3-MFG-1 已批 re-pin
> 先例适配。

## 1. Fastify manufacturing-boms 端点组（registry 认领 +4，累计 64 路径/17 文件不含 registry）

| 端点                                       | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/manufacturing-boms             | 视图轨迁移：listBomPage（additive keyset，排序键 (code,version DESC) 与 list('boms') 一致）+ status/query/productType 筛选（additive；query=BOM 编码/名称 strpos 字面子串；productType 按产品物料类型过滤——左树「成品/半成品」）；**limit 不设默认值——无查询参数时响应与 legacy 全量 `{items}` 逐字节一致（无 nextCursor 键）**；显式 limit（1..100）才附 nextCursor；looseObject 透传 + Date 归一化                         |
| GET /api/v1/manufacturing-boms/:id         | additive 只读 findBom：根行 + 产品信息（sku/name/itemType/baseUnitCode）+ 全部版本行项（组件含物料根/类型/基本单位 + 替代料含换算系数，按 line_number 排序）+ **最新已发布版本组件层级树**（深度 ≤3、按组件物料 id 已访问集合环守卫；每个组件取其编码最小的已发布 BOM 的最新已发布版本展开；叶节点 line.bom=null）；404 信封含 correlationId；非 uuid 参数 400（`bomId must be a UUID`）                                     |
| POST /api/v1/manufacturing-boms            | legacy manufacturingBomCreateRoutes 同解析链（allow 八字段→行四字段→替代料三字段（hasOwn 缺省：scrapBasisPoints=0、substitutes=[]）→空行拒绝→stableCode/uuid/decimal/integer/timestamp→201 + mutationDto(bom:read)）；负例消息逐字一致（Unsupported fields/`code is required`/`Code must be …`/`lines[0].componentItemVersionId must be a UUID`/`priority must be an integer between 1 and 1000`/`lines must not be empty`） |
| PUT /api/v1/manufacturing-boms/:id/publish | 现代化统一动作端点：分派 legacy publish('bom') 同链（草稿单向发布、发布内容不可变守护全在 DB 触发器）→ 201 + mutationDto(bom:read)；legacy POST /manufacturing-bom-versions/:id/publish 轨逐字不动（双轨并行）。**零新写路径语义**（仅既有发布动作的新壳）                                                                                                                                                                   |

仓储（`manufacturing-repositories.ts` additive）：`listBomPage`（(code,version) 复合键集
cursor=`<code>.<version>`；筛选/游标/limit 全部 values.push 参数化）/ `findBom`（根行查询 +
版本列表 + 行项批查询（`bom_version_id=ANY($N::uuid[])` 一次取全部版本）+ `bomNode` 递归
层级树）；行投影 `BOM_VERSION_PROJECTION` 提取为模块常量供 list/listBomPage 复用（SQL 字节
与提取前逐字一致——**机械验证 982 字节相等**）；`BOM_LINE_DETAIL_PROJECTION` 详情行项投影
供版本行项共用（structure-gate G3 白名单按 ITEM_VERSION_PROJECTION 同先例登记）。company
作用域门保持；legacy `list('boms')` 改用同一投影常量（字节守恒）。

## 2. BOM Preact 控制台

- `bom-console.tsx`（页面工厂+动作闭包）+ `bom-ports.ts` + `bom-state.ts`（含 diffVersions
  纯函数）+ `bom-detail.tsx`（详情抽屉）+ `bom-create.tsx`（新建抽屉）+ CSS 增量（追加于
  `manufacturing-console.css`，kt tokens 取值）：
  - **主从布局**：左侧产品类型树（全部 BOM/成品/半成品——计数按 BOM 根（编码）去重，类型
    归属经宿主 `productTypeOf` 从 items 视图 itemId→itemType 预聚，不对 BOM 快照做类型
    推断）+ 版本状态筛选；右侧 DataTable（BOM 编码+名称双行/产品/组件数/版本状态徽章/
    生效日期/行级操作）。
  - **e2e 契约**：BOM 编码为独占文本元素（`kt-bom-code`）；产品 SKU 并入复合文本（不与
    物料控制台的 SKU 独占元素撞 Playwright exact strict mode）；版本状态徽章与物料控制台
    同格式 `已发布 · 第 N 版`；无草稿时无「发布版本」文案。
  - **行级操作**：查看 → 详情抽屉；草稿 → 发布版本（列表与抽屉双入口；PUT publish）。
  - **详情抽屉**：根信息/产品 + 版本历史 chips（草稿行内发布）+ **组件层级树**（可折叠
    展开——折叠集合按子 BOM 版本行 id；替代料 warning 徽章醒目标记 `替代料 vN`；子 BOM
    头 `↳ 子 BOM <code> · vN 状态`）+ **版本对比视图**（默认最新已发布 vs 上一版本；
    选择器联动、同版本守卫；**三类差异高亮**——新增（success 底）/删除（danger 底）/
    变化（warning 底，字段级 `用量/损耗率/替代料：old → new`））；详情读取失败静默回退
    列表行；竞态守卫。
  - **新建抽屉**：产品版本（已发布物料版本选项，legacy 同源同公式 label=`SKU · 名称`）→
    组件行（首行裸字段名 + 追加行 `rN:` 前缀；用量/损耗率/可选替代料；行 chip 可增删）。
    **创建载荷与 vanilla 表单逐字节一致**（单行无替代料时：productItemId 取所选版本行的
    itemId、outputQuantity '1'、publish 恒 false、effectiveAt 归一、替代料 priority 1/
    conversionFactor '1'；多行为同端点形状的 additive 能力）。
- 装配：`manufacturing-view.ts` BOM 卡定义移除、改挂 `appendManufacturingBomConsole`
  （宿主 `manufacturing-boms-console`/data-testid `kt-mfg-boms`；不带 data-route-view）；
  vanilla 网格仅余工艺路线一卡（`style.css` 列数 2→1，规则 4 例外）；`openBomVersionForm`
  删除；`manufacturing-cards.ts` BOM 分支删除。

## 3. 测试

- fastify inject：`test/fastify/manufacturing-boms.test.ts` 14/14——默认全量逐字节
  `{items}`、五类筛选/分页透传 + 七类查询负例 400、字段裁剪、详情 200/404/400（含聚合
  形状 oracle：根+产品+版本行项+层级树）、POST 入参 oracle（trim/stableCode/hasOwn 缺省/
  publish 严格 true）+ 六负例消息逐字、mutation 投影、PUT publish 三映射与负例（未知
  字段/DomainError 映射/空作用域 403）、权限负例、依赖缺失 503、未认领方法/尾斜杠落回
  null；**parity 组**：GET 列表与 POST 创建新旧轨响应逐键一致 + 仓储实参逐字节一致。
- PG 集成：`test/manufacturing-postgres.integration.test.ts` +5（U3-MFG-2 describe
  块 17/17）——无过滤与 legacy list('boms') 逐字节相等 + 视图行形态（替代料 snake 全列）；
  status/query/productType 筛选；keyset 游标走查；findBom 根+产品+版本行项（组件单位/
  类型+替代料换算系数）；层级树展开（半成品子 BOM）+环守卫（CY-A→CY-B→CY-A 第二层截断）；
  租户隔离/未知 id null/非 COMPANY 403。夹具如实记录：同码第二版无法经 createBom 建立
  （(tenant,code) 唯一 + createItem 恒建 v1——TD-MFG-001 的域级证明）。
- 组件：`bom-console.test.tsx` 13/13——默认视图与 e2e 文案契约（编码独占元素/徽章逐字/
  产品 SKU 不独占/无草稿无发布文案）、左树计数去重与归类、权限门、产品类型/状态/关键字
  服务端筛选与游标续载、空态/装载错态/动作错误分离、详情聚合（产品/版本历史/树/替代料
  标记/折叠往返）、版本对比三类差异与选择器同版本守卫、行级发布（成功重读/失败独立告警
  不隐藏列表）、新建载荷 oracle（单行逐字节/多行前缀聚合/移除中间行不串值/失败保留抽屉）、
  diffVersions 纯函数三类差异。
- f3 冻结场景 re-pin（已批先例）：GET/POST /api/v1/manufacturing-boms 比对降级为响应+
  终止仓储调用（GET 终止调用钉定 `listBomPage(作用域上下文, {})`）；311/311 全绿（其余
  场景逐字段不动）。
- bootstrap.test：manufacturing-card 2→1（仅工艺路线）+ BOM 控制台宿主断言（面板内/
  testid/data-route-view=null/workbench 文本不含 BOM 编码）；源绑定锚
  `openBomVersionForm`→`openRoutingVersionForm` + 新增 bom-console 页面锚；96/96 全绿；
  `manufacturing-forms-behavior.test.ts` BOM 表单用例移除（oracle 迁组件测试；工艺路线
  用例保留）。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API typecheck / lint / prettier              | 0 / 0 / 通过（干净快照隔离 worktree 实跑）                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17935/17935**（干净快照——基线 17916 + 本批 fastify 契约 14 + PG 集成 5，归因干净；共享树预验证同数 EXIT=0）                                                                                                                                                                                                                                                                                                                                                                                    |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（干净快照）                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Web 测试                                     | **711/711**（干净快照；共享树预验证同数 EXIT=0）                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| structure-gate                               | 强制违规 0（BOM_VERSION_PROJECTION/BOM_LINE_DETAIL_PROJECTION 按 ITEM 先例登记 G3 白名单）。首轮快照（282aeb4）曾红——console-entry.ts 827 行触发 G1（TD-PROC-005 已登记的增长点）、createBomActions 214 行触发 G5；**结构修复提交 b6e20a1**：BOM 宿主迁 `console/bom-host.ts`（manufacturing-view 直连，console-entry 恢复 747 行）、动作工厂拆 `createBomActions`（装载/筛选）+`createBomMutations`（发布/创建，io 注入）两函数，不加宽任何白名单                                               |
| coverage / build / audit                     | overall 55056/68149（≈80.8%）、domain 630/672（≈93.8%）、repositoryLines 10630/12805（≈83.0%），**deficits 空**（head=b6e20a138af3a…）；登录预算 JS 11751B gzip + console-css 守卫过；audit:scan/security:check 无已知漏洞                                                                                                                                                                                                                                                                       |
| e2e P1（黑盒）                               | **未执行——KINGTURF_ADMIN_PASSWORD 口令不可得**（前十六子批同款缺口）；文案契约逐条静态钉定于组件测试；kingturf_dev 种子（BOM-KT-PRO-50 已发布）与 e2e 期望一致                                                                                                                                                                                                                                                                                                                                   |
| pnpm ci:local                                | **EXIT=0 全链**（干净提交快照 **b6e20a1**——feat 282aeb4 + 结构修复 b6e20a1；隔离 worktree /tmp/mfg1-ci-wt 实跑 15:32–15:43。**归属机械确证**：worktree reflog 15:32:19 checkout 至 b6e20a1 后无后续移动；coverage-result 的 head 字段记录 b6e20a138af3a…；NODE_ENV=test + kingturf_test：install/format/doc-lint/structure/service/frontend-caps/db-guard/migrate/status/lint/typecheck/test:coverage/build/audit:scan/security:check 全过）。共享树因并行会话不具回执资格，沿隔离 worktree 先例 |

## 5. 边界与后续

- legacy manufacturing dispatch 轨完整保留（boms GET/POST/publish 全部双轨并行）；本批
  零新增写语义（PUT publish 为既有 publish 动作新壳）。
- 版本对比由前端基于详情 versions 行项计算（不新增读端点；两版本行项已在详情聚合内——
  指令「优先在详情聚合里返回」路径落地）。
- 层级树深度上限 3 + 物料已访问集合环守卫（环 BOM 经组件物料截断，PG 集成覆盖）。
- 未 dispatch workflow；未触 `.github/workflows/`；push 按新规则先核 `origin/main..HEAD`。
- 后续子批：MFG-3（工艺路线顺序视图）/MFG-4（工单看板）/MFG-5（报工入库）待主协调指令。
