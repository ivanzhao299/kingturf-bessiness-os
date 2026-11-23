# U3-PROC-3 采购订单控制台 + Fastify purchase-orders 端点组证据（2026-11-23）

> 授权链：U3-PROC-2-CP 主协调复核通过 + U3-PROC-3 指令。PO 区退役沿用裁定 17 语义；
> f3 冻结场景按已批 re-pin 先例适配；**cancel 写路径为本指令「PUT 审批/发布」状态
> 流转授权的合法迁移之一**（R2 登记见台账 U3-PROC-3 段）。

## 1. Fastify purchase-orders 端点组（registry 认领 +4，累计 54 路径/15 文件）

| 端点                                  | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/purchase-orders           | 视图轨迁移：listPurchaseOrders（投影/排序键 created_at DESC 与 list('orders') 一致，页对象形态 nextCursor 恒 null）+ status 筛选（additive）；无参数时响应与 legacy 全量 `{items}` 逐字节一致；looseObject 透传 + Date 归一化                                                                                                                                                                                   |
| GET /api/v1/purchase-orders/:id       | additive 只读 `findPurchaseOrder`：根行（list 同投影字段含 supplierName）+ 行项含 **receivedQuantity 收货状态** + 关联**收货记录**（receiptNumber/receivedAt/sourceReference + 逐行 lotNumber/locationCode/sku/quantity）；404 信封；非 uuid 400                                                                                                                                                                |
| POST /api/v1/purchase-orders          | legacy procurementPurchaseOrderCreateRoutes 同解析链（allow 六字段 → authorizeQuery(Object.keys(body)) → lines 逐行解析（行 allow 四字段：itemVersionId/quantity/unitPrice/requiredAt）→ 空数组拒绝 → stableCode/supplierId/supplierQuoteId 可空/currency/issue===true → 201 + mutationDto(procurement:read)）；负例消息逐字一致（含 Invalid decimal/unitPrice must be non-negative/supplierId must be a UUID） |
| PUT /api/v1/purchase-orders/:id/state | 现代化统一动作端点：action **issue** 分派 legacy issuePurchaseOrder 同链（DRAFT→ISSUED，触发 DB 守卫 purchase_order_issue_guard 合法迁移）；action **cancel** 走 additive cancelPurchaseOrder（DRAFT/ISSUED→CANCELLED——两条 DB 级合法迁移，证据事件 purchase-order.cancelled）。legacy POST /:id/issue 轨逐字不动（双轨并行）                                                                                   |

仓储 additive：`listPurchaseOrders`（页对象）/`findPurchaseOrder`（详情含收货进度）/
`cancelPurchaseOrder`（取消写路径；PARTIALLY_RECEIVED/RECEIVED 已入收货状态机不开放
取消）；`PURCHASE_ORDER_ITEM_PROJECTION` 常量供 list/listPurchaseOrders 复用（G3 白
名单同 RFQ/SUPPLIER 先例）。

## 2. 采购单 Preact 控制台

- `po-console.tsx` + `po-ports.ts`：PageHeader（采购订单）+ 状态筛选（五态）+ 编号/
  供应商/状态检索 + DataTable（首列 `{po_number} · {状态}` 保持 e2e 黑盒文案契约
  `PO-… · 已收货`；供应商/金额（Σ 数量×单价，decimalValue 同 vanilla 卡片口径）/
  行项数列）+ 详情抽屉（状态/供应商/币种/签发时间/金额 + 行项清单含**已收数量** +
  **收货记录**（批次/库位/数量）+ **采购合同文件**区 + 行级操作）。
- 行级操作：**签发订单**（DRAFT + procurement:manage → PUT state issue）、**取消订单**
  （DRAFT/ISSUED + procurement:manage → PUT state cancel）；新建抽屉载荷与原 vanilla
  「创建并签发采购订单」逐字节一致（supplierQuoteId null、currency CNY、issue:true、
  单行项含含税单价）。
- **采购合同文档工作流迁移（关键守恒点）**：PURCHASE 主体合同文档在 vanilla 仅挂 PO
  卡片（`purchase-order-cards.ts` → `purchase-documents.ts`）——PO 卡片退役则文档链
  唯一挂载点消失，故整链等价迁移至详情抽屉「采购合同文件」区：上传（contract-document:
  manage，文件类型白名单 .pdf/.doc/.docx/.png/.jpg/.jpeg 同 vanilla）→ OCR 提交
  （UPLOADED+contract-ocr:operate，POST /:id/ocr 载荷逐字段一致）→ 复核（OCR_REVIEW+
  contract-ocr:review，POST /:id/ocr-review，provider 缺省 ocr_provider→人工复核、
  confidence 缺省 ocr_confidence→1）→ 送签（READY_TO_SIGN+contract-signature:send，
  POST /:id/signature-envelopes，signingOrder SEQUENTIAL/signers 单签署人逐字段一致）。
