# MFG-7 制造主数据版本续写

开工基线为获准使用的第九次发布候选 `5d93c46716647e1ac66979896e8bc41bae246034`。交验前对齐 main `08725bafcffc372a73bbad62b85d77f3d18d192c`，本次 rebase 上游只改文档，应用树与 rebase 前逐文件一致。分支 `feat/mfg-7-version-continuation`，工作树 `/tmp/mfg7-wt`，隔离 PostgreSQL 端口 5449。R2 对应 `TD-MFG-001`。BOM 已发布与较新草稿并存的详情读契约对应 `TD-WEB-017`。

## 设计

### 1. 发布与当前版本

`manufacturing-repositories.ts` 的 `publish` 只更新指定租户、指定 ID 且状态为 `DRAFT` 的版本行，将状态和时间设为 `PUBLISHED` 与 `now()`。迁移 `0036` 对同根版本号设唯一约束，没有限制一个根只能有一个 `PUBLISHED` 行。`validate_manufacturing_publish` 只允许单行 `DRAFT → PUBLISHED`，不允许改写内容或事后退休旧行。BOM 发布还检查产品、组件与替代料，工艺路线发布检查产品已发布和工序存在。旧触发器对 BOM 组件发布检查的实际基数另见待登记事项。

在已应用基线迁移的 PostgreSQL 17 上用三类现有发布 UPDATE 各发布两次，均得到 `v1=PUBLISHED, v2=PUBLISHED`。尝试退休旧物料版本和修改已发布工序分别触发 `P0001`。取证事务回滚。脚本 `/tmp/mfg7/publish-design.sql`，回执 `/tmp/mfg7/logs/publish-design.log`。

制造详情的「当前已发布（本页）」定义为同根最高版本号的 `PUBLISHED` 行，直接由现有 `versions` 的版本号和状态计算。BOM 组件树取最高已发布版本，纯草稿时取最新草稿。真库回归用续写 API 造出不同用量的较新草稿，断言发布前组件树与旧树完全相等，发布后才选中新版。MRP 按 `effective_at`、`version` 选取基准日可用 BOM，工单、成本与 MRP 的选择规则由相应域负责。

### 2. 草稿内容与来源

三个新增 POST 均必定插入草稿。缺省来源是同根同租户最大版本号行，显式 `copyFromVersionId` 必须属于同一根，外租户与其他根同样返回未找到。版本字段中只覆盖本次显式给定的字段。根级 SKU、名称、类型、基本单位、编码和产品根不由续写命令更改。BOM 和工艺路线可指定同产品根的 `productItemVersionId`。

物料规格 JSON 按字段整体替换。BOM `lines` 和路线 `operations` 也按完整数组整体替换，省略时从来源复制。BOM 行号、替代料优先级和换算系数，以及工序号、顺序和指令 JSON 均保留。新子行分配新 ID，保留原来指向的物料版本 ID。前端以打开的版本为来源预填既有编辑器，发送明确的来源和编辑后的字段。发布复用原确认及端点。草稿已保存后继续编辑以该草稿再起一版，沿用现有版本行 UPDATE 仅允许发布的约束。

### 3. 编号、并发与幂等

每根 `MAX(version)+1`。不同幂等键并发竞争时由 `manufacturing_item_versions_tenant_id_item_id_version_key`、`manufacturing_bom_versions_tenant_id_bom_id_version_key` 或 `manufacturing_routing_versions_tenant_id_routing_id_version_key` 仲裁。调用点使用 `isUniqueViolation` 对实际约束名精确匹配，返回中文 409。失败事务不留下草稿、子行、幂等回执或证据。

使用既有 `Idempotency-Key` 头解析及 `command-results.ts`。同租户同键事务锁约束重放，键绑定命令、根、操作者和规范化请求散列，成功后保存首次响应。不同键不按根串行。草稿创建与审计、outbox、回执在同一事务完成。

### 4. 引用完整性

基线 PostgreSQL `pg_constraint` 中指向三张版本表的外键如下。每条都包含 `tenant_id`。续写分配新主键，不更新来源版本、来源子行或任何引用方。

