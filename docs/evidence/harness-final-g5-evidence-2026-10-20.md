# 终验 B：G5 完整函数门禁验证（2026-10-20）

后补实际完整CI：`a7432e6cbd787d01ce7011805a5d47ec40bf901f`干净HEAD `pnpm ci:local`实际exit0/signal null/390232ms，首尾HEAD不变、工作树空；日志 `/tmp/kingturf-final-b-g5-a7432e6-ci-2026-10-20.log`。该HEAD已执行最终九项G5与原39项组合48全过，原29/G5四、service强制0，六包/覆盖三目标/build/audit零漏洞通过。下方“完整CI待补”为定向提交前历史；本条不冒充后继文档HEAD验证或P两轮/人工终验。

先[终验R7](../tasks/harness-final-acceptance-authorization-2026-10-20.md)/2e1159d，再[实测设计](../tasks/harness-final-g5-design-2026-10-20.md)/db045d9；当前定向验证已完成，完整实际HEAD CI后补，不称人类终验或§14竣工。

上述CI实际coverage run为`740cdf6f-ff81-4277-bb5f-02e35af45620`，结果`coverage/run-740cdf6f-ff81-4277-bb5f-02e35af45620/result.json`：377生产源/25仓储，整体37492/48601（77.14%）、domain629/671（93.74%）、API仓储9787/11512（85.02%），deficits空；固定B哈希`73bf74135208cdba109401f2d37507ac81ac7ba03cd9beb497feec849bc6a8ed`不变。仅绑定该实际HEAD，不提前覆盖后继提交。

## 实施与库存

`function-length.mjs`全生产src独立遍历，不复用旧walk的routes裁剪。与覆盖率最低生产库存对齐，src/test内普通.ts仍扫描，只按声明/测试文件后缀排除；新运行时扩展/符号链接/AST坏语法失败关闭。全部带body函数递归、包含签名和嵌套重叠的完整跨度；阈值200。结构符号是名称祖先链，不声称任意无名Block/If间移动都可检测；扫描覆盖当前两层apps/*与packages/*工作区布局，不声称任意未来workspace自动覆盖。

当前完整口径实测 `/tmp/kingturf-final-b-g5-current-baseline-2026-10-20.log`：377文件/3413函数，仍四项3627/3558/208/522，精确结构符号/首末跨度与设计相同，硬违规0。最早基线排/test的旧日志保留，本次收紧后当前数量无差，不能据此认为未来目录内文件可免扫。

独立JSON表四函数，精确路径/名称结构符号/原跨度/当前上限/原因/跟踪owner/整改批次/机器日期；SG 2026-11-17含当日，11-18零时起拒绝。缺失/歧义/更名/增长/新超限/坏表/路径逃逸/重复键/无效日期均硬失败；已缩≤200时陈旧表也必须删，不能留作回长备用。`--report`不放宽G5。原8G1+21G2=29项正文与G3可信根保持，输出29与新G5四项分开；无业务重构/产品修复。

## 实测

`node --test scripts/analysis/function-length.test.mjs scripts/analysis/structure-gate.test.mjs`实际0，48/48（原39+新9），13547.494966ms；日志 `/tmp/kingturf-final-b-g5-unit-current-2026-10-20.log`。包含函数类型/多行签名/嵌套/默认回调、200/201、真实AST同符号歧义、src/test及routes覆盖、表schema/坏JSON/重复字段、失配/增长/新增/陈旧表、SG边界前1ms及当刻、真实CLI report硬红。接原test:release-guardrails→test:coverage→ci:local链，无新外部通道。

主执行者串行真实根注入：

| 变异                                              | 实际结果                             | 还原与日志                                                                                              |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| owned新增201行函数，CLI --report                  | exit1/null，精确G5/201行命中，832ms  | 仅移除owned探针后实际0；/tmp/kingturf-final-b-g5-real-201-2026-10-20.log、restored-201同前缀日志        |
| 首项until昨日、measuredOn同步昨日，表合法但已过期 | exit1/null，expired命中，779ms       | 精确恢复后实际0；/tmp/kingturf-final-b-g5-real-expiry-2026-10-20.log、restored-expiry同前缀日志         |
| 暂移除本轮owned新表                               | exit1/null，四原超限无豁免unexempt=4 | 精确恢复后实际0；/tmp/kingturf-final-b-g5-real-missing-policy-2026-10-20.log、restored-policy同前缀日志 |

表还原SHA256均 `de6a07a14c299b5e493e5345bf4eadab453c1200f5f1954f76a02e8aee576546`；临时新增生产探针已移除，原apps/packages/P1 spec `git diff --exit-code`为0。真实红不是单测代言。日志无账户/DOM/认证产物。

strict ESLint、格式、独立只读设计/实现审无必要阻断；建议的陈旧表清理、src/test免扫口及真实AST歧义自测均已落实。独立审未代主执行测试。MRP证据首次pre-commit发现新表格未格式化，修正后提交，未绕过hook。

完整CI仍须实际提交HEAD后执行；0硬/29旧＋4限期信息豁免不等于存量业务体量债全清或DoD全达成。回滚G5模块/表/接入/自测调用须成组，文档可独立回滚，不撤R7/旧规则/历史失败；P两轮/E材料/人类终验另计。
