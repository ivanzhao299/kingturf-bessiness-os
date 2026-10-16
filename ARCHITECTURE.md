# ARCHITECTURE.md

> 领域与包分层的顶层地图。依赖方向规则与代码现状一致（验证点见文末，可机械复核）。

## 1. 包分层与依赖方向（现状：干净 DAG，禁止破坏）

```text
apps/api (Runtime+Repo) ──→ packages/{config, database, domain, types}
packages/database ──→ pg（唯一外部运行时依赖）
packages/domain ──→ packages/types
packages/{types, config} ──→ 零依赖
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

**前端（apps/web/src，批次3小步拆分中）**：登录流（entry/login-flow）→ 懒加载工作台（bootstrap装配→commercial 21主视图已迁，入口仍含共享编辑器/列表工具/装配与governance/controller）；旧基线16,082 split行，3a完成15,243，3b完成13,757，未结清巨石债务。运行依赖单向：`bootstrap→crm/{controller,records,shell-frame}`，records→customer/lead-records→shared/forms/dom；`bootstrap→shared/{forms,locale,navigation,crm-http,commercial-http,document-library,contextual-documents}`。类型经crm/types、commercial/types、shared/shell-types作type-only桥接；bootstrap保留70原公开绑定，shared/CRM不反向import入口，必要plain函数引用ports不提前读取权限/缓存/会话。3b源码487d698已稳定干净HEAD完整CI0；能力读源已由用户授权47a8ee5、独立门禁36b1153改为按排除策略纳入的入口静态运行时TS图，不宣称完整动态调用可达性；各步证据/回滚见计划§4.3及§7。 3c①完成入口12,968 split，三视图经 `bootstrap→commercial/{opportunity-view,ctr-view,solution-view}→shared/forms与dom` 装配，sales-view-ports只结构type描述原controller，不搬God store或复制动态状态；原root rebuild回调仅在原提交后时点调用，模块无反向运行import。源码a34df41稳定干净实际HEAD完整CI0，商业其余18视图及共享残留继续按既定组拆分。

## 4. 目标分层（改造方向，规则 §4.1 存量适配）

3c⑦共享装配候选：`bootstrap→commercial/workspace-*→原各域view`，8runtime/1type以readiness/dashboard/分组guard/route标注/legacy panels真实职责拆分；root5203、商业函数160，最大新file300/完整函数148/AST5。保持root ports/rebuild箭头创建点、共享risk槽同ref、两次独立children读取与legacy listener时点；10逆展开/21导入边/70公开457链/八目标红绿及旧新29齐，提交后实际HEAD全CI待跑。editor/listtools等共享残留及3d–3f未结清，详见[⑦证据](docs/evidence/frontend-3c7-commercial-assembly-2026-10-16.md)。

3c⑥实施与独立复核完成：源码3f77a81实际干净HEAD全CI0/170456.489ms、独立工具830d1fb同口径0/177187.409ms；28新TS≤221/完整函数143/AST5/root5848，36逆展开/70公开457链/27红绿/旧新11/两次无trace28齐，TD006工具收口。21商业主视图已迁不等于共享editor/listtools/装配或3d/3e/3f完成，完成docs全CI后继续共享职责；只读卡不当写矩阵/Playwright，失败史/残余边界及回滚见[⑥证据](docs/evidence/frontend-3c6-operations-2026-10-16.md)，下方⑤段为其时点历史。

3c⑤完成：源码00766d6稳定干净实际HEAD全CI0/175184.510ms，8runtime/1type≤232/完整函数116/AST5，入口8129 split，17/21商业主视图已迁，余四及共享残留续⑥。15helper逆展开/70公开457链/八目标红绿、旧新16与组合24齐；只读合成覆盖不替代真实写矩阵/Playwright，不修TD-WEB-004，详见资金风险证据；下方候选段保留时点历史。

3c⑤候选：资金风险五原分支拆8runtime/1type，沿原`bootstrap→commercial→forms/dom`，root8129 split，file≤232/完整函数116/AST5。原cashRiskSummary早装配、两套逾期判定、渲染快照/点击live数据、佣金/风险政策不同发布链及风险槽同ref不改；实际15helper逆展开/70公开457链/八目标红绿/旧新组合16齐，完整提交后HEAD CI待实跑。见[资金风险证据](docs/evidence/frontend-3c5-finance-risk-2026-10-16.md)，未结清巨石或扩TD-WEB-004修复。

3c④完成：源码6ade731稳定干净实际HEAD全CI0/182166.585ms，11runtime/1type≤231/完整函数165/AST5、入口9046 split，12/21商业主视图已迁（另制造成本残留）、余9及共享残留续⑤。21helper＋原type/predicate逆展开/70公开457链/11目标红绿/旧新展开11与组合19齐，14不同route不泛化全部21视图或Playwright。原权限定界与共享risk槽同ref不改，详见订单履约证据；下方候选段保留历史。

3c④候选：四订单履约主视图及相邻制造成本残留沿`bootstrap→commercial→forms/dom`分为12新TS（11runtime/1type），root9046 split、新file≤231/完整函数165/AST5；order360创建风险槽的root原位赋值与后风险面板消费同ref保持，双生产面板同route/独立权限不改。完整原权限union与isCommercialPermission同置permissions.ts，经root真实运行导入/原名type-value facade，不扩大静态图/前缀，不修TD-WEB-004；首pure-type图排除失败及修正史留证。21处逆展开＋两声明还原/70绑定457链、11目标红绿/旧展开11已绿，新浏览器/实际HEAD全CI待跑，见[订单履约证据](docs/evidence/frontend-3c4-fulfillment-2026-10-16.md)。

3c③完成：信用/合同沿同单向依赖新增3runtime职责模块及type-only端口，root10535 split；新文件≤196/完整函数147/AST5，六原词法函数引用和原controller不复制，实际7处逆展开保持整入口AST。源码e401d27稳定干净实际HEAD全CI0/182693.526ms，旧新9及组合15只读卡片CDP绿，不算文档行/OCR/上传覆盖。TD-WEB-004仅登记，旧权限投影不修；commercial余13主视图及共享残留续④，未结清巨石或搬store，见[信用合同证据](docs/evidence/frontend-3c3-agreements-2026-10-16.md)。

3c②完成快照：成本/政策/报价12模块沿 `bootstrap→commercial→shared/forms/dom`，pricing结构type只描述原controller/静态端口；root10972 split，新模块≤610/完整函数135/AST5，原引用/动态权限/局部重绘/提交顺序及整入口逆展开保持。源码9429a31、独立测试driver3f3aae7均稳定干净HEAD完整CI0；两次无trace合并13/8不同路由不代表全21域或Playwright，原失败史保持。商业其余15主视图及共享残留继续既定组；未结清root巨石或搬God store，见成本政策报价完成证据。

3c②现时后补：源码9429a31稳定干净HEAD全CI真实0；自有CDP driver可靠性独立候选不增加业务依赖边，旧红→新driver10/总16及无trace合并13绿，工具HEAD全CI待核。业务源码不随工具修正改动；旧失败与有限竞态保留，详见成本政策报价证据。

3c②候选已将成本/政策/报价沿同方向拆为commercial内12个真实职责/结构type模块，入口10972 split，新模块最大610/完整函数135/AST5；原controller/permissions/cache引用、矩阵局部替换与各提交顺序保留，实际37处逆展开旧入口AST/70绑定/457断言同。局部门禁绿，诊断CDP13绿但无诊断两次导航超时及driver稳定取点待单责闭环；不将候选称整批完成。现时证据：[成本政策报价](docs/evidence/frontend-3c2-pricing-2026-10-16.md)。

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

2e护栏先行（2026-10-16）：`pnpm service:check`以TypeScript AST/类型检查服务仅依赖已登记仓储端口实现或packages、仓储不得反向依赖Service、Runtime同入口不得跨仓编排；接入ci:local，无业务Service迁移。单仓路由继续直调Repo，不添加透传层。真实库存、静态能力边界及注入验证见[Service边界护栏](docs/engineering/service-boundary-guard.md)；该护栏不代表上述所有历史架构验证点均已机械覆盖，也不修TD-GATE-003。

`docs/adr/0001`~`0010`：TS monorepo 选型、PostgreSQL 与迁移、不透明会话、default-deny RBAC 与 DataScope、版本化平台引擎、事务 outbox、不可变业务对象 schema、P1 CRM 兼容、商务修订图、不可变 Quote-to-Cash 台账。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR 并经人工确认。
