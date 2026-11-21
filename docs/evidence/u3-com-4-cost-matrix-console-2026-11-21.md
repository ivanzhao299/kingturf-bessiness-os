# U3-COM-4 成本矩阵控制台 + Fastify cost-matrices 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM-3-CP 复核放行 + U3-COM-4 指令；旧 vanilla 矩阵视图退役沿用
> 裁定 17 语义（ledger/detail/bindings 引用清零；cost-view 保留模型区）。

## 1. Fastify cost-matrices 端点组（registry 认领 +5，累计 13）

| 端点                                            | 守恒语义                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/cost-matrix-summaries               | page 分页模型（非 cursor）——legacy 校验链原样（summaryFilters 导出助手），响应仓储直通                                                                |
| GET /api/v1/cost-matrices                       | flat 视图轨迁移（cost-matrix:read）                                                                                                                   |
| GET /api/v1/cost-matrices/:id                   | 详情：校验次序与 legacy 一致（授权→uuid→audit:read COMPANY 门）——首轮契约暴露桥缺 uuid 校验（'modelId must be a UUID'→200 透传），补齐后 222/222      |
| POST /api/v1/cost-matrices                      | matrixInput 导出助手 + 201 直通                                                                                                                       |
| PUT /api/v1/cost-matrices/:id/factors/:factorId | legacy PATCH /factors/:factorId 的现代化动词别名（bodyAndSource/factorValues 同解析链）；POST /factors、calculate、quote-cost-decision 仍走 legacy 轨 |

仓储端口 Pick 派生（S4 合规）；全部响应仓储直通（无 zod 响应 schema）→ Date/未知键与 legacy JSON 逐字节一致，无需归一化层。

## 2. 成本矩阵 Preact 控制台

- `cost-matrix-console.tsx` + `cost-matrix-ports.ts`：summaries 服务端分页（page/检索/产品系列/attention/sort 五筛选透传）+ 度量（本页待重新核算）+ 详情抽屉（api.get 完整矩阵：因子表/核算历史/系统预置徽标）+ 行级操作（新建规格模型 POST 桥轨、添加因子 POST legacy、因子更新 PUT 桥轨、重算含税/未税、生成报价成本决策→preferred 决策→报价路由切换）。
- **行为守恒关键**：factor 域常量（类别/来源/单位选项 + 因子表单字段）单一来源保留在 `cost-factor-form.ts`（导出常量+itemVersionOptions 助手），console 复用 createCostFactorFields（FormField 结构兼容 FormSectionField）；报价成本决策 handoff（原 cost-matrix-detail createCostQuoteButton）迁入控制台并以重写后的 `cost-quote-handoff-behavior.test.ts` 等价覆盖（决策提交→navigateToQuotes）。
- cost-view.ts 保留成本模型目录/评估/决策区（矩阵区分离）；pricing-view-ports 的 CostViewContext 瘦身 + PricingViewController 补 api 成员。
- 退役：`cost-matrix-ledger.ts`(398)/`cost-matrix-detail.ts`(633)/`cost-matrix-bindings.ts`(81)——裁定 17 语义。

## 3. 测试

- fastify inject `cost-matrices.test.ts`（6 例：摘要透传/负例消息/flat+详情+uuid 次序/POST 创建/PUT 因子/未认领+DomainError）。
- 契约 222/222（首轮 1 败=桥缺 uuid 校验，补齐后全绿）。
- 页面 `cost-matrix-console.test.tsx`（7 例：渲染/分页透传/详情 api.get/创建/添加因子 legacy/重算+失败就地呈现/系统预置治理门）+ handoff 重写 3 例。

## 4. 门禁回执

| 门禁                                | 结果                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| API typecheck / lint / 契约+fastify | 0 错误 / 0 错误（4 demo 警告既有）/ 253/253                                             |
| Web typecheck / lint / test         | 0 / 0 / **490/490**                                                                     |
| web build                           | 登录关键路径 JS 11750B gzip；console-css 守卫过                                         |
| structure-gate / service-boundary   | 0 强制违规 / 0 违规                                                                     |
| e2e P1                              | **11 passed / 0 failed（24.7s）、零 500**——优于基线（矩阵摘要/详情已真实走 Fastify 桥） |

## 5. 提交链与门禁修正（如实记录）

- 提交链（4680d03..本批 HEAD，均已 push）：`524becf` feat（矩阵端点组+控制台+退役）→ `96e270c` fix（G5：五个矩阵动作提取为 costMatrixActions 工厂 over signal bundle；formatting 归一）。
- 首轮 ci:local 唯一失败为 G5（209 行），拆分后 EXIT=0。
- ci:local：NODE_ENV=test（kingturf_test），干净快照 **EXIT=0 全链**。

## 6. 边界与后续

- legacy cost-matrix 三路由仍完整在轨（calculate/quote-cost-decision/add-factor/校验链共用）。
- 后续子批：CTR → 销售政策 → 信用审查。
- 未 dispatch workflow；未触 `.github/workflows/`。