| 被引用版本表                     | 引用表与字段                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manufacturing_item_versions`    | `manufacturing_bom_versions.product_item_version_id`、`manufacturing_bom_lines.component_item_version_id`、`manufacturing_bom_substitutes.substitute_item_version_id`、`manufacturing_routing_versions.product_item_version_id`                                                                                                                                                          |
| 同上                             | `supplier_item_qualifications.item_version_id`、`procurement_rfq_lines.item_version_id`、`purchase_order_lines.item_version_id`、`inventory_lots.item_version_id`、`inventory_movements.item_version_id`                                                                                                                                                                                 |
| 同上                             | `mrp_planning_policies.item_version_id`、`mrp_demand_signals.item_version_id`、`mrp_demand_snapshots.item_version_id`、`mrp_item_calculations.item_version_id`、`mrp_proposals.item_version_id`                                                                                                                                                                                          |
| 同上                             | `production_orders.item_version_id`、`production_material_transactions.item_version_id`、`production_rolls.item_version_id`、`quality_inspection_plans.item_version_id`、`production_cost_policy_material_rates.item_version_id`、`cost_specification_models.product_item_version_id`、`cost_specification_factors.source_item_version_id`、`production_material_guards.item_version_id` |
| `manufacturing_bom_versions`     | `manufacturing_bom_lines.bom_version_id`                                                                                                                                                                                                                                                                                                                                                 |
| `manufacturing_routing_versions` | `manufacturing_routing_operations.routing_version_id`、`production_orders.routing_version_id`                                                                                                                                                                                                                                                                                            |

目录查询共返回 25 条版本外键，其中物料 22 条、BOM 1 条、工艺路线 2 条。完整约束名见 `/tmp/mfg7/logs/design-catalog.log`。工单直接固定物料和工艺路线版本 ID，真库测试在发布两类后继版本后逐字段比较了工单原 ID，并确认已有 MRP 政策仍指向原物料版本。工单表没有 BOM 版本外键。发布同物料版本下的后继 BOM 后，按发布版本动态查询的生产读取可能选到更新的 BOM。既有领料守卫在所有发布 BOM 上检查组件资格。该区别另行登记。

### 5. 权限、校验及证据

沿用 `manufacturing-item:manage`、`bom:manage`、`routing:manage`，校验请求显式字段并进既有 `COMPANY` / `GROUP` 仓储门。端点 Zod 严格校验，响应使用对应的读权限做字段裁剪。BOM 详情为组件补版本 ID，为产出量、用量与换算系数附精确小数文本。路线详情为准备和单件工时附精确小数文本。旧列表保持原投影，真库核对新建响应与详情中的同一版本逐键相等。新增草稿使用 `writeAuditOutbox`，聚合为制造根及新版本号，载荷包含来源版本 ID。原发布继续走既有处理链。

### 待登记

- **mfg7-1**。`0036` 的已发布子行保护触发器只拦 UPDATE / DELETE。隔离真库直接 INSERT 已发布工艺路线的子行成功。本批续写只向新草稿插入子行。
- **mfg7-2**。`0036` 对 BOM 组件检查的是至少有一个已发布组件。隔离真库实际发布了含一条已发布、一条草稿组件的 BOM。取证事务回滚，见 `/tmp/mfg7/logs/publish-design-final.log`。
- **mfg7-3**。现有工单没有 BOM 版本引用。BOM 正式发布后，车间和成本端动态选择的 BOM 或可领用范围可能变化。固定工单的 BOM 版本、调整守卫口径需另裁。
- **mfg7-4**。既有根创建的规范化哈希拒绝规格 JSON 内的非整数数值，定向夹具首跑收到 `Canonical numeric inputs must be safe integers`。新续写用 PostgreSQL 规范 JSONB 文本处理请求指纹及内容哈希，已覆盖小数及嵌套 JSON。旧根创建路径沿用原处理链。

## 提交与范围

| 提交                                       | 内容                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `5d3a0f17fe529130cbd1d29cf3a0161fb0f47622` | 三条续写命令、精确详情投影、共享子行插入 SQL、真库竞争与引用测试 |
| `bf28bf0cd264d62c148b640244a54a17a3a5e68d` | 三类版本编辑器、历史当前标记、草稿回选、共享汇总卡和行为测试     |
| `ac1fb429f73f9c7254ac89f6d1d5343751cf2d0a` | 制造下拉为同物料的多个已发布选项在文案首部显示版号               |

本批触及三个共享位置。API 结构门的 SQL 信任清单列入固定表映射中的根列名和路线详情投影常量。Web 商业控制器及端口为制造宿主提供 `submitReturningRecord`，让抽屉从本次响应选择草稿，已有 `submit` 调用仍走原处理链。共享 `console-choices.ts` 允许 BOM 和工艺路线宿主对同根多个已发布选项显示版号，单版本选项文案沿用原契约。这些共享接点属于完成本批所需的范围外文件，随对应代码提交。移去 SQL 清单会让结构门拒绝固定投影，移去返回本次请求结果的端口会让制造宿主无法可靠选择新草稿，移去最后一笔独立修复会让同物料的已发布选项同名。无迁移、依赖更新或 `packages/ui` 改动。

## 既有断言对账

| 文件与用例                                                               | 改前                                                                            | 改后与理由                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap.test.ts`，制造挂载、缺物料权限、子路由宿主与相邻 MRP 装配用例 | 轻量假 DOM 的 `findByClass` / `children`                                        | 复用支持 Preact 的项目 DOM，改用同类查询和 `childNodes`。保留宿主数量、直接父子关系、testid、路由与内容断言                                   |
| `bootstrap.test.ts`，汇总可见性与重算                                    | `.metric-card`、同节点、旧多行文本以及 `href` 对象属性                          | `.stat-card`、同节点、相同标识和锚点、实际 `href` 属性，按共享组件文本断言相同已发布和草稿数。缺权限仍为无链接且两个数字为「—」               |
| `bootstrap.test.ts`，制造概览布局与链接反馈                              | `.production-summary.manufacturing-summary` 三／二／一列，域 CSS 链接悬停与焦点 | `.manufacturing-summary .stat-cards` 保留三／二／一列，断言共享卡的链接无下划线、hover 品牌边框、focus-visible 品牌轮廓及领域样式无硬编码颜色 |
| `routing-console.test.tsx`，步骤详情                                     | 打开旧 v1，断言详情展示最新 v2 的两个步骤                                       | 明确打开 v2，继续断言两个步骤的顺序、工作中心和精确工时。现在步骤跟随抽屉选中版本，新增续写用例核对新草稿被选中                               |
| `console-choices.test.ts`，BOM 与路线宿主更新选项                        | 新发布且每根仅一版的物料显示 SKU 和名称                                         | 保留旧断言，在同一个用例追加同根 v1、v2 都已发布时，两项版号不同的断言                                                                        |

