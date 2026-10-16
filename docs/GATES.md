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

3a后补现时：form86e7026完整CI真实0/182105.292ms；locale两表/函数完整提取、web114/预算11369-1898/七场景CDP通过，独立HEAD完整CI随后。此前form“验证中”为原时点，后续以[locale证据](evidence/frontend-3a-locale-2026-10-16.md)与[form证据](evidence/frontend-3a-form-2026-10-16.md)为准；HTTP/navigation未迁移，不等于整批收尾。

批次3 C3现时：新增web四目录`apps/web/src/{shared,crm,commercial,governance}/`的G2复用原routes AST≤5，G1原全扫≤800；walk仅允许四prefix内部routes递归，不扩其他旧路径。原31/G3/G4/其他G2规则保持，函数200仍独立量完整函数。175be7d完整CI真实exit0，38自测/29 CLI及计时来源见[新web护栏](evidence/frontend-c3-guard-2026-10-16.md)。首[form小步](evidence/frontend-3a-form-2026-10-16.md)已提取并完成旧新正文/切片及变异证明，新源码完整门禁随后记录，不等于3a整批已完成。

CDP harness后补：`fixtures.test.mjs`及`network-policy.test.mjs`纯JS自测已接入根test:release-guardrails（当前4 tests，独立于Vitest）；真实Chrome六场景及定向负向仍手动串行，Windows ownership.NET/lifecycle不接默认跨平台CI。静态资源白名单/精确stub、目标view可见与真实DOM负向、成本q/ACK窗口等见[CDP基线](evidence/frontend-cdp-harness-2026-10-16.md)。该六场景段及下段“harness尚未实施”保留各原时点快照；现时C3已完整CI0、3a首form提取验证中，新增七场景/四路由范围见form证据，原31/G3/G4/D5不变。

Windows CDP临时验证通道（ad0435e裁定）：根`pnpm lint`显式扫描`scripts/e2e-cdp/*.mjs`，沿用现有脚本JS lint规则，零新依赖/不改workflow；浏览器预检和生命周期负向为手动串行独立计数，不并入Vitest114或Playwright。真实通道、精确owned profile清理、异常/信号实测和阶段5补跑边界见[CDP预检证据](evidence/windows-chrome-cdp-preflight-2026-10-16.md)。五类harness尚未实施，不以启动成功冒称覆盖；既有31豁免/G3/G4/D5不变。

2e新增独立门禁（2026-10-16）：`service:check`在structure:check后执行，因此当前ci:local共14步；上表第5步及以后顺延1步。AST/类型规则S1–S4及精确能力边界见[Service边界护栏](engineering/service-boundary-guard.md)。`node --test scripts/analysis/service-boundary-gate.test.mjs`经test:release-guardrails随pnpm test执行真实CLI注入/合法对照。此项不修TD-GATE-003，不更改G1/G2/G3/G4或D5/既有豁免。

| 检查名       | 触发时机     | 失败含义                                                         | 修复指引                                                                       |
| ------------ | ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pre-commit` | `git commit` | 暂存的 ts/mjs/css/md/json 未过 prettier；暂存 TS/MJS 未过 eslint | 按报错修后重新 add；紧急跳过：`git commit --no-verify`（必须在后续提交补修复） |
| `commit-msg` | `git commit` | 提交信息非 Conventional Commits                                  | 格式 `<类型>(<范围>)?: <说明>`；类型见 hook 内清单；Merge/Revert 自动放行      |

## 豁免机制（规则 §5 阶段 3 子任务 11）

下表为旧记录快照，保留原7＋24/31口径，不当作本轮现时输出；当前为32＝旧31（实测9G1＋22G2）＋1精确限期AST例外，逐条基线及处置见文末本轮更新。

| 豁免                  | 位置                                                                                   | 要求                               | 到期                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 复杂度白名单（G1/G2） | structure-gate.mjs 的 `SIZE_WHITELIST`/`NESTING_EXTRA`                                 | 显式原因 + 到期批次 + 台账 TD 关联 | 对应批次完成时移除（当前实测 31 条：7 个 G1 文件 + 24 个 G2 嵌套热点） |
| 覆盖率豁免            | 台账状态「已豁免」+ 代码 `// coverage-exempt(reason, until-YYYY-MM-DD)`（阶段 5 启用） | 双写一致，结构测试校验             | 到期日次日自动恢复拦截；续期须人工确认                                 |
| hook 跳过             | `--no-verify`                                                                          | 仅限紧急；后续提交必须补修复       | —                                                                      |

## D5（复杂度阈值：文件 ≤800 行 / 函数 ≤200 行 / 嵌套 ≤5 层）

