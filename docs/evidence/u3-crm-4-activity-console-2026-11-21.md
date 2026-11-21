# U3-CRM-4 客户活动端点组 + 控制台活动时间线增强证据（2026-11-21）

> 授权链：主协调 U3-CRM-3-CP 复核放行 + U3-CRM-4 指令（CRM 域最后子批）。活动呈现
> 本就位于客户 360 抽屉（U3-CRM-2 基础），本批交付 API 桥轨端点组 + 时间线增强
> （活动类型筛选/时间线渲染修正/创建入口）——legacy POST /activities 轨保留双轨。

## 1. Fastify activities 端点组（registry 认领 +3，累计 42）

> 累计数纠正（2026-11-21 收官机械复核）：原记「累计 43」为累计笔误——COM 收官 27＋CRM 15（leads 5/customers 4/contacts 3/activities 3）＝42；CRM-3 证据「累计 40」同源笔误（应为 39）。

| 端点                                             | 守恒语义                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/customers/:id/activities?type=       | additive 只读 `listActivities`（customer360 activities 同表同谓词同排序同投影——ActivityDto：type=activity_type，不含租户/幂等键列）；`type` 查询参数客户端过滤 |
| GET /api/v1/customers/:id/activities/:activityId | additive 只读 `findActivity`（行 id+customer_id+tenant 绑定单行查询；requireScopedSubject 客体门；404 信封含 correlationId）                                   |
| POST /api/v1/customers/:id/activities            | legacy customer-activities 同解析链（五字段 allow、幂等键 ≤128、DomainError 消息逐字节一致）→ 201 + mutationDto(customer-activity:read)                        |

仓储 additive：`listActivities(customerId, actor, scopes, anchors)` + `findActivity(activityId, customerId, actor, scopes, anchors)`（ActivityDto 投影复用 createActivity/360 同款模块级映射）；`createActivity` 沿用既有（幂等键 advisory lock + conflict 语义不变）。

Date→ISO 归一化：pg timestamptz 经仓储为 Date 对象，GET 轨响应前 `normalizeTimestamps` 显式转 ISO 串（与 legacy JSON.stringify 输出逐字节一致）；POST 轨无响应 schema，Date 经序列化自然 ISO 化（COM 同款口径）。

## 2. 控制台活动时间线增强（桥轨 POST）

- **时间线渲染修正**：U3-CRM-2 基线误用 `activityType`/`subject` 字段名（360 载荷实为 `type`/`summary`，本批修正为与 legacy customer360-view 同字段），类型展示经 `businessEventLabel`（与 legacy 同口径）。
- **活动类型筛选**：≥2 种类型时呈现下拉（选项自当前活动派生、展示经 businessEventLabel）；选择后仅保留匹配行；切换客户时重置。
- **创建入口**：`customer-activity:create` 门 + 「添加活动」表单（类型下拉拜访/电话/邮件/展会、摘要必填、发生时间留空为当前时间）——经 `controller.createActivity`（本批 additive：CrmApi.createActivity → POST `/api/v1/customers/:id/activities` 同一 URL，生产 dispatch 由 Fastify 桥轨认领；幂等键经既有 requestId 面）+ 360 刷新联动。

## 3. 测试

- fastify inject `activities.test.ts`（6 例：列表直通+Date 归一化+作用域门先行、type 筛选、详情命中+404 信封+非 uuid 400 先于仓储、POST legacy 五字段+幂等键透传、负例六类 legacy 消息、DomainError 映射）。
- 契约：customer-activity-route-contract **66/66 无改动即过**（POST legacy 轨回归）。
- 页面测试：customer-console **8/8**（U3-CRM-2 基线 5 例——360 夹具修正为 API 真实字段名；U3-CRM-4 新增 3 例——创建入口权限门/五字段载荷/360 刷新+收起、无权限无入口、类型筛选）；bootstrap/lead-records 测试 double 补 createActivity stub。
- API 全量 **17862/17862**（NODE_ENV=test + kingturf_test）；Web 全量 **503/503**。

## 4. 门禁回执

| 门禁                              | 结果                                      |
| --------------------------------- | ----------------------------------------- |
| API typecheck / lint / build      | 0 / 0 / 过                                |
| Web typecheck / lint / build      | 0 / 0 / 过（console-css 守卫过）          |
| format:check                      | 过（4 文件 prettier 后复检）              |
| structure-gate / service-boundary | 0 强制违规（豁免 29 条存量）/ 0 违规      |
| e2e P1                            | **11 passed / 0 failed（24.1s）、零 500** |

## 5. 提交与回执（如实记录）

- ci:local：NODE_ENV=test（kingturf_test），干净快照 EXIT=0 全链。
- 提交链：`25ac4f0` feat（activities 端点组+registry+控制台增强+测试）→ docs receipt（本文件+索引行）。

## 6. 边界与后续

- legacy POST /activities 轨保留（契约 66/66 回归）；PUT 更新/删除无 legacy 对应，不交付（R2）。
- CRM 域四子批（线索/客户/联系人/活动）全部完成——待主协调做 U3-CRM 整域收口与部署。
- 未 dispatch workflow；未触 `.github/workflows/`。
