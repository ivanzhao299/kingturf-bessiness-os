# UI 基座计划（ui-foundation-program-2026-11-19）

> 执行载体：TD-UI-001；架构决策：[ADR-0014](../adr/0014-frontend-component-layer-and-framework.md)。本计划是 U0-U4 全部批次的范围/检查点/度量/迁移政策单一来源；每批进度与回滚点记于 §7。

## §0 第四次人裁要点（授权边界）

- 2026-11-19 项目所有者第四次人裁：项目视为**实习生 AI coding 练手**；**解除 core-beliefs #8「禁止大爆炸重构」约束**（仅限本计划，ADR-0014 治理，core-beliefs #8 已加注记）；授权主协调代理**全权执行全项目设计/开发/UI/UX**——批准 U0 立项、TD-UI-001、ADR-0014 允许轻量框架、U2 试点=governance 及一切必要操作。
- **监督模式**：主协调 + 哨兵 + 检查点（UI-CP1..UI-CP5）+ **绝对止损**——任何 FAIL 停止即报，不得自行续修。
- **主协调已裁（不再议）**：框架=Preact+@preact/signals（仅此 2 个运行时依赖，落 `packages/ui`；零新构建工具链；tsconfig `jsx: react-jsx` + `jsxImportSource: preact`）；迁移策略=分域彻底重写而非全站一次性大爆炸。
- **工程规则**：红→绿先行；每提交单一职责 Conventional Commits + 完整 `pnpm ci:local` + `[已测试]` 标注；先提交后验证、status 树干净、禁 force-push；SQL 全参数化；既有 governance/业务页面在 U0/U1 两批零改动（U2 等 UI-CP1 复核后另下指令）；push 允许（前向快进）。
- **第五次人裁（2026-11-19，UI-M0b 追加）**：前端或后端技术栈/框架有问题可按主协调经验与行业主流方案设计重构，不过于依赖现有项目设计内容。已裁定并落盘 [ADR-0015](../adr/0015-backend-incremental-modernization.md)：增量引入 **Fastify（HTTP 壳）+ Zod（schema 校验，恰 3 个新运行时依赖落 apps/api）**；分域迁移策略升级为**分域全栈迁移**——自 U3 起每域迁移=UI Preact 重写+该域 API 路由 Fastify/zod 化**同批完成**；U2 governance 试点（UI-M2）仍纯 UI；参数化 SQL 仓储/DataScope 下推/ADR-0003 认证/审计 outbox/CI 发布链保留，不引 ORM；TD-BOUND-002 迁移路径已裁决（随分域清偿）。
- 本地环境：`export NODE_ENV=test DATABASE_URL="postgresql://kingturf:local-development-only@localhost:5432/kingturf_test"`。

## §1 背景（问题定义）

人工验收发现 governance 子页仍为卡片墙堆叠；全站前端五缺口（详见 ADR-0014 背景）：①无 UI 基座 ②dashboard 范式泄漏 ③渲染领域耦合 ④无设计 tokens ⑤组件层缺失。登记为 TD-UI-001（P1），本计划为清偿载体。

## §2 路线 U0-U4

### U0 规范落盘（docs 批，单提交）

ADR-0014、本计划、台账顶部登记段+TD-UI-001、core-beliefs #8 注记、ARCHITECTURE §1 依赖边登记、docs/index.md 同步。
**DoD**：`doc:lint` 0 + 完整 `pnpm ci:local` 0 + 提交 `docs(ui): authorize ui foundation program and adr-0014 [已测试]` + push。

### U1 基座原语（代码批，UI-M0 全绿后连续执行）

1. `packages/ui`：依赖 `preact`+`@preact/signals`；`src/tokens.css`（色彩/间距/字阶/圆角/阴影 token，暗色变量预留）；`src/index.ts` 导出全部原语。
2. 原语（每个配行为测试，红→绿）：`PageHeader`、`DataTable`（列定义/排序/行选择/批量操作栏/接入既有 cursor 分页契约 limit+nextCursor 继续加载/空态错态加载态）、`DetailDrawer`（焦点陷阱/Esc/aria）、`ActionBar`、`TreeSelect`（组织树）、`FormSection`（兼容既有表单校验语义）、`StatusBadge`、`EmptyState`。
3. 演示页 `#/ui-kit` 路由（仅持 `authorization:read` 可见）渲染全部原语实例，作为视觉验收载体；不得进入登录入口 chunk（启动预算守恒）。
4. 结构门禁纳管 `packages/ui`。
   **DoD（=UI-CP1）**：完整 `pnpm ci:local` 0；提交 `feat(ui): add component foundation primitives and design tokens [已测试]`；push；**停 UI-CP1 报告**（原语清单+测试结果+demo 路由说明+`pnpm why` 证明仅 2 个新依赖）。

### U3 前置：U2 governance 试点主从化（UI-CP1 复核通过后另下指令）

- **身份页** = 用户主列表 + 详情抽屉聚合 profile/角色/授权；
- **组织页** = 左树右表；
- **审计** = 查询工作台。
  **DoD（=UI-CP2）**：三页按四类解剖模板对表 100% 合规；授权角色操作 5→2 步度量达标（§4）；governance 域既有行为测试同批重写并双标签注明（§5）；完整 `pnpm ci:local` 0。

