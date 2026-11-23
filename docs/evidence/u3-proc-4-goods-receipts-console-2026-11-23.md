# U3-PROC-4 收货管理控制台 + Fastify goods-receipts 端点组证据（2026-11-23）

> 授权链：U3-PROC-3-CP 主协调复核通过 + U3-PROC-4 指令（PROC 域最后子批）。收货卡片
> 与登记表单退役沿用裁定 17 语义；f3 冻结场景按已批 re-pin 先例适配；**零新写路径**
> ——部分收货/超收守护全在 legacy receive() 同链（收货单不可变，DB 触发器
> goods_receipt_immutable）。

## 1. Fastify goods-receipts 端点组（registry 认领 +3，累计 57 路径/16 文件）

| 端点                           | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/goods-receipts     | 视图轨迁移：listGoodsReceipts（投影/排序键 received_at DESC 与 list('receipts') 一致，页对象形态；收货单不可变事实，无筛选/分页窗口——响应与 legacy 全量 `{items}` 逐字节一致）；looseObject 透传 + Date 归一化                                                                                                                                                                                                                                                                                                                                                                                                            |
| GET /api/v1/goods-receipts/:id | additive 只读 `findGoodsReceipt`：根行（list 同投影字段含 poNumber）+ 批次行项（lotNumber/locationCode/sku/quantity）+ **关联采购单数量核对**（purchaseOrder：poNumber/status + 行项 quantity vs receivedQuantity）；404 信封含 correlationId；非 uuid 400                                                                                                                                                                                                                                                                                                                                                                |
| POST /api/v1/goods-receipts    | legacy procurementReceiptCreateRoutes 同解析链（allow 五字段 → authorizeQuery(Object.keys(body)) → lines 逐行六字段解析（purchaseOrderLineId/lotNumber/locationCode/quantity/manufacturedAt/expiresAt，后两者 Object.hasOwn 缺键=null）→ 空数组拒绝 → stableCode/timestamp → 201 + mutationDto(procurement:read)）；**部分收货/超收守护全在 legacy receive() 同链**：ISSUED/PARTIALLY_RECEIVED 可续收、within_remaining 超收拒绝（'Receipt quantity exceeds open purchase order quantity'）、批次/不可变 RECEIPT 移动/PARTIALLY_RECEIVED→RECEIVED 状态迁移逐字段守恒。收货单不可变——**无状态流转端点**；legacy 轨逐字不动 |

仓储 additive：`listGoodsReceipts`（页对象）/`findGoodsReceipt`（详情含数量核对）；
`GOODS_RECEIPT_ITEM_PROJECTION` 提取常量供 list/listGoodsReceipts 复用（G3 白名单同
前先例）。

## 2. 收货 Preact 控制台

- `gr-console.tsx` + `gr-ports.ts`：PageHeader（收货管理）+ 收货单/订单号检索 +
  DataTable（首列 `收货 {receipt_number} · {poNumber}` 保持 e2e 黑盒文案契约
  `收货 GR-…`；批次数/收货时间/送货单号列）+ 详情抽屉（收货单/采购订单/收货时间/
  送货单 + 批次行项（sku/批次/库位/实收）+ **数量核对**（关联 PO 行项 订购 vs 已收 +
  PO 状态）——详情经桥轨 additive GET 详情读取，失败回退列表行）。
- 行级操作：**登记批次收货**（procurement:manage）——新建抽屉载荷与原 vanilla 表单
  逐字节一致（receivedAt 当前时刻 ISO、expiresAt null、订单行 `orderId|lineId` 拆分、
  库位选项 value=code）。**无状态流转**（收货单不可变）。
- 装配：`procurement-view.ts` 收货区改挂 `appendGoodsReceiptConsole(context, panel)`
  （宿主 `goods-receipts-console`/data-testid `kt-proc-goods-receipts`，同前三宿主
  口径）；可续收订单行选项（ISSUED/PARTIALLY_RECEIVED 未收数量标签）与库位选项与
  vanilla 表单同源同公式。
- **退役（本批 vanilla 清理）**：`purchase-register.ts`/`purchase-actions.ts` 删除
  （收货卡片 + 登记收货表单随控制台迁移）；procurement-grid 剩 sourcing（报价）/
  inventory 两 vanilla 区——**如实记录**：sourcing-register 残余（供应商报价卡片 +
  登记报价表单）仍为 vanilla（supplier-quotes 域端点未迁移未认领，本批指令未含）；
  inventory-register 亦保持 vanilla（只读呈现，无 PROC 域端点变更）。

## 3. 测试

- fastify inject：`test/fastify/goods-receipts.test.ts` 5/5——列表逐字节 `{items}` +
  字段裁剪、详情批次行项+数量核对/404/非 uuid 400、POST 入参 oracle（hasOwn 缺键
  null/expiresAt null 透传/scopeContext/correlationId）+ 九负例消息逐字（lines 类型/
  空数组/行未知字段/lot 大写编码/库位空串/日期/订单行 UUID/receivedAt）、超收
  conflict→409、依赖缺失 503。
- 组件：`gr-console.test.tsx` 5/5——登记载荷 oracle（receivedAt 当前时刻断言/
  订单行拆分/expiresAt null）、权限门、检索、详情批次行项+数量核对（loadDetail 详情
  优先）、刷新失败 DataTable error 面。
- f3 re-pin（已批先例）：GET /api/v1/goods-receipts（响应逐字段相等；终止调用钉定
  `listGoodsReceipts(作用域)` 单参形态——收货单无筛选窗口）+ POST（400
  'lines must be an array' 与无仓储调用逐字段相等）；PUT/DELETE 两场景未经桥守恒。
- 契约：procurement-route-contract（legacy 轨）无改动全绿。
- bootstrap.test：procurement 断言四控制台宿主 + procurement-column 3→2 + 报价卡片
  vanilla 保持断言；收货卡片断言移除（渲染由 gr-console 行为测试覆盖）。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| API typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                               |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17900/17900**（新增 goods-receipts inject 5 + f3 re-pin 两场景；procurement 契约 1767 无改动全绿）   |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                               |
| Web 测试                                     | **530/530**（新增 gr-console 5）                                                                       |
| structure-gate                               | 强制违规 0（GOODS_RECEIPT_ITEM_PROJECTION 按 RFQ/PO 先例登记 G3 白名单）                               |
| e2e P1（黑盒）                               | **未执行——KINGTURF_ADMIN_PASSWORD 仍不可得**（同前三子批已知悉缺口）；`收货 GR-…` 文案契约静态核对兼容 |
| pnpm ci:local                                | 见提交回执（本批最终 HEAD 全链）                                                                       |

## 5. 边界与后续（PROC 域收官素材）

- legacy procurement dispatch 轨完整保留（supplier-quotes/inventory-movements 等端点
  均未认领，双轨并行）。
- **PROC 域收官残余（如实盘点，待主协调收口裁定）**：①sourcing-register（供应商报价
  卡片+登记报价表单）与 inventory-register（批次库存只读呈现）仍为 vanilla——
  supplier-quotes/inventory 端点未迁移未认领；②四控制台（供应商/询价/采购单/收货）
  数据面已全走 Fastify 桥（认领 57 路径）。
- 部分收货语义注记：TD-PROC-001（重复部分收货与状态触发器冲突，P2 真实 PG 确证未修）
  属 legacy receive() 同链固有行为，桥轨守恒继承、本批不触碰。
- 未 dispatch workflow；未触 `.github/workflows/`。
