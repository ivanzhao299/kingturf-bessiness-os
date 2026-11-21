# U3-COM-2 技术方案控制台 + Fastify 生产接线证据（2026-11-21）

> 授权链：主协调 U3-COM-1-CP 复核放行（0ff66bd 合格）+ Fastify 生产接线裁定（接线为
> U3-COM-2 第一步，后续子批路由都挂进该组）；旧 vanilla 视图退役沿用裁定 17 语义。

## 1. Fastify 生产接线（本批核心）

| 文件                                          | 内容                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/fastify/registry.ts`     | 生产桥：认领清单（method+pathname 正则，与插件注册一一对应）→ 未认领返回 null 落回 legacy 轨；认领请求构建 Fastify 实例（闭包注入逐请求 scope：授权上下文/仓储/关联ID）+ inject 执行 Fastify+Zod 生命周期 + finally close；错误处理对齐 legacy 信封（DomainError→403/404/409/400、zod 校验→400 invalid_request、≥500 透传，均含 correlationId） |
| `apps/api/src/app.ts`                         | dispatch 内 MUST_CHANGE 门之后、legacy 组之前挂 `dispatchFastifyRouteGroup`（dependencies.commercial 存在时）——认证/cookie-CSRF/MUST_CHANGE 全部继承上游管线                                                                                                                                                                                    |
| `routes/fastify/commercial-opportunities.ts`  | 由独立工厂改造为插件式（scope 闭包）；默认 limit 50→**100**（对齐 legacy LIMIT 100）；`nextCursor` 改 optional——无游标时字段缺省，默认请求响应与 legacy `{ items }` 逐键一致（行为守恒）                                                                                                                                                        |
| `apps/api/test/fastify/legacy-parity.test.ts` | **行为守恒单元级证明**：同一仓储 double + 授权上下文 + 请求，分别走 legacy dispatch 与生产桥，`expect(bridged).toEqual(legacy)` 深比对（opportunities 与 technical-solutions 各覆盖 null/遮蔽两组字段投影）                                                                                                                                     |

实现取舍（如实记录）：ALS 逐请求上下文在 light-my-request 生命周期中不可靠（inject 内 getStore() 为 null，首版测试真实暴露），改为**每请求构建实例 + 闭包注入**——正确性优先，实例构建毫秒级且生产仅认领少量低频读端点；后续子批如遇高频端点可换共享实例+上下文绑定方案。

## 2. technical-solutions Fastify 端点组

| 端点                                | 语义                                                                                                                                                                                                              | 守恒                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| GET /api/v1/technical-solutions     | legacy commercialViewRoutes('solutions') 迁移：同 `listCommercialView('solutions')` + 同遮蔽 + 严格 `{ items }`（无分页字段）                                                                                     | 逐键一致（parity 测试证明）      |
| GET /api/v1/technical-solutions/:id | 新增 additive 只读：仓储 `findTechnicalSolutionRevision`（recordScopeSql('o') 与视图轨同口径）                                                                                                                    | 新面（无 legacy 对应）           |
| PUT /api/v1/technical-solutions/:id | 经新修订更新方案：与 legacy POST /:id/revisions 同仓储 `createTechnicalSolutionRevision` 同规则（修订不可变是域模型，PUT 为现代化动词别名；zod strict + assumptions 去重排序与 p.strings 同语义 + uuid 小写归一） | 新动词（legacy POST 轨逐字不动） |

测试 `test/fastify/technical-solutions.test.ts`（8 例）：列表守恒/遮蔽、详情命中/404 信封、PUT 载荷与调用契约、PUT 负例四类全 400 不触仓储、DomainError 状态映射。

## 3. 技术方案 Preact 控制台

| 文件                                                   | 内容                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/commercial/console/solution-console.tsx` | PageHeader（标题「技术方案」保持 APP_ROUTE_LABELS 契约）+ 状态筛选 chips/编号检索（客户端）+ 客户端分页（DataTable 继续加载）+ 查看抽屉（规格 11 字段含**上一版差异标记**、工程假设）+ 行级操作（编辑=保存新修订 PUT final:false；定稿发布=PUT final:true）+ 新建抽屉（opportunityId 由已批准 CTR 推导，payload 与 vanilla solutionPayload 逐字段同构）+ 刷新 |
| `apps/web/src/commercial/console/solution-ports.ts`    | 端口层最小面（textValue/formValue/displayRequirement 与 business-format 同语义）                                                                                                                                                                                                                                                                              |
| `console/mount.tsx`                                    | 扩为 route→page 映射（opportunities + technical-solutions）                                                                                                                                                                                                                                                                                                   |
| `console-entry.ts`                                     | `appendSolutionConsole`（createConsoleHost 共享助手）                                                                                                                                                                                                                                                                                                         |
| `workspace-sales.ts`                                   | technical-solution:read 分支切换至 `appendSolutionConsole`；`solution-view.ts`（297 行）删除（裁定 17 语义：新视图完全替代且引用清零）                                                                                                                                                                                                                        |
| `types.ts`/`store/controller.ts`/`sales-view-ports.ts` | submit 方法面加宽 'PUT'（additive；commercial-http 透传）                                                                                                                                                                                                                                                                                                     |

