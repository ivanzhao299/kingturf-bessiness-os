# 终验 P：浏览器义务证据（2026-10-20，未整链完成）

授权：[终验R7](../tasks/harness-final-acceptance-authorization-2026-10-20.md)，2e1159d先独立落盘，基点37a7bb9。A8/B2/C2固定库存，旧九=A8+P1，不包含runtime或C；C两份禁跑，不能裸跑目录。P的两完整轮必须同最新状态，以下单文件正/变异/还原不冒充A/B完整轮。

## 成本 TD-TEST-013：正式两例及认证真变异已闭环

先前f5c2ed5仅修产品冷路径反馈，本轮业务源码零改。正式`tests/e2e/cost-matrix-product-quality.spec.ts`仅应用先前获批auth-only补丁：源SHA7290b42f60ae107770622ac4f685f97308a68b14ede29281648afbc69665c0ca→适配SHA8ce3d50454711e0b31008a2a39b47af1ccce5f9d528d35899281b47a9c91a788；补丁SHA1f77630ed4b01e498a46b299ec3e2fba1c37fc80059231da6953a4f9e5dee2a1不变。新源自测固定完整适配SHA，并比较所有原expect链AST等值，含原冷场景7条；不改样本/动作/原可见期待/两配置/seed/relay，不用暖路径替代冷路径。

诊断工具改读版本化非发现fixture`legacy.ts.txt`，字节仍为原7290…；原旧冷对照hash/精确授权patch/适配结果hash三钉保持，不重新依赖旧spec Git对象（旧Web构建自身原Git ref依赖仍在）。正式CLI始终指向原spec，fixture不被Playwright发现。

私有执行器新增精确`local cost`→原文件/原两标题，原runtime/P1入口保持；原config/trace条件不改（P1仍仅既授trace=off）。根与repo只读、两owned tmpfs、禁Docker原始log-driver、原list/HTML/trace/错误上下文只容器RAM；宿主只输出原白名单标量。完整性要求实际child exit、complete=true、discovered=2、两唯一index全passed；少一例/unknown/C/all均拒。cost不传真实账号/连接环境。主执行者原strict lint/format0、session-network-tools18/18通过；本会话独立只读安全审和协调只读审均未见必要阻断，未代主执行测试。

各命令均为guarded loopback私有DATABASE_URL（不打印），`node --experimental-transform-types scripts/e2e-docker/preflight.mjs local cost <label>`：

| 条件/label                                  | 原PW实际exit/完整性          | 用例结果/耗时                               | host实际exit/耗时 | 安全日志                                                  |
| ------------------------------------------- | ---------------------------- | ------------------------------------------- | ----------------- | --------------------------------------------------------- |
| positive `final-cost-full-positive-1`       | 0/2 discovered/complete=true | 原2过，8626ms；原冷case1093ms               | 0/null/16791ms    | /tmp/kingturf-final-p-cost-full-positive-1-2026-10-20.log |
| auth逆变异 `final-cost-auth-red-1`          | 1/2 discovered/complete=true | 2 timedOut，61975ms，旧认证载体无Cookie适配 | 1/null/69011ms    | /tmp/kingturf-final-p-cost-auth-red-1-2026-10-20.log      |
| 原适配精确还原 `final-cost-full-restored-1` | 0/2 discovered/complete=true | 原2过，7890ms；原冷case1059ms               | 0/null/15000ms    | /tmp/kingturf-final-p-cost-full-restored-1-2026-10-20.log |

变异前还原为原7290…，真实child关闭/owned清理完成后才恢复8ce3…；不是中途改文件、跳过失败或共享匿名未检出变异。三次guard/同DB/schema/instance/marker、只读/tmpfs验证与schema/container/preview清理均true，无relay失败；失败行unknown0不编造具体业务失败站点。只导出固定计数/结果，无auth/原始DOM/raw/PNG导出，不作视觉像素结论。生成物/原日志随owned容器清理，不清理旧历史证据。

TD-TEST-013按本授权关闭“原冷提示修复验证＋正式整文件认证变异”义务；不关闭全部P，不称P1全11/两完整轮/终验。后继A8/B2须最新状态全部实跑、连续两轮另记。当前新工具/适配提交的完整CI仍待该实际HEAD运行。

## Workspace/P1/TD018与整轮当前边界

