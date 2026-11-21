# U3-COM-3 报价控制台 + Fastify quotes 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM-2-CP 复核放行（0e34d69 合格）+ U3-COM-3 指令；旧 vanilla
> 视图退役沿用裁定 17 语义。

## 1. Fastify quotes 端点组（registry 认领 +4 路径，累计 8）

| 端点                   | 守恒语义                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/quotes     | 视图轨迁移：`listQuotePage`（additive keyset，ORDER BY r.id DESC 与视图 ORDER BY 1 一致）+ status 筛选 + 默认 limit=100；looseObject partial 透传 + Date 归一化（COM-2 同款）                                                                                                                                                                         |
| GET /api/v1/quotes/:id | additive 只读 `findQuoteRevision`（QUOTES_VIEW_SELECT 单行版，谓词同口径）                                                                                                                                                                                                                                                                            |
| POST /api/v1/quotes    | 201 + mutationDto；**与 legacy quote-writes 同一解析链**（复用导出的 bodyAndLines/quoteValues + 同批 app-values 解析器）——quote-write 契约钉死 legacy 消息文本（'Unsupported fields: …' 等），zod body 校验会破坏冻结契约，故 POST/PUT 走 handler 侧 legacy parser 链，zod 承载查询串（strict）与响应 schema；parity 测试证明输入/响应/消息逐字节一致 |
| PUT /api/v1/quotes/:id | 经不可变新修订更新（同 legacy POST /:quoteId/revisions 的仓储与规则，PUT 为现代化动词别名；uuid 校验次序与 legacy 逐字节一致）                                                                                                                                                                                                                        |

仓储：`QUOTES_VIEW_SELECT` 提取为模块常量（三处复用，SQL 字节与提取前逐字一致；G3 白名单按门禁指引登记于 SQL_ENUM_NAMES 并在提交说明登记理由）+ `listQuotePage`/`findQuoteRevision` additive 方法。

## 2. 报价 Preact 控制台

- `quote-console.tsx`（主列表/筛选/详情抽屉含**版本历史**/毛利/引用钉/行项 + 行级操作）+ `quote-forms.tsx`（G1 拆分：新建/修订/批准/签发表单）+ `quote-ports.ts`（端口层含政策预校验 revisionState 消费面）。
- 行级操作 = vanilla 全集：新建报价（政策评估先行→未通过就地呈现原因且不创建）、创建修订（ISSUED/REJECTED 最新版，PUT 现代轨）、批准（DRAFT，command 轨）、签发（APPROVED，command 轨）、打印/保存 PDF（ISSUED，printIssuedQuote 直通）。
- 路由切换：workspace-sales quote:read 分支 → appendQuoteConsole；`quote-view.ts`/`quote-cards.ts`/`quote-create.ts`（424 行合计）退役（裁定 17 语义）；`quote-print.ts` 保留（控制台端口直通）。

## 3. 测试

- fastify inject `quotes.test.ts`（8 例：键守恒/分页透传/负例信封/详情/POST 解析链/PUT/DomainError）+ `legacy-parity.test.ts` 新增 quotes GET/POST 两例（夹具含 Date 与尾零小数变换敏感值）。
- 契约夹具适配：commercial-view-route-contract（quotes GET 分派 viewReader 分支）、quote-command/quote-write（夹具补 listQuotePage；视图断言换轨）——162/162 全绿。
- 页面测试 `quote-console.test.tsx`（10 例：渲染/筛选检索/详情聚合版本历史/新建双段流/政策拒绝就地呈现/批准/签发/打印/修订 PUT/权限门）。

## 4. 门禁回执

| 门禁                                         | 结果                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API typecheck / lint / 全量（NODE_ENV=test） | 0 错误 / 0 错误 / **EXIT=0 全量**（含 PG 集成）                                                 |
| fastify + 受影响契约                         | 187/187（fastify 25 + 契约 162）                                                                |
| Web typecheck / lint / test                  | 0 / 0 / **491/491**                                                                             |
| web build                                    | 登录关键路径 JS 11751B gzip；console-css 守卫过                                                 |
| structure-gate                               | 强制违规 0（G1 拆分 quote-forms.tsx；G3 按门禁指引登记 QUOTES_VIEW_SELECT；G2/G5 拆分动作工厂） |
| service-boundary                             | 0 违规（S4：端口均 Pick 派生）                                                                  |
| e2e P1                                       | **11 passed / 0 failed（24.9s）、零 500**——优于基线（web 报价加载已真实走 Fastify 桥）          |

## 5. 提交链与门禁修正（如实记录）

- 提交链（0e34d69..0edb207，均已 push）：`73ea947` feat（quotes 端点组+控制台主体）→ `295d637` style（两新文件 prettier）→ `0edb207` fix（quote legacyContext 引用守卫后仓储局部量 + 测试夹具 Date 越界 JsonObject 的定向 cast——CI typecheck 首轮暴露）。
- 门禁修正：G1（820 行）拆出 `quote-forms.tsx`；G3 按门禁指引登记 QUOTES_VIEW_SELECT；G2/G5 动作工厂拆分；S4 无违规。
- ci:local：NODE_ENV=test（kingturf_test），0edb207 干净快照 **EXIT=0 全链**（API 17836 测试；Web 491；coverage/structure/service-boundary/build 守卫/security 全过）。

## 6. 边界与后续

- Fastify 组累计认领 8 路径；approve/issue 命令仍走 legacy /quote-revisions 轨（不在本批指令内）。
- 后续子批：成本矩阵 → CTR → 销售政策 → 信用审查。
- 未 dispatch workflow；未触 `.github/workflows/`。
