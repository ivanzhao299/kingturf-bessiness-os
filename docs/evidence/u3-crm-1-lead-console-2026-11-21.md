# U3-CRM-1 线索控制台 + Fastify leads 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM 收口确认 + U3-CRM 域启动 + U3-CRM-1 指令；旧 vanilla
> lead-records 列表退役沿用裁定 17 语义（crm-records 装配中的线索区移除；
> lead-records-behavior.test.ts 重写为控制台行为面）。

## 1. Fastify leads 端点组（registry 认领 +5，累计 32）

| 端点                        | 守恒语义                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/leads           | 视图轨迁移：listLeadPage（additive keyset，ORDER BY created_at,id 与 listLeads 一致）+ status 筛选 + 默认 limit=100；looseObject 透传 + Date 归一化（COM 同款）                                                                                                                                         |
| GET /api/v1/leads/pool      | 同上（pool=true → CRM_SCOPE_POOL + POOL 谓词，lead-pool:read 能力）                                                                                                                                                                                                                                     |
| GET /api/v1/leads/:id       | additive 只读 `findLead`（listLeads 同谓词单行）                                                                                                                                                                                                                                                        |
| POST /api/v1/leads          | legacy leadCreateRoutes 同解析链（allow 四字段/解析/201 + mutationDto(lead:read)）                                                                                                                                                                                                                      |
| PUT /api/v1/leads/:id/state | 现代化统一动作端点：action 分派——claim（lead-pool:claim+幂等键+expectedVersion）、transition（lead:lifecycle+status/reason）、assign/reassign（lead:assign/reassign+assigneeId）、release（lead-pool:release+POOL/CLAIMED 锁定）；全部沿用 legacy lead-commands/lead-claim 消息。legacy POST 轨逐字不动 |

仓储：`listLeadPage`（additive keyset）/ `findLead`（additive 单行）。CRM 域认证走 CrmController.api（fetchCrmApi），行为守恒经契约无改动通过（lead-base/lead-claim/lead-command 262/262）。

## 2. 线索 Preact 控制台

- `lead-console.tsx` + `lead-ports.ts`：线索主列表（状态筛选/标题来源检索/客户端分页）+ 详情抽屉（状态/来源/负责人/关联客户/创建时间）+ 行级操作 vanilla 全集：新建（POST 桥轨）、认领（PUT state claim，原始版本化 POOL 对象语义保持）、变更状态（transition，QUALIFIED/DISQUALIFIED/CONVERTED）、分配/改派（assign/reassign 按 ownerId 判别，employeeChoices 下拉）、释放公海（release，POOL/CLAIMED 锁定）。
- 装配：bootstrap `createCrmShell` 不动；`crm/records.ts` 装配中线索区改挂 `appendLeadConsole(content, controller)`（visibleCrmSections.leads 门保持；bootstrap.ts 保持 799 行——结构门禁 G1 内）。
- 退役：`lead-records.ts` 从 crm-records 装配移除（文件保留至 CRM 域全部子批收官统一清理——customer-records 共享 record-ports 类型）。

## 3. 测试

- fastify inject+契约：lead-base/lead-claim/lead-command 契约无改动通过 + fastify 38/38。
- 页面测试：`lead-console.test.tsx`（7 例：创建载荷 oracle（pool:true+customerId:null）/认领原始版本化对象/变更状态载荷/分配改派释放门与载荷/权限不足空操作/筛选检索/刷新失败错误面）——原 lead-records-behavior 逐条等价迁移。

## 4. 门禁回执

| 门禁                                | 结果                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| API typecheck / lint / fastify+契约 | 0 / 0 / 262+38=300 中受影响全绿                                        |
| Web typecheck / lint / test         | 0 / 0 / **495/495**                                                    |
| web build                           | 登录关键路径 JS 11748B gzip；console-css 守卫过                        |
| structure-gate / service-boundary   | 0 强制违规（bootstrap 799 行）/ 0 违规                                 |
| e2e P1                              | **11 passed / 0 failed（24.1s）、零 500**——线索列表已真实走 Fastify 桥 |

## 5. 边界与后续

- legacy lead-base/claim/commands 轨完整保留（双轨并行）。
- 后续子批：U3-CRM-2 客户管理 → CRM-3 联系人 → CRM-4 客户活动。
- 未 dispatch workflow；未触 `.github/workflows/`。
