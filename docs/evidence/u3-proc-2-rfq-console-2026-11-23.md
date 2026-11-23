# U3-PROC-2 询价管理控制台 + Fastify procurement-rfqs 端点组证据（2026-11-23）

> 授权链：U3-PROC-1-CP 主协调复核通过 + 推送放行 + U3-PROC-2 指令。RFQ 区退役沿用
> 裁定 17 语义；f3 冻结场景按 U3-COM-7/U3-CRM-1/U3-PROC-1 已批 re-pin 先例适配；
> **关闭写路径为本指令明授的新行为**（R2 登记见台账 U3-PROC-2 段）。

## 1. Fastify procurement-rfqs 端点组（registry 认领 +4，累计 50 路径/14 文件）

| 端点                                   | 守恒语义                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/procurement-rfqs           | 视图轨迁移：listRfqs（投影/排序键 created_at DESC 与 list('rfqs') 一致；页对象形态 nextCursor 恒 null——legacy 无 LIMIT 无分页窗口）+ status 筛选（additive，procurement_document_status 五值）；无参数时响应与 legacy 全量 `{items}` 逐字节一致；looseObject 透传 + Date 归一化                                                                            |
| GET /api/v1/procurement-rfqs/:id       | additive 只读 `findRfq`：根行（list 同投影字段）+ 行项（同 lines 聚合）+ **报价对比**（quotes：报价头 supplierName/quoteReference/receivedAt/validUntil + 逐行 sku/lineNumber/unitPrice/promisedAt/MOQ——supplier_quote_lines 单价经 additive 只读暴露，供比价呈现）；404 信封含 correlationId；非 uuid 400                                                 |
| POST /api/v1/procurement-rfqs          | legacy procurementRfqCreateRoutes 同解析链（allow 五字段 → authorizeQuery(Object.keys(body)) → lines 逐行解析（行 allow 三字段/uuid/decimal/calendarDate）→ 空数组拒绝 → stableCode/timestamp/currency/issue===true → 201 + mutationDto(procurement:read)）；负例消息逐字一致（含 lines must be an array/lines must not be empty/行级 Unsupported fields） |
| PUT /api/v1/procurement-rfqs/:id/state | 现代化统一动作端点：action **issue** 分派 legacy issueRfq 同链（DRAFT→ISSUED）；action **close** 走 additive closeRfq（DRAFT/ISSUED→CANCELLED，证据事件 rfq.closed 同 rfq.created/issued 构）。legacy POST /:id/issue 轨逐字不动（双轨并行）                                                                                                               |

仓储 additive：`listRfqs`（页对象）/`findRfq`（详情含报价对比）/`closeRfq`（关闭写路径）；
`RFQ_ITEM_PROJECTION` 提取常量供 list/listRfqs 复用（G3 白名单同 SUPPLIER 先例）。
close 语义边界：PARTIALLY_RECEIVED/RECEIVED 属采购单收货状态机不开放关闭；关闭仅
DRAFT/ISSUED，未命中 `not_found 'Open RFQ not found'`。

## 2. 询价 Preact 控制台

- `rfq-console.tsx` + `rfq-ports.ts`：PageHeader（询价管理）+ 状态筛选（全部/草稿/已签发/
  部分收货/已收货/已取消——businessStateLabel 同口径五值全有标签）+ 编号/状态检索 +
  DataTable（首列 `{rfq_number} · {状态}` 保持 e2e 黑盒文案契约 `RFQ-… · 已签发`；行项
  计数/报价截止+币种列）+ 详情抽屉（状态/币种/截止 + 行项清单 sku/itemName/数量/要求
  到货 + **报价对比**区：报价头 + 逐行单价/承诺日/MOQ；详情经桥轨 additive GET 详情
  读取，失败静默回退列表行）。
- 行级操作：**发布询价**（DRAFT + procurement:manage → PUT state issue）、**关闭询价**
  （DRAFT/ISSUED + procurement:manage → PUT state close）；新建抽屉载荷与原 vanilla
  「新建并发出询价单」逐字节一致（responseDueAt=`${date}T23:59:59.000Z`、currency CNY、
  issue:true、单行项）。
