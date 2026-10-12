# ARCHITECTURE.md

> 领域与包分层的顶层地图。依赖方向规则与代码现状一致（验证点见文末，可机械复核）。

## 1. 包分层与依赖方向（现状：干净 DAG，禁止破坏）

```text
apps/web (UI) ────────────────→ packages/ui
apps/api (Runtime+Repo) ──→ packages/{config, database, domain, types}
packages/database ──→ pg（唯一外部运行时依赖）
packages/domain ──→ packages/types
packages/{types, ui, config, testing} ──→ 零依赖
```

**规则**：依赖只能沿上述方向；新增依赖边必须先在本文件登记理由。`packages/` 之间除 `domain→types` 外互不依赖；任何包不得反向依赖 `apps/*`。

## 2. 运行时请求流

```text
浏览器 SPA（原生 DOM，无框架）
  └─ apps/web/src/http.ts（统一封装：15s 超时 + AbortController + correlation-id）
      → 生产 nginx（infra/nginx/erp.kingturf.cn.conf，静态 + /api 反代）
          → apps/api/src/app.ts buildApp（路由分发：校验→授权→编排→DTO）
              → apps/api/src/*-repositories.ts（pg 参数化 SQL + DataScope 谓词 + 审计/outbox 双写）
                  → PostgreSQL 17（packages/database 70 个有序迁移）
```

- 组合根唯一：`apps/api/src/server.ts` 实例化全部仓储并注入 `buildApp`；`app.ts` 对仓储只做 type-only import（依赖倒置）。
- 认证：不透明 token，scrypt 哈希 + 服务端只存 sha256(secret+token)（ADR-0003）；授权：default-deny RBAC + SQL 级 DataScope 谓词（ADR-0004，谓词现状为 12 份拷贝，收敛中，见 TD-DUP-001）。
- 事件：审计与领域事件经事务 outbox 落库（ADR-0006）。

## 3. 业务域地图

**后端（apps/api/src，每域一个 \*-repositories.ts）**：

| 域组       | 域                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台基座   | auth/security、组织员工（repositories.ts）、授权（policy.ts、aggregate-authorization.ts）、foundation（通知/附件/业务对象/事件）、platform（规则/工作流/编号）、website-lead-ingest |
| 商机到报价 | crm（线索）、commercial（商机/方案/报价/信用，2,116 行最大域）、qtc（报价到现金台账）、contract-document、business-document                                                         |
| 履约       | production、manufacturing、mrp、procurement、quality、shipment、complaint                                                                                                           |
| 财务与治理 | collection、commission、risk、dashboard、order-360、production-cost                                                                                                                 |

**前端（apps/web/src，现状单巨石待拆分，见批次 3）**：登录流（entry/login-flow）→ 懒加载工作台（bootstrap.ts 16,082 行 = CRM + commercial 21 子域视图 + governance）；`data-route-view` 子域清单见计划 §4.3。

## 4. 目标分层（改造方向，规则 §4.1 存量适配）

```text
Types → Config → Repo → Service → Runtime → UI
```

- 现状缺口：Repo 之上无 Service 层（`buildApp` 单函数 6,442 行内联编排，TD-API-001）；UI 七层职责压进单文件（TD-WEB-001）。
- 逼近路径：批次 2 建立 `apps/api/src/routes/`（声明式路由）+ `services/`；批次 3 建立 `apps/web/src/{shared,crm,commercial,governance}/`。全部子批次与回滚点见 `docs/exec-plans/active/harness-migration.md` §4。

## 5. 依赖方向验证点（≥3，命令可复核）

1. **app.ts 仓储依赖为 type-only**：`grep -n "import type" apps/api/src/app.ts` → 20 个仓储全部 `import type`（依赖倒置成立）。
2. **包级 DAG 无环**：`pnpm why` 或直接查各 `package.json` 的 dependencies——workspace 内仅有 `domain→types`、`api→{config,database,domain,types}`、`web→ui` 四类边，无反向、无环。
3. **web 侧无反向引用**：`grep -n "from './entry'\|from './main'\|from './workspace-loader'" apps/web/src/bootstrap.ts` → 零命中；`grep -n "from './entry'\|from './bootstrap'" apps/web/src/{dom,http,session}.ts` → 零命中（入口链单向：main→entry→workspace-loader→bootstrap，已实测）。
4. **server.ts 是唯一组合根**：`grep -rln "new.*Repository(" apps/api/src --include='*.ts' | grep -v server.ts | grep -v test` → 仅仓储文件自身与测试，无第二处装配。

> 阶段 3 起上述验证点升级为结构测试（依赖方向边白名单），违规提交被机械拦截。

## 6. 关键决策（ADR 索引）

`docs/adr/0001`~`0010`：TS monorepo 选型、PostgreSQL 与迁移、不透明会话、default-deny RBAC 与 DataScope、版本化平台引擎、事务 outbox、不可变业务对象 schema、P1 CRM 兼容、商务修订图、不可变 Quote-to-Cash 台账。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR 并经人工确认。
