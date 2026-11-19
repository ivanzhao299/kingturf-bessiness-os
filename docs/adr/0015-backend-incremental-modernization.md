# ADR-0015：后端增量现代化（Fastify HTTP 壳 + Zod Schema 校验）

日期：2026-11-19。状态：**已批准（第五次人裁 + 主协调裁定）**——本 ADR 为规范落盘批（UI-M0b），**不写任何后端代码**；Fastify/zod 第一段 hello 级挂载验证留待 UI-M2 之后的 API 批。授权链：2026-11-19 项目所有者第五次人裁（前端或后端技术栈/框架有问题可按主协调经验与行业主流方案设计重构，不过于依赖现有项目设计内容）；主协调裁定选型=Fastify+Zod、策略=分域增量、依赖纪律=恰 3 个新运行时依赖。

## 背景

后端现状为 Node 原生 `node:http` + 单巨 `buildApp`（TD-API-001，≈6,442 行）+ 逐路由手写校验（TD-BOUND-002：无声明式 schema，校验代码散布各路由处理器）。批次 2/4 已建立 `routes/` 声明式路由骨架与 `defineRoute` 门禁，但：

1. HTTP 壳层（解析/钩子/错误序列化/内容类型）全部手写维护，重复且偏离行业主流；
2. 入站请求体校验为逐路由手写调用，出站 DTO 无 schema 单一真源，与前端 type-only 桥接（shared/\*-types）之间靠人工对齐；
3. 第四次人裁已解除前端零框架约束（ADR-0014）；第五次人裁将同一授权扩展到后端。

## 决策

1. **增量引入 Fastify（HTTP shell）+ Zod（入站/出站 schema 校验）**，依赖纪律=**恰 3 个新运行时依赖**：`fastify` + `zod` + `@fastify/type-provider-zod`（fastify type provider），全部落 `apps/api`；不引入插件生态外的其他运行时依赖。
2. **分域迁移策略**：自 U3 起，**每域迁移 = UI Preact 重写 + 该域 API 路由 Fastify/zod 化同批完成**（分域全栈迁移，双端同批验收）；U2 governance 试点（UI-M2）仍为纯 UI 批，不动 API。旧 `node:http` 路由与 Fastify 路由在过渡期**共存**于同一进程（Fastify 可挂载为既有 server 的处理器，或经注入适配），每域迁完即删旧域路由。
3. **明确保留资产清单（不引 ORM，不换数据库，不重写仓储）**：
   - 参数化 SQL 仓储层（`$1..$n` + values 传参）与迁移链（ADR-0002）原样保留；
   - SQL 级 DataScope 谓词下推（ADR-0004）原样保留；
   - ADR-0003 不透明 token 认证（scrypt + 服务端哈希）与 default-deny 授权原样保留；
   - 事务 outbox 审计/事件双写（ADR-0006）原样保留；
   - `pnpm ci:local` 单一真源门禁与 workflow_dispatch 发布链原样保留。
     Fastify 只替代 HTTP 壳与校验层；zod schema 成为请求/响应形状的单一真源，仓储与 SQL 一律不动。
4. **入站收紧=行为变更纪律不变（R2）**：zod 校验若拒绝原被放行的输入，须按既有红线显式登记、单独提交（沿 TD-BOUND-002 详条既定边界）。

## 替代方案（已拒绝）

- **全量一次性框架替换**：与 ADR-0014 拒全站重写同理——不可分域验收、不可回滚；且 `buildApp` 巨石被 CI 冻结契约包围，一次性替换等于重写全部护栏——拒绝。
- **引 ORM（Prisma/Drizzle 等）**：参数化 SQL 仓储+DataScope 下推+outbox 双写是已验证资产（A1 审计确认注入防护达行业水准之上），ORM 反而绕开 SQL 级谓词与审计链——拒绝。
- **换数据库**：PostgreSQL 17 + 74 迁移链健康，无动因——拒绝。
- **继续手写 node:http 壳**：即维持 TD-BOUND-002/TD-API-001 现状，第五次人裁已认定技术栈问题可按主流方案重构——拒绝。
- **express/koa**：Fastify 的 schema-first（type provider + JSON Schema 自动派生）与 zod 生态集成是三者中唯一提供端到端类型闭环的；性能与钩子模型亦为主流之选——拒绝。

## 后果

- **新依赖边登记**（`ARCHITECTURE.md` §1 同步）：`apps/api → {fastify, zod, @fastify/type-provider-zod}`（外部运行时依赖，全仓由 3 个外部包增至 6 个：pg、preact、@preact/signals、fastify、zod、@fastify/type-provider-zod）。DAG 保持：Fastify/zod 仅被 apps/api 消费，packages 不反向依赖。
- **TD-BOUND-002 迁移路径已裁决**：随分域 Fastify+zod 化清偿（本 ADR），详条状态已更新。
- **服务边界门禁（service:check）与 G4 逐路由 validate 门禁**在迁移期对新旧两式路由并存生效；每域 Fastify 化时同批适配其自测口径（门禁脚本改动须红→绿）。
- **CI/发布链不变**：ci:local 单命令门禁、workflow_dispatch 发布、双 SHA 控制面全部照旧；Fastify 应用仍由同一 `server.ts` 组合根装配。
- **风险**：双壳并存期的中间件语义差异（错误序列化/404/头部）——以每域行为测试同批重写兜底（与 UI 域重写同批，测试口径一致）；`pnpm audit` 门禁对 3 个新依赖的生产漏洞面持续生效。

## 验收要点（首个 API 批用，UI-M2 后另下指令）

hello 级挂载证明依赖链可行（fastify 实例 + type-provider-zod + 一条 zod schema 路由过 ci:local）；随后每域：入站负例（zod 拒绝映射 4xx）、出站 schema 与前端类型桥接对齐、旧域路由删除、G4/service 自测适配、域行为测试同批绿、干净 HEAD 完整 ci:local 0。
