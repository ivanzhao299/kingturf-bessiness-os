# U3-CRM-3 联系人端点组 + 控制台联系人创建证据（2026-11-21）

> 授权链：主协调 U3-CRM-2-CP 复核放行 + U3-CRM-3 指令；联系人呈现本就位于客户 360
> 抽屉（U3-CRM-2 已交付），本批补齐 API 桥轨端点与控制台联系人创建表单——无独立
> 退役对象（legacy customer-contacts POST 轨保留双轨）。

## 1. Fastify contacts 端点组（registry 认领 +3，累计 39）

> 累计数纠正（2026-11-21 收官机械复核）：原记「累计 40」为累计笔误（27＋5＋4＋3＝39）。

| 端点                                          | 守恒语义                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/v1/customers/:id/contacts            | additive 只读 `listContacts`（customer360 contacts 同表同谓词；sensitive 联系方式门由仓储按 customer-360:read 字段折叠）；响应仓储直通（无 zod 响应 schema）                   |
| GET /api/v1/customers/:id/contacts/:contactId | additive 只读 `findContact`（customers join 客户作用域门；404 信封含 correlationId）                                                                                           |
| POST /api/v1/customers/:id/contacts           | legacy customer-contacts 同解析链（customer:update contacts 字段授权、email/phone 字符串校验、normalizeContactEmail/Phone 归一化、至少其一）→ 201 + mutationDto(customer:read) |

**PUT 更新如实记录**：legacy 无联系人更新操作（R2 行为守恒：不新增仓储写方法）——PUT 不提供，更新语义属新业务能力待独立人裁。CRM-matcher 503 门属 legacy 轨（依赖缺失时桥不挂载，customer-base 契约已覆盖）。

仓储 additive：`listContacts(customerId, actor, scopes, anchors, sensitive)` + `findContact(contactId, ...)`（requireScopedSubject 客体门保留）。

## 2. 控制台联系人创建（桥轨 POST）

客户抽屉联系人区新增「添加联系人」入口（customer:update 门）+ 表单（姓名必填、title/email/phone、primary 下拉）——经 `controller.createContact`（新增 additive 方法走 legacy POST 轨 web 面，保持与 360 刷新联动）。**联系人呈现保持 360 抽屉内**（U3-CRM-2 已交付，本批零迁移 DOM 变更）。

## 3. 测试

- fastify inject `contacts.test.ts`（7 例：sensitive 门开/关、详情命中+404、POST 归一化载荷、负例四类 legacy 消息、CRM-matcher 门属 legacy 轨说明、DomainError 映射）。
- 契约：customer-contact-route-contract **113/113 无改动即过**（POST legacy 轨回归）。
- 页面测试：customer-console 测试补 createContact 端口（5/5）。

## 4. 门禁回执

| 门禁                                | 结果                                            |
| ----------------------------------- | ----------------------------------------------- |
| API typecheck / lint / fastify+契约 | 0 / 0 / 38+113+103=254 中受影响全绿             |
| Web typecheck / lint / test         | 0 / 0 / **500/500**                             |
| web build                           | 登录关键路径 JS 11750B gzip；console-css 守卫过 |
| structure-gate / service-boundary   | 0 强制违规 / 0 违规                             |
| e2e P1                              | **11 passed / 0 failed（24.7s）、零 500**       |

## 5. 提交与回执（如实记录）

- 提交：`7750b34` feat（本批主体，单提交；过程 typecheck/lint 问题在提交前闭环）。
- ci:local：NODE_ENV=test（kingturf_test），干净快照 **EXIT=0 全链**。

## 6. 边界与后续

- legacy POST /contacts 轨保留；联系人更新待独立人裁（新业务能力）。
- 后续子批：U3-CRM-4 客户活动。
- 未 dispatch workflow；未触 `.github/workflows/`。
