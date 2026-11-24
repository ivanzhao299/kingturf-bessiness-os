# U3-MFG-3 工艺路线管理控制台 + Fastify manufacturing-routings 端点组证据（2026-11-24）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + U3-MFG 指令（MFG-3 工艺路线子批；
> MFG-2-CP 已复核通过；**本批起执行隔离工作协议**——独立 worktree 分支
> `mfg/mfg-3-routings` @4e0ae4a、专用一次性 PG 容器（127.0.0.1:5436/kingturf_test_mfg3），
> 不触主工作树与其暂存区）。旧 vanilla「工艺路线与工序」卡片 + openRoutingVersionForm
> 退役沿用裁定 17 语义；f3 冻结场景按已批 re-pin 先例适配。

## 0. 发布写路径勘探（指令要求先查清）

legacy **已有**工艺路线发布写路径：仓储 `publish(kind: 'item'|'bom'|'routing', id, …)`
（manufacturing-repositories.ts，MFG-1 时已在）+ legacy POST
`/api/v1/manufacturing-routing-versions/:id/publish`（dispatch/manufacturing.ts 的
manufacturingPublish 正则覆盖三 kind）。按指令分支走 MFG-2 的 PUT publish 先例：统一
动作端点分派同一仓储函数，零新写语义；legacy POST 轨逐字不动（双轨并行）。

## 1. Fastify manufacturing-routings 端点组（registry 认领 +4，累计 68 路径/18 文件不含 registry）

| 端点                                           | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/manufacturing-routings             | 视图轨迁移：listRoutingPage（additive (code,version) 复合键集，排序键 (code,version DESC) 与 list('routings') 一致）+ status/query/productType 筛选（additive；query=strpos 字面子串；productType 按产品物料类型——左树「成品/半成品」）；**limit 不设默认值——无查询参数时响应与 legacy 全量 `{items}` 逐字节一致（无 nextCursor 键）**；显式 limit（1..100）才附 nextCursor；looseObject 透传 + Date 归一化 |
| GET /api/v1/manufacturing-routings/:id         | additive 只读 findRouting：根行 + 产品信息 + **全部版本（每版本工序按 sequence 升序**，list 同投影——顺序步骤视图数据源：工序号/工序编码/名称/工作中心/准备工时/单件工时/说明））；404 信封含 correlationId；非 uuid 参数 400（`routingId must be a UUID`）                                                                                                                                                  |
| POST /api/v1/manufacturing-routings            | legacy manufacturingRoutingCreateRoutes 同解析链（allow 七字段 → operations 七字段（hasOwn 缺省 instructions={}）→ 空operations 拒绝（`operations must not be empty`）→ stableCode/uuid/decimal/integer（sequence 1..100000）/timestamp → 201 + mutationDto(routing:read)）；负例消息逐字一致                                                                                                               |
| PUT /api/v1/manufacturing-routings/:id/publish | 统一动作端点分派 legacy publish('routing') 同链 → 201 + mutationDto(routing:read)；legacy POST 轨保留双轨；**零新写语义**                                                                                                                                                                                                                                                                                   |

仓储 additive：`listRoutingPage`（(code,version) 键集 cursor=`<code>.<version>`；筛选值/
游标/limit 全部 values.push 参数化）/ `findRouting`（根行+产品 join + 版本列表复用同投
影）；`ROUTING_VERSION_PROJECTION` 提取为模块常量供 list/listRoutingPage/findRouting 三
处复用（**SQL 字节与提取前 303 字符机械验证相等**；G3 白名单按 ITEM/BOM 先例登记）。
company 作用域门保持。

## 2. Preact 工艺路线控制台（隔离协议：全部新文件在分支 worktree 内）

- `routing-console.tsx`（页面工厂，383 行）+ `routing-console-actions.ts`（装载/筛选
  `createRoutingLoaders` 与变更 `createRoutingMutations` 两工厂，io 注入——G5 防线沿
  bom-console-actions 先例，首版即拆不经红）+ `routing-detail.tsx`（**顺序步骤视图**：
  竖向步进条 `ol.routing-steps`，每步 步骤序 → 工序名称/编码 → 工作中心 → 准备/单件
  工时；版本历史 chips 含草稿行内发布）+ `routing-create.tsx`（**工序编辑器**：增删
  工序、上移/下移排序（首行保护无移除钮）、行序重排 sequence 10/20/30…；工序行字段
  一律带行前缀——见 §4 已知偏差①）+ `routing-host.ts`（宿主独立成文件，bom-host
  范式，**未向 console-entry.ts 追加**）+ `routing-ports.ts`/`routing-state.ts`。
