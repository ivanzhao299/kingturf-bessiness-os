# MFG-5 报工入库：车间执行三表单迁入控制台 + 三个写端点上桥轨 + TD-MFG-010 修复（2026-11-24）

> 授权链：项目所有者 → 主协调全权 → 本任务书（MFG-5）。隔离协议：独立 worktree
> `/tmp/mfg5-wt`、分支 `mfg/mfg-5-shop-floor`、基线 `d10a353`（开工时 main），收尾 rebase 到
> `5610673`（main 新增仅 docs/发布记录，与分支零交集，rebase 干净）。一次性 PG
> `kingturf-pg-mfg5`（127.0.0.1:5443 / kingturf_test_mfg5，trust 认证，无口令落盘）。未
> push、未合并、未触 `.github/workflows/`。

## 0. 交付概览

| 维度     | 内容                                                                                                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 端点     | 三个写端点上桥轨（registry 认领 +3，累计 75 路径/20 文件）：POST `/:id/operation-reports`、`/:id/materials`、`/:id/finished-rolls`，解析链与 legacy 三路由逐字一致、调用同一批仓储方法；legacy 路由逐字保留（双轨）                                                                                |
| 前端     | 三张表单（工序报工/领退料/成品卷入库）迁入工单详情抽屉的 Preact 抽屉（`kt-wo-report-*`/`kt-wo-material-*`/`kt-wo-output-*`）；出现条件与 legacy 逐条一致；拆桥（`mountExecution` 端口删除）；`production-actions.ts` 与 `.production-actions` 样式退役                                             |
| 行为变更 | ①幂等键前端生成（`工单号-RPT/MAT-yyyyMMddHHmmss-四位随机`，过 stableCode，任务书明示）②领退料「批次库位」只列工单 BOM 内批次（TD-MFG-010 表单侧）③`transactMaterial` 对进行中工单领用非 BOM 批次前置抛 409（TD-MFG-010 服务端兜底）④三端点把触发器 `P0001` 拒绝映射为 409+触发器文字（仅限三端点） |
| 验证     | API 全量 183 文件 18042 例 EXIT=0（636s）；Web 全量 51 文件 796 例；真库 9/9×5 连绿；e2e P1 三轮 11/11（37.8/37.9/38.4s）；walk 双视口 40/40 零问题；写链探针双视孔全过；登录入口原始 18667B 不变                                                                                                  |

## 1. 端点（提交 51d8cba / 4d8f405 / 3ed07e9）

- 解析链逐字复刻（对照 `production-report.ts` / `production-material.ts` / `production-output.ts`）：
  allow 字段表 → 按请求字段授权（report/output 用 `production:report`，materials 用
  `production:material`，materials 的授权先于业务类型枚举）→ 工单 UUID → 逐字段解析
  （UUID 归一小写、decimal 去尾零、timestamp 转 UTC ISO、stableCode、calendarDate）→
  201 + `mutationDto(production:read)`。幂等键只取请求体且每次转发仓储（不在桥轨去重）；
  finished-rolls 无幂等键字段（与 legacy 一致）。
- 端点组落在新文件 `apps/api/src/routes/fastify/production-order-execution.ts`；
  `production-orders.ts` 导出 `mutation`/`scopedContextBy` 供两文件共用（单一实现）。
- 契约测试（30 例）：三端点各自载荷 oracle/负例消息（逐字同 legacy）/字段裁剪/鉴权顺序/
  幂等转发/503/未认领路径回 null；守恒组把同一请求分别经 legacy `app.dispatch`（不装
  commercial → 桥轨不介入，与旧轨契约测试同一手法）与桥轨各跑一遍——报工 40 请求、成品卷
  32、领退料 36，状态码、响应体与仓储实参（含接收者）逐字节一致，负例的状态码与消息也取自
  真实旧轨；元断言钉住成功/字段拒绝/解析拒绝三类结果都真实出现。

## 2. TD-MFG-010（提交 747af5c + 453a827）