### U3 commercial+CRM 分域全栈迁移（UI Preact 重写 + 该域 API 路由 Fastify/zod 化同批完成；捆绑 TD-WEB-001 巨石债与 TD-BOUND-002 分域清偿，ADR-0015）

**每域=UI Preact 重写+该域 API 路由 Fastify/zod 化同批完成（ADR-0015 分域全栈迁移）**；UI 侧按列表族→详情族→配置族分批迁入组件层，`apps/web/src/bootstrap.ts` 巨石（TD-WEB-001）随迁移批次逐域消解；每域独立提交可单独 revert。
**DoD（=UI-CP3/U3 中段、UI-CP4/U3 收尾）**：已迁域解剖合规率 100%；启动预算门禁全程守恒；TD-WEB-001 关闭条件按台账口径另核；完整 `pnpm ci:local` 0。

### U4 门户统一

登录/工作台外壳/导航统一组件化；暗色主题落地评估（tokens 已预留）。
**DoD（=UI-CP5）**：门户域测试同批更新；全站解剖合规率复核（§4）；完整 `pnpm ci:local` 0。

## §3 页面解剖模板（四类，验收对表用）

| 页面类   | 解剖                           | 承载原语                                      | 禁止                             |
| -------- | ------------------------------ | --------------------------------------------- | -------------------------------- |
| 列表页   | 主列表 + 行级操作 + 批量操作栏 | DataTable、ActionBar、StatusBadge、EmptyState | 卡片墙承载业务对象集合           |
| 详情页   | 主从布局或详情抽屉             | DetailDrawer、PageHeader                      | 跳转整页查看单对象               |
| 配置页   | 结构化表单 + 版本侧栏          | FormSection、TreeSelect                       | 无版本历史的裸表单（能力允许时） |
| 仪表盘页 | 指标卡 + 钻取                  | StatusBadge、PageHeader                       | 与列表页范式混用                 |

## §4 度量

- **解剖合规率**：逐页对表 §3，合规页数/总页数；U2 后 governance 三页须 100%，U3 后已迁域 100%，U4 复核全站。
- **操作步长**：授权角色（给用户授予一个角色）现状 5 步 → 目标 **2 步**（主列表选中用户 → 抽屉内完成授权提交）；U2（UI-CP2）验收度量。
- **依赖计数**：全仓外部运行时依赖 = 3（`pg`、`preact`、`@preact/signals`），`pnpm why` 可证；U1 后任何批次不得新增外部运行时依赖（ADR-0014 边界）。
- **启动预算**：登录入口 ≤12KB JS/4KB CSS gzip，全程守恒。

## §5 迁移政策

- 每域迁移 = **行为重写 + UX 升级** 双标签提交：域内既有 DOM 级行为测试同批更新（经第四次人裁批准，ADR-0014 后果节），提交信息与测试文件头注明两标签；UX 升级 = 对表 §3 的可见改进。
- 未迁移域（含既有全部 governance/业务页面）零改动；冻结契约（如导航注册表测试）如需触碰，必须属于本计划已批范围且红→绿可证。
- 回滚：每域独立提交，revert 单域提交即回滚该域（旧 vanilla 视图仍在，直到该域迁移完成）。

## §6 与既有债务/文档的关系

- **TD-UI-001**（新登记，P1）：本计划主载体。
- **TD-WEB-001**（bootstrap 巨石）：U3 捆绑清偿。
- **TD-HYG-001（历史）**：旧占位 `packages/ui` 已被 D3 清理；本计划重建同名包为真实组件层，无继承关系。
- **ARCHITECTURE §1**：新增 `packages/ui→{preact,@preact/signals}`（外部）与 `apps/web→packages/ui`（工作区）两条边及理由。
- **core-beliefs #8**：注记本计划解除（仅本计划）；R6 前端例外由 ADR-0014 登记。

## §7 进度与回滚点（每批更新）

| 批次        | 提交                                                             | 门禁                                                                                                                                                                                                          | 状态                     |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| U0 规范落盘 | bdcd07e（已 push）                                               | doc-lint 0；全链中 coverage 前各步与六包 vitest 全绿，仅「coverage 运行中树保持干净」不变量因 U1 并发改树中断一次（合并 HEAD 复验见 U1 行）                                                                   | 完成                     |
| U1 基座原语 | 6cf92ec（主体）+64304a5/1bf9053（coverage tsx 纳管两处前向修复） | 干净树 1bf9053 完整 ci:local 实际 exit 0：inventory 429（七包）、overall 40176/51688≥75%、domain 629/671≥90%、仓储 10225/11974≥70%、deficits 空（基线不降）、登录预算 11998B/12000、packages/ui 44 测全绿入链 | 完成                     |
| U2/U3/U4    | —                                                                | —                                                                                                                                                                                                             | 未开始（UI-CP 序列门禁） |

**U1 后续记**：哨兵并行会话于 10:48 落盘第七次人裁配套 A 系列审计五份（docs/audits/），阻塞 doc-lint 与 coverage 干净树断言；经核实为完整交付物，以独立提交 3597120 原样收录+登记（仅 prettier 表格留白规范化，内容零改动），不属 UI 计划范围、不改其结论。