- 主从布局：左产品类型树（全部/成品/半成品，计数按路线根去重、productTypeOf 预聚）
  - 版本状态筛选；右 DataTable（路线编码+名称/产品/工序数/状态徽章/生效日期/行级操作）。
- e2e 契约：路线编码独占文本元素（`kt-routing-code`）；产品 SKU 并入复合文本；徽章
  `已发布 · 第 N 版`；无草稿时无「发布版本」。
- 退役：`manufacturing-view.ts` 移除卡片装配与 grid（改正「BOM/工艺路线两区保持
  vanilla」过时注释）；**manufacturing-cards.ts / manufacturing-forms.ts /
  manufacturing-forms-behavior.test.ts 三文件删除**（最后一张卡片退役，引用清零）；
  `style.css` 移除 `.manufacturing-grid/.manufacturing-card/.manufacturing-version/
.manufacturing-form` 全部规则与 media query（规则 4 例外）；manufacturing-console.css
  移除 `+ .manufacturing-grid` 兄弟规则、增量 `.routing-steps` 步进条样式（kt tokens）。
- bootstrap.test：源绑定锚重钉——manufacturing-cards/manufacturing-forms 两锚（文件已
  删）改钉 `routing-console.tsx` 页面锚与 `routing-host.ts` 宿主锚（断言强度不降：仍
  逐文件唯一实现锚）；宿主断言 `kt-mfg-routings`/data-route-view=null/卡片计数 1→0/
  文本不含 RT-KT-PRO-50。

## 3. 测试

- fastify inject `manufacturing-routings.test.ts` 14/14：默认全量逐字节 `{items}`、五类
  筛选/分页透传+七类查询负例、字段裁剪、详情 200/404/400（根+产品+版本工序升序
  oracle）、POST 入参 oracle（trim/stableCode/instructions hasOwn 默认/publish 严格
  true）+ 六负例消息逐字、mutation 投影、PUT publish 正/负例（未知字段/DomainError
  映射/空作用域 403）、权限负例、依赖缺失 503、未认领方法/尾斜杠落回 null；**parity
  组**：GET 列表与 POST 创建新旧轨响应逐键一致+仓储实参逐字节一致。
- PG 集成 +4（21/21）：无过滤与 legacy list('routings') 逐字节相等+工序插入乱序
  （30/10/20）投影后 sequence 升序；status/query/productType 筛选；键集游标走查；
  findRouting 根+产品+工序明细（sequence/编码/工作中心/工时/instructions）；坏 cursor/
  TEAM 403/租户隔离/未知 id null。
- 组件 `routing-console.test.tsx` 13/13：默认视图与 e2e 文案契约、左树计数/权限门、
  无草稿无「发布版本」、筛选/检索/游标续载、空态/装载错态/动作错误分离、详情步骤视图
  （步骤序 1/2、工作中心/单件工时呈现）、详情失败回退+抽屉内发布 PUT 同链、**单工序
  TUFT 载荷与 vanilla oracle 逐字节一致**、多工序增删/上移下移后 sequence 依行序重排、
  移除中间行不串值（首行保护）、创建失败保留抽屉、operationsOf 纯助手。
- f3 冻结 re-pin：GET/POST manufacturing-routings 两场景钉定 `listRoutingPage(作用域,
{})`；311/311 全绿。

## 4. 已知偏差（如实）

1. **工序行字段命名偏离 MFG-2 的「首行裸名」约定**：首工序行字段与路线级 `name` 同
   名，FormSection 按字段名存状态会互相覆盖（组件测试实证：路线名称被工序名称覆写）。
   vanilla 表单无逐工序字段故无此冲突；本批全部工序行字段一律带行前缀
   (`o1:operationCode`…)，**载荷形状不受影响**（单工序 TUFT 与 vanilla oracle 逐字节
   一致由组件测试钉定）。**packages/ui 提案（不改动，按指令 E）**：FormSection 以
   field.name 为表单状态键，建议对重名字段告警或支持 path 键——另批裁定。
2. 工序「模板行」功能（簇绒/背胶/包装预填）在实现中发现与 FormSection 的 useState
   一次性初始化语义冲突（后添加行不回显预填值），已移除——指令要求的编辑器能力
   （增删/排序/字段一致）完整保留，模板预填不在指令范围。
