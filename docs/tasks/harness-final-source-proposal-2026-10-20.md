# Source 私有通道候选封存（未获生命周期实施许可）

## 范围与停止点

[终验R7](harness-final-acceptance-authorization-2026-10-20.md)授权的Source私有准备遇到取消时精确schema回收缺口；可选owned schema/私有marker生命周期适配已单独询问，尚无直接人类批准。原API生产器19个test、Source原3例、业务样本/权限/响应、产品SQL与两配置保持不改。MRP五处期待也仍待单独裁定，本页不扩大任一许可。

本候选已封存为公开源码补丁 `scripts/e2e-docker/proposals/source-preparation-2026-10-20.patch`，基线 `f454aa4edeafb5f694fb587d7138519ca728f9f2`，SHA256 `cfb8b54e7f973a8a408d5decbcaa1de67a50bfc4833473a20228d2183493c300`。只含以下7个工具/测试/命令入口的未完成候选，不含生成fixture、PG数据、认证、原始浏览器/生产器产物或环境文件。**补丁不是可运行交付，不得未经新批准应用或把目录检测冒作取消清理保证。**

## 精确保全与恢复证明

主执行者先保存完整七文件diff，逐文件比对候选hash，然后仅撤回自己五个受控文件至HEAD原字节、移除自己两个新增文件；未动已提交A7/runtime/MRP诊断/G5/D/E与他人文件。两个被移除候选可以从补丁恢复，不是丢弃源码。精确恢复后七文件base hash全部匹配，补丁 `git apply --check` 实际0；未实际重新应用，也未再次执行Source。下列hash用于获批后先核基线/冲突再恢复；基线变化不能盲目apply。

| 路径                                           | base SHA256                                                      | candidate SHA256                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| package.json                                   | bf11bf30926f86ea74332ee4bebb6f87729d7affa5052c6c5106e70d63cbbb4f | 010cb0195da56fa2064da819906669f0ac20cbc58022184a644ee4b48ca2f889 |
| scripts/e2e-docker/preflight.mjs               | 025437436882130f3e372cae85fcbe3721577da374f994e9abd310061e0ac5a3 | ca64b177da3ad13a5f7f2c5151b9f3aa961e3bba13f5eddfa9ee6f851fb7074f |
| scripts/e2e-docker/private-contract.mjs        | da496030c5fe53f02d1dee26dbb55f40600e4c806db6314ba90b96ed97b68943 | 3df369990870283d5deeba825313575d087a36bc0b61bffae5f546d19f0cc9e6 |
| scripts/e2e-docker/private-contract.test.mjs   | bb4aaa623387a2639b92c7ce9f61f4c0c6bf5cb0f9c5816896975670b04f9641 | d6c4c2466873bfb642dda6e9af944d2f537a22e78200416f9716d3fdeb6c33e9 |
| scripts/e2e-docker/private-runner.mjs          | 127e8f19ac619942ded87689dcbc358d628745be69716d9e28dd6cc44cc24635 | 6fa9c944636e20b239c8d97d1d07018f3a4d3f3e4915ac1bf555e0581793c535 |
| scripts/e2e-docker/source-preparation.mjs      | 原不存在                                                         | 3787c419cecb58adffe230f660ff29737f2d6441f56f65b4bf6d7e4d11e3a1db |
| scripts/e2e-docker/source-preparation.test.mjs | 原不存在                                                         | 02454897bf7ac4a0319e58b42705b5382d10fd32ff3cc3c076d45c159cc75755 |

恢复责任组仅上述七项，原API PG test不在补丁中。后继若批准owned生命周期，应先独立R7，再审查该候选、补精确owner/marker回收，保持原19正文不变，并实测取消/故障及19+3完整正例；不能以当前27工具单测顶替。拒绝或继续待批时保持source入口拒绝，继续保留失败史。

## 实际验证及失败历史

首次私有Source准备实际host1/null/16546ms，UI未启动、精确原因未知；随后只读目录余留计数0，不宣称取消兜底。详见[P证据](../evidence/harness-final-browser-evidence-2026-10-20.md)。候选最终27工具单测与strict lint过；新阶段版未再实际启动Source。

封存前在f454aa4、有上述七项候选的工作区执行完整 `pnpm ci:local`，日志 `/tmp/kingturf-final-intermediate-working-ci-2026-10-20.log`，实际exit1/signal null/115346ms，HEAD和候选状态首尾不变。格式/静态检查、27工具用例、覆盖工具15例已过；覆盖采集以“coverage must start from a committed clean test/config/runner/dependency snapshot”硬拒绝脏快照，未进入六包实际覆盖采集，后继build/audit未执行。不把此轮算完整CI通过，不修改清洁门禁或掩盖失败。封存恢复后提交本准备件，再从实际干净HEAD完整重跑，结果另以实际日志/交接记录为准。

两次封存辅助脚本首试分别因输出截断无法解析、反向diff头方向检查不匹配而停止，均在撤回前失败、未改七项候选；成功路径随后精确hash验证。补丁保存与恢复使用文件补丁工具，不运行笼统reset/checkout或猜测schema删除。

独立只读审核确认七文件/公开内容与当前入口未启用，无必要阻断。暂存diff-check随后发现统一补丁四个空上下文行各带一个空格；只将这四行规范为空行，候选代码/逐文件hash不变，再次apply--check实际0。原始补丁hash为`4f6ef40088a5f537060cf33372c82d1f92defb1eebe6a2dc36993699578a0232`，最终版本以上述`cfb8b54e…`为准，不忽略空白门禁。

此准备件与补丁可成组独立回滚，不删除发现史、不回滚已完成成果。当前P义务链仍未完成/不能终验，§14未执行；最终干净HEAD全CI不等于Source/P1或两完整浏览器轮通过。