- 装配：`procurement-view.ts` PO 区改挂 `appendPurchaseOrderConsole(context, panel)`
  （宿主 `purchase-orders-console`/data-testid `kt-proc-purchase-orders`，同前两子批
  宿主口径）。
- **结构门禁驱动拆分（G1/G5 纪律，不豁免）**：本批新增使
  `procurement-repositories.ts` 达 832 行>800——additive 六个只读方法与三个投影常量/
  作用域门帮助者迁移至新 `procurement-read-repositories.ts`（185 行，方法体逐字节迁
  移，主类 extends 继承，写路径留主文件 672 行）；`po-console.tsx` 达 819 行且主函数
  232 行>200——详情子组件（行项/收货记录/合同文档区+类型）拆至 `po-detail.tsx`（221
  行，PoDetailState 结构化子集无循环依赖），动作闭包（刷新/创建/状态流转/文档动作）
  拆至 `po-console-actions.tsx`（176 行动作工厂，主函数降至 ~120 行）。
- **退役边界（如实记录）**：`purchase-order-cards.ts`/`purchase-documents.ts` 删除
  （工作流迁移控制台）；`purchase-register.ts` 改「采购收货」区（收货卡片 +
  `appendReceiveGoodsAction`）；`purchase-actions.ts` 只保留「登记批次收货」表单
  （goods-receipts 域待 U3-PROC-4）——原创建签发表单退役；收货卡片文案
  `收货 {receiptNumber} · {poNumber} · N 批` 逐字节保持（e2e 断言依赖）。

## 3. 测试

- fastify inject：`test/fastify/purchase-orders.test.ts` 9/9——默认全量逐字节
  `{items}` + 过滤 oracle、status 筛选/枚举 400/字段裁剪、详情行项收货状态+收货单/
  404/非 uuid 400、POST 入参 oracle + 八负例消息逐字、PUT issue/cancel 分派 oracle、
  未知 action（approve 400——审批动作不存在于域模型）/无 manage 403、DomainError
  404、依赖缺失 503。
- 组件：`po-console.test.tsx` 8/8——创建载荷 oracle、issue/cancel PUT 载荷 oracle、
  详情行项收货状态+收货记录（loadDetail 详情优先）、合同文档 OCR_REVIEW 复核载荷
  oracle（provider/fields/confidence 缺省链）、文档动作/上传权限门、状态筛选+检索、
  刷新失败 DataTable error 面。
- f3 re-pin（已批先例）：GET /api/v1/purchase-orders（响应逐字段相等；终止调用钉定
  `listPurchaseOrders(作用域,{})` 页对象形态）+ POST（400 'lines must be an array' 与
  无仓储调用逐字段相等）；PUT/DELETE 两场景未经桥守恒无改动；goods-receipts 四场景
  未认领不动。
- 契约：procurement-route-contract（legacy 轨）无改动全绿。
- bootstrap.test：procurement 断言三控制台宿主 + 收货卡片文案 + vanilla 列计数不变。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                                                                                                                                    |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17890/17890**（新增 purchase-orders inject 9 + f3 re-pin 两场景；procurement 契约 1767 无改动全绿）                                                                                                                                                                                       |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                                                                                                                                    |
| Web 测试                                     | **525/525**（新增 po-console 8）                                                                                                                                                                                                                                                            |
| structure-gate                               | 强制违规 0（PURCHASE_ORDER_ITEM_PROJECTION 按 RFQ/SUPPLIER 先例登记；statusClause 复用已登记片段）                                                                                                                                                                                          |
| e2e P1（黑盒）                               | **未执行——KINGTURF_ADMIN_PASSWORD 仍不可得**（同前两子批已知悉缺口）；`PO-… · 已收货`/`收货 GR-…` 文案契约静态核对兼容                                                                                                                                                                      |
| pnpm ci:local                                | **EXIT=0 全链**（干净提交快照 **d4c5677**，NODE_ENV=test + kingturf_test 十四步：install/format/doc-lint/structure/service/frontend-caps/db-guard/migrate/status/lint/typecheck/test:coverage/build 含登录预算与 console-css 守卫/audit:scan/security:check；API 17890/17890、Web 525/525） |

## 5. 边界与后续

- legacy procurement dispatch 轨完整保留（POST /:id/issue、goods-receipts/inventory
  端点均未认领，双轨并行）。
- cancel 写路径为指令授权合法迁移（DRAFT/ISSUED→CANCELLED+purchase-order.cancelled
  证据）；**独立审批层缺失登记 TD-PROC-003**：purchase_orders.status 无 APPROVED 值、
  域模型无独立审批事件——指令中「审批」无法作为独立状态迁移实现（当前签发即审批通过
  动作）；如需独立审批层须 schema 迁移另批授权。
- 后续子批：U3-PROC-4 起（goods-receipts 含收货登记表单迁移 → inventory）待主协调
  指令。
- 未 dispatch workflow；未触 `.github/workflows/`。
