# U3-COM-1 商机列表页全栈迁移证据（2026-11-21）

> 授权链：项目所有者第 4–7 次人裁 + 主协调全权 + 并行会话政策；旧 vanilla 视图删除由裁定 17 追认。
> 范围：commercial 商机域首个子批（U3-COM-1，最小切入）——商机列表页 UI Preact 重写 + Fastify API 首端点同批（ADR-0014/0015）。

## 1. 交付物

### API 端（Fastify+Zod 双轨首端点）

| 文件                                                      | 内容                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/routes/fastify/commercial-opportunities.ts` | GET /api/v1/opportunities：zod querystring（limit 1–100 默认 50 / cursor uuid / status 枚举 / customerId uuid）+ 出站 DTO schema（partial 口径兼容字段遮蔽）；经工厂注入授权上下文与仓储，复用 `authorizeQuery`+`permittedDto` 与 node:http 轨同一口径 |
| `apps/api/src/commercial-repositories.ts`                 | 追加 `listOpportunityPage`（keyset cursor 分页，排序键 updated_at,id 与原列表一致；复用 recordScopeSql 共享谓词与既有 dto 映射）；原 `listOpportunities` 逐字未动（行为守恒）                                                                          |
| `apps/api/test/fastify/commercial-opportunities.test.ts`  | inject 正/负例 9 例：默认分页、四参数直传、nextCursor 续传、字段遮蔽；limit 非法/越界、cursor 非 uuid、status 越枚举、customerId 非 uuid 全部 400 且不触仓储                                                                                           |

分页契约与 `routes/qtc-operational-reads.ts` 同口径（uuid keyset + nextCursor）。G3 插值按既有先例以白名单变量 `parameter` 构造 `$N`，零门禁豁免新增。**生产 `server.ts` 未接线**（令牌认证中间件接线属后续子批，双轨并行语义）。

### UI 端（Preact 控制台）

| 文件                                                        | 内容                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/commercial/console/opportunity-list.tsx`      | 商机列表页：PageHeader（标题「商机阶段看板」保持 e2e 黑盒契约）+ 概要度量（在途/逾期/30 天/未关联，复用 .pipeline-metric）+ DataTable 主列表（阶段/金额/赢率/预计成交+逾期标记）+ 查看抽屉（详情+阶段推进 FormSection）+ 新建抽屉（载荷与原 openForm 逐字段同构：customerId null 化、概率 %→基点）+ 刷新；端口层最小面，页面不依赖 SalesViewController |
| `apps/web/src/commercial/console/mount.tsx`                 | 挂载体（宿主动态 import 独立 chunk，登录入口预算不受影响）                                                                                                                                                                                                                                                                                             |
| `apps/web/src/commercial/console-entry.ts`                  | 宿主（governance console-entry 同模式）：静态图并入 tokens/components/commercial-console 三 CSS（裁定15 cssCodeSplit:false 主包链），data-route-view=opportunities + data-testid=kt-commercial-opportunities                                                                                                                                           |
| `apps/web/src/commercial/console/commercial-console.css`    | 页面级布局样式（仅 kt tokens，不写死颜色/间距）                                                                                                                                                                                                                                                                                                        |
| `apps/web/src/commercial/console/opportunity-list.test.tsx` | 白盒行为 7 例：页头/主列表渲染、概要与逾期「今天」口径、create 权限门、create 载荷同构、lifecycle 2 步推进流、无 lifecycle 空态、刷新失败错误面                                                                                                                                                                                                        |

### 路由切换与退役

- `workspace-sales.ts`：`opportunity:read` 分支由 `appendOpportunityView` 切换为 `appendOpportunityConsole`（其余九域视图不动）。
- `opportunity-view.ts`（215 行 vanilla 看板）删除——裁定 17 追认：新视图完全替代且引用清零，不删留死代码。
- `sales-view-ports.ts`：`opportunityPipelineSummary` 类型签名补可选 today 形参（函数本体早已支持，类型对齐）。
- `bootstrap.test.ts`：移除旧看板 DOM 断言（pipeline-board/column/card、overdue 卡片）与 opportunity-view 源绑定；替换为宿主断言（class/data-route-view/data-testid）+ CTR 工作台断言保持；overdue 边界覆盖迁移至页面测试（isOpportunityOverdue 直测 + 渲染标记）。

## 2. 黑盒 e2e P1 前后失败集比对

环境（全部本地、无远程操作）：本 WSL 无 `/opt/google/chrome` 且无 sudo——沿用 wave1 已记录先例（`docs/evidence/wave1-verification-2026-11-18.md` §3a）：仓库外临时配置 `/tmp/pw-e2e-local.config.ts`（同参、去 channel）+ Playwright 自带 Chromium + `LD_LIBRARY_PATH=~/pw-libs`；代理变量 `env -u` 解除；仓库 e2e 配置零改动。

| 轮次                                  | 结果                          | 失败集                                                                           |
| ------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| 基线（改动前 HEAD aa56a2f + 旧 dist） | 9 passed / 2 failed（36.6s）  | `p1-demo.spec.ts:173`（commissions）、`p1-demo.spec.ts:309`（production-orders） |
| 改后（同栈 + 新 dist）                | 10 passed / 1 failed（31.7s） | `p1-demo.spec.ts:173`（commissions）                                             |

**结论：改后失败集 ⊆ 基线失败集，零新增**（基线 production:309 属环境性抖动，改后轮通过）。

环境偏差（如实记录）：基线首跑发现本地 `admin` 口令与演练库哈希不匹配（401）并触发限流 429；按 wave1 §3.1 同款一次性 SQL 先例将本地 admin scrypt 哈希重置为所有者提供的本地口令（仅 kingturf_dev，不入仓库、不触生产）。

## 3. 门禁结果

| 门禁                                          | 结果                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| API typecheck / lint                          | 0 错误（4 警告为 server-fastify.ts demo 既有）               |
| API inject 测试                               | 9/9                                                          |
| Web typecheck / lint                          | 0 错误 0 警告                                                |
| Web 测试                                      | 472/472                                                      |
| web build（预算+console-css 守卫）            | 通过：登录关键路径 JS 11751B gzip；style-\*.css 静态链接核验 |
| structure-gate                                | 强制违规 0（白名单豁免 29 条为存量）                         |
| e2e P1 失败集比对                             | 零新增（§2）                                                 |
| pnpm ci:local（NODE_ENV=test，kingturf_test） | 见提交回执（14 步全链）                                      |

## 4. 边界与后续

- Fastify 轨生产接线（server.ts 装配 + 令牌认证中间件）= 下一子批范围；本批双轨并行，原 node:http 商机路由逐字未动。
- 后续子批顺序（U3-COM 策略）：方案管理 → 报价管理 → 成本矩阵 → CTR → 销售政策 → 信用审查。
- 无新 TD 登记；无 workflow dispatch；未触 `.github/workflows/`。
