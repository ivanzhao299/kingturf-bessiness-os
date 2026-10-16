# GATES.md（门禁清单）

> 阶段 3 产出（规则 §5）。每项：触发时机 / 失败含义 / 修复指引。**任何新提交都必须通过全部 CI 链门禁**；本地提交另过两个 git hook。
> 选型说明：git hooks 采用零依赖方案（`.githooks/` + `core.hooksPath`，等效 commitlint + lint-staged），与仓库零依赖哲学一致（core-beliefs「偏好可内化技术」）。

## CI 链（`pnpm ci:local`，GitHub Actions `ci.yml` 执行同一命令）

| #   | 检查名                                                                                      | 触发时机                                    | 失败含义                                                                                                                                                                                                                                                                                                                                                            | 修复指引                                                                           |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `format:check`（prettier）                                                                  | ci:local 第 2 步；pre-commit（仅暂存文件）  | 格式不一致                                                                                                                                                                                                                                                                                                                                                          | `npx prettier --write <文件>` 后重新 add                                           |
| 2   | `doc:lint`（[doc-lint.mjs](../scripts/analysis/doc-lint.mjs)）                              | ci:local 第 3 步                            | AGENTS 行数/必填节违规；docs 文件未被 index 收录；索引/AGENTS/ARCHITECTURE 死链                                                                                                                                                                                                                                                                                     | 按报错补 index 行或修路径；新增 docs 文件必须同步登记 index                        |
| 3   | `structure:check`（[structure-gate.mjs](../scripts/analysis/structure-gate.mjs)，拦截模式） | ci:local 第 4 步                            | **G1 文件 >800 行 / G2 嵌套 >5 层（D5 已启用拦截，存量白名单信息性放行）**；**G3 SQL 模板插值白名单外一律失败**（白名单=**形状 × 可信根双重约束**：片段根∈登记集合、join 根∈{clauses,where}、索引=精确对、调用式钉死 scope(context,…)、String() 参数 token 受限、双字面量三元禁反引号；存量值插值 6 处显式豁免至批次 1）/ G4 逐 defineRoute 缺 validate（**强制**） | 见报错内嵌修复指令；新增复杂度白名单须在脚本内显式登记（原因+到期批次）并记台账    |
| 4   | `verify:frontend-capabilities`                                                              | ci:local 第 5 步                            | 前端能力清单与实现脱节                                                                                                                                                                                                                                                                                                                                              | 按 scripts/verify_frontend_capability_manifest.mjs 输出补齐                        |
| 5   | `ci:database:guard`                                                                         | ci:local 第 6 步                            | 测试库目标不合规（非回环/名称不含 test）                                                                                                                                                                                                                                                                                                                            | 检查 `DATABASE_URL` 指向一次性测试库                                               |
| 6   | `db:migrate` + `db:status`                                                                  | ci:local 第 7-8 步                          | 迁移失败或状态 drifted                                                                                                                                                                                                                                                                                                                                              | 迁移是 append-only + sha256 校验：勿改已应用文件，新增迁移修正                     |
| 7   | `lint`（eslint strictTypeChecked）                                                          | ci:local 第 9 步；pre-commit（暂存 TS/MJS） | 类型/风格违规（比常规 strict 更严）                                                                                                                                                                                                                                                                                                                                 | 按规则名逐条修；scripts/analysis/\*.mjs 为 disableTypeChecked 范围                 |
| 8   | `typecheck`（tsc --noEmit）                                                                 | ci:local 第 10 步                           | 类型错误                                                                                                                                                                                                                                                                                                                                                            | 按 tsc 输出修；勿用 any 绕过（TD-ARCH-001 教训）                                   |
| 9   | `test`（先 `test:release-guardrails` 自测，后各包 vitest）                                  | ci:local 第 11 步                           | 发布护栏自测失败 / 单测或集成测试失败                                                                                                                                                                                                                                                                                                                               | guardrails 自测防"门禁本身失效"；API 集成测试串行（vitest.config.ts maxWorkers=1） |
| 10  | `build`（tsc + vite + 启动预算断言 ≤12KB JS/4KB CSS gzip）                                  | ci:local 第 12 步                           | 编译失败或登录入口超预算                                                                                                                                                                                                                                                                                                                                            | 按编译错误修；预算超标需拆分/懒加载，不得调高阈值                                  |
| 11  | `security:check`（pnpm audit --prod --audit-level high）                                    | ci:local 第 13 步                           | 生产依赖存在 high+ 已知漏洞                                                                                                                                                                                                                                                                                                                                         | 升级依赖并跑全量测试                                                               |