- 装配：`procurement-view.ts` 询价区改挂 `appendRfqConsole(context, panel)`（宿主
  `rfqs-console`/data-testid `kt-proc-rfqs`，同供应商宿主口径挂面板内不带
  data-route-view）。
- **退役边界（如实记录）**：`sourcing-register.ts` 的 RFQ 卡片与新建询价表单退役；
  **供应商报价卡片与「登记供应商报价」表单属 supplier-quotes 域（尚未迁移），保留
  vanilla 待 U3-PROC-3 承接**——面板更名「供应商报价」，sourcing/order/inventory 三
  vanilla 列计数不变。

## 3. 测试

- fastify inject：`test/fastify/rfqs.test.ts` 10/10——默认全量逐字节 `{items}`（无多余
  键）+ 过滤对象 oracle、status 筛选透传/枚举 400、字段裁剪、详情行项+报价对比/404/非
  uuid 400、POST 入参 oracle + 九负例消息逐字（lines 类型/空数组/行未知字段/行标量/
  编号/截止/币种）、PUT issue/close 分派 oracle、未知 action 400/无 manage 403、
  DomainError not_found→404、依赖缺失 503。
- 组件：`rfq-console.test.tsx` 7/7——创建载荷 oracle、issue/close PUT 载荷 oracle、
  ISSUED 无发布门、权限门、状态筛选+检索、详情行项+报价对比（loadDetail 详情优先）、
  刷新失败 DataTable error 面。
- f3 re-pin（U3-COM-7/U3-CRM-1/U3-PROC-1 已批先例）：GET /api/v1/procurement-rfqs
  （响应与 legacy 逐字段相等 200 {items:[]}；终止调用钉定 `listRfqs(作用域,{})` 页对象
  形态）+ POST（400 'lines must be an array' 与无仓储调用逐字段相等）——中间授权访问序
  变化不在 re-pin 比对内；PUT/DELETE 两场景未经桥（未认领）守恒无改动。
- 契约：procurement-route-contract（legacy 轨，fixture 无 commercial 依赖桥不挂载）
  1767/1767 全绿无改动。
- bootstrap.test：procurement 断言扩展（rfqs-console 宿主包含于面板内/testid/
  data-route-view=null + sourcing 报价卡片 '报价 SQ-1' 保持 vanilla）。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                            |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17881/17881**（新增 rfqs inject 10 + f3 re-pin 两场景；procurement 契约 1767 无改动全绿）                                                                                         |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                            |
| Web 测试                                     | **517/517**（新增 rfq-console 7）                                                                                                                                                   |
| structure-gate                               | 强制违规 0（RFQ_ITEM_PROJECTION 按 SUPPLIER 先例登记 G3 白名单）                                                                                                                    |
| e2e P1（黑盒）                               | **未执行——KINGTURF_ADMIN_PASSWORD 仍不可得**（同 U3-PROC-1，主协调已知悉该缺口并以 bootstrap.test 挂载覆盖补偿）；控制台首列文案 `RFQ-… · 已签发` 与 e2e 断言正则逐字兼容已静态核对 |
| pnpm ci:local                                | 见提交回执（本批最终 HEAD 全链）                                                                                                                                                    |

## 5. 边界与后续

- legacy procurement dispatch 轨完整保留（POST /:id/issue、supplier-quotes/purchase-
  orders/goods-receipts/inventory 端点均未认领，双轨并行）。
- close 写路径为 U3-PROC-2 指令明授新行为：DRAFT/ISSUED→CANCELLED + 审计事件
  rfq.closed；登记于台账 U3-PROC-2 段（非 TD——已授权）。
- 后续子批：U3-PROC-3 起（supplier-quotes 含报价登记表单迁移 → purchase-orders →
  receipts → inventory）待主协调指令。
- 未 dispatch workflow；未触 `.github/workflows/`。
