# U3-COM-6 销售政策控制台 + Fastify sales-policies 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM-5-CP 复核放行 + U3-COM-6 指令；旧 vanilla policy workbench
> 退役沿用裁定 17 语义（policy-view.ts 301 行引用清零——矩阵区已随 COM-4 分离）。

## 1. Fastify sales-policies 端点组（registry 认领 +4，累计 21）

| 端点                                    | 守恒语义                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/sales-policies              | 视图轨迁移：listDefinitions('policy') + strict { items }——**无 permittedDto**（legacy 定义轨不裁字段，契约 'read fields do not crop raw data' 钉死） |
| GET /api/v1/sales-policies/:id          | additive 只读 `findDefinition('policy', id)`（根+全部版本行）                                                                                        |
| POST /api/v1/sales-policies             | legacy `definitionInput` 同解析链（commercial-definitions 导出复用）→ 201 直通（frozen 契约消息逐字节一致）                                          |
| PUT /api/v1/sales-policies/:id/versions | legacy POST /:id/versions 的现代化动词别名（definitionVersionInput 同链，publish 旗标承载发布语义）→ 200 直通                                        |

**桥序列化关键修复**：undefined 值键序列化为 null（JSON.stringify 默认丢弃 undefined 键，而 legacy allow/字段授权按 Object.keys 判定键存在性——契约 'publish: undefined → Field permission denied' 真实暴露）。jsonUndefinedToNull 类型化 replacer（no-unsafe-return 合规）。cost-models 轨零改动。

## 2. 销售政策 Preact 控制台

- `policy-console.tsx` + `policy-ports.ts`：政策列表（状态筛选/编号检索/客户端分页）+ 详情抽屉（**毛利规则渲染**（最低毛利/最大折扣基点→百分比）/版本历史）+ 行级操作 vanilla 全集：新建销售政策（POST 桥轨，规则构造独立 oracle 保持）、新建政策版本（PUT versions 桥轨，仅最新版门）、政策评估（legacy POST /sales-policy-evaluations + 评估门三重：权限/PUBLISHED 政策/成本决策可用性）+ 判定卡片（政策通过/未通过/审批要求/规则命中/基点边界/输入哈希）。
- 路由切换：workspace-sales sales-policy:read 分支 → appendPolicyConsole；`policy-view.ts` 退役。

## 3. 测试

- fastify inject+契约：commercial-definition-contract 79/79（POST create 经桥后无改动即过；首轮 3 败=GET 字段裁剪+undefined 键序列化，修复后全绿）。
- 页面测试：`policy-view-behavior.test.ts` 重写为控制台行为面（7 例：创建规则 oracle（2055/1026 基点独立 oracle 保持）/版本门 latest-first 两序/评估门三重/评估载荷/判定卡片渲染含规则命中与哈希）。

## 4. 门禁回执

| 门禁                              | 结果                                                                       |
| --------------------------------- | -------------------------------------------------------------------------- |
| API typecheck / lint / 契约       | 0 / 0 / 79/79                                                              |
| Web typecheck / lint / test       | 0 / 0 / **488/488**                                                        |
| web build                         | 登录关键路径 JS 11749B gzip；console-css 守卫过                            |
| structure-gate / service-boundary | 0 强制违规 / 0 违规                                                        |
| e2e P1                            | **11 passed / 0 failed（25.6s）、零 500**——销售政策列表已真实走 Fastify 桥 |

## 5. 提交与回执（如实记录）

- 提交：`f285837` feat（本批主体，单提交；过程 typecheck/lint 问题在提交前闭环）。
- ci:local：NODE_ENV=test（kingturf_test），干净快照 **EXIT=0 全链**。
- 过程中契约测试暴露并修复两处：GET 列表 permittedDto 裁剪（legacy 定义轨返回原始行——契约 'read fields do not crop raw data' 钉死）与 undefined→null 桥序列化。

## 6. 边界与后续

- legacy commercial-definitions 轨完整保留（cost-models 双端点 + sales-policies POST versions/双读端点共享解析链助手）。
- sales-policy-evaluations 端点保持 legacy（不在本批指令内）。
- 后续子批：信用审查。
- 未 dispatch workflow；未触 `.github/workflows/`。