- **服务端兜底**：`transactMaterial` 在写任何库存移动前校验领料批次——判定与触发器
  `bom_component` 同口径（工单成品版本任一已发布 BOM 版本的行组件）。不属于则抛
  `DomainError('conflict', '该批次物料不属于工单 BOM')` → 409。只接管触发器因 BOM 原因拒绝
  的一种情形：退料、工单不存在/跨租户/未放行/已完成、结果形状意外一律维持原路径（触发器仍
  是权威，其提示仍由触发器给出）；company scope 门仍最先执行。既有断言「对不存在的工单领料
  得到触发器 P0001 原文」未改一字且仍绿。
- **P0001 映射**：三端点把 `code === 'P0001'` 且带文字的仓储异常转为 `conflict`（409+触发器
  文字）；其它 SQLSTATE（23505/23514/23503 等）、无文字的 P0001、普通异常一律原样（500 不
  外泄细节）；同组的创建与 PUT state 端点不在范围（契约测试反向钉死其仍 500）；legacy 三
  路由不动。
- **真库验证**（`production-execution-postgres.integration.test.ts`，9 例，连续 5 轮全绿）：
  非 BOM 原材料与成品自身批次 → 409 且该关联 ID 下 movements/audit/outbox 零写入；桥轨与
  legacy 轨同 409 同消息；两个 BOM 组件各领 201 入账；合法报工 201 后超计划报工 → 409
  「reported good quantity exceeds planned production quantity」且累计仍 10.250000；合法
  成品卷 201（待检批次+库存收货）后超报工良品入卷 → 409「finished roll must match order,
  report, item, lot, and reported quantity」；草稿工单报工 → 409「operation reporting
  requires an active order」；退料超累计/工单不存在/跨租户/草稿仍由触发器把关；scope 门
  优先。

## 3. 前端（提交 fd49dc2 / 412ec28 / f176267）

- 三张抽屉（`production-order-execution-forms.tsx`）：字段、类型、提交按钮文案与 legacy
  逐字同；载荷同形同键序（值 trim、日期时间按本地时间转 UTC ISO、编码字段过 stableCode 形
  状、领退料把所选批次展开为 itemVersionId/lotId/locationId、成品卷附加工单成品版本）。
  任一表单抽屉打开期间详情抽屉不渲染（两个模态抽屉不同时存在）。
- **幂等键**（`production-order-keys.ts`）：`工单号-RPT|MAT-yyyyMMddHHmmss-XXXX`（本地时间
  +Web Crypto 四位大写字母/数字）；工单编号清洗为合法前缀（非字母开头补 `WO`，截长给后缀留
  64 上限），任意列表数据形状下都能过服务端 stableCode——11 例单测钉形状/清洗/截断/唯一性；
  API 契约测试用同形键走真实解析链。键在打开抽屉时生成一次，提交失败重试沿用同一把键（组件
  测试钉死）；写在表单说明里以便追溯；成品卷端点无幂等键（表单与 legacy 一样没有）。
- **领退料候选**（TD-MFG-010 表单侧，`materialBatchesOf`）：详情响应带 `materialRequirements`
  时只列 BOM 组件批次（成品批次与非 BOM 物料不再出现）；键缺失（无 bom:read/详情未到/读败）
  列全部并说明「不属于本工单 BOM 的批次领料会被拒绝」；BOM 内无库存（含无库存读权限）列空
  并说明；不另发请求（与 legacy 同源 controller.views）。候选在打开抽屉时定下（下拉 value 是
  候选序号，与 legacy 在按钮挂载时定下同语义、时点更新）；无效序号/日期提交前拦下（legacy
  同款提示）。
- **提交后就地刷新**：成功后关表单 → 整站刷新一次 → 重读详情；工序进度/物料台账/报工记录/
  成品序列就地更新（组件测试 + 真浏览器验证）。失败抽屉保留、`role="alert"` 就近显示服务端
  消息、不刷新。
- **退役**：`appendProductionReport/Material/Output` 三函数随迁移分三步删除（每步保留未迁移
  入口的桥接，能力在提交间不消失；过渡期余下函数与 main 逐字节机械比对相等）；最终
  `production-actions.ts` 整文件删除、`.production-actions` 样式删除、`mountExecution` 端口从
  ports/state/detail/console/host 全链拆除。`workspace-fulfillment.ts` 仅注释更新（任务书许可）。
- 详见各提交说明；三份载荷 oracle（含小数、日期转换、自动幂等键格式）在
  `production-order-console.test.tsx`（组件 30 例，累计文件 36 例）。

## 4. 被修改/退役的断言（改前 → 改后）

