# U3-COM-5 CTR 控制台 + Fastify ctr 端点组证据（2026-11-21）

> 授权链：主协调 U3-COM-4-CP 复核放行 + U3-COM-5 指令；旧 vanilla ctr workbench
> 退役沿用裁定 17 语义（ctr-view.ts 479 行引用清零；ctr-fields.ts 保留共享）。

## 1. Fastify ctr 端点组（registry 认领 +4，累计 17）

| 端点                               | 守恒语义                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/v1/ctrs                   | 视图轨迁移：listCommercialView('ctrs') + strict { items } + permittedDto——与 solutions 同款零漂移（commercial-view 契约 ctrs case 无改动即过）                                                                                                               |
| GET /api/v1/ctrs/:id               | additive 只读 `findCtr`（根信息+全部版本行；CTRS_VIEW_SELECT 提取为共享常量，G3 白名单按指引登记）                                                                                                                                                           |
| POST /api/v1/ctrs                  | legacy ctrCreateInput 同解析链（bodyAndGrant 导出复用）→ 201 + mutationDto（frozen 契约消息逐字节一致）                                                                                                                                                      |
| PUT /api/v1/ctr-versions/:id/state | **状态流转现代化端点**：ctrStateInput 同解析链按 action 分派——submit → submitCtr（expectedVersion/幂等键），decide → approveCtr（decision 枚举/理由）；action 非法/枚举非法/缺幂等键全部沿用 legacy 消息。legacy POST submit/decision/attachments 轨逐字不动 |

仓库：`CTRS_VIEW_SELECT` 共享常量（两处复用）+ `findCtr` additive 方法。**桥补关键修复**：原始请求头透传（幂等键/关联ID 等 legacy 解析链依赖项经 inject headers 透传——CTR 命令端点依赖幂等键，缺失即 400）。

## 2. CTR Preact 控制台

- `ctr-console.tsx` + `ctr-ports.ts`：列表（状态筛选/编号检索/客户端分页）+ 详情抽屉（需求规格 11 字段含**版本差异标记**、技术方案关联、附件计数、快照哈希）+ 行级操作 vanilla 全集：新建（POST 桥轨）、提交评审（PUT state submit）、批准/驳回（PUT state decide，驳回含敏感词确认勾选——B3 语义保持）、新建修订（legacy POST /versions，最新版门）、上传附件（legacy uploadCtrAttachment，仅 DRAFT+update+attachment:manage 三重门）。
- 路由切换：workspace-sales ctr:read 分支 → appendCtrConsole；`ctr-view.ts` 退役。

## 3. 测试

- fastify inject `ctr.test.ts`（7 例：视图键守恒/详情+404/POST trim 链/submit 分派含幂等键与 scopes/decide 枚举+trim/负例 legacy 消息/DomainError）。
- 契约：ctr-route-contract 166（POST create 经桥后无改动即过）+ commercial-view-route-contract（ctrs case）全绿。
- 页面测试：`ctr-view-behavior.test.ts` 重写为控制台行为面（9 例：空态/创建载荷 oracle/修订门+预填/非最新门/上传门/上传载荷/PUT state 提交+失败呈现/批准/驳回确认勾选）——原 303 行行为断言逐条等价迁移（创建/修订 requirements 载荷独立 oracle 保持；提交/批准/驳回由 legacy POST 改 PUT state 轨）。

## 4. 门禁回执

| 门禁                                | 结果                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| API typecheck / lint / fastify+契约 | 0 / 0 / **253+166=419** 中受影响 166+38 全绿                           |
| Web typecheck / lint / test         | 0 / 0 / **488/488**                                                    |
| web build                           | 登录关键路径 JS 11748B gzip；console-css 守卫过                        |
| structure-gate / service-boundary   | 0 强制违规（CTRS_VIEW_SELECT 按指引登记）/ 0 违规                      |
| e2e P1                              | **11 passed / 0 failed（24.6s）、零 500**——CTR 列表已真实走 Fastify 桥 |

## 5. 边界与后续

- legacy ctr.ts 三命令端点（submit/decision/attachments）+ POST /versions + nested reads 全部保留在轨（双轨）。
- 后续子批：销售政策 → 信用审查。
- 未 dispatch workflow；未触 `.github/workflows/`。
