# 供应商抽屉初焦测试稳定性证据（TD-TEST-035，2026-11-26）

> 授权：wave3 隔离工作树任务书（主协调派发）。工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave3/drawer-focus`，分支 `test/w3-supplier-drawer-focus`，基线 main `4a93003`。
> 台账条目：TD-TEST-035（供应商抽屉 mini-DOM 初焦测试间歇失败；`22214d3` 已做缓解并保留确认框初焦断言）。
> 改动面：仅 `apps/web/src/commercial/console/supplier-console.test.tsx`（+33/−29），零组件、零产品代码改动。
> 审查更正记录：初版证据把原始失败的触发条件写成「用例自己的 35ms 定时器漂移击穿断言窗口」，与实验不符；已按审查者隔离实验与本文 §4 的红/绿复跑更正为「前序用例残留的待执行 effect 链落进窗口」（见 §3.5、§4）。

## 1. 结论

1. **本机未复现原始间歇失败**：未改动的工作树上，`pnpm --filter @kingturf/web exec vitest run src/commercial/console/supplier-console.test.tsx` 连跑 100 次（40+60 两批）全部通过（100/100，19 用例×100）。
2. **根因从源码与红/绿实验锁定，含两层**：机制层——测试 DOM 的 `flush()`（`setTimeout 0`）等不到 DetailDrawer 初焦 effect（node 环境无 `requestAnimationFrame` 时该 effect 由 `setTimeout 35ms`+再一拍调度）；触发层——原始间歇失败需要**前序用例残留的待执行 effect 链**落进「确认框已挂载、初焦断言未跑」的窗口，两种形态：①上一用例未卸载的抽屉 effect 直接抢焦；②共享的 35ms 定时器链把本用例自己挂起的 effect 冲进窗口。**用例自身的定时器链不会击穿断言前窗口**（探针 P3：同用例各位置停 35–80ms，断言 15/15 不变；抢焦发生在断言通过后的下一拍，探针在断言后约 5ms 重新观测时焦点已变）。这与 proc5 批次当时的记录一致（[proc5-2026-11-25.md §焦点测试](proc5-2026-11-25.md)：「抽屉操作早于详情抽屉初焦，另有上一用例未卸载的抽屉在下一用例抢走焦点」，旧文件 `66583f2` 并发复跑 4/18 轮失败）。`22214d3` 把两个确认框用例 act 化闭合了它们自身；但文件里仍有 14 处打开抽屉的路径（详情 12 + 新建 2）走「`click` + `flush()`」，其悬挂 effect 与共享定时器链仍是后续用例的潜在触发者，本次全部消除。
3. **修复**：本次收敛上述 14 处路径到两个 helper（`openSupplierDrawer` / `openCreateDrawer`），`act` 同步 flush 初焦 effect 并断言焦点落在 `.drawer-close`——收敛后经 helper 打开抽屉的调用点共 16 处（详情 14 + 新建 2，其中 2 处确认框用例 `22214d3` 已 act 化），分布在 15 个用例（13 个详情 + 2 个新建），全部执行初焦断言——**只加强、未削弱**（未删除、未跳过、未放宽、未加重试，未使用 skip/only）。
4. **验证**：修复后同一命令连跑 20 次 20/20 全过；前端全量测试通过（无关既有间歇见 §6 末段与 §7）。

## 2. 量化（修复前，未改动工作树）

命令：`pnpm --filter @kingturf/web exec vitest run src/commercial/console/supplier-console.test.tsx`

| 批次                        | 次数 | 结果                                                   | 日志                                         |
| --------------------------- | ---- | ------------------------------------------------------ | -------------------------------------------- |
| 第一批                      | 40   | 40/40 全过（每轮 `Tests 19 passed (19)`）              | `drawer-focus-artifacts/quantify-40.log`     |
| 第二批（40 次全过后的加跑） | 60   | 60/60 全过                                             | `drawer-focus-artifacts/quantify-41-100.log` |
| 合计                        | 100  | **100/100 全过，失败用例与报错原文：无（本机未复现）** | 同上                                         |

单轮耗时 ~0.6–0.7 秒（19 用例合计 ~100ms，均摊 ~5.6ms/用例）。本节量化对象是 HEAD（`22214d3` 版）：断言窗口内已无可被抢焦的初焦 effect——两个确认框用例已 act 化，其余用例挂起的抽屉 effect 被 afterEach 卸载丢弃（§3.6 的「无失败通道」），所以 100/100 与争用无关（审查者在争用下跑 HEAD 同样 0 失败）；「串行运行极少命中、争用下才失败」描述的是旧文件 `66583f2`——proc5 批次的并发复跑（多 worktree 抢占）与审查者在单核多忙循环争用下的隔离复跑才把它的失败率顶到可观测（见 §4）。

## 3. 根因（源码链）

1. **DetailDrawer 初焦是 passive effect**：`packages/ui/src/detail-drawer.tsx:44-54`——`useEffect`（空依赖）里 `focusables[0].focus()` 落到 `.drawer-close`。
2. **node 测试环境（无 `requestAnimationFrame`）下 passive effect 走 `setTimeout(35ms)`**：`node_modules/preact/hooks/dist/hooks.mjs`——`k = typeof requestAnimationFrame === 'function'` 为 false 时，调度函数 `z()` 为 `setTimeout(r, 35)`，且 `r` 触发后还要再排一拍 `setTimeout(g, 0)` 才真正执行 effect。本仓库 vitest 无 `test.environment` 配置（`apps/web/vite.config.ts` 无 test 段，默认 node 环境），也无 setup 安装 rAF。
3. **测试的等待方式等不到它**：`supplier-console.test.tsx` 的 `flush()` 是 `setTimeout(resolve, 0)`——`flush()` 完成时初焦 effect 仍在 35ms 定时器上。
4. **ConfirmDialog 初焦是同步 ref 回调**：`packages/ui/src/confirm-dialog.tsx:54-69`——挂载提交阶段同步 `initial?.focus()`（destructive 落「取消」）。signal 写入后组件重渲染由 signals 的渲染 effect 回调 `setState({})` 触发、经 preact 的 `debounceRendering`（缺省 `queueMicrotask`）排一拍执行，所以确认框初焦在 `flush()` 前已落位（`@preact/signals` dist/signals.mjs 里 `queueMicrotask(() => queueMicrotask(t))` 的 `A` 是 ReactiveDom 文本 effect 的调度器，不是组件重渲染主路径）。
5. **原始间歇失败的触发机制**：`confirmAction` 夹具在确认框打开后先 `await flush()` 再断言初焦。**用例自身的链抢不到断言之前**：本用例 open 那颗 effect 的定时器（35ms）即使漂移到期，effect 还要再等一拍 `setTimeout(g, 0)`，而断言前的 `flush()` 定时器先入队先到期——探针 P3 在确认框打开前后注入 35–80ms 同步停顿共 15 种情形，断言全部通过，只在断言之后约 5ms 才观测到焦点被抢回 `.drawer-close`。**真正击穿断言的是前序用例残留的待执行 effect 链**：它定好的那一拍恰在「确认框已挂载、初焦断言未跑」的约 1ms 窗口内执行，把焦点抢走，`confirmAction` 断言失败（期望取消按钮、实际收到 `.drawer-close`）。两种形态：①上一用例未卸载、初焦未完成的抽屉 effect 直接抢焦（失败断言收到的可能是**上一用例**的关闭按钮）；②残留的共享定时器链在本用例运行中触发 `g`，把本用例自己挂起的初焦 effect 冲进窗口（收到的是本用例自己的关闭按钮）。proc5 批次的并发复跑已分别记录两条成因（[proc5-2026-11-25.md §焦点测试](proc5-2026-11-25.md)），与探针 P5/P7/P8 的红一致（§4）。`22214d3` 用 `act`（`preact/test-utils` 把 `options.requestAnimationFrame` 换成收集器并在结束时同步执行）同步跑掉初焦 effect，两个确认框用例（停用、暂停）自身不再有挂起 effect，也不再把残留链留给后续用例。
6. **残余（本次修复对象）**：`22214d3` 后文件里仍有 14 处打开抽屉的路径（详情 12 + 新建 2）走「`click` + `flush()`」：这 14 处自身不断言焦点（无失败通道），但每处留一颗悬挂初焦 effect 与共享定时器链——它们就是 §3.5 两种形态里「前序用例残留」的来源（形态①对下一用例；形态②对本文件后续任意用例）；afterEach 卸载虽丢弃未执行的 effect，定时器链仍会在后续用例的 await 边界插入执行。本次把 16 个打开抽屉的调用点全部 act 化后，本文件不再产生任何挂起的初焦 effect，两类触发者一并消除。

## 4. 实验证明（探针；红/绿可复核）

**首轮探针（作者，临时 `drawer-focus-probe.test.tsx`，已删；原始输出仅会话日志，不作为断言失败的复现证据）**：四个用例证明的是机制层事实——

| 实验 | 形态                                                    | 观测                                   | 结论                                                     |
| ---- | ------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| ①    | `click(open)` + `flush()`                               | `activeElement = null`                 | `flush()` 等不到初焦 effect                              |
| ②    | ① + 等 40ms+一拍                                        | `activeElement = .drawer-close`        | 悬挂 effect 确在 35ms 定时器上                           |
| ③    | ① + 点停用 + `flush()` → 断言（通过）→ 慢拍 40ms 再观测 | 慢拍后 `activeElement = .drawer-close` | **断言之后**焦点被悬挂 effect 抢回（不是断言失败的复现） |
| ④    | `act(click open)` + 点停用 + `flush()` + 同样慢拍 40ms  | `activeElement = 取消按钮`，不被抢     | `act` 形态（`22214d3`）下无悬挂 effect 可抢              |

**红/绿复现（审查者探针 + 作者复跑，可复核）**：探针源码与原始日志留存于 `drawer-focus-artifacts/review/`（`scratch/apps/web/src/commercial/console/review-probe*.ts*`、干净全量轮日志以 `probe-run-8/9/10.log` 为准——`probe-run-1..7` 为探针调试轮且第 7 轮只含 P3/P4（文件名 `probe-run-7-p3p4.log`），另有 `probe-timeline-1.log`、`contention.sh`、`contention-*/summary.log`）。作者复跑全套 156 个探针用例（命令 `pnpm exec vitest run src/commercial/console/review-probe.test.tsx`，于 review/scratch 副本；日志 `drawer-focus-artifacts/review/probe-rerun-author.log`，Tests 156 passed (156)），关键红/绿计数：

| 探针 | 情形                                                                          | 作者复跑结果                   | 结论                                                                          |
| ---- | ----------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| P3   | 同用例自己的定时器在 open/点停用/确认框打开后停 35–80ms（15 情形）            | PASS=15，FAIL=0                | 用例自身链不击穿断言前窗口                                                    |
| P4   | 旧形态：确认框已开后真实让出 40ms，再跑真实夹具 `confirmAction`               | **FAIL=1**（断言变红）         | 真实初焦断言失败可复现                                                        |
| P5   | 上一用例已卸载 + 本用例旧形态（delay 24–50ms 共 27 档扫描，32–36ms 为命中带） | PASS=25，**FAIL=2**（32/33ms） | 形态②：共享定时器链把本用例挂起的 effect 冲进窗口（收到本用例自己的关闭按钮） |
| P6   | 上一用例已卸载 + 本用例 act 形态                                              | PASS=27，FAIL=0                | act 对照绿                                                                    |
| P7   | 上一用例未卸载 + 本用例旧形态                                                 | PASS=26，**FAIL=1**（33ms）    | 两种形态同在一次 flush 里先后发生，最终收到本用例自己的关闭按钮               |
| P8   | 上一用例未卸载 + 本用例行内确认（本用例无抽屉）                               | PASS=25，**FAIL=2**（34/36ms） | 形态①：上一用例未卸载的抽屉 effect 直接抢焦（收到上一用例的关闭按钮）         |
| P9   | 上一用例已卸载 + 本用例行内确认                                               | PASS=27，FAIL=0                | 卸载兜底后绿                                                                  |

形态归属（§3.5 的①②）由审查者的抢焦者身份探针 `review-probe-forms.test.tsx` 判定（失败瞬间按元素身份记录抢焦者；审查者两轮 17/17 全绿，日志 `probe-forms-run-2/3.log`）。作者复跑同探针（`pnpm exec vitest run src/commercial/console/review-probe-forms.test.tsx`，日志 `probe-forms-rerun-author.log`，Tests 17 passed (17)）：P5 失败 5 次抢焦者全部为本用例自己的关闭按钮（VICTIM.drawer-close）→ 形态②；P7 失败 4 次最终也收到本用例自己的关闭按钮；P8 失败 15 次抢焦者全部为上一用例的关闭按钮（LEAVER.drawer-close）→ 形态①；P9 对照 0 失败。

**争用下的整体复跑（审查者实施，作者复核各 summary）**，两种配置分开记录。抖动争用（31 个忙循环，5–14ms 突发/20–59ms 间隔）：旧文件 `66583f2` 7/40 轮失败（`contention-old-stutter`；审查者统计 10 个初焦断言失败），审查者在最终暂存 blob 上复跑得 9/40 轮失败、12 个断言失败（`contention-r4-old-stutter`），`22214d3` 版与本次暂存版同法各 40/40 绿（上一轮 `contention-head-stutter`、`contention-staged-stutter`，本轮 `contention-r4-head-stutter`、`contention-r4-staged-stutter`）。均匀争用（单核 7 忙循环）：旧文件两批 3/20、7/20 轮失败（`contention-old-uniform7`、`contention-old-uniform7-fullfile-batch2`），`22214d3` 版与本次暂存版各 20/20（`contention-head-uniform7`、`contention-staged-uniform7`）；旧文件上三个只跑单用例/两用例的隔离目录各 20/20（`contention-old-uniform7-ONLY-drawerconfirm`、`-ONLY-lastconfirm`、`-TWO-drawerconfirms`）——同用例自身链不击穿断言窗口的又一佐证。旧文件无争用串行 40 轮 0 失败（`contention-old-none`）。

## 5. 修复内容（`supplier-console.test.tsx`，+33/−29）

1. 新增 `openCreateDrawer`（`act` + `.drawer-close` 初焦断言）；`openSupplierDrawer` 原样保留，两者上方补根因注释（35ms 调度、flush 等不到、必须 act 的原因与证据指引）。
2. **本次改写的 14 处路径**收敛到 helper：详情抽屉 12 处（物料准入 approve、reject、权限门、资质与报价历史、四色徽章、无已发布物料、待准入截断、报价对比、`openCompare` 内部、TD-WF-008 抽屉随写刷新、TD-WF-014① 准入成功提示及其关闭后重开）+ 新建抽屉 2 处（创建载荷、新建成功提示）。两个确认框用例（停用、暂停）`22214d3` 已 act 化，本次未动其打开方式。
3. 收敛后经 helper 打开抽屉的调用点共 **16 处**（`openSupplierDrawer` 14 + `openCreateDrawer` 2），分布在 **15 个用例**（13 个详情 + 2 个新建；其余 4 个用例不开抽屉），全部执行初焦断言。
4. `afterEach` 逐例卸载保留（`22214d3` 引入），注释更新为兜底语义（对非抽屉组件的残余 effect 兜底）。
5. 断言变化盘点：确认框初焦断言（`confirm-dialog.tsx` fixture 内）零改动；抽屉焦点断言由 2 处扩展到 15 个用例（16 个调用点，均断言 `.drawer-close` 初焦），**无任何删除/跳过/放宽/重试包裹，未使用 skip、only、retry**。

## 6. 验证（修复后）

命令：`pnpm --filter @kingturf/web exec vitest run src/commercial/console/supplier-console.test.tsx`

| 检查                                         | 结果                          | 日志                                                                                                  |
| -------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 单跑                                         | 19/19 过                      | 注释改后复跑（会话记录），以 20 连跑日志为准                                                          |
| **连跑 20 次（最终 blob）**                  | **20/20 全过**                | `drawer-focus-artifacts/verify-final-blob-20.log`                                                     |
| 前端全量（最终 blob，经 heavy）              | 65 文件 1024 用例全过，EXIT=0 | `drawer-focus-artifacts/web-full-suite-final-blob.log`                                                |
| 连跑 20 次（注释改写前的同代码版本）         | 20/20 全过                    | `drawer-focus-artifacts/verify-after-fix-20.log`                                                      |
| 前端全量（注释改写前的同代码版本，经 heavy） | 第一次 1 例无关失败，重跑全过 | `drawer-focus-artifacts/web-full-suite.log`（第一次）、`web-full-suite-2.log`（重跑）；无关失败见下段 |

「最终 blob」指审查意见处理后的暂存版本（`git diff --cached --numstat` 对该文件 +33/−29）；与非注释代码逐行相同的先前版本相比仅 helper 上方注释多一行，两轮验证均有效，表内以最终 blob 重跑为准。

前端全量第一次出现 **1 例与本任务无关的既有间歇失败**：`src/commercial/console/production-order-keys.test.ts`「缺省随机源取 Web Crypto：…同一秒内连续生成彼此不同」——`expected 199 to be 200`（200 个四位随机键出现一次碰撞）。该文件 11 用例全部属 MFG-5 幂等键生成，与本次改动零交集（本批 diff 仅 `supplier-console.test.tsx`；vitest 每文件独立模块上下文）。为归界单跑该文件 20 次：19/20 过、1 次同报错失败（`prod-order-keys-20.log`），确认为独立概率性缺陷。数学口径：四位随机 = 36⁴ = 1,679,616 种取值，同秒 200 样本的生日碰撞概率 ≈ 1 − exp(−200×199/2/1679616) ≈ **1.18%**——断言「200 个样本零碰撞」与随机源容量在数学上不相容，该测试自身必然间歇失败。按 R4 不顺手修，登记待主协调裁定（候选方向：降样本量至碰撞概率可忽略、或注入受控随机源、或改为格式断言+小样本唯一性）。重跑全量通过后本批门禁不受影响，但只要该用例保持现形态，全量门禁约有 1.2% 随机失败率。

## 7. 超范围与待裁

1. `production-order-keys.test.ts` 的随机碰撞间歇（§6）：不在 TD-TEST-035 范围，未改动，待主协调登记编号并裁定修复口径。
2. 本批为纯测试侧修复：DetailDrawer 的「绘制后初焦」在真实浏览器（有 rAF）是合理的可访问性时序，**不属组件缺陷**，故未改组件。