| 位置                                          | 改前                                                                                  | 改后                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| fulfillment-actions-behavior.test.ts 报工两例 | `appendProductionReport` 载荷 oracle（小数/日期/无效日期/失败不刷新/出现条件）        | 随函数退役；oracle 迁 `production-order-console.test.tsx`「工序报工」组（幂等键改为前端生成的键，其余逐字）           |
| 同上 领退料两例                               | `appendProductionMaterial` 载荷 oracle（批次快照/无效批次/失败不刷新/出现条件）       | 随函数退役；oracle 迁「领退料」组并新增候选三情形（BOM 过滤/键缺失列全部/无库存）                                     |
| 同上 成品卷两例                               | `appendProductionOutput` 载荷 oracle（选项/绑定成品版本/失败不刷新）                  | 随函数退役；oracle 迁「成品卷入库」组（另钉：无幂等键字段、不调用生成器）                                             |
| 同上 混合门控一例                             | material+output 一起门控 + 空库存                                                     | 仅保留 output 门控部分至第二步，第三步随之退役；门控断言由组件「出现条件」用例取代（7 状态×权限矩阵）                 |
| production-order-console.test.tsx 桥接一例    | `mountExecution` 挂载/关闭卸载                                                        | 改为断言入口由控制台渲染（顺序同 legacy）且随抽屉卸载                                                                 |
| production-execution-postgres 台账断言        | （本批新增后自修）台账「最后一条」=新领料                                             | 改为按 id 找新增行：两次领料 occurred_at 相同、排序不定，旧断言 6 跑 3 败（复现留档），修后 10 连绿——单独提交 636dcd0 |
| p1-demo.spec.ts 工单用例                      | （加性）已关闭工单抽屉无执行入口；RETURN-DEMO 抽屉有报工/领退料入口、无成品卷入库入口 | 只读断言，不动演示数据；87794f1                                                                                       |

未删除或弱化任何既有断言；无 `.skip`/`.only`。发货（shipment）两组用例与 main 逐字相同。

## 5. 验证回执

| 项                                | 结果                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 全量（含映射后）              | **183 文件 / 18042 例，EXIT=0，636s**（专用 PG 5443）                                                                                                                                                                                                                                                                                                                           |
| Web 全量                          | **51 文件 / 796 例**（组件 +26：报工 9 / 领退料 14 / 成品卷 7 / 入口渲染 1 / 幂等键 11 独立文件）                                                                                                                                                                                                                                                                               |
| API typecheck / lint / prettier   | 0 / 0 / 通过（分支内实跑）                                                                                                                                                                                                                                                                                                                                                      |
| structure-gate / service-boundary | 强制违规 0 / 0 违规                                                                                                                                                                                                                                                                                                                                                             |
| e2e P1（仓库原配置，同容器栈）    | **连续三轮 11/11**（37.8s / 37.9s / 38.4s），每轮全新专用库自建自清                                                                                                                                                                                                                                                                                                             |
| 全站走查（入库配方）              | 桌面 1440×900 与手机 390×844 各 **40/40 路由**，零 console 错误、零 ≥400、零页面/抽屉问题（佣金页 TD-UI-005 不在本批范围）                                                                                                                                                                                                                                                      |
| 写链探针（临时 spec，验证后删除） | 桌面 20.0s / 手机 15.0s 全过：RETURN-DEMO 上四笔报工（5.5+4.5+10+10，工时 12.5/30.5 等小数）→ 领料 3.5（表单只列草纱批次，无成品批次）→ 成品卷 5.5（入口在首笔报工后出现）→ 完工确认 → 「已完成」；手机端 innerWidth=390 断言 + 四张抽屉 scrollWidth≤clientWidth 零溢出                                                                                                         |
| 截图目检                          | 桌面：报工抽屉（浮层/生成键在说明中/字段值正确/无溢出）、领料抽屉（BOM 过滤说明在位/仅草纱批次）、完工后抽屉（进度 10/10、首道工序「报工 2 次」、工时小数累加 43/48 分钟、页脚进入关闭阶段）。手机：报工抽屉单列无溢出。**如实记录**：其余覆盖层整页截图的视觉模型读数出现把压暗背景误读为内容的情况（引用了应用里不存在的字符串），该批截图的结论以探针 DOM 断言与走查审计为准 |
| 登录入口预算                      | 最终入口块 **raw 18667 字节不变**、gzip **11752 = main**；把内嵌分块名哈希统一替换为占位符后**逐字节相等**（掩码 gzip 双 11718）——期间出现过的 11751/11753 读数为哈希压缩噪声（字节级定位：入口块唯一差异是 9 处共 56 字节的懒加载文件名哈希字符）。改前基线在 main 源码上独立构建取得                                                                                          |
| 逐笔提交验证                      | rebase 后每笔在临时工作树独立跑 typecheck+该域测试：前三笔 833/839/847 例全绿；第四笔抓出台账断言的排序偶发（见 §4），修复提交后连跑 10 次绿                                                                                                                                                                                                                                    |