### MRP第二次已授固定输入/标签归属诊断与独立候选

先2339780独立人裁R7，新增mrpInputs八固定键，旧MRP九键与原P1完全保持。自然菜单/原只读GET登录闸不变；同一已核数据库连接在BEGIN后SET TRANSACTION READ ONLY，仅参数化tenant，读持久mrp_runs/demand_snapshots/item_calculations与合成item/customer/order，不读后续生产领料后的inventory_balances。仅布尔/有界计数跨输出边界，未知键/原文/类型错误拒绝；只有runInputMatches的恰一固定run与其余输入bool合看才表示同一指定运行。

主代理先独立从固定种子与生产SQL推导，不从页面6000反推：seed的两个FG需求100/8000（8月20日/11月15日），BOM草纱1.25×1.03，毛需求128.75/10300；MRP前seed已质检放行5000kg，repo按RELEASED库存而不按asOf截断。草纱安全500、MOQ1000、倍数500、lead14、freeze7。早桶128.75+500−5000≤0无建议；远桶累计128.75+10300+500−5000=5928.75，按500上取整6000。FG/底布早桶各有正计划、三个SKU远桶各有正计划→五建议；asOf8月16日+freeze7=8月23日，两个早桶开始日在冻结窗内→两冻结。来源 `seed_p1_demo.mjs:670,839,944,955–1015`，`mrp-repositories.ts:153–165,216–244`。两独立只读源核验同结论；曾把lead14误作freeze的候选口误已纠正，固定种子freeze是7。以上在输入验证前是条件性候选，不能冒称已观测数量。

实际 `preflight.mjs local p1 final-p1-mrp-input-diagnostic-3 diagnostics`：安全日志 `/tmp/kingturf-final-p-p1-mrp-input-diagnostic-3-2026-10-20.log`，input四bool全部true；quantity6000Matches/rounded6000Matches均true；releasedLabelsInsideCards=5/outside=1，总6。该输入predicate不仅on_hand5000/其余0，还固定六计算桶各SKU/日期/毛需求/安全库存/制造采购方式/trace MOQ、倍数、lead与freeze；scheduled_receipts六桶均0。**不校验planned_quantity作输入**，避免把结果混作原因。UI数量bool使用独立段落固定6000数值边界，拒60000/6000.5，不输出实际文本。远期唯一卡原gross10300/safety500仍true；卡数5/冻结2/提示2稳定，原10000条件仍false。

本次九类diagnostics complete=true/browserClosed=true/2452ms，preflight0/12249ms、host实际0/null/12881ms；同一性/只读tmpfs/owned三清全true，无relay-failure。新工具自测21/21、strict ESLint/格式过，原spec/seed/产品/两配置/网络硬闸无改。独立只读审已核只读/边界及合看run条件，最终增强predicate后另审/完整HEAD CI后补。

保留诊断历史：第1次新八键查询未含完整gross/政策tuple，四输入bool真、quantity6000真，但whole-card文本拼接使新rounded6000边界探针false（host0/12858ms，diagnostic-1同前缀日志）；不是原用例失败的新根因。仅将新增观测定位到独立quantity段落/公式段落，补60000/小数/空/整卡拼接负例，第2次rounded真（host0/12830ms，diagnostic-2日志）。第3次再加强原有固定输入bool内部tuple，不新增输出键/表/端点，全部实际真。原P1期待始终不改，三个安全日志不删，诊断exit0不计原用例绿或完整轮。

候选待人裁（尚未实施）：仅原MRP五处期待，card6→5、frozen3→2、建议10000→6000、取整10000→6000、冻结说明3→2；原放行标签6保持（卡内5/卡外1，卡外具体元素来源未采集/不猜），gross10300/safety500/run/全部其它用例/seed/产品/网络保持。这是隔离现种子口径的显式期待行为适配，不能未经新批求绿；旧原11的10过1败及P1认证变异/同状态两完整轮欠项保持。B已全CI绿，D/E与独立A/runtime/TD018诊断继续。

### P1本轮完整11：10过1败，MRP待归因，非通道失败

### 后继：已授固定MRP只读观测（不替代原用例）

