# TD-MFG-016 设计：工单冻结 BOM 版本引用

> 只读设计助手产出，2026-11-26。基线 `main@4a93003`（分离工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg016-design`），77 条迁移已在该工作树的专用库上应用。本文所有 `file:line` 相对该工作树根；行号以 `4a93003` 为准。
>
> 本文不修改仓库。设计前提是并行批次的既定改动：迁移 0078（禁止向已发布制造版本插入子行）、0079（BOM 的组件全部已发布才能发布）、0080 与 0081（采购批）。**这四份迁移在 `4a93003` 中尚不存在**，本文只按任务书给出的语义引用，未逐字核对（待核实）。本批迁移号从 0082 起。

> **入库说明（主协调，2026-11-26）**：本文由只读设计助手产出，经主协调完整审阅后入库，状态为「设计定稿，待实施」。§6.2 的六个未决问题已处置，见 §6.2.1 与台账 TD-MFG-018 至 021。实施前提：迁移 0078、0079（制造写路径批）先于或随本批落地；迁移号从 0082 起。

## 落盘进度

| 节      | 内容                                                                | 状态 |
| ------- | ------------------------------------------------------------------- | ---- |
| 0       | 裁定与范围                                                          | 定稿 |
| 1.1–1.7 | 现状地图（迁移层、API、前端、测试与夹具、真库复现、`effective_at`） | 定稿 |
| 2       | 目标模型与创建时选取规则、守卫                                      | 定稿 |
| 3       | 消费方切换后的具体差异与唯一回退规则                                | 定稿 |
| 4       | 历史工单：不回填（一段说明）                                        | 定稿 |
| 5       | 实施拆批、真库测试清单、311/28 影响预判、发布与回滚、草稿副本实跑   | 定稿 |
| 6       | 风险与未决问题（M16-Q-n）                                           | 定稿 |

## 0. 裁定与范围

**已裁（不再讨论）**

- 方向：在制工单按**创建时冻结的 BOM** 执行，而不是始终取最新已发布 BOM（项目所有者）。
- 历史工单：**不回填**（项目所有者裁定，主协调 2026-11-26 转达，方案 A）。理由说明：当前是开发阶段，生产没有实际业务单据。
- 因此收敛为：迁移只在工单上加可空的 BOM 版本引用列及其守卫，不做任何回填；引用为空的工单保持现行动态口径，这是唯一的回退规则；只有迁移之后新建的工单在创建时写入引用并冻结。
- 回退规则（主协调 2026-11-26 转达）：引用为空时，各消费方**逐字保留自己现有的动态规则**——工单详情与实际成本继续按 `published_at` 取一条，领料守卫与成本前置继续取已发布版本的并集，MRP 继续按 `effective_at`。不在回退路径上把三者统一。
- M16-Q-1（项目所有者 2026-11-26 裁定）：引用存在时，领料守卫从「所有已发布版本的组件并集」收紧为「只有冻结的那一版」；引用为空时保持并集（§3.5）。
- M16-Q-2（项目所有者 2026-11-26 裁定）：创建时按生效日期取版——取生效日期不晚于创单时刻的最新一版，并列次序键为 `published_at DESC, version DESC, id`（§2.4）。

**适用的硬性约束**（`AGENTS.md`「硬性约束」、`docs/design-docs/core-beliefs.md`）

- 行为守恒：重构不得改变业务行为；行为变更与缺陷修复必须先登记台账、单独提交（红线 R2，`core-beliefs.md:29`、`:38`）。
- SQL 一律参数化（`$1..$n`），禁止拼接用户输入（`AGENTS.md:39`）。
- 分层单向：`apps/api → packages/{config, database, domain, types}`（`AGENTS.md:35`）。
- 业务对象不可变：台账只追加修订、不改历史（`core-beliefs.md:28`）；工单及其执行证据由 `production_order_immutable` 等触发器保护（迁移 `0041:101-107`）。
- 交互式决策必须落盘（`core-beliefs.md:11`）：本文的 M16-Q-n 未裁之前不得当作已决。
- 提交单一职责、Conventional Commits；会话最后一次提交必须过 `pnpm ci:local` 并标注 `[已测试]/[未测试]`（`AGENTS.md:41`）。

**本设计把它当作「行为变更」而不是重构来对待**：领料守卫的口径会从并集变成冻结版本（见 §1.2 与 §3.1），这是可观察的行为差异，必须先登记台账并单独提交。

## 1. 现状地图

### 1.1 工单如何引用物料与工艺路线版本

| 事实                                                                                                                                                                                                                                                              | 出处                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `production_orders` 固定 `item_version_id NOT NULL` 与 `routing_version_id NOT NULL`，两条外键都带 `tenant_id`；**没有 BOM 版本列**                                                                                                                               | `packages/database/migrations/0041_production_execution_foundation.sql:4-13`                                       |
| 工序在建单时整份快照进 `production_order_operations`（含 `routing_operation_id` 回指）                                                                                                                                                                            | `0041:14-20`；写入代码 `apps/api/src/production-repositories.ts:86-93`                                             |
| 工单行不可改、不可删：`production_order_immutable BEFORE UPDATE OR DELETE` 调 `protect_production_evidence()` 无条件抛 `production execution evidence is immutable`                                                                                               | `0041:101-102`                                                                                                     |
| `protect_production_evidence()` 被 6 张生产执行表共用（orders、operations、events、material_transactions、operation_reports、rolls）                                                                                                                              | `0041:101-107`                                                                                                     |
| 建单的 API 写路径：`INSERT INTO production_orders(...)` 只带 `item_version_id`、`routing_version_id` 等，`WHERE EXISTS` 要求「该成品版本已发布的工艺路线」；随后写工序快照与第 1 条事件（`evidence` = 请求载荷）                                                  | `production-repositories.ts:45-115`（INSERT 在 `:64-65`，事件在 `:94-105`）                                        |
| 创建端点允许的请求字段共 8 个，没有 BOM 字段（Fastify 轨与 legacy 轨各一份）                                                                                                                                                                                      | `apps/api/src/routes/fastify/production-orders.ts:255-277`；`apps/api/src/routes/production-order-create.ts:44-75` |
| BOM 版本表：`manufacturing_bom_versions` 有 `product_item_version_id`、`status`、`published_at`、`effective_at`，`UNIQUE(tenant_id,bom_id,version)`，`CHECK((status='PUBLISHED')=(published_at IS NOT NULL))`；**没有「每个成品版本只允许一个已发布版本」的约束** | `0036_manufacturing_master_data.sql:22-29`                                                                         |
| BOM 子表：`manufacturing_bom_lines`（组件版本、用量、损耗基点）与 `manufacturing_bom_substitutes`（替代料、优先级、换算系数）                                                                                                                                     | `0036:30-42`                                                                                                       |
| 发布只会把指定版本从 `DRAFT` 改成 `PUBLISHED` 并写 `published_at=now()`；不改内容，不退休旧版本（`RETIRED` 枚举值存在，但 `0036` 之后没有任何迁移或 API 写它——待核实是否有脚本写）                                                                                | `0036:64-85`；`apps/api/src/manufacturing-repositories.ts:170-173`、`:276-281`                                     |
| 续版（MFG-7）：`createBomVersion` 在同根上建 `MAX(version)+1` 的草稿，可以把 `productItemVersionId` 换成**同一产品根下的另一个物料版本**                                                                                                                          | `apps/api/src/manufacturing-version-repository.ts:72-91`、`:93-105`、`:190-234`、`:328-345`                        |

推论：今天的「工单用哪份 BOM」完全不是工单自己的属性，而是各读写在运行时按 `b.product_item_version_id = o.item_version_id` 现算出来的。

### 1.2 数据库里按「已发布 BOM」取数或判断的位置

| #   | 位置                         | SQL / 代码                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 语义                                                                                                                                                                                                                                                                   |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 领料守卫（触发器，现行版本） | `SELECT EXISTS(SELECT 1 FROM production_orders o JOIN manufacturing_bom_versions b ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED' JOIN manufacturing_bom_lines l ON l.tenant_id=b.tenant_id AND l.bom_version_id=b.id WHERE o.tenant_id=… AND o.id=… AND l.component_item_version_id=NEW.item_version_id) INTO bom_component; IF NEW.transaction_type='ISSUE' AND (quality<>'RELEASED' OR NOT bom_component) THEN RAISE EXCEPTION 'production issue requires released BOM material';` —— `packages/database/migrations/0072_production_return_guards.sql:95-107` | **并集口径**：只要该成品版本下**任何一个**已发布 BOM 版本的某一行以该物料版本为组件，就允许领用。不取「最新一条」，不看 `effective_at`，不看替代料表。退料不做 BOM 判断，只按累计领用量封顶（`:129-143`）。同一函数的前两个版本在 `0042:40-41`、`0044:11-12`，口径相同 |
| D2  | 成本计算前置（触发器）       | `SELECT count(*) INTO missing FROM manufacturing_bom_lines l JOIN manufacturing_bom_versions b … WHERE b.tenant_id=… AND b.product_item_version_id=(SELECT item_version_id FROM production_orders …) AND b.status='PUBLISHED' AND NOT EXISTS(… production_cost_policy_material_rates x … x.item_version_id=l.component_item_version_id); IF missing>0 THEN RAISE EXCEPTION 'manufacturing cost policy is missing BOM material rates';` —— `0048_actual_manufacturing_cost.sql:39-48`                                                                                                                                  | **并集口径**：工单必须 `COMPLETED`（`:41-42`）；该成品版本下**所有**已发布 BOM 版本的全部行，都必须在成本政策里有费率。                                                                                                                                                |
| D3  | 完工门禁                     | `IF NEW.state='COMPLETED' … count(*) FILTER(WHERE coalesce(r.good,0)<o.planned_quantity) … IF incomplete IS NULL OR incomplete>0 THEN RAISE EXCEPTION 'production completion requires planned good quantity at every operation';` —— `0042_production_execution_integrity.sql:22-25`                                                                                                                                                                                                                                                                                                                                  | **与 BOM 无关**：只看每道工序累计良品是否达到计划数量。关闭门禁看成品卷数量（`0042:26-29`）与已批准成本（`0048:62-67`）。                                                                                                                                              |
| D4  | 关闭前必须有已批准成本       | `require_approved_cost_before_close()`：`CLOSED` 时要求该工单存在 `APPROVED` 的成本计算 —— `0048:62-67`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 关闭**间接**依赖 BOM：成本算不出来就关不了工单。                                                                                                                                                                                                                       |

### 1.3 API 里按「已发布 BOM」取数或判断的位置

| #   | 位置                            | SQL / 代码                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 语义                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 工单详情·物料需求与分配四态     | `WITH chosen_bom AS(SELECT b.id,b.output_quantity FROM manufacturing_bom_versions b JOIN production_orders o ON o.tenant_id=b.tenant_id AND o.item_version_id=b.product_item_version_id WHERE o.tenant_id=$1 AND o.id=$2 AND b.status='PUBLISHED' ORDER BY b.published_at DESC LIMIT 1)` —— `apps/api/src/production-read-repositories.ts:180-200`（`chosen_bom` 在 `:183-185`）                                                                                    | **单选口径（下称规则 P）**：同一成品版本下**所有 BOM 根**的已发布版本里，`published_at` 最新的一条。不过滤 `effective_at`；**没有并列次序键**。需求 = `trunc(行用量×(1+损耗基点/10000)×计划数量/产出量,6)`（`:190`、`:192`）；已领 = 台账净额（`:186-188`、`:191`）；四态 `NOT_ISSUED / PARTIAL / ISSUED / OVER_ISSUED`（`:192`）。由 `findProductionOrder` 调用，按 `bom:read` 门控（`:138-148`；路由 `apps/api/src/routes/fastify/production-orders.ts:233-235`）                                                   |
| A2  | 实际成本·材料计划用量与实际金额 | 同一 `chosen_bom`（逐字相同的规则 P）—— `apps/api/src/production-cost-repositories.ts:123-125`；行项 `:132-138`                                                                                                                                                                                                                                                                                                                                                     | 计划材料 = 冻结 BOM 行 × 政策费率（`:172-175`）。**实际材料只累计「所选 BOM 行上的组件」**（`:176-179`，按 `item_version_id` 去重）：不在所选 BOM 里的领料不进实际材料成本。与政策费率是内连接（`:136`），缺费率的行在应用层被静默丢掉，但 D2 触发器会先拦下整笔计算。`calculation_trace.formulaVersion='KT-L17-V1.1-BOM-OUTPUT'`（`:192-199`）；`canonical_hash` 覆盖 `{ input, material, labor, trace, values }`（`:229`）。每张工单只能有一笔成本计算（`0048:24` `UNIQUE(tenant_id,production_order_id)`）且不可改 |
| A3  | 领料前置 409（TD-MFG-010）      | `assertIssueComponent`：`EXISTS(… JOIN manufacturing_bom_versions b ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED' JOIN manufacturing_bom_lines l … WHERE … l.component_item_version_id=$3) component`，`active=true AND component=false` 时抛 `DomainError('conflict','该批次物料不属于工单 BOM')` —— `apps/api/src/production-repositories.ts:161-188`（SQL `:178-182`，抛出 `:186-187`）；调用点 `:207-208` | **并集口径**（与 D1 同一口径）。只对 `ISSUE` 做；工单不是 `RELEASED/IN_PROGRESS` 时不判断，交给触发器。注释明确「数据库触发器是权威」                                                                                                                                                                                                                                                                                                                                                                                 |
| A4  | MRP 计算批次输入快照            | `… FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.status='PUBLISHED' AND v.effective_at<=$2 …` —— `apps/api/src/mrp-repositories.ts:150`                                                                                                                                                                                                                                                                                                              | 全部「基准日已生效的已发布 BOM」进 `input_hash`。**与工单无关**，不随工单冻结                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A5  | MRP 展开与环检测                | `JOIN LATERAL(SELECT v.id FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.product_item_version_id=g.item_version_id AND v.status='PUBLISHED' AND v.effective_at<=$3 ORDER BY v.effective_at DESC,v.version DESC LIMIT 1)` —— `mrp-repositories.ts:188`、`:200`                                                                                                                                                                                         | **规则 M**：基准日已生效的已发布版本里 `effective_at` 最新、再取 `version` 最大的一条。计划口径，针对需求信号，**不读工单**                                                                                                                                                                                                                                                                                                                                                                                           |
| A6  | MRP 详情·BOM 展开行             | 同规则 M —— `apps/api/src/mrp-read-repositories.ts:345-369`（`:352`、`:356`）                                                                                                                                                                                                                                                                                                                                                                                       | 只读还原；注释 `:343-344` 自述「批次不保存 BOM 快照，这里按当前已发布版本还原」。同文件的「执行工单」聚合（`:404-414`）不涉及 BOM                                                                                                                                                                                                                                                                                                                                                                                     |
| A7  | 制造主数据·BOM 详情组件树根     | `versions.find(status==='PUBLISHED') ?? versions.find(status==='DRAFT')`（版本按 `version DESC` 排列）—— `apps/api/src/manufacturing-read-repositories.ts:68-70`、`:337-350`；子节点 `publishedBomsForItems`：`DISTINCT ON (b.product_item_id) … ORDER BY b.product_item_id,b.code,v.version DESC` —— `:454-467`                                                                                                                                                    | **规则 T**：同根最高版号的已发布版本；下层按**产品根**（不是物料版本）取编码最小的 BOM 的最高已发布版本。主数据展示，不读工单                                                                                                                                                                                                                                                                                                                                                                                         |

**结论：仓库里并不存在唯一的「当前已发布 BOM」规则。** 至少有三套并存：

- 规则 P（工单详情、实际成本）：`published_at DESC` 取一条，跨根，不看生效日。
- 并集（领料守卫 D1/A3、成本前置 D2）：同一成品版本下所有已发布版本的行的并集。
- 规则 M（MRP）与规则 T（主数据树）：按 `effective_at`/`version`。

任务书说的「领料守卫和成本计算按当前已发布 BOM 动态选取」需要按上表细分：成本计算是规则 P；领料守卫是并集，**发布后继 BOM 只会让可领范围变大，不会变小**（旧版本仍是 `PUBLISHED`）。真正的「改版即变」发生在 A1（展示）与 A2（成本）。§1.6 用真库复现确认。

### 1.4 前端里依赖上述读结果的位置

| #   | 位置                           | 事实                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | 领退料「批次库位」候选         | `materialBatchesOf(detail, balances)`：用详情响应 `materialRequirements[].componentItemVersionId` 过滤库存批次；依据三态 `bom / no-bom / unknown` —— `apps/web/src/commercial/console/production-order-state.ts:36-48`；调用点 `production-order-actions.ts:193`。**候选范围完全由 A1 决定**，前端自己不查 BOM                                                                          |
| W2  | 候选范围说明文案               | `basis==='bom'`：「批次库位只列出属于本工单 BOM 的库存批次。」/「本工单 BOM 内的物料当前没有库存批次，暂时无法领料。」；`'no-bom'`：「该成品没有已发布的 BOM，没有可领的批次；领料会被拒绝。」；`'unknown'`：列出全部并说明会被拒绝 —— `apps/web/src/commercial/console/production-order-execution-forms.tsx:137-146`；领料表单描述 `:34`「…只能领用已放行且属于工单 BOM 的批次物料。」 |
| W3  | 详情抽屉「物料需求与分配」分区 | 每行 `sku / itemName / 需求 / 已领 / 四态徽章`；空列表文案「该成品暂无已发布 BOM，无法给出物料需求」—— `apps/web/src/commercial/console/production-order-detail.tsx:319-348`（空文案 `:345`），挂载 `:528`。**抽屉里没有任何位置显示工单用的是哪一份 BOM**                                                                                                                              |
| W4  | 行投影自动带出工单全部列       | `PRODUCTION_ORDER_PROJECTION = to_jsonb(o)                                                                                                                                                                                                                                                                                                                                              |     | …`——`production-read-repositories.ts:28-33`；legacy 列表同投影 `production-repositories.ts:32-43` | 给 `production_orders` 加列后，列表与详情根行会**自动多出这个键**，再经 `permittedDto(item, readFields)` 按读权限字段裁剪（路由 `production-orders.ts:215-216`、`:246`）。响应 schema 是 `looseObject(...).partial()`（`:70-94`），新键不会被过滤 |

### 1.5 既有测试与夹具

| 测试                    | 位置                                                                                                | 是否执行真实 SQL                                                                                                                       | 与本设计的关系                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 冻结轨迹 f3（311 例）   | `apps/api/test/app-batch4-preservation.test.ts`；探针 `scripts/analysis/app-preservation-probe.mjs` | **否**。仓储是 `Proxy` 假对象（探针 `:255-314`），方法调用只记 `['call', 仓储, 方法, 实参]`，响应是固定的 `success` 对象               | 只对分派层敏感：依赖访问顺序、调用实参、假响应。工单场景 `GET`/`POST /api/v1/production-orders` 已在「响应 + 终止仓储调用」比对集里（`:147-150`）。仓储里的 SQL 与行形状**到不了** f3                                                                                                |
| 旧分派源码保真（28 例） | `apps/api/test/dispatch-source-preservation.test.ts`                                                | **否**。把 `apps/api/src/routes/dispatch/*.ts` 的 TypeScript 逐 token 逆展开，与冻结夹具 `test/fixtures/app-batch4-f3.ts.fixture` 对拍 | 24 个分派组（`fixtures/app-dispatch-groups.json`，其中 `production` 组对应 `dispatch/production.ts`）加 4 条附加断言。只要不改 `routes/dispatch/*.ts` 就不受影响                                                                                                                     |
| 工单只读真库契约        | `apps/api/test/production-read-postgres.integration.test.ts`                                        | 是（`ownedPostgres` 独占 schema，全量迁移）                                                                                            | 直接断言本设计要改的 SQL 的输出：物料需求逐字段（`:543-558`、`:583-590`）；根行与 legacy 列表逐字节（`:368-375`、`:469-470`）；门控关闭时执行到的 SQL 不含 `manufacturing_bom`、开启时恰有一条含 `manufacturing_bom_lines`（`:621-643`）；真实仓储输出过 Fastify schema（`:651` 起） |
| 工单执行真库            | `apps/api/test/production-execution-postgres.integration.test.ts`（613 行）                         | 是                                                                                                                                     | 含 TD-MFG-010 的领料守卫用例（`:20`、`:250`、`:436`）；在草稿副本上随草案重跑，不改断言 9/9 通过（§5.6）                                                                                                                                                                             |
| 工单写路径真库          | `apps/api/test/production-postgres.integration.test.ts`（1,038 行）                                 | 是                                                                                                                                     | 建单、流转、物料、报工、入库；在草稿副本上不改断言 10/10 通过（§5.6）                                                                                                                                                                                                                |
| 制造续写真库            | `apps/api/test/manufacturing-versions-postgres.integration.test.ts`（399 行）                       | 是                                                                                                                                     | 含「发布后继版本后旧工单仍指向原物料与工艺路线版本」的引用测试                                                                                                                                                                                                                       |
| 迁移测试                | `packages/database/test/migrations.test.ts`                                                         | 是                                                                                                                                     | 钉定最后一条迁移名（`:128`）；`:82-100` 是「新迁移 = 旧守卫只放开一条规则」的机械比对先例                                                                                                                                                                                            |
| Fastify 契约            | `apps/api/test/fastify/production-orders.test.ts`、`production-order-execution.test.ts`             | 否（仓储替身）                                                                                                                         | 钉定创建请求体 8 字段与响应 schema                                                                                                                                                                                                                                                   |
| 真库夹具                | `apps/api/test/fixtures/owned-postgres.ts`                                                          | —                                                                                                                                      | 独占 schema、全量迁移、两租户两员工；也是 §1.6 复现的底座                                                                                                                                                                                                                            |
| 演示种子                | `scripts/seed_p1_demo.mjs`                                                                          | 经 HTTP                                                                                                                                | 所有制造版本的 `effectiveAt` 都是常量 `2026-01-01T00:00:00.000Z`（`:324`、`:481`、`:568`、`:644`、`:678`、`:701`、`:868`、`:980`）                                                                                                                                                   |

在未改动的 `4a93003` 工作树上实跑这两套冻结测试：`app-batch4-preservation.test.ts` 311/311、`dispatch-source-preservation.test.ts` 28/28。

### 1.6 真库复现

**环境**。专用容器 `w2-mfg016-design-pg`（PostgreSQL 17.7），库 `w2_mfg016_design_test`。探针用仓库自己的 `ownedPostgres` 夹具开一个独占 schema 并跑完全部 77 条迁移，直接调用 `4a93003` 的真实仓储类（`PostgresManufacturingRepository`、`PostgresProductionRepository`、`PostgresProductionCostRepository`），**没有改任何代码**；结束时删除 schema。可领范围的探测全部在事务内执行后回滚，不留台账。探针脚本与原始输出在 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg016-design-artifacts/probes/repro.mjs`、`repro-output.txt`（仓库外的持久目录；要点已全部抄录在下）。

**夹具**。成品 `FG-PROBE`；物料 `RM-A` 草纱、`RM-B` 底布、`RM-C` 乳胶、`RM-S` 草纱替代料、`RM-X` 无关物料。`BOM-PROBE` 第 1 版（已发布，生效日期 2026-01-01）：A 1000（替代料 S，换算系数 1）、B 500，产出 1000。单工序工艺。计划数量 1000。

**按主协调要求构造的情形**：同一物料版本下发布后继 BOM。第 2 版 = A 1200 + C 300，去掉 B，生效日期填 2027-01-01（未来）。

| 观察项                                  | 发布第 2 版**之前**                                           | 发布第 2 版**之后**                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 规则 P 选中的版本（工单详情、实际成本） | 1                                                             | **2**                                                                                                                                         |
| 规则 M 选中的版本（MRP，基准日 = 当前） | 1                                                             | 1                                                                                                                                             |
| `WO-1`（进行中，已领 A 100）物料需求    | A：需求 1000、已领 100、部分领料；B：需求 500、已领 0、未领料 | A：需求 **1200**、已领 100、部分领料；**C：需求 300、已领 0、未领料；B 那一行消失**                                                           |
| `WO-1` 可领 A / B / C / S / X           | 可 / 可 / 拒 / 拒 / 拒                                        | 可 / 可 / **可** / 拒 / 拒                                                                                                                    |
| 完工门禁                                | —                                                             | `WO-C2`（按第 1 版领料）在第 2 版发布后完工成功，状态 `COMPLETED`                                                                             |
| 成本前置触发器                          | `WO-C1` 用政策 P1（A=5、B=4）计价成功                         | `WO-C2` 用同一政策 P1 计价被触发器拒绝：`P0001 manufacturing cost policy is missing BOM material rates`；换含 C 费率的政策 P2 才成功          |
| 成本金额                                | `WO-C1`：计划材料 7000，实际材料 7000                         | `WO-C2`（实际领用 A 1000、B 500）：计划材料 **9000**（A 1200×5 + C 300×10），实际材料 **5000**（只算 A 1000×5；已领的 B 500×4 = 2000 不计入） |

拒绝文案分两层：应用层前置 409 是「该批次物料不属于工单 BOM」；绕过应用层直接写库时触发器是 `production issue requires released BOM material`。两层结论逐项一致。

**另外四个情形**

- **并列 `published_at`**。同一事务里发布第 3、第 4 版，两版 `published_at` 完全相同（`2026-11-26T03:57:38.283Z`）。规则 P 默认执行计划返回 3，`SET enable_seqscan=off` 后仍返回 3——没能用执行计划差异复现翻转，但这条 SQL 没有次序键，返回哪一版不受保证。续版时不带 `effectiveAt`，第 3、第 4 版都原样继承了第 2 版的 2027-01-01。
- **创建时物料尚无已发布 BOM**。`WO-N` 建单后物料需求为 `[]`；此后补建的 BOM 还是草稿时领 B 被拒；草稿一发布，物料需求立刻变成 B 500，领 B 变为可领。这就是「引用为空」的工单在现行口径下的样子：跟着最新已发布版本走。
- **后继 BOM 改指物料版本 2**。给 `FG-PROBE` 建物料第 2 版并发布，再在同一 BOM 根下建第 5 版指向物料第 2 版并发布。`WO-1`（物料第 1 版）的物料需求前后逐字相等。旧工单本来匹配不到这种版本，不受影响。
- **替代料**。`RM-S` 在 BOM 里是 A 的替代料，前后都不可领：领料守卫只看组件行，不看替代料表；工单详情与成本也不展示、不计替代料。

**结论**

1. 发布后继 BOM 确实会改变在制工单：物料需求展示与实际成本的计划用量立刻切到新版（规则 P）。
2. 可领范围只会变大：守卫是并集，旧版本仍是 `PUBLISHED`。
3. 成本有两处失真：计划用量按新版算，而工单是按旧版执行的；实际材料成本把「不在所选 BOM 行上的已领料」丢掉（`WO-C2` 少算 2000）。
4. 成本前置触发器按并集要求费率：新版新增的组件只要没有费率，就能挡住一张按旧版执行完的工单的成本计算，进而挡住关闭。
5. 工单侧按 `published_at`、MRP 按 `effective_at`，两者可以选出不同的版本。

### 1.7 `effective_at` 从哪里来、谁在用

| 事实                                                                                                        | 出处                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 BOM 时 `effectiveAt` 是请求**必填**字段；路由的 `timestamp()` 只校验能解析成时间，**不限制过去或未来** | `apps/api/src/routes/fastify/manufacturing-boms.ts:305`；`apps/api/src/app-values.ts:103-109`；legacy 轨 `apps/api/src/routes/manufacturing-bom-create.ts:122` |
| 原样写入版本行                                                                                              | `apps/api/src/manufacturing-repositories.ts:155-166`                                                                                                           |
| 续版时 `effectiveAt` 可选；**不带就继承来源版本的生效日期**                                                 | 路由 `apps/api/src/routes/fastify/manufacturing-versions.ts:24-27`；仓储 `apps/api/src/manufacturing-version-repository.ts:201`                                |
| 发布只写 `status` 与 `published_at=now()`，不碰 `effective_at`；触发器禁止发布时改任何其它列                | `manufacturing-repositories.ts:278`；`0036:68-70`                                                                                                              |
| 表单：新建 BOM 的「生效日期」是日期控件、必填、默认当天（UTC 日期）；提交时归一成 `<日期>T00:00:00.000Z`    | `apps/web/src/commercial/console/bom-create.tsx:19`、`:214-220`；`bom-console-actions.ts:315`                                                                  |
| 续版表单预填来源版本的日期，不改就不发这个字段                                                              | `apps/web/src/commercial/console/manufacturing-version-ui.tsx:23-26`；`bom-console-actions.ts:283`                                                             |
| BOM 列表有「生效日期」列                                                                                    | `apps/web/src/commercial/console/bom-console.tsx:116-122`                                                                                                      |
| MRP 以它做生效门槛与首要排序键                                                                              | `apps/api/src/mrp-repositories.ts:150`、`:188`、`:200`；`mrp-read-repositories.ts:352`、`:356`                                                                 |
| 工单侧（规则 P）、领料并集、主数据树（规则 T）都不看它                                                      | `production-read-repositories.ts:183-185`；`production-cost-repositories.ts:123-125`；`0072:95-104`；`manufacturing-read-repositories.ts:68-70`、`:462`        |

**判断**：`effective_at` 是用户填写、按日粒度的业务生效日期，与发布时刻（事务时间戳）相互独立——续版默认继承旧日期，用户也可以填未来日期。它不是「恒等于发布时间」。系统里只有 MRP 把它当作生效日期使用；工单侧完全忽略它。§1.6 的对照（规则 P 选 2、规则 M 选 1）就是两者分叉的样子。

## 2. 目标模型

### 2.1 工单上的 BOM 版本引用

```sql
ALTER TABLE production_orders ADD COLUMN bom_version_id uuid;
ALTER TABLE production_orders
  ADD CONSTRAINT production_order_bom_version_fk
  FOREIGN KEY(bom_version_id,tenant_id) REFERENCES manufacturing_bom_versions(id,tenant_id);
```

- 可空。按裁定**不回填**：既有工单一律是 `NULL`。
- 复合外键带 `tenant_id`，与工单现有两条外键同一写法（`0041:9-10`），保证引用不跨租户。外键可为 `NULL`，所以不强制每张工单都有引用。
- 锁与耗时：加列是元数据操作；加外键会对 `production_orders` 取 `SHARE ROW EXCLUSIVE` 锁并全表校验一遍（全部是 `NULL`，立即通过）。表为空或很小时可以忽略；表很大时拆成 `NOT VALID` 再 `VALIDATE`（待核实现网行数）。

### 2.2 引用由服务端在建单时写入

- **创建端点的请求体不扩**：仍是现有 8 个字段（`production-orders.ts:255-264`、`production-order-create.ts:44-53`）。调用方不能挑 BOM——这是工单自己的执行依据。
- 仓储方法签名 `create(input, context, correlationId)` 不变，路由与分派层零改动。
- 引用在**同一条 `INSERT` 里**由子查询选出并写入（当前语句在 `production-repositories.ts:64-65`）：

```sql
INSERT INTO production_orders(tenant_id,order_number,item_version_id,routing_version_id,bom_version_id,mrp_proposal_id,planned_quantity,planned_start_at,planned_due_at,source_reference,created_by,canonical_hash)
SELECT $1,$2,$3,$4,(<选取子查询>),$5,$6,$7,$8,$9,$10,$11
WHERE EXISTS(SELECT 1 FROM manufacturing_routing_versions r WHERE r.tenant_id=$1 AND r.id=$4 AND r.product_item_version_id=$3 AND r.status='PUBLISHED')
RETURNING id,bom_version_id
```

- **选取结果为空就写 `NULL`**（该成品版本当时没有任何已发布 BOM，或在 §2.4 的规则 E 下没有任何一版已生效）。建单照常成功，之后走 §3 的回退规则。`NULL` 不是错误，也不阻止下达。
- `canonical_hash` 仍是对 8 字段载荷取哈希，第 1 条事件的 `evidence` 也不变：引用不是请求的一部分，不进载荷哈希。
- 创建响应的形状本批不变（`{ id, state, operationCount, ...input }`，`production-repositories.ts:106-111`）。引用可以从列表与详情根行读到（`to_jsonb(o)` 自动带出，见 §1.4 的 W4）。

**并发**。选取与写入在同一条语句里，`READ COMMITTED` 下这条语句看到的是语句开始时已提交的数据（`packages/database/src/index.ts:41-54` 没有改隔离级别）。与建单并发、尚未提交的发布对它不可见，工单钉在上一版；发布提交后工单不受影响。被选中的版本在语句快照里已经是 `PUBLISHED`，而已发布版本不能退回草稿，所以不存在「钉到一半又变草稿」的窗口。不需要额外的锁。

### 2.3 约束怎么保证

要保证的只有一句：**引用非空时，它指向的 BOM 版本必须是已发布，且 `product_item_version_id` 等于本工单的 `item_version_id`**。

| 手段                                                                                                                                                                                                                                 | 保证什么                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 复合外键（§2.1）                                                                                                                                                                                                                     | 引用存在、同租户                                                                                             |
| `BEFORE INSERT` 触发器（下）                                                                                                                                                                                                         | 已发布、产品版本匹配                                                                                         |
| 既有 `production_order_immutable`（`0041:101-102`）                                                                                                                                                                                  | 工单行写入后任何 `UPDATE`/`DELETE` 都抛错——引用天然不可改、不可清。**冻结不需要新守卫**                      |
| 已发布版本自身不可变：状态只能 `DRAFT → PUBLISHED`（`0036:66-67`）、发布不能改内容（`0036:68-70`）、组件行与替代料不能改不能删（`0036:95-97`）；**0078** 起不能往已发布版本里**插入**子行；**0079** 起组件必须全部已发布才能发布 BOM | 被引用的那一版及其行项在引用期间不会变。**0078 是本设计成立的前提**：没有它，「冻结」的 BOM 仍可被追加组件行 |

```sql
CREATE FUNCTION validate_production_order_bom_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bom_version_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM manufacturing_bom_versions b
    WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.bom_version_id
      AND b.status='PUBLISHED' AND b.product_item_version_id=NEW.item_version_id) THEN
    RAISE EXCEPTION 'production order BOM version must be a published BOM for the order item version';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_order_bom_version_guard
  BEFORE INSERT ON production_orders FOR EACH ROW
  EXECUTE FUNCTION validate_production_order_bom_version();
