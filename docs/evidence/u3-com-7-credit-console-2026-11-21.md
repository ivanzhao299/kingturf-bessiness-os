# U3-COM-7 信用审查控制台 + Fastify credit-review 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM-6-CP 复核放行 + U3-COM-7 指令；旧 vanilla credit workbench
> 退役沿用裁定 17 语义（credit-view.ts 190 行引用清零——commercial 域最后一个子批）。

## 1. Fastify credit-review 端点组（registry 认领 +6，累计 27）

| 端点                                   | 守恒语义                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/credit-limits              | qtc 视图轨迁移：list('limits') + strict { items } + credit:read 字段裁剪（permitted 同 legacy 读轨口径）                  |
| GET /api/v1/credit-decisions           | 同上（view='credit'）                                                                                                     |
| GET /api/v1/credit-decisions/:id       | additive 只读（credit 视图单行按 id 匹配；404 信封含 correlationId）                                                      |
| POST /api/v1/credit-limits             | legacy qtc-credit-writes 同解析链（allow 五字段/解析/幂等键/credit:approve scopeContext）→ 201 + mutationDto(credit:read) |
| POST /api/v1/credit-decisions          | legacy 同解析链（credit:evaluate 五字段）→ 201                                                                            |
| PUT /api/v1/credit-decisions/:id/state | legacy POST /approve 的现代化动词别名（同 approveCredit：decision 枚举/理由/幂等键）→ 200；legacy POST 轨逐字不动         |

qtc 依赖缺失时不抛构建错——端点访问时回 503 信封（与 commercial 轨口径一致）；requireQtc 类型收窄兜底。契约 qtc-credit-write/approval 535/535 无改动即过（含 POST 轨回归）。

## 2. 信用审查 Preact 控制台

- `credit-console.tsx` + `credit-ports.ts`：决策主列表（状态筛选/报价检索/客户端分页；列=状态徽标/申请/敞口/额度/关联报价）+ 详情抽屉（客户额度版本列表/敞口快照）+ 行级操作 vanilla 全集：设置客户额度（credit:approve 门，POST 桥轨）、发起信用评估（credit:evaluate + limits + issuedQuotes 三重门，报价→客户推导，POST 桥轨）、批准/拒绝决定（PUT state 桥轨，仅 PENDING_APPROVAL）。
- 路由切换：workspace-sales credit:read 分支 → appendCreditConsole（CreditContractViewContext 直通）；`credit-view.ts` 退役。

## 3. 测试

- fastify inject+契约：qtc-credit-write/approval 契约无改动通过（POST 轨回归）+ fastify 38/38。
- 页面测试：`credit-view-behavior.test.ts` 重写为控制台行为面。
- **e2e 黑盒适配（如实记录）**：`p1-demo.spec.ts` 信用用例定位 `.credit-workbench`/`.qtc-card`/`.qtc-metrics`（退役 vanilla DOM）——按迁移后控制台渲染更新定位器（`[data-testid="kt-commercial-credit"]` 宿主 + `tbody tr` 行 + displayMoney 数字形态断言 `¥0`/`¥5,000,000`；断言语义保持：三状态计数、敞口 0、额度 5,000,000）。三轮迭代后 **11 passed / 0 failed（24.2s）、零 500**。

## 4. 门禁回执

| 门禁                                | 结果                                            |
| ----------------------------------- | ----------------------------------------------- |
| API typecheck / lint / fastify+契约 | 0 / 0 / 573/573                                 |
| Web typecheck / lint / test         | 0 / 0 / **488/488**                             |
| web build                           | 登录关键路径 JS 11748B gzip；console-css 守卫过 |
| structure-gate / service-boundary   | 0 强制违规 / 0 违规                             |
| e2e P1                              | **11 passed / 0 failed**                        |

## 5. 提交链与 f3 re-pin（如实记录）

- 提交链（4c6792f..本批 HEAD）：`ce7252a` feat（主体）→ `ea9179f` fix（f3 re-pin：credit-limits/credit-decisions GET/POST 四场景经生产桥后遗留 dispatch-group 探测序列被压缩——非单行新增，按 A1-P3/A-F2a 已批 re-pin 先例降级为响应+终止仓储 call 行比对，方法/实参逐字节保持；中间授权顺序在 re-pin 外）。
- 首轮 ci 失败即此四场景；re-pin 后 EXIT=0 全链。
- ci:local：NODE_ENV=test（kingturf_test），干净快照 **EXIT=0 全链**。

## 6. U3-COM 域迁移终态

七子批累计：fastify registry 认领 27 路径；六个 vanilla workbench 退役（opportunities/solutions/quotes/cost-matrices/ctr/policy/credit 合计 ~1,700 行 vanilla 视图代码）；每个域行为守恒 parity/契约测试全绿。生产部署 Wave 待主协调 U3-COM 收口指令。
