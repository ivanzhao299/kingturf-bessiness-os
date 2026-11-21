# U3-CRM-2 客户管理控制台 + Fastify customers 端点组证据（2026-11-21）

> 授权链：主协调 U3-CRM-1-CP 复核放行 + U3-CRM-2 指令；旧 vanilla customer-records
> 客户区退役沿用裁定 17 语义（customer-records.ts 保留客户区装配——本批移除其客户
> 列表部分改挂控制台；customer360-view.ts 独立保留）。

## 1. Fastify customers 端点组（registry 认领 +4，累计 36）

| 端点                          | 守恒语义                                                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/customers         | 视图轨迁移：listCustomers + strict { items, nextCursor: null } + permittedDto(customer:read)——与 legacy 读轨同口径                                                                                                                                               |
| GET /api/v1/customers/:id     | legacy customerDetailRoutes 同链（findCustomer + 字段裁剪；404 信封含 correlationId）                                                                                                                                                                            |
| GET /api/v1/customers/:id/360 | legacy customer-360 路由同链：双授权（customer:read + customer-360:read）、sensitive 联系方式门（contacts.email/phone 字段裁剪）、分区授权折叠（ownership/leads/opportunities/activities）、投影 **projectCustomer360Result 导出复用**——响应与 legacy 逐字节一致 |
| POST /api/v1/customers        | legacy customer-base 同解析链（customer:create + allow 三字段 + strings 解析）→ 201 + mutationDto(customer:read)                                                                                                                                                 |

**PUT 更新为 API 桥轨端点预留**（legacy web 无既有编辑表单——控制台不提供编辑，submit 端口对非 POST 方法拒绝以防误调；lifecycle PATCH 轨不动）。customer-base/ownership/activity/lifecycle 契约 332/332 无改动即过（POST/详情经桥后回归绿）。

## 2. 客户管理 Preact 控制台

- `customer-console.tsx` + `customer-ports.ts`：客户主列表（状态筛选/名称编号检索/客户端分页）+ 详情抽屉（打开即异步拉取客户 360：联系人/活动时间线/商机关联）+ 新建客户（POST 桥轨，tags 逗号切分为字符串数组与 legacy strings 解析同构）+ 刷新。
- G2 压平：360 详情加载提取为模块级 `loadDetail` 助手（Signal bundle 参数化）；G5：fail 助手模块级化。
- 退役：`customer-records.ts` 客户列表部分改由控制台承载（customer360-view.ts 独立视图保留，bootstrap.ts 行数不变）。

## 3. 测试

- fastify inject+契约：customer-base/ownership/activity/lifecycle + fastify 全绿（332/332 中受影响全过）。
- 页面测试：`customer-console.test.tsx`（5 例：渲染/360 异步拉取与三区渲染/筛选检索/创建载荷（tags 切分）/权限门+刷新失败错误面）。

## 4. 门禁回执

| 门禁                              | 结果                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| API typecheck / lint / 契约       | 0 / 0 / 332/332                                                        |
| Web typecheck / lint / test       | 0 / 0 / **500/500**                                                    |
| web build                         | 登录关键路径 JS 11751B gzip；console-css 守卫过                        |
| structure-gate / service-boundary | 0 强制违规 / 0 违规                                                    |
| e2e P1                            | **11 passed / 0 failed（26.2s）、零 500**——客户列表已真实走 Fastify 桥 |

## 5. 提交链与 CRM-matcher 503 门修复（如实记录）

- 提交链（b10759d..本批 HEAD）：`779c32f` feat（主体）→ `2979cfe` fix（CRM-matcher 门：legacy 契约钉定 CRM 依赖缺失 503 先于权限校验——桥轨客户处理器改为仓储门先行，frozen 消息保持逐字节；首轮 ci 失败即此）。
- ci:local：NODE_ENV=test（kingturf_test），干净快照 **EXIT=0 全链**。

## 6. 边界与后续

- legacy customer-base/360/lifecycle/contacts/activities/ownership 轨完整保留（双轨并行）。
- 后续子批：U3-CRM-3 联系人 → CRM-4 客户活动。
- 未 dispatch workflow；未触 `.github/workflows/`。