```

**为什么用触发器而不只是建单事务里的校验加外键**。工单行只写一次，插入时的检查就覆盖了它的整个生命周期，不会漏掉之后的变更。放在库里，种子脚本、测试夹具和任何绕过仓储的直接写入也受同一约束——仓库里已有「数据库触发器是权威」的约定（`production-repositories.ts:168`）。只做应用层校验的代价是：直接写库可以引用一个草稿版本，而草稿的行还能改，「冻结」就名不副实。若所有者倾向少加触发器，退一步用「建单事务内校验 + 外键」也能让 API 路径正确，但保护面只在 API 路径内。

**迁移顺序**。0082 排在 0078、0079 之后，迁移按文件名顺序逐个事务执行（`packages/database/src/index.ts:162-174`），前提自动成立。

### 2.4 创建时取哪一版（M16-Q-2）

候选集在两种方案下相同：`manufacturing_bom_versions` 里 `tenant_id` 是本租户、`product_item_version_id` 等于工单 `item_version_id`、`status='PUBLISHED'` 的全部版本——**跨 BOM 根**，与今天规则 P 的范围一致。

**方案 A（未采纳，留作对照）：沿用 `published_at`，补上并列次序键**

```sql
SELECT b.id FROM manufacturing_bom_versions b
WHERE b.tenant_id=$1 AND b.product_item_version_id=$3 AND b.status='PUBLISHED'
ORDER BY b.published_at DESC,b.version DESC,b.id LIMIT 1
```

**方案 E（所有者裁定采用，M16-Q-2）：按生效日期取「建单时刻已生效的最新一版」**

```sql
SELECT b.id FROM manufacturing_bom_versions b
WHERE b.tenant_id=$1 AND b.product_item_version_id=$3 AND b.status='PUBLISHED' AND b.effective_at<=now()
ORDER BY b.effective_at DESC,b.published_at DESC,b.version DESC,b.id LIMIT 1
```

两个方案的并列次序键都是全序（最后落到主键 `id`）：同根取版号高的，同日取最近发布的，再相同按主键。方案 E 的次序链在「所有版本生效日期相同」时与方案 A 完全等价——演示种子与全部测试夹具正是这种情况（常量 2026-01-01）。

两个方案的差别只在两处：最新发布的那一版生效日期在未来（方案 A 立刻选它，方案 E 选上一版）；较晚发布的版本生效日期反而更早（方案 A 选它，方案 E 选生效日期最晚的那版）。

**定稿：采用方案 E。** 候选集加上 `effective_at <= 建单时刻`，按 `effective_at DESC, published_at DESC, version DESC, id` 取第一条；候选集为空写 `NULL`。

并列次序键的含义：生效日期最新；同一天取最近发布的；再相同取版号高的；最后落到主键。四段下来是全序，选到哪一版不依赖执行计划。

**与建议的差异：无。** 中断前落盘的 §2.4 只并列给出了两个方案，没有写明倾向；当时的分析结论是「`effective_at` 是有业务含义的生效日期，就取方案 E」，依据是 §1.7 的来源与 §1.6 里规则 P 与规则 M 的分叉。裁定与此一致。

**这是一项行为变更，须登记并单独提交。** 相对今天的规则 P，新建工单在两种情形下会钉到不同的版本：最新发布的那一版生效日期在未来（今天立刻选它，现在选上一版已生效的）；较晚发布的版本生效日期反而更早（今天选它，现在选生效日期最晚的那版）。所有版本生效日期相同时两个方案等价——演示种子与全部测试夹具正是这种情况。

裁定没有覆盖的一个边界列在 M16-Q-3：建单时**没有任何一版已生效**。按本设计此时写 `NULL`，随后走回退规则 P，结果与今天相同。

## 3. 全部消费方切换到冻结引用

### 3.1 三列表：消费方 × 引用为空 × 引用存在

「引用为空」有两种来源，规则相同：迁移之前建立的历史工单；迁移之后建单时选取结果为空的工单（§2.2）。

| 消费方                              | 引用为空时（现状，逐字不变）                                                                 | 引用存在时                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A1 工单详情·物料需求与分配          | 规则 P：`ORDER BY b.published_at DESC LIMIT 1`（`production-read-repositories.ts:183-185`）  | 冻结版本的行与产出量。需求公式、已领口径、四态都不变              |
| A2 实际成本·计划与实际材料          | 规则 P（`production-cost-repositories.ts:123-125`）                                          | 冻结版本。公式与 `calculation_trace` 不变                         |
| D2 成本前置触发器                   | 并集：该成品版本下所有已发布版本的行都要有费率（`0048:43-45`）                               | 只要求冻结版本的行都有费率                                        |
| D1 领料守卫触发器                   | 并集（`0072:95-104`）                                                                        | 只允许冻结版本的组件行（M16-Q-1，已裁）                           |
| A3 领料前置 409                     | 并集（`production-repositories.ts:178-182`）                                                 | 与 D1 同一口径、同一条文案                                        |
| D3 完工门禁                         | 与 BOM 无关（`0042:22-25`）                                                                  | 不变                                                              |
| D4 关闭门禁                         | 须有已批准成本（`0048:62-67`）                                                               | 不变；间接经 A2、D2 用到冻结版本                                  |
| A4–A6 MRP 输入快照、展开、详情      | 规则 M（`mrp-repositories.ts:150`、`:188`、`:200`；`mrp-read-repositories.ts:352`、`:356`）  | 不变——不读工单                                                    |
| A7 BOM 详情组件树                   | 规则 T（`manufacturing-read-repositories.ts:68-70`、`:462`）                                 | 不变                                                              |
| W1、W2 领退料「批次库位」候选与说明 | 跟随 A1（`production-order-state.ts:36-48`；`production-order-execution-forms.tsx:137-146`） | 跟随 A1。候选与守卫从此一致（今天候选只列最新版、守卫却接受并集） |
| W3 详情抽屉「物料需求与分配」       | 跟随 A1（`production-order-detail.tsx:319-348`）                                             | 跟随 A1；是否显示冻结的是哪一版见 M16-Q-6                         |

### 3.2 逐条改法

**(1) A1** `production-read-repositories.ts:183-185`，(2) **A2** `production-cost-repositories.ts:123-125`。两处是同一段 `chosen_bom`，做同一处改动：

```sql
-- 改前
WITH chosen_bom AS(
  SELECT b.id,b.output_quantity FROM manufacturing_bom_versions b JOIN production_orders o ON o.tenant_id=b.tenant_id AND o.item_version_id=b.product_item_version_id
  WHERE o.tenant_id=$1 AND o.id=$2 AND b.status='PUBLISHED' ORDER BY b.published_at DESC LIMIT 1)