以下为启用时点历史记录；本轮现时0硬/32软及函数200能力边界见后补，不把旧31作为当前总量。

D5 已于 2026-10-13 启用：结构门禁默认拦截 G1/G2，白名单内 31 条仅输出信息、不计失败；白名单外新增 G1/G2 退出码为 1。当前真实树为强制违规 0、白名单豁免 31 条，存量热点按到期批次逐步移除。

## 已知扫描范围限制（2026-10-16）

当前 `structure-gate.mjs` 的 `walk:55–63` 跳过 `routes`，而 `runChecks:235–244` 的 G1/G2/G3 共用该 sourceFiles；245–250 只对 routes 另跑 G4。因此 routes 目前**不受 G1 文件、G2 缩进及 G3 SQL 插值的机械扫描**，仅 G4 逐定义校验生效。上文门禁规则与历史启用记录不能当作 routes 已覆盖的证据；D5 对已扫描路径继续拦截，不改为 report，也不新增白名单。

已独立登记 [TD-GATE-003](exec-plans/tech-debt-tracker.md)：P1工程门禁覆盖缺口、未修复／待核实；静态遗漏已证，真实 routes 三类违规注入逃逸用例及存量全量影响未执行。2d 的独立文件/完整函数/明确控制流计量不能替代上述机械扫描或宣称现G2缩进规则已通过。本轮只披露及登记，不修脚本、不加豁免/扩G3可信根；后续独立门禁任务决策、阶段5接入前复核，并保留G4逐定义。

## 变更历史

**E1先行现时更新（2026-10-16）**：源码d9f43f6去掉相同role分支、AST6→5；门禁3231964删除精确path/hash/date例外，不延期，36自测及完整CI真实0/173.927秒。当前0硬/31软＝原9G1＋22G2逐条保持，任意API routes合法深度6/7仍强制失败；以下32/E1限期描述均是原验收时点历史，不再作为当前数量。web尚未实施最小AST模块范围，仍是旧格式算法/既有bootstrap白名单，不因API E1完成就声称新web已覆盖。前端Chrome与源码读取前置问题见[停报证据](evidence/frontend-batch3-preflight-blockers-2026-10-16.md)。G3/G4/D5阈值不变，函数200未新增强制。

**本轮最终现状（2026-10-16，待人工验收）**：B工程bd48b5a稳定干净HEAD完整CI实际退出0/171.698秒，36结构自测及协调独立8个AST/expiry样本通过，缺口覆盖已修复；0硬/32信息豁免，旧31逐条不变、仅新增E1。日期自动失效/提前批次2验收人工前置的区别如上，不暗示自动识别阶段。870个有body函数节点中唯一>200为foundationRoutes:89–610，含首尾522行，本轮不修该业务体量，不新增函数200规则；不是全体复杂度债已清。最后证据HEAD另跑完整CI后与A一并交人工验收，3/4/5不启动。

### TD-GATE-003修复候选现状（2026-10-16）

新增例外的日期到期由脚本自动强制；若批次2先进入最终验收，须在验收流程先移除或另行显式人工裁决此项，脚本不从计划文字推断人工验收状态。后者是人工验收阻断条件，不冒称代码已自动感知批次完成。

上节是发现时点原文，保留不回写。本次授权c75dd7b下，API routes已纳入G1文件及G3原SQL扫描，G4仍逐定义一次；routes的G2升级为AST词法函数/控制流深度，其他路径仍旧格式缩进算法。定义/原116逐文件maxIndent和AST预扫见[routes基线](evidence/routes-structure-baseline-2026-10-16.md)，顶层函数与回调每层+1不reset，分支/循环/三元按定义计数，try各词法同级分支取最大；对象/类型/格式/逻辑短路不新增层但不重置已有深度。800/5阈值不变，函数200未新增机械强制，不扩G3白名单或可信根，2e service护栏/D5无--report保持。

真实36自测含routes G1/G2/G3/G4进程拒绝及合法深格式放行、日期/hash/depth边界。全仓原31豁免逐条不变，现时实测原9G1＋22G2；新增1个authorization.ts当前全文SHA＋depth6的精确存量例外，2026-10-23 Asia/Singapore零时硬失效、与批次2最终验收前取先，原因/后续独立处置见台账TD-GATE-003-E1；变化/更深不放行，合计32而不是31。尚待本线稳定HEAD全CI/独立复核及人工验收，不以局部自测冒称全体复杂度债已清。

| 日期       | 变更                                         | 原因                                     |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| 2026-10-12 | 建档：11 项 CI 链 + 2 个本地 hook + 豁免机制 | 阶段 3 产出（规则 §5 阶段 3 产出物要求） |