## 定向验收

| 验证              | 本批实跑                                                                           | 日志                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 制造 API 定向     | 6 文件 649/649，含 11 条新真库用例、23 条既有制造真库、三类 Fastify 和制造路由契约 | `/tmp/mfg7/logs/api-targeted-final.log`                                                                                                                      |
| 冻结旧轨          | 311/311，无 re-pin                                                                 | `/tmp/mfg7/logs/f3.log`                                                                                                                                      |
| Web 定向／全包    | 下拉消歧提交 181/181；此前 Web 全包 1006/1006                                      | `/tmp/mfg7/logs/web-choice-final.log`、`/tmp/mfg7/logs/web-all.log`                                                                                          |
| 编译、lint 与结构 | API/Web 类型、变更文件 lint、结构及分层校验通过                                    | `/tmp/mfg7/logs/api-typecheck-final.log`、`/tmp/mfg7/logs/web-typecheck-final.log`、`/tmp/mfg7/logs/structure-final.log`、`/tmp/mfg7/logs/service-final.log` |
| 登录入口          | gzip JS 11,752 / 12,000 B；CSS 0 B，工作区延迟加载                                 | `/tmp/mfg7/logs/delivery-up.log`                                                                                                                             |

新真库覆盖同键并发重放、改请求／根／操作者同键冲突、不同键同号的中文 409、权限与字段控制、来源根校验、精确小数及旧行相等、BOM 树选根、旧工单和 MRP 政策引用。竞争时两笔真库事务停在版本号查询后再同时插入，成功、失败及回执／审计／outbox 由数据库结果核对。

## 浏览器验收

容器 `e2e-harness-mfg7` 使用仓库隔离夹具与合成数据。顺序为 P1 三轮、全站走查、六条续写写链、全范围 write-smoke。续写脚本 `/tmp/mfg7/e2e/probe/versions.mjs` 从第 1 版预填，分别更改草高、BOM 用量和替代换算系数、工序顺序和指令。断言请求含幂等键、三类均创建成功、抽屉选中新草稿、发布后只有最高版带本页当前标记，旧版仍显示已发布。桌面创建第 2 版，移动端从同一个第 1 版创建第 3 版。每次保存后回到概览，草稿数加一。每次发布后，已发布数加一且草稿数回到原值。

版号后缀版本的实跑为 P1 11/11 × 3、走查 43/43 × 2、续写发布 6/6。首次全范围 write-smoke 制造 7/7、8 项检查 0 复现。采购签发前关闭抽屉的点击超时，故全范围 5/6，26 步通过、1 步失败、其中一个采购检查未执行，退出 1。日志在 `/tmp/mfg7/logs/delivery-*.log`。移动端截图确认选项末尾版号会被原生下拉裁切，交付代码把版号放到选项首部。

交付版结果保留在 `/tmp/mfg7/logs/settled-p1-{1,2,3}.log`、`settled-walk-{desktop,mobile}.log`、`settled-versions.log` 和 `settled-smoke.log`。截图位于 `/tmp/mfg7/e2e/screenshots/`，包括两个视口各三张编辑页、三张发布详情与一张制造概览。浏览器探针还比较了原始写请求小数、替代料及工序顺序，记录实际样式视口和水平溢出量。

## 整仓及临时资产

整仓验收的权威回执位于 `/tmp/mfg7/logs/ci-final.log`。首行记录干净快照 SHA，末行记录 `CI_EXIT`。整仓使用 `kingturf-pg-mfg7` 独立 PostgreSQL 17.7 容器、端口 5449 和 tmpfs 数据目录。独立浏览器夹具只通过仓库工具接入回环测试数据库，清理由 `down` 执行。`/tmp/mfg7/logs`、`/tmp/mfg7/publish-design.sql`、走查与定向截图、浏览器脚本和脱敏报告留待复核。