3. e2e P1 未实跑（口令不可得，同前十七子批）；契约静态核对见 §5。

## 5. e2e 文案契约逐条静态核对（p1-demo.spec.ts L246 用例，.manufacturing-workbench 范围）

| 断言                       | 静态核对                                                                                                                                                                                                                                                                                                                                                                               | 载体                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 'FG-KT-PRO-50' 独占文本    | 物料控制台行 `<strong data-testid="kt-item-sku">` 独占（MFG-1 已钉）；BOM/路线两控制台产品列均为复合文本「产品 …」不独占；bootstrap.test 断言宿主静态文本不含该编码                                                                                                                                                                                                                    | item-console.tsx:286（MFG-1 提交）  |
| 'BOM-KT-PRO-50' 独占文本   | BOM 控制台行 `<strong data-testid="kt-bom-code">` 独占（MFG-2 已钉）；路线控制台无 BOM 编码                                                                                                                                                                                                                                                                                            | bom-console.tsx:280（MFG-2 提交）   |
| 'RT-KT-PRO-50' 独占文本    | 路线控制台行 `<strong data-testid="kt-routing-code">` 独占；组件测试断言 `textContent === 'RT-KT-PRO-50'`；物料/BOM 控制台与宿主静态文本均不含                                                                                                                                                                                                                                         | routing-console.tsx 本批            |
| '已发布 · 第 1 版' 恰 6 处 | 种子数据核对（seed_p1_demo.mjs）：物料 4 条（RM-KT-YARN-12000/RM-KT-YARN-11000/RM-KT-BACKING-PP 均 PUBLISHED v1 + FG-KT-PRO-50 PUBLISHED v1）+ BOM 1 条（BOM-KT-PRO-50 PUBLISHED v1）+ 路线 1 条（RT-KT-PRO-50 PUBLISHED v1）= **6**；三控制台徽章格式统一 `${label} · 第 N 版`；各控制台详情 chips 为 `vN 状态` 格式不产生额外匹配；宿主静态文本无该短语（动态 chunk 挂载后才渲染行） | 三控制台 + seed_p1_demo.mjs:600-700 |
| 无草稿时全页无「发布版本」 | 种子无 DRAFT 版本 → 三控制台行级发布按钮与详情 chip 发布钮均不渲染；页面无含该词的静态文案；组件测试三控制台各自断言无草稿时 `textContent` 不含「发布版本」                                                                                                                                                                                                                            | item/bom/routing-console.test.tsx   |

真浏览器复验由另一会话负责（本会话无口令）。

## 6. 门禁回执（隔离协议）

| 门禁                            | 结果                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| worktree / DB                   | `/tmp/mfg3-wt`（分支 mfg/mfg-3-routings @4e0ae4a）；PG 容器 kingturf-pg-mfg3（127.0.0.1:5436/kingturf_test_mfg3，一次性）；未触主工作树任何已跟踪文件 |
| API typecheck / lint / prettier | 0 / 0 / 通过（worktree 内实跑）                                                                                                                       |
| API 全量测试                    | 见 ci:local 行（共享树预验证同数 EXIT=0）                                                                                                             |
| Web typecheck / lint / prettier | 0 / 0 / 通过（worktree 内实跑）                                                                                                                       |
| Web 全量测试                    | **723/723**（共享预验证 EXIT=0；711 基线 −2 forms-behavior +14 routing 组件）                                                                         |
| structure-gate                  | 强制违规 0（ROUTING_VERSION_PROJECTION 按 ITEM/BOM 先例登记 G3 白名单；首版即拆 actions 文件未经红）                                                  |
| e2e P1                          | 未执行（口令不可得）——§5 逐条静态核对                                                                                                                 |
| pnpm ci:local                   | 干净提交快照实跑——见回执提交（日志 /tmp/mfg3-ci-1.log）                                                                                               |

## 7. 边界与后续

- legacy dispatch 轨完整保留（routings GET/POST/publish 双轨并行）；零新写语义。
- 不新增 AppRoute 子路由（TD-MFG-003 另批）；未改 packages/ui（FormSection 提案见
  §4.1）；未触其它域文件。
- 未 push、未合并 main、未 dispatch workflow；容器/worktree 清理待主协调复核后按名执行。
- MFG-4（工单管理）/MFG-5（报工入库）待主协调指令。