-- 改后
WITH chosen_bom AS(
  SELECT b.id,b.output_quantity FROM manufacturing_bom_versions b JOIN production_orders o ON o.tenant_id=b.tenant_id AND o.item_version_id=b.product_item_version_id
  WHERE o.tenant_id=$1 AND o.id=$2 AND b.status='PUBLISHED'
    AND b.id=coalesce(o.bom_version_id,(
      SELECT d.id FROM manufacturing_bom_versions d
      WHERE d.tenant_id=o.tenant_id AND d.product_item_version_id=o.item_version_id AND d.status='PUBLISHED'
      ORDER BY d.published_at DESC LIMIT 1)))
```

- 引用为空：子查询就是原来的规则 P，`ORDER BY d.published_at DESC LIMIT 1` 原样保留，不加次序键。选出同一行。
- 引用存在：取冻结版本。`status='PUBLISHED'` 与产品版本匹配对冻结路径是恒真的（插入触发器保证过，之后不可变），留着是纵深防御。
- 该文件 `:621-643` 的既有断言（门控开启时恰有一条语句含 `manufacturing_bom_lines`）仍成立。

**(3) A3** `production-repositories.ts:178-182`、**(4) D1** `0072:95-104`、**(5) D2** `0048:43-45`。三处今天是「并集」谓词，改成按 `o.bom_version_id IS NULL` 分成互斥的两支，空支里的并集原样照抄。D1 的新块：

```sql
    SELECT o.bom_version_id INTO frozen_bom FROM production_orders o
    WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
    IF frozen_bom IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM manufacturing_bom_lines l
        WHERE l.tenant_id=NEW.tenant_id AND l.bom_version_id=frozen_bom
          AND l.component_item_version_id=NEW.item_version_id
      ) INTO bom_component;
    ELSE
      SELECT EXISTS(
        SELECT 1
        FROM production_orders o
        JOIN manufacturing_bom_versions b
          ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED'
        JOIN manufacturing_bom_lines l
          ON l.tenant_id=b.tenant_id AND l.bom_version_id=b.id
        WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id
          AND l.component_item_version_id=NEW.item_version_id
      ) INTO bom_component;
    END IF;