先c68a50a独立人裁R7，再仅扩既有固定诊断工具的MRP exact字段；原spec/seed/产品/relay/原6/3/6及数量期待零改。自然菜单进入material-planning并等ready，在私有容器内读取，宿主只重编码有界整数/布尔；新增MRP也必须独立observed且实际browser.close成功才能报告完成。原七类诊断字段不改，历史数量字面量的布尔值不能解释为当前P1期待。独立只读安全复核无必要阻断；工具自测19/19、strict ESLint与格式通过，原P1 git diff为空。

命令 `node --experimental-transform-types scripts/e2e-docker/preflight.mjs local p1 final-p1-mrp-fixed-diagnostic-1 diagnostics`；安全日志 `/tmp/kingturf-final-p-p1-mrp-fixed-diagnostic-1-2026-10-20.log`。seed0/3327ms，固定八类观测complete=true/browserClosed=true/2423ms；preflight0/12295ms，host实际0/null/12867ms，guard/同一性/只读tmpfs及owned schema/container/preview清理均true，无relay-failure。只诊断退出0，不是原11例退出0，不计浏览器轮次。

| 固定MRP观测                                     | 实际值        | 原条件/边界                          |
| ----------------------------------------------- | ------------- | ------------------------------------ |
| proposalCards / frozenCards / releasedLabels    | 5 / 2 / 6     | 原期待6/3/6保持                      |
| longRangeYarnCards                              | 1             | RM-KT-YARN-12000 + 2026-11-15        |
| quantity10000Matches / rounded10000Matches      | false / false | 不导出实际数量/DOM文本，不反推新期待 |
| grossDemand10300Matches / safetyStock500Matches | true / true   | 原条件匹配，不代表原用例已抵达或通过 |
| frozenExplanationNotes                          | 2             | 原冻结提示条件，原期待3保持          |

本次已把“未知实际卡数”推进为固定5/2/6观测，但期待/种子/计算归因仍须独立静态推导，未授权修改期待。P1原完整10过1败及认证变异/两完整轮欠项保持，B/D/E继续。本次无原始产物/认证/DOM导出；不作视觉验收结论。

成本提交86b046d之后，原P1 spec保持dac8e36/aa2d4ff已授期待，不改seed/两config/relay。命令`node --experimental-transform-types scripts/e2e-docker/preflight.mjs local p1 final-p1-whole-positive-1`，安全日志`/tmp/kingturf-final-p-p1-whole-positive-1-2026-10-20.log`：原seed0/3146ms、成本计数1/2/1/2/异人/closed保持；PW实际1/25212ms，discovered11/complete=true、10passed/1failed。信用/订单/移动/Order360/佣金/风险/驾驶舱/制造/采购/生产全部passed，驾驶舱1483ms已抵达并通过四固定值及原来源/责任钻取断言，不再是上次未抵达四值的partial。

唯一失败index9：MRP6427ms，原line292 `.mrp-proposal-card` `toHaveCount(6)`，之前MRP工作台与原run编号/已计算文案均通过；后续冻结3/放行6及长周期数量解释未抵达，不能推断绿。未导出原错误/实际DOM数值，当前实际proposal数量未知；源码`mrp-run.ts`逐项按latestRun.proposals建卡，尚不能仅凭静态投影区分原期待/种子/实现差异。没有relay-failure，本轮不能归因TD018；host1/null/35357ms（preflight34830ms），owned schema/container/preview全清真，所有安全/同一性检查通过。

按新R7“归因不明即上报”，停止P1期待适配/该依赖线/第二轮，不改原6/3/6/10000/10300/500或产品求绿。MRP未归因项并入既有TD-TEST-016，不增造重复债务编号；P1认证变异仍未完成。独立B/D/E获授权工作继续；TD018网络/资源基线诊断另计，一次无relay不称其根因已修复或关闭。

Workspace ac7082a历史原4过/缺字段红→还原/旧会话DTO四红→还原证据保持，本轮不再制造无用字段适配；最新整轮复跑仍待。P1 dac8e36四值与aa2d4ff信用0保持，原全11/认证真变异本轮尚待；TD018只诊断/不放宽原硬闸。C两份仅D决策卡，第二完整轮未开始。

回滚本私有cost入口/legacy诊断输入工具与正式auth-only适配须成对核依赖revert，否则固定SHA自测会拒绝不完整状态；不回滚f5c2ed5产品修复、原业务断言或人类授权。证据docs可独立回滚但历史失败不删。最终完整CI/树空与人工终验另计，§14不执行。