## 本地 git hooks（`.githooks/`，`pnpm install` 时经 `prepare` 自动激活）

2e新增独立门禁（2026-10-16）：`service:check`在structure:check后执行，因此当前ci:local共14步；上表第5步及以后顺延1步。AST/类型规则S1–S4及精确能力边界见[Service边界护栏](engineering/service-boundary-guard.md)。`node --test scripts/analysis/service-boundary-gate.test.mjs`经test:release-guardrails随pnpm test执行真实CLI注入/合法对照。此项不修TD-GATE-003，不更改G1/G2/G3/G4或D5/既有豁免。

| 检查名       | 触发时机     | 失败含义                                                         | 修复指引                                                                       |
| ------------ | ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pre-commit` | `git commit` | 暂存的 ts/mjs/css/md/json 未过 prettier；暂存 TS/MJS 未过 eslint | 按报错修后重新 add；紧急跳过：`git commit --no-verify`（必须在后续提交补修复） |
| `commit-msg` | `git commit` | 提交信息非 Conventional Commits                                  | 格式 `<类型>(<范围>)?: <说明>`；类型见 hook 内清单；Merge/Revert 自动放行      |

## 豁免机制（规则 §5 阶段 3 子任务 11）

| 豁免                  | 位置                                                                                   | 要求                               | 到期                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 复杂度白名单（G1/G2） | structure-gate.mjs 的 `SIZE_WHITELIST`/`NESTING_EXTRA`                                 | 显式原因 + 到期批次 + 台账 TD 关联 | 对应批次完成时移除（当前实测 31 条：7 个 G1 文件 + 24 个 G2 嵌套热点） |
| 覆盖率豁免            | 台账状态「已豁免」+ 代码 `// coverage-exempt(reason, until-YYYY-MM-DD)`（阶段 5 启用） | 双写一致，结构测试校验             | 到期日次日自动恢复拦截；续期须人工确认                                 |
| hook 跳过             | `--no-verify`                                                                          | 仅限紧急；后续提交必须补修复       | —                                                                      |

## D5（复杂度阈值：文件 ≤800 行 / 函数 ≤200 行 / 嵌套 ≤5 层）

D5 已于 2026-10-13 启用：结构门禁默认拦截 G1/G2，白名单内 31 条仅输出信息、不计失败；白名单外新增 G1/G2 退出码为 1。当前真实树为强制违规 0、白名单豁免 31 条，存量热点按到期批次逐步移除。

## 已知扫描范围限制（2026-10-16）

当前 `structure-gate.mjs` 的 `walk:55–63` 跳过 `routes`，而 `runChecks:235–244` 的 G1/G2/G3 共用该 sourceFiles；245–250 只对 routes 另跑 G4。因此 routes 目前**不受 G1 文件、G2 缩进及 G3 SQL 插值的机械扫描**，仅 G4 逐定义校验生效。上文门禁规则与历史启用记录不能当作 routes 已覆盖的证据；D5 对已扫描路径继续拦截，不改为 report，也不新增白名单。

已独立登记 [TD-GATE-003](exec-plans/tech-debt-tracker.md)：P1工程门禁覆盖缺口、未修复／待核实；静态遗漏已证，真实 routes 三类违规注入逃逸用例及存量全量影响未执行。2d 的独立文件/完整函数/明确控制流计量不能替代上述机械扫描或宣称现G2缩进规则已通过。本轮只披露及登记，不修脚本、不加豁免/扩G3可信根；后续独立门禁任务决策、阶段5接入前复核，并保留G4逐定义。

## 变更历史

| 日期       | 变更                                         | 原因                                     |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| 2026-10-12 | 建档：11 项 CI 链 + 2 个本地 hook + 豁免机制 | 阶段 3 产出（规则 §5 阶段 3 产出物要求） |