页面测试 `solution-console.test.tsx`（9 例）：渲染、筛选/检索、客户端分页、create 权限门（含无已批准 CTR 分支）、编辑 PUT 载荷、定稿 final:true、新建 POST 载荷+opportunityId 推导、无 update 权限空态、刷新失败错误面。

## 4. 黑盒 e2e P1 比对与接线事故（如实记录）

同 U3-COM-1 环境（wave1 §3a chromium 先例 + 本地口令）。基线（COM-1 后 0ff66bd + 新 dist）：10 passed / 1 failed（`p1-demo.spec.ts:173` commissions，既有环境性）。

**接线事故**：首轮改后 e2e 每测 3×GET 500（openAuthenticatedWorkspace 阻断，11/11 失败）。根因：node-pg 默认将 **timestamp 与 date 列均解析为 JS Date 对象**——legacy 轨靠 server.ts `JSON.stringify` 隐式转 ISO 字符串，而桥轨的 zod 响应校验（type-provider-zod serializer）对 z.string() 字段遇到 Date 抛 `FST_ERR_RESPONSE_SERIALIZATION` → 500。诊断经带真实 PG 数据的离线脚本复现（`FST_ERR_RESPONSE_SERIALIZATION`）。修复：桥轨 handler 在 zod 响应校验前**通用归一化任意 Date→toISOString**（与 legacy JSON 输出逐字节一致）；parity 测试夹具改用真实 Date 对象 + legacy 侧 JSON round-trip，锁定此类缺陷。

修复后改后 e2e（0ff66bd 源 + 本批 dist，**web 商机加载已真实走 Fastify 桥**）：**11 passed / 0 failed（24.5s）**，优于基线（基线含 1 环境抖动败），零 500。

## 5. 门禁结果

| 门禁                                  | 结果                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| API typecheck / lint                  | 0 错误（4 警告为 server-fastify.ts demo 既有）                                                 |
| API 测试（含 PG 集成，NODE_ENV=test） | 全绿（fastify 15/15：桥契约 7 + solutions 8；legacy-parity 2 例含在 solutions 文件外单独文件） |
| Web typecheck / lint                  | 0 错误 0 警告                                                                                  |
| Web 测试                              | 481/481                                                                                        |
| web build（预算+console-css 守卫）    | 通过（登录关键路径 JS 11752B gzip）                                                            |
| structure-gate                        | 强制违规 0（G3 插值按既有白名单先例）                                                          |
| pnpm ci:local                         | 见 §6 提交回执                                                                                 |

## 6. 提交与回执

- 提交：见 git log `feat(commercial): wire fastify route group into production and migrate solution console [已测试]`
- ci:local：NODE_ENV=test（kingturf_test），干净提交快照，EXIT=0 全链
- e2e P1：11 passed / 0 failed（优于基线，接线事故修复后复跑）
- 未 dispatch workflow；未触 `.github/workflows/`

## 7. 边界与后续

- Fastify 组当前认领 4 路径（opportunities GET / solutions GET/GET 详情/PUT）；后续子批新路由挂进同一认领清单+注册对。
- legacy 轨 opportunities GET 与 solutions GET 仍在（双轨并行，认领路径实际不再到达 legacy）；legacy 退役（删除）待全子批迁移完成后统一裁定。
- 后续子批：报价管理 → 成本矩阵 → CTR → 销售政策 → 信用审查。
