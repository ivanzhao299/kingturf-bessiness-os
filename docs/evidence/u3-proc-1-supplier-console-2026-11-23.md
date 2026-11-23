# U3-PROC-1 供应商管理控制台 + Fastify suppliers 端点组证据（2026-11-23）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + U3-PROC 供应链域启动指令（U3-PROC-1
> 供应商管理子批）。旧 vanilla supplier-register 退役沿用裁定 17 语义（引用清零即删）；
> f3 冻结场景按 A1-P3/A-F2a/U3-COM-7/U3-CRM-1 已批 re-pin 先例适配。

## 1. Fastify suppliers 端点组（registry 认领 +4，累计 46 路径/13 文件）

| 端点                                    | 守恒语义                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/suppliers                   | 视图轨迁移：listSupplierPage（additive keyset，排序键 supplier_number 与 list('suppliers') 一致）+ status 筛选（ACTIVE/ON_HOLD/INACTIVE）；**limit 不设默认值——legacy 供应商列表无 LIMIT，无查询参数时响应与 legacy 全量 `{items}` 逐字节一致（无 nextCursor 键）**；显式 limit（1..500）才附 nextCursor；looseObject 透传 + Date 归一化（COM 同款） |
| GET /api/v1/suppliers/:id               | additive 只读 `findSupplier`（list 同投影单行，含 qualifications 聚合）；404 信封含 correlationId；非 uuid 参数 400（legacy qualification 轨同消息 `supplierId must be a UUID`）                                                                                                                                                                     |
| POST /api/v1/suppliers                  | legacy procurementSupplierCreateRoutes 同解析链（objectBody→allow 七字段→authorizeQuery(Object.keys(body))→stableCode/currency/integer/jsonObject→201 + mutationDto(supplier:read)）；负例消息逐字一致（Unsupported fields/Code must be/Currency must be/integer between/JSON object）                                                               |
| PUT /api/v1/suppliers/:id/qualification | 现代化统一动作端点：action approve\|conditional\|reject 映射 APPROVED\|CONDITIONAL\|REJECTED 后走 legacy qualifySupplier 同链（同解析器；evidence 结构与原 vanilla 物料准入表单一致）→ 200 + mutationDto(supplier:read)。legacy POST /:id/qualifications 轨逐字不动（双轨并行）                                                                      |

仓储（`procurement-repositories.ts` additive）：`listSupplierPage`（keyset cursor=
supplier_number 文本直比——(tenant_id,supplier_number) 唯一；status/limit 参数化 $N）/
`findSupplier`（单行同投影）；行投影 `SUPPLIER_ITEM_PROJECTION` 提取为模块常量供
list/listSupplierPage/findSupplier 三处复用（SQL 字节与提取前逐字一致；structure-gate
G3 白名单按 QUOTES_VIEW_SELECT/CTRS_VIEW_SELECT 同先例登记）。company 作用域门保持。

## 2. 供应商 Preact 控制台

- `supplier-console.tsx` + `supplier-ports.ts`：PageHeader（供应商与准入）+ 状态筛选
  （全部/已启用/ON_HOLD 原码回退/已停用——businessStateLabel 同口径）+ 编号/名称/状态
  检索 + DataTable（`{supplier_number} · {name}` 首列保持 e2e 黑盒文案契约；已准入
  APPROVED 计数同 legacy 卡片口径；账期/币种列）+ 详情抽屉（状态/编号/币种/账期/质量
  评分（基点/100）/联系人/电话 + 资质记录列表（sku/itemName/版本/状态/有效期）+
  报价历史（/api/v1/supplier-quotes 视图按 supplierId 过滤））。
- 行级操作：物料准入审核（FormSection：审核结论 approve/conditional/reject + 物料版本
  （已发布制造物料版本选项，legacy 准入表单同源）+ 有效期/MOQ/交期/审核证据编号）→ PUT
  qualification 桥轨；新建供应商抽屉（载荷与原 vanilla 表单逐字节一致：currency 固定
  CNY、质量评分×100→基点、contact {name,phone} 对象）。
- **停用操作如实未实现**：suppliers.status 表列支持 ON_HOLD/INACTIVE 但全后端无任何
  迁移端点（勘探确证：API/web 无 ON_HOLD/INACTIVE 写路径），行为守恒（R2）不新增——
  控制台状态仅读侧展示+筛选；登记 **TD-PROC-002** 待主协调裁定。
