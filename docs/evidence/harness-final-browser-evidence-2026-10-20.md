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

Workspace ac7082a历史原4过/缺字段红→还原/旧会话DTO四红→还原证据保持，本轮不再制造无用字段适配；最新整轮复跑仍待。P1 dac8e36四值与aa2d4ff信用0保持，原全11/认证真变异本轮尚待；TD018只诊断/不放宽原硬闸。C两份仅D决策卡，第二完整轮未开始。

回滚本私有cost入口/legacy诊断输入工具与正式auth-only适配须成对核依赖revert，否则固定SHA自测会拒绝不完整状态；不回滚f5c2ed5产品修复、原业务断言或人类授权。证据docs可独立回滚但历史失败不删。最终完整CI/树空与人工终验另计，§14不执行。