## 6. 待登记（编号暂用 MFG5-n，由主协调裁定入账）

| 编号   | 内容                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MFG5-1 | 根 `tsconfig.json` 引用不存在的 `packages/testing`（main 同样如此）：`pnpm -r typecheck` 不走根解决方案所以从未暴露，`tsc -p tsconfig.json` 直接失败。建议删除该引用或补目录。无门禁消费。                                                                             |
| MFG5-2 | `docs/productization/evidence/checksums.json` 登记着已删除的 `apps/web/src/commercial/production-actions.ts` 的校验和（历史证据数据，无任何脚本消费）；同类条目会随退役积累，建议一次性清理或加注「源已删除」。                                                        |
| MFG5-3 | FormSection 的 `error` 属性（WF-B 在做）落 main 后，工单控制台的新建/流转/三张执行抽屉应把 `submitError` 传给表单（本批用表单旁 `role="alert"` 段落满足「服务端拒绝要有提示」；`api-error-message.ts` 同理可接）。WF-B 按约定不碰 `production-order-*`，接线留给本域。 |
| MFG5-4 | e2e-local 配方 `e2e` 子命令把 `--` 原样透传给 Playwright：按 `up` 横幅提示的 `e2e -- <spec>` 用法会把整个 testDir 装载（`runtime-local.spec.mjs` 因缺 `packages/database/dist` 而报错）；省略 `--` 直接传路径正常。配方归 E2E-WRITE，本批未改。                        |
| MFG5-5 | 报工表单把「班组记录」标为必填并前端把关：legacy 表单未标必填但解析链要求非空（留空提交得英文 400 `notes is required`）。这是随迁移收紧的呈现，不改接口。类似的「legacy 未标必填但服务端必填」字段值得全表单盘一遍。                                                   |

## 7. 偏离与说明（如实）

1. **不用 `git stash`**：多代理共享仓库，为避免弹出他人条目，rebase 前用 `/tmp/mfg5/wip` 补丁
   文件保存/恢复未提交前端半成品，事后删除。
2. **写链探针为临时文件**：`tests/e2e/mfg5-shop-floor{,-mobile}.spec.ts` 仅存在于验证期间
   （未提交），验证后删除——避免污染后续 P1 轮次（探针会写演示数据）。真浏览器证据为
   `/tmp/mfg5/e2e/shots{,-mobile}` 16 张截图（本文件不入库，截图不入库）。
3. **一次性 PG 用 trust 认证**（5443 专用测试库）：全程无口令产生/落盘；guard 校验通过
   （NODE_ENV=test + 回环 + test 段库名）。
4. **首跑探针的 409**：首版探针良品 10.5 超过演示工单计划 10，触发器拒绝（映射链路在真实数
   据上生效的旁证）；探针改为 5.5+4.5 两笔小数凑满。
5. **视觉模型可靠性**：见 §5 截图目检行的如实记录。
6. **main 前进两次**：开工基线 d10a353 → 收尾 rebase 到 5610673（期间 551952a/5610673 均与分
   支文件零交集）。

## 8. 边界

- 未 push、未合并 main、未 dispatch workflow；`docs/exec-plans/tech-debt-tracker.md` 未编辑
  （按任务书，入账归主协调）。未改 `packages/ui`、`scripts/e2e-local/`、并行任务的任何文件。
- legacy 三条写路由与五个命令路由逐字保留；数据库触发器仍是状态机与量门禁的权威；零新写语
  义（唯一新前置校验是任务书明示的 BOM 兜底）。