```

`DECLARE` 段加 `frozen_bom uuid;`。函数其余部分（状态门、质量门、移动匹配、退料封顶、`production_material_guards` 的修订行）一字不动。A3 做同形的分支；D2 把「缺费率的行数」同样分成两支。

D1 与 D2 都是 `CREATE OR REPLACE` 整个函数。照 `0076`、`0077` 的先例（`packages/database/test/migrations.test.ts:82-100`），在迁移测试里做机械比对：新函数全文 = 旧函数全文，只把那一段并集查询换成上面的块。

**(6) 不改**：A4–A7、D3、D4，以及 `apps/api/src/routes/dispatch/*.ts`、`app.ts`、Fastify 路由注册。

### 3.3 并列次序键的取舍

- **创建时的选取**（§2.4）带确定性次序键。新工单钉到哪一版不依赖执行计划。
- **回退路径不加次序键**。引用为空的工单必须与今天逐项一致，包括今天在并列情形下的不确定性。顺手加键是行为变更：并列的历史工单可能被换成另一版。§1.6 的并列情形在现实中只出现在同一事务发布多版时，生产上应为零（待核实）。
- 代价是回退支的 SQL 必须逐字照抄，靠机械比对与评审核对，而不是「顺手统一」。

### 3.4 本来就不受影响的情形

- **后继 BOM 改指物料版本 2**：候选集按 `product_item_version_id = 工单 item_version_id` 匹配，物料版本 1 的工单看不到它（§1.6 实测前后逐字相等）。
- **续版草稿与已发布版并存**：草稿不在候选集里（`status='PUBLISHED'` 过滤）。草稿发布是它进入候选集的时刻，只影响此后新建的工单。
- **返工与重开**：状态机没有重开，`CLOSED`、`CANCELLED` 是终态（`0042:16`）。返工只能新建工单，新工单按创建时刻另行冻结。
- **单位换算**：工单、成本、MRP 三条路径都不做单位换算，也不读替代料表；替代料的 `conversion_factor` 只在制造主数据的读写里出现。需求公式只用到行用量、损耗基点、计划数量与产出量（`production-read-repositories.ts:190`）。

### 3.5 守卫收紧的连带后果（M16-Q-1，已裁）

裁定：引用存在时，领料守卫从「所有已发布版本的组件并集」收紧为「只有冻结的那一版」；引用为空时保持并集。

- **影响面只在有引用的工单**，即迁移之后建单且选取到版本的工单。对它们：后继版本新增的组件领料被拒，应用层 409 文案不变（「该批次物料不属于工单 BOM」）；冻结版本上的组件始终可领，即使后继版本删掉了它。
- **批次候选与守卫从此一致**：候选来自 A1（冻结版本），守卫也只认冻结版本。今天是候选只列最新版、守卫接受并集。
- **实际材料成本对有引用的工单不再丢项**：它们能领的料都在冻结 BOM 的行上，而 A2 只给所选 BOM 行上的组件计价，所以「已领但不在所选 BOM 行上、不计价」对它们不可能发生。
- **「已按并集领出的后继组件如何计价」只影响引用为空的工单**——历史工单，或建单时没有任何已生效版本、之后才有的工单。有引用的工单领不到后继组件，不存在这笔账。引用为空的工单口径不变：守卫仍是并集，后继组件仍可领；展示与成本仍按规则 P 动态取最新发布的一版；一旦动态选中的版本换掉，此前按旧版领出、不在新版行上的料就不进实际材料成本（§1.6 的 `WO-C2` 少算 2000 就是今天的样子）。按所有者说明，生产上没有这类历史工单（待核实）；开发与测试库里迁移前建的工单属于这一类。

## 4. 历史工单：不回填

所有者裁定（2026-11-26，方案 A）：历史工单的 BOM 引用不回填，理由是当前处于开发阶段、生产没有实际业务单据。迁移 0082 只加可空列、外键与守卫，不对 `production_orders` 执行任何 `UPDATE`——不需要碰 `production_order_immutable`，现有工单一律是 `NULL`。这些工单的领料、成本、展示按 §3.1「引用为空」一列执行，逐项等于今天，并且一直如此。按「创建时刻已发布的最新版本重建」或「一律钉到迁移时的当前版本」两种做法，本文不展开设计。保留一句事实：列可空、回退规则已定义，日后如果真要回填，需要一份允许一次性把 `NULL` 改成具体版本的迁移（要临时放开工单行不可改）；本设计不预留这条路，也不建议走。

## 5. 实施拆批与验证

### 5.1 拆批

| 批  | 提交                                   | 内容                                                                                                                                                                                                                | 生效的行为变化                                                                                         |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0   | `docs(tracker)`                        | 台账：更新 TD-MFG-016 行；把两项行为变更（领料守卫按冻结版本收紧、创建时按生效日期取版）登记在案；M16-Q-3 至 Q-8 按 §6.2.1 处置并登记为 TD-MFG-018 至 021                                                           | 无（红线 R2：先登记）                                                                                  |
| 1   | `feat(database)`                       | 迁移 `0082_production_order_bom_version.sql`：§2.1 的列与外键、§2.3 的插入触发器、D1 与 D2 的 `CREATE OR REPLACE`；`packages/database/test/migrations.test.ts` 更新末位迁移名（`:128`），新增「只换一段」的机械比对 | 无。所有引用都是 `NULL`：插入触发器直接放行，D1、D2 走空支                                             |
| 2a  | `feat(api)`                            | `create()` 在同一条 `INSERT` 里写入引用（§2.2、§2.4 方案 E）                                                                                                                                                        | 从这一笔起，新建工单带引用：选取按生效日期（M16-Q-2）；D1 对它们收紧（M16-Q-1）；D2 对它们只看冻结版本 |
| 2b  | `feat(api)`                            | A1、A2、A3 改读引用（§3.2）                                                                                                                                                                                         | 有引用的工单，物料需求与实际成本按冻结版本                                                             |
| 3   | `feat(web)`（M16-Q-6 已裁，见 §6.2.1） | 详情抽屉显示冻结的 BOM；领退料说明文案                                                                                                                                                                              | 仅展示                                                                                                 |

- 2a 与 2b 必须同一次发布。只上 2a 时，守卫已按冻结版本收紧，而详情仍按规则 P 展示最新版，会出现「候选里有、守卫不让领」的不一致。
- 1 与 2 可以分两次发布：只上 1 时零行为变化。
- 真库测试随各批提交：先写失败用例，再改实现（R3）。
- **与并行批次的关系**：0082 必须排在 0078、0079 之后（§2.3）。并行批次的迁移文本本文未逐字核对（待核实）。若 0078 至 0081 里有任何一份重定义了 `validate_production_execution_entry` 或 `validate_production_cost_run`，0082 里这两个函数要基于**当时最新**的定义生成，机械比对以最新定义为准。

### 5.2 真库测试清单

「引用为空的工单」一律用真实路径构造：在该成品还没有任何已发布 BOM 时建单，引用自然是 `NULL`，不需要手写 SQL 模拟历史工单。

| #   | 用例                          | 构造与操作                                                                                                                                | 期望                                                                                                                                                                         |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | 领料守卫·有引用（**必备**）   | 建单（钉第 1 版）→ 放行 → 同一物料版本下发布第 2 版（新增 C、删掉 B）→ 分别领 A、B、C                                                     | A、B 成功；C 被拒，应用层 409「该批次物料不属于工单 BOM」；绕过应用层直接写库时触发器拒绝。退料不受影响                                                                      |
| T2  | 领料守卫·引用为空（**必备**） | 成品没有 BOM 时建单 → 发布第 1 版并生效 → 放行、领 A → 发布第 2 版 → 领 B、C                                                              | 都成功：空支是并集，逐字不变                                                                                                                                                 |
| T3  | 完工门禁（**必备**）          | 有引用的工单按冻结版本领料 → 发布后继版本 → 每道工序报足计划数量并入库 → 完工；再做一张少报的对照                                         | 完工成功，与 BOM 无关；少报的被拒 `production completion requires planned good quantity at every operation`；关闭仍要求已批准成本                                            |
| T4  | 实际成本（**必备**）          | 两张工单执行完全相同（领 A 1000、B 500），一张有引用、一张引用为空 → 发布第 2 版 → 各自用只含 A、B 费率的政策计价                         | 有引用的：成功，计划与实际材料都按第 1 版。引用为空的：被 `manufacturing cost policy is missing BOM material rates` 拒绝；换含 C 费率的政策后成功，按第 2 版——即 §1.6 的现状 |
| T5  | 物料没有已发布 BOM            | 给没有 BOM 的成品建单                                                                                                                     | 引用为 `NULL`，建单成功；详情物料需求为空；领料被拒。之后发布并生效一版，详情与领料按规则 P 动态出现（§1.6 阶段 4）                                                          |
| T6  | 含替代料的 BOM                | 冻结版本的 A 行带替代料 S（换算系数非 1）                                                                                                 | S 不可领，A 可领；详情与成本不出现 S（现状不变）                                                                                                                             |
| T7  | 续版草稿与已发布版并存        | 先建第 2 版草稿，再建单，再发布第 2 版                                                                                                    | 工单钉第 1 版；发布后工单的详情、可领范围、成本不变；此后新建的工单取第 2 版                                                                                                 |
| T8  | 返工与重开                    | 对已关闭工单执行 `UPDATE production_orders SET bom_version_id=…`                                                                          | 被 `production execution evidence is immutable` 拒绝；状态机无重开；返工只能新建工单并另行冻结                                                                               |
| T9  | 产出量与单位                  | 第 2 版改产出量与行用量；冻结的第 1 版产出量 1000                                                                                         | 有引用的工单需求仍按 1000 折算；路径上没有单位换算（§3.4）                                                                                                                   |
| T10 | 并发发布与建工单              | 事务甲发布第 2 版后不提交；事务乙此时建单；甲提交；再建一单                                                                               | 乙取甲提交前已生效的最新一版，甲提交后不变；甲提交后建的一单按生效日期重新取版；无锁等待、无死锁                                                                             |
| T11 | 插入守卫                      | 直接 SQL 建单，引用分别指向：草稿版本、别的物料版本的已发布 BOM、别的租户的版本、`NULL`                                                   | 前两种被触发器拒，第三种被外键拒，`NULL` 通过                                                                                                                                |
| T12 | 选取规则 E                    | (a) 最新发布的版本生效日期在未来；(b) 两版生效日期相同、发布时间不同；(c) 同一事务发布两版（`published_at` 并列）；(d) 没有任何一版已生效 | (a) 钉上一版已生效的；(b) 钉最近发布的；(c) 钉版号高的；(d) 写 `NULL`，之后走规则 P                                                                                          |
| T13 | 回退逐字不变                  | `production-read`、`production-execution`、`production-postgres` 三套既有真库测试在迁移后的库上重跑                                       | 与引用为空有关的断言不改即通过                                                                                                                                               |
| T14 | 迁移机械比对                  | `packages/database/test/migrations.test.ts`                                                                                               | 0082 里的 D1 等于 0072 版本全文只换那一段；D2 等于 0048 版本全文只换那一句                                                                                                   |

### 5.3 迁移数与末位文件名的钉定

随 0078 至 0081 落地后的最终数字一并处理，由主协调在发布批完成；发布时 `approved_suffixes` 带上 0082 的文件名。

| 位置                                                                     | 现值                  |
| ------------------------------------------------------------------------ | --------------------- |
| `scripts/prepare_release_bundle.sh:30`                                   | `len(manifest)==77`   |
| `scripts/application_release.py:116`                                     | `len(expected) == 77` |
| `tests/operations/production_preflight_test.py:262-263`                  | 77 与 `0077_…`        |
| `tests/operations/apply_migrations_rehearsal_test.py:31`、`:104`、`:156` | 77                    |
| `tests/operations/release_migration_drill_test.py:27`、`:183`            | 77                    |
| `packages/database/test/migrations.test.ts:128`                          | 末位是 `0077_…`       |
| `packages/database/test/migrations.test.ts`「只读生产迁移兼容性」用例    | 期望 77 条候选迁移    |

### 5.4 对 311 与 28 的影响预判

**冻结轨迹 f3（311 例）：预计不需要重钉。** 三条依据都已核实：

- f3 不执行任何仓储 SQL：仓储是 `Proxy` 假对象，轨迹只记调用实参与假响应（§1.5）。
- 本设计不改 `apps/api/src/routes/dispatch/*.ts`、`app.ts` 与 Fastify 路由注册。
- `create(input, context, correlationId)` 的签名与实参形状不变：请求体仍是 8 个字段，引用在仓储内部算出。

**更正一个前提。** §1.4 的 W4 说「给工单表加列后，列表与详情根行会自动多出 `bom_version_id`」。这对真实响应成立，但这个加性键**到不了 f3**——f3 的响应是固定的假对象。它也不要求路由契约改动：行 schema 是 `looseObject(...).partial()`（`production-orders.ts:70-94`），未知键原样透传；`permittedDto` 在读权限没有字段白名单时放行全部键（`apps/api/src/app-values.ts:20-29`），制造与生产读权限在迁移里的授权都不带白名单（`0036:104-107`、`0041:113-116`）。

会让 f3 需要重钉的做法，本设计都不做：给创建请求体加第 9 个字段、改 `create` 的参数、改分派文件。那样受影响的是 `POST /api/v1/production-orders` 一个场景的终止调用实参。

**旧分派源码保真（28 例）：预计不变。** 条件是不改 `routes/dispatch/*.ts`。

**真正会碰到加性键的地方**是真库测试里对工单行做逐字节或全键断言的用例。两侧都来自真实查询的断言不受影响，因为两边都带新键：`production-read-postgres.integration.test.ts:368-375`、`:469-470`，以及 `:651` 起的路由透传断言。手写期望行对象的用例要补 `bom_version_id`。

草稿副本上的实跑结果见 §5.6：上述预判得到印证。

### 5.5 发布与回滚

**发布前**

- 干净快照过 `pnpm ci:local`；§5.2 的真库用例全绿；f3 311、分派 28 不变；e2e P1。
- 确认 0078、0079 已在目标环境应用，或与本批同一次发布且排在前面（§2.3）。
- 迁移钉定按 §5.3 同步。

**应用回滚不需要回滚数据库。** 把 API 退回上一版后：

- 旧代码的 `INSERT` 不写 `bom_version_id`，新工单的引用是 `NULL`，插入触发器直接放行。
- D1、D2 遇到 `NULL` 走空支，空支就是旧函数原文，行为与迁移前相同。
- 已经带引用、尚未执行完的工单：旧代码的 A1、A2、A3 不认识引用，按规则 P 动态取数，回到今天的行为；D1、D2 对它们仍按冻结版本（触发器留在库里）。这个组合自洽（冻结版本的行 ⊆ 并集），但守卫比展示严。

**数据库回滚。** 迁移执行器只前滚（`packages/database/src/index.ts:162-174`），没有 down 脚本。本迁移不改动任何既有行，通常没有回滚它的理由。确实要撤时需要人工执行并从 `schema_migrations` 删掉该行：删插入触发器与函数、删外键与列、把 D1 与 D2 恢复成 0072 与 0048 的原文。生产上是否允许人工回滚迁移以 `docs/RELIABILITY.md` 为准（待核实，本文未读该文档）。

**上线后核对**

- `pnpm db:status` 显示 0082 已应用。
- 给一个有已生效已发布 BOM 的成品建一张工单，根行的 `bom_version_id` 非空；给没有的成品建单，是 `null`。
- 给前者发布一版后继 BOM：工单详情的物料需求不变；领后继版本新增的组件返回 409。

### 5.6 草稿副本实跑结果

为了确认设计里的 SQL 可执行、行为与预期一致，在 `/tmp` 下放了一份工作树拷贝（不含 `.git`，真实工作树未动），加入 0082 草案迁移与四处最小改动（`create()` 写引用、A1、A2、A3），在专用库上实跑。这是**一次性原型，用来验证设计，不是实现**：不含界面改动，也没有写 T10、T11 的用例。生成草案迁移、打原型补丁和探针的三个脚本在 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg016-design-artifacts/probes/`（仓库外的持久目录；全部 SQL 已抄录在 §2、§3）。

**迁移**。78 条全部应用，0082 无报错。

**行为**（§1.6 的同一个探针脚本，选取按方案 E）：

| 观察项                                                         | 结果                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 发布生效日期在未来的第 2 版之后，`WO-1`（钉第 1 版）的物料需求 | 仍是第 1 版：A 1000、B 500。未改动时这里变成 A 1200、C 300                                             |
| 此时 `WO-1` 可领 A / B / C                                     | 可 / 可 / **拒**（应用层 409 与触发器都拒）。未改动时 C 可领                                           |
| 第 2 版发布**之后**新建的 `WO-E`                               | 钉第 1 版——第 2 版尚未生效，不进候选集                                                                 |
| `WO-C2`（钉第 1 版，按第 1 版执行）用只含 A、B 费率的政策计价  | 成功，计划与实际材料各 7000。未改动时被 `manufacturing cost policy is missing BOM material rates` 拒绝 |
| 发布与第 1 版同生效日期的第 5 版后新建的 `WO-G`                | 钉第 5 版（生效日期相同时取最近发布、版号高的）                                                        |
| 成品没有 BOM 时建的 `WO-N`                                     | 引用为 `null`；补建的 BOM 发布后物料需求与可领范围动态出现，与未改动时相同                             |
| 后继 BOM 改指物料版本 2                                        | `WO-1` 的物料需求前后逐字相等                                                                          |

**既有测试**（在草稿副本上重跑）：

| 范围                | 结果                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API：9 个文件       | 443/443。含 f3 311、分派 28、`production-read` 真库 9、`production-execution` 真库 9、`production-postgres` 真库 10、制造续写真库 11、MRP 只读真库 10、Fastify 工单契约 25 与 30 |
| `packages/database` | 只有 2 例失败，都是迁移钉定：末位迁移名（`migrations.test.ts:128`）与「只读兼容性」用例里的 77 条计数                                                                            |

结论：§5.4 的预判得到印证——f3、分派与上述真库测试都不需要改断言；需要动的只有 §5.3 的迁移钉定。夹具里所有版本的生效日期相同，所以方案 E 在这些测试里与规则 P 选出同一版，这同时说明 T12 的四个分支必须用生效日期各异的专门夹具来测，现有测试覆盖不到。

## 6. 风险与未决问题

### 6.1 已裁

- **M16-Q-1 领料守卫收紧**：同意。引用存在时只允许冻结版本的组件行，引用为空时保持并集。连带后果见 §3.5。
- **M16-Q-2 创建时取哪一版**：按生效日期。取生效日期不晚于创单时刻的最新一版，并列次序键 `published_at DESC, version DESC, id`（§2.4）。

### 6.2 未决（不替所有者决定）

| 编号    | 问题                                                                                                           | 现状与本设计的处理                                                                                                                 | 建议                                                               |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| M16-Q-3 | 建单时该成品版本下没有任何一版已生效（例如唯一的已发布版本生效日期在未来）怎么办                               | 写 `NULL`，之后走回退规则 P——仍会用那版未来才生效的 BOM 执行，与今天相同。「未生效的版本不得执行」与「回退逐字不变」相抵，需要另裁 | 接受现状；要改就单独立项                                           |
| M16-Q-4 | 建单时没有可用版本、之后才有的工单，要不要在下达时补钉                                                         | 不补。回退只有一种：动态取数                                                                                                       | 本批不做                                                           |
| M16-Q-5 | 成本计算的 `calculation_trace` 是否记录所用 BOM 版本                                                           | 不记录（现状）。加上是加性改动，但会改变新计算的 `canonical_hash` 输入（`production-cost-repositories.ts:192-199`、`:229`）        | 另议                                                               |
| M16-Q-6 | 界面：详情抽屉是否显示冻结的 BOM（编码与版号）；引用为空时如何说明；建单前是否提示将冻结哪一版                 | 本设计只保证数据正确，未定文案                                                                                                     | 显示冻结版本——它是解释「为什么领不了料」的直接线索；文案请所有者给 |
| M16-Q-7 | 替代料不可领（现状：守卫、详情、成本都不看替代料表）。冻结后是否应允许按冻结版本的替代料行领用并按换算系数折算 | 不改                                                                                                                               | 另立变更，不并入本批                                               |
| M16-Q-8 | 生效日期没有校验（可填任意过去或未来日期）；BOM 详情的「当前已发布」标记也不看生效日期（规则 T）               | 不在 TD-MFG-016 范围。用户在 BOM 控制台看到的「当前」可能不是工单冻结的那一版                                                      | 登记为独立技术债                                                   |

### 6.2.1 主协调处置（2026-11-26）

呈现与技术方案归主协调；业务口径按设计建议维持现状并登记，要改由项目所有者另行裁定。

- **M16-Q-3**：接受现状——建单时没有任何一版已生效则不冻结，之后按现行动态口径执行，与今天相同。这是「创建时按生效日期取版」与「回退逐字不变」相抵的边界，登记为 TD-MFG-018。是否禁止这类工单下达、或在下达时补钉（M16-Q-4），待项目所有者裁定；本批不做。
- **M16-Q-4**：并入 TD-MFG-018，本批不做。
- **M16-Q-5**：本批不改，登记为 TD-MFG-019，另议。
- **M16-Q-6（已裁）**：详情抽屉显示冻结的 BOM（编码与版号）；引用为空时显示「未冻结，按当前已发布 BOM 执行」；建单前不加提示。随实施第 3 批交付，文案以本条为准。读侧需要加性返回 BOM 的编码与版号（现有行投影只带引用的 id）。
- **M16-Q-7**：另立变更，登记为 TD-MFG-020。
- **M16-Q-8**：登记为独立技术债 TD-MFG-021。

### 6.3 风险

| 风险                                 | 说明                                                                                                                               | 缓解                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 生效日期误填，工单冻结在非预期的版本 | 工单行不可改，冻结无法纠正                                                                                                         | 作废后重建（草稿态工单没有执行证据，重建成本低）；M16-Q-6 的界面显示让问题在建单后立刻可见 |
| 并行批次的迁移文本未核对             | 若 0078 至 0081 重定义了 D1 或 D2，0082 必须基于最新定义生成                                                                       | 生成脚本从当时最新的迁移文件取函数原文；机械比对兜底（T14）                                |
| 0078 没有先于或随本批上线            | 已发布版本仍可被追加组件行，「冻结」不成立                                                                                         | 发布顺序检查（§5.5）                                                                       |
| 回退支被顺手「统一」                 | 历史工单的行为被改变                                                                                                               | 空支逐字照抄；T13；评审核对                                                                |
| 创建规则与回退规则从此不同           | 有引用的按生效日期，引用为空的按发布时间。生产无历史单据；开发与测试库里迁移前建的工单、以及建单时无已生效版本的工单会体现这个差别 | 在台账里写明这是裁定的结果，不是遗漏                                                       |
| 外键加锁                             | 表很大时 `SHARE ROW EXCLUSIVE` 会阻塞工单写入                                                                                      | 现网行数待核实；很大时拆成 `NOT VALID` 加 `VALIDATE`                                       |

### 6.4 待核实清单

- 并行批次 0078、0079、0080、0081 的迁移文本（本文按任务书给定的语义引用）。
- 现网 `production_orders` 行数；并列 `published_at` 的已发布 BOM 版本组数（应为 0）。
- 是否有角色对 `production:read` 设了字段白名单（迁移里没有；后台配置的待核实）。设了的角色看不到 `bom_version_id`。
- `scripts/seed_p1_demo.mjs`、`scripts/verify_p1_demo.mjs` 与 e2e 脚本是否对工单行的键做精确断言。
- 生产是否允许人工回滚迁移（`docs/RELIABILITY.md`，未读）。