- 装配：`procurement-view.ts` 供应商区改挂 `appendSupplierConsole(context)`（宿主
  `suppliers-console`/data-testid `kt-proc-suppliers`；**刻意不携带 data-route-view**
  ——suppliers 非独立 AppRoute，父级 procurement-workbench 的 procurement 路由可见性
  统一治理）；sourcing/order/inventory 三区 vanilla 保持；`supplier-register.ts`（128
  行）退役删除（引用清零）。

## 3. 测试

- fastify inject：`test/fastify/suppliers.test.ts` 9/9——默认全量逐字节 `{items}`（无
  nextCursor 键）+ 过滤对象 oracle、status/cursor/limit 透传 + 枚举 400、字段裁剪、
  详情 200/404/非 uuid 400、POST 入参 oracle（trim/stableCode/contact 默认空对象/
  scopeContext/correlationId）+ 五负例消息逐字、PUT approve/conditional/reject 三映射
  oracle + 未知 action/非 uuid/无 supplier:manage 负例、DomainError conflict→409、依赖
  缺失 503。
- 组件：`supplier-console.test.tsx` 7/7——创建载荷 oracle、approve PUT 载荷 oracle、
  reject 映射、权限门（无 supplier:manage 无新建/审核入口）、状态筛选+检索、详情抽屉
  资质+报价历史、刷新失败 DataTable error 面。
- f3 冻结场景 re-pin（U3-COM-7/U3-CRM-1 已批先例）：GET/POST /api/v1/suppliers 两场景
  比对降级为响应+终止仓储调用——响应与 legacy 逐字段相等（200 {items:[]}/400
  supplierNumber is required）；GET 终止调用钉定桥轨形态 `listSupplierPage(作用域
上下文, {})`（原 `list('suppliers', …)` 为 additive 替换）；中间授权访问序变化（桥组
  注册多组 root/grant 行）不在 re-pin 比对内。
- 契约：procurement-route-contract（legacy 轨，桥未挂载路径）1767/1767 全绿无改动；
  legacy POST /:id/qualifications 与 GET 其余六视图 legacy 轨不动。
- bootstrap.test：procurement-column 4→3 + 供应商控制台宿主断言（**宿主必须包含于
  procurement-workbench 面板内**——首版误挂工作区根会在其它路由下常显且脱离 e2e
  定位器作用域，终验前自检发现并修正 + 断言钉定；class/testid/data-route-view=null）；
  supplier-register 源绑定移除。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                                                                                                                         |
| API 全量测试（kingturf_test，NODE_ENV=test） | **17871/17871**（含新增 suppliers 9 + f3 re-pin 311/311）                                                                                                                                                                                                                        |
| Web typecheck / lint / prettier              | 0 / 0 / 通过（改动文件）                                                                                                                                                                                                                                                         |
| Web 测试                                     | **510/510**（含新增 supplier-console 7）                                                                                                                                                                                                                                         |
| structure-gate                               | 强制违规 0（SUPPLIER_ITEM_PROJECTION 按 COM 先例登记 G3 白名单）                                                                                                                                                                                                                 |
| e2e P1（黑盒）                               | **未执行——阻塞：KINGTURF_ADMIN_PASSWORD 所有者口令本会话不可得**（U3-COM-1 §2/wave1 §3.1 先例为所有者提供口令后实跑）；待主协调提供口令补跑或另裁。控制台挂载/路由可见性由 bootstrap.test+组件测试覆盖，数据面桥轨由 f3 re-pin+inject 覆盖                                       |
| pnpm ci:local                                | **EXIT=0 全链**（干净提交快照 39e61a4，NODE_ENV=test + kingturf_test：install/format/doc-lint/structure/service/frontend-caps/db-guard/migrate/status/lint/typecheck/test:coverage/build 含登录预算与 console-css 守卫/audit:scan/security:check；API 17871/17871、Web 510/510） |

## 5. 边界与后续

- legacy procurement dispatch 轨完整保留（GET 其余六视图/POST qualifications 及
  rfq/quote/order/receipt/movement 端点均未认领，双轨并行）。
- 后续子批：U3-PROC-2 起（询报价/采购单/收货/库存）待主协调指令。
- 未 dispatch workflow；未触 `.github/workflows/`；未 push（待主协调验收后另批）。
- 停用写路径缺口登记 TD-PROC-002（P3，能力缺口非缺陷）。
